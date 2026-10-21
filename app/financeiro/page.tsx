import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import ExpenseForm from '@/components/expense-form';

const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
export default async function Financeiro(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect('/login');
 const {data:memberships}=await supabase.from('company_members').select('company_id,role').eq('user_id',user.id);
 const adminIds=(memberships??[]).filter(x=>x.role==='admin').map(x=>x.company_id);
 const {data:shares}=await supabase.from('asset_shares').select('asset_id,assets(id,name,company_id)').eq('user_id',user.id).eq('active',true);
 const {data:adminAssets}=adminIds.length?await supabase.from('assets').select('id,name,company_id').in('company_id',adminIds):{data:[]};
 const assets=[...new Map([...(adminAssets??[]),...(shares??[]).flatMap((s:any)=>s.assets?[s.assets]:[])].map((a:any)=>[a.id,a])).values()] as {id:string,name:string,company_id:string}[];
 const ids=assets.map(a=>a.id);
 const {data:expenses}=ids.length?await supabase.from('asset_expenses').select('id,asset_id,category,description,amount,incurred_on,allocation_type,responsibility_status,responsible_user_id').in('asset_id',ids).order('incurred_on',{ascending:false}).limit(100):{data:[]};
 const {data:allocations}=await supabase.from('expense_allocations').select('expense_id,amount,status').eq('user_id',user.id);
 const ownTotal=(allocations??[]).filter(a=>a.status!=='cancelled').reduce((s,a)=>s+Number(a.amount),0);
 const total=(expenses??[]).reduce((s,e)=>s+Number(e.amount),0);
 return <main className="wrap"><header><strong style={{color:'#d7b678'}}>QUOTTA • FINANCEIRO</strong><Link href="/dashboard">← Reservas</Link></header>
 <h1>Despesas e manutenção</h1><p className="muted">Transparência nos custos dos bens. Avarias individuais exigem apuração de responsabilidade.</p>
 <div className="grid"><div className="panel"><div className="muted">Despesas listadas</div><h2>{money(total)}</h2></div><div className="panel"><div className="muted">Minha parcela registrada</div><h2>{money(ownTotal)}</h2><small className="muted">Inclui valores ainda em análise; não equivale a cobrança exigível.</small></div></div>
 {adminIds.length>0&&<section className="panel" style={{marginTop:20}}><h2>Registrar despesa</h2><ExpenseForm assets={assets.filter(a=>adminIds.includes(a.company_id))}/></section>}
 <section className="panel" style={{marginTop:20}}><h2>Histórico de despesas</h2>{expenses?.length?<div style={{overflowX:'auto'}}><table><thead><tr><th>Data</th><th>Bem</th><th>Descrição</th><th>Responsabilidade</th><th>Valor</th></tr></thead><tbody>{expenses.map(e=><tr key={e.id}><td>{e.incurred_on}</td><td>{assets.find(a=>a.id===e.asset_id)?.name}</td><td>{e.description}<div className="muted small">{e.category}</div></td><td>{e.allocation_type==='shared'?'Rateio igualitário':`Individual • ${e.responsibility_status==='confirmed'?'confirmada':'em análise'}`}</td><td>{money(Number(e.amount))}</td></tr>)}</tbody></table></div>:<p className="muted">Nenhuma despesa registrada.</p>}</section>
 </main>;
}
