import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Users, Wallet, CreditCard, CalendarDays, Anchor, Scale, ArrowLeft, AlertTriangle, TrendingUp, CheckCircle2 } from 'lucide-react';
import './admin-dashboard.css';

const brl = (n:number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
type Due = {id:string;company_id:string;asset_id:string;user_id:string;billing_month:string;amount:number;status:string;due_on:string;paid_at:string|null};
type Asset = {id:string;name:string;kind:string;active:boolean};
type Share = {asset_id:string;user_id:string;active:boolean};
type Booking = {id:string;status:string;start_at:string;asset_id:string};
type Expense = {amount:number;incurred_on:string;asset_id:string};
function monthKey(s:string){return s.slice(0,7)}
export default async function AdminDashboard({searchParams}:{searchParams:Promise<{company?:string}>}){
 const sb=await createClient();
 const {data:{user}}=await sb.auth.getUser(); if(!user)redirect('/login');
 const {data:members,error:membersError}=await sb.from('company_members').select('company_id,role').eq('user_id',user.id).eq('role','admin');
 if(membersError)throw new Error('Não foi possível verificar o acesso administrativo.');
 if(!members?.length)redirect('/dashboard');
 const params=await searchParams;
 const companyId=members.some(m=>m.company_id===params.company)?params.company!:members[0].company_id;
 const [companyRes,assetRes,shareRes,dueRes,bookingRes,expenseRes]=await Promise.all([
  sb.from('companies').select('name').eq('id',companyId).single(),
  sb.from('assets').select('id,name,kind,active').eq('company_id',companyId),
  sb.from('asset_shares').select('asset_id,user_id,active').eq('company_id',companyId),
  sb.from('monthly_dues').select('id,company_id,asset_id,user_id,billing_month,amount,status,due_on,paid_at').eq('company_id',companyId).order('billing_month',{ascending:false}).limit(5000),
  sb.from('reservations').select('id,status,start_at,asset_id').eq('company_id',companyId).order('start_at',{ascending:false}).limit(5000),
  sb.from('asset_expenses').select('amount,incurred_on,asset_id').eq('company_id',companyId).limit(5000)
 ]);
 const errors=[assetRes.error,shareRes.error,dueRes.error,bookingRes.error,expenseRes.error].filter(Boolean);
 if(errors.length)throw new Error('Erro ao carregar dados do painel. Confira as migrações e permissões no Supabase.');
 const assets=(assetRes.data??[]) as Asset[],shares=(shareRes.data??[]) as Share[],dues=(dueRes.data??[]) as Due[],bookings=(bookingRes.data??[]) as Booking[],expenses=(expenseRes.data??[]) as Expense[];
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),currentMonth=today.slice(0,7);
 const current=dues.filter(d=>monthKey(d.billing_month)===currentMonth),paid=current.filter(d=>d.status==='paid'),pending=current.filter(d=>d.status==='pending');
 const sum=(rows:{amount:number}[])=>rows.reduce((a,r)=>a+Number(r.amount||0),0);
 const received=sum(paid),receivable=sum(pending),overdue=pending.filter(d=>d.due_on<today),activeUsers=new Set(shares.filter(s=>s.active).map(s=>s.user_id)).size;
 const months=Array.from({length:6},(_,i)=>{const [y,m]=currentMonth.split('-').map(Number);const date=new Date(Date.UTC(y,m-1-(5-i),1));return date.toISOString().slice(0,7)});
 const series=months.map(m=>({month:m,paid:sum(dues.filter(d=>monthKey(d.billing_month)===m&&d.status==='paid')),pending:sum(dues.filter(d=>monthKey(d.billing_month)===m&&d.status==='pending')),expenses:sum(expenses.filter(e=>monthKey(e.incurred_on)===m))}));
 const max=Math.max(1,...series.map(x=>Math.max(x.paid,x.pending,x.expenses)));
 const assetName=(id:string)=>assets.find(a=>a.id===id)?.name??id.slice(0,8);
 const short=(id:string)=>id.slice(0,8)+'…';
 return <div className="qa-shell"><aside className="qa-side"><Link href="/dashboard" className="qa-logo">≋ QUOTTA <span>CLUB</span></Link><div className="qa-side-caption">ADMINISTRAÇÃO</div><nav className="qa-menu"><Link className="qa-selected" href="/admin/dashboard"><LayoutDashboard size={19}/> Visão geral</Link><Link href="/mensalidades"><CreditCard size={19}/> Mensalidades</Link><Link href="/financeiro"><Wallet size={19}/> Despesas</Link><Link href="/admin/fairshare"><Scale size={19}/> FairShare</Link><Link href="/dashboard"><CalendarDays size={19}/> Reservas</Link></nav><Link className="qa-return" href="/dashboard"><ArrowLeft size={17}/> Voltar ao aplicativo</Link></aside><main className="qa-main"><header className="qa-header"><div><p className="qa-kicker">CENTRAL DE CONTROLE • {companyRes.data?.name??'QUOTTA CLUB'}</p><h1>Visão geral da operação</h1><p className="qa-muted">Dados reais do Supabase · Competência {currentMonth.split('-').reverse().join('/')}</p></div><span className="qa-live"><span/> Dados conectados</span></header>
 {members.length>1&&<div className="qa-company">Empresa: {members.map(m=><Link key={m.company_id} className={m.company_id===companyId?'qa-company-current':''} href={'/admin/dashboard?company='+m.company_id}>{short(m.company_id)}</Link>)}</div>}
 <section className="qa-kpis"><article><span><Wallet size={19}/> Recebido no mês</span><strong>{brl(received)}</strong><small>Mensalidades confirmadas</small></article><article><span><CreditCard size={19}/> A receber</span><strong>{brl(receivable)}</strong><small>{pending.length} cobranças pendentes</small></article><article><span><Users size={19}/> Cotistas ativos</span><strong>{activeUsers}</strong><small>{shares.filter(s=>s.active).length} vínculos com cotas</small></article><article><span><AlertTriangle size={19}/> Em atraso</span><strong>{brl(sum(overdue))}</strong><small>{overdue.length} mensalidades vencidas</small></article></section>
 <section className="qa-grid"><article className="qa-panel"><div className="qa-panel-title"><div><h2><TrendingUp size={20}/> Evolução financeira</h2><p>Últimas 6 competências · Valores efetivamente confirmados</p></div></div><div className="qa-legend"><span><i className="qa-green"/> Recebido</span><span><i className="qa-gold"/> Pendente</span><span><i className="qa-blue"/> Despesas lançadas</span></div><div className="qa-chart" role="img" aria-label="Gráfico mensal de receitas, pendências e despesas"><div className="qa-chart-bars">{series.map(s=><div key={s.month} className="qa-chart-group" title={`${s.month}: recebido ${brl(s.paid)}, pendente ${brl(s.pending)}, despesas ${brl(s.expenses)}`}><div className="qa-bar-set"><span className="qa-bar qa-green" style={{height:`${Math.max(s.paid?2:0,s.paid/max*100)}%`}}/><span className="qa-bar qa-gold" style={{height:`${Math.max(s.pending?2:0,s.pending/max*100)}%`}}/><span className="qa-bar qa-blue" style={{height:`${Math.max(s.expenses?2:0,s.expenses/max*100)}%`}}/></div><small>{s.month.slice(5)}/{s.month.slice(2,4)}</small></div>)}</div></div><p className="qa-footnote">Despesas são lançamentos registrados; não representam necessariamente saídas bancárias conciliadas. Histórico limitado aos registros consultados.</p></article>
 <article className="qa-panel"><h2><CheckCircle2 size={20}/> Mensalidades do mês</h2><div className="qa-progress" aria-label="Proporção de mensalidades pagas"><span style={{width:`${current.length?paid.length/current.length*100:0}%`}}/></div><div className="qa-statline"><span>Pagas</span><strong>{paid.length}</strong></div><div className="qa-statline"><span>Pendentes</span><strong>{pending.length}</strong></div><div className="qa-statline"><span>Anuladas</span><strong>{current.filter(d=>d.status==='void').length}</strong></div><div className="qa-statline"><span>Reservas confirmadas</span><strong>{bookings.filter(b=>b.status==='confirmed').length}</strong></div><div className="qa-statline"><span>Veículos ativos</span><strong>{assets.filter(a=>a.active).length}</strong></div><Link className="qa-link" href="/mensalidades">Gerenciar cobranças →</Link></article></section>
 <section className="qa-grid"><article className="qa-panel"><h2><Anchor size={20}/> Frota e cotas</h2><div className="qa-tablewrap"><table><thead><tr><th>Veículo</th><th>Tipo</th><th>Cotas ativas</th><th>Recebido no mês</th></tr></thead><tbody>{assets.map(a=><tr key={a.id}><td>{a.name}</td><td>{a.kind}</td><td>{shares.filter(s=>s.asset_id===a.id&&s.active).length}</td><td>{brl(sum(paid.filter(d=>d.asset_id===a.id)))}</td></tr>)}{!assets.length&&<tr><td colSpan={4}>Nenhum veículo cadastrado.</td></tr>}</tbody></table></div></article><article className="qa-panel"><h2><Users size={20}/> Cotistas com mensalidade pendente</h2><div className="qa-tablewrap"><table><thead><tr><th>Cotista (ID)</th><th>Veículo</th><th>Vencimento</th><th>Valor</th></tr></thead><tbody>{pending.slice(0,12).map(d=><tr key={d.id}><td title={d.user_id}>{short(d.user_id)}</td><td>{assetName(d.asset_id)}</td><td>{d.due_on.split('-').reverse().join('/')}</td><td>{brl(Number(d.amount))}</td></tr>)}{!pending.length&&<tr><td colSpan={4}>Nenhuma pendência no mês.</td></tr>}</tbody></table></div><p className="qa-footnote">O cadastro atual ainda não possui nomes e fotos dos cotistas. Exibimos IDs sem inventar dados pessoais.</p></article></section>
 <section className="qa-panel"><h2><CalendarDays size={20}/> Reservas recentes</h2><div className="qa-tablewrap"><table><thead><tr><th>Data</th><th>Veículo</th><th>Situação</th></tr></thead><tbody>{bookings.slice(0,10).map(b=><tr key={b.id}><td>{new Date(b.start_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</td><td>{assetName(b.asset_id)}</td><td><span className="qa-status">{b.status}</span></td></tr>)}{!bookings.length&&<tr><td colSpan={3}>Nenhuma reserva encontrada.</td></tr>}</tbody></table></div></section>
 <footer className="qa-footer">QUOTTA CLUB · Acesso restrito aos administradores · Financeiro baseado em lançamentos do sistema</footer></main></div>;
}
