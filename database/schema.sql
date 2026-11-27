create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id text unique not null,
  name text not null,
  education_status text,
  experience_level text,
  target_role text,
  career_goal text,
  study_minutes int default 120,
  learning_style text,
  areas_to_improve text[] default '{}',
  skills text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists roles (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  requirements jsonb not null
);

create table if not exists documents (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  filename text,
  mime_type text,
  extracted_text text,
  analysis jsonb,
  created_at timestamptz default now()
);

create table if not exists skill_gaps (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  sort_order int not null default 0,
  skill text,
  current_level int,
  required_level int,
  status text,
  priority text,
  reason text,
  action text,
  created_at timestamptz default now()
);

create table if not exists learning_paths (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  path jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists weekly_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  week_start date,
  plan jsonb not null,
  created_at timestamptz default now()
);

create table if not exists learning_tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  sort_order int not null default 0,
  title text,
  skill text,
  minutes int,
  status text default 'todo',
  difficulty text,
  notes text,
  remedial boolean default false,
  due_date date,
  created_at timestamptz default now()
);

create table if not exists progress_records (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  metric text,
  value numeric,
  metadata jsonb,
  created_at timestamptz default now()
);

create table if not exists practice_attempts (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  question_id text,
  skill text,
  score numeric,
  mistakes jsonb,
  created_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  projects jsonb not null,
  created_at timestamptz default now()
);

create table if not exists reports (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  report jsonb not null,
  created_at timestamptz default now()
);

create table if not exists chat_messages (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  role text,
  content text,
  metadata jsonb,
  created_at timestamptz default now()
);

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
