'use client';
import {useState} from 'react';
import {createClient} from '@/lib/supabase/browser';
export default function PixReceiptReview({id,path}:{id:string;path:string}){
 const [busy,setBusy]=useState(false);const [msg,setMsg]=useState('');const [done,setDone]=useState(false);
 async function view(){setMsg('');const {data,error}=await createClient().storage.from('pix-receipts').createSignedUrl(path,60);if(error||!data?.signedUrl){setMsg(error?.message??'Nao foi possivel abrir o arquivo.');return;}window.open(data.signedUrl,'_blank','noopener,noreferrer');}
 async function review(approve:boolean){if(!window.confirm(approve?'Voce conferiu o recebimento no banco e deseja liberar a reserva?':'Rejeitar este comprovante?'))return;setBusy(true);setMsg('');const {error}=await createClient().rpc('review_pix_receipt',{p_receipt:id,p_approve:approve,p_note:null});if(error)setMsg(error.message);else{setDone(true);setMsg(approve?'Pagamento confirmado e agendamentos liberados.':'Comprovante rejeitado.');}setBusy(false);}
 return <div style={{display:'flex',gap:6,flexWrap:'wrap'}}><button onClick={view}>Ver arquivo</button>{!done&&<><button disabled={busy} onClick={()=>review(true)}>Aprovar Pix</button><button disabled={busy} onClick={()=>review(false)}>Rejeitar</button></>}{msg&&<small role="status">{msg}</small>}</div>;
}
