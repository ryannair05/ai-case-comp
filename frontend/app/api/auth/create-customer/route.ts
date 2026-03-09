/**
 * Server-side route to insert a new customer row after Supabase auth signup.
 * Uses the service role key so RLS does not block the insert.
 * Called from the signup page after supabase.auth.signUp() succeeds.
 */
import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { id, name, email, tier } = await request.json();

    if (!id || !name || !email || !tier) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, email, tier" },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // pinecone_namespace is GENERATED ALWAYS AS ('customer_' || id) STORED
    // — Postgres computes it automatically, do not include it in the insert.
    const { error } = await supabase.from("customers").insert({
      id,
      name,
      email,
      tier,
    });

    if (error) {
      console.error("[create-customer] Supabase insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[create-customer] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
