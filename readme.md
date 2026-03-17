# Draftly — AI Proposal Intelligence

Helps small professional services firms generate proposals in minutes using AI. Every proposal is indexed into a proprietary knowledge graph so Draftly learns how a specific firm sells over time.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, Tailwind CSS, shadcn/ui |
| Backend | Swift Vapor 4, SQLite (Fluent) |
| Vectors | Local BLOB store (SIMD cosine similarity) |
| LLM | Claude Haiku 4.5 |
| Embeddings | OpenAI text-embedding-3-large (1024-dim) |
| Cache | Upstash Redis (72-hr) |
| Auth | JWT HS256 |
| Payments | Stripe |
| CRM | HubSpot OAuth + Pipedrive API |

## Running locally

```bash
# 1. Copy env template and fill in API keys for the backend
cp .env.local.example .env.local

# 2. Backend (Swift Vapor + SQLite — auto-migrates on first run)
cd backend && swift run

# 3. Frontend
cd frontend && npm install && npm run dev
```

Required env vars: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `JWT_SECRET`,
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`,
`STRIPE_SECRET_KEY`, `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`.

Optional: `PIPEDRIVE_API_KEY`, `DEMO_JWT_TOKEN`, `ADMIN_API_KEY`.

## (Optional) Seed demo data

```bash
python scripts/seed_liontown.py   # seeds LionTown Marketing demo proposals
python scripts/seed_kb_articles.py  # populates support KB
```

## Running tests

```bash
# Backend (Swift)
cd backend && swift test

# Frontend (TypeScript check + build)
cd frontend && npm run type-check && npm run build
```

> PDF extraction tests require `pdftotext` (`brew install poppler` on macOS, `apt install poppler-utils` on Linux).
