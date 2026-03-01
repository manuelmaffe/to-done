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

-- ============================================================
-- DELEGATION / SHARING
-- ============================================================

-- task_shares: links a task (owned by one user) to another user by email
create table public.task_shares (
  id                   uuid primary key default gen_random_uuid(),
  task_id              text references public.tasks(id) on delete cascade not null,
  owner_id             uuid references auth.users(id) on delete cascade not null,
  owner_email          text not null,
  owner_name           text,
  shared_with_email    text not null,
  shared_with_user_id  uuid references auth.users(id) on delete set null,
  created_at           timestamptz default now(),
  unique (task_id, shared_with_email)
);

alter table public.task_shares enable row level security;

-- Owner can do everything with their shares
create policy "owner manages shares"
  on public.task_shares for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Shared-with user can read their own shares
create policy "shared-with can read"
  on public.task_shares for select
  using (auth.uid() = shared_with_user_id);

-- Shared-with user can remove themselves (decline/unshare)
create policy "shared-with can delete"
  on public.task_shares for delete
  using (auth.uid() = shared_with_user_id);

create index task_shares_owner_idx       on public.task_shares (owner_id);
create index task_shares_shared_with_idx on public.task_shares (shared_with_user_id);
create index task_shares_task_idx        on public.task_shares (task_id);

-- Update tasks RLS to also allow shared-with users to read and update
drop policy "select own tasks" on public.tasks;
drop policy "update own tasks" on public.tasks;

create policy "select own or shared tasks"
  on public.tasks for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.task_shares ts
      where ts.task_id = id
        and ts.shared_with_user_id = auth.uid()
    )
  );

create policy "update own or shared tasks"
  on public.tasks for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.task_shares ts
      where ts.task_id = id
        and ts.shared_with_user_id = auth.uid()
    )
  );

-- RPC: find a user by email (security definer to access auth schema)
create or replace function find_user_by_email(email_input text)
returns table(user_id uuid, display_name text)
security definer
set search_path = public
language sql as $$
  select
    u.id as user_id,
    coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)) as display_name
  from auth.users u
  where u.email = email_input
  limit 1;
$$;

-- RPC: activate pending shares for the current logged-in user
-- Call this on login so tasks shared before signup appear automatically
create or replace function activate_pending_shares()
returns void
security definer
set search_path = public
language sql as $$
  update public.task_shares
  set shared_with_user_id = auth.uid()
  where shared_with_email = (select email from auth.users where id = auth.uid())
    and shared_with_user_id is null;
$$;

-- Migration: run these if tables already exist
-- create table if not exists public.task_shares (...);  -- use full definition above
-- select find_user_by_email('test@test.com');  -- verify RPC works
-- Run after dropping old policies:
-- drop policy if exists "select own tasks" on public.tasks;
-- drop policy if exists "update own tasks" on public.tasks;
-- Then run the new policies above.
