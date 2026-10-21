import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rankClaims } from '@/lib/fairshare/engine';
export async function GET(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Não autorizado'},{status:401});return NextResponse.json({example:rankClaims([{userId:'a',requestedStart:'',requestedEnd:'',premiumUsage:2,totalUsage:8,previousPriority:1,eligible:true},{userId:'b',requestedStart:'',requestedEnd:'',premiumUsage:1,totalUsage:9,previousPriority:2,eligible:true}]),notice:'Exemplo estático. Não confirma reservas nem lê histórico real.'});}
