"use client";

/**
 * Signup page.
 * Step 1: supabase.auth.signUp() — creates auth user
 * Step 2: POST /api/auth/create-customer — inserts customers row (service role)
 * Step 3: Redirect to /onboarding
 *
 * Stripe subscription is created post-onboarding, not blocking signup.
 */
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const TIERS = [
  {
    id: "starter",
    name: "Starter",
    price: "$99/mo",
    description: "Core proposal generation",
    note: "No Context-Mapper",
  },
  {
    id: "professional",
    name: "Professional",
    price: "$249/mo",
    description: "Full Context-Mapper",
    note: "Recommended — institutional memory moat",
    highlight: true,
  },
];

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tier, setTier] = useState<"starter" | "professional">("professional");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Step 1: Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const user = authData.user;
    if (!user) {
      setError("Signup succeeded but no user returned. Please try logging in.");
      setLoading(false);
      return;
    }

    // Step 2: Insert customers row via server-side API (service role key)
    const res = await fetch("/api/auth/create-customer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, name, email, tier }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to create account profile. Please contact support.");
      setLoading(false);
      return;
    }

    // Step 3: Redirect to onboarding
    router.push("/onboarding");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-teal-600 font-bold text-2xl">Draftly</span>
          <p className="text-gray-500 text-sm mt-1">Create your account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-100 rounded-2xl p-8 space-y-5 shadow-sm"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Firm / Your name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="LionTown Marketing"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Work email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="you@yourfirm.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Min 8 characters"
            />
          </div>

          {/* Tier picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Plan
            </label>
            <div className="grid grid-cols-2 gap-3">
              {TIERS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTier(t.id as "starter" | "professional")}
                  className={`border rounded-xl p-3 text-left transition-all ${
                    tier === t.id
                      ? "border-teal-500 bg-teal-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-semibold text-sm text-gray-900">{t.name}</div>
                  <div className="text-teal-600 font-bold text-sm">{t.price}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>
                  <div
                    className={`text-xs mt-1 ${
                      t.highlight ? "text-teal-600 font-medium" : "text-gray-400"
                    }`}
                  >
                    {t.note}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Payment set up after onboarding — no card required now.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-teal-600 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
