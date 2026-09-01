create table if not exists public.profiles (
  profile_key text primary key check (char_length(profile_key) between 1 and 80),
  display_name text not null check (char_length(display_name) between 1 and 32),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles api access" on public.profiles;
create policy "profiles api access" on public.profiles for all to anon, authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[];

drop policy if exists "profile avatars api read" on storage.objects;
create policy "profile avatars api read" on storage.objects for select to anon, authenticated using (bucket_id = 'profile-avatars');

drop policy if exists "profile avatars api upload" on storage.objects;
create policy "profile avatars api upload" on storage.objects for insert to anon, authenticated with check (bucket_id = 'profile-avatars');

drop policy if exists "profile avatars api delete" on storage.objects;
create policy "profile avatars api delete" on storage.objects for delete to anon, authenticated using (bucket_id = 'profile-avatars');

grant select, insert, delete on storage.objects to anon, authenticated;
