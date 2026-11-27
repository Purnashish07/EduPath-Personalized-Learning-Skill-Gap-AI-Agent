# EduPath - Personalized Learning & Skill Gap AI Agent

**Your AI-powered path from where you are to where you want to be.**

EduPath is a hackathon-ready full-stack AI career navigator. It turns a learner profile and evidence into skill gaps, an adaptive learning path, weekly actions, practice, portfolio projects, progress signals and a context-aware AI learning assistant.

## **Live Demo** 🌐

Public frontend: https://frontend-nu-henna-f3teo1ejli.vercel.app

Public backend: https://backend-zeta-ochre-16.vercel.app

Backend health verified: https://backend-zeta-ochre-16.vercel.app/api/health

## What is implemented
- React + TypeScript + Vite frontend with responsive premium UI
- Express + TypeScript backend API
- PDF/DOCX/TXT parsing
- AI profile extraction and skill-gap analysis via configurable LLM endpoint
- Adaptive learning path and weekly plan generation
- Task completion and progress tracking
- Practice and personalized project generators
- Struggle/intervention logic and adaptive-loop UX
- Context-aware AI assistant
- PostgreSQL persistence with per-user data access
- Explicitly separate in-memory demo mode with realistic seed state
- Environment-based secrets and 8 MB upload limit

## Quick start
Requirements: Node.js 20+.

```bash
cp .env.example .env
npm install
npm run install:all
npm run dev
```
Frontend: http://localhost:5173
Backend: http://localhost:4000/api/health

## Real AI
Set `LLM_API_KEY`, optionally `LLM_API_URL` and `LLM_MODEL`. The key is read only by the backend. The app accepts any OpenAI-compatible chat-completions API that returns JSON content.

## PostgreSQL / Supabase
The backend has two explicit storage modes:

- `PERSISTENCE_MODE=postgres` requires `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`. Requests must include a valid Supabase access token; the backend verifies it with Supabase Auth and uses the returned user ID for repository queries. A database connection or query failure returns an error; it never falls back to memory.
- `PERSISTENCE_MODE=memory` is only allowed with `DEMO_MODE=true`. It uses the fixed demo identity and is not durable or suitable for production accounts.

For a fresh PostgreSQL or Supabase database:

1. Create a database and configure a server-side `DATABASE_URL`.
2. Run `database/schema.sql` (for example, `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql`, or paste the SQL into the Supabase SQL Editor).
3. Configure backend `PERSISTENCE_MODE=postgres`, `DEMO_MODE=false`, `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`, then deploy/restart the backend.
4. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the frontend build environment and enable the desired Supabase Auth providers.
5. Check `/api/health`; PostgreSQL mode must report `database.connected: true`.

For an existing database created from legacy migrations 001/002, back up the database, then apply `database/migrations/003_persistent_user_data.sql` once. Do not apply that legacy migration to a fresh database that already uses `database/schema.sql`. The migration aligns legacy UUID user IDs to text and adds persistence fields/table.

`DATABASE_URL` and all LLM credentials are backend-only. The Supabase anon key is intended for the frontend; never put a Supabase service-role key or database credentials in frontend variables or source code. The backend currently uses Supabase Auth for identity verification and does not require the service-role key.

## Environment
See `.env.example`:
- `PORT`
- `FRONTEND_URL`
- `DEMO_MODE`
- `PERSISTENCE_MODE`
- `LLM_API_URL`
- `LLM_API_KEY`
- `LLM_MODEL`
- `DATABASE_URL`
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` (backend auth verification)

The frontend Supabase variables are documented in `frontend/.env.example`.

## Demo mode
No credentials are required when explicitly configured with `PERSISTENCE_MODE=memory` and `DEMO_MODE=true`. The backend seeds an Alex Morgan learner when `/api/auth/demo` is called. Demo data is in memory and lost on restart; it is clearly labeled in the UI and is not real authentication.

## Database tests
Run backend unit tests with `npm --prefix backend test`. A real PostgreSQL integration test is opt-in: create a disposable database whose name contains `test`, `testing`, or `qa`, apply `database/schema.sql`, set `TEST_DATABASE_URL` only in the local test environment, and run `npm --prefix backend run test:integration`. It writes and deletes test records in that database.

## API highlights
`POST /api/profile`, `POST /api/documents/upload`, `POST /api/skill-gap/analyze`, `POST /api/learning-path/generate`, `POST /api/weekly-plan/generate`, `PATCH /api/tasks/:id`, `POST /api/practice/generate`, `POST /api/practice/:id/submit`, `POST /api/projects/generate`, `GET /api/progress`, `POST /api/reports/generate`, `POST /api/chat`.

## Testing/build
`npm run build` builds both frontend and backend. `npm run dev` runs both concurrently.

## Hackathon story
INPUT â†’ UNDERSTAND â†’ FIND GAPS â†’ PLAN â†’ LEARN â†’ MEASURE â†’ ADAPT.
