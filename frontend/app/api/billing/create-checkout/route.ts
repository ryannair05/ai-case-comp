import { NextRequest } from "next/server";
import { stripe, PRICE_IDS } from "@/lib/stripe";

const TIER_MAP: Record<string, keyof typeof PRICE_IDS> = {
  Starter: "starter",
  Professional: "professional",
  "GTM Agent": "gtm_agent",
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tier, email: customerEmail } = body as { tier: string; email?: string };

  const priceKey = TIER_MAP[tier];
  if (!priceKey || !PRICE_IDS[priceKey]) {
    return Response.json({ error: "Invalid tier" }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const success_url = `${origin}/billing?success=true`;
  const cancel_url = `${origin}/billing?canceled=true`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: PRICE_IDS[priceKey], quantity: 1 }],
    success_url,
    cancel_url,
    metadata: {
      customer_email: customerEmail ?? "",
      tier,
    },
  });

  return Response.json({ url: session.url });
}
