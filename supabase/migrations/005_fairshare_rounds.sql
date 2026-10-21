-- QUOTTA v0.5: 8 equal shares; Sea-Doo Wake 170 2026; 07:00-18:00.
-- Run AFTER 001..004. Safe to re-run DDL where possible; no automatic asset creation without company ID.
alter table public.assets add column if not exists opens_at time not null default '07:00';
alter table public.assets add column if not exists closes_at time not null default '18:00';
alter table public.assets add column if not exists max_shares integer not null default 8 check(max_shares between 1 and 1000);
create table if not exists public.booking_rounds(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),asset_id uuid not null references public.assets(id),
 service_date date not null, state text not null default 'open' check(state in('open','closed','allocated')),
 closes_at timestamptz not null,created_at timestamptz not null default now(),unique(asset_id,service_date));
create table if not exists public.booking_claims(
 id uuid primary key default gen_random_uuid(),round_id uuid not null references public.booking_rounds(id),company_id uuid not null references public.companies(id),asset_id uuid not null references public.assets(id),
 user_id uuid not null references auth.users(id),start_at timestamptz not null,end_at timestamptz not null,
 state text not null default 'submitted' check(state in('submitted','allocated','not_allocated','cancelled')),
 created_at timestamptz not null default now(),check(end_at>start_at),unique(round_id,user_id));
create table if not exists public.fairshare_allocations(
 id uuid primary key default gen_random_uuid(),round_id uuid not null references public.booking_rounds(id),claim_id uuid not null references public.booking_claims(id),
 company_id uuid not null references public.companies(id),asset_id uuid not null references public.assets(id),user_id uuid not null references auth.users(id),
 start_at timestamptz not null,end_at timestamptz not null,created_at timestamptz not null default now(),check(end_at>start_at));
create index if not exists booking_claims_round_idx on public.booking_claims(round_id);
create index if not exists allocations_round_idx on public.fairshare_allocations(round_id);
alter table public.booking_rounds enable row level security;
alter table public.booking_claims enable row level security;
alter table public.fairshare_allocations enable row level security;
create policy rounds_read on public.booking_rounds for select to authenticated using(public.is_company_member(company_id));
create policy claims_read on public.booking_claims for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.company_members m where m.company_id=booking_claims.company_id and m.user_id=auth.uid() and m.role='admin'));
create policy allocations_read on public.fairshare_allocations for select to authenticated using(public.is_company_member(company_id));
-- Admin creates a round. The first asset is configured with 8 equal slots, but only active shareholders may submit.
create or replace function public.create_booking_round(p_asset uuid,p_date date,p_deadline timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_company uuid;v_round uuid;
begin
 select company_id into v_company from public.assets where id=p_asset and active;
 if v_company is null or not exists(select 1 from public.company_members where company_id=v_company and user_id=auth.uid() and role='admin') then raise exception 'Acesso negado';end if;
 if p_date< (now() at time zone 'America/Sao_Paulo')::date or p_deadline<=now() then raise exception 'Data ou prazo inválido';end if;
 insert into public.booking_rounds(company_id,asset_id,service_date,closes_at) values(v_company,p_asset,p_date,p_deadline)
 on conflict(asset_id,service_date) do update set closes_at=excluded.closes_at where booking_rounds.state='open'
 returning id into v_round;
 if v_round is null then raise exception 'Rodada já encerrada';end if;
 return v_round;
end $$;
revoke all on function public.create_booking_round(uuid,date,timestamptz) from public;
grant execute on function public.create_booking_round(uuid,date,timestamptz) to authenticated;
create or replace function public.submit_booking_claim(p_round uuid,p_start timestamptz,p_end timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.booking_rounds%rowtype;a public.assets%rowtype;v_id uuid;v_count integer;
begin
 select * into r from public.booking_rounds where id=p_round;
 if not found or r.state<>'open' or now()>=r.closes_at then raise exception 'Rodada encerrada';end if;
 select * into a from public.assets where id=r.asset_id and active;
 if a.id is null or a.kind<>'jetski' then raise exception 'Esta rodada é exclusiva de jet skis';end if;
 if not exists(select 1 from public.asset_shares where asset_id=r.asset_id and user_id=auth.uid() and active) then raise exception 'Sem cota ativa';end if;
 select count(*) into v_count from public.asset_shares where asset_id=r.asset_id and active;
 if v_count<>a.max_shares then raise exception 'Quantidade de cotistas ativos diferente da configuração de cotas';end if;
 perform public.assert_monthly_due_current(r.asset_id,auth.uid());
 if p_start is null or p_end is null or p_end<=p_start or mod(extract(epoch from(p_end-p_start))::integer,3600)<>0 then raise exception 'Solicite horas inteiras';end if;
 if (p_start at time zone a.timezone)::date<>r.service_date or (p_end-interval '1 second' at time zone a.timezone)::date<>r.service_date or (p_start at time zone a.timezone)::time<a.opens_at or (p_end at time zone a.timezone)::time>a.closes_at then raise exception 'Fora do horário de funcionamento';end if;
 insert into public.booking_claims(round_id,company_id,asset_id,user_id,start_at,end_at) values(r.id,r.company_id,r.asset_id,auth.uid(),p_start,p_end)
 on conflict(round_id,user_id) do update set start_at=excluded.start_at,end_at=excluded.end_at,created_at=now(),state='submitted' returning id into v_id;
 return v_id;
end $$;
revoke all on function public.submit_booking_claim(uuid,timestamptz,timestamptz) from public;
grant execute on function public.submit_booking_claim(uuid,timestamptz,timestamptz) to authenticated;
-- Allocation is deliberately PREVIEW-ONLY in v0.5: no insecure client-side confirmation.
-- Admin reviews the FairShare suggestion; confirmation requires a future locked DB procedure.
