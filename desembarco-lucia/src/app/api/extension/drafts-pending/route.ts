import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getReviews } from '@/lib/sheets';

/**
 * Endpoint que consume la Browser Extension de LucIA.
 *
 * GET /api/extension/drafts-pending[?reviewId=X]
 *
 * - Sin reviewId: devuelve TODOS los drafts del CM en estado APPROVED o PENDING
 *   (los APPROVED son los que vino el classifier auto-aprobando, listos para enviar)
 * - Con reviewId: devuelve el draft correspondiente a esa review (más rápido cuando
 *   el content script ya identificó la review en la página)
 *
 * Auth: cookie de sesión NextAuth (la extension manda credentials: 'include')
 *
 * CORS: Access-Control-Allow-Origin se setea explícito para que Chrome
 * extensions puedan consumirlo (extensions usan origin chrome-extension://)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // permite extension origin
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const { searchParams } = new URL(req.url);
  const reviewId = searchParams.get('reviewId');

  // Drafts en estado APPROVED (auto-aprobados, listos para enviar) o PENDING (CM revisa)
  const where = reviewId
    ? { reviewId, action: { in: ['APPROVED', 'PENDING'] as ('APPROVED' | 'PENDING')[] } }
    : { action: { in: ['APPROVED', 'PENDING'] as ('APPROVED' | 'PENDING')[] } };

  const logs = await prisma.responseLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: reviewId ? 1 : 50,
  });

  if (reviewId && logs.length === 0) {
    return NextResponse.json(
      { ok: true, draft: null },
      { headers: CORS_HEADERS }
    );
  }

  // Enrich con info del Sheet (autor, texto original)
  const reviews = await getReviews().catch(() => []);
  const reviewMap = new Map(reviews.map((r) => [r.review_id, r]));

  const drafts = logs.map((l) => {
    const r = reviewMap.get(l.reviewId);
    return {
      logId: l.id,
      reviewId: l.reviewId,
      brand: l.brand,
      local: r?.local ?? '',
      rating: l.rating,
      autor: r?.autor ?? 'Anónimo',
      reviewText: r?.texto ?? l.reviewText,
      draft: l.finalText ?? l.draft ?? '',
      provider: l.llmProvider,
      action: l.action,
      createdAt: l.createdAt.toISOString(),
    };
  });

  if (reviewId) {
    return NextResponse.json(
      { ok: true, draft: drafts[0] },
      { headers: CORS_HEADERS }
    );
  }

  return NextResponse.json(
    { ok: true, count: drafts.length, drafts },
    { headers: CORS_HEADERS }
  );
}
