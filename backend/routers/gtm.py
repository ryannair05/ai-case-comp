"""
GTM Agent router — Phase 2 features.

Exposes meeting intelligence and outreach sequence generation powered by
the Context-Mapper knowledge graph and Claude Sonnet 4.6.

These endpoints are available once the Phase 1 → 2 gate conditions are met,
but they can be previewed at any tier for demo purposes.
"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta

from models.schemas import (
    MeetingSignalsRequest,
    MeetingSignalsResponse,
    OutreachSequenceRequest,
    OutreachSequenceResponse,
    OutreachEmail,
    PipelineDeal,
    get_current_customer,
    get_supabase,
)
from services.claude_client import extract_meeting_signals, generate_outreach_sequence
from services.rag_pipeline import retrieve_context

router = APIRouter(prefix="/gtm", tags=["gtm"])


# ---------------------------------------------------------------------------
# Meeting intelligence — extract signals from raw notes
# ---------------------------------------------------------------------------

@router.post("/meeting-signals", response_model=MeetingSignalsResponse)
async def analyze_meeting_notes(
    payload: MeetingSignalsRequest,
    customer=Depends(get_current_customer),
):
    """
    Extract structured sales signals from raw meeting notes.
    Returns budget signals, needs, objections, deal stage, and next actions.
    Uses Claude Sonnet 4.6 with 72hr Redis cache.
    """
    signals = await extract_meeting_signals(
        customer_id=str(customer.id),
        raw_notes=payload.raw_notes,
        client_name=payload.client_name,
    )
    return MeetingSignalsResponse(**signals)


# ---------------------------------------------------------------------------
# Outreach sequence builder
# ---------------------------------------------------------------------------

@router.post("/outreach-sequence", response_model=OutreachSequenceResponse)
async def build_outreach_sequence(
    payload: OutreachSequenceRequest,
    customer=Depends(get_current_customer),
):
    """
    Generate a personalised multi-email outreach sequence.
    Pulls win stories from the customer's Context-Mapper namespace for social proof.
    AI disclosure is appended automatically (ethics requirement).
    """
    # Retrieve win stories from Context-Mapper to ground the outreach
    win_context = await retrieve_context(
        customer_id=str(customer.id),
        query=f"winning proposal {payload.prospect_industry} client success",
        top_k=5,
    )

    emails_raw = await generate_outreach_sequence(
        sender_firm=customer.name,
        prospect=payload.model_dump(),
        win_context=win_context,
        sequence_length=payload.sequence_length,
    )

    emails = [OutreachEmail(**e) for e in emails_raw]
    return OutreachSequenceResponse(
        sequence=emails,
        ai_disclosure=(
            "This outreach sequence was drafted with AI assistance (Draftly / Claude Sonnet 4.6). "
            "Please review and personalise before sending."
        ),
    )


# ---------------------------------------------------------------------------
# Pipeline / deal velocity dashboard
# ---------------------------------------------------------------------------

@router.get("/pipeline")
async def get_pipeline(customer=Depends(get_current_customer)):
    """
    Deal pipeline: all open proposals grouped by stage, with velocity metrics.
    Combines proposal records with any GTM deal-stage signals stored as metadata.
    """
    supabase = get_supabase()

    proposals_result = (
        supabase.table("proposals")
        .select("id, client_name, value_usd, outcome, created_at")
        .eq("customer_id", str(customer.id))
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .execute()
    )
    proposals = proposals_result.data or []

    now = datetime.utcnow()
    pipeline: list[dict] = []
    stage_totals: dict[str, dict] = {
        "discovery": {"count": 0, "value": 0},
        "proposal": {"count": 0, "value": 0},
        "negotiation": {"count": 0, "value": 0},
        "closed_won": {"count": 0, "value": 0},
        "closed_lost": {"count": 0, "value": 0},
    }

    for p in proposals:
        # Map proposal outcome to pipeline stage
        outcome = p.get("outcome") or "pending"
        if outcome == "won":
            stage = "closed_won"
        elif outcome == "lost":
            stage = "closed_lost"
        else:
            stage = "proposal"  # default open stage

        created_str = p.get("created_at", "")
        try:
            created_dt = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
            days_open = (now - created_dt.replace(tzinfo=None)).days
        except Exception:
            days_open = 0

        value = p.get("value_usd") or 0
        deal = {
            "proposal_id": p["id"],
            "client_name": p.get("client_name"),
            "value_usd": value,
            "outcome": outcome,
            "deal_stage": stage,
            "days_open": days_open,
            "created_at": created_str,
        }
        pipeline.append(deal)

        if stage in stage_totals:
            stage_totals[stage]["count"] += 1
            stage_totals[stage]["value"] += value

    # Velocity: average days from proposal to close (won only)
    won_deals = [d for d in pipeline if d["deal_stage"] == "closed_won"]
    avg_days_to_close = (
        round(sum(d["days_open"] for d in won_deals) / len(won_deals), 1)
        if won_deals
        else None
    )

    open_pipeline_value = sum(
        d["value_usd"] for d in pipeline if d["deal_stage"] not in ("closed_won", "closed_lost")
    )

    return {
        "pipeline": pipeline,
        "stage_totals": stage_totals,
        "open_pipeline_value_usd": open_pipeline_value,
        "avg_days_to_close": avg_days_to_close,
        "total_deals": len(pipeline),
    }
