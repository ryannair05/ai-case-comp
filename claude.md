# Draftly — AI Proposal Intelligence

## What it does
Helps small professional services firms (marketing agencies, consultants, accountants) generate proposals in minutes using AI. The core moat: every proposal is indexed into a proprietary knowledge graph so Draftly learns *how a specific firm sells* over time — institutional memory ChatGPT can never replicate.

## Stack
| Layer | Tech |
|---|---|
| Frontend | Next.js 14, Tailwind CSS, shadcn/ui |
| Backend | Swift Vapor 4, SQLite (Fluent) |
| Vectors | Local BLOB store (SIMD cosine similarity) |
| LLM | Claude Sonnet 4.6 — generation only |
| Embeddings | OpenAI text-embedding-3-large (1024-dim) |
| Cache | Upstash Redis (72-hr LLM hedge) |
| Auth | JWT (Vapor/jwt-kit, HS256) |
| Email | Resend |
| Payments | Stripe |
| CRM | HubSpot OAuth |

## Architecture rules (never break these)
1. **Customer isolation**: every SQL/vector query filters `customer_id`. Zero cross-customer data.
2. **Claude for generation, OpenAI for embeddings only** — never swap.
3. **All file processing is async** (`Task.detached`) — never block HTTP.
4. **72-hr Redis cache** on all LLM responses — AI dependency hedge.
5. **30-day soft-delete** before hard deletion — GDPR + export window.

## Backend layout (`backend/Sources/App/`)
```
Models/        — Fluent models (Customer, Proposal, PricingData, BrandVoice,
                 SupportTicket, ChurnSignal, VectorEntry, JobRecord)
Migrations/    — One file: Migrations.swift
Controllers/   — AuthController, ProposalController, IngestController,
                 ContextMapperController, SupportController, ChurnController,
                 CRMController, AnalyticsController, ExportController, GTMController
Services/      — ClaudeService, EmbeddingsService, LocalVectorStore (BLOB+SIMD),
                 RAGPipeline, ColdStart, RedisCache, DocxExporter, JWTMiddleware,
                 ResponseHelpers
```

## Vector store design
- Stored as raw `Float32` BLOB in SQLite (`4096 bytes` per 1024-dim vector)
- Query: SIMD16<Float> cosine similarity, 64 iterations for 1024 dims
- Threshold: 0.72 (customer), 0.65 (KB)
- Namespace isolation: `customer_id` column, never queried without filter

## Cold-start fix (was a bug)
When `proposals_indexed < 15`, `RAGPipeline.generateProposal` calls
`ColdStart.getContext(industry:)` — passing the customer's actual industry.
The old Python backend called it without `industry`, so everyone got consulting templates.

## Key endpoints
| Method | Path | Notes |
|---|---|---|
| POST | /auth/register | Create customer + JWT |
| POST | /auth/login | JWT token |
| POST | /proposals/generate | RAG + Claude (Professional tier) |
| GET  | /proposals/:id/export-docx | Download .docx (P0) |
| POST | /ingest/pricing-csv | Async CSV embed |
| POST | /ingest/proposal-file | Async PDF/DOCX embed |
| POST | /gtm/meeting-signals | Extract deal signals (GTM tier) |
| POST | /gtm/outreach-sequence | AI email sequence (GTM tier) |
| GET  | /export/full | ZIP data export (GDPR) |

## Pricing tiers
- **Starter** $99/mo — no Context-Mapper
- **Professional** $249/mo — full Context-Mapper (core ICP)
- **GTM Agent** $399/mo — Phase 2 (gate: ≥50 CM customers, churn ≤5%)

## Running locally
```bash
# Backend
cd backend && swift run

# Frontend
cd frontend && npm install && npm run dev
```

Set env vars: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `JWT_SECRET`,
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`,
`STRIPE_SECRET_KEY`, `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`.
