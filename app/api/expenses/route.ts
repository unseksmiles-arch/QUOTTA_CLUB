import {createClient} from '@/lib/supabase/server';
import {NextResponse} from 'next/server';
import {z} from 'zod';
const schema=z.object({asset_id:z.string().uuid(),category:z.enum(['preventive','revision','repair','cleaning','insurance','other']),description:z.string().trim().min(3).max(500),amount:z.number().finite().min(0).max(100000000),incurred_on:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),allocation_type:z.enum(['shared','individual']),responsible_user_id:z.string().uuid().nullable(),evidence_notes:z.string().max(3000)}).refine(v=>v.allocation_type==='shared'?!v.responsible_user_id:!!v.responsible_user_id);
export async function POST(req:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Não autenticado'},{status:401});
 let parsed;try{parsed=schema.parse(await req.json());}catch{return NextResponse.json({error:'Dados inválidos'},{status:400});}
 const {data:asset}=await supabase.from('assets').select('company_id').eq('id',parsed.asset_id).single();if(!asset)return NextResponse.json({error:'Bem não encontrado'},{status:404});
 const {data:member}=await supabase.from('company_members').select('role').eq('company_id',asset.company_id).eq('user_id',user.id).single();if(member?.role!=='admin')return NextResponse.json({error:'Acesso restrito ao administrador'},{status:403});
 const {error}=await supabase.from('asset_expenses').insert({...parsed,company_id:asset.company_id,created_by:user.id,responsibility_status:parsed.allocation_type==='shared'?'not_applicable':'pending_review'});
 if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({ok:true},{status:201});
}
