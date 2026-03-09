"""
Analytics router — unit economics, churn tracking, financial dashboard data.

NORTH STAR: Monthly churn rate > MRR growth.
A 2pp churn difference = $2.02M ARR swing by FY2028.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends

from models.schemas import UnitEconomics, get_current_customer, get_supabase
from routers.context_mapper import calculate_switching_cost

router = APIRouter(prefix="/analytics", tags=["analytics"])

# Scenario thresholds (from financial model)
SCENARIOS = {
    "bear": {"monthly_churn": 0.075, "monthly_growth": 0.05},
    "base": {"monthly_churn": 0.055, "monthly_growth": 0.10},
    "bull": {"monthly_churn": 0.035, "monthly_growth": 0.18},
}

GROSS_MARGIN = 0.71
AI_COST_PER_PROPOSAL = 0.18  # update from actual Anthropic/OpenAI bills monthly


def determine_current_scenario(actual_churn: float) -> str:
    """Map actual churn to bear/base/bull scenario."""
    if actual_churn >= 0.070:
        return "bear"
    if actual_churn <= 0.045:
        return "bull"
    return "base"


def get_monthly_growth_rate(supabase) -> float:
    """Calculate month-over-month customer count growth."""
    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
    sixty_days_ago = (datetime.utcnow() - timedelta(days=60)).isoformat()

    current_result = (
        supabase.table("customers")
        .select("id", count="exact")
        .eq("status", "active")
        .gte("created_at", thirty_days_ago)
        .execute()
    )
    prior_result = (
        supabase.table("customers")
        .select("id", count="exact")
        .eq("status", "active")
        .gte("created_at", sixty_days_ago)
        .lt("created_at", thirty_days_ago)
        .execute()
    )
    current = current_result.count or 0
    prior = prior_result.count or 1  # avoid division by zero
    return round((current - prior) / prior, 4)


# ---------------------------------------------------------------------------
# Unit economics (Priya's dashboard)
# ---------------------------------------------------------------------------

@router.get("/unit-economics", response_model=UnitEconomics)
async def get_unit_economics(customer=Depends(get_current_customer)):
    """
    Real-time unit economics. Updated on every request.
    LTV:CAC = ∞ at $0 CAC — track this as paid acquisition starts.
    """
    supabase = get_supabase()

    # All active customers
    active_result = supabase.table("customers").select("monthly_revenue").eq("status", "active").execute()
    churned_this_month_result = (
        supabase.table("customers")
        .select("id", count="exact")
        .eq("status", "churned")
        .eq("churned_this_month", True)
        .execute()
    )

    active_customers = active_result.data or []
    total_active = len(active_customers)
    churned_this_month = churned_this_month_result.count or 0

    monthly_churn = churned_this_month / max(total_active + churned_this_month, 1)
    avg_lifetime_months = round(1 / monthly_churn, 1) if monthly_churn > 0 else 999.0
    blended_arpa = (
        sum(c.get("monthly_revenue", 0) for c in active_customers) / max(total_active, 1)
    )
    ltv = round(blended_arpa * avg_lifetime_months * GROSS_MARGIN, 2)

    # Average switching cost across all active customers
    switching_costs = []
    for cust in active_customers[:20]:  # sample for performance
        try:
            sc = await calculate_switching_cost(cust.get("id", ""))
            switching_costs.append(sc.total_cost)
        except Exception:
            pass
    avg_switching_cost = round(sum(switching_costs) / max(len(switching_costs), 1), 2)

    return UnitEconomics(
        monthly_churn_rate=round(monthly_churn, 4),
        avg_customer_lifetime_months=avg_lifetime_months,
        blended_arpa_usd=round(blended_arpa, 2),
        ltv_usd=ltv,
        cac_usd=0.0,  # $0 until paid acquisition starts
        ltv_cac_ratio="∞",
        gross_margin=GROSS_MARGIN,
        ai_cost_per_proposal=AI_COST_PER_PROPOSAL,
        avg_switching_cost_usd=avg_switching_cost,
        on_track_for=determine_current_scenario(monthly_churn),
    )


# ---------------------------------------------------------------------------
# Win rate dashboard
# ---------------------------------------------------------------------------

@router.get("/win-rate")
async def get_win_rate(customer=Depends(get_current_customer)):
    """Win rate breakdown by service type and time period."""
    supabase = get_supabase()

    # All proposals with outcomes
    proposals_result = (
        supabase.table("proposals")
        .select("outcome, value_usd, created_at, client_name")
        .eq("customer_id", str(customer.id))
        .not_.is_("outcome", "null")
        .execute()
    )
    proposals = proposals_result.data or []

    total = len(proposals)
    won = [p for p in proposals if p.get("outcome") == "won"]
    lost = [p for p in proposals if p.get("outcome") == "lost"]

    win_rate = round(len(won) / total, 4) if total > 0 else 0.0
    total_revenue_won = sum(p.get("value_usd", 0) or 0 for p in won)
    avg_deal_size = round(total_revenue_won / max(len(won), 1), 2)

    return {
        "total_proposals": total,
        "won": len(won),
        "lost": len(lost),
        "pending": total - len(won) - len(lost),
        "win_rate": win_rate,
        "total_revenue_won_usd": total_revenue_won,
        "avg_deal_size_usd": avg_deal_size,
    }


# ---------------------------------------------------------------------------
# Phase 1 → 2 gate status
# ---------------------------------------------------------------------------

@router.get("/phase-gate")
async def get_phase_gate_status(customer=Depends(get_current_customer)):
    """
    Check the 3 gate conditions for Phase 1 → Phase 2 unlock.
    All 3 must be green before GTM Agent features can be built.
    """
    supabase = get_supabase()

    # Gate 1: ≥50 customers with Context-Mapper active
    cm_result = (
        supabase.table("customers")
        .select("id", count="exact")
        .eq("context_mapper_active", True)
        .execute()
    )
    context_mapper_active_count = cm_result.count or 0

    # Gate 2: Monthly churn ≤5.0%
    unit_econ = await get_unit_economics(customer)
    current_churn = unit_econ.monthly_churn_rate

    # Gate 3: context-mapper PR merged to production (tracked manually)
    pr_merged_result = (
        supabase.table("settings")
        .select("value")
        .eq("key", "context_mapper_pr_merged")
        .execute()
    )
    pr_merged = (
        pr_merged_result.data[0].get("value") == "true"
        if pr_merged_result.data
        else False
    )

    gate1_passed = context_mapper_active_count >= 50
    gate2_passed = current_churn <= 0.05
    gate3_passed = pr_merged
    all_passed = gate1_passed and gate2_passed and gate3_passed

    return {
        "gate1": {
            "label": "≥50 customers with Context-Mapper active",
            "current": context_mapper_active_count,
            "target": 50,
            "passed": gate1_passed,
        },
        "gate2": {
            "label": "Monthly churn ≤5.0%",
            "current": round(current_churn * 100, 2),
            "target": 5.0,
            "passed": gate2_passed,
        },
        "gate3": {
            "label": "Context-Mapper PR merged to production",
            "current": "Merged" if pr_merged else "Pending",
            "target": "Merged",
            "passed": gate3_passed,
        },
        "all_passed": all_passed,
        "gtm_agent_unlocked": all_passed,
    }


# ---------------------------------------------------------------------------
# Weekly ROI summary (used by ROI email + dashboard)
# ---------------------------------------------------------------------------

@router.get("/roi-summary")
async def get_roi_summary(customer=Depends(get_current_customer)):
    """ROI metrics for the current customer, last 7 days."""
    supabase = get_supabase()
    week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()

    proposals_result = (
        supabase.table("proposals")
        .select("id, outcome, value_usd")
        .eq("customer_id", str(customer.id))
        .gte("created_at", week_ago)
        .execute()
    )
    proposals = proposals_result.data or []
    wins = [p for p in proposals if p.get("outcome") == "won"]

    hours_saved = len(proposals) * 4.2  # 4.2 hrs/proposal benchmark
    revenue_attr = sum(p.get("value_usd", 0) or 0 for p in wins)

    switching_cost = await calculate_switching_cost(str(customer.id))

    return {
        "proposals_this_week": len(proposals),
        "wins_this_week": len(wins),
        "hours_saved": round(hours_saved, 1),
        "revenue_attributed_usd": revenue_attr,
        "switching_cost": switching_cost.model_dump(),
    }
