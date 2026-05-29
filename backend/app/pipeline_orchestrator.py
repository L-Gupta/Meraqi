"""
Pipeline Orchestrator — coordinates all processing stages for a deal.

This is a stub for Step 1. Full implementation in Step 2+.
Each stage is run sequentially; status is updated in the deal store after each.
"""

import logging

from app.storage import deal_store

logger = logging.getLogger(__name__)

STAGE_ORDER = [
    "ingestion",
    "coa_mapping",
    "financial_builder",
    "qoe_engine",
    "redflag_detector",
]


def run(deal_id: str, stages: list[str]) -> None:
    """
    Entry point called as a FastAPI BackgroundTask.
    Runs each requested stage in order, updating deal status as it goes.

    In Step 2+ each stage delegates to its dedicated pipeline module.
    """
    logger.info("Pipeline started for deal %s | stages: %s", deal_id, stages)

    for stage in stages:
        if stage not in STAGE_ORDER:
            logger.warning("Unknown stage '%s' — skipping", stage)
            continue

        try:
            deal_store.set_stage_status(deal_id, stage, "running")
            logger.info("Stage '%s' started for deal %s", stage, deal_id)

            _run_stage(deal_id, stage)

            deal_store.set_stage_status(deal_id, stage, "complete")
            logger.info("Stage '%s' complete for deal %s", stage, deal_id)

        except Exception as exc:
            logger.exception("Stage '%s' failed for deal %s: %s", stage, deal_id, exc)
            deal_store.set_stage_status(deal_id, stage, "failed")
            deal_store.update_deal(deal_id, {"error": str(exc)})
            return  # Abort remaining stages on failure

    logger.info("Pipeline complete for deal %s", deal_id)


def _run_stage(deal_id: str, stage: str) -> None:
    """
    Dispatches to the appropriate pipeline module.
    Stages are stubs until their respective implementation steps.
    """
    if stage == "ingestion":
        from app.pipeline.ingestion import orchestrator as ingestion_orch
        lines, report = ingestion_orch.run(deal_id)
        logger.info(
            "Ingestion complete: %d lines, %d periods, balanced=%s",
            len(lines), report.periods_checked, report.is_balanced,
        )

    elif stage == "coa_mapping":
        # CoA mapping is handled as part of financial_builder to share the mapped GL
        logger.info("coa_mapping is run as part of financial_builder stage — no-op here")

    elif stage == "financial_builder":
        from app.pipeline.financial_builder import orchestrator as fb_orch
        fb_orch.run(deal_id)

    elif stage == "qoe_engine":
        from app.pipeline.qoe_engine import orchestrator as qoe_orch
        qoe_orch.run(deal_id)

    elif stage == "redflag_detector":
        from app.pipeline.redflag_detector import orchestrator as rf_orch
        rf_orch.run(deal_id)
