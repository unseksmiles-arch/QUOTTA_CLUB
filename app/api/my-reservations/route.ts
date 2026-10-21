
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Não autorizado' },
      { status: 401 }
    );
  }

  const { data: reservations, error: reservationsError } =
    await supabase
      .from('reservations')
      .select('id,asset_id,start_at,end_at,status')
      .eq('user_id', user.id)
      .order('start_at', { ascending: false });

  if (reservationsError) {
    return NextResponse.json(
      { error: reservationsError.message },
      { status: 400 }
    );
  }

  const { data: claims, error: claimsError } =
    await supabase
      .from('booking_claims')
      .select('id,asset_id,start_at,end_at,state')
      .eq('user_id', user.id)
      .order('start_at', { ascending: false });

  if (claimsError) {
    return NextResponse.json(
      { error: claimsError.message },
      { status: 400 }
    );
  }

  return NextResponse.json({
    reservations: reservations ?? [],
    claims: claims ?? []
  });
}
