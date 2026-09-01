create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text not null unique check (char_length(username) between 2 and 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

drop policy if exists "users can read own account" on public.users;
create policy "users can read own account" on public.users for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "users can create own account" on public.users;
create policy "users can create own account" on public.users for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "users can update own account" on public.users;
create policy "users can update own account" on public.users for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

grant select, insert, update on public.users to authenticated;
