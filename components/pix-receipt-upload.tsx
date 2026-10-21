'use client';
import {useState} from 'react';
import {createClient} from '@/lib/supabase/browser';
export default function PixReceiptUpload({dueId}:{dueId:string}){
 const [busy,setBusy]=useState(false);const [msg,setMsg]=useState('');const [file,setFile]=useState<File|null>(null);
 async function send(){if(!file)return;setBusy(true);setMsg('');try{
  const allowed=['application/pdf','image/jpeg','image/png','image/webp'];
  if(!allowed.includes(file.type)||file.size>5*1024*1024||file.size===0)throw new Error('Envie PDF, JPG, PNG ou WEBP com ate 5 MB.');
  const sb=createClient();const {data:{user},error:authError}=await sb.auth.getUser();if(authError||!user)throw new Error('Faca login novamente.');
  const ext={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type]||'bin';
  const path=`${user.id}/${dueId}/${crypto.randomUUID()}.${ext}`;
  const {error:uploadError}=await sb.storage.from('pix-receipts').upload(path,file,{contentType:file.type,upsert:false});if(uploadError)throw uploadError;
  const {error:registerError}=await sb.rpc('submit_pix_receipt',{p_due:dueId,p_path:path,p_filename:file.name,p_type:file.type,p_size:file.size});
  if(registerError)throw new Error('Arquivo enviado, mas o registro falhou: '+registerError.message);
  setMsg('Comprovante enviado! Aguardando conferencia da administracao. O agendamento continua bloqueado ate a confirmacao.');setFile(null);
 }catch(e){setMsg(e instanceof Error?e.message:'Falha ao enviar comprovante.');}finally{setBusy(false)}}
 return <div style={{minWidth:210}}><input aria-label="Comprovante Pix" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>setFile(e.target.files?.[0]??null)}/><button style={{marginTop:6}} disabled={!file||busy} onClick={send}>{busy?'Enviando...':'Enviar comprovante Pix'}</button>{msg&&<p role="status" className="small">{msg}</p>}</div>;
}
