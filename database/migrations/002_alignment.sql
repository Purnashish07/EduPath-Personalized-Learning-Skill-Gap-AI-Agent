-- Non-destructive alignment migration for existing EduPath databases
alter table if exists profiles add column if not exists skills text[] default '{}';
alter table if exists learning_tasks add column if not exists remedial boolean default false;
alter table if exists practice_attempts add column if not exists question_id text;
alter table if exists chat_messages add column if not exists metadata jsonb;

create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  projects jsonb not null,
  created_at timestamptz default now()
);
