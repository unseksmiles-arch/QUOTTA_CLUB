-- QUOTTA v0.3: monthly payments and booking eligibility. Run after 001 and 002.
create table public.monthly_dues (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id),
 asset_id uuid not null,
 user_id uuid not null,
 billing_month date not null check (extract(day from billing_month)=1),
 amount numeric(12,2) not null check(amount>=0),
 due_on date not null,
 status text not null default 'pending' check(status in ('pending','paid','void')),
 paid_at timestamptz,
 confirmed_by uuid references auth.users(id),
 payment_reference text,
 created_at timestamptz not null default now(),
 foreign key(asset_id,company_id) references public.assets(id,company_id),
 foreign key(asset_id,user_id) references public.asset_shares(asset_id,user_id),
 unique(asset_id,user_id,billing_month)
);
create index monthly_dues_lookup on public.monthly_dues(asset_id,user_id,billing_month,status);
alter table public.monthly_dues enable row level security;
create policy monthly_dues_read on public.monthly_dues for select to authenticated using(
 user_id=(select auth.uid()) or exists(select 1 from public.company_members m where m.company_id=monthly_dues.company_id and m.user_id=(select auth.uid()) and m.role='admin')
);
-- Admin-only audited RPC to issue monthly dues for all active shareholders.
create function public.issue_monthly_dues(p_asset uuid,p_month date,p_amount numeric,p_due date)
returns integer language plpgsql security definer set search_path='' as $$
declare v_company uuid; v_count integer;
begin
 select company_id into v_company from public.assets where id=p_asset and active;
 if v_company is null or not exists(select 1 from public.company_members where company_id=v_company and user_id=auth.uid() and role='admin') then raise exception 'Acesso negado'; end if;
 if p_month is null or extract(day from p_month)<>1 or p_amount is null or p_amount<0 or p_due is null then raise exception 'Parâmetros inválidos'; end if;
 insert into public.monthly_dues(company_id,asset_id,user_id,billing_month,amount,due_on)
 select v_company,p_asset,s.user_id,p_month,p_amount,p_due from public.asset_shares s where s.asset_id=p_asset and s.active
 on conflict(asset_id,user_id,billing_month) do nothing;
 get diagnostics v_count=row_count;
 insert into public.audit_logs(company_id,actor_id,action,entity_type,details) values(v_company,auth.uid(),'dues.issued','asset',jsonb_build_object('asset_id',p_asset,'month',p_month,'count',v_count));
 return v_count;
end $$;
revoke all on function public.issue_monthly_dues(uuid,date,numeric,date) from public;
grant execute on function public.issue_monthly_dues(uuid,date,numeric,date) to authenticated;
create function public.confirm_monthly_due(p_due uuid,p_reference text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_due public.monthly_dues%rowtype;
begin
 select * into v_due from public.monthly_dues where id=p_due for update;
 if not found or not exists(select 1 from public.company_members where company_id=v_due.company_id and user_id=auth.uid() and role='admin') then raise exception 'Acesso negado'; end if;
 if v_due.status='void' then raise exception 'Mensalidade anulada'; end if;
 if v_due.status='paid' then raise exception 'Mensalidade já confirmada'; end if;
 update public.monthly_dues set status='paid',paid_at=now(),confirmed_by=auth.uid(),payment_reference=nullif(left(trim(p_reference),250),'') where id=p_due;
 insert into public.audit_logs(company_id,actor_id,action,entity_type,entity_id,details) values(v_due.company_id,auth.uid(),'dues.paid','monthly_due',p_due,jsonb_build_object('asset_id',v_due.asset_id,'user_id',v_due.user_id,'amount',v_due.amount));
end $$;
revoke all on function public.confirm_monthly_due(uuid,text) from public;
grant execute on function public.confirm_monthly_due(uuid,text) to authenticated;
-- For any new booking, the cotista must have a confirmed payment for the current local month.
-- Also block when any prior non-void monthly due remains unpaid.
create function public.assert_monthly_due_current(p_asset uuid,p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_month date;
begin
 v_month:=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
 if not exists(select 1 from public.monthly_dues d where d.asset_id=p_asset and d.user_id=p_user and d.billing_month=v_month and d.status='paid') then
  raise exception 'Agendamento bloqueado: mensalidade atual não confirmada';
 end if;
 if exists(select 1 from public.monthly_dues d where d.asset_id=p_asset and d.user_id=p_user and d.billing_month<v_month and d.status='pending') then
  raise exception 'Agendamento bloqueado: existe mensalidade anterior pendente';
 end if;
end $$;
revoke all on function public.assert_monthly_due_current(uuid,uuid) from public,anon,authenticated;
-- Check also direct reservation status changes, not only requests via RPC.
create function public.check_reservation_payment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (tg_op='INSERT' and new.status in ('requested','confirmed')) or (tg_op='UPDATE' and new.status='confirmed' and old.status is distinct from 'confirmed') then
  perform public.assert_monthly_due_current(new.asset_id,new.user_id);
 end if;
 return new;
end $$;
create trigger reservations_payment_guard before insert or update of status on public.reservations for each row execute function public.check_reservation_payment();
