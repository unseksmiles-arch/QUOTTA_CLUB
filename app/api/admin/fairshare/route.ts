import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {allocateDay,consolidateAllocations,FairClaim} from '@/lib/fairshare/allocator';
export async function GET(req:NextRequest){
 const sb=await createClient();const {data:{user}}=await sb.auth.getUser();if(!user)return NextResponse.json({error:'Não autenticado'},{status:401});
 const assetId=req.nextUrl.searchParams.get('assetId');const date=req.nextUrl.searchParams.get('date');
 if(!assetId||!date||!/^[0-9a-f-]{36}$/i.test(assetId)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date))return NextResponse.json({error:'Parâmetros inválidos'},{status:400});
 const {data:asset}=await sb.from('assets').select('id,name,company_id,kind,opens_at,closes_at,max_shares').eq('id',assetId).single();
 if(!asset||asset.kind!=='jetski')return NextResponse.json({error:'Jet ski não encontrado'},{status:404});
 const {data:admin}=await sb.from('company_members').select('role').eq('company_id',asset.company_id).eq('user_id',user.id).eq('role','admin').maybeSingle();
 if(!admin)return NextResponse.json({error:'Acesso administrativo necessário'},{status:403});
 const {data:round}=await sb.from('booking_rounds').select('id,state,closes_at').eq('asset_id',assetId).eq('service_date',date).maybeSingle();
 if(!round)return NextResponse.json({asset,round:null,claims:[],allocations:[],notice:'Abra uma rodada para receber preferências.'});
 const {data:claims,error}=await sb.from('booking_claims').select('id,user_id,start_at,end_at,state').eq('round_id',round.id).eq('state','submitted');
 if(error)return NextResponse.json({error:error.message},{status:400});
 const start=`${date}T00:00:00-03:00`,end=`${date}T23:59:59-03:00`;
 const {data:reservations}=await sb.from('reservations').select('start_at,end_at').eq('asset_id',assetId).eq('status','confirmed').lt('start_at',end).gt('end_at',start);
 const {data:history}=await sb.from('reservations').select('user_id,start_at,end_at').eq('asset_id',assetId).in('status',['confirmed','completed']).gte('start_at',new Date(Date.now()-365*86400000).toISOString());
 const mins=(iso:string)=>{const d=new Date(iso);const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d).split(':');return Number(parts[0])*60+Number(parts[1]);};
 const usage=new Map<string,{premium:number,total:number}>();for(const h of history??[]){const u=usage.get(h.user_id)??{premium:0,total:0};const n=(new Date(h.end_at).getTime()-new Date(h.start_at).getTime())/60000;const dow=new Date(h.start_at).toLocaleDateString('en-US',{timeZone:'America/Sao_Paulo',weekday:'short'});u.total+=n;if(dow==='Sat'||dow==='Sun')u.premium+=n;usage.set(h.user_id,u);}
 const input:FairClaim[]=(claims??[]).map(c=>({id:c.id,userId:c.user_id,startMinute:mins(c.start_at),endMinute:mins(c.end_at),premiumMinutes:usage.get(c.user_id)?.premium??0,totalMinutes:usage.get(c.user_id)?.total??0,priorityTurns:0,eligible:true}));
 const occupied=(reservations??[]).map(r=>({startMinute:mins(r.start_at),endMinute:mins(r.end_at)}));
 const open=Number(asset.opens_at.slice(0,2))*60+Number(asset.opens_at.slice(3,5));const close=Number(asset.closes_at.slice(0,2))*60+Number(asset.closes_at.slice(3,5));
 return NextResponse.json({asset,round,claims:input,allocations:consolidateAllocations(allocateDay(input,occupied,open,close)),notice:'Simulação de distribuição; NÃO confirma reservas. Histórico usa reservas confirmadas/concluídas nos últimos 365 dias; feriados e saldo contratual ainda exigem integração.'});
}
