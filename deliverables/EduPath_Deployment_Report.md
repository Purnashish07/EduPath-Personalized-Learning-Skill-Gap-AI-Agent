# EduPath Deployment Report

## Production URLs
- Frontend: https://frontend-nu-henna-f3teo1ejli.vercel.app
- Backend alias: https://backend-zeta-ochre-16.vercel.app
- Backend health: https://backend-zeta-ochre-16.vercel.app/api/health
- GitHub: https://github.com/Purnashish07/EduPath-Personalized-Learning-Skill-Gap-AI-Agent

## Architecture
Separate Vercel projects are used because the repository contains a Vite frontend and an Express TypeScript backend.

- Frontend project: `purnashish07s-projects/frontend`
- Backend project: `purnashish07s-projects/backend`
- Frontend API target: `VITE_API_URL=https://backend-zeta-ochre-16.vercel.app/api`
- Backend CORS origin: `https://frontend-nu-henna-f3teo1ejli.vercel.app`

## Environment configuration
Production variables:
- `VITE_API_URL`: frontend API endpoint
- `FRONTEND_URL`: backend CORS origin

The project has demo mode enabled by default. No `LLM_API_KEY`, `DATABASE_URL`, or Supabase credentials are configured or claimed to be working. `DEMO_MODE` should remain explicitly set to `true` until a real provider key is supplied.

## Verification
- Frontend public HTTP status: 200
- Backend public health HTTP status: 200
- CORS origin response: verified
- Public demo authentication: verified
- Public demo chat: verified with synthetic learner prompt
- Database health: `false`; demo/in-memory state is active

## Database and state
No public database credential is configured. Persistence is not claimed. Demo state is maintained in memory and may reset between serverless executions.
