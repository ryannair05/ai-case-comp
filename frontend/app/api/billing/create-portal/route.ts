import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body as { email: string };

    if (!email) {
      return Response.json({ error: "Missing email" }, { status: 400 });
    }

    // Try to find the Stripe customer by email
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId = customers.data[0]?.id;

    if (!customerId) {
        // Fallback or error if no customer found.
        // For the demo, we'll try to create one if it doesn't exist, 
        // though typically they should already have one if they are on a plan.
        const customer = await stripe.customers.create({ email });
        customerId = customer.id;
    }

    const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/billing`,
    });

    return Response.json({ url: session.url });
  } catch (err: any) {
    console.error("Portal error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
