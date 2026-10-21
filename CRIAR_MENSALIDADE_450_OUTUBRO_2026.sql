-- QUOTTA: lançar mensalidade de R$ 450,00 de outubro/2026 para cotistas ativos do Sea-Doo.
-- Execute no SQL Editor do Supabase. NÃO confirma pagamento.
-- Seguro para executar novamente: não duplica cobrança já existente.
insert into public.monthly_dues (company_id, asset_id, user_id, billing_month, amount, due_on)
select a.company_id, a.id, s.user_id, date '2026-10-01', 450.00, date '2026-10-31'
from public.assets a
join public.companies c on c.id=a.company_id
join public.asset_shares s on s.asset_id=a.id and s.active
where c.name='QUOTTA' and a.name='Sea-Doo Wake 170 — 2026' and a.active
on conflict(asset_id,user_id,billing_month) do nothing;
select d.billing_month,d.amount,d.due_on,d.status,a.name as bem
from public.monthly_dues d join public.assets a on a.id=d.asset_id
where a.name='Sea-Doo Wake 170 — 2026' and d.billing_month=date '2026-10-01';
