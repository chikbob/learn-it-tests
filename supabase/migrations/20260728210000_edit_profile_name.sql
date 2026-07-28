alter table public.profiles
  drop constraint if exists profiles_username_normalized_key;

create or replace function public.update_display_name(p_display_name text)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  clean_name text := trim(p_display_name);
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if char_length(clean_name) < 2 or char_length(clean_name) > 30 then
    raise exception 'Display name must contain from 2 to 30 characters';
  end if;

  update public.profiles
  set display_name = clean_name,
      username_normalized = lower(clean_name)
  where id = (select auth.uid());

  update public.leaderboard
  set display_name = clean_name,
      updated_at = now()
  where user_id = (select auth.uid());

  return clean_name;
end;
$$;

revoke all on function public.update_display_name(text) from public;
grant execute on function public.update_display_name(text) to authenticated;
