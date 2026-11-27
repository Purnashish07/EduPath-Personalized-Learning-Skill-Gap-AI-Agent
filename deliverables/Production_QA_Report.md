# EduPath Production QA Report

**Run date:** 2026-11-27  
**Scope:** Public Production URLs and current repository worktree  
**Data used:** Synthetic demo learner and synthetic text resume only

## Production URLs

- Frontend: https://frontend-nu-henna-f3teo1ejli.vercel.app/
- Backend: https://backend-zeta-ochre-16.vercel.app/
- Health: https://backend-zeta-ochre-16.vercel.app/api/health
- GitHub: https://github.com/Purnashish07/EduPath-Personalized-Learning-Skill-Gap-AI-Agent

## Results

### Passed

- Frontend served successfully over HTTPS (HTTP 200); production page title and app shell loaded.
- Backend health returned `ok: true`, `mode: demo`, `database: false`.
- Frontend-to-backend CORS response included the production frontend origin.
- All 11 frontend dashboard GET endpoints returned HTTP 200: profile, skill gaps,
  learning path, weekly plan, tasks, practice, projects, progress, reports, chat,
  and documents.
- Demo sign-in returned the synthetic `demo-user`.
- Profile save and task status update returned successful responses.
- Production skill-gap analysis, learning-path generation, weekly-plan generation,
  project generation, and report generation returned successful responses.
- Public chat returned a demo-mode response. This confirms demo behavior only,
  not a live LLM integration.
- Uploaded synthetic `text/plain` resume content. The API returned HTTP 200 and
  extracted the exact test text; demo-mode analysis populated the response.
- Practice generation returned a question. Submitting a synthetic score of 85
  returned success and the expected non-struggle feedback.
- Browser checks at 1920x1080, 1024x768, and 390x844 reported no document
  horizontal overflow after the app finished loading.
- All ten visible app sections were opened in the production browser; the key
  views (dashboard, skill gaps, learning path, weekly plan, tasks, practice,
  projects, progress, assistant, and profile) rendered.
- During browser reload and section navigation: zero captured console errors,
  failed network requests, or HTTP responses >=400.
- `npm run build` passed for both Vite frontend and Express backend. Vite emitted
  a non-fatal bundle-size warning for a minified JavaScript chunk over 500 kB.
- `git diff --check` passed. `.env.local` and Vercel local environment files are
  ignored; `.env.example` is the only tracked `.env*` file. No common API-key or
  private-key patterns were found in source files.

### Failed

- No functional Production QA checks failed in the recorded run.

### Not verified / blocked

- Real LLM responses and provider connectivity: no `LLM_API_KEY` is configured;
  the observed assistant and generation responses used demo/fallback behavior.
- Durable database persistence: no database is configured (`database: false`).
  Runtime data uses in-memory maps, which are not durable across serverless
  executions.
- The PostgreSQL adapter and pool helper exist, but the active route handlers do
  not call the repository adapter. Merely adding `DATABASE_URL` will not make
  current user data persistent. The health endpoint reports whether a pool is
  configured, not the result of a database connectivity query.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are listed
  in the example file but are not consumed by active application code.
- PDF/DOCX parsing was not tested against Production; the synthetic TXT parser
  path was tested.
- Preview environment end-to-end browser integration and Vercel deployment logs
  were not independently reviewed here. The production URLs above were directly
  opened and tested.
- A production MP4, audio, and final waveform-synchronized subtitle timing were
  not generated. No recording or AI voice is claimed.

## Environment configuration and security

### Configured on deployed projects

- Frontend project `VITE_API_URL`: public API base URL pointing to the backend.
- Backend project `FRONTEND_URL`: allowed Production frontend origin.

These are configuration values, not credentials. The frontend API URL is
compiled into the browser bundle and must never contain a secret.

### Not available/configured for verified Production

For the backend Vercel project, configure as needed under **Settings →
Environment Variables**. Add separate Production and Preview values.

- `LLM_API_KEY`: required secret for live AI; backend only, never `VITE_*`.
- `LLM_API_URL`: optional OpenAI-compatible chat-completions endpoint; default
  is `https://api.openai.com/v1/chat/completions`.
- `LLM_MODEL`: optional provider model; default is `gpt-4o-mini`.
- `DEMO_MODE`: keep `true` for visible fallback; only set `false` after a valid
  key and provider are configured and tested.
- `LLM_TIMEOUT_MS`: optional backend request timeout (example default: 25000).
- `DATABASE_URL`: optional PostgreSQL connection string, but current routes need
  database persistence work before this alone will persist app state.
- `FRONTEND_URL`: exact comma-separated frontend origin(s) allowed by CORS.
- `ALLOW_VERCEL_PREVIEW_ORIGINS`: optional `true` only when preview origins are
  intentionally allowed; use the exact Preview frontend URL in Preview config.
- `PORT`: local server port; Vercel assigns the serverless runtime port.
- `VITE_API_URL`: frontend build-time API URL; set separately on the frontend
  Vercel project, using the Production backend URL for Production and an
  accessible Preview API for Preview.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: not required
  by active code today. Do not configure or expose the service-role key to the
  browser unless Supabase Auth/storage integration is deliberately implemented.

Never paste credentials into source code, README, terminal output, chat, or
video. After configuring `LLM_API_KEY`, verify a live response and its provider
metadata before advertising real AI. For database persistence, first connect
the route/service reads and writes to the repository, apply the schema/migrations
to a non-production test database, and verify read-after-write across separate
serverless invocations.

## Demo video handoff

- Storyboard and recording instructions: `deliverables/EduPath_Demo_Script.md`
- Voiceover: `deliverables/EduPath_Voiceover_Script.md`
- Subtitle timing draft: `deliverables/EduPath_Subtitles.srt`
- Thumbnail: `deliverables/EduPath_Thumbnail.png` (1280x720)
- MP4: not produced; do not treat the subtitle timing as audio-synchronized
  until genuine production UI footage and authorized AI narration are recorded.

## Repository / change safety

- Frontend and backend builds pass.
- No commit or push was performed.
- Review current `git status` before publishing; local `.vercel` project links
  and `.env.local` files are not included in the repository deliverables.
