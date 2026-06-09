"""
Ingestion stage orchestrator — runs loader → normalizer → validator for a deal.

Saves the raw normalised GL to disk as processed/{deal_id}/raw_gl.json.
The validation report is saved as processed/{deal_id}/validation_report.json.
Both are referenced by subsequent pipeline stages.
"""

import json
import logging
from pathlib import Path

from app.pipeline.ingestion.loader import LoaderError, infer_column_map, load_file
from app.pipeline.ingestion.normalizer import NormalizerError, normalise
from app.pipeline.ingestion.validator import validate
from app.schemas.gl import RawGLLine, ValidationReport
from app.storage import file_store

logger = logging.getLogger(__name__)


class IngestionError(Exception):
    pass


def run(deal_id: str) -> tuple[list[RawGLLine], ValidationReport]:
    """
    Run the full ingestion stage for a deal.

    1. Find all uploaded files for this deal
    2. Load + normalise each GL file
    3. Run validation on the combined set
    4. Persist results to disk
    5. Return (lines, report) for the next pipeline stage

    Raises IngestionError if no GL lines can be extracted or validation hard-fails.
    """
    uploaded = file_store.list_uploads(deal_id)
    if not uploaded:
        raise IngestionError(f"No uploaded files found for deal {deal_id}")

    all_lines: list[RawGLLine] = []

    for file_path in uploaded:
        suffix = file_path.suffix.lower()
        if suffix not in {".csv", ".xlsx", ".xls"}:
            logger.info("Skipping non-GL file: %s", file_path.name)
            continue

        logger.info("Ingesting file: %s", file_path.name)
        try:
            df = load_file(file_path)
            col_map = infer_column_map(df)
            lines = normalise(
                df=df,
                column_map=col_map,
                source_file=file_path.name,
                deal_id=deal_id,
            )
            all_lines.extend(lines)
            logger.info("  → %d lines extracted from %s", len(lines), file_path.name)
        except (LoaderError, NormalizerError) as exc:
            raise IngestionError(f"Failed to ingest '{file_path.name}': {exc}") from exc

    if not all_lines:
        raise IngestionError(
            f"No GL lines extracted from uploaded files for deal {deal_id}. "
            "Ensure the files are CSV or Excel with recognisable date, account, and amount columns."
        )

    # Validate the combined GL
    report = validate(all_lines, deal_id)

    # Warn but don't abort if P&L-only (validation handles this case with a warning)
    if not report.is_balanced and not report.warnings:
        raise IngestionError(
            f"Trial balance does not balance for deal {deal_id}. "
            f"Debits: ${report.total_debits:,.2f} | Credits: ${report.total_credits:,.2f} | "
            f"Difference: ${report.difference:,.2f}. "
            "Correct the source data before proceeding."
        )

    # Persist to disk
    processed_dir = file_store.get_processed_dir(deal_id)
    _save_gl(all_lines, processed_dir / "raw_gl.json")
    _save_report(report, processed_dir / "validation_report.json")

    logger.info(
        "Ingestion complete for deal %s: %d lines, %d periods, balanced=%s",
        deal_id, len(all_lines), report.periods_checked, report.is_balanced,
    )
    return all_lines, report


def _save_gl(lines: list[RawGLLine], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump([line.model_dump(mode="json") for line in lines], f, indent=2, default=str)
    logger.debug("Saved %d GL lines to %s", len(lines), path)


def _save_report(report: ValidationReport, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(report.model_dump(mode="json"), f, indent=2, default=str)


def load_raw_gl(deal_id: str) -> list[RawGLLine]:
    """Load persisted GL lines from disk. Used by subsequent pipeline stages."""
    path = file_store.get_processed_dir(deal_id) / "raw_gl.json"
    if not path.exists():
        raise IngestionError(
            f"No processed GL found for deal {deal_id}. Run ingestion stage first."
        )
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return [RawGLLine.model_validate(item) for item in data]
