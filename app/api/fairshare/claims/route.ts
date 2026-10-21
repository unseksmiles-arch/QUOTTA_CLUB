import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';import {createClient} from '@/lib/supabase/server';
const schema=z.object({roundId:z.string().uuid(),startAt:z.string().datetime(),endAt:z.string().datetime()});
export async function POST(req:NextRequest){const sb=await createClient();const {data:{user}}=await sb.auth.getUser();if(!user)return NextResponse.json({error:'Não autorizado'},{status:401});const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:'Dados inválidos'},{status:400});const {data,error}=await sb.rpc('submit_booking_claim',{p_round:p.data.roundId,p_start:p.data.startAt,p_end:p.data.endAt});return NextResponse.json(error?{error:error.message}:{id:data,status:'submitted'},{status:error?400:201});}
