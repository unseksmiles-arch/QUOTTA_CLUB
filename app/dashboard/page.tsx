import { createClient } from '@/lib/supabase/server';
import Calendar from '@/components/calendar';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, CreditCard, Wrench, FileText, ShieldCheck, CircleHelp, Anchor, Wallet, Users, Scale } from 'lucide-react';

const money = (n:number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
export default async function Dashboard(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:shares}=await supabase.from('asset_shares').select('asset_id,assets(id,name,kind,slot_minutes)').eq('user_id',user.id).eq('active',true);
 const assets=(shares??[]).flatMap((s:any)=>s.assets?[s.assets]:[]);
 const {data:members}=await supabase.from('company_members').select('role').eq('user_id',user.id);
 const admin=(members??[]).some(m=>m.role==='admin');
 const month=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}).slice(0,7)+'-01';
 const {data:dues}=await supabase.from('monthly_dues').select('asset_id,amount,status,due_on').eq('user_id',user.id).eq('billing_month',month);
 const due=dues?.find(d=>assets.some(a=>a.id===d.asset_id));
 return <div className="club-shell">
  <aside className="club-sidebar"><Link href="/dashboard" className="club-logo"><span className="wave">≋</span> QUOTTA <em>CLUB</em></Link>
   <nav aria-label="Menu principal" className="club-nav">
    <Link className="active" href="/dashboard"><CalendarDays size={22}/> Minhas reservas</Link>
    <a href="#meu-bem"><Anchor size={22}/> Minha embarcação</a>
    <Link href="/mensalidades"><CreditCard size={22}/> Mensalidades</Link>
    <Link href="/financeiro"><Wallet size={22}/> Despesas e avarias</Link>
    <Link href="/financeiro"><Wrench size={22}/> Manutenções</Link>
    <Link href="/fairshare"><Scale size={22}/> Uso justo</Link>
    {admin&&<Link href="/admin/fairshare"><Users size={22}/> Administração</Link>}
   </nav>
   <div className="sidebar-help"><CircleHelp size={23}/><div><strong>Precisa de ajuda?</strong><span>Fale com a administração do clube.</span></div></div>
  </aside>
  <main className="club-main"><div className="club-topbar"><span>Bem-vindo ao seu clube náutico</span><span className="club-email">{user.email}</span></div>
   <section id="meu-bem" className="club-hero"><div className="hero-copy"><span className="eyebrow">MINHA EMBARCAÇÃO</span><h1>{assets[0]?.name??'QUOTTA CLUB'}</h1><p>Seu lazer, do seu jeito. Reserve com tranquilidade.</p><div className="hero-pills"><span><Users size={19}/> 8 cotas de 12,5%</span><span><CalendarDays size={19}/> 07h às 18h</span></div></div><img src="/seadoo-real-2026.jpg" alt="Sea-Doo Wake 170 2026 bege e azul, imagem fornecida pela administração" className="hero-jetski"/></section>
   <section className="club-summary" aria-label="Resumo da sua cota"><div className="summary-card"><span className="summary-icon">♛</span><div><small>Minha participação</small><strong>12,5%</strong><span>1 de 8 cotas</span></div></div><div className="summary-card"><CreditCard size={31}/><div><small>Mensalidade por cota</small><strong>{money(due?Number(due.amount):450)}</strong><span>{due?.status==='paid'?'Pagamento confirmado':due?.status==='pending'?'Aguardando pagamento':'Pagamento ainda não lançado'}</span></div></div><div className="summary-card"><ShieldCheck size={31}/><div><small>Reservas</small><strong>{due?.status==='paid'?'Liberadas':'Aguardando liberação'}</strong><span>Automática ou por rodada FairShare</span></div></div></section>
   {assets.length?<Calendar assets={assets}/>:<div className="panel"><h2>Nenhum bem vinculado</h2><p className="muted">Solicite à administração o vínculo da sua cota.</p></div>}
   <section className="club-bottom"><Link href="/fairshare"><Scale size={26}/><span><strong>Uso justo</strong><small>Conheça o FairShare</small></span></Link><Link href="/mensalidades"><CreditCard size={26}/><span><strong>Pagamentos</strong><small>Veja suas mensalidades</small></span></Link><Link href="/financeiro"><Wrench size={26}/><span><strong>Manutenção</strong><small>Transparência e cuidado</small></span></Link><Link href="/admin/fairshare"><FileText size={26}/><span><strong>Meu clube</strong><small>Informações e gestão</small></span></Link></section>
   <footer className="club-footer">QUOTTA CLUB · Reservas sujeitas à disponibilidade, mensalidade em dia e regras do rodízio FairShare.</footer>
  </main>
 </div>
}
