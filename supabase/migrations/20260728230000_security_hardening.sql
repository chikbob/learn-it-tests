alter table public.progress
  drop constraint if exists progress_data_size_check;

alter table public.progress
  add constraint progress_data_size_check
  check (
    jsonb_typeof(data) = 'object'
    and octet_length(data::text) <= 524288
    and coalesce(jsonb_typeof(data -> 'sessions'), 'number') = 'number'
    and coalesce((data ->> 'sessions')::numeric, 0) between 0 and 1000000
    and coalesce(jsonb_typeof(data -> 'correct'), 'number') = 'number'
    and coalesce((data ->> 'correct')::numeric, 0) between 0 and 100000000
    and coalesce(jsonb_typeof(data -> 'total'), 'number') = 'number'
    and coalesce((data ->> 'total')::numeric, 0) between 0 and 100000000
    and coalesce(jsonb_typeof(data -> 'history'), 'array') = 'array'
    and coalesce(jsonb_typeof(data -> 'favorites'), 'array') = 'array'
    and coalesce(jsonb_typeof(data -> 'mistakes'), 'array') = 'array'
    and coalesce(jsonb_typeof(data -> 'pendingSimulations'), 'array') = 'array'
  );

alter table public.profiles
  drop constraint if exists profiles_display_name_safe_check;

alter table public.profiles
  add constraint profiles_display_name_safe_check
  check (char_length(display_name) between 2 and 30 and display_name !~ '[[:cntrl:]]');

create index if not exists simulation_attempts_user_created_idx
  on public.simulation_attempts (user_id, created_at desc);

create or replace function public.record_simulation_result(p_attempt_id bigint, p_grade integer)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  inserted_rows integer;
  recent_attempts integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_attempt_id < 1 or p_grade < 1 or p_grade > 100 then raise exception 'Invalid simulation result'; end if;

  perform pg_advisory_xact_lock(hashtext((select auth.uid())::text));
  if exists (
    select 1 from public.simulation_attempts
    where user_id = (select auth.uid()) and attempt_id = p_attempt_id
  ) then return; end if;
  select count(*) into recent_attempts
  from public.simulation_attempts
  where user_id = (select auth.uid()) and created_at > now() - interval '24 hours';
  if recent_attempts >= 100 then raise exception 'Daily simulation limit exceeded'; end if;

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

revoke all on function public.record_simulation_result(bigint, integer) from public, anon;
grant execute on function public.record_simulation_result(bigint, integer) to authenticated;

revoke all on function public.get_admin_users() from public, anon;
revoke all on function public.update_display_name(text) from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;
