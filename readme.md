  To get running

  1. Copy .env.local.example → .env.local, fill in API keys
  2. Run supabase/migrations/001_initial_schema.sql in Supabase SQL editor
  3. python scripts/seed_liontown.py (seeds demo data)
  4. Backend: uvicorn main:app --reload (from backend/)
  5. Frontend: npm install && npm run dev (from frontend/)