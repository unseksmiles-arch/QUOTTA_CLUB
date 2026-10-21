-- QUOTTA schema: run in Supabase SQL editor. UTC timestamptz, [start,end) intervals.
create extension if not exists btree_gist;
create table public.companies(id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table public.company_members(company_id uuid not null references public.companies on delete cascade,user_id uuid not null references auth.users on delete cascade,role text not null check(role in ('admin','member')),primary key(company_id,user_id));
create table public.assets(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies on delete cascade,name text not null,kind text not null check(kind in ('jetski','lancha','car')),slot_minutes int not null default 60 check(slot_minutes>0),timezone text not null default 'America/Sao_Paulo',active boolean not null default true,created_at timestamptz not null default now(),unique(id,company_id));
create table public.asset_shares(id uuid primary key default gen_random_uuid(),company_id uuid not null,user_id uuid not null,asset_id uuid not null,active boolean not null default true,created_at timestamptz not null default now(),foreign key(company_id,user_id) references public.company_members(company_id,user_id),foreign key(asset_id,company_id) references public.assets(id,company_id),unique(asset_id,user_id));
create table public.reservations(id uuid primary key default gen_random_uuid(),company_id uuid not null,asset_id uuid not null,user_id uuid not null,start_at timestamptz not null,end_at timestamptz not null,status text not null default 'requested' check(status in ('requested','confirmed','cancelled','rejected','completed')),created_at timestamptz not null default now(),check(end_at>start_at),foreign key(asset_id,company_id) references public.assets(id,company_id),foreign key(company_id,user_id) references public.company_members(company_id,user_id));
alter table public.reservations add constraint no_confirmed_overlap exclude using gist(asset_id with =,tstzrange(start_at,end_at,'[)') with &&) where(status='confirmed');
create table public.calendar_events(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies on delete cascade,asset_id uuid references public.assets(id),name text not null,starts_at timestamptz not null,ends_at timestamptz not null,category text not null check(category in ('holiday','premium','maintenance')),check(ends_at>starts_at));
create table public.usage_ledger(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies,asset_id uuid not null references public.assets,user_id uuid not null references auth.users,minutes_delta int not null,reason text not null,reservation_id uuid references public.reservations,created_at timestamptz not null default now());
create table public.priority_ledger(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies,asset_id uuid not null references public.assets,user_id uuid not null references auth.users,category text not null,priority_delta int not null,reason text not null,reservation_id uuid references public.reservations,created_at timestamptz not null default now());
create table public.swap_requests(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies,from_reservation uuid not null references public.reservations,to_reservation uuid references public.reservations,requested_by uuid not null references auth.users,recipient_id uuid not null references auth.users,status text not null default 'proposed' check(status in ('proposed','accepted','rejected','expired','cancelled')),created_at timestamptz not null default now());
create table public.audit_logs(id bigint generated always as identity primary key,company_id uuid not null references public.companies,actor_id uuid references auth.users,action text not null,entity_type text not null,entity_id uuid,details jsonb not null default '{}',created_at timestamptz not null default now());
create index reservations_asset_time_idx on public.reservations(asset_id,start_at,end_at);
create index asset_shares_user_idx on public.asset_shares(user_id,active);
create index usage_ledger_asset_user_idx on public.usage_ledger(asset_id,user_id);
create index priority_ledger_asset_user_idx on public.priority_ledger(asset_id,user_id);
-- RLS: members can only read their company; write through audited SECURITY DEFINER functions.
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.assets enable row level security;
alter table public.asset_shares enable row level security;
alter table public.reservations enable row level security;
alter table public.calendar_events enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.priority_ledger enable row level security;
alter table public.swap_requests enable row level security;
alter table public.audit_logs enable row level security;
create function public.is_company_member(p_company uuid) returns boolean language sql security definer stable set search_path='' as $$ select exists(select 1 from public.company_members where company_id=p_company and user_id=(select auth.uid())) $$;
revoke all on function public.is_company_member(uuid) from public;
grant execute on function public.is_company_member(uuid) to authenticated;
create policy companies_read on public.companies for select to authenticated using(public.is_company_member(id));
create policy members_read on public.company_members for select to authenticated using(public.is_company_member(company_id));
create policy assets_read on public.assets for select to authenticated using(public.is_company_member(company_id));
create policy shares_read on public.asset_shares for select to authenticated using(public.is_company_member(company_id));
create policy reservations_read on public.reservations for select to authenticated using(public.is_company_member(company_id));
create policy events_read on public.calendar_events for select to authenticated using(public.is_company_member(company_id));
create policy usage_read on public.usage_ledger for select to authenticated using(public.is_company_member(company_id));
create policy priority_read on public.priority_ledger for select to authenticated using(public.is_company_member(company_id));
create policy swaps_read on public.swap_requests for select to authenticated using(public.is_company_member(company_id));
create policy audit_read on public.audit_logs for select to authenticated using(exists(select 1 from public.company_members where company_id=audit_logs.company_id and user_id=(select auth.uid()) and role='admin'));
-- Requests: only the caller's active share; use database RPC rather than client INSERT.
create function public.request_reservation(p_asset_id uuid,p_start timestamptz,p_end timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_company uuid;v_id uuid;v_kind text;v_minutes numeric;
begin
 if v_user is null then raise exception 'Não autenticado'; end if;
 if p_start is null or p_end is null or p_start<now()-interval '1 minute' or p_end<=p_start or p_end>p_start+interval '7 days' then raise exception 'Período inválido'; end if;
 select a.company_id,a.kind into v_company,v_kind from public.assets a join public.asset_shares s on s.asset_id=a.id and s.company_id=a.company_id where a.id=p_asset_id and a.active and s.user_id=v_user and s.active;
 if v_company is null then raise exception 'Sem cota ativa para este bem'; end if;
 v_minutes:=extract(epoch from(p_end-p_start))/60;
 if (v_kind='jetski' and (v_minutes not in(60,120,240) or (p_start at time zone 'America/Sao_Paulo')::date<>((p_end-interval '1 second') at time zone 'America/Sao_Paulo')::date)) or (v_kind='lancha' and v_minutes<>1440) or (v_kind='car' and (v_minutes<1440 or mod(v_minutes,1440)<>0)) then raise exception 'Duração incompatível com o tipo de bem'; end if;
 if exists(select 1 from public.reservations where asset_id=p_asset_id and status='confirmed' and tstzrange(start_at,end_at,'[)')&&tstzrange(p_start,p_end,'[)')) then raise exception 'Período já reservado'; end if;
 if exists(select 1 from public.calendar_events where company_id=v_company and (asset_id is null or asset_id=p_asset_id) and category='maintenance' and tstzrange(starts_at,ends_at,'[)')&&tstzrange(p_start,p_end,'[)')) then raise exception 'Bem em manutenção'; end if;
 insert into public.reservations(company_id,asset_id,user_id,start_at,end_at,status) values(v_company,p_asset_id,v_user,p_start,p_end,'requested') returning id into v_id;
 insert into public.audit_logs(company_id,actor_id,action,entity_type,entity_id) values(v_company,v_user,'reservation.requested','reservation',v_id);
 return v_id;
end $$;
revoke all on function public.request_reservation(uuid,timestamptz,timestamptz) from public;
grant execute on function public.request_reservation(uuid,timestamptz,timestamptz) to authenticated;
