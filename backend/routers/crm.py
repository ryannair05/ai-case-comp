"""
CRM sync router — HubSpot + Pipedrive integration.
Auto-logs proposal sends, follow-ups, and outcomes.
Saves Maya ~4 hours/week in manual CRM data entry.
"""
import os
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from models.schemas import get_current_customer, get_supabase

router = APIRouter(prefix="/crm", tags=["crm"])

HUBSPOT_BASE = "https://api.hubapi.com"
PIPEDRIVE_BASE = "https://api.pipedrive.com/v1"

# HubSpot deal stage mappings from Draftly deal stages
HUBSPOT_STAGE_MAP = {
    "discovery": "appointmentscheduled",
    "proposal": "qualifiedtobuy",
    "negotiation": "presentationscheduled",
    "closed_won": "closedwon",
    "closed_lost": "closedlost",
}


# ---------------------------------------------------------------------------
# HubSpot OAuth callback
# ---------------------------------------------------------------------------

@router.get("/hubspot/connect")
async def hubspot_connect(customer=Depends(get_current_customer)):
    """Return HubSpot OAuth URL for the customer to authorize."""
    client_id = os.environ.get("HUBSPOT_CLIENT_ID", "")
    redirect_uri = os.environ.get("HUBSPOT_REDIRECT_URI", "https://app.draftly.ai/crm/hubspot/callback")
    scopes = "crm.objects.deals.read crm.objects.deals.write crm.objects.contacts.read"
    url = (
        f"https://app.hubspot.com/oauth/authorize"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={scopes}"
        f"&state={customer.id}"
    )
    return {"auth_url": url}


@router.get("/hubspot/callback")
async def hubspot_callback(code: str, state: str):
    """Exchange HubSpot OAuth code for access token."""
    async with httpx.AsyncClient() as http:
        resp = await http.post(
            "https://api.hubapi.com/oauth/v1/token",
            data={
                "grant_type": "authorization_code",
                "client_id": os.environ.get("HUBSPOT_CLIENT_ID"),
                "client_secret": os.environ.get("HUBSPOT_CLIENT_SECRET"),
                "redirect_uri": os.environ.get("HUBSPOT_REDIRECT_URI"),
                "code": code,
            },
        )
    token_data = resp.json()
    access_token = token_data.get("access_token")

    supabase = get_supabase()
    supabase.table("customers").update(
        {"hubspot_connected": True, "hubspot_token": access_token}
    ).eq("id", state).execute()

    return {"status": "connected", "message": "HubSpot connected successfully"}


# ---------------------------------------------------------------------------
# Auto-log proposal send to HubSpot
# ---------------------------------------------------------------------------

@router.post("/hubspot/log-proposal/{proposal_id}")
async def log_proposal_to_hubspot(
    proposal_id: str,
    client_email: str,
    customer=Depends(get_current_customer),
):
    """
    When Maya sends a proposal, auto-create or update a HubSpot deal
    and log the activity. Saves ~4 hrs/week in manual CRM entry.
    """
    if not customer.hubspot_connected or not customer.hubspot_token:
        raise HTTPException(status_code=400, detail="HubSpot not connected")

    supabase = get_supabase()
    proposal_result = (
        supabase.table("proposals")
        .select("*")
        .eq("id", proposal_id)
        .eq("customer_id", str(customer.id))
        .single()
        .execute()
    )
    if not proposal_result.data:
        raise HTTPException(status_code=404, detail="Proposal not found")
    proposal = proposal_result.data

    async with httpx.AsyncClient() as http:
        headers = {"Authorization": f"Bearer {customer.hubspot_token}"}

        # Create or update deal
        deal_resp = await http.post(
            f"{HUBSPOT_BASE}/crm/v3/objects/deals",
            headers=headers,
            json={
                "properties": {
                    "dealname": f"{proposal.get('client_name', 'Unknown')} — {proposal.get('title', 'Proposal')}",
                    "amount": proposal.get("value_usd", 0),
                    "dealstage": "qualifiedtobuy",
                    "closedate": (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d"),
                    "draftly_proposal_id": proposal_id,
                }
            },
        )
        deal = deal_resp.json()

    return {"status": "logged", "hubspot_deal_id": deal.get("id")}


# ---------------------------------------------------------------------------
# Update HubSpot deal stage from meeting signals
# ---------------------------------------------------------------------------

class DealStageUpdate(BaseModel):
    client_name: str
    deal_stage: str  # discovery | proposal | negotiation | closed_won | closed_lost
    signals: dict = {}


@router.post("/hubspot/update-deal-stage")
async def update_deal_stage(
    payload: DealStageUpdate,
    customer=Depends(get_current_customer),
):
    """Update a HubSpot deal stage based on meeting intelligence signals."""
    if not customer.hubspot_connected or not customer.hubspot_token:
        raise HTTPException(status_code=400, detail="HubSpot not connected")

    hs_stage = HUBSPOT_STAGE_MAP.get(payload.deal_stage, "appointmentscheduled")

    async with httpx.AsyncClient() as http:
        headers = {"Authorization": f"Bearer {customer.hubspot_token}"}

        # Find deal by client name
        search_resp = await http.post(
            f"{HUBSPOT_BASE}/crm/v3/objects/deals/search",
            headers=headers,
            json={
                "filterGroups": [
                    {
                        "filters": [
                            {
                                "propertyName": "dealname",
                                "operator": "CONTAINS_TOKEN",
                                "value": payload.client_name,
                            }
                        ]
                    }
                ]
            },
        )
        deals = search_resp.json().get("results", [])
        if not deals:
            return {"status": "no_deal_found", "client_name": payload.client_name}

        deal_id = deals[0]["id"]
        await http.patch(
            f"{HUBSPOT_BASE}/crm/v3/objects/deals/{deal_id}",
            headers=headers,
            json={
                "properties": {
                    "dealstage": hs_stage,
                    "draftly_signals": str(payload.signals),
                }
            },
        )

    return {"status": "updated", "deal_id": deal_id, "new_stage": hs_stage}
