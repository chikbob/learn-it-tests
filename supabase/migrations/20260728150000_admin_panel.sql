alter table public.profiles
  add column if not exists role text not null default 'user';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'admin'));

update public.profiles
set role = 'admin'
where id = (select id from auth.users where lower(email) = 'admin@gmail.com' limit 1);

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
