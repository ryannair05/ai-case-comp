"""
Weekly ROI email service via Resend.
Sent every Monday 8am to every paying customer.
Primary retention tool in Months 1-3 before structural switching costs form.
"""
import os
from datetime import datetime, timedelta

from resend import Resend

from models.schemas import get_supabase
from routers.context_mapper import calculate_switching_cost

resend_client = Resend(api_key=os.environ.get("RESEND_API_KEY", ""))

FROM_EMAIL = "Draftly <insights@draftly.ai>"


def _format_currency(amount: float) -> str:
    """Format a dollar amount with commas."""
    return f"${amount:,.0f}"


async def send_weekly_roi_email(customer_id: str) -> dict:
    """
    Auto-generated ROI email. Sent every Monday 8am local time.
    Shows: proposals generated, hours saved, win rate, revenue attributed,
    and current Moat Meter value.
    """
    supabase = get_supabase()
    week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()

    # Fetch customer details
    customer_result = (
        supabase.table("customers")
        .select("*")
        .eq("id", customer_id)
        .single()
        .execute()
    )
    if not customer_result.data:
        return {"error": "Customer not found"}
    customer = customer_result.data

    # Fetch last 7 days of proposals
    proposals_result = (
        supabase.table("proposals")
        .select("id, outcome, value_usd")
        .eq("customer_id", customer_id)
        .gte("created_at", week_ago)
        .execute()
    )
    proposals = proposals_result.data or []
    wins = [p for p in proposals if p.get("outcome") == "won"]

    # Calculate metrics
    hours_saved = len(proposals) * 4.2  # 4.2 hrs/proposal benchmark from financial model
    revenue_attr = sum(p.get("value_usd", 0) or 0 for p in wins)
    moat = await calculate_switching_cost(customer_id)

    revenue_formatted = _format_currency(revenue_attr)
    moat_cost_formatted = _format_currency(moat.total_cost)

    html = f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#0B1929;">
  <div style="background:#0B1929;padding:24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#00BFA5;margin:0;font-size:24px;">Draftly</h1>
    <p style="color:#B0BEC5;margin:4px 0 0;">Your Weekly Intelligence Report</p>
  </div>

  <div style="background:#F5F7FA;padding:24px;">
    <h2 style="color:#0B1929;margin:0 0 16px;">
      {customer.get('name', 'Your Firm')} — Week in Review
    </h2>

    <!-- This Week's Activity -->
    <div style="background:white;border:1px solid #E0E7EF;border-radius:8px;padding:20px;margin-bottom:16px;">
      <h3 style="color:#00BFA5;margin:0 0 12px;font-size:16px;">📊 This Week</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;color:#555;">Proposals generated</td>
          <td style="padding:6px 0;font-weight:bold;text-align:right;">{len(proposals)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#555;">Hours saved</td>
          <td style="padding:6px 0;font-weight:bold;text-align:right;">{hours_saved:.1f} hrs</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#555;">Proposals marked Won</td>
          <td style="padding:6px 0;font-weight:bold;text-align:right;">{len(wins)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#555;">Revenue attributed</td>
          <td style="padding:6px 0;font-weight:bold;color:#00BFA5;text-align:right;">{revenue_formatted}</td>
        </tr>
      </table>
    </div>

    <!-- Context-Mapper Moat -->
    <div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;padding:20px;margin-bottom:16px;">
      <h3 style="color:#F57F17;margin:0 0 12px;font-size:16px;">🔒 Your Context-Mapper Moat</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;color:#555;">Proposals indexed</td>
          <td style="padding:6px 0;font-weight:bold;text-align:right;">{moat.proposals_indexed}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#555;">Institutional knowledge</td>
          <td style="padding:6px 0;font-weight:bold;text-align:right;">{moat.human_hours} hours</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#555;">Cost to rebuild elsewhere</td>
          <td style="padding:6px 0;font-weight:bold;color:#E65100;text-align:right;">{moat_cost_formatted}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#555;">Moat milestone</td>
          <td style="padding:6px 0;font-weight:bold;text-align:right;text-transform:capitalize;">{moat.milestone}</td>
        </tr>
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:24px 0;">
      <a href="https://app.draftly.ai/dashboard"
         style="background:#00BFA5;color:white;padding:12px 32px;border-radius:6px;
                text-decoration:none;font-weight:bold;display:inline-block;">
        Generate a Proposal →
      </a>
    </div>

  </div>

  <div style="padding:16px 24px;text-align:center;">
    <p style="color:#999;font-size:12px;margin:0;">
      Draftly · <a href="https://app.draftly.ai/unsubscribe" style="color:#999;">Unsubscribe</a><br>
      This email was auto-generated by Draftly's ROI tracking system.
    </p>
  </div>
</div>"""

    result = resend_client.emails.send(
        {
            "from": FROM_EMAIL,
            "to": [customer["email"]],
            "subject": (
                f"Your Draftly Week: {len(proposals)} proposals, "
                f"{hours_saved:.0f} hrs saved"
            ),
            "html": html,
        }
    )
    return {"sent": True, "email_id": result.get("id"), "recipient": customer["email"]}


async def send_weekly_roi_to_all() -> dict:
    """
    Send weekly ROI emails to all Professional and GTM Agent tier customers.
    Called by the Monday 8am cron job.
    """
    supabase = get_supabase()
    customers_result = (
        supabase.table("customers")
        .select("id")
        .in_("tier", ["professional", "gtm_agent"])
        .eq("status", "active")
        .execute()
    )

    sent = 0
    errors = 0
    for customer in customers_result.data or []:
        try:
            await send_weekly_roi_email(customer["id"])
            sent += 1
        except Exception as e:
            errors += 1
            # Log error but don't stop processing
            supabase.table("logs").insert(
                {
                    "level": "error",
                    "message": f"ROI email failed for {customer['id']}: {e}",
                    "created_at": datetime.utcnow().isoformat(),
                }
            ).execute()

    return {"sent": sent, "errors": errors}
