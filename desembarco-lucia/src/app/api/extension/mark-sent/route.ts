import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

/**
 * La extension llama este endpoint cuando el CM confirmó que pegó la respuesta
 * en Google Maps. Marca el log como SENT.
 *
 * POST /api/extension/mark-sent
 * Body: { logId: string, finalText?: string }
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  let body: { logId?: string; finalText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid JSON' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (!body.logId) {
    return NextResponse.json(
      { ok: false, error: 'logId requerido' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const log = await prisma.responseLog.findUnique({ where: { id: body.logId } });
  if (!log) {
    return NextResponse.json(
      { ok: false, error: 'log no encontrado' },
      { status: 404, headers: CORS_HEADERS }
    );
  }
  if (log.action === 'SENT') {
    return NextResponse.json(
      { ok: true, alreadySent: true },
      { headers: CORS_HEADERS }
    );
  }

  await prisma.responseLog.update({
    where: { id: body.logId },
    data: {
      action: 'SENT',
      finalText: body.finalText ?? log.finalText ?? log.draft,
      sentAt: new Date(),
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/inbox');
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
