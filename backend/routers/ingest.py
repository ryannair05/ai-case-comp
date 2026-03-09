"""
Ingest router — handles CSV pricing uploads and proposal file ingestion.

RULE: All file processing is async through Upstash Redis queue.
      Never block the HTTP response with synchronous embedding.
"""
import csv
import io
import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile

from models.schemas import IngestJobResponse, PricingRow, get_current_customer
from services.redis_queue import enqueue_job, get_job_status
from services.rag_pipeline import ingest_pricing_rows, ingest_proposal_text

router = APIRouter(prefix="/ingest", tags=["ingest"])


# ---------------------------------------------------------------------------
# Pricing CSV upload
# ---------------------------------------------------------------------------

@router.post("/pricing-csv", response_model=IngestJobResponse)
async def ingest_pricing_csv(
    file: UploadFile = File(...),
    customer=Depends(get_current_customer),
):
    """
    Accept a CSV with columns: service_type, price_usd, won, notes.
    Queues a background job to embed and upsert to Pinecone.
    Returns immediately with a job_id for polling.
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv")

    content = await file.read()
    try:
        reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
        rows = []
        for row in reader:
            rows.append(
                PricingRow(
                    service_type=row.get("service_type", ""),
                    price_usd=float(row.get("price_usd", 0)),
                    won=row.get("won", "").lower() in ("true", "1", "yes") if row.get("won") else None,
                    notes=row.get("notes"),
                ).model_dump()
            )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV format: {e}")

    if not rows:
        raise HTTPException(status_code=400, detail="CSV contains no valid rows")

    job_id = await enqueue_job(
        "ingest_pricing",
        {"customer_id": str(customer.id), "rows": rows},
    )
    return IngestJobResponse(job_id=job_id, rows_queued=len(rows))


# ---------------------------------------------------------------------------
# Proposal file upload (PDF or DOCX)
# ---------------------------------------------------------------------------

@router.post("/proposal-file", response_model=IngestJobResponse)
async def ingest_proposal_file(
    file: UploadFile = File(...),
    client_name: Optional[str] = Form(None),
    value_usd: Optional[float] = Form(None),
    outcome: Optional[str] = Form("pending"),
    customer=Depends(get_current_customer),
):
    """
    Accept a PDF or DOCX proposal file.
    Extracts text, chunks, embeds, and upserts asynchronously.
    """
    allowed = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="File must be PDF or DOCX")

    content = await file.read()
    proposal_id = uuid.uuid4().hex

    job_id = await enqueue_job(
        "ingest_proposal",
        {
            "customer_id": str(customer.id),
            "proposal_id": proposal_id,
            "filename": file.filename,
            "content_b64": __import__("base64").b64encode(content).decode(),
            "metadata": {
                "client_name": client_name or "",
                "value_usd": value_usd,
                "outcome": outcome,
                "title": file.filename,
            },
        },
    )
    return IngestJobResponse(job_id=job_id)


# ---------------------------------------------------------------------------
# Re-index an existing proposal by ID
# ---------------------------------------------------------------------------

@router.post("/proposal/{proposal_id}", response_model=IngestJobResponse)
async def reindex_proposal(
    proposal_id: str,
    customer=Depends(get_current_customer),
):
    """Trigger re-indexing of an existing proposal already in Supabase."""
    job_id = await enqueue_job(
        "reindex_proposal",
        {"customer_id": str(customer.id), "proposal_id": proposal_id},
    )
    return IngestJobResponse(job_id=job_id)


# ---------------------------------------------------------------------------
# Brand voice ingestion
# ---------------------------------------------------------------------------

@router.post("/brand-voice", response_model=IngestJobResponse)
async def ingest_brand_voice(
    example_text: str = Form(...),
    style_notes: Optional[str] = Form(None),
    tone_tags: Optional[str] = Form(None),  # comma-separated
    customer=Depends(get_current_customer),
):
    """Embed and index a brand voice example."""
    bv_id = uuid.uuid4().hex
    job_id = await enqueue_job(
        "ingest_brand_voice",
        {
            "customer_id": str(customer.id),
            "brand_voice_id": bv_id,
            "text": example_text,
            "metadata": {
                "style_notes": style_notes or "",
                "tone_tags": [t.strip() for t in (tone_tags or "").split(",") if t.strip()],
            },
        },
    )
    return IngestJobResponse(job_id=job_id)


# ---------------------------------------------------------------------------
# Job status polling
# ---------------------------------------------------------------------------

@router.get("/job/{job_id}")
async def get_job(job_id: str, customer=Depends(get_current_customer)):
    """Poll the status of an ingest job."""
    job = await get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
