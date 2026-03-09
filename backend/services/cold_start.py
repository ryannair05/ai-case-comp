"""
Industry-vertical template library for cold-start customers.

Activated when a customer has < 15 proposals indexed.
Seeded from public proposal best practices, NOT customer data.
Provides Day-1 value before the Context-Mapper moat forms.
"""

COLD_START_THRESHOLD = 15  # proposals indexed before RAG takes over

INDUSTRY_TEMPLATES: dict[str, dict] = {
    "marketing_agency": {
        "service_types": [
            "brand_strategy",
            "social_media_audit",
            "paid_media",
            "content_strategy",
        ],
        "typical_pricing": {
            "brand_strategy": (8000, 15000),
            "social_media_audit": (3500, 6000),
            "paid_media": (2000, 4000),
            "content_strategy": (5000, 8000),
            "full_service_retainer": (6000, 12000),
        },
        "winning_phrases": [
            "data-driven creative strategy",
            "measurable ROI",
            "full-funnel approach",
        ],
        "structure": [
            "Executive Summary",
            "Situation Analysis",
            "Strategic Approach",
            "Timeline & Milestones",
            "Investment",
            "Why Us",
            "Next Steps",
        ],
    },
    "consulting": {
        "service_types": [
            "strategy_engagement",
            "process_improvement",
            "change_management",
            "digital_transformation",
        ],
        "typical_pricing": {
            "strategy_engagement": (15000, 40000),
            "process_improvement": (10000, 25000),
            "change_management": (20000, 60000),
            "digital_transformation": (30000, 100000),
        },
        "winning_phrases": [
            "proven methodology",
            "measurable outcomes",
            "stakeholder alignment",
        ],
        "structure": [
            "Executive Summary",
            "Problem Statement",
            "Proposed Approach",
            "Deliverables",
            "Timeline",
            "Investment",
            "Team & Credentials",
        ],
    },
    "legal": {
        "service_types": [
            "corporate_counsel",
            "contract_review",
            "litigation_support",
            "compliance_audit",
        ],
        "typical_pricing": {
            "corporate_counsel": (5000, 15000),
            "contract_review": (2000, 8000),
            "litigation_support": (10000, 50000),
            "compliance_audit": (8000, 20000),
        },
        "winning_phrases": [
            "risk mitigation",
            "regulatory compliance",
            "proven track record",
        ],
        "structure": [
            "Scope of Engagement",
            "Approach & Methodology",
            "Team",
            "Timeline",
            "Fee Structure",
        ],
    },
    "accounting": {
        "service_types": [
            "audit",
            "tax_planning",
            "bookkeeping",
            "cfo_services",
        ],
        "typical_pricing": {
            "audit": (5000, 25000),
            "tax_planning": (3000, 10000),
            "bookkeeping": (500, 2000),
            "cfo_services": (5000, 15000),
        },
        "winning_phrases": [
            "GAAP compliant",
            "proactive tax strategy",
            "real-time visibility",
        ],
        "structure": [
            "Engagement Overview",
            "Services",
            "Timeline",
            "Fees",
            "Why Our Firm",
        ],
    },
}


async def get_cold_start_context(customer_id: str, industry: str) -> list[dict]:
    """
    Return template context chunks when customer has < 15 indexed proposals.
    Formatted identically to RAG retrieval so generate_with_context works unchanged.
    """
    template = INDUSTRY_TEMPLATES.get(industry, INDUSTRY_TEMPLATES["consulting"])
    chunks: list[dict] = []

    # Add pricing benchmarks as fake context chunks
    for svc, (low, high) in template["typical_pricing"].items():
        chunks.append(
            {
                "type": "pricing",
                "text": (
                    f"Service: {svc} | Typical Range: ${low:,}–${high:,} | "
                    "Industry benchmark (cold-start template)"
                ),
                "score": 0.75,
            }
        )

    # Add structure hint as a proposal chunk
    structure = " → ".join(template["structure"])
    chunks.append(
        {
            "type": "proposal_chunk",
            "text": f"Recommended proposal structure: {structure}",
            "score": 0.75,
        }
    )

    # Add winning phrases as brand voice hints
    phrases = ", ".join(template["winning_phrases"])
    chunks.append(
        {
            "type": "brand_voice",
            "text": f"Effective language patterns for this industry: {phrases}",
            "score": 0.75,
        }
    )

    return chunks
