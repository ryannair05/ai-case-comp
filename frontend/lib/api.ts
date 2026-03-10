/**
 * API client for Draftly Vapor backend.
 * All requests include the JWT token from localStorage for customer_id validation.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.draftly.ai";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("draftly_token") ?? "";
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  if (!token && typeof window !== "undefined") {
    window.location.href = "/login";
    throw new Error("Not authenticated");
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail ?? error.error ?? "API request failed");
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
  exportDocx: async (id: string, title: string) => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/proposals/${id}/export-docx`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_").toLowerCase()}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  },
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
    const token = getToken();
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/ingest/pricing-csv`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },
  uploadProposalFile: async (
    file: File,
    metadata: { clientName?: string; valueUsd?: number; outcome?: string }
  ) => {
    const token = getToken();
    const fd = new FormData();
    fd.append("file", file);
    if (metadata.clientName) fd.append("client_name", metadata.clientName);
    if (metadata.valueUsd) fd.append("value_usd", String(metadata.valueUsd));
    if (metadata.outcome) fd.append("outcome", metadata.outcome);
    const res = await fetch(`${API_BASE}/ingest/proposal-file`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },
  jobStatus: (jobId: string) => apiRequest<any>(`/ingest/job/${jobId}`),
  uploadBrandVoice: (exampleText: string, styleNotes?: string, toneTags?: string) =>
    apiRequest<any>("/ingest/brand-voice", {
      method: "POST",
      body: JSON.stringify({
        example_text: exampleText,
        style_notes: styleNotes,
        tone_tags: toneTags,
      }),
    }),
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
// Export (GDPR)
// ---------------------------------------------------------------------------

export const exportApi = {
  downloadAll: async () => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/export/full`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "draftly-export.zip";
    a.click();
    URL.revokeObjectURL(url);
  },
};

// ---------------------------------------------------------------------------
// Churn
// ---------------------------------------------------------------------------

export const churnApi = {
  listSignals: () => apiRequest<any[]>("/churn/signals"),
  runDetection: () => apiRequest<any>("/churn/detect", { method: "POST" }),
};

// ---------------------------------------------------------------------------
// Pipedrive CRM
// ---------------------------------------------------------------------------

export const pipedriveApi = {
  status: () => apiRequest<any>("/crm/pipedrive/status"),
  saveApiKey: (apiKey: string) =>
    apiRequest<any>("/crm/pipedrive/save-key", {
      method: "POST",
      body: JSON.stringify({ api_key: apiKey }),
    }),
  syncDeal: (proposalId: string, clientName: string, valueUsd?: number, outcome?: string) =>
    apiRequest<any>("/crm/pipedrive/sync-deal", {
      method: "POST",
      body: JSON.stringify({ proposal_id: proposalId, client_name: clientName, value_usd: valueUsd, outcome }),
    }),
};
// ---------------------------------------------------------------------------

export const gtmApi = {
  extractMeetingSignals: (rawNotes: string, clientName: string) =>
    apiRequest<any>("/gtm/meeting-signals", {
      method: "POST",
      body: JSON.stringify({ raw_notes: rawNotes, client_name: clientName }),
    }),
  generateOutreachSequence: (
    prospectName: string,
    prospectCompany: string,
    prospectIndustry: string,
    painPoint: string,
    sequenceLength?: number
  ) =>
    apiRequest<any[]>("/gtm/outreach-sequence", {
      method: "POST",
      body: JSON.stringify({
        prospect_name: prospectName,
        prospect_company: prospectCompany,
        prospect_industry: prospectIndustry,
        pain_point: painPoint,
        sequence_length: sequenceLength,
      }),
    }),
};
