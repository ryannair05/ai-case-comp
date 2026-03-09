"""
Pydantic v2 schemas for Draftly.
All models mirror the Supabase table definitions.
Every endpoint uses these for request/response validation.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, UUID4, Field
from fastapi import HTTPException, Header
from supabase import create_client, Client
import os

# ---------------------------------------------------------------------------
# Supabase client helper
# ---------------------------------------------------------------------------

def get_supabase() -> Client:
    return create_client(
        os.environ["NEXT_PUBLIC_SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


async def get_current_customer(authorization: str = Header(...)) -> "Customer":
    """
    Validate JWT from Supabase Auth and return the matching customer row.
    Every endpoint that touches customer data MUST use this dependency.
    """
    token = authorization.removeprefix("Bearer ").strip()
    supabase = get_supabase()
    try:
        user = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    uid = user.user.id
    result = (
        supabase.table("customers")
        .select("*")
        .eq("id", uid)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Customer not found")
    return Customer(**result.data)


# ---------------------------------------------------------------------------
# Customer
# ---------------------------------------------------------------------------

class Customer(BaseModel):
    id: UUID4
    name: str
    email: str
    tier: str = "starter"  # starter | professional | gtm_agent
    stripe_id: Optional[str] = None
    pinecone_namespace: Optional[str] = None
    context_mapper_active: bool = False
    proposals_indexed: int = 0
    onboarded_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    hubspot_connected: bool = False
    hubspot_token: Optional[str] = None
    pipedrive_connected: bool = False
    pipedrive_token: Optional[str] = None
    industry: Optional[str] = None
    status: str = "active"  # active | churned | suspended
    monthly_revenue: float = 0.0
    churned_this_month: bool = False


class CustomerCreate(BaseModel):
    name: str
    email: str
    tier: str = "starter"
    industry: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    tier: Optional[str] = None
    industry: Optional[str] = None
    context_mapper_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# Proposal
# ---------------------------------------------------------------------------

class Proposal(BaseModel):
    id: UUID4
    customer_id: UUID4
    title: Optional[str] = None
    content: str
    client_name: Optional[str] = None
    value_usd: Optional[float] = None
    outcome: Optional[str] = None  # won | lost | pending
    win_reason: Optional[str] = None
    lose_reason: Optional[str] = None
    pinecone_vector_id: Optional[str] = None
    created_at: Optional[datetime] = None


class ProposalCreate(BaseModel):
    title: Optional[str] = None
    content: str
    client_name: Optional[str] = None
    value_usd: Optional[float] = None
    outcome: str = "pending"


class ProposalUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    client_name: Optional[str] = None
    value_usd: Optional[float] = None
    outcome: Optional[str] = None
    win_reason: Optional[str] = None
    lose_reason: Optional[str] = None


class ProposalGenerateRequest(BaseModel):
    rfp_text: str = Field(..., min_length=50, description="Raw RFP or brief to generate proposal for")
    client_name: Optional[str] = None
    value_usd: Optional[float] = None


# ---------------------------------------------------------------------------
# Pricing Data
# ---------------------------------------------------------------------------

class PricingData(BaseModel):
    id: UUID4
    customer_id: UUID4
    service_type: str
    price_usd: float
    won: Optional[bool] = None
    notes: Optional[str] = None
    pinecone_vector_id: Optional[str] = None
    created_at: Optional[datetime] = None


class PricingRow(BaseModel):
    service_type: str
    price_usd: float
    won: Optional[bool] = None
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Brand Voice
# ---------------------------------------------------------------------------

class BrandVoice(BaseModel):
    id: UUID4
    customer_id: UUID4
    example_text: str
    style_notes: Optional[str] = None
    tone_tags: Optional[list[str]] = None
    pinecone_vector_id: Optional[str] = None
    created_at: Optional[datetime] = None


class BrandVoiceCreate(BaseModel):
    example_text: str
    style_notes: Optional[str] = None
    tone_tags: Optional[list[str]] = None


# ---------------------------------------------------------------------------
# Support Tickets
# ---------------------------------------------------------------------------

class SupportTicket(BaseModel):
    id: UUID4
    customer_id: UUID4
    subject: Optional[str] = None
    body: str
    ai_response: Optional[str] = None
    status: str = "open"  # open | ai_handled | escalated | closed
    severity: str = "low"  # low | medium | high
    response_time_min: Optional[int] = None
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None


class SupportTicketCreate(BaseModel):
    subject: Optional[str] = None
    body: str


# ---------------------------------------------------------------------------
# Churn Signals
# ---------------------------------------------------------------------------

class ChurnSignal(BaseModel):
    id: UUID4
    customer_id: UUID4
    usage_drop_pct: Optional[float] = None
    days_inactive: Optional[int] = None
    nps_score: Optional[int] = None
    flagged_at: Optional[datetime] = None
    outreach_sent: bool = False
    resolved: bool = False


# ---------------------------------------------------------------------------
# Ingest job response
# ---------------------------------------------------------------------------

class IngestJobResponse(BaseModel):
    job_id: str
    rows_queued: Optional[int] = None
    status: str = "queued"


# ---------------------------------------------------------------------------
# Analytics / Unit Economics
# ---------------------------------------------------------------------------

class UnitEconomics(BaseModel):
    monthly_churn_rate: float
    avg_customer_lifetime_months: float
    blended_arpa_usd: float
    ltv_usd: float
    cac_usd: float
    ltv_cac_ratio: str
    gross_margin: float
    ai_cost_per_proposal: float
    avg_switching_cost_usd: float
    on_track_for: str  # bear | base | bull
    bear_at_churn: float = 0.075
    base_at_churn: float = 0.055
    bull_at_churn: float = 0.035


# ---------------------------------------------------------------------------
# Switching cost
# ---------------------------------------------------------------------------

class SwitchingCost(BaseModel):
    total_cost: int
    human_hours: int
    proposals_indexed: int
    months_active: int
    milestone: str  # onboarding | embedded | entrenched


# ---------------------------------------------------------------------------
# Phase gate
# ---------------------------------------------------------------------------

class PhaseGateCondition(BaseModel):
    label: str
    current: object
    target: object
    passed: bool


class PhaseGateStatus(BaseModel):
    gate1: PhaseGateCondition
    gate2: PhaseGateCondition
    gate3: PhaseGateCondition
    all_passed: bool
