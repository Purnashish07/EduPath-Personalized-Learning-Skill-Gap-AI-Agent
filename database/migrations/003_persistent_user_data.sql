begin;

-- Older initial schema versions used UUID user_id columns while the app used
-- text identifiers. Preserve existing rows and align every table for verified
-- auth user IDs and the explicitly isolated demo identity.
alter table profiles alter column user_id type text using user_id::text;
alter table documents alter column user_id type text using user_id::text;
alter table skill_gaps alter column user_id type text using user_id::text;
alter table learning_paths alter column user_id type text using user_id::text;
alter table weekly_plans alter column user_id type text using user_id::text;
alter table learning_tasks alter column user_id type text using user_id::text;
alter table progress_records alter column user_id type text using user_id::text;
alter table practice_attempts alter column user_id type text using user_id::text;
alter table reports alter column user_id type text using user_id::text;
alter table chat_messages alter column user_id type text using user_id::text;
alter table projects alter column user_id type text using user_id::text;

alter table profiles add column if not exists skills text[] not null default '{}';
alter table learning_tasks add column if not exists remedial boolean not null default false;
alter table learning_tasks add column if not exists sort_order integer not null default 0;
alter table skill_gaps add column if not exists sort_order integer not null default 0;
alter table practice_attempts add column if not exists question_id text;
alter table chat_messages add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists practice_questions (
  user_id text primary key,
  questions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists documents_user_created_idx on documents (user_id, created_at desc);
create index if not exists skill_gaps_user_idx on skill_gaps (user_id);
create index if not exists skill_gaps_user_order_idx on skill_gaps (user_id, sort_order, id);
create index if not exists learning_paths_user_created_idx on learning_paths (user_id, updated_at desc, created_at desc);
create index if not exists weekly_plans_user_created_idx on weekly_plans (user_id, created_at desc);
create index if not exists learning_tasks_user_created_idx on learning_tasks (user_id, created_at);
create index if not exists learning_tasks_user_order_idx on learning_tasks (user_id, sort_order, created_at, id);
create index if not exists practice_attempts_user_created_idx on practice_attempts (user_id, created_at);
create index if not exists projects_user_created_idx on projects (user_id, created_at desc);
create index if not exists reports_user_created_idx on reports (user_id, created_at desc);
create index if not exists chat_messages_user_created_idx on chat_messages (user_id, created_at, id);

commit;
