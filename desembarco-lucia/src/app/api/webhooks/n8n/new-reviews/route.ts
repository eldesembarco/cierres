import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getReviews, getLocales } from '@/lib/sheets';
import {
  generateDraft,
  classifyReviewSentiment,
  type ReviewContext,
} from '@/lib/llm';

/**
 * Webhook que dispara n8n después de la ingesta diaria de Apify.
 *
 * Body:
 * {
 *   "reviewIds": ["abc123", "def456", ...]   // IDs nuevos detectados por el diff
 * }
 *
 * Header: x-webhook-secret  (debe matchear N8N_WEBHOOK_SECRET)
 *
 * Lo que hace por cada reviewId:
 *  1. Busca la review en la hoja Reviews del Sheet (n8n ya la insertó antes)
 *  2. Según rating:
 *      - 5★: classifica sentiment con LLM. Si POSITIVE + confidence ≥ 0.85 → genera draft + APPROVED
 *      - 3-4★: genera draft + PENDING (CM revisa)
 *      - 1-2★: marca como URGENT, NO auto-genera draft (mejor manual)
 *  3. Skipea si ya hay un ResponseLog para esa review (idempotencia)
 *
 * Response: resumen del procesamiento
 */

interface ProcessResult {
  reviewId: string;
  status: 'auto_approved' | 'pending_cm' | 'urgent_manual' | 'skipped' | 'error' | 'no_text';
  detail?: string;
  brand?: string;
  rating?: number;
}

function inferBrand(local: string): string {
  const l = local.toLowerCase();
  if (l.includes('tasty')) return 'Mr Tasty';
  if (l.includes('mila')) return 'Mila & Go';
  if (l.includes('desembarco')) return 'El Desembarco';
  return 'El Desembarco';
}

export async function POST(req: NextRequest) {
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

  let body: { reviewIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid JSON body' },
      { status: 400 }
    );
  }

  const reviewIds = Array.isArray(body.reviewIds)
    ? body.reviewIds.filter((x) => typeof x === 'string' && x.length > 0)
    : [];

  if (reviewIds.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      message: 'reviewIds vacío, nada que procesar',
    });
  }

  // Limit para evitar abuse
  if (reviewIds.length > 100) {
    return NextResponse.json(
      { ok: false, error: 'máximo 100 reviewIds por request' },
      { status: 400 }
    );
  }

  // Fetch reviews + locales del Sheet
  const [allReviews, locales] = await Promise.all([
    getReviews().catch(() => []),
    getLocales().catch(() => []),
  ]);

  const localById = new Map(locales.map((l) => [l.local, l]));
  const reviewsToProcess = allReviews.filter((r) => reviewIds.includes(r.review_id));

  const results: ProcessResult[] = [];

  for (const r of reviewsToProcess) {
    if (!r.review_id) continue;

    // Idempotencia: si ya hay log, skipear
    const existing = await prisma.responseLog.findFirst({
      where: { reviewId: r.review_id },
    });
    if (existing) {
      results.push({
        reviewId: r.review_id,
        status: 'skipped',
        detail: `ya procesada (log: ${existing.action})`,
      });
      continue;
    }

    if (!r.texto || r.texto.trim().length === 0) {
      results.push({
        reviewId: r.review_id,
        status: 'no_text',
        detail: 'review sin texto, skip auto-procesamiento',
        rating: r.rating,
      });
      continue;
    }

    const info = localById.get(r.local);
    const brand = inferBrand(r.local);
    const ctx: ReviewContext = {
      reviewId: r.review_id,
      placeId: info?.place_id || '',
      brand,
      localName: r.local,
      rating: r.rating,
      reviewText: r.texto,
      reviewerName: r.autor || 'Anónimo',
      reviewDate: r.fecha,
    };

    try {
      // 1-2★: marca URGENT, no genera draft auto
      if (r.rating > 0 && r.rating <= 2) {
        await prisma.responseLog.create({
          data: {
            reviewId: r.review_id,
            placeId: info?.place_id || '',
            brand,
            rating: r.rating,
            reviewText: r.texto,
            prompt: '[crítica detectada — flag URGENT, requiere respuesta manual del CM]',
            draft: '',
            action: 'PENDING',
            llmProvider: null,
            llmModel: 'urgent_flag',
          },
        });
        // También crea una alerta (si tu schema tiene Alert; si no, solo el log alcanza)
        try {
          await prisma.alert.create({
            data: {
              type: 'URGENT_REVIEW',
              severity: r.rating === 1 ? 'CRITICAL' : 'WARNING',
              status: 'OPEN',
              placeId: info?.place_id || '',
              brand,
              title: `Reseña ${r.rating}★ urgente · ${r.local}`,
              description: `${r.autor || 'Anónimo'}: "${r.texto.slice(0, 200)}"`,
              metadata: { reviewId: r.review_id, fecha: r.fecha },
            },
          });
        } catch {
          /* alert es nice-to-have */
        }
        results.push({
          reviewId: r.review_id,
          status: 'urgent_manual',
          brand,
          rating: r.rating,
        });
        continue;
      }

      // 5★: classifier para auto-aprobar si pasa
      if (r.rating === 5) {
        const classification = await classifyReviewSentiment({
          rating: r.rating,
          text: r.texto,
        });
        if (classification.autoReplyEligible) {
          const result = await generateDraft(ctx);
          await prisma.responseLog.create({
            data: {
              reviewId: r.review_id,
              placeId: info?.place_id || '',
              brand,
              rating: r.rating,
              reviewText: r.texto,
              prompt: result.prompt,
              draft: result.draft,
              finalText: result.draft,
              action: 'APPROVED',
              llmProvider: result.provider,
              llmModel: result.model,
            },
          });
          results.push({
            reviewId: r.review_id,
            status: 'auto_approved',
            brand,
            rating: r.rating,
          });
          continue;
        }
        // 5★ no elegible (sentiment ambiguo o red flags) → tratar como 3-4★ (PENDING)
      }

      // 3-4★ (y 5★ no elegible): genera draft PENDING
      const result = await generateDraft(ctx);
      await prisma.responseLog.create({
        data: {
          reviewId: r.review_id,
          placeId: info?.place_id || '',
          brand,
          rating: r.rating,
          reviewText: r.texto,
          prompt: result.prompt,
          draft: result.draft,
          action: 'PENDING',
          llmProvider: result.provider,
          llmModel: result.model,
        },
      });
      results.push({
        reviewId: r.review_id,
        status: 'pending_cm',
        brand,
        rating: r.rating,
      });
    } catch (e) {
      results.push({
        reviewId: r.review_id,
        status: 'error',
        detail: e instanceof Error ? e.message : String(e),
        rating: r.rating,
      });
    }
  }

  // Reviews que estaban en el reviewIds pero no se encontraron en el Sheet
  const foundIds = new Set(reviewsToProcess.map((r) => r.review_id));
  for (const id of reviewIds) {
    if (!foundIds.has(id)) {
      results.push({
        reviewId: id,
        status: 'error',
        detail: 'no encontrada en el Sheet (¿n8n falló al insertar?)',
      });
    }
  }

  // Revalidar dashboard
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/inbox');
  revalidatePath('/dashboard/reviews');

  // Resumen para n8n / log
  const summary = {
    auto_approved: results.filter((r) => r.status === 'auto_approved').length,
    pending_cm: results.filter((r) => r.status === 'pending_cm').length,
    urgent_manual: results.filter((r) => r.status === 'urgent_manual').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    no_text: results.filter((r) => r.status === 'no_text').length,
    error: results.filter((r) => r.status === 'error').length,
  };

  return NextResponse.json({
    ok: true,
    processed: results.length,
    summary,
    results,
  });
}
