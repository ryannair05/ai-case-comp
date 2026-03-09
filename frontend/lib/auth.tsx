"use client";

/**
 * Client-side auth hook and AuthProvider.
 * Wraps Supabase session management and exposes useAuth() for components.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

interface Customer {
  id: string;
  name: string;
  email: string;
  tier: string;
  pinecone_namespace: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  customer: Customer | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  customer: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /** Fetch the customer row for the given user id */
  async function fetchCustomer(uid: string) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("id", uid)
      .single();
    setCustomer(data ?? null);
  }

  useEffect(() => {
    // Initialize from existing session
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) fetchCustomer(u.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    // Keep in sync with auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) fetchCustomer(u.id);
        else setCustomer(null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setCustomer(null);
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ user, customer, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Hook to access auth state from any client component */
export function useAuth() {
  return useContext(AuthContext);
}
