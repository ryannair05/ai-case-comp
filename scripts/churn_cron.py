"""
Churn detection cron job.
Run via Railway cron or any scheduler every Monday 7am EST.

Calls the Swift Vapor API instead of direct Supabase access.
Requires: httpx (pip install httpx)

Flags:
  - >30% usage drop in last 7 days
  - 7+ days inactive
  - NPS < 40

At $2,800 LTV per customer, saving 1-2 accounts/week = $2,800-5,600 preserved LTV.
"""
import asyncio
import os
from datetime import datetime
from pathlib import Path

import httpx

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

API_URL = os.environ.get("NEXT_PUBLIC_API_URL", "http://localhost:8080")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "demo@liontown.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "liontown2025!")
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "")


async def send_slack_alert(message: str) -> None:
    if not SLACK_WEBHOOK_URL:
        print(f"[SLACK] {message}")
        return
    async with httpx.AsyncClient() as http:
        await http.post(SLACK_WEBHOOK_URL, json={"text": message})


async def run_churn_detection() -> None:
    print(f"[{datetime.utcnow().isoformat()}] Running churn detection via Vapor API...")
    print(f"   API: {API_URL}\n")

    async with httpx.AsyncClient(base_url=API_URL, timeout=30.0) as http:
        # 1. Authenticate
        res = await http.post(
            "/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        res.raise_for_status()
        token = res.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Trigger churn detection via the Vapor API
        res = await http.post("/churn/detect", headers=headers)
        res.raise_for_status()
        result = res.json()

        customers_scanned = result.get("customers_scanned", 0)
        flagged = result.get("flagged", 0)

        print(f"Churn detection complete: {flagged} accounts flagged out of {customers_scanned} active.")

        if flagged > 0:
            # 3. Get the latest churn signals
            res = await http.get("/churn/signals", headers=headers)
            if res.status_code == 200:
                signals = res.json()
                for signal in signals[:5]:  # Show top 5
                    message = (
                        f"🚨 At-risk account flagged\n"
                        f"Usage drop: {signal.get('usage_drop_pct', 0):.0f}% | "
                        f"Inactive: {signal.get('days_inactive', 0)} days"
                    )
                    await send_slack_alert(message)
                    print(f"  FLAGGED: {message}")


if __name__ == "__main__":
    asyncio.run(run_churn_detection())
