/**
 * Shared TypeScript interfaces for Draftly frontend.
 * Import from here — never use `any` in components.
 */

export interface Proposal {
  id: string;
  title?: string;
  client_name?: string;
  value_usd?: number;
  outcome?: "pending" | "won" | "lost";
  quality_score?: number;
}

export interface SwitchingCost {
  total_cost: number;
  human_hours: number;
  months_active: number;
  proposals_indexed: number;
  milestone: string;
}

export interface CMStatus {
  context_mapper_active: boolean;
  proposals_indexed: number;
  pricing_rows: number;
  brand_examples: number;
  next_milestone?: string;
  proposals_to_next_milestone?: number;
  milestone_progress_pct?: number;
  milestone_target?: number;
  estimated_days_to_milestone?: number;
  switching_cost?: SwitchingCost;
}

export interface UnitEconomics {
  monthly_churn_rate: number;
  ltv_usd: number;
  blended_arpa_usd: number;
  gross_margin: number;
  ai_cost_per_proposal: number;
  avg_switching_cost_usd: number;
  on_track_for: "bull" | "base" | "bear";
}

export interface Gate {
  label: string;
  passed: boolean;
  current: number;
  target: number;
}

export interface PhaseGate {
  all_passed: boolean;
  gate1: Gate;
  gate2: Gate;
  gate3: Gate;
}

export interface WinRate {
  win_rate: number;
  total_proposals: number;
  won: number;
  lost: number;
  avg_deal_size_usd: number;
}

export type DealStage =
  | "discovery"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export interface DealSignal {
  id: string;
  client_name: string;
  stage: DealStage;
  needs?: string;
  budget?: string;
  timeline?: string;
  created_at?: string;
}

export interface HubSpotStatus {
  connected: boolean;
  portal_id?: string;
}

export interface IndustryBenchmark {
  avg_switching_cost_usd: number;
  benchmark_label: string;
}

export interface OutreachEmail {
  send_day?: number;
  subject: string;
  body: string;
  cta?: string;
}

export interface MeetingSignalResult {
  signal_id?: string;
  client_name: string;
  stage?: DealStage;
  needs?: string;
  budget?: string;
  timeline?: string;
  crm_pushed?: boolean;
  crm_error?: string;
}
