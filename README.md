# EduPath — Personalized Learning & Skill Gap AI Agent

**Your AI-powered path from where you are to where you want to be.**

EduPath is a hackathon-ready full-stack AI career navigator. It turns a learner profile and evidence into skill gaps, an adaptive learning path, weekly actions, practice, portfolio projects, progress signals and a context-aware AI learning assistant.

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
- PostgreSQL/Supabase-compatible schema and `DATABASE_URL` support
- Demo mode with realistic seed state
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
Set `DATABASE_URL` and run `database/schema.sql` in PostgreSQL/Supabase. The current demo store keeps the experience runnable without infrastructure; production persistence can be wired service-by-service using the provided schema and `db.ts` pool.

## Environment
See `.env.example`:
- `PORT`
- `FRONTEND_URL`
- `DEMO_MODE`
- `LLM_API_URL`
- `LLM_API_KEY`
- `LLM_MODEL`
- `DATABASE_URL`
- optional Supabase variables

## Demo mode
No credentials are required. The backend seeds an Alex Morgan learner when `/api/auth/demo` is called. This is clearly labeled in the UI. It is not presented as real authentication.

## API highlights
`POST /api/profile`, `POST /api/documents/upload`, `POST /api/skill-gap/analyze`, `POST /api/learning-path/generate`, `POST /api/weekly-plan/generate`, `PATCH /api/tasks/:id`, `POST /api/practice/generate`, `POST /api/practice/:id/submit`, `POST /api/projects/generate`, `GET /api/progress`, `POST /api/reports/generate`, `POST /api/chat`.

## Production authentication
The schema supports a `user_id` and the backend uses `x-user-id` for the demo. For deployment, replace this with verified Supabase JWT middleware and map `auth.users.id` to `profiles.user_id`. The frontend can then use Supabase Auth without exposing service-role credentials.

## Testing/build
`npm run build` builds both frontend and backend. `npm run dev` runs both concurrently.

## Hackathon story
INPUT → UNDERSTAND → FIND GAPS → PLAN → LEARN → MEASURE → ADAPT.
