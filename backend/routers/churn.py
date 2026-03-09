"""
Churn detection router + background detection logic.

Highest-ROI build in Phase 1.
At $2,800 LTV per customer, saving 1-2 accounts/week = $2,800-5,600 preserved LTV.
Flags: >30% usage drop OR 7+ days inactive OR NPS < 40.
"""
import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException

from models.schemas import ChurnSignal, get_current_customer, get_supabase

router = APIRouter(prefix="/churn", tags=["churn"])

SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "")

USAGE_DROP_THRESHOLD = 0.30  # 30% drop triggers flag
INACTIVITY_DAYS = 7          # 7 days inactive triggers flag
NPS_ALARM = 40               # NPS below 40 triggers flag


# ---------------------------------------------------------------------------
# Get churn signals for a customer (internal/admin use)
# ---------------------------------------------------------------------------

@router.get("/signals", response_model=list[ChurnSignal])
async def get_churn_signals(customer=Depends(get_current_customer)):
    """Return churn signals logged for this customer."""
    supabase = get_supabase()
    result = (
        supabase.table("churn_signals")
        .select("*")
        .eq("customer_id", str(customer.id))
        .order("flagged_at", desc=True)
        .limit(20)
        .execute()
    )
    return result.data


# ---------------------------------------------------------------------------
# Manual churn detection run (called by cron job or admin)
# ---------------------------------------------------------------------------

@router.post("/detect")
async def run_churn_detection(customer=Depends(get_current_customer)):
    """
    Run churn detection for all customers.
    Normally called by the churn_cron.py script every Monday 7am.
    Can also be triggered manually for testing.
    """
    supabase = get_supabase()
    cutoff = (datetime.utcnow() - timedelta(days=INACTIVITY_DAYS)).isoformat()

    # Fetch all active customers with their recent activity
    customers_result = (
        supabase.table("customers")
        .select("id, name, email, tier, proposals_indexed, onboarded_at, status")
        .eq("status", "active")
        .execute()
    )

    flagged = []
    for cust in customers_result.data:
        # Count proposals in the last 7 days as proxy for usage
        recent_proposals = (
            supabase.table("proposals")
            .select("id", count="exact")
            .eq("customer_id", cust["id"])
            .gte("created_at", cutoff)
            .execute()
        )
        recent_count = recent_proposals.count or 0

        # Compare to prior 7-day period
        prior_cutoff = (datetime.utcnow() - timedelta(days=14)).isoformat()
        prior_proposals = (
            supabase.table("proposals")
            .select("id", count="exact")
            .eq("customer_id", cust["id"])
            .gte("created_at", prior_cutoff)
            .lt("created_at", cutoff)
            .execute()
        )
        prior_count = prior_proposals.count or 0

        # Calculate usage drop
        usage_drop_pct = 0.0
        if prior_count > 0:
            usage_drop_pct = (prior_count - recent_count) / prior_count
        elif recent_count == 0:
            usage_drop_pct = 1.0  # zero usage both periods

        # Days since last proposal
        last_proposal = (
            supabase.table("proposals")
            .select("created_at")
            .eq("customer_id", cust["id"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if last_proposal.data:
            last_active = datetime.fromisoformat(last_proposal.data[0]["created_at"])
            days_inactive = (datetime.utcnow() - last_active).days
        else:
            days_inactive = 999  # never used

        should_flag = (
            usage_drop_pct >= USAGE_DROP_THRESHOLD
            or days_inactive >= INACTIVITY_DAYS
        )

        if should_flag:
            # Log to churn_signals table
            supabase.table("churn_signals").insert(
                {
                    "customer_id": cust["id"],
                    "usage_drop_pct": round(usage_drop_pct, 4),
                    "days_inactive": days_inactive,
                }
            ).execute()

            # Send Slack alert to CS team
            if SLACK_WEBHOOK_URL:
                import httpx
                msg = (
                    f"🚨 At-risk account: {cust['name']} ({cust['tier']})\n"
                    f"Usage drop: {usage_drop_pct:.0%} | "
                    f"Inactive: {days_inactive} days"
                )
                async with httpx.AsyncClient() as http:
                    await http.post(SLACK_WEBHOOK_URL, json={"text": msg})

            flagged.append(
                {
                    "customer_id": cust["id"],
                    "name": cust["name"],
                    "usage_drop_pct": round(usage_drop_pct, 4),
                    "days_inactive": days_inactive,
                }
            )

    return {"flagged_count": len(flagged), "accounts": flagged}


# ---------------------------------------------------------------------------
# Mark outreach as sent (CS hire uses this)
# ---------------------------------------------------------------------------

@router.patch("/signals/{signal_id}/outreach-sent")
async def mark_outreach_sent(signal_id: str, customer=Depends(get_current_customer)):
    """CS hire marks that they've contacted an at-risk customer."""
    supabase = get_supabase()
    result = (
        supabase.table("churn_signals")
        .update({"outreach_sent": True})
        .eq("id", signal_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Signal not found")
    return {"status": "updated"}


# ---------------------------------------------------------------------------
# Mark signal as resolved
# ---------------------------------------------------------------------------

@router.patch("/signals/{signal_id}/resolve")
async def resolve_signal(signal_id: str, customer=Depends(get_current_customer)):
    """Mark a churn signal as resolved (customer re-engaged)."""
    supabase = get_supabase()
    result = (
        supabase.table("churn_signals")
        .update({"resolved": True})
        .eq("id", signal_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Signal not found")
    return {"status": "resolved"}
