"""
Draftly FastAPI backend — entry point.

Deploy target: Railway
All endpoints validate customer_id from JWT.
All file processing goes through Upstash Redis queue.
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import (
    analytics,
    churn,
    context_mapper,
    crm,
    export,
    gtm,
    ingest,
    proposals,
    support,
)

app = FastAPI(
    title="Draftly API",
    description="AI-Powered Proposal Intelligence — Context-Mapper Backend",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS — allow Vercel frontend + local dev
# ---------------------------------------------------------------------------

ALLOWED_ORIGINS = [
    "https://app.draftly.ai",
    "https://draftly.ai",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Register routers
# ---------------------------------------------------------------------------

app.include_router(proposals.router)
app.include_router(ingest.router)
app.include_router(context_mapper.router)
app.include_router(support.router)
app.include_router(churn.router)
app.include_router(crm.router)
app.include_router(analytics.router)
app.include_router(export.router)
app.include_router(gtm.router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    """Railway health check endpoint."""
    return {"status": "ok", "service": "draftly-api"}


@app.get("/")
async def root():
    return {"service": "Draftly API", "docs": "/docs"}
