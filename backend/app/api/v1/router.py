from fastapi import APIRouter

from app.api.v1 import financial, gl, ingestion, qoe, redflags

router = APIRouter(prefix="/api/v1")
router.include_router(ingestion.router)
router.include_router(gl.router)
router.include_router(financial.router)
router.include_router(qoe.router)
router.include_router(redflags.router)

# Placeholders — wired in subsequent steps
# from app.api.v1 import nwc, commercial, contracts, databook
