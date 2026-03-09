-- Draftly Initial Schema
-- Run this in Supabase SQL editor (Settings → SQL Editor)
-- All tables have Row-Level Security enabled

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  email                 text UNIQUE NOT NULL,
  tier                  text NOT NULL DEFAULT 'starter', -- starter|professional|gtm_agent
  stripe_id             text,
  pinecone_namespace     text GENERATED ALWAYS AS ('customer_' || id::text) STORED,
  context_mapper_active boolean DEFAULT false,
  proposals_indexed     int DEFAULT 0,
  onboarded_at          timestamptz,
  industry              text,
  status                text DEFAULT 'active',           -- active|churned|deleted|suspended
  deleted_at            timestamptz,
  hard_delete_at        timestamptz,
  monthly_revenue       numeric DEFAULT 0,
  churned_this_month    boolean DEFAULT false,
  hubspot_connected     boolean DEFAULT false,
  hubspot_token         text,
  pipedrive_connected   boolean DEFAULT false,
  pipedrive_token       text,
  created_at            timestamptz DEFAULT now()
);

-- ============================================================
-- PROPOSALS
-- ============================================================
CREATE TABLE IF NOT EXISTS proposals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid REFERENCES customers(id) ON DELETE CASCADE,
  title               text,
  content             text NOT NULL,
  client_name         text,
  value_usd           numeric,
  outcome             text DEFAULT 'pending', -- won|lost|pending
  win_reason          text,
  lose_reason         text,
  pinecone_vector_id  text,
  deleted_at          timestamptz,            -- soft delete
  created_at          timestamptz DEFAULT now()
);

-- ============================================================
-- PRICING DATA
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_data (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid REFERENCES customers(id) ON DELETE CASCADE,
  service_type        text NOT NULL,
  price_usd           numeric NOT NULL,
  won                 boolean,
  notes               text,
  pinecone_vector_id  text,
  created_at          timestamptz DEFAULT now()
);

-- ============================================================
-- BRAND VOICE
-- ============================================================
CREATE TABLE IF NOT EXISTS brand_voice (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid REFERENCES customers(id) ON DELETE CASCADE,
  example_text        text NOT NULL,
  style_notes         text,
  tone_tags           text[],
  pinecone_vector_id  text,
  created_at          timestamptz DEFAULT now()
);

-- ============================================================
-- SUPPORT TICKETS
-- ============================================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid REFERENCES customers(id) ON DELETE CASCADE,
  subject             text,
  body                text NOT NULL,
  ai_response         text,
  status              text DEFAULT 'open',   -- open|ai_handled|escalated|closed
  severity            text DEFAULT 'low',    -- low|medium|high
  response_time_min   int,
  created_at          timestamptz DEFAULT now(),
  resolved_at         timestamptz
);

-- ============================================================
-- CHURN SIGNALS
-- ============================================================
CREATE TABLE IF NOT EXISTS churn_signals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid REFERENCES customers(id) ON DELETE CASCADE,
  usage_drop_pct  numeric,
  days_inactive   int,
  nps_score       int,
  flagged_at      timestamptz DEFAULT now(),
  outreach_sent   boolean DEFAULT false,
  resolved        boolean DEFAULT false
);

-- ============================================================
-- KNOWLEDGE BASE ARTICLES (for support ticket deflection)
-- ============================================================
CREATE TABLE IF NOT EXISTS kb_articles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  content     text NOT NULL,
  slug        text UNIQUE,
  published   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- SETTINGS (key-value store for system config)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  updated_at  timestamptz DEFAULT now()
);

-- Track Phase 1→2 gate conditions
INSERT INTO settings (key, value) VALUES
  ('context_mapper_pr_merged', 'false'),
  ('gtm_agent_unlocked', 'false')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- LOGS (error logging — never expose stack traces to frontend)
-- ============================================================
CREATE TABLE IF NOT EXISTS logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level       text NOT NULL, -- info|error|warn
  message     text NOT NULL,
  metadata    jsonb,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================
ALTER TABLE proposals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_data   ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_voice    ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_signals  ENABLE ROW LEVEL SECURITY;

-- Proposals: customers see only their own
DROP POLICY IF EXISTS "Customer sees own proposals" ON proposals;
CREATE POLICY "Customer sees own proposals" ON proposals
  FOR ALL USING (customer_id = auth.uid()::uuid);

-- Pricing: customers see only their own
DROP POLICY IF EXISTS "Customer sees own pricing" ON pricing_data;
CREATE POLICY "Customer sees own pricing" ON pricing_data
  FOR ALL USING (customer_id = auth.uid()::uuid);

-- Brand voice: customers see only their own
DROP POLICY IF EXISTS "Customer sees own brand voice" ON brand_voice;
CREATE POLICY "Customer sees own brand voice" ON brand_voice
  FOR ALL USING (customer_id = auth.uid()::uuid);

-- Support tickets: customers see only their own
DROP POLICY IF EXISTS "Customer sees own tickets" ON support_tickets;
CREATE POLICY "Customer sees own tickets" ON support_tickets
  FOR ALL USING (customer_id = auth.uid()::uuid);

-- Churn signals: customers see only their own
DROP POLICY IF EXISTS "Customer sees own churn signals" ON churn_signals;
CREATE POLICY "Customer sees own churn signals" ON churn_signals
  FOR ALL USING (customer_id = auth.uid()::uuid);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Increment proposals_indexed counter (called by background worker)
CREATE OR REPLACE FUNCTION increment_proposals_indexed(customer_id_param uuid)
RETURNS void AS $$
BEGIN
  UPDATE customers
  SET proposals_indexed = proposals_indexed + 1,
      context_mapper_active = true
  WHERE id = customer_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get at-risk customers for churn detection
CREATE OR REPLACE FUNCTION get_at_risk_customers(
  usage_drop_threshold numeric,
  inactivity_days int
)
RETURNS TABLE (
  id              uuid,
  name            text,
  email           text,
  tier            text,
  usage_drop_pct  numeric,
  days_inactive   int,
  nps_score       int
) AS $$
BEGIN
  -- This is a stub — the churn_cron.py script does the real calculation
  -- in application code for better flexibility.
  RETURN QUERY
  SELECT
    c.id, c.name, c.email, c.tier,
    0::numeric AS usage_drop_pct,
    0::int AS days_inactive,
    NULL::int AS nps_score
  FROM customers c
  WHERE c.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_proposals_customer_id     ON proposals(customer_id);
CREATE INDEX IF NOT EXISTS idx_proposals_outcome         ON proposals(outcome);
CREATE INDEX IF NOT EXISTS idx_proposals_created_at      ON proposals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_data_customer_id  ON pricing_data(customer_id);
CREATE INDEX IF NOT EXISTS idx_brand_voice_customer_id   ON brand_voice(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_customer  ON support_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status    ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_churn_signals_customer    ON churn_signals(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_status          ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_tier            ON customers(tier);
