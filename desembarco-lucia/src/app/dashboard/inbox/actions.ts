'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  generateDraft,
  generateDraftWithAllProviders,
  classifyReviewSentiment,
  type ReviewContext,
  type Provider,
  type ClassifyResult,
} from '@/lib/llm';
import { replyToReview } from '@/lib/gbp';

/**
 * Server actions del Inbox CM.
 *
 * Flow:
 *   1. CM ve review pendiente en /dashboard/inbox
 *   2. Click "Generar draft" → generateDraftAction → crea ResponseLog (PENDING) con draft de Gemini
 *   3. CM edita el draft en el textarea
 *   4. Click "Enviar" → submitReplyAction → llama GBP reply + marca log como SENT
 *      Click "Descartar" → discardDraftAction → marca log como DISCARDED
 *
 * SEGURIDAD: Cuando se sume NextAuth, agregar `auth()` check al inicio de cada action
 * y guardar `cmUserId` en el log. Hoy queda anónimo hasta que la auth esté.
 */

interface GenerateDraftInput {
  reviewId: string;
  reviewName: string; // resource name de la API: accounts/X/locations/Y/reviews/Z
  placeId: string;
  brand: string;
  localName: string;
  rating: number;
  reviewText: string;
  reviewerName: string;
  reviewDate: string;
}

export async function generateDraftAction(input: GenerateDraftInput) {
  // Si ya hay un draft PENDING para este review, reusarlo (idempotencia)
  const existing = await prisma.responseLog.findFirst({
    where: { reviewId: input.reviewId, action: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) {
    return {
      ok: true as const,
      logId: existing.id,
      draft: existing.draft,
      reused: true,
    };
  }

  const ctx: ReviewContext = {
    reviewId: input.reviewId,
    placeId: input.placeId,
    brand: input.brand,
    localName: input.localName,
    rating: input.rating,
    reviewText: input.reviewText,
    reviewerName: input.reviewerName,
    reviewDate: input.reviewDate,
  };

  let draft: string;
  let prompt: string;
  let provider: string;
  let model: string;
  try {
    const result = await generateDraft(ctx);
    draft = result.draft;
    prompt = result.prompt;
    provider = result.provider;
    model = result.model;
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : 'Error generando draft',
    };
  }

  const log = await prisma.responseLog.create({
    data: {
      reviewId: input.reviewId,
      placeId: input.placeId,
      brand: input.brand,
      rating: input.rating,
      reviewText: input.reviewText,
      prompt,
      draft,
      action: 'PENDING',
      llmProvider: provider,
      llmModel: model,
    },
  });

  revalidatePath('/dashboard/inbox');
  return { ok: true as const, logId: log.id, draft, reused: false };
}

interface SubmitReplyInput {
  logId: string;
  reviewName: string; // resource name: accounts/X/locations/Y/reviews/Z
  finalText: string;
  edited: boolean; // true si CM modificó el draft generado
}

export async function submitReplyAction(input: SubmitReplyInput) {
  const log = await prisma.responseLog.findUnique({ where: { id: input.logId } });
  if (!log) return { ok: false as const, error: 'Log no encontrado' };
  if (log.action === 'SENT') return { ok: false as const, error: 'Ya fue enviado' };

  // 1) Mandar la respuesta a Google
  try {
    await replyToReview(input.reviewName, input.finalText);
  } catch (e) {
    return {
      ok: false as const,
      error: `GBP reply falló: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // 2) Marcar el log
  await prisma.responseLog.update({
    where: { id: input.logId },
    data: {
      finalText: input.finalText,
      action: input.edited ? 'EDITED' : 'APPROVED',
      sentAt: new Date(),
    },
  });

  // 3) Después transicionar a SENT (separado para que el SENT siempre indique éxito en GBP)
  await prisma.responseLog.update({
    where: { id: input.logId },
    data: { action: 'SENT' },
  });

  revalidatePath('/dashboard/inbox');
  revalidatePath('/dashboard/reviews');
  return { ok: true as const };
}

export async function discardDraftAction(logId: string) {
  await prisma.responseLog.update({
    where: { id: logId },
    data: { action: 'DISCARDED' },
  });
  revalidatePath('/dashboard/inbox');
  return { ok: true as const };
}

/**
 * Genera drafts con TODOS los providers en paralelo y guarda un log PENDING por cada uno.
 * El UI muestra ambos lado a lado y el CM elige uno con "Usar este" (que descarta el otro).
 */
export async function compareProvidersAction(input: GenerateDraftInput) {
  const ctx: ReviewContext = {
    reviewId: input.reviewId,
    placeId: input.placeId,
    brand: input.brand,
    localName: input.localName,
    rating: input.rating,
    reviewText: input.reviewText,
    reviewerName: input.reviewerName,
    reviewDate: input.reviewDate,
  };

  const results = await generateDraftWithAllProviders(ctx);

  const items: {
    provider: Provider;
    logId?: string;
    draft?: string;
    model?: string;
    error?: string;
  }[] = [];

  for (const r of results) {
    if (r.error || !r.result) {
      items.push({ provider: r.provider, error: r.error ?? 'Error desconocido' });
      continue;
    }
    const log = await prisma.responseLog.create({
      data: {
        reviewId: input.reviewId,
        placeId: input.placeId,
        brand: input.brand,
        rating: input.rating,
        reviewText: input.reviewText,
        prompt: r.result.prompt,
        draft: r.result.draft,
        action: 'PENDING',
        llmProvider: r.result.provider,
        llmModel: r.result.model,
      },
    });
    items.push({
      provider: r.provider,
      logId: log.id,
      draft: r.result.draft,
      model: r.result.model,
    });
  }

  revalidatePath('/dashboard/inbox');
  return { ok: true as const, items };
}

/**
 * Cuando el CM elige uno de los drafts comparados, descartamos los otros.
 */
export async function chooseComparedDraftAction(input: {
  chosenLogId: string;
  discardedLogIds: string[];
}) {
  await prisma.responseLog.updateMany({
    where: { id: { in: input.discardedLogIds } },
    data: { action: 'DISCARDED' },
  });
  revalidatePath('/dashboard/inbox');
  return { ok: true as const };
}

/**
 * Clasifica una review con el sentiment classifier.
 * Devuelve si es elegible para auto-respuesta.
 */
export async function classifyReviewAction(input: {
  rating: number;
  text: string;
}): Promise<ClassifyResult> {
  return classifyReviewSentiment(input);
}

/**
 * Para una review identificada como elegible (5★ positiva), genera draft
 * y lo deja en estado APPROVED automáticamente. NO envía a Google todavía
 * (eso requiere allowlist GBP). El CM puede después hacer "Enviar todos
 * los aprobados" en batch o se mandan automáticamente cuando esté allowlist.
 */
export async function generateAutoReplyDraftAction(input: GenerateDraftInput) {
  // 1. Clasificar primero — solo procesar si elegible
  const classification = await classifyReviewSentiment({
    rating: input.rating,
    text: input.reviewText,
  });

  if (!classification.autoReplyEligible) {
    return {
      ok: false as const,
      error: `No elegible: sentiment=${classification.sentiment}, confidence=${classification.confidence}, redFlags=${classification.redFlags.length}`,
      classification,
    };
  }

  // 2. Generar draft
  const ctx: ReviewContext = {
    reviewId: input.reviewId,
    placeId: input.placeId,
    brand: input.brand,
    localName: input.localName,
    rating: input.rating,
    reviewText: input.reviewText,
    reviewerName: input.reviewerName,
    reviewDate: input.reviewDate,
  };

  let draft: string;
  let prompt: string;
  let provider: string;
  let model: string;
  try {
    const result = await generateDraft(ctx);
    draft = result.draft;
    prompt = result.prompt;
    provider = result.provider;
    model = result.model;
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : 'Error generando draft',
      classification,
    };
  }

  // 3. Crear log con action APPROVED (auto-aprobado)
  const log = await prisma.responseLog.create({
    data: {
      reviewId: input.reviewId,
      placeId: input.placeId,
      brand: input.brand,
      rating: input.rating,
      reviewText: input.reviewText,
      prompt,
      draft,
      finalText: draft,
      action: 'APPROVED',
      llmProvider: provider,
      llmModel: model,
    },
  });

  revalidatePath('/dashboard/inbox');
  revalidatePath('/dashboard/admin/logs');
  return {
    ok: true as const,
    logId: log.id,
    draft,
    classification,
  };
}

/**
 * Marca un draft como "enviado manualmente" — el CM lo pegó en Google Business
 * Profile Manager directamente. Útil mientras no tengamos GBP API allowlist.
 *
 * Solo actualiza el log: NO llama a la API de Google (eso requiere allowlist).
 */
export async function markManuallySentAction(input: {
  logId: string;
  finalText: string;
  edited: boolean;
}) {
  const log = await prisma.responseLog.findUnique({ where: { id: input.logId } });
  if (!log) return { ok: false as const, error: 'Log no encontrado' };
  if (log.action === 'SENT') return { ok: false as const, error: 'Ya fue enviado' };

  await prisma.responseLog.update({
    where: { id: input.logId },
    data: {
      finalText: input.finalText,
      action: 'SENT',
      sentAt: new Date(),
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/inbox');
  revalidatePath('/dashboard/reviews');
  return { ok: true as const };
}

/**
 * Respuesta MANUAL del CM — sin pasar por IA.
 * El CM escribe el texto desde cero y lo envía a Google.
 * Ideal para críticas (1-2★) o casos delicados donde la IA no aplica.
 */
export async function submitManualReplyAction(input: {
  reviewId: string;
  reviewName: string;
  placeId: string;
  brand: string;
  localName: string;
  rating: number;
  reviewText: string;
  reviewerName: string;
  reviewDate: string;
  finalText: string;
}) {
  if (!input.finalText || input.finalText.trim().length < 10) {
    return {
      ok: false as const,
      error: 'La respuesta es demasiado corta (mínimo 10 caracteres)',
    };
  }

  // 1) Crear log con action APPROVED, sin draft IA, prompt indicativo
  const log = await prisma.responseLog.create({
    data: {
      reviewId: input.reviewId,
      placeId: input.placeId,
      brand: input.brand,
      rating: input.rating,
      reviewText: input.reviewText,
      prompt: '[respuesta manual del CM, sin IA]',
      draft: '',
      finalText: input.finalText.trim(),
      action: 'APPROVED',
      llmProvider: null,
      llmModel: 'manual',
    },
  });

  // 2) Mandar a Google
  try {
    await replyToReview(input.reviewName, input.finalText.trim());
  } catch (e) {
    // No fallamos: dejamos el log APPROVED. El user puede reintentar el envío
    // cuando el allowlist GBP esté listo.
    return {
      ok: false as const,
      logId: log.id,
      error: `GBP reply falló (queda APPROVED en DB): ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
  }

  // 3) Marcar SENT
  await prisma.responseLog.update({
    where: { id: log.id },
    data: { action: 'SENT', sentAt: new Date() },
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/inbox');
  revalidatePath('/dashboard/reviews');
  return { ok: true as const, logId: log.id };
}

/**
 * Regenera el draft de un ResponseLog existente sin crear uno nuevo.
 * Marca el log actual como DISCARDED y genera uno nuevo PENDING.
 * Permite explorar variantes sin spam de logs.
 */
export async function regenerateDraftAction(input: GenerateDraftInput & { previousLogId: string }) {
  // Marcar el draft anterior como descartado (auditoría: el CM no le gustó)
  await prisma.responseLog.update({
    where: { id: input.previousLogId },
    data: { action: 'DISCARDED' },
  });

  const ctx: ReviewContext = {
    reviewId: input.reviewId,
    placeId: input.placeId,
    brand: input.brand,
    localName: input.localName,
    rating: input.rating,
    reviewText: input.reviewText,
    reviewerName: input.reviewerName,
    reviewDate: input.reviewDate,
  };

  let draft: string;
  let prompt: string;
  let provider: string;
  let model: string;
  try {
    const result = await generateDraft(ctx);
    draft = result.draft;
    prompt = result.prompt;
    provider = result.provider;
    model = result.model;
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : 'Error regenerando draft',
    };
  }

  const log = await prisma.responseLog.create({
    data: {
      reviewId: input.reviewId,
      placeId: input.placeId,
      brand: input.brand,
      rating: input.rating,
      reviewText: input.reviewText,
      prompt,
      draft,
      action: 'PENDING',
      llmProvider: provider,
      llmModel: model,
    },
  });

  revalidatePath('/dashboard/inbox');
  return { ok: true as const, logId: log.id, draft };
}
