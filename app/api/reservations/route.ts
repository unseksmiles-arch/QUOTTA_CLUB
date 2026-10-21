
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const schema = z.object({
  assetId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Não autorizado' },
      { status: 401 }
    );
  }

  const parsed = schema.safeParse(
    await req.json().catch(() => null)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos' },
      { status: 400 }
    );
  }

  const { assetId, startAt, endAt } = parsed.data;

  const start = new Date(startAt);
  const end = new Date(endAt);

  if (
    end <= start ||
    start.getTime() < Date.now() - 60000 ||
    end.getTime() - start.getTime() > 7 * 86400000
  ) {
    return NextResponse.json(
      { error: 'Período inválido' },
      { status: 400 }
    );
  }

  const { data: id, error } = await supabase.rpc(
    'request_reservation',
    {
      p_asset_id: assetId,
      p_start: startAt,
      p_end: endAt,
    }
  );

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  const { data: reservation } = await supabase
    .from('reservations')
    .select('status')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (reservation?.status === 'confirmed') {
    return NextResponse.json({
      id,
      status: 'confirmed',
      message: 'Reserva confirmada com sucesso!',
    }, { status: 201 });
  }

  const { data: claim } = await supabase
    .from('booking_claims')
    .select('state')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (claim?.state === 'submitted') {
    return NextResponse.json({
      id,
      status: 'submitted',
      message:
        'Pedido enviado ao FairShare. Aguarde o encerramento da rodada para saber se sua reserva foi confirmada.',
    }, { status: 201 });
  }

  return NextResponse.json({
    id,
    status: 'pending_verification',
    message:
      'Pedido registrado. Consulte suas reservas para verificar o status.',
  }, { status: 201 });
}
