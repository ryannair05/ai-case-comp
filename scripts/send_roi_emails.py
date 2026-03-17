"""
Weekly ROI email sender.
Run every Monday at 7am via cron or Railway scheduler:
  python scripts/send_roi_emails.py

Fetches ROI summary from the Vapor API for each active customer,
then sends HTML email via Resend API.
"""
import asyncio
import os
from pathlib import Path

import httpx

# Load .env.local from repo root
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
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = "Draftly <roi@draftly.biz>"


def build_roi_html(name: str, roi: dict) -> str:
    moat = roi.get("moat", {})
    return f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
  <h1 style="color:#00BFA5;">Your Weekly ROI Report</h1>
  <p>Hi {name},</p>
  <p>Here's your Draftly performance summary for the past 7 days:</p>

  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr style="background:#f9fafb;">
      <td style="padding:12px;border:1px solid #e5e7eb;font-weight:bold;">Proposals Generated</td>
      <td style="padding:12px;border:1px solid #e5e7eb;text-align:right;">{roi.get('proposals_this_week', 0)}</td>
    </tr>
    <tr>
      <td style="padding:12px;border:1px solid #e5e7eb;font-weight:bold;">Hours Saved</td>
      <td style="padding:12px;border:1px solid #e5e7eb;text-align:right;">{roi.get('hours_saved', 0):.1f} hrs</td>
    </tr>
    <tr style="background:#f9fafb;">
      <td style="padding:12px;border:1px solid #e5e7eb;font-weight:bold;">Wins This Week</td>
      <td style="padding:12px;border:1px solid #e5e7eb;text-align:right;">{roi.get('wins_this_week', 0)}</td>
    </tr>
    <tr>
      <td style="padding:12px;border:1px solid #e5e7eb;font-weight:bold;">Revenue Attributed</td>
      <td style="padding:12px;border:1px solid #e5e7eb;text-align:right;">${roi.get('revenue_attributed', 0):,.0f}</td>
    </tr>
    <tr style="background:#f0fdf4;">
      <td style="padding:12px;border:1px solid #e5e7eb;font-weight:bold;">Switching Cost (Moat)</td>
      <td style="padding:12px;border:1px solid #e5e7eb;text-align:right;">${moat.get('total_cost', 0):,}</td>
    </tr>
    <tr>
      <td style="padding:12px;border:1px solid #e5e7eb;font-weight:bold;">Milestone</td>
      <td style="padding:12px;border:1px solid #e5e7eb;text-align:right;">{moat.get('milestone', 'onboarding').title()}</td>
    </tr>
  </table>

  <a href="https://app.draftly.biz/dashboard"
     style="background:#00BFA5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0;">
    View Dashboard →
  </a>

  <p style="color:#666;font-size:12px;">
    Each proposal you upload deepens your moat. At 50+ proposals, your switching cost exceeds $15,000.
  </p>
  <p style="color:#999;font-size:11px;">Results you can measure, stories worth telling.</p>
</div>"""


async def send_email(to: str, name: str, html: str) -> None:
    if not RESEND_API_KEY:
        print(f"  [DRY RUN] Would send to {to}")
        return

    async with httpx.AsyncClient() as http:
        res = await http.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": FROM_EMAIL,
                "to": [to],
                "subject": f"Your Draftly Weekly ROI — {name}",
                "html": html,
            },
        )
        if res.status_code in (200, 201):
            print(f"  ✓ Sent to {to}")
        else:
            print(f"  ✗ Failed for {to}: {res.status_code} {res.text}")


async def main() -> None:
    print("\n📧 Sending weekly ROI emails...\n")

    async with httpx.AsyncClient(base_url=API_URL, timeout=30.0) as http:
        # Login as admin to get ROI data
        res = await http.post(
            "/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        res.raise_for_status()
        token = res.json()["token"]
        name = res.json().get("name", "Customer")
        email = res.json().get("email", "")
        headers = {"Authorization": f"Bearer {token}"}

        # Get ROI summary
        res = await http.get("/analytics/roi-summary", headers=headers)
        res.raise_for_status()
        roi = res.json()

        html = build_roi_html(name, roi)
        await send_email(email, name, html)

    print("\n✅ ROI emails sent.\n")


if __name__ == "__main__":
    asyncio.run(main())
