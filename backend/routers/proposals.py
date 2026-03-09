"""
Proposals router — CRUD + AI generation + win/loss tracking.
Every endpoint validates customer_id from JWT.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from models.schemas import (
    Proposal,
    ProposalCreate,
    ProposalGenerateRequest,
    ProposalUpdate,
    get_current_customer,
    get_supabase,
)
from services.rag_pipeline import generate_proposal_with_rag
from services.redis_queue import enqueue_job

router = APIRouter(prefix="/proposals", tags=["proposals"])


def _customer_proposals_query(supabase, customer_id: str):
    """Base query: always filter by customer_id (row-level security enforcement)."""
    return supabase.table("proposals").select("*").eq("customer_id", str(customer_id))


# ---------------------------------------------------------------------------
# List proposals
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[Proposal])
async def list_proposals(
    limit: int = 50,
    offset: int = 0,
    customer=Depends(get_current_customer),
):
    """Return all proposals for the authenticated customer."""
    supabase = get_supabase()
    result = (
        _customer_proposals_query(supabase, customer.id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data


# ---------------------------------------------------------------------------
# Get single proposal
# ---------------------------------------------------------------------------

@router.get("/{proposal_id}", response_model=Proposal)
async def get_proposal(proposal_id: str, customer=Depends(get_current_customer)):
    """Fetch a single proposal by ID. Validates customer ownership."""
    supabase = get_supabase()
    result = (
        _customer_proposals_query(supabase, customer.id)
        .eq("id", proposal_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return result.data


# ---------------------------------------------------------------------------
# Create proposal (manual entry)
# ---------------------------------------------------------------------------

@router.post("/", response_model=Proposal)
async def create_proposal(
    payload: ProposalCreate,
    customer=Depends(get_current_customer),
):
    """Create a new proposal record (manual entry, no AI generation)."""
    supabase = get_supabase()
    result = (
        supabase.table("proposals")
        .insert(
            {
                "customer_id": str(customer.id),
                **payload.model_dump(exclude_none=True),
            }
        )
        .execute()
    )
    proposal = result.data[0]

    # Queue indexing so it's immediately searchable in Context-Mapper
    await enqueue_job(
        "reindex_proposal",
        {"customer_id": str(customer.id), "proposal_id": proposal["id"]},
    )
    return proposal


# ---------------------------------------------------------------------------
# Generate proposal with AI + Context-Mapper
# ---------------------------------------------------------------------------

@router.post("/generate", response_model=dict)
async def generate_proposal(
    payload: ProposalGenerateRequest,
    customer=Depends(get_current_customer),
):
    """
    Generate a proposal using RAG + Claude Sonnet 4.6.
    Automatically uses Context-Mapper context if available,
    or cold-start industry templates if < 15 proposals indexed.
    """
    if customer.tier == "starter":
        raise HTTPException(
            status_code=403,
            detail="Context-Mapper requires Professional tier ($249/mo). Upgrade to unlock.",
        )

    content = await generate_proposal_with_rag(
        customer_id=str(customer.id),
        rfp_text=payload.rfp_text,
        proposals_indexed=customer.proposals_indexed,
    )

    # Persist the generated proposal
    supabase = get_supabase()
    result = (
        supabase.table("proposals")
        .insert(
            {
                "customer_id": str(customer.id),
                "content": content,
                "client_name": payload.client_name,
                "value_usd": payload.value_usd,
                "outcome": "pending",
            }
        )
        .execute()
    )
    proposal = result.data[0]

    return {"proposal_id": proposal["id"], "content": content}


# ---------------------------------------------------------------------------
# Update proposal (including marking won/lost)
# ---------------------------------------------------------------------------

@router.patch("/{proposal_id}", response_model=Proposal)
async def update_proposal(
    proposal_id: str,
    payload: ProposalUpdate,
    customer=Depends(get_current_customer),
):
    """Update proposal fields. Marking as 'won' triggers playbook update."""
    supabase = get_supabase()

    # Validate ownership before update
    existing = (
        _customer_proposals_query(supabase, customer.id)
        .eq("id", proposal_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Proposal not found")

    update_data = payload.model_dump(exclude_none=True)
    result = (
        supabase.table("proposals")
        .update(update_data)
        .eq("id", proposal_id)
        .eq("customer_id", str(customer.id))
        .execute()
    )

    # If marked as won, trigger playbook update (async)
    if payload.outcome == "won":
        await enqueue_job(
            "update_playbook_on_win",
            {
                "customer_id": str(customer.id),
                "proposal_id": proposal_id,
                "win_reason": payload.win_reason or "",
                "client_type": existing.data.get("client_name", ""),
            },
        )

    return result.data[0]


# ---------------------------------------------------------------------------
# Delete proposal (soft delete — 30-day window)
# ---------------------------------------------------------------------------

@router.delete("/{proposal_id}")
async def delete_proposal(proposal_id: str, customer=Depends(get_current_customer)):
    """Soft-delete a proposal. Hard delete happens after 30 days."""
    supabase = get_supabase()
    result = (
        supabase.table("proposals")
        .update({"deleted_at": datetime.utcnow().isoformat()})
        .eq("id", proposal_id)
        .eq("customer_id", str(customer.id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return {"status": "deleted", "proposal_id": proposal_id}
