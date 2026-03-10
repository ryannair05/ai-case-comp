"""
Seed baseline KB articles for the Support AI.
Run once after the backend is running:
  python scripts/seed_kb_articles.py

Calls POST /ingest/kb-article with X-Admin-Key header.
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
ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY", "")

KB_ARTICLES = [
    {
        "title": "Getting Started with Draftly",
        "body": """Welcome to Draftly! Here's how to get set up in under 30 minutes:
1. Upload your pricing sheet (CSV format) in the Onboarding wizard
2. Connect your CRM (HubSpot or Pipedrive) to import client history
3. Upload 5-10 of your best past proposals (PDF or DOCX)
4. Define your brand voice by answering 5 quick questions
Once you've uploaded 15+ proposals, your Context-Mapper activates and proposals become uniquely yours.""",
    },
    {
        "title": "How Context-Mapper Works",
        "body": """Context-Mapper is Draftly's proprietary system that learns from your firm's proposals, pricing, and brand voice.
- It indexes every proposal you upload, building a semantic knowledge graph
- When generating new proposals, it retrieves relevant past wins, pricing anchors, and brand voice patterns
- The more proposals you upload, the harder it is for competitors to replicate your output
- At 50+ proposals, your estimated switching cost exceeds $15,000
Context-Mapper requires the Professional tier ($249/mo) and activates after 15 proposals are indexed.""",
    },
    {
        "title": "Proposal Generation",
        "body": """To generate a proposal with Draftly:
1. Go to the Proposals page and click 'Generate New'
2. Paste the RFP or client brief (minimum 50 characters)
3. Optionally add the client name and estimated deal value
4. Draftly uses your Context-Mapper data to generate a proposal that matches your firm's style
5. Download as DOCX or edit directly in the app
Tips: Include as much context as possible in the RFP text. The more detail you provide, the better the output.""",
    },
    {
        "title": "Billing and Subscription Tiers",
        "body": """Draftly offers three tiers:
- Starter ($99/mo): Basic proposal generation with cold-start templates
- Professional ($249/mo): Full Context-Mapper access, win/loss tracking, ROI reports
- GTM Agent ($399/mo): Everything in Professional plus meeting signal extraction and outreach sequences
You can upgrade at any time from the Billing page. Downgrades take effect at the next billing cycle.
For enterprise pricing, contact sales@draftly.ai.""",
    },
    {
        "title": "Data Export and Privacy (GDPR)",
        "body": """Draftly supports full data portability and the right to erasure:
- Export all your data: Go to Settings > Export > Download All (ZIP file)
- Delete your account: Go to Settings > Export > Delete Account
- Data is encrypted at rest and in transit
- We never use your proposal data to train models for other customers
- Your Context-Mapper data is isolated in a customer-specific namespace
For privacy questions, contact privacy@draftly.ai.""",
    },
    {
        "title": "CRM Integration (HubSpot)",
        "body": """Connect HubSpot to automatically log deals from Draftly:
1. Go to Onboarding Step 2 or Settings > Integrations
2. Click 'Connect HubSpot' and authorize access
3. Once connected, won proposals automatically create deals in your HubSpot pipeline
4. Deal details include client name, value, and outcome
Note: You need HubSpot CRM access with deal write permissions.""",
    },
    {
        "title": "Win/Loss Tracking",
        "body": """Track proposal outcomes to improve your win rate:
1. On the Dashboard, find a proposal with 'Pending' status
2. Click 'Won' or 'Lost' to record the outcome
3. Add a win reason (what worked) or lose reason (what didn't)
4. Draftly analyzes winning patterns to improve future proposals
Your win rate is displayed on the Dashboard and factored into ROI reports.""",
    },
    {
        "title": "Moat Meter (Switching Cost)",
        "body": """The Moat Meter shows how deeply embedded Draftly is in your workflow:
- Onboarding (0-4 proposals): Just getting started
- Embedded (5-19 proposals): Building your knowledge graph
- Entrenched (20-49 proposals): Significant switching cost
- Irreplaceable (50+ proposals): Your competitive advantage is locked in
The switching cost formula factors in: hours of proposal context × $39/hr consultant rate + months active × $500/mo SaaS replacement cost.""",
    },
    {
        "title": "Troubleshooting: Proposal Quality Issues",
        "body": """If your generated proposals don't match your firm's style:
1. Upload more past proposals — Context-Mapper improves with volume
2. Check your brand voice settings in Onboarding Step 4
3. Include more detail in the RFP text when generating
4. Make sure your pricing sheet is up to date
5. For cold-start customers (<15 proposals), output uses industry templates
Tip: Upload your best-performing proposals first to establish the right patterns.""",
    },
    {
        "title": "Weekly ROI Email Reports",
        "body": """Every Monday at 7am, Draftly sends a ROI summary email with:
- Proposals generated this week
- Hours saved (estimated 4.2 hours per proposal)
- Wins and revenue attributed
- Your current Moat Meter status
To unsubscribe, contact support@draftly.ai or reply to the email.""",
    },
]


async def main() -> None:
    print("\n📚 Seeding KB articles for Support AI...\n")

    if not ADMIN_API_KEY:
        print("⚠️  ADMIN_API_KEY not set. Using empty key (will fail if backend requires it).")

    async with httpx.AsyncClient(base_url=API_URL, timeout=30.0) as http:
        headers = {"X-Admin-Key": ADMIN_API_KEY}
        for i, article in enumerate(KB_ARTICLES):
            res = await http.post("/ingest/kb-article", headers=headers, json=article)
            if res.status_code == 200:
                print(f"  ✓ [{i + 1}/{len(KB_ARTICLES)}] {article['title']}")
            else:
                print(f"  ✗ [{i + 1}/{len(KB_ARTICLES)}] {article['title']} — {res.status_code}: {res.text}")

        print(f"\n✅ Seeded {len(KB_ARTICLES)} KB articles.\n")


if __name__ == "__main__":
    asyncio.run(main())
