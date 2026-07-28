create extension if not exists citext;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 30),
  username_normalized citext not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.leaderboard (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  best_grade integer not null default 0 check (best_grade between 0 and 100),
  accuracy integer not null default 0 check (accuracy between 0 and 100),
  sessions integer not null default 0 check (sessions >= 0),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.progress enable row level security;
alter table public.leaderboard enable row level security;

drop policy if exists "profiles readable by authenticated users" on public.profiles;
drop policy if exists "users read own progress" on public.progress;
drop policy if exists "users insert own progress" on public.progress;
drop policy if exists "users update own progress" on public.progress;
drop policy if exists "leaderboard readable by everyone" on public.leaderboard;
drop policy if exists "users update own leaderboard row" on public.leaderboard;

create policy "profiles readable by authenticated users" on public.profiles for select to authenticated using (true);
create policy "users read own progress" on public.progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "users insert own progress" on public.progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users update own progress" on public.progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "leaderboard readable by everyone" on public.leaderboard for select to anon, authenticated using (true);
create policy "users update own leaderboard row" on public.leaderboard for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  generated_display_name text;
  generated_username text;
begin
  generated_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'user'
  );
  generated_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username_normalized'), ''),
    lower(generated_display_name) || '-' || left(new.id::text, 8)
  );

  insert into public.profiles (id, display_name, username_normalized)
  values (new.id, generated_display_name, generated_username);
  insert into public.progress (user_id) values (new.id);
  insert into public.leaderboard (user_id, display_name) values (new.id, generated_display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
