"""
Claude Sonnet 4.6 client — PRIMARY LLM for all proposal generation.

RULES:
- Claude Sonnet 4.6 is the ONLY model used for text generation.
- OpenAI GPT models are used ONLY for embeddings (see embeddings.py).
- All LLM responses are cached in Redis for 72hrs (AI dependency hedge).
"""
import hashlib
import os

import anthropic

from services.redis_queue import get_cache, set_cache

_client: anthropic.Anthropic | None = None

MODEL = "claude-sonnet-4-20250514"  # Claude Sonnet 4.6


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client
CACHE_TTL = 72 * 3600               # 72-hour AI dependency hedge


async def generate_with_context(
    customer_id: str,
    rfp_text: str,
    context_chunks: list[dict],
    cold_start: bool = False,
) -> str:
    """
    PRIMARY proposal generation function.
    Uses retrieved Context-Mapper data to ground the output.
    72hr Redis cache = AI dependency hedge if Anthropic is unavailable.
    """
    # Build cache key from customer + RFP content hash
    rfp_hash = hashlib.md5(rfp_text.encode()).hexdigest()[:16]
    cache_key = f"proposal:{customer_id}:{rfp_hash}"
    cached = await get_cache(cache_key)
    if cached:
        return cached

    # Build context string from retrieved chunks, grouped by type
    context_str = ""
    if context_chunks:
        pricing_chunks = [c for c in context_chunks if c.get("type") == "pricing"]
        proposal_chunks = [c for c in context_chunks if c.get("type") == "proposal_chunk"]
        brand_chunks = [c for c in context_chunks if c.get("type") == "brand_voice"]

        if pricing_chunks:
            context_str += "\n\nPRICING HISTORY (use these as anchors):\n"
            context_str += "\n".join([c["text"] for c in pricing_chunks[:3]])
        if proposal_chunks:
            context_str += "\n\nWINNING PROPOSAL PATTERNS:\n"
            context_str += "\n".join([c["text"] for c in proposal_chunks[:4]])
        if brand_chunks:
            context_str += "\n\nBRAND VOICE EXAMPLES:\n"
            context_str += "\n".join([c["text"] for c in brand_chunks[:2]])

    cold_start_note = (
        "You are generating this proposal without firm-specific history yet. "
        "Use the industry template library to provide a strong starting point. "
        "Flag sections where firm-specific data would strengthen the proposal."
        if cold_start
        else ""
    )

    system_prompt = f"""You are Draftly, an AI proposal generation assistant.
You help professional services firms write winning proposals.
{cold_start_note}

FIRM CONTEXT (from their institutional memory):
{context_str if context_str else "No context available yet — use industry best practices."}

RULES:
- Reference specific pricing anchors from the firm's history
- Mirror the firm's brand voice and terminology exactly
- Cite relevant past wins where appropriate (e.g. "similar to the Brightfield engagement")
- Use the firm's actual service names, not generic descriptions
- If pricing history shows a retainer anchor, use it as the floor
- Structure: Executive Summary → Approach → Timeline → Investment → Why Us"""

    message = _get_client().messages.create(
        model=MODEL,
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": f"Generate a proposal for this RFP:\n\n{rfp_text}"}],
    )
    result = message.content[0].text

    # Cache for 72hrs (AI dependency hedge)
    await set_cache(cache_key, result, ttl=CACHE_TTL)
    return result


async def classify_severity(ticket_body: str) -> str:
    """
    Classify a support ticket as HIGH, MEDIUM, or LOW severity.

    HIGH:   billing issues, data loss, auth failures, integrations broken
    MEDIUM: feature questions, unexpected behavior
    LOW:    how-to questions, feature requests (AI can handle fully)
    Routes HIGH directly to Hayden via Slack/email notification.
    """
    resp = _get_client().messages.create(
        model=MODEL,
        max_tokens=10,
        messages=[
            {
                "role": "user",
                "content": (
                    "Classify this support ticket severity as HIGH, MEDIUM, or LOW.\n"
                    "HIGH = billing/data/auth/integration issues.\n"
                    "LOW = how-to questions AI can answer.\n\n"
                    f"Ticket: {ticket_body}\n\nRespond with just: HIGH, MEDIUM, or LOW"
                ),
            }
        ],
    )
    return resp.content[0].text.strip().upper()


async def generate_support_response(
    ticket_body: str,
    kb_context: list[dict],
    customer_tier: str,
) -> str:
    """
    Draft an AI response to a support ticket.
    Target: 80% of tickets get AI first-response in <5 minutes.
    """
    cache_key = f"support:{hashlib.md5(ticket_body.encode()).hexdigest()[:16]}"
    cached = await get_cache(cache_key)
    if cached:
        return cached

    kb_str = ""
    if kb_context:
        kb_str = "\n\nRELEVANT KNOWLEDGE BASE:\n" + "\n---\n".join(
            [c.get("text", "") for c in kb_context[:3]]
        )

    resp = _get_client().messages.create(
        model=MODEL,
        max_tokens=800,
        system=(
            f"You are a helpful support agent for Draftly, an AI proposal tool. "
            f"The customer is on the {customer_tier} tier. "
            "Be friendly, concise, and solution-oriented. "
            "Never expose internal system details or stack traces."
            f"{kb_str}"
        ),
        messages=[{"role": "user", "content": ticket_body}],
    )
    result = resp.content[0].text
    await set_cache(cache_key, result, ttl=3600)  # 1hr cache for support responses
    return result


async def extract_meeting_signals(
    customer_id: str,
    raw_notes: str,
    client_name: str,
) -> dict:
    """
    Extract structured signals from raw meeting notes.
    Returns budget signals, needs, objections, deal stage, next actions.
    """
    cache_key = f"meeting:{customer_id}:{hashlib.md5(raw_notes.encode()).hexdigest()[:16]}"
    cached = await get_cache(cache_key)
    if cached:
        import json
        return json.loads(cached)

    resp = _get_client().messages.create(
        model=MODEL,
        max_tokens=1000,
        system=(
            "You are a sales intelligence AI. Extract structured signals from meeting notes. "
            "Return JSON with keys: budget_signals (list), needs_identified (list), "
            "objections (list), deal_stage (discovery|proposal|negotiation|closed_won|closed_lost), "
            "next_actions (list), proposal_recommended (bool)."
        ),
        messages=[
            {
                "role": "user",
                "content": f"Client: {client_name}\n\nMeeting notes:\n{raw_notes}",
            }
        ],
    )
    import json
    text = resp.content[0].text
    # Parse JSON from response
    start = text.find("{")
    end = text.rfind("}") + 1
    result = json.loads(text[start:end]) if start != -1 else {}
    await set_cache(cache_key, json.dumps(result), ttl=CACHE_TTL)
    return result


async def generate_outreach_sequence(
    sender_firm: str,
    prospect: dict,
    win_context: list[dict],
    sequence_length: int = 4,
) -> list[dict]:
    """
    Generate a personalized multi-email outreach sequence.
    Uses firm's Context-Mapper win stories for social proof.
    AI disclosure footer is appended by the caller (ethics requirement).
    """
    win_stories = "\n".join([c.get("text", "") for c in win_context[:3]])

    resp = _get_client().messages.create(
        model=MODEL,
        max_tokens=2000,
        system=(
            f"You are writing outreach emails for {sender_firm}. "
            "Generate a personalized email sequence as a JSON array. "
            "Each email: {subject, body, send_day, cta}. "
            "Reference win stories where relevant. Be concise and human."
            f"\n\nWIN STORIES:\n{win_stories if win_stories else 'Not available yet.'}"
        ),
        messages=[
            {
                "role": "user",
                "content": (
                    f"Write a {sequence_length}-email sequence for:\n"
                    f"Prospect: {prospect.get('prospect_name')} at {prospect.get('prospect_company')}\n"
                    f"Industry: {prospect.get('prospect_industry')}\n"
                    f"Pain point: {prospect.get('pain_point')}\n"
                    f"Goal: book a 20-min demo"
                ),
            }
        ],
    )
    import json
    text = resp.content[0].text
    start = text.find("[")
    end = text.rfind("]") + 1
    return json.loads(text[start:end]) if start != -1 else []


async def extract_win_patterns(proposal_content: str, win_reason: str) -> str:
    """Extract key patterns from a winning proposal for the playbook."""
    resp = _get_client().messages.create(
        model=MODEL,
        max_tokens=500,
        system="Extract 3-5 key winning patterns from this proposal and win reason. Be specific and actionable.",
        messages=[
            {
                "role": "user",
                "content": f"Win reason: {win_reason}\n\nProposal:\n{proposal_content[:3000]}",
            }
        ],
    )
    return resp.content[0].text
