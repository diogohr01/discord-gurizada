-- A login must identify one account regardless of letter casing.
alter table public.users
  add column if not exists username_key text generated always as (lower(username)) stored;

create unique index if not exists users_username_key_uidx
  on public.users (username_key);
