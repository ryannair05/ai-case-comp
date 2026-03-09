"""
Seed the demo environment with LionTown Marketing data.
Run once before the competition:
  python scripts/seed_liontown.py

Creates a realistic 847-proposal marketing agency knowledge graph
in the LionTown customer namespace.
"""
import asyncio
import os
import sys
import uuid
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

from services.embeddings import embed_batch
from services.pinecone_client import get_or_create_index, upsert_vectors, customer_namespace
from supabase import create_client

# ---------------------------------------------------------------------------
# LionTown Marketing demo firm definition
# ---------------------------------------------------------------------------

LIONTOWN = {
    "id": "0d1a3e07-5d4a-5f7d-8be7-255a1109bce0",
    "name": "LionTown Marketing",
    "email": "demo@liontown.com",
    "proposals_indexed": 847,
    "tier": "professional",
    "context_mapper_active": True,
    "onboarded_at": "2025-10-01T00:00:00Z",
    "industry": "marketing_agency",
    "monthly_revenue": 249.0,
    "status": "active",
}

PRICING_CATALOG = [
    {"service_type": "social_media_audit", "price_usd": 4500, "won": True},
    {"service_type": "brand_strategy", "price_usd": 12000, "won": True},
    {"service_type": "paid_media", "price_usd": 2800, "won": False},
    {"service_type": "content_strategy", "price_usd": 6500, "won": True},
    {"service_type": "website_redesign", "price_usd": 18000, "won": True},
    {"service_type": "seo_package", "price_usd": 3200, "won": True},
    {"service_type": "email_marketing", "price_usd": 2200, "won": False},
    {"service_type": "full_service_retainer", "price_usd": 8500, "won": True},
]

KEY_WIN_STORIES = [
    {
        "id": str(uuid.uuid4()),
        "client": "Brightfield Technologies",
        "win_rate_reference": "73% overall win rate",
        "value_usd": 45000,
        "outcome": "won",
        "win_reason": "Deep data analytics positioning + 90-day ROI guarantee",
        "content": """
EXECUTIVE SUMMARY
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
Results you can measure, stories worth telling.
""",
    }
]

BRAND_VOICE = {
    "tone": ["authoritative", "data-driven", "warm"],
    "signature_phrase": "Results you can measure, stories worth telling",
    "avoid": ["jargon", "excessive adjectives"],
    "preferred_structure": "Problem → Insight → Solution → Evidence → Investment",
    "example_text": """
At LionTown Marketing, we believe every dollar of marketing spend should be
accountable. We don't just tell compelling stories — we build systems that
prove those stories drive revenue. Our data-driven creative strategy has
helped 47 B2B firms achieve an average 340% ROI on their marketing investment.

Results you can measure, stories worth telling.
""",
}

# ---------------------------------------------------------------------------
# Sample proposals (simulating 847 indexed — we seed a representative subset)
# ---------------------------------------------------------------------------

SAMPLE_PROPOSALS = [
    {
        "client": "Greenfield Capital",
        "content": "Brand strategy proposal for Greenfield Capital. Full-funnel approach with measurable ROI milestones. Investment: $12,000 brand strategy + $4,500/mo retainer.",
        "outcome": "won",
        "value_usd": 66000,
        "win_reason": "Data-driven approach + ROI guarantee",
    },
    {
        "client": "Apex Solutions",
        "content": "Social media audit and content strategy for Apex Solutions B2B tech firm. 90-day content roadmap. Investment: $4,500 audit + $6,500 strategy.",
        "outcome": "won",
        "value_usd": 11000,
        "win_reason": "Fast turnaround, clear deliverables",
    },
    {
        "client": "Summit Partners",
        "content": "Paid media management proposal for Summit Partners. Full-funnel paid strategy across LinkedIn and Google. Monthly retainer: $2,800.",
        "outcome": "lost",
        "value_usd": 33600,
        "win_reason": None,
    },
    {
        "client": "Horizon Group",
        "content": "Website redesign and SEO package for Horizon Group. New site + 12-month SEO retainer. Investment: $18,000 redesign + $3,200/mo SEO.",
        "outcome": "won",
        "value_usd": 56400,
        "win_reason": "Integrated approach, strong case studies",
    },
    {
        "client": "Nexus Media",
        "content": "Email marketing automation setup and management. Full CRM integration with 6-month nurture sequences. Investment: $2,200/mo.",
        "outcome": "won",
        "value_usd": 26400,
        "win_reason": "Automation expertise, quick setup",
    },
]


async def seed_customer_in_supabase(supabase) -> None:
    """Upsert LionTown customer record."""
    supabase.table("customers").upsert(LIONTOWN).execute()
    print(f"✓ Customer record upserted: {LIONTOWN['name']}")


async def seed_pricing_in_pinecone(customer_id: str) -> None:
    """Embed and upsert pricing catalog."""
    texts = [
        f"Service: {r['service_type']} | Price: USD {r['price_usd']} | Won: {r['won']} | Notes: LionTown standard pricing"
        for r in PRICING_CATALOG
    ]
    embeddings = await embed_batch(texts)
    vectors = [
        {
            "id": f"pricing_{customer_id}_{i}",
            "values": emb,
            "metadata": {
                "type": "pricing",
                "customer_id": customer_id,
                "service_type": PRICING_CATALOG[i]["service_type"],
                "price_usd": PRICING_CATALOG[i]["price_usd"],
                "won": PRICING_CATALOG[i]["won"],
                "text": texts[i],
            },
        }
        for i, emb in enumerate(embeddings)
    ]
    upsert_vectors(customer_id, vectors)
    print(f"✓ Seeded {len(vectors)} pricing vectors")


async def seed_proposals_in_pinecone(customer_id: str) -> None:
    """Embed and upsert sample proposals (representing 847 indexed)."""
    all_proposals = KEY_WIN_STORIES + SAMPLE_PROPOSALS
    texts = [p["content"] for p in all_proposals]
    embeddings = await embed_batch(texts)
    vectors = [
        {
            "id": f"prop_seed_{i}",
            "values": emb,
            "metadata": {
                "type": "proposal_chunk",
                "customer_id": customer_id,
                "proposal_id": f"seed_{i}",
                "chunk_index": 0,
                "text": texts[i],
                "client_name": p.get("client", p.get("client_name", "")),
                "outcome": p.get("outcome", ""),
                "value_usd": p.get("value_usd", 0),
                "win_reason": p.get("win_reason", "") or "",
            },
        }
        for i, (emb, p) in enumerate(zip(embeddings, all_proposals))
    ]
    upsert_vectors(customer_id, vectors)
    print(f"✓ Seeded {len(vectors)} proposal vectors (representing 847 indexed)")


async def seed_brand_voice_in_pinecone(customer_id: str) -> None:
    """Embed and upsert brand voice examples."""
    text = BRAND_VOICE["example_text"]
    embeddings = await embed_batch([text])
    vectors = [
        {
            "id": f"bv_liontown_0",
            "values": embeddings[0],
            "metadata": {
                "type": "brand_voice",
                "customer_id": customer_id,
                "text": text,
                "tone": ", ".join(BRAND_VOICE["tone"]),
                "signature_phrase": BRAND_VOICE["signature_phrase"],
            },
        }
    ]
    upsert_vectors(customer_id, vectors)
    print(f"✓ Seeded brand voice vectors")


async def main() -> None:
    print("\n🦁 Seeding LionTown Marketing demo data...\n")

    supabase = create_client(
        os.environ["NEXT_PUBLIC_SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    customer_id = LIONTOWN["id"]

    # Ensure Pinecone index exists
    get_or_create_index()
    print(f"✓ Pinecone index ready")

    await seed_customer_in_supabase(supabase)
    await seed_pricing_in_pinecone(customer_id)
    await seed_proposals_in_pinecone(customer_id)
    await seed_brand_voice_in_pinecone(customer_id)

    print(f"\n✅ LionTown Marketing seeded successfully!")
    print(f"   Namespace: {customer_namespace(customer_id)}")
    print(f"   Proposals indexed: 847 (simulated)")
    print(f"   Retainer anchor: $4,500")
    print(f"   Win rate to cite: 73% (Brightfield case)")
    print(f"\n   Demo is ready at: http://localhost:3000/demo\n")


if __name__ == "__main__":
    asyncio.run(main())
