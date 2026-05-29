"""
Ingestion API — deal lifecycle management.

POST   /api/v1/deals                    Create a new deal
GET    /api/v1/deals                    List all deals
GET    /api/v1/deals/{deal_id}          Get deal details + status
POST   /api/v1/deals/{deal_id}/upload   Upload GL / sales register files
POST   /api/v1/deals/{deal_id}/process  Trigger the processing pipeline
GET    /api/v1/deals/{deal_id}/status   Poll processing status (lightweight)

Route handlers contain NO business logic — they delegate to storage and pipeline.
"""

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile

from app import pipeline_orchestrator
from app.schemas.ingestion import (
    CreateDealRequest,
    DealResponse,
    ProcessRequest,
    ProcessResponse,
    UploadedFileInfo,
    UploadResponse,
)
from app.storage import deal_store, file_store

router = APIRouter(prefix="/deals", tags=["Ingestion"])

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".pdf"}
MAX_FILE_SIZE_MB = 50


def _to_deal_response(deal: dict) -> DealResponse:
    return DealResponse(
        deal_id=deal["deal_id"],
        company_name=deal["company_name"],
        deal_name=deal["deal_name"],
        currency=deal["currency"],
        created_at=deal["created_at"],
        updated_at=deal["updated_at"],
        stages=deal["stages"],
        progress_pct=deal["progress_pct"],
        uploaded_files=[UploadedFileInfo(**f) for f in deal.get("uploaded_files", [])],
        error=deal.get("error"),
    )


@router.post("", response_model=DealResponse, status_code=201)
def create_deal(body: CreateDealRequest) -> DealResponse:
    deal = deal_store.create_deal(
        company_name=body.company_name,
        deal_name=body.deal_name,
        currency=body.currency,
    )
    return _to_deal_response(deal)


@router.get("", response_model=list[DealResponse])
def list_deals() -> list[DealResponse]:
    return [_to_deal_response(d) for d in deal_store.list_deals()]


@router.get("/{deal_id}", response_model=DealResponse)
def get_deal(deal_id: str) -> DealResponse:
    deal = deal_store.get_deal(deal_id)
    if deal is None:
        raise HTTPException(status_code=404, detail=f"Deal {deal_id} not found")
    return _to_deal_response(deal)


@router.get("/{deal_id}/status", response_model=DealResponse)
def get_status(deal_id: str) -> DealResponse:
    return get_deal(deal_id)


@router.post("/{deal_id}/upload", response_model=UploadResponse)
async def upload_files(deal_id: str, files: list[UploadFile]) -> UploadResponse:
    deal = deal_store.get_deal(deal_id)
    if deal is None:
        raise HTTPException(status_code=404, detail=f"Deal {deal_id} not found")

    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    saved: list[UploadedFileInfo] = []

    for upload in files:
        filename = upload.filename or "unnamed"
        suffix = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

        if suffix not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=422,
                detail=f"File type '{suffix}' not allowed. Accepted: {sorted(ALLOWED_EXTENSIONS)}",
            )

        content = await upload.read()
        size_mb = len(content) / (1024 * 1024)
        if size_mb > MAX_FILE_SIZE_MB:
            raise HTTPException(
                status_code=413,
                detail=f"File '{filename}' exceeds {MAX_FILE_SIZE_MB} MB limit ({size_mb:.1f} MB)",
            )

        stored_path, size_bytes = file_store.save_upload(deal_id, filename, content)
        record = deal_store.add_uploaded_file(
            deal_id=deal_id,
            filename=filename,
            stored_path=str(stored_path),
            size_bytes=size_bytes,
        )
        saved.append(UploadedFileInfo(**record["uploaded_files"][-1]))

    return UploadResponse(deal_id=deal_id, files_received=len(saved), files=saved)


@router.post("/{deal_id}/process", response_model=ProcessResponse)
def process_deal(
    deal_id: str,
    body: ProcessRequest,
    background_tasks: BackgroundTasks,
) -> ProcessResponse:
    deal = deal_store.get_deal(deal_id)
    if deal is None:
        raise HTTPException(status_code=404, detail=f"Deal {deal_id} not found")

    if not deal.get("uploaded_files"):
        raise HTTPException(
            status_code=422,
            detail="No files uploaded. Upload GL / sales register files before processing.",
        )

    # Determine which stages to run
    all_stages = ["ingestion", "coa_mapping", "financial_builder", "qoe_engine", "redflag_detector"]
    stages = body.stages if body.stages else all_stages

    # Guard: don't re-process a running job
    running = [s for s in stages if deal["stages"].get(s) == "running"]
    if running:
        raise HTTPException(
            status_code=409,
            detail=f"Stages already running: {running}. Wait for completion before re-triggering.",
        )

    # Reset requested stages to "pending" before queuing
    for stage in stages:
        deal["stages"][stage] = "pending"
    deal_store.update_deal(deal_id, {"stages": deal["stages"], "error": None, "progress_pct": 0})

    background_tasks.add_task(pipeline_orchestrator.run, deal_id=deal_id, stages=stages)

    return ProcessResponse(
        deal_id=deal_id,
        message="Processing started in background. Poll /status for updates.",
        stages_queued=stages,
    )
