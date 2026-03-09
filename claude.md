# DRAFTLY — AI-Powered Proposal Intelligence
## Project Overview
Draftly is a B2B SaaS tool that helps 5–50 person professional
services firms generate proposals 10x faster using AI. The core
product is Context-Mapper: a proprietary knowledge graph that
indexes each firm's past proposals, pricing decisions, win/loss
outcomes, and brand voice — creating institutional memory that
generic AI (ChatGPT, Gemini) cannot replicate from outside the
customer relationship.
 
## Tech Stack (do not deviate)
- Frontend:  Next.js 14, React, Tailwind CSS, shadcn/ui
- Backend:   Python 3.11, FastAPI, Railway (deploy target)
- Vector DB: Pinecone Serverless (per-customer namespaces)
- Database:  Supabase (PostgreSQL + row-level security)
- Queue:     Upstash Redis (async jobs, rate-limiting)
- LLM:       Claude Sonnet 4.6 (PRIMARY — structured extraction)
- Embeddings:OpenAI text-embedding-3-large (3072-dim vectors)
- Auth:      Supabase Auth
- Payments:  Stripe
- Email:     Resend
- CRM sync:  HubSpot API + Pipedrive API
- Deploy:    Vercel (frontend), Railway (backend)
 
## Architecture Rules (NEVER violate these)
1. Each customer gets their OWN Pinecone namespace.
   Format: namespace = f"customer_{customer_id}"
   Zero cross-customer data. This is architectural, not a policy.
2. Row-level security on ALL Supabase tables. Every query
   filters by customer_id. Never return data without this filter.
3. Claude Sonnet 4.6 is PRIMARY LLM for all proposal generation.
   OpenAI GPT models are used ONLY for embeddings.
   AI dependency hedge: 72hr Redis cache on all LLM responses.
4. Async everything. All ingest jobs go through Upstash Redis
   queue. Never do synchronous file processing in API routes.
5. One-click data export must work at all times. Never delete
   customer data without a 30-day soft-delete + export window.
 
## Data Models (key tables)
- customers (id, name, tier, pinecone_namespace, created_at)
- proposals (id, customer_id, content, win_loss, created_at)
- pricing_data (id, customer_id, service_type, price, won)
- brand_voice (id, customer_id, examples, style_notes)
- support_tickets (id, customer_id, status, ai_response)
- churn_signals (id, customer_id, usage_drop_pct, flagged_at)
 
## Pricing Tiers
- Starter:      $99/mo  — no Context-Mapper
- Professional: $249/mo — FULL Context-Mapper (core ICP)
- GTM Agent:    $399-499/mo — Phase 2, not yet built
 
## Coding Standards
- TypeScript strict mode on all Next.js files
- Pydantic v2 models on all FastAPI endpoints
- Every API endpoint must validate customer_id from JWT
- No raw SQL — use Supabase client with typed queries
- All env vars in .env.local (never hardcode keys)
- Error handling: log to Supabase logs table, never expose
  stack traces to frontend
- Comments required on all business logic functions
 
## Phase Priority (DO NOT skip ahead)
Phase 1 (Months 1-6): Context-Mapper ONLY
Phase 2 (Months 6-12): GTM Sales Agent (after gate clears)
Gate conditions before starting Phase 2:
  1. ≥50 customers have Context-Mapper active
  2. Monthly churn ≤5.0%
  3. context-mapper PR merged to prod
 
## Key Business Context
- 64 paying customers, $11.2K MRR, 6.2% monthly churn
- $0 CAC (referral/organic only — protect this)
- Rachel Merchant (LionTown Marketing) = bear case avatar
- David Chen = $500K angel investor, answer due Friday
- Sole engineer = Hayden (that's you). CS hire coming Month 1.

Project Folder Structure
draftly/
├── CLAUDE.md                 ← paste the above here
├── .env.local                ← never commit this
├── frontend/                 ← Next.js 14
│   ├── app/
│   │   ├── (auth)/           ← login, signup
│   │   ├── dashboard/        ← main app
│   │   ├── demo/             ← PoC demo screen
│   │   ├── onboarding/       ← live ingest screen
│   │   ├── moat-meter/       ← switching cost visualizer
│   │   └── roi-email/        ← auto-generated ROI report
│   ├── components/
│   │   ├── ui/               ← shadcn/ui components
│   │   ├── proposal/         ← proposal generation UI
│   │   ├── context-mapper/   ← moat-related UI
│   │   └── analytics/        ← win/loss, ROI dashboards
│   └── lib/
│       ├── supabase.ts
│       ├── stripe.ts
│       └── resend.ts
├── backend/                  ← FastAPI (Python)
│   ├── main.py
│   ├── routers/
│   │   ├── proposals.py
│   │   ├── context_mapper.py
│   │   ├── ingest.py
│   │   ├── support.py
│   │   ├── churn.py
│   │   └── crm.py
│   ├── services/
│   │   ├── embeddings.py     ← OpenAI text-embedding-3-large
│   │   ├── pinecone_client.py
│   │   ├── claude_client.py  ← primary LLM
│   │   ├── redis_queue.py
│   │   └── rag_pipeline.py
│   └── models/
│       └── schemas.py        ← Pydantic v2
└── scripts/
    ├── seed_liontown.py      ← seed demo data
    └── churn_cron.py         ← churn detection job
