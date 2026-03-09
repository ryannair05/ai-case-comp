import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER!,         // $99/mo
  professional: process.env.STRIPE_PRICE_PROFESSIONAL!, // $249/mo
  gtm_agent: process.env.STRIPE_PRICE_GTM_AGENT!,      // $399/mo (Phase 2)
} as const;

/** Create a Stripe subscription on signup */
export async function createSubscription(customerId: string, tier: keyof typeof PRICE_IDS) {
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: PRICE_IDS[tier] }],
    payment_behavior: "default_incomplete",
    expand: ["latest_invoice.payment_intent"],
  });
}

/** Upgrade from Starter to Professional (Context-Mapper unlock) */
export async function upgradeToProfessional(subscriptionId: string) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  return stripe.subscriptions.update(subscriptionId, {
    items: [{ id: sub.items.data[0].id, price: PRICE_IDS.professional }],
    proration_behavior: "create_prorations",
  });
}

/** Create a Stripe customer on signup */
export async function createStripeCustomer(email: string, name: string) {
  return stripe.customers.create({ email, name });
}

/** Get subscription status */
export async function getSubscription(subscriptionId: string) {
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
}
