# Draftly — AI Proposal Intelligence

Helps small professional services firms generate proposals in minutes. Every proposal is indexed into a proprietary knowledge graph so Draftly learns *how a specific firm sells* over time — institutional memory ChatGPT can never replicate.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14, Tailwind CSS, shadcn/ui |
| Backend | Swift Vapor 4, SQLite (Fluent) |
| Vectors | Local BLOB store (SIMD cosine similarity) |
| LLM | Claude Haiku 4.5 — generation only |
| Embeddings | OpenAI text-embedding-3-large (1024-dim) |
| Cache | Upstash Redis (72-hr LLM hedge) |
| Auth | JWT (Vapor/jwt-kit, HS256) |
| Payments | Stripe |
| CRM | HubSpot OAuth + Pipedrive API key |

## Architecture rules (never break these)

1. **Customer isolation** — every SQL/vector query filters `customer_id`. Zero cross-customer data.
2. **Claude for generation, OpenAI for embeddings only** — never swap.
3. **All file processing is async** (`Task.detached`) — never block HTTP.
4. **72-hr Redis cache** on all LLM responses — AI dependency hedge.
5. **30-day soft-delete** before hard deletion — GDPR + export window.

## Key endpoints

| Method | Path | Notes |
|---|---|---|
| POST | /auth/register | Create customer + JWT |
| POST | /proposals/generate | RAG + Claude (Professional tier) |
| GET  | /proposals/:id/export-docx | Download .docx |
| POST | /ingest/pricing-csv | Async CSV embed |
| POST | /ingest/proposal-file | Async PDF/DOCX embed |
| POST | /gtm/meeting-signals | Deal signal extraction (GTM tier) |
| GET  | /export/full | ZIP GDPR data export |

## Pricing tiers

- **Starter** $99/mo — proposal generation + DOCX export
- **Professional** $249/mo — full Context-Mapper + CRM integrations
- **GTM Agent** $399/mo — AI outreach sequences (gate: ≥50 CM customers, churn ≤5%)

## Env vars

`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `JWT_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`
