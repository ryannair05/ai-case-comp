"use client";

/**
 * Auth context — uses the Vapor JWT backend
 * Stores the JWT token in localStorage under "draftly_token".
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8080";

interface AuthUser {
  customerId: string;
  email: string;
  name: string;
  tier: string;
  isAdmin?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, tier?: string, industry?: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  loading: true,
  signIn: async () => { },
  signUp: async () => { },
  signOut: () => { },
});

/** True when a customer's tier includes Context-Mapper access. */
export const hasProfessionalAccess = (tier?: string) =>
  tier === "professional" || tier === "gtm_agent";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("draftly_token");
    const storedUser = localStorage.getItem("draftly_user");
    if (stored && storedUser) {
      setToken(stored);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  async function signIn(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login failed" }));
      throw new Error(err.detail ?? err.error ?? "Login failed");
    }
    const data = await res.json();
    persist(data);
    router.push("/dashboard");
  }

  async function signUp(
    name: string,
    email: string,
    password: string,
    tier = "starter",
    industry?: string
  ) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, tier, industry }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Registration failed" }));
      throw new Error(err.detail ?? err.error ?? "Registration failed");
    }
    const data = await res.json();
    persist(data);
    router.push("/onboarding");
  }

  function signOut() {
    localStorage.removeItem("draftly_token");
    localStorage.removeItem("draftly_user");
    document.cookie = "draftly_token=; path=/; max-age=0";
    setToken(null);
    setUser(null);
    router.push("/login");
  }

  function persist(data: { token: string; customer_id: string; email: string; name: string; tier: string; is_admin?: boolean }) {
    const u: AuthUser = {
      customerId: data.customer_id,
      email: data.email,
      name: data.name,
      tier: data.tier,
      isAdmin: data.is_admin ?? false,
    };
    localStorage.setItem("draftly_token", data.token);
    localStorage.setItem("draftly_user", JSON.stringify(u));
    // Also set a cookie so middleware can check authentication without JS
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `draftly_token=${data.token}; path=/; max-age=${30 * 24 * 3600}; SameSite=Lax${secure}`;
    setToken(data.token);
    setUser(u);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
