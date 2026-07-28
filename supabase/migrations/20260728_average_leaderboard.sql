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

alter table public.simulation_attempts enable row level security;

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
