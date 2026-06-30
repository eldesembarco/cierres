import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

/**
 * Webhook que dispara n8n cuando termina de popular el Sheet.
 *
 * Body: { paths?: string[] }   — si no viene, revalida todos los paths del dashboard
 * Header: x-webhook-secret     — debe matchear N8N_WEBHOOK_SECRET
 */

const DEFAULT_PATHS = [
  '/dashboard',
  '/dashboard/inbox',
  '/dashboard/reviews',
  '/dashboard/metricas',
];

export async function POST(req: NextRequest) {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'N8N_WEBHOOK_SECRET no configurado en server' },
      { status: 500 }
    );
  }

  const provided = req.headers.get('x-webhook-secret');
  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let paths: string[] = DEFAULT_PATHS;
  try {
    const body = (await req.json()) as { paths?: string[] };
    if (Array.isArray(body.paths) && body.paths.length > 0) paths = body.paths;
  } catch {
    // body vacío → usar default
  }

  for (const p of paths) revalidatePath(p);

  return NextResponse.json({ ok: true, revalidated: paths });
}
