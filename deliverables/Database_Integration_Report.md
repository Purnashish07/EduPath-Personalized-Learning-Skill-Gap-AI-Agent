# EduPath Database Integration Report

## Status

### COMPLETED

- Replaced the process-wide in-memory data maps with a `UserRepository` interface and a PostgreSQL implementation. Active profile, document, skill-gap, learning-path, weekly-plan, task, practice, attempt, project, report, and chat routes now read or write through the repository.
- Scoped repository queries and writes by the identity returned from Supabase Auth token verification. The API does not trust a client-supplied `x-user-id`. Practice submission also verifies that the question belongs to the authenticated user.
- Parameterized SQL values and added transactions for multi-row gap/task updates, practice-result updates, message append, and user-data deletion.
- Kept memory storage as an explicit demo-only mode (`PERSISTENCE_MODE=memory` and `DEMO_MODE=true`). PostgreSQL mode requires a database URL and Supabase Auth configuration; database errors do not fall back to memory.
- Added ordered task/gap persistence, the `practice_questions` table, migration `003_persistent_user_data.sql`, environment examples, and fresh-install/legacy migration guidance.
- Added repository tests for create/read/update/delete, user isolation, persistence across repository instances, persisted learning records, and database failure behavior.
- Frontend and backend production builds passed. Backend unit tests passed: **7 passed, 1 skipped**. `git diff --check` passed. A source scan found no matching committed credential patterns.

### BLOCKED

- Real PostgreSQL verification could not run because `TEST_DATABASE_URL` is not configured. The opt-in PostgreSQL integration test was skipped. No production database was migrated or modified.
- Production environment variables were not changed and neither service was redeployed. This respects the requirement for approval before changing production configuration.

### NOT VERIFIED

- Data durability across an actual PostgreSQL server restart and cross-user isolation against two real authenticated users are **not verified**. The pg-mem unit tests and repository-instance test are not substitutes for the skipped real-PostgreSQL test.
- Live Supabase Auth sign-in/token verification and the new frontend sign-in flow were not exercised against a configured Supabase project.
- Production currently remains on its previously deployed build. The prior production health check reported demo mode and `database: false`; this work has not changed that deployment.

## Deployments

- Frontend: https://frontend-nu-henna-f3teo1ejli.vercel.app/
- Backend: https://backend-zeta-ochre-16.vercel.app/
- Backend health: https://backend-zeta-ochre-16.vercel.app/api/health

## Environment configuration

Backend production configuration:

```text
PERSISTENCE_MODE=postgres
DEMO_MODE=false
DATABASE_URL=<PostgreSQL connection string>
SUPABASE_URL=<Supabase project URL>
SUPABASE_ANON_KEY=<Supabase anon/public key>
FRONTEND_URL=<deployed frontend origin>
```

Frontend build configuration:

```text
VITE_SUPABASE_URL=<same Supabase project URL>
VITE_SUPABASE_ANON_KEY=<same Supabase anon/public key>
```

`LLM_API_KEY` is optional and backend-only. `TEST_DATABASE_URL` is only for local integration tests and must point to a disposable database whose name contains `test`, `testing`, or `qa`. The Supabase anon key is intended for browser use. **Never expose `DATABASE_URL`, LLM credentials, or a Supabase service-role key to frontend code.** The service-role key is not required by this integration.

## Migration instructions

### Fresh PostgreSQL or Supabase database

1. Create a database and keep its connection string on the backend only.
2. Apply [`database/schema.sql`](../database/schema.sql) using `psql` with `ON_ERROR_STOP=1`, or the Supabase SQL Editor.
3. Configure the backend and frontend variables above.
4. Deploy/restart the backend and verify `/api/health` reports PostgreSQL persistence and `database: true`.
5. Test sign-in and user separation before enabling real users.

### Existing legacy database

Back up the database, then apply [`database/migrations/003_persistent_user_data.sql`](../database/migrations/003_persistent_user_data.sql) once to a database created from legacy migrations 001/002. It aligns legacy user ID column types and adds missing persistence fields, ordering columns, indexes, and practice-question storage. Do not apply migration 003 after the fresh schema unless intentionally upgrading a legacy database.

## Validation results

| Check | Result |
|---|---|
| Frontend production build | Passed; Vite reports a 616 kB minified JS chunk-size warning |
| Backend production build | Passed |
| Backend unit tests | 7 passed, 0 failed |
| Real PostgreSQL integration test | Skipped; `TEST_DATABASE_URL` unavailable |
| Repository user-isolation/deletion tests | Passed with pg-mem |
| Database-failure test (no memory fallback) | Passed with pg-mem |
| `git diff --check` | Passed |
| Credential-pattern source scan | No matching patterns found in the scanned source/config files |
| Production migration, restart durability, live two-user test | Not run |

Dependency advisories identified in the earlier dependency audit have not been changed as part of this database integration. Review and remediate them separately before treating the overall application as production-secure.

## Changed implementation and documentation

- Backend: `backend/src/services/repository.ts`, `backend/src/store.ts`, `backend/src/routes/api.ts`, `backend/src/auth.ts`, `backend/src/db.ts`, `backend/src/middleware/error.ts`, and `backend/src/types/express.d.ts`
- Backend tests: `backend/tests/repository.test.ts` and `backend/tests/postgres.integration.test.ts`
- Database: `database/schema.sql` and `database/migrations/003_persistent_user_data.sql`
- Frontend auth: `frontend/src/lib/auth.ts`, `frontend/src/lib/api.ts`, and `frontend/src/main.tsx`
- Dependencies: `backend/package.json`/`backend/package-lock.json` and `frontend/package.json`/`frontend/package-lock.json`
- Configuration/docs: `.env.example`, `frontend/.env.example`, and `README.md`

No commit or push was made.
