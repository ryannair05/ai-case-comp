# Draftly — AI-Powered Proposal Intelligence

## What We Build
Draftly helps 5–50-person professional services firms (agencies, consultants, accountants) generate client proposals in minutes. The core product is **Context-Mapper**: a proprietary knowledge graph that indexes each firm's past proposals, pricing decisions, win/loss outcomes, and brand voice — creating institutional memory that generic AI cannot replicate.

## Tech Stack
| Layer | Tech |
|---|---|
| Frontend | Next.js 14, Tailwind CSS |
| Backend | Python 3.11, FastAPI (Railway) |
| LLM | Claude Sonnet 4.6 (primary), OpenAI embeddings only |
| Queue | Upstash Redis (async jobs + 72hr LLM cache) |
| Auth | Supabase Auth |
| Payments | Stripe |
| Email | Resend |
| CRM | HubSpot + Pipedrive |

## Architecture Rules
1. **Customer isolation** — every customer gets their own data namespace; zero cross-customer data.
2. **Row-level security** — every DB query must filter by `customer_id`.
3. **Claude Sonnet 4.6 only** for text generation; OpenAI for embeddings only.
4. **Async everything** — all file ingest goes through Redis queue, never synchronous.
5. **30-day soft delete** — one-click data export must always work.

## Pricing Tiers
- **Starter** $99/mo — no Context-Mapper
- **Professional** $249/mo — full Context-Mapper
- **GTM Agent** $399–499/mo — Phase 2 (not yet GA)

## Phase Gates
Phase 2 (GTM Agent) unlocks when ALL of:
1. ≥ 50 customers have Context-Mapper active
2. Monthly churn ≤ 5.0 %
3. `context-mapper` PR merged to prod

## Coding Standards
- TypeScript strict mode on all Next.js files
- Pydantic v2 on all FastAPI endpoints
- Every endpoint validates `customer_id` from JWT (`get_current_customer` dependency)
- No raw SQL — use typed Supabase client queries
- All secrets in `.env.local` — never hardcoded
- Log errors to Supabase `logs` table; never expose stack traces to frontend
- Comments required on all business-logic functions

