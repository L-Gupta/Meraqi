"""
Manages uploaded file storage on disk.

Structure: data/uploads/{deal_id}/{original_filename}
Designed so the directory can be swapped for S3/Blob storage when moving to cloud.
"""

import shutil
from pathlib import Path

from app.config import settings


def get_upload_dir(deal_id: str) -> Path:
    path = settings.upload_dir / deal_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_upload(deal_id: str, filename: str, content: bytes) -> tuple[Path, int]:
    """
    Saves uploaded file bytes to disk. Returns (stored_path, size_bytes).
    If a file with the same name already exists, it is overwritten.
    """
    upload_dir = get_upload_dir(deal_id)

    # Sanitize filename: strip path traversal characters
    safe_name = Path(filename).name
    dest = upload_dir / safe_name

    dest.write_bytes(content)
    return dest, len(content)


def list_uploads(deal_id: str) -> list[Path]:
    upload_dir = settings.upload_dir / deal_id
    if not upload_dir.exists():
        return []
    return sorted(upload_dir.iterdir())


def get_processed_dir(deal_id: str) -> Path:
    path = settings.processed_dir / deal_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def delete_deal_files(deal_id: str) -> None:
    """Remove all uploaded and processed files for a deal."""
    for base in (settings.upload_dir, settings.processed_dir):
        deal_dir = base / deal_id
        if deal_dir.exists():
            shutil.rmtree(deal_dir)
