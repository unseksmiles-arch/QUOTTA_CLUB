-- QUOTTA v0.2 - Execute AFTER 001_init.sql in Supabase SQL Editor.
-- Values are in BRL; allocation is a snapshot of active shares when expense is posted.
create function public.is_company_admin(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.company_members where company_id=p_company and user_id=(select auth.uid()) and role='admin');
$$;
revoke all on function public.is_company_admin(uuid) from public;
grant execute on function public.is_company_admin(uuid) to authenticated;

create table public.asset_incidents (
 id uuid primary key default gen_random_uuid(), company_id uuid not null, asset_id uuid not null,
 reservation_id uuid references public.reservations(id), reported_by uuid not null references auth.users(id),
 involved_user_id uuid references auth.users(id), happened_at timestamptz not null,
 description text not null check(length(trim(description)) >= 10),
 status text not null default 'reported' check(status in ('reported','investigating','resolved','closed')),
 created_at timestamptz not null default now(),
 foreign key(asset_id,company_id) references public.assets(id,company_id),
 foreign key(company_id,involved_user_id) references public.company_members(company_id,user_id),
 unique(id,company_id,asset_id)
);
create table public.asset_expenses (
 id uuid primary key default gen_random_uuid(), company_id uuid not null, asset_id uuid not null,
 incident_id uuid, category text not null check(category in ('preventive','revision','repair','cleaning','insurance','other')),
 description text not null check(length(trim(description))>=3), amount numeric(12,2) not null check(amount>=0),
 incurred_on date not null, allocation_type text not null check(allocation_type in ('shared','individual')),
 responsible_user_id uuid, responsibility_status text not null default 'not_applicable'
 check(responsibility_status in ('not_applicable','pending_review','accepted','disputed','confirmed')),
 evidence_notes text, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 foreign key(asset_id,company_id) references public.assets(id,company_id),
 foreign key(company_id,responsible_user_id) references public.company_members(company_id,user_id),
 foreign key(incident_id,company_id,asset_id) references public.asset_incidents(id,company_id,asset_id),
 check((allocation_type='shared' and responsible_user_id is null and responsibility_status='not_applicable') or
       (allocation_type='individual' and responsible_user_id is not null and responsibility_status in ('pending_review','accepted','disputed','confirmed'))),
 unique(id,company_id)
);
create table public.expense_allocations (
 id uuid primary key default gen_random_uuid(), expense_id uuid not null references public.asset_expenses(id),
 company_id uuid not null references public.companies(id), user_id uuid not null references auth.users(id),
 amount numeric(12,2) not null check(amount>=0), status text not null default 'pending'
 check(status in ('pending','paid','disputed','cancelled')),
 created_at timestamptz not null default now(), unique(expense_id,user_id),
 foreign key(company_id,user_id) references public.company_members(company_id,user_id)
);
create index asset_expenses_asset_date_idx on public.asset_expenses(asset_id,incurred_on desc);
create index expense_allocations_user_idx on public.expense_allocations(user_id,status);
create index asset_incidents_asset_idx on public.asset_incidents(asset_id,happened_at desc);

-- Allocate whole cents deterministically. Individual charges remain pending and are NOT
-- considered payable until responsibility is confirmed through a separate reviewed workflow.
create function public.allocate_expense() returns trigger language plpgsql security definer set search_path='' as $$
declare v_count integer; v_total_cents bigint; v_base bigint; v_extra bigint; v_idx bigint:=0; v_member record;
begin
 if new.allocation_type='individual' then
   insert into public.expense_allocations(expense_id,company_id,user_id,amount,status)
   values(new.id,new.company_id,new.responsible_user_id,new.amount,'pending');
 else
   select count(*) into v_count from public.asset_shares where asset_id=new.asset_id and company_id=new.company_id and active;
   if v_count=0 then raise exception 'Não existem cotistas ativos para rateio'; end if;
   v_total_cents:=round(new.amount*100)::bigint;
   v_base:=v_total_cents/v_count; v_extra:=mod(v_total_cents,v_count);
   for v_member in select user_id from public.asset_shares where asset_id=new.asset_id and company_id=new.company_id and active order by user_id loop
     insert into public.expense_allocations(expense_id,company_id,user_id,amount)
     values(new.id,new.company_id,v_member.user_id,(v_base+case when v_idx<v_extra then 1 else 0 end)/100.0);
     v_idx:=v_idx+1;
   end loop;
 end if;
 return new;
end $$;
create trigger expense_allocate_after_insert after insert on public.asset_expenses for each row execute function public.allocate_expense();

alter table public.asset_incidents enable row level security;
alter table public.asset_expenses enable row level security;
alter table public.expense_allocations enable row level security;
create policy incidents_select on public.asset_incidents for select to authenticated using(public.is_company_member(company_id));
create policy expenses_select on public.asset_expenses for select to authenticated using(public.is_company_member(company_id));
create policy allocations_select on public.expense_allocations for select to authenticated using(public.is_company_admin(company_id) or user_id=(select auth.uid()));
create policy incidents_admin_insert on public.asset_incidents for insert to authenticated
 with check(public.is_company_admin(company_id) and reported_by=(select auth.uid()));
create policy expenses_admin_insert on public.asset_expenses for insert to authenticated
 with check(public.is_company_admin(company_id) and created_by=(select auth.uid()));
-- No direct UPDATE/DELETE policies: changes to liability and payments need a reviewed,
-- auditable server-side workflow in the next iteration.
