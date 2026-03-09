"""
Context-Mapper router — switching cost calculation and moat analytics.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from models.schemas import SwitchingCost, get_current_customer, get_supabase

router = APIRouter(prefix="/context-mapper", tags=["context-mapper"])


async def calculate_switching_cost(customer_id: str) -> SwitchingCost:
    """
    Calculate the switching cost for a customer based on their Context-Mapper data.

    Switching cost model (from financial analysis):
      Month 1-3:  $2K-5K   (10-50 proposals)
      Month 3:    $12-18K  (win/loss patterns, pricing history)
      Month 6:    $33K+    (500+ human hours at $39/hr)
      Month 9+:   $80K+    (near-irreplaceable)
    """
    supabase = get_supabase()
    result = (
        supabase.table("customers")
        .select("proposals_indexed, onboarded_at, tier")
        .eq("id", customer_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Customer not found")

    data = result.data
    proposals_indexed = data.get("proposals_indexed", 0)
    onboarded_at = data.get("onboarded_at")

    months_active = 0
    if onboarded_at:
        onboarded_dt = datetime.fromisoformat(onboarded_at.replace("Z", "+00:00"))
        months_active = max(
            0,
            int((datetime.utcnow() - onboarded_dt.replace(tzinfo=None)).days / 30),
        )

    # Human hours to rebuild the knowledge graph manually ($39/hr labor rate)
    human_hours = min(int(proposals_indexed * 0.6), 850)
    labor_cost = human_hours * 39

    # Compounding intelligence value — grows each month
    knowledge_loss = months_active * 500

    total_cost = round(labor_cost + knowledge_loss)

    if months_active >= 6:
        milestone = "entrenched"
    elif months_active >= 3:
        milestone = "embedded"
    else:
        milestone = "onboarding"

    return SwitchingCost(
        total_cost=total_cost,
        human_hours=human_hours,
        proposals_indexed=proposals_indexed,
        months_active=months_active,
        milestone=milestone,
    )


# ---------------------------------------------------------------------------
# Get switching cost for current customer
# ---------------------------------------------------------------------------

@router.get("/switching-cost", response_model=SwitchingCost)
async def get_switching_cost(customer=Depends(get_current_customer)):
    """
    Return the current switching cost estimate for the authenticated customer.
    Powers the Moat Meter UI.
    """
    return await calculate_switching_cost(str(customer.id))


# ---------------------------------------------------------------------------
# Context-Mapper status
# ---------------------------------------------------------------------------

@router.get("/status")
async def get_context_mapper_status(customer=Depends(get_current_customer)):
    """
    Return Context-Mapper health metrics for the customer dashboard.
    Shows how much of their institutional memory is indexed.
    """
    supabase = get_supabase()

    # Count indexed documents by type
    proposals_result = (
        supabase.table("proposals")
        .select("id", count="exact")
        .eq("customer_id", str(customer.id))
        .not_.is_("pinecone_vector_id", "null")
        .execute()
    )
    pricing_result = (
        supabase.table("pricing_data")
        .select("id", count="exact")
        .eq("customer_id", str(customer.id))
        .execute()
    )
    brand_voice_result = (
        supabase.table("brand_voice")
        .select("id", count="exact")
        .eq("customer_id", str(customer.id))
        .execute()
    )

    proposals_indexed = proposals_result.count or 0
    pricing_rows = pricing_result.count or 0
    brand_examples = brand_voice_result.count or 0

    from services.cold_start import COLD_START_THRESHOLD
    cold_start_active = proposals_indexed < COLD_START_THRESHOLD

    switching_cost = await calculate_switching_cost(str(customer.id))

    return {
        "proposals_indexed": proposals_indexed,
        "pricing_rows": pricing_rows,
        "brand_examples": brand_examples,
        "cold_start_active": cold_start_active,
        "cold_start_threshold": COLD_START_THRESHOLD,
        "context_mapper_active": customer.context_mapper_active,
        "switching_cost": switching_cost.model_dump(),
        "milestone": switching_cost.milestone,
    }
