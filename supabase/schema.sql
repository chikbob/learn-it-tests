create extension if not exists citext;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 30),
  username_normalized citext not null unique,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists role text not null default 'user';

create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.leaderboard (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  average_grade integer not null default 0 check (average_grade between 0 and 100),
  simulation_score_sum integer not null default 0 check (simulation_score_sum >= 0),
  simulation_count integer not null default 0 check (simulation_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.leaderboard add column if not exists average_grade integer not null default 0;
alter table public.leaderboard add column if not exists simulation_score_sum integer not null default 0;
alter table public.leaderboard add column if not exists simulation_count integer not null default 0;

create table if not exists public.simulation_attempts (
  attempt_id bigint not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  grade integer not null check (grade between 1 and 100),
  created_at timestamptz not null default now(),
  primary key (user_id, attempt_id)
);

alter table public.profiles enable row level security;
alter table public.progress enable row level security;
alter table public.leaderboard enable row level security;
alter table public.simulation_attempts enable row level security;

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

create or replace function public.record_simulation_result(p_attempt_id bigint, p_grade integer)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  inserted_rows integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_grade < 1 or p_grade > 100 then raise exception 'Grade must be between 1 and 100'; end if;

  insert into public.simulation_attempts (attempt_id, user_id, grade)
  values (p_attempt_id, (select auth.uid()), p_grade)
  on conflict do nothing;
  get diagnostics inserted_rows = row_count;

  if inserted_rows = 1 then
    update public.leaderboard
    set simulation_score_sum = simulation_score_sum + p_grade,
        simulation_count = simulation_count + 1,
        average_grade = round((simulation_score_sum + p_grade)::numeric / (simulation_count + 1)),
        updated_at = now()
    where user_id = (select auth.uid());
  end if;
end;
$$;

revoke all on function public.record_simulation_result(bigint, integer) from public;
grant execute on function public.record_simulation_result(bigint, integer) to authenticated;

create or replace function public.get_admin_users()
returns table (
  user_id uuid,
  display_name text,
  email text,
  role text,
  joined_at timestamptz,
  sessions integer,
  accuracy integer,
  favorites integer,
  simulation_count integer,
  average_grade integer
)
language sql
security definer set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    u.email::text,
    p.role,
    p.created_at,
    coalesce((pr.data ->> 'sessions')::integer, 0),
    case when coalesce((pr.data ->> 'total')::integer, 0) > 0
      then round((pr.data ->> 'correct')::numeric / (pr.data ->> 'total')::numeric * 100)::integer
      else 0
    end,
    jsonb_array_length(coalesce(pr.data -> 'favorites', '[]'::jsonb)),
    coalesce(lb.simulation_count, 0),
    coalesce(lb.average_grade, 0)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.progress pr on pr.user_id = p.id
  left join public.leaderboard lb on lb.user_id = p.id
  where exists (
    select 1 from public.profiles administrator
    where administrator.id = (select auth.uid()) and administrator.role = 'admin'
  )
  order by p.created_at desc;
$$;

revoke all on function public.get_admin_users() from public;
grant execute on function public.get_admin_users() to authenticated;

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

update public.profiles
set role = 'admin'
where id = (select id from auth.users where lower(email) = 'admin@gmail.com' limit 1);
