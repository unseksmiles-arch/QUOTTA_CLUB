'use client';
import {useState} from 'react';
import {createClient} from '@/lib/supabase/browser';
export default function ConfirmDue({id}:{id:string}){const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);const [error,setError]=useState('');async function confirm(){if(!window.confirm('Confirmar que o pagamento foi recebido e liberar o agendamento?'))return;setBusy(true);const {error}=await createClient().rpc('confirm_monthly_due',{p_due:id,p_reference:null});if(error)setError(error.message);else setDone(true);setBusy(false)}return <>{done?<span style={{color:'#4ade80'}}>Pagamento confirmado ✓</span>:<button disabled={busy} onClick={confirm}>{busy?'Confirmando...':'Confirmar pagamento'}</button>}{error&&<small role="alert">{error}</small>}</>}
