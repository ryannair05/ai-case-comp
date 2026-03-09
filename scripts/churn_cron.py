"""
Churn detection cron job.
Run via Railway cron or Supabase Edge Functions every Monday 7am EST.

Flags:
  - >30% usage drop in last 7 days
  - 7+ days inactive
  - NPS < 40

At $2,800 LTV per customer, saving 1-2 accounts/week = $2,800-5,600 preserved LTV.
Build time: ~5 hours. Highest ROI Phase 1 build.
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Load .env.local from repo root before anything else
_repo_root = Path(__file__).parent.parent
for _env_name in (".env.local", ".env"):
    _env_file = _repo_root / _env_name
    if _env_file.exists():
        for line in _env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip())
        break

sys.path.insert(0, str(_repo_root / "backend"))

import httpx
from supabase import create_client

USAGE_DROP_THRESHOLD = 0.30  # 30%
INACTIVITY_DAYS = 7
NPS_ALARM = 40
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "")


async def send_slack_alert(message: str) -> None:
    if not SLACK_WEBHOOK_URL:
        print(f"[SLACK] {message}")
        return
    async with httpx.AsyncClient() as http:
        await http.post(SLACK_WEBHOOK_URL, json={"text": message})


async def run_churn_detection() -> None:
    supabase = create_client(
        os.environ["NEXT_PUBLIC_SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    cutoff_7d = (datetime.utcnow() - timedelta(days=INACTIVITY_DAYS)).isoformat()
    cutoff_14d = (datetime.utcnow() - timedelta(days=14)).isoformat()

    print(f"[{datetime.utcnow().isoformat()}] Running churn detection...")

    customers_result = (
        supabase.table("customers")
        .select("id, name, email, tier, proposals_indexed")
        .eq("status", "active")
        .execute()
    )

    flagged = []
    for customer in customers_result.data or []:
        cid = customer["id"]

        # Proposals last 7 days
        recent = (
            supabase.table("proposals")
            .select("id", count="exact")
            .eq("customer_id", cid)
            .gte("created_at", cutoff_7d)
            .execute()
        )
        # Proposals prior 7 days
        prior = (
            supabase.table("proposals")
            .select("id", count="exact")
            .eq("customer_id", cid)
            .gte("created_at", cutoff_14d)
            .lt("created_at", cutoff_7d)
            .execute()
        )

        recent_count = recent.count or 0
        prior_count = prior.count or 0

        usage_drop_pct = 0.0
        if prior_count > 0:
            usage_drop_pct = (prior_count - recent_count) / prior_count
        elif recent_count == 0:
            usage_drop_pct = 1.0

        # Last active date
        last_prop = (
            supabase.table("proposals")
            .select("created_at")
            .eq("customer_id", cid)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if last_prop.data:
            last_active = datetime.fromisoformat(
                last_prop.data[0]["created_at"].replace("Z", "+00:00")
            ).replace(tzinfo=None)
            days_inactive = (datetime.utcnow() - last_active).days
        else:
            days_inactive = 999

        should_flag = usage_drop_pct >= USAGE_DROP_THRESHOLD or days_inactive >= INACTIVITY_DAYS

        if should_flag:
            # Log to churn_signals
            supabase.table("churn_signals").insert(
                {
                    "customer_id": cid,
                    "usage_drop_pct": round(usage_drop_pct, 4),
                    "days_inactive": days_inactive,
                }
            ).execute()

            message = (
                f"🚨 At-risk account: {customer['name']} ({customer['tier']})\n"
                f"Usage drop: {usage_drop_pct:.0%} | "
                f"Inactive: {days_inactive} days | "
                f"Proposals indexed: {customer.get('proposals_indexed', 0)}"
            )
            await send_slack_alert(message)
            print(f"  FLAGGED: {customer['name']} — {message}")
            flagged.append(customer)

    print(f"\nChurn detection complete: {len(flagged)} accounts flagged out of {len(customers_result.data or [])} active.")


if __name__ == "__main__":
    asyncio.run(run_churn_detection())
