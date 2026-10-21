'use client';
import {useState} from 'react';
import {createClient} from '@/lib/supabase/browser';
export default function MonthlyDuesAdmin({assets}:{assets:{id:string;name:string}[]}){
 const [asset,setAsset]=useState(assets[0]?.id??'');
 const [month,setMonth]=useState(new Date().toISOString().slice(0,7));
 const [amount,setAmount]=useState('650');
 const [due,setDue]=useState(new Date().toISOString().slice(0,10));
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function issue(){setBusy(true);setMessage('');const sb=createClient();const {data,error}=await sb.rpc('issue_monthly_dues',{p_asset:asset,p_month:month+'-01',p_amount:Number(amount),p_due:due});setMessage(error?error.message:`${data} mensalidade(s) gerada(s). Atualize a página para visualizar.`);setBusy(false)}
 return <div className="panel"><h2>Gerar mensalidades</h2><p className="muted">Gera uma cobrança por cotista ativo do bem. Cobranças existentes não são duplicadas.</p><div style={{display:'flex',flexWrap:'wrap',gap:12}}><label>Bem<br/><select value={asset} onChange={e=>setAsset(e.target.value)}>{assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Mês<br/><input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><label>Valor (R$)<br/><input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Vencimento<br/><input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label></div><p><button disabled={busy||!asset||!month||!due||Number(amount)<0} onClick={issue}>{busy?'Gerando...':'Gerar mensalidades'}</button></p>{message&&<p role="status">{message}</p>}</div>
}
