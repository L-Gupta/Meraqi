"""
FDD Engine — FastAPI application factory.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as v1_router
from app.config import settings

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

app = FastAPI(
    title="FDD Engine API",
    description=(
        "Automated Financial Due Diligence engine for M&A Transaction Advisory Services. "
        "Ingests GL exports, trial balances, and contracts; produces QoE analysis, "
        "NWC trends, commercial health metrics, and red flag reports."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router)


@app.get("/health", tags=["System"])
def health_check() -> dict:
    return {
        "status": "ok",
        "version": "0.1.0",
        "mock_llm": settings.use_mock_llm,
    }
