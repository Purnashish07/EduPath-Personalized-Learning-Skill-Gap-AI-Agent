# Database

`database/schema.sql` and `database/migrations/001_init.sql` define profiles, roles, documents, skill gaps, learning paths, weekly plans, tasks, progress, practice attempts, reports and chat messages. They are PostgreSQL-compatible and can be applied to Supabase SQL Editor.

The server accepts `DATABASE_URL`. The demo store remains available when it is omitted so the hackathon flow works offline.
