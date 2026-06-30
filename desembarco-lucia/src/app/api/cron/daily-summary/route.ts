import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getReviews } from '@/lib/sheets';

/**
 * Endpoint que arma el resumen diario para que n8n lo use al armar el email.
 *
 * GET /api/cron/daily-summary
 * Header: x-webhook-secret (igual que el otro)
 *
 * Devuelve estructurado para que n8n arme el email/slack:
 * - Estadísticas del día (reviews nuevas, auto-aprobadas, urgentes, pendientes CM)
 * - Lista de URGENTES (1-2★) con preview del texto
 * - Lista de PENDIENTES (3-4★ con draft listo, esperan CM)
 * - Lista de AUTO-APROBADAS (5★ con draft listo para enviar)
 *
 * Pensado para correrse 1 vez al día (ej. 08:00 AM Argentina) después del cron de ingesta.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'N8N_WEBHOOK_SECRET no configurado' },
      { status: 500 }
    );
  }
  const provided = req.headers.get('x-webhook-secret');
  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // Window: últimas 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [logs, reviews] = await Promise.all([
    prisma.responseLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    }),
    getReviews().catch(() => []),
  ]);

  const reviewById = new Map(reviews.map((r) => [r.review_id, r]));

  const enrich = (log: typeof logs[number]) => {
    const r = reviewById.get(log.reviewId);
    return {
      logId: log.id,
      reviewId: log.reviewId,
      brand: log.brand,
      local: r?.local ?? '',
      rating: log.rating,
      autor: r?.autor ?? 'Anónimo',
      texto: r?.texto ?? log.reviewText,
      draft: log.finalText ?? log.draft ?? '',
      provider: log.llmProvider,
      action: log.action,
      createdAt: log.createdAt.toISOString(),
    };
  };

  const urgentes = logs
    .filter((l) => l.action === 'PENDING' && l.rating > 0 && l.rating <= 2)
    .map(enrich);

  const pendientes = logs
    .filter((l) => l.action === 'PENDING' && l.rating >= 3 && l.llmProvider !== null)
    .map(enrich);

  const autoAprobadas = logs.filter((l) => l.action === 'APPROVED').map(enrich);

  const enviadas = logs.filter((l) => l.action === 'SENT').map(enrich);

  const summary = {
    window_hours: 24,
    since: since.toISOString(),
    until: new Date().toISOString(),
    counts: {
      total: logs.length,
      urgentes: urgentes.length,
      pendientes_cm: pendientes.length,
      auto_aprobadas: autoAprobadas.length,
      enviadas: enviadas.length,
    },
    needs_attention:
      urgentes.length > 0 || pendientes.length > 0 || autoAprobadas.length > 0,
    urgentes,
    pendientes,
    auto_aprobadas: autoAprobadas,
    enviadas,
  };

  return NextResponse.json({ ok: true, summary });
}
