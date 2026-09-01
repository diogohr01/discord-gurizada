create table if not exists public.server_channels (
  id text not null,
  kind text not null check (kind in ('text', 'voice')),
  name text not null check (char_length(name) between 1 and 40),
  topic text not null unique,
  icon text check (icon in ('sound', 'game', 'sleep')),
  created_at timestamptz not null default now(),
  primary key (kind, id)
);

create table if not exists public.server_logs (
  id uuid primary key default gen_random_uuid(),
  admin text not null,
  action text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id text primary key,
  channel_id text,
  dm_identity text,
  author_identity text not null,
  author_name text not null check (char_length(author_name) between 1 and 32),
  text text not null check (char_length(text) between 1 and 2000),
  kind text not null default 'text' check (kind in ('text', 'thread', 'poll', 'file')),
  poll jsonb,
  file_name text,
  file_mime_type text,
  file_size bigint check (file_size is null or file_size between 1 and 10485760),
  storage_path text,
  created_at timestamptz not null default now(),
  constraint chat_messages_one_target check ((channel_id is not null) <> (dm_identity is not null)),
  constraint chat_messages_file_metadata check (
    (kind = 'file' and file_name is not null and file_mime_type is not null and file_size is not null and storage_path is not null)
    or kind <> 'file'
  )
);

create index if not exists chat_messages_channel_created_idx on public.chat_messages (channel_id, created_at desc);
create index if not exists chat_messages_dm_created_idx on public.chat_messages (dm_identity, created_at desc);
create index if not exists chat_messages_author_dm_created_idx on public.chat_messages (author_identity, dm_identity, created_at desc);
create index if not exists server_logs_created_idx on public.server_logs (created_at desc);

alter table public.server_channels enable row level security;
alter table public.server_logs enable row level security;
alter table public.chat_messages enable row level security;

-- The app keeps its own signed session cookie, so the Route Handlers are the
-- authorization boundary. These policies keep the publishable-key MVP usable;
-- set SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) on Vercel to bypass
-- Data API row policies from the server and prevent direct public mutations.
drop policy if exists "server channels api access" on public.server_channels;
create policy "server channels api access" on public.server_channels for all to anon, authenticated using (true) with check (true);

drop policy if exists "server logs api access" on public.server_logs;
create policy "server logs api access" on public.server_logs for all to anon, authenticated using (true) with check (true);

drop policy if exists "chat messages api access" on public.chat_messages;
create policy "chat messages api access" on public.chat_messages for all to anon, authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert on public.server_channels to anon, authenticated;
grant select, insert on public.server_logs to anon, authenticated;
grant select, insert on public.chat_messages to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-files', 'chat-files', false, 10485760, null)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "chat files api read" on storage.objects;
create policy "chat files api read" on storage.objects for select to anon, authenticated using (bucket_id = 'chat-files');

drop policy if exists "chat files api upload" on storage.objects;
create policy "chat files api upload" on storage.objects for insert to anon, authenticated with check (bucket_id = 'chat-files');

grant select, insert on storage.objects to anon, authenticated;
