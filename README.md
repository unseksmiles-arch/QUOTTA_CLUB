# QUOTTA MVP 0.1

Base executável para reservas de bens compartilhados: Next.js 15 + TypeScript + Supabase.

## Instalar
1. Instale Node.js 20+ (recomendado Node 22 LTS).
2. Crie um projeto em https://supabase.com/dashboard.
3. Abra **SQL Editor** no Supabase e execute `supabase/migrations/001_init.sql`.
4. Copie `.env.example` para `.env.local` e preencha a URL e a chave pública do Supabase (nunca use a `service_role` no navegador).
5. No terminal, execute `npm install` e `npm run dev`.
6. Acesse `http://localhost:3000`.

## Criar primeiro administrador e dados de teste
No Supabase: **Authentication > Users > Add user** e crie o usuário com email/senha. Copie seu UUID. Depois execute no SQL Editor, substituindo `SEU-UUID-AQUI` por esse UUID:

```sql
with c as (insert into public.companies(name) values('Minha Administradora') returning id),
m as (insert into public.company_members(company_id,user_id,role) select id,'SEU-UUID-AQUI'::uuid,'admin' from c returning company_id),
a as (insert into public.assets(company_id,name,kind) select company_id,'Lancha Phantom 300','lancha' from m returning id,company_id)
insert into public.asset_shares(company_id,user_id,asset_id) select company_id,'SEU-UUID-AQUI'::uuid,id from a;
```

Faça login. Você verá o calendário e poderá solicitar uma reserva (status `requested`).

## Estado atual — atenção
- **Implementado:** autenticação com Supabase, proteção básica de rota, schema com RLS, cadastro inicial via SQL, calendário responsivo, solicitação de reservas via RPC, prevenção de sobreposição para reservas **confirmadas**, histórico básico de auditoria, algoritmo demonstrativo de ranking FairShare.
- **Ainda não implementado:** painel administrativo CRUD, confirmação segura de reservas, atribuição automática FairShare com históricos reais, apuração automática de capacidade e saldos, feriados regionais, lista de espera, trocas, notificações, limites por contrato, fuso horário do bem na interface e fluxo de produção para rodadas de preferência.
- **Não use para administrar reservas reais ainda.** Uma solicitação fica pendente, e nenhuma função segura de confirmação está incluída. O preview FairShare é apenas ilustrativo.
- O calendário apresenta dias com reservas confirmadas, mas não faz cálculo de disponibilidade por hora. Horários no cliente usam o fuso local do navegador, não o fuso do bem. Há também restrições operacionais (horários de abertura e check-in) ainda não implementadas.
- Não há criação de contas aberta ao público; o primeiro usuário é criado pelo administrador no Supabase.

## Próxima fase
1. Definir período de apuração de direitos (mensal, trimestral ou anual), horários de operação e regras contratuais.
2. Criar funções SQL transacionais para confirmação de reservas e FairShare com bloqueio por bem/rodada.
3. Implementar tabelas `booking_policies`, `booking_rounds`, `booking_claims` e cálculo de quotas/saldos fracionários.
4. Criar painel administrativo, trocas, check-in, manutenção e notificações.
5. Testar isolamento multiempresa, concorrência e segurança antes de uso real.

## v0.2 — Financeiro e manutenção

Após a migração `001_init.sql`, execute `supabase/migrations/002_finance_maintenance.sql` no SQL Editor do Supabase. A página `/financeiro` exibe despesas dos bens acessíveis ao usuário e a parcela atribuída ao usuário. Administradores podem lançar despesas compartilhadas (rateio automático em centavos entre cotistas ativos) ou despesas individuais em análise. **Atribuição individual não representa cobrança exigível:** é necessária apuração, aceite/contestação e aprovação em fluxo futuro. O formulário inicial solicita o UUID do cotista; seleção por nome, upload de anexos, gestão de ocorrências, aprovação, pagamentos e notificações ficam para a próxima versão. Os dados são protegidos por RLS. Não use esta versão como sistema financeiro de produção sem testes e revisão contratual.


## v0.3 — Mensalidades e liberação de agendamento

Execute `supabase/migrations/003_monthly_payments.sql` após 001 e 002. Acesse `/mensalidades` como administrador para gerar mensalidades por bem e confirmar manualmente os pagamentos. Cotistas podem consultar suas próprias cobranças. **A partir desta migração, novas solicitações e confirmações de reserva ficam bloqueadas até a mensalidade do mês estar confirmada, e não pode haver meses anteriores pendentes.** Crie a mensalidade do mês para cada bem e confirme os pagamentos antes de testar reservas.

O sistema não processa pagamentos, não faz conciliação bancária e não altera automaticamente reservas já confirmadas quando ocorre inadimplência posterior. O painel ainda identifica cotistas por ID abreviado; melhorar para nome é uma próxima etapa. Regras de tolerância e suspensão de reservas existentes exigem decisão contratual.

## v0.4 — Comprovantes Pix e inicializador Windows

1. Rode as migracoes 001, 002, 003 e **004_pix_receipts.sql** em ordem no SQL Editor do Supabase (se ja rodou as anteriores, rode apenas 004).
2. Em `/mensalidades`, o cotista com mensalidade pendente pode anexar comprovante Pix em PDF, JPG, PNG ou WEBP (ate 5 MB).
3. O administrador ve os comprovantes em `/mensalidades`, abre um link temporario privado e aprova ou rejeita. **Antes de aprovar, confira o credito no banco**. Aprovar executa a confirmacao da mensalidade; apenas enviar arquivo NAO libera agendamento.
4. O bucket `pix-receipts` e privado. Arquivos sao vinculados a cotista e mensalidade, e a aprovacao e registrada em auditoria.
5. No Windows, clique duas vezes em **INICIAR_QUOTTA.bat** na pasta extraida. Ele verifica Node/npm, cria `.env.local` a partir do exemplo se necessario, instala dependencias e inicia `npm run dev` em http://localhost:3000. **Necessita internet para npm e Supabase; localhost executa apenas a interface/API Next.js, o banco permanece no Supabase.**

**Limites:** ainda nao ha Pix automatico, QR code, notificacoes nem conciliacao bancaria. Nao use para cobrancas reais sem testar permissoes, upload, reenvios, aprovacao e concorrencia em um projeto de homologacao. O upload pode deixar um arquivo orfao se o registro posterior falhar; limpe esses arquivos periodicamente. O sistema nao valida autenticidade de comprovantes.


## v0.5 — FairShare: rodadas de preferência (prévia administrativa)

1. Execute `supabase/migrations/005_fairshare_rounds.sql` **após** 001–004.
2. Para cadastrar o primeiro bem no Supabase, execute o SQL abaixo **após criar sua empresa/admin** (substitua o UUID da empresa):

```sql
insert into public.assets(company_id,name,kind,slot_minutes,opens_at,closes_at,max_shares)
values ('UUID-DA-SUA-EMPRESA'::uuid,'Sea-Doo Wake 170 — 2026','jetski',60,'07:00','18:00',8);
```

3. Vincule os **8 cotistas ativos** ao bem em `asset_shares` e gere/confirme as mensalidades antes de solicitar datas. Não há cadastro visual de bens/cotistas nesta versão.
4. Administrador: `/admin/fairshare` abre uma rodada para uma data e consulta a **simulação**. Cotistas: `/fairshare` enviam uma preferência de horário por rodada.
5. O simulador TypeScript `lib/fairshare/allocator.ts` divide períodos livres em blocos de 60 minutos, dando rodadas de oportunidade aos solicitantes com menor uso premium e total, sem limite individual fixo de horas. Isso é uma **prévia**: a distribuição não confirma reservas e ainda não considera saldos contratuais calculados, feriados, histórico completo de prioridade, turnos inferiores a 1 hora ou compensações.
6. A aprovação definitiva precisa de uma **transação SQL com lock por bem/dia**, revalidação de mensalidade, saldos e conflitos, e gravação de reservas/ledgers; **não utilize as sugestões como confirmações reais**.
7. O fuso é `America/Sao_Paulo` no MVP, apropriado para o primeiro bem. As preferências são armazenadas em UTC. O cliente de reservas antigo permanece independente e ainda tem limitações anteriores.

Teste local: `INICIAR_QUOTTA.bat` e `http://localhost:3000/admin/fairshare`.
