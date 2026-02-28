-- ============================================================
-- TO DONE — Supabase Schema
-- Run this in your Supabase project: SQL Editor → New query
-- ============================================================

-- Lists table (must be created before tasks references it)
create table public.lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  created_at timestamptz default now(),
  "order"    integer default 0
);

alter table public.lists enable row level security;

create policy "select own lists" on public.lists for select using (auth.uid() = user_id);
create policy "insert own lists" on public.lists for insert with check (auth.uid() = user_id);
create policy "update own lists" on public.lists for update using (auth.uid() = user_id);
create policy "delete own lists" on public.lists for delete using (auth.uid() = user_id);

create index lists_user_id_idx on public.lists (user_id);

-- Tasks table
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  list_id      uuid references public.lists(id) on delete set null,
  text         text not null,
  priority     text default 'medium' check (priority in ('high', 'medium', 'low')),
  minutes      integer default 30,
  done         boolean default false,
  done_at      timestamptz,
  created_at   timestamptz default now(),
  subtasks     jsonb default '[]'::jsonb,
  scheduled_for text,
  "order"      integer default 0
);

-- Row Level Security (users can only access their own tasks)
alter table public.tasks enable row level security;

create policy "select own tasks"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "insert own tasks"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "update own tasks"
  on public.tasks for update
  using (auth.uid() = user_id);

create policy "delete own tasks"
  on public.tasks for delete
  using (auth.uid() = user_id);

-- Indexes
create index tasks_user_id_idx  on public.tasks (user_id);
create index tasks_list_id_idx  on public.tasks (list_id);
create index tasks_order_idx    on public.tasks (user_id, "order");

-- Migration: add list_id to existing tasks table (run if table already exists)
-- alter table public.tasks add column if not exists list_id uuid references public.lists(id) on delete set null;
-- create index if not exists tasks_list_id_idx on public.tasks (list_id);
