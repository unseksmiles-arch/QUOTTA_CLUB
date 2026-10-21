-- QUOTTA v0.8. Execute UMA VEZ após as migrações 001-005.
-- Confirmação atômica, bloqueio de inadimplentes, rodízio por histórico.
-- Datas especiais: sábados, domingos, feriados nacionais fixos, Carnaval e Ano-Novo.
BEGIN;
CREATE OR REPLACE FUNCTION public.quotta_easter(p_year int) RETURNS date
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int; mm int; dd int;
BEGIN
 a:=p_year%19; b:=p_year/100; c:=p_year%100; d:=b/4; e:=b%4; f:=(b+8)/25; g:=(b-f+1)/3;
 h:=(19*a+b-d-g+15)%30; i:=c/4; k:=c%4; l:=(32+2*e+2*i-h-k)%7;
 m:=(a+11*h+22*l)/451; mm:=(h+l-7*m+114)/31; dd:=((h+l-7*m+114)%31)+1;
 RETURN make_date(p_year,mm,dd);
END $$;
CREATE OR REPLACE FUNCTION public.quotta_premium_kind(p_day date,p_company uuid,p_asset uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_easter date;
BEGIN
 v_easter:=public.quotta_easter(extract(year from p_day)::int);
 IF to_char(p_day,'MM-DD') IN ('12-31','01-01') THEN RETURN 'ano_novo'; END IF;
 IF p_day BETWEEN v_easter-48 AND v_easter-46 THEN RETURN 'carnaval'; END IF;
 IF EXISTS(SELECT 1 FROM public.calendar_events e WHERE e.company_id=p_company AND (e.asset_id IS NULL OR e.asset_id=p_asset)
  AND e.category IN ('holiday','premium') AND p_day BETWEEN (e.starts_at AT TIME ZONE 'America/Sao_Paulo')::date AND ((e.ends_at-interval '1 second') AT TIME ZONE 'America/Sao_Paulo')::date) THEN RETURN 'feriado'; END IF;
 IF to_char(p_day,'MM-DD') IN ('04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25') OR p_day=v_easter-2 THEN RETURN 'feriado'; END IF;
 IF extract(isodow from p_day) IN (6,7) THEN RETURN 'fim_semana'; END IF;
 RETURN 'normal';
END $$;
REVOKE ALL ON FUNCTION public.quotta_premium_kind(date,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quotta_premium_kind(date,uuid,uuid) TO authenticated;

-- Apenas o banco decide se uma reserva pode ser confirmada.
-- Uma solicitação comum confirma imediatamente; uma data especial entra em rodada.
CREATE OR REPLACE FUNCTION public.request_reservation(p_asset_id uuid,p_start timestamptz,p_end timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid(); a public.assets%rowtype; v_id uuid; v_date date; v_kind text;
 v_round uuid; v_deadline timestamptz; v_mins numeric; v_count int;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Faça login para reservar'; END IF;
 SELECT * INTO a FROM public.assets WHERE id=p_asset_id AND active;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.asset_shares WHERE asset_id=a.id AND company_id=a.company_id AND user_id=v_user AND active) THEN RAISE EXCEPTION 'Sem cota ativa'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a.id::text,0));
 PERFORM public.assert_monthly_due_current(a.id,v_user);
 IF p_start IS NULL OR p_end IS NULL OR p_start < now()-interval '1 minute' OR p_end<=p_start THEN RAISE EXCEPTION 'Período inválido'; END IF;
 v_mins:=extract(epoch FROM (p_end-p_start))/60;
 IF a.kind<>'jetski' THEN RAISE EXCEPTION 'Reserva automática disponível inicialmente para jet skis'; END IF;
 IF v_mins<60 OR v_mins>660 OR mod(v_mins::int,60)<>0 THEN RAISE EXCEPTION 'Escolha de 1 a 11 horas inteiras'; END IF;
 v_date:=(p_start AT TIME ZONE a.timezone)::date;
 IF ((p_end-interval '1 second') AT TIME ZONE a.timezone)::date<>v_date
 OR (p_start AT TIME ZONE a.timezone)::time<a.opens_at
 OR (p_end AT TIME ZONE a.timezone)::time>a.closes_at
 OR extract(minute from (p_start AT TIME ZONE a.timezone))<>0 THEN RAISE EXCEPTION 'Fora do horário permitido (07h às 18h)'; END IF;
 IF EXISTS(SELECT 1 FROM public.calendar_events e WHERE e.company_id=a.company_id AND (e.asset_id IS NULL OR e.asset_id=a.id)
 AND e.category='maintenance' AND tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(p_start,p_end,'[)')) THEN RAISE EXCEPTION 'Embarcação em manutenção'; END IF;
 IF EXISTS(SELECT 1 FROM public.reservations r WHERE r.asset_id=a.id AND r.status='confirmed'
 AND tstzrange(r.start_at,r.end_at,'[)')&&tstzrange(p_start,p_end,'[)')) THEN RAISE EXCEPTION 'Horário já reservado'; END IF;
 v_kind:=public.quotta_premium_kind(v_date,a.company_id,a.id);
 IF v_kind='normal' THEN
  INSERT INTO public.reservations(company_id,asset_id,user_id,start_at,end_at,status)
  VALUES(a.company_id,a.id,v_user,p_start,p_end,'confirmed') RETURNING id INTO v_id;
  INSERT INTO public.audit_logs(company_id,actor_id,action,entity_type,entity_id,details)
  VALUES(a.company_id,v_user,'reservation.auto_confirmed','reservation',v_id,jsonb_build_object('type','normal'));
 ELSE
  -- Fechamento da rodada até 6h após primeiro pedido, sempre >= 1h antes do primeiro horário de uso do dia.
  v_deadline:=LEAST(now()+interval '6 hours',(v_date+a.opens_at) AT TIME ZONE a.timezone-interval '1 hour');
  IF v_deadline<=now() THEN RAISE EXCEPTION 'Prazo de pedidos FairShare encerrado para esta data'; END IF;
  INSERT INTO public.booking_rounds(company_id,asset_id,service_date,state,closes_at)
  VALUES(a.company_id,a.id,v_date,'open',v_deadline)
  ON CONFLICT(asset_id,service_date) DO NOTHING;
  SELECT id INTO v_round FROM public.booking_rounds WHERE asset_id=a.id AND service_date=v_date AND state='open' AND closes_at>now();
  IF v_round IS NULL THEN RAISE EXCEPTION 'Rodada FairShare encerrada para esta data'; END IF;
  INSERT INTO public.booking_claims(round_id,company_id,asset_id,user_id,start_at,end_at,state)
  VALUES(v_round,a.company_id,a.id,v_user,p_start,p_end,'submitted')
  ON CONFLICT(round_id,user_id) DO UPDATE SET start_at=excluded.start_at,end_at=excluded.end_at,state='submitted',created_at=now()
  RETURNING id INTO v_id;
  INSERT INTO public.audit_logs(company_id,actor_id,action,entity_type,entity_id,details)
  VALUES(a.company_id,v_user,'fairshare.submitted','booking_claim',v_id,jsonb_build_object('category',v_kind,'round',v_round));
 END IF;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.request_reservation(uuid,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_reservation(uuid,timestamptz,timestamptz) TO authenticated;

-- Processamento idempotente e serializado. Ordena por MENOR uso da categoria nos últimos 365 dias,
-- depois menor uso em todas as datas especiais, depois menor uso total; desempate pela hora do pedido.
-- Não divide pedidos: cada cotista recebe todo o intervalo solicitado ou é colocado na fila de não contemplados.
CREATE OR REPLACE FUNCTION public.process_fairshare_rounds()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record; c record; v_id uuid; v_processed int:=0; v_kind text;
BEGIN
 FOR r IN SELECT br.* FROM public.booking_rounds br WHERE br.state='open' AND br.closes_at<=now() ORDER BY br.closes_at FOR UPDATE SKIP LOCKED LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(r.asset_id::text,0));
  v_kind:=public.quotta_premium_kind(r.service_date,r.company_id,r.asset_id);
  FOR c IN
   SELECT bc.* FROM public.booking_claims bc
   LEFT JOIN LATERAL (
    SELECT
     coalesce(sum(extract(epoch from (rr.end_at-rr.start_at))/60) FILTER (WHERE public.quotta_premium_kind((rr.start_at AT TIME ZONE 'America/Sao_Paulo')::date,rr.company_id,rr.asset_id)=v_kind),0) category_mins,
     coalesce(sum(extract(epoch from (rr.end_at-rr.start_at))/60) FILTER (WHERE public.quotta_premium_kind((rr.start_at AT TIME ZONE 'America/Sao_Paulo')::date,rr.company_id,rr.asset_id)<>'normal'),0) premium_mins,
     coalesce(sum(extract(epoch from (rr.end_at-rr.start_at))/60),0) total_mins
    FROM public.reservations rr WHERE rr.asset_id=r.asset_id AND rr.user_id=bc.user_id
     AND rr.status IN ('confirmed','completed') AND rr.start_at>=now()-interval '365 days'
   ) usage ON true
   WHERE bc.round_id=r.id AND bc.state='submitted'
   ORDER BY usage.category_mins,usage.premium_mins,usage.total_mins,bc.created_at,bc.id
  LOOP
   IF NOT EXISTS(SELECT 1 FROM public.asset_shares s WHERE s.asset_id=r.asset_id AND s.user_id=c.user_id AND s.active)
    OR NOT EXISTS(SELECT 1 FROM public.monthly_dues d WHERE d.asset_id=r.asset_id AND d.user_id=c.user_id AND d.billing_month=date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo')::date AND d.status='paid')
    OR EXISTS(SELECT 1 FROM public.monthly_dues d WHERE d.asset_id=r.asset_id AND d.user_id=c.user_id AND d.billing_month<date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo')::date AND d.status='pending')
    OR EXISTS(SELECT 1 FROM public.reservations x WHERE x.asset_id=r.asset_id AND x.status='confirmed' AND tstzrange(x.start_at,x.end_at,'[)')&&tstzrange(c.start_at,c.end_at,'[)'))
    OR EXISTS(SELECT 1 FROM public.calendar_events e WHERE e.company_id=r.company_id AND (e.asset_id IS NULL OR e.asset_id=r.asset_id) AND e.category='maintenance' AND tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(c.start_at,c.end_at,'[)'))
   THEN UPDATE public.booking_claims SET state='not_allocated' WHERE id=c.id;
   ELSE
    INSERT INTO public.reservations(company_id,asset_id,user_id,start_at,end_at,status)
    VALUES(r.company_id,r.asset_id,c.user_id,c.start_at,c.end_at,'confirmed') RETURNING id INTO v_id;
    UPDATE public.booking_claims SET state='allocated' WHERE id=c.id;
    INSERT INTO public.fairshare_allocations(round_id,claim_id,company_id,asset_id,user_id,start_at,end_at)
    VALUES(r.id,c.id,r.company_id,r.asset_id,c.user_id,c.start_at,c.end_at);
    INSERT INTO public.audit_logs(company_id,actor_id,action,entity_type,entity_id,details)
    VALUES(r.company_id,NULL,'fairshare.auto_confirmed','reservation',v_id,jsonb_build_object('round',r.id,'category',v_kind));
   END IF;
  END LOOP;
  UPDATE public.booking_rounds SET state='allocated' WHERE id=r.id;
  v_processed:=v_processed+1;
 END LOOP;
 RETURN v_processed;
END $$;
REVOKE ALL ON FUNCTION public.process_fairshare_rounds() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.process_fairshare_rounds() TO authenticated;
COMMIT;
