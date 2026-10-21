-- QUOTTA v0.4 - Comprovantes Pix (envio nao confirma pagamento).
create table public.payment_receipts (
 id uuid primary key default gen_random_uuid(),
 due_id uuid not null references public.monthly_dues(id) on delete cascade,
 company_id uuid not null references public.companies(id),
 user_id uuid not null references auth.users(id),
 storage_path text not null unique,
 original_filename text not null,
 content_type text not null check(content_type in ('application/pdf','image/jpeg','image/png','image/webp')),
 size_bytes bigint not null check(size_bytes > 0 and size_bytes <= 5242880),
 status text not null default 'pending' check(status in ('pending','reviewed','rejected')),
 submitted_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 review_note text
);
create index payment_receipts_due_idx on public.payment_receipts(due_id,submitted_at desc);
alter table public.payment_receipts enable row level security;
create policy receipts_read on public.payment_receipts for select to authenticated using (
 user_id=(select auth.uid()) or exists (select 1 from public.company_members m where m.company_id=payment_receipts.company_id and m.user_id=(select auth.uid()) and m.role='admin')
);
-- Bucket privado: nenhum arquivo e publico por URL direta.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pix-receipts','pix-receipts',false,5242880,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
-- Caminho: <user_uuid>/<due_uuid>/<random_uuid>.<ext>
create policy pix_receipt_upload on storage.objects for insert to authenticated with check (
 bucket_id='pix-receipts' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.monthly_dues d where d.id::text=(storage.foldername(name))[2] and d.user_id=(select auth.uid()) and d.status='pending')
);
create policy pix_receipt_read on storage.objects for select to authenticated using (
 bucket_id='pix-receipts' and exists (
 select 1 from public.payment_receipts r where r.storage_path=name and (
 r.user_id=(select auth.uid()) or exists(select 1 from public.company_members m where m.company_id=r.company_id and m.user_id=(select auth.uid()) and m.role='admin')
 )))
);
-- Registro validado no servidor; evita forjar titularidade ou confirmar pagamento.
create function public.submit_pix_receipt(p_due uuid,p_path text,p_filename text,p_type text,p_size bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare d public.monthly_dues%rowtype; v_id uuid;
begin
 select * into d from public.monthly_dues where id=p_due;
 if not found or d.user_id is distinct from auth.uid() or d.status<>'pending' then raise exception 'Mensalidade indisponivel para comprovante'; end if;
 if p_path is null or split_part(p_path,'/',1)<>auth.uid()::text or split_part(p_path,'/',2)<>p_due::text or
    array_length(string_to_array(p_path,'/'),1)<>3 then raise exception 'Caminho invalido'; end if;
 if p_type not in ('application/pdf','image/jpeg','image/png','image/webp') or p_size is null or p_size<1 or p_size>5242880 then raise exception 'Arquivo invalido'; end if;
 if not exists(select 1 from storage.objects where bucket_id='pix-receipts' and name=p_path) then raise exception 'Arquivo nao encontrado'; end if;
 insert into public.payment_receipts(due_id,company_id,user_id,storage_path,original_filename,content_type,size_bytes)
 values(p_due,d.company_id,auth.uid(),p_path,left(coalesce(p_filename,'comprovante'),180),p_type,p_size) returning id into v_id;
 insert into public.audit_logs(company_id,actor_id,action,entity_type,entity_id,details)
 values(d.company_id,auth.uid(),'pix.receipt_submitted','monthly_due',p_due,jsonb_build_object('receipt_id',v_id));
 return v_id;
end $$;
revoke all on function public.submit_pix_receipt(uuid,text,text,text,bigint) from public;
grant execute on function public.submit_pix_receipt(uuid,text,text,text,bigint) to authenticated;
create function public.review_pix_receipt(p_receipt uuid,p_approve boolean,p_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare r public.payment_receipts%rowtype;
begin
 select * into r from public.payment_receipts where id=p_receipt for update;
 if not found or not exists(select 1 from public.company_members m where m.company_id=r.company_id and m.user_id=auth.uid() and m.role='admin') then raise exception 'Acesso negado'; end if;
 if r.status<>'pending' then raise exception 'Comprovante ja analisado'; end if;
 if p_approve and not exists(select 1 from public.monthly_dues where id=r.due_id and status='pending') then raise exception 'Mensalidade nao esta pendente'; end if;
 update public.payment_receipts set status=case when p_approve then 'reviewed' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now(),review_note=left(coalesce(p_note,''),500) where id=p_receipt;
 if p_approve then perform public.confirm_monthly_due(r.due_id,'Pix - comprovante '||p_receipt::text); end if;
 insert into public.audit_logs(company_id,actor_id,action,entity_type,entity_id,details)
 values(r.company_id,auth.uid(),case when p_approve then 'pix.approved' else 'pix.rejected' end,'monthly_due',r.due_id,jsonb_build_object('receipt_id',p_receipt,'note',left(coalesce(p_note,''),500)));
end $$;
revoke all on function public.review_pix_receipt(uuid,boolean,text) from public;
grant execute on function public.review_pix_receipt(uuid,boolean,text) to authenticated;
