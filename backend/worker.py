"""
Background worker — processes jobs from the Upstash Redis queue.
Run as a separate Railway service: python worker.py

Handles:
- ingest_pricing: embed and upsert pricing CSV rows
- ingest_proposal: extract text from PDF/DOCX, chunk, embed, upsert
- reindex_proposal: re-embed an existing proposal from Supabase
- ingest_brand_voice: embed and upsert brand voice examples
- update_playbook_on_win: re-embed winning proposal with boosted metadata
"""
import asyncio
import base64
import io
import logging
import os

from models.schemas import get_supabase
from services.rag_pipeline import (
    ingest_brand_voice_text,
    ingest_pricing_rows,
    ingest_proposal_text,
)
from services.claude_client import extract_win_patterns
from services.redis_queue import dequeue_job, update_job_status

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def extract_text_from_pdf(content: bytes) -> str:
    """Extract raw text from a PDF file using pypdf."""
    import pypdf
    reader = pypdf.PdfReader(io.BytesIO(content))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def extract_text_from_docx(content: bytes) -> str:
    """Extract raw text from a DOCX file using python-docx."""
    import docx
    doc = docx.Document(io.BytesIO(content))
    return "\n".join(para.text for para in doc.paragraphs)


async def process_ingest_pricing(payload: dict) -> None:
    """Embed and upsert pricing rows to Pinecone."""
    customer_id = payload["customer_id"]
    rows = payload["rows"]
    count = await ingest_pricing_rows(customer_id, rows)

    # Update proposal count in Supabase
    supabase = get_supabase()
    supabase.table("pricing_data").insert(
        [
            {
                "customer_id": customer_id,
                "service_type": r["service_type"],
                "price_usd": r["price_usd"],
                "won": r.get("won"),
                "notes": r.get("notes"),
            }
            for r in rows
        ]
    ).execute()
    logger.info(f"Ingested {count} pricing vectors for customer {customer_id}")


async def process_ingest_proposal(payload: dict) -> None:
    """Extract text from PDF/DOCX, chunk, embed, upsert."""
    customer_id = payload["customer_id"]
    proposal_id = payload["proposal_id"]
    content_b64 = payload.get("content_b64", "")
    filename = payload.get("filename", "")
    metadata = payload.get("metadata", {})

    content = base64.b64decode(content_b64)

    # Extract text based on file type
    if filename.lower().endswith(".pdf"):
        text = extract_text_from_pdf(content)
    elif filename.lower().endswith(".docx"):
        text = extract_text_from_docx(content)
    else:
        text = content.decode("utf-8", errors="ignore")

    if not text.strip():
        logger.warning(f"No text extracted from {filename} for customer {customer_id}")
        return

    count = await ingest_proposal_text(customer_id, proposal_id, text, metadata)

    # Persist proposal to Supabase and update indexed count
    supabase = get_supabase()
    supabase.table("proposals").upsert(
        {
            "id": proposal_id,
            "customer_id": customer_id,
            "content": text[:10000],  # store first 10K chars
            "title": metadata.get("title", filename),
            "client_name": metadata.get("client_name"),
            "value_usd": metadata.get("value_usd"),
            "outcome": metadata.get("outcome", "pending"),
            "pinecone_vector_id": f"prop_{proposal_id}_chunk_0",
        }
    ).execute()

    # Increment proposals_indexed counter
    supabase.rpc(
        "increment_proposals_indexed",
        {"customer_id_param": customer_id},
    ).execute()

    logger.info(f"Ingested {count} chunks for proposal {proposal_id}")


async def process_reindex_proposal(payload: dict) -> None:
    """Re-embed an existing proposal from Supabase."""
    customer_id = payload["customer_id"]
    proposal_id = payload["proposal_id"]

    supabase = get_supabase()
    result = (
        supabase.table("proposals")
        .select("*")
        .eq("id", proposal_id)
        .eq("customer_id", customer_id)
        .single()
        .execute()
    )
    if not result.data:
        logger.error(f"Proposal {proposal_id} not found for reindex")
        return

    proposal = result.data
    metadata = {
        "title": proposal.get("title", ""),
        "client_name": proposal.get("client_name", ""),
        "outcome": proposal.get("outcome", ""),
        "value_usd": proposal.get("value_usd"),
        "win_reason": proposal.get("win_reason", ""),
    }
    count = await ingest_proposal_text(customer_id, proposal_id, proposal["content"], metadata)
    logger.info(f"Re-indexed {count} chunks for proposal {proposal_id}")


async def process_ingest_brand_voice(payload: dict) -> None:
    """Embed and upsert brand voice examples."""
    customer_id = payload["customer_id"]
    bv_id = payload["brand_voice_id"]
    text = payload["text"]
    metadata = payload.get("metadata", {})

    count = await ingest_brand_voice_text(customer_id, bv_id, text, metadata)

    # Persist to Supabase
    supabase = get_supabase()
    supabase.table("brand_voice").upsert(
        {
            "id": bv_id,
            "customer_id": customer_id,
            "example_text": text,
            "style_notes": metadata.get("style_notes"),
            "tone_tags": metadata.get("tone_tags"),
            "pinecone_vector_id": f"bv_{bv_id}_chunk_0",
        }
    ).execute()
    logger.info(f"Ingested {count} brand voice chunks for customer {customer_id}")


async def process_update_playbook_on_win(payload: dict) -> None:
    """Re-embed a winning proposal with boosted metadata for stronger retrieval."""
    customer_id = payload["customer_id"]
    proposal_id = payload["proposal_id"]
    win_reason = payload.get("win_reason", "")
    client_type = payload.get("client_type", "")

    supabase = get_supabase()
    result = (
        supabase.table("proposals")
        .select("content")
        .eq("id", proposal_id)
        .single()
        .execute()
    )
    if not result.data:
        return

    # Extract winning patterns via Claude
    patterns = await extract_win_patterns(result.data["content"], win_reason)

    # Re-embed with win metadata and boost flag
    metadata = {
        "outcome": "won",
        "win_reason": win_reason,
        "client_type": client_type,
        "win_patterns": patterns,
        "boost": 1.5,  # signals higher importance in retrieval ranking
    }
    await ingest_proposal_text(customer_id, proposal_id, result.data["content"], metadata)
    logger.info(f"Playbook updated with winning patterns for proposal {proposal_id}")


# ---------------------------------------------------------------------------
# Job dispatcher
# ---------------------------------------------------------------------------

JOB_HANDLERS = {
    "ingest_pricing": process_ingest_pricing,
    "ingest_proposal": process_ingest_proposal,
    "reindex_proposal": process_reindex_proposal,
    "ingest_brand_voice": process_ingest_brand_voice,
    "update_playbook_on_win": process_update_playbook_on_win,
}


async def run_worker() -> None:
    """Main worker loop — polls Redis queue and processes jobs."""
    logger.info("Draftly background worker started")
    while True:
        job = await dequeue_job()
        if not job:
            await asyncio.sleep(1)  # idle wait
            continue

        job_id = job.get("id", "unknown")
        job_type = job.get("type")
        payload = job.get("payload", {})

        logger.info(f"Processing job {job_id} (type={job_type})")
        await update_job_status(job_id, "processing")

        handler = JOB_HANDLERS.get(job_type)
        if not handler:
            logger.error(f"Unknown job type: {job_type}")
            await update_job_status(job_id, "failed", {"error": "Unknown job type"})
            continue

        try:
            await handler(payload)
            await update_job_status(job_id, "completed")
            logger.info(f"Job {job_id} completed")
        except Exception as e:
            logger.exception(f"Job {job_id} failed: {e}")
            await update_job_status(job_id, "failed", {"error": str(e)})


if __name__ == "__main__":
    asyncio.run(run_worker())
