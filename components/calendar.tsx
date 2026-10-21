'use client';
import {useEffect,useState} from 'react';
import {CalendarDays,Clock3,ChevronLeft,ChevronRight,Info,CheckCircle2,AlertCircle} from 'lucide-react';
type Asset={id:string;name:string;kind:string;slot_minutes:number};
type Reservation={start_at:string;end_at:string;status:string};
const pad=(n:number)=>String(n).padStart(2,'0');
export default function Calendar({assets}:{assets:Asset[]}){
 const [assetId,setAssetId]=useState(assets[0]?.id??'');
 const [month,setMonth]=useState(()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}`});
 const [day,setDay]=useState(()=>new Date().getDate());
 const [slots,setSlots]=useState<Reservation[]>([]);
 const [hour,setHour]=useState('09:00');const [duration,setDuration]=useState('240');
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 const asset=assets.find(a=>a.id===assetId)??assets[0];
 const [year,mo]=month.split('-').map(Number);const days=new Date(year,mo,0).getDate();const first=new Date(year,mo-1,1).getDay();
 const date=`${month}-${pad(Math.min(day,days))}`;
 const pretty=new Date(year,mo-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
 const selectedPretty=new Date(year,mo-1,Math.min(day,days)).toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
 useEffect(()=>{let live=true;fetch(`/api/assets?assetId=${encodeURIComponent(assetId)}&month=${month}`).then(r=>r.json()).then(x=>{if(live)setSlots(x.reservations??[])}).catch(()=>{if(live)setSlots([])});return()=>{live=false}},[assetId,month]);
 function changeMonth(delta:number){const d=new Date(year,mo-1+delta,1);setMonth(`${d.getFullYear()}-${pad(d.getMonth()+1)}`);setDay(1);setMessage('')}
 const selectedStart=new Date(`${date}T${hour}:00`);
 const minutes=asset.kind==='jetski'?Number(duration):asset.kind==='car'?Number(duration)*1440:1440;
 const selectedEnd=new Date(selectedStart.getTime()+minutes*60000);
 const endHour=`${pad(selectedEnd.getHours())}:${pad(selectedEnd.getMinutes())}`;
 const beyondHours=asset.kind==='jetski'&&(selectedStart.getHours()<7||selectedEnd.getHours()>18||selectedEnd.toDateString()!==selectedStart.toDateString()||(selectedEnd.getHours()===18&&selectedEnd.getMinutes()>0));
 const conflicting=asset.kind==='jetski'&&slots.some(s=>s.status==='confirmed'&&new Date(s.start_at)<selectedEnd&&new Date(s.end_at)>selectedStart);
 async function reserve(){if(beyondHours||conflicting||busy)return;setBusy(true);setMessage('Enviando sua solicitação…');try{const start=asset.kind==='jetski'?selectedStart:new Date(`${date}T00:00:00`);const end=new Date(start.getTime()+minutes*60000);const r=await fetch('/api/reservations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assetId,startAt:start.toISOString(),endAt:end.toISOString()})});const result=await r.json();setMessage(r.ok?(result.message??'Pedido recebido. Consulte o calendário para acompanhar a confirmação.'):(result.error??'Não foi possível solicitar a reserva.'))}catch{setMessage('Não foi possível conectar. Tente novamente.')}finally{setBusy(false)}}
 return <div className="booking-grid" id="reservar"><section className="booking-card"><div className="card-title"><CalendarDays size={29}/><h2>Escolha a data da sua reserva</h2></div>
 {assets.length>1&&<><label htmlFor="asset-choice">Embarcação</label><select id="asset-choice" value={assetId} onChange={e=>setAssetId(e.target.value)}>{assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></>}
 <div className="month-switch"><button type="button" aria-label="Mês anterior" onClick={()=>changeMonth(-1)}><ChevronLeft size={24}/></button><strong>{pretty}</strong><button type="button" aria-label="Próximo mês" onClick={()=>changeMonth(1)}><ChevronRight size={24}/></button></div>
 <div className="club-calendar" role="group" aria-label="Escolha o dia">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(x=><span className="weekday" key={x}>{x}</span>)}{Array.from({length:first},(_,i)=><span key={'empty'+i}/>)}{Array.from({length:days},(_,i)=>{const d=i+1;const iso=`${month}-${pad(d)}`;const weekend=[0,6].includes(new Date(year,mo-1,d).getDay());const confirmed=slots.some(s=>s.status==='confirmed'&&s.start_at.slice(0,10)<=iso&&s.end_at.slice(0,10)>=iso);return <button type="button" key={d} aria-label={`${d} de ${pretty}${confirmed?', com reserva existente':''}`} aria-pressed={day===d} className={`club-day ${day===d?'chosen':''}`} onClick={()=>{setDay(d);setMessage('')}}><span>{d}</span>{(confirmed||weekend)&&<i className={confirmed?'dot-red':'dot-gold'}/>}</button>})}</div>
 <div className="calendar-legend"><span><i className="dot-green"/> Disponível*</span><span><i className="dot-gold"/> Fim de semana</span><span><i className="dot-red"/> Reserva no dia</span></div><p className="fineprint">*A disponibilidade é verificada por horário ao solicitar. Um dia com reserva pode ter horários livres.</p></section>
 <section className="booking-card"><div className="card-title"><Clock3 size={29}/><h2>Detalhes da reserva</h2></div><div className="selected-date"><CalendarDays size={25}/><div><small>Data escolhida</small><strong>{selectedPretty}</strong></div></div>
 {asset.kind==='jetski'?<><h3>1. Escolha o horário de início</h3><div className="time-options">{Array.from({length:11},(_,i)=>`${pad(i+7)}:00`).map(t=><button type="button" aria-pressed={hour===t} className={hour===t?'picked':''} onClick={()=>{setHour(t);setMessage('')}} key={t}>{t}</button>)}</div><h3>2. Por quantas horas?</h3><div className="duration-options">{[1,2,3,4,5,6,7,8,9,10,11].map(h=><button key={h} type="button" aria-pressed={Number(duration)===h*60} className={Number(duration)===h*60?'picked':''} onClick={()=>{setDuration(String(h*60));setMessage('')}}>{h} {h===1?'hora':'horas'}</button>)}</div><p className="reservation-summary">Seu pedido: <strong>{hour} às {endHour}</strong> · {Number(duration)/60} {Number(duration)===60?'hora':'horas'}</p></>:<><h3>Duração da reserva</h3>{asset.kind==='car'?<select value={duration} onChange={e=>setDuration(e.target.value)}>{[1,2,3,4,5,6,7].map(n=><option value={n} key={n}>{n} diária(s)</option>)}</select>:<p>1 diária</p>}</>}
 {beyondHours&&<p className="booking-alert"><AlertCircle size={19}/> O horário precisa terminar até as 18h. Escolha menos horas ou comece mais cedo.</p>}{conflicting&&!beyondHours&&<p className="booking-alert"><AlertCircle size={19}/> Esse período já possui uma reserva confirmada. Escolha outro horário.</p>}
 <button type="button" className="booking-submit" disabled={busy||beyondHours||conflicting} onClick={reserve}><CalendarDays size={22}/>{busy?'Enviando…':'Solicitar reserva'}</button>
 {message&&<p role="status" className="booking-feedback"><CheckCircle2 size={20}/>{message}</p>}
 <p className="booking-notice"><Info size={21}/> Mensalidade em dia é obrigatória. Dias comuns podem ser confirmados na hora. Fins de semana, feriados, Ano-Novo e Carnaval passam pelo rodízio FairShare e são confirmados após o prazo da rodada.</p></section></div>
}
