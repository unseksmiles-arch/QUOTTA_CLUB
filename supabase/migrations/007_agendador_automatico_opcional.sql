-- Execute APÓS 006. Exige extensão pg_cron habilitada no projeto Supabase.
-- Agendamento em background: processa rodadas a cada minuto, sem precisar abrir o site.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.schedule('quotta-fairshare-minutely','* * * * *','SELECT public.process_fairshare_rounds();');
