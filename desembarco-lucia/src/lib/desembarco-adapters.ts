/**
 * Adapter: transforma data real (Sheets + DB) al formato `DashboardData`
 * que esperan los componentes del nuevo diseño "Bitácora El Desembarco".
 */

import { getReviews, getLocales, type ReviewRow } from './sheets';
import { prisma } from './prisma';
import type {
  DashboardData,
  Review,
  ReviewStatus,
  StatCard,
  CmQueueItem,
  BranchRanking,
} from '@/types/reviews';

/**
 * Item de review en formato Inbox (compatible con DraftPanel/ReviewCard).
 * Mantiene la data necesaria para el flow IA: generar draft, regenerar, enviar.
 */
export interface InboxReviewItem {
  reviewId: string;
  reviewName: string;
  placeId: string;
  brand: string;
  localName: string;
  rating: number;
  reviewText: string;
  reviewerName: string;
  reviewDate: string;
  imagenes?: string[];
  /** Si la review ya fue respondida — para mostrar la respuesta en vez del flow IA */
  respondida: boolean;
  respuesta?: string;
  respuestaFecha?: string;
}

/**
 * Extiende DashboardData con la lista en formato Inbox para que el panel
 * principal del home pueda usar el flow IA completo.
 */
export interface DashboardDataExtended extends DashboardData {
  inboxItems: InboxReviewItem[];
}

function inferBrand(local: string): string {
  const l = local.toLowerCase();
  if (l.includes('tasty')) return 'Mr Tasty';
  if (l.includes('mila')) return 'Mila & Go';
  if (l.includes('desembarco')) return 'El Desembarco';
  return 'El Desembarco';
}

const TZ = 'America/Argentina/Buenos_Aires';

function toInitial(name: string | undefined): string {
  return (name?.trim().charAt(0) || '?').toUpperCase();
}

function fmtRelative(date: string | null | undefined): string {
  if (!date) return 'sin fecha';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date.slice(0, 10);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 1) return 'hace instantes';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'ayer';
  if (diffDays < 7) return `hace ${diffDays} días`;
  if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)} sem`;
  return `hace ${Math.floor(diffDays / 30)} meses`;
}

function fmtClock(now = new Date()): string {
  return now.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  });
}

function ratingBucket(r: number): 1 | 2 | 3 | 4 | 5 {
  if (r >= 5) return 5;
  if (r === 4) return 4;
  if (r === 3) return 3;
  if (r === 2) return 2;
  return 1;
}

/**
 * Status de la review según los logs IA + rating:
 *  - auto:      hay ResponseLog APPROVED/SENT con llmProvider (auto-aprobada por classifier)
 *  - escalated: rating ≤ 2 sin respuesta (a la cola del CM)
 *  - pending:   resto (mid-rating sin atender)
 */
function deriveStatus(
  review: ReviewRow,
  responseLogs: Map<string, { action: string; llmProvider: string | null; finalText: string | null }>
): ReviewStatus {
  const log = responseLogs.get(review.review_id);
  if (review.respondida || (log && (log.action === 'SENT' || log.action === 'APPROVED'))) {
    return log?.llmProvider ? 'auto' : 'auto';
  }
  if (review.rating > 0 && review.rating <= 2) return 'escalated';
  return 'pending';
}

export async function getDesembarcoDashboardData(): Promise<DashboardDataExtended> {
  const [reviews, locales, logs] = await Promise.all([
    getReviews().catch(() => [] as ReviewRow[]),
    getLocales().catch(() => []),
    prisma.responseLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5000,
    }).catch(() => []),
  ]);

  // Map de logs por reviewId (más reciente gana)
  const logsByReview = new Map<
    string,
    { action: string; llmProvider: string | null; finalText: string | null }
  >();
  for (const l of logs) {
    if (!logsByReview.has(l.reviewId)) {
      logsByReview.set(l.reviewId, {
        action: l.action,
        llmProvider: l.llmProvider,
        finalText: l.finalText,
      });
    }
  }

  // ── Reviews recientes para el panel principal ──
  // Mix balanceado: últimas reviews por fecha SIN priorizar negativas.
  // Tomamos las 30 más recientes y de ahí filtramos las que tienen contenido (texto o respuesta).
  const sortedRecent = [...reviews]
    .filter((r) => r.review_id)
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
    .slice(0, 30)
    .filter((r) => r.texto || r.respuesta) // priorizar las que tienen contenido visible
    .slice(0, 12);

  const reviewsForPanel: Review[] = sortedRecent.map((r) => {
    const status = deriveStatus(r, logsByReview);
    const log = logsByReview.get(r.review_id);
    const review: Review = {
      id: r.review_id,
      authorName: r.autor || 'Anónimo',
      authorInitial: toInitial(r.autor),
      rating: ratingBucket(r.rating),
      branch: r.local,
      text: r.texto || '(Solo calificación)',
      status,
      postedAt: r.fecha,
      relativeTime: fmtRelative(r.fecha),
    };
    if (log?.finalText) {
      review.reply = log.finalText;
    } else if (r.respuesta) {
      review.reply = r.respuesta;
    }
    if (status === 'escalated') {
      // SLA mock — 24hs desde la review
      const slaTotalHours = 24;
      const ageHours = r.fecha
        ? Math.floor((Date.now() - new Date(r.fecha).getTime()) / 36e5)
        : 0;
      review.escalation = {
        assignedTo: 'Equipo CM',
        slaHoursLeft: Math.max(0, slaTotalHours - ageHours),
        priority: r.rating === 1 ? 'alta' : 'media',
      };
    }
    return review;
  });

  // ── Stats globales ──
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const yesterdayMs = todayMs - 24 * 36e5;

  const isToday = (d: string) => {
    const t = new Date(d).getTime();
    return !isNaN(t) && t >= todayMs;
  };
  const isYesterday = (d: string) => {
    const t = new Date(d).getTime();
    return !isNaN(t) && t >= yesterdayMs && t < todayMs;
  };

  const reviewsToday = reviews.filter((r) => isToday(r.fecha));
  const reviewsYesterday = reviews.filter((r) => isYesterday(r.fecha));
  const autoRespondedToday = reviewsToday.filter(
    (r) => logsByReview.get(r.review_id)?.action === 'APPROVED' ||
           logsByReview.get(r.review_id)?.action === 'SENT'
  );
  const escalatedTotal = reviews.filter(
    (r) => !r.respondida && r.rating > 0 && r.rating <= 2
  );
  const escalatedToday = reviewsToday.filter(
    (r) => !r.respondida && r.rating > 0 && r.rating <= 2
  );
  const escalatedYesterday = reviewsYesterday.filter(
    (r) => !r.respondida && r.rating > 0 && r.rating <= 2
  );

  const validRatings = reviews.filter((r) => r.rating > 0);
  const avgRating =
    validRatings.length > 0
      ? validRatings.reduce((sum, r) => sum + r.rating, 0) / validRatings.length
      : 0;

  const autoPct =
    reviewsToday.length > 0
      ? Math.round((autoRespondedToday.length / reviewsToday.length) * 100)
      : 0;

  const stats: StatCard[] = [
    {
      label: 'Reseñas hoy',
      value: reviewsToday.length.toLocaleString('es-AR'),
      delta:
        reviewsYesterday.length > 0
          ? `${reviewsToday.length - reviewsYesterday.length >= 0 ? '+' : ''}${
              reviewsToday.length - reviewsYesterday.length
            } vs ayer`
          : 'inicio del piloto',
      deltaDirection: reviewsToday.length >= reviewsYesterday.length ? 'up' : 'down',
      tone: 'gold',
    },
    {
      label: 'Auto-respondidas',
      value: autoRespondedToday.length.toLocaleString('es-AR'),
      unit: reviewsToday.length > 0 ? `/ ${autoPct}%` : undefined,
      delta: 'Drafts aprobados por classifier',
      deltaDirection: 'up',
      tone: 'moss',
    },
    {
      label: 'Escaladas al CM',
      value: escalatedTotal.length.toLocaleString('es-AR'),
      delta:
        escalatedYesterday.length > 0
          ? `${escalatedToday.length - escalatedYesterday.length >= 0 ? '+' : ''}${
              escalatedToday.length - escalatedYesterday.length
            } vs ayer`
          : `${escalatedToday.length} hoy`,
      deltaDirection: escalatedToday.length > escalatedYesterday.length ? 'down' : 'up',
      tone: 'ember',
    },
    {
      label: 'Rating promedio',
      value: avgRating.toFixed(2),
      unit: '/ 5',
      delta: `${validRatings.length.toLocaleString('es-AR')} reseñas totales`,
      deltaDirection: 'up',
      tone: 'wood',
    },
  ];

  // ── Cola del CM ──
  const cmQueue: CmQueueItem[] = escalatedTotal
    .sort((a, b) => {
      const ratingDiff = a.rating - b.rating; // 1★ primero
      if (ratingDiff !== 0) return ratingDiff;
      return (b.fecha || '').localeCompare(a.fecha || '');
    })
    .slice(0, 6)
    .map((r, idx) => {
      const ageHours = r.fecha
        ? Math.floor((Date.now() - new Date(r.fecha).getTime()) / 36e5)
        : 0;
      return {
        id: r.review_id,
        position: idx + 1,
        authorName: r.autor || 'Anónimo',
        branch: r.local,
        rating: ratingBucket(r.rating),
        preview: (r.texto || '(sin texto)').slice(0, 80),
        slaHoursLeft: Math.max(0, 24 - ageHours),
      };
    });

  // ── Branch ranking (top 5 por rating + reviews) ──
  const byBranch = new Map<string, { sum: number; count: number }>();
  for (const r of reviews) {
    if (r.rating <= 0) continue;
    const cur = byBranch.get(r.local) || { sum: 0, count: 0 };
    cur.sum += r.rating;
    cur.count += 1;
    byBranch.set(r.local, cur);
  }
  const branchRanking: BranchRanking[] = Array.from(byBranch.entries())
    .map(([name, { sum, count }]) => ({ name, score: sum / count, count }))
    .filter((b) => b.count >= 3) // mínimo 3 reviews para entrar al ranking
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((b, idx) => ({
      position: idx + 1,
      name: b.name,
      score: Math.round(b.score * 10) / 10,
      percent: Math.round((b.score / 5) * 100),
    }));

  // Si no hay suficientes branches con 3+ reviews, fallback al top general
  const finalBranches: BranchRanking[] =
    branchRanking.length > 0
      ? branchRanking
      : Array.from(byBranch.entries())
          .map(([name, { sum, count }]) => ({
            name,
            score: sum / count,
            count,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map((b, idx) => ({
            position: idx + 1,
            name: b.name,
            score: Math.round(b.score * 10) / 10,
            percent: Math.round((b.score / 5) * 100),
          }));

  // ── Meta ──
  const activeLocales = locales.filter((l) => l.activo).length;
  const meta = {
    totalLocations: activeLocales || locales.length,
    lastSync: 'hace pocos min',
    operator: 'PILOTO · POLEJAVETZKY',
    panelTimestamp: fmtClock(),
  };

  // ── Reviews en formato Inbox (con flow IA) ──
  // Tomamos las 60 más recientes con texto, mezcla positivas/negativas/respondidas.
  const localById = new Map(locales.map((l) => [l.local, l]));
  const inboxItems: InboxReviewItem[] = [...reviews]
    .filter((r) => r.review_id && r.texto && r.texto.trim().length > 0)
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
    .slice(0, 60)
    .map((r) => {
      const info = localById.get(r.local);
      const log = logsByReview.get(r.review_id);
      return {
        reviewId: r.review_id,
        reviewName: info?.location_name
          ? `${info.location_name}/reviews/${r.review_id}`
          : r.review_id,
        placeId: info?.place_id || '',
        brand: inferBrand(r.local),
        localName: r.local,
        rating: r.rating,
        reviewText: r.texto,
        reviewerName: r.autor,
        reviewDate: r.fecha,
        imagenes: r.imagenes,
        respondida:
          r.respondida ||
          (log && (log.action === 'SENT' || log.action === 'APPROVED')) ||
          false,
        respuesta: log?.finalText ?? r.respuesta ?? undefined,
        respuestaFecha: r.respuesta_fecha,
      };
    });

  return {
    meta,
    stats,
    reviews: reviewsForPanel,
    cmQueue,
    branches: finalBranches,
    inboxItems,
  };
}
