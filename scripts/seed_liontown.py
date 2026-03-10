"""
Seed the demo environment with LionTown Marketing data.
Run once before the competition:
  python scripts/seed_liontown.py

Calls the Swift Vapor API endpoints instead of direct DB imports.
Requires the Vapor backend to be running at API_URL.
"""
import asyncio
import os
import sys
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

# ---------------------------------------------------------------------------
# LionTown Marketing demo firm definition
# ---------------------------------------------------------------------------

LIONTOWN = {
    "name": "LionTown Marketing",
    "email": "demo@liontown.com",
    "password": "liontown2025!",
    "tier": "professional",
    "industry": "marketing_agency",
}

PRICING_CATALOG = [
    {"service_type": "social_media_audit", "price_usd": 4500, "won": True, "notes": "LionTown standard pricing"},
    {"service_type": "brand_strategy", "price_usd": 12000, "won": True, "notes": "LionTown standard pricing"},
    {"service_type": "paid_media", "price_usd": 2800, "won": False, "notes": "Monthly managed campaign"},
    {"service_type": "content_strategy", "price_usd": 6500, "won": True, "notes": "90-day content roadmap"},
    {"service_type": "website_redesign", "price_usd": 18000, "won": True, "notes": "Full redesign + SEO"},
    {"service_type": "seo_package", "price_usd": 3200, "won": True, "notes": "12-month retainer"},
    {"service_type": "email_marketing", "price_usd": 2200, "won": False, "notes": "CRM + nurture sequences"},
    {"service_type": "full_service_retainer", "price_usd": 8500, "won": True, "notes": "Monthly engagement"},
]

SAMPLE_PROPOSALS = [
    {
        "client_name": "Brightfield Technologies",
        "value_usd": 45000,
        "outcome": "won",
        "win_reason": "Deep data analytics positioning + 90-day ROI guarantee",
        "content": """EXECUTIVE SUMMARY
LionTown Marketing is pleased to present this proposal to Brightfield Technologies.
Based on our analysis, we recommend a comprehensive digital transformation strategy
that will position Brightfield as the thought leader in B2B data analytics.

SITUATION ANALYSIS
Brightfield currently lacks a cohesive digital presence despite having industry-leading
technology. Our audit reveals 3 key gaps: inconsistent brand messaging, underutilized
content channels, and no structured lead nurturing program.

STRATEGIC APPROACH
Phase 1 (Month 1-2): Brand positioning & messaging framework
Phase 2 (Month 3-4): Content strategy & thought leadership program
Phase 3 (Month 5-6): Paid media amplification & lead gen automation

INVESTMENT
Full-Service Retainer: $8,500/month (6-month minimum)
One-time Brand Audit & Strategy: $12,000
Total Year-1 Investment: $114,000

WHY LIONTOWN
Our 73% win rate in B2B technology clients speaks to our methodology.
We guarantee measurable ROI within 90 days or we work for free until we deliver.
Results you can measure, stories worth telling.""",
    },
    {
        "client_name": "Greenfield Capital",
        "value_usd": 66000,
        "outcome": "won",
        "win_reason": "Data-driven approach + ROI guarantee",
        "content": "Brand strategy proposal for Greenfield Capital. Full-funnel approach with measurable ROI milestones. Investment: $12,000 brand strategy + $4,500/mo retainer.",
    },
    {
        "client_name": "Apex Solutions",
        "value_usd": 11000,
        "outcome": "won",
        "win_reason": "Fast turnaround, clear deliverables",
        "content": "Social media audit and content strategy for Apex Solutions B2B tech firm. 90-day content roadmap. Investment: $4,500 audit + $6,500 strategy.",
    },
    {
        "client_name": "Summit Partners",
        "value_usd": 33600,
        "outcome": "lost",
        "content": "Paid media management proposal for Summit Partners. Full-funnel paid strategy across LinkedIn and Google. Monthly retainer: $2,800.",
    },
    {
        "client_name": "Horizon Group",
        "value_usd": 56400,
        "outcome": "won",
        "win_reason": "Integrated approach, strong case studies",
        "content": "Website redesign and SEO package for Horizon Group. New site + 12-month SEO retainer. Investment: $18,000 redesign + $3,200/mo SEO.",
    },
    {
        "client_name": "Nexus Media",
        "value_usd": 26400,
        "outcome": "won",
        "win_reason": "Automation expertise, quick setup",
        "content": "Email marketing automation setup and management. Full CRM integration with 6-month nurture sequences. Investment: $2,200/mo.",
    },
]

BRAND_VOICE = {
    "example_text": """At LionTown Marketing, we believe every dollar of marketing spend should be
accountable. We don't just tell compelling stories — we build systems that
prove those stories drive revenue. Our data-driven creative strategy has
helped 47 B2B firms achieve an average 340% ROI on their marketing investment.

Results you can measure, stories worth telling.""",
    "style_notes": "Structure: Problem → Insight → Solution → Evidence → Investment. Avoid: jargon, excessive adjectives. Signature: Results you can measure, stories worth telling.",
    "tone_tags": "authoritative, data-driven, warm",
}


async def main() -> None:
    print("\n🦁 Seeding LionTown Marketing demo data...\n")
    print(f"   API: {API_URL}\n")

    async with httpx.AsyncClient(base_url=API_URL, timeout=30.0) as http:

        # 1. Register the demo account (or login if it already exists)
        token = None
        try:
            res = await http.post("/auth/register", json=LIONTOWN)
            res.raise_for_status()
            data = res.json()
            token = data["token"]
            customer_id = data["customer_id"]
            print(f"✓ Registered: {LIONTOWN['name']} (id={customer_id})")
        except httpx.HTTPStatusError:
            # Probably already registered — try login
            res = await http.post(
                "/auth/login",
                json={"email": LIONTOWN["email"], "password": LIONTOWN["password"]},
            )
            res.raise_for_status()
            data = res.json()
            token = data["token"]
            customer_id = data["customer_id"]
            print(f"✓ Logged in (already registered): {LIONTOWN['name']} (id={customer_id})")

        headers = {"Authorization": f"Bearer {token}"}

        # 2. Upload pricing CSV
        import io

        csv_lines = ["service_type,price_usd,won,notes"]
        for row in PRICING_CATALOG:
            csv_lines.append(
                f"{row['service_type']},{row['price_usd']},{str(row['won']).lower()},{row.get('notes', '')}"
            )
        csv_content = "\n".join(csv_lines)

        res = await http.post(
            "/ingest/pricing-csv",
            headers={**headers, "Content-Type": "text/csv"},
            content=csv_content.encode(),
        )
        res.raise_for_status()
        print(f"✓ Seeded {len(PRICING_CATALOG)} pricing rows")

        # 3. Upload sample proposals
        for i, prop in enumerate(SAMPLE_PROPOSALS):
            res = await http.post(
                "/proposals",
                headers=headers,
                json={
                    "title": f"Proposal for {prop['client_name']}",
                    "content": prop["content"],
                    "client_name": prop.get("client_name"),
                    "value_usd": prop.get("value_usd"),
                    "outcome": prop.get("outcome", "pending"),
                },
            )
            res.raise_for_status()
            proposal_id = res.json().get("id", "")

            # Mark win/loss with reason
            if prop.get("outcome") in ("won", "lost"):
                update_data = {"outcome": prop["outcome"]}
                if prop.get("win_reason"):
                    update_data["win_reason"] = prop["win_reason"]
                await http.patch(
                    f"/proposals/{proposal_id}",
                    headers=headers,
                    json=update_data,
                )

            print(f"  ✓ Proposal {i + 1}/{len(SAMPLE_PROPOSALS)}: {prop['client_name']} ({prop.get('outcome', 'pending')})")

        print(f"✓ Seeded {len(SAMPLE_PROPOSALS)} proposals")

        # 4. Upload brand voice
        res = await http.post(
            "/ingest/brand-voice",
            headers=headers,
            json=BRAND_VOICE,
        )
        res.raise_for_status()
        print("✓ Seeded brand voice")

    print(f"\n✅ LionTown Marketing seeded successfully!")
    print(f"   Customer ID: {customer_id}")
    print(f"   Proposals indexed: {len(SAMPLE_PROPOSALS)} (simulated 847)")
    print(f"   Retainer anchor: $4,500")
    print(f"   Win rate to cite: 73% (Brightfield case)")
    print(f"\n   Demo is ready at: http://localhost:3000/demo\n")


if __name__ == "__main__":
    asyncio.run(main())
