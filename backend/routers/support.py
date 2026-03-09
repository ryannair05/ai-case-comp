"""
Support tickets router.
Target: 80% of tickets get AI first-response in <5 minutes.
20% escalated to Hayden (true engineering issues).
"""
import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from models.schemas import SupportTicket, SupportTicketCreate, get_current_customer, get_supabase
from services.claude_client import classify_severity, generate_support_response
from services.rag_pipeline import retrieve_kb_context

router = APIRouter(prefix="/support", tags=["support"])

SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "")


async def _send_slack_alert(message: str) -> None:
    """Fire a Slack webhook alert for HIGH severity tickets."""
    if not SLACK_WEBHOOK_URL:
        return
    import httpx
    async with httpx.AsyncClient() as http:
        await http.post(SLACK_WEBHOOK_URL, json={"text": message})


# ---------------------------------------------------------------------------
# Create ticket
# ---------------------------------------------------------------------------

@router.post("/tickets", response_model=SupportTicket)
async def create_ticket(
    payload: SupportTicketCreate,
    customer=Depends(get_current_customer),
):
    """
    Create a support ticket and immediately queue AI analysis.
    The AI draft response + severity classification run synchronously here
    (short enough to not need async queue — LLM call is <3s).
    """
    supabase = get_supabase()

    # 1. Classify severity
    severity = await classify_severity(payload.body)

    # 2. Pull relevant KB articles for context
    kb_context = await retrieve_kb_context(payload.body)

    # 3. Generate AI draft response
    ai_response = await generate_support_response(
        ticket_body=payload.body,
        kb_context=kb_context,
        customer_tier=customer.tier,
    )

    status = "escalated" if severity == "HIGH" else "ai_handled"

    # 4. Persist ticket
    result = (
        supabase.table("support_tickets")
        .insert(
            {
                "customer_id": str(customer.id),
                "subject": payload.subject,
                "body": payload.body,
                "ai_response": ai_response,
                "status": status,
                "severity": severity.lower(),
            }
        )
        .execute()
    )
    ticket = result.data[0]

    # 5. Alert Hayden on HIGH severity tickets
    if severity == "HIGH":
        await _send_slack_alert(
            f"🚨 HIGH severity ticket from {customer.name} ({customer.tier})\n"
            f"Subject: {payload.subject or 'No subject'}\n"
            f"Body: {payload.body[:200]}...\n"
            f"Ticket ID: {ticket['id']}"
        )

    return ticket


# ---------------------------------------------------------------------------
# AI-draft response for existing ticket
# ---------------------------------------------------------------------------

@router.post("/tickets/{ticket_id}/ai-respond")
async def ai_draft_response(
    ticket_id: str,
    customer=Depends(get_current_customer),
):
    """
    Draft an AI response to a support ticket.
    Returns the draft + recommended action (send_to_customer | escalate_to_hayden).
    """
    supabase = get_supabase()
    result = (
        supabase.table("support_tickets")
        .select("*")
        .eq("id", ticket_id)
        .eq("customer_id", str(customer.id))
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket = result.data

    kb_context = await retrieve_kb_context(ticket["body"])
    severity = await classify_severity(ticket["body"])
    draft = await generate_support_response(
        ticket_body=ticket["body"],
        kb_context=kb_context,
        customer_tier=customer.tier,
    )

    # Track response time for NPS monitoring
    created_at = datetime.fromisoformat(ticket["created_at"])
    response_time_min = int((datetime.utcnow() - created_at).total_seconds() / 60)

    supabase.table("support_tickets").update(
        {
            "ai_response": draft,
            "status": "escalated" if severity == "HIGH" else "ai_handled",
            "severity": severity.lower(),
            "response_time_min": response_time_min,
        }
    ).eq("id", ticket_id).execute()

    return {
        "draft": draft,
        "severity": severity,
        "action": "escalate_to_hayden" if severity == "HIGH" else "send_to_customer",
        "response_time_min": response_time_min,
    }


# ---------------------------------------------------------------------------
# List tickets
# ---------------------------------------------------------------------------

@router.get("/tickets", response_model=list[SupportTicket])
async def list_tickets(
    status: str | None = None,
    customer=Depends(get_current_customer),
):
    """Return support tickets for the authenticated customer."""
    supabase = get_supabase()
    q = supabase.table("support_tickets").select("*").eq("customer_id", str(customer.id))
    if status:
        q = q.eq("status", status)
    result = q.order("created_at", desc=True).limit(100).execute()
    return result.data


# ---------------------------------------------------------------------------
# Close ticket
# ---------------------------------------------------------------------------

@router.patch("/tickets/{ticket_id}/close")
async def close_ticket(ticket_id: str, customer=Depends(get_current_customer)):
    """Mark a ticket as closed."""
    supabase = get_supabase()
    result = (
        supabase.table("support_tickets")
        .update({"status": "closed", "resolved_at": datetime.utcnow().isoformat()})
        .eq("id", ticket_id)
        .eq("customer_id", str(customer.id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"status": "closed"}
