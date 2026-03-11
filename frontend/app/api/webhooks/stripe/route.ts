import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8080";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Price ID → tier + revenue mapping
const PRICE_TO_TIER: Record<string, { tier: string; revenue: number }> = {
    [process.env.STRIPE_PRICE_STARTER ?? ""]: { tier: "starter", revenue: 99 },
    [process.env.STRIPE_PRICE_PROFESSIONAL ?? ""]: { tier: "professional", revenue: 249 },
    [process.env.STRIPE_PRICE_GTM_AGENT ?? ""]: { tier: "gtm_agent", revenue: 399 },
};

export async function POST(req: NextRequest) {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event;

    // Verify webhook signature if secret is configured
    if (WEBHOOK_SECRET && signature) {
        try {
            event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
        } catch (err) {
            console.error("Webhook signature verification failed:", err);
            return Response.json({ error: "Invalid signature" }, { status: 400 });
        }
    } else {
        // Demo mode — parse the event directly (no signature verification)
        try {
            event = JSON.parse(body);
        } catch {
            return Response.json({ error: "Invalid payload" }, { status: 400 });
        }
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const customerEmail = session.metadata?.customer_email ?? session.customer_email;
        const tierOverride = session.metadata?.tier;

        if (!customerEmail) {
            console.error("Webhook: No customer email found in session");
            return Response.json({ error: "Missing customer email" }, { status: 400 });
        }

        // Determine the new tier from metadata or from the subscription's price
        let newTier = "starter";
        let newRevenue = 99;

        if (tierOverride) {
            const tierMap: Record<string, { tier: string; revenue: number }> = {
                Professional: { tier: "professional", revenue: 249 },
                "GTM Agent": { tier: "gtm_agent", revenue: 399 },
                Starter: { tier: "starter", revenue: 99 },
            };
            const mapped = tierMap[tierOverride];
            if (mapped) {
                newTier = mapped.tier;
                newRevenue = mapped.revenue;
            }
        } else if (session.subscription) {
            // Look up the subscription to find the price
            try {
                const sub = await stripe.subscriptions.retrieve(session.subscription as string);
                const priceId = sub.items.data[0]?.price?.id;
                if (priceId && PRICE_TO_TIER[priceId]) {
                    newTier = PRICE_TO_TIER[priceId].tier;
                    newRevenue = PRICE_TO_TIER[priceId].revenue;
                }
            } catch (err) {
                console.error("Webhook: Failed to retrieve subscription:", err);
            }
        }

        // Update the customer tier in the Vapor backend
        try {
            const res = await fetch(`${API_BASE}/billing/confirm-upgrade`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Webhook-Secret": process.env.INTERNAL_WEBHOOK_SECRET ?? "webhook-internal",
                },
                body: JSON.stringify({
                    customer_email: customerEmail,
                    tier: newTier,
                    monthly_revenue: newRevenue,
                }),
            });

            if (!res.ok) {
                console.error("Webhook: Backend tier update failed:", res.status, await res.text());
            } else {
                console.log(`Webhook: Upgraded ${customerEmail} to ${newTier}`);
            }
        } catch (err) {
            console.error("Webhook: Failed to call backend:", err);
        }
    }

    return Response.json({ received: true });
}
