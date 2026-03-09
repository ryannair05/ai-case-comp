/**
 * API client for Draftly backend.
 * All requests include the Supabase JWT for customer_id validation.
 */
import { supabase } from "./supabase";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.draftly.ai";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    // Redirect gracefully instead of crashing the page
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Not authenticated");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> ?? {}) },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail ?? "API request failed");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

export const proposalsApi = {
  list: () => apiRequest<any[]>("/proposals/"),
  get: (id: string) => apiRequest<any>(`/proposals/${id}`),
  generate: (rfpText: string, clientName?: string, valueUsd?: number) =>
    apiRequest<{ proposal_id: string; content: string }>("/proposals/generate", {
      method: "POST",
      body: JSON.stringify({ rfp_text: rfpText, client_name: clientName, value_usd: valueUsd }),
    }),
  update: (id: string, data: any) =>
    apiRequest<any>(`/proposals/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => apiRequest<any>(`/proposals/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Context-Mapper
// ---------------------------------------------------------------------------

export const contextMapperApi = {
  status: () => apiRequest<any>("/context-mapper/status"),
  switchingCost: () => apiRequest<any>("/context-mapper/switching-cost"),
};

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------

export const ingestApi = {
  uploadPricingCsv: async (file: File) => {
    const headers = await getAuthHeaders();
    delete (headers as any)["Content-Type"]; // let browser set multipart boundary
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/ingest/pricing-csv`, {
      method: "POST",
      headers: { Authorization: headers.Authorization },
      body: fd,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },

  uploadProposalFile: async (
    file: File,
    metadata: { clientName?: string; valueUsd?: number; outcome?: string }
  ) => {
    const headers = await getAuthHeaders();
    const fd = new FormData();
    fd.append("file", file);
    if (metadata.clientName) fd.append("client_name", metadata.clientName);
    if (metadata.valueUsd) fd.append("value_usd", String(metadata.valueUsd));
    if (metadata.outcome) fd.append("outcome", metadata.outcome);
    const res = await fetch(`${API_BASE}/ingest/proposal-file`, {
      method: "POST",
      headers: { Authorization: headers.Authorization },
      body: fd,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },

  jobStatus: (jobId: string) => apiRequest<any>(`/ingest/job/${jobId}`),
};

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export const analyticsApi = {
  unitEconomics: () => apiRequest<any>("/analytics/unit-economics"),
  winRate: () => apiRequest<any>("/analytics/win-rate"),
  phaseGate: () => apiRequest<any>("/analytics/phase-gate"),
  roiSummary: () => apiRequest<any>("/analytics/roi-summary"),
};

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

export const supportApi = {
  createTicket: (subject: string, body: string) =>
    apiRequest<any>("/support/tickets", {
      method: "POST",
      body: JSON.stringify({ subject, body }),
    }),
  listTickets: (status?: string) =>
    apiRequest<any[]>(`/support/tickets${status ? `?status=${status}` : ""}`),
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const exportApi = {
  downloadAll: async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/export/full`, { headers });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "draftly-export.zip";
    a.click();
  },
};
