import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Refresh de Page Access Tokens de Meta antes de que venzan.
 *
 * Los page tokens largos viven 60 días. Meta permite "refrescarlos" llamando
 * /me/accounts con el token ANTES de que venza — devuelve un nuevo token con
 * 60 días de vida. Si dejamos vencer, hay que hacer todo el flow OAuth
 * manualmente de nuevo.
 *
 * Este cron debería correrse 1× por día (ej. 04:00 UTC). Refresca los tokens
 * que vencen en menos de 10 días.
 *
 * GET /api/cron/refresh-meta-tokens
 * Header: x-webhook-secret
 */

const REFRESH_THRESHOLD_DAYS = 10;
const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

interface RefreshResult {
  pageId: string;
  brandName: string;
  status: 'refreshed' | 'failed' | 'skipped';
  daysLeftBefore?: number;
  daysLeftAfter?: number;
  error?: string;
}

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
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 }
    );
  }

  const threshold = new Date(
    Date.now() + REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
  );

  // Buscamos cuentas activas cuyo token vence pronto.
  // De Messenger sólo, porque IG_DM usa el mismo Page token.
  const accounts = await prisma.metaAccount.findMany({
    where: {
      active: true,
      channel: 'MESSENGER',
      tokenExpiresAt: { not: null, lte: threshold },
    },
  });

  const results: RefreshResult[] = [];

  for (const account of accounts) {
    const daysLeftBefore = account.tokenExpiresAt
      ? Math.floor(
          (account.tokenExpiresAt.getTime() - Date.now()) /
            (24 * 60 * 60 * 1000)
        )
      : -1;

    if (!account.accessToken) {
      results.push({
        pageId: account.externalId,
        brandName: account.brandName,
        status: 'skipped',
        daysLeftBefore,
        error: 'sin token',
      });
      continue;
    }

    try {
      // Llamar /<page_id>?fields=access_token con el current token
      // — Meta devuelve un nuevo token (también long-lived).
      const url = `${GRAPH_BASE}/${account.externalId}?fields=access_token&access_token=${encodeURIComponent(account.accessToken)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }
      const json = (await res.json()) as { access_token?: string };
      if (!json.access_token) {
        throw new Error('respuesta sin access_token');
      }

      const newExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      // Actualizamos el token en MESSENGER + en el INSTAGRAM_DM linkeado
      // (que usa el mismo Page token).
      await prisma.metaAccount.updateMany({
        where: {
          OR: [
            { id: account.id },
            // IG account asociada a esta misma marca/page
            // (no tenemos FK directo, matchemos por brandName + pageName)
            {
              channel: 'INSTAGRAM_DM',
              brandName: account.brandName,
              pageName: account.pageName,
            },
          ],
        },
        data: {
          accessToken: json.access_token,
          tokenExpiresAt: newExpiry,
        },
      });

      const daysLeftAfter = Math.floor(
        (newExpiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );
      results.push({
        pageId: account.externalId,
        brandName: account.brandName,
        status: 'refreshed',
        daysLeftBefore,
        daysLeftAfter,
      });
    } catch (e) {
      results.push({
        pageId: account.externalId,
        brandName: account.brandName,
        status: 'failed',
        daysLeftBefore,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const refreshed = results.filter((r) => r.status === 'refreshed').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  return NextResponse.json({
    ok: failed === 0,
    summary: {
      checked: accounts.length,
      refreshed,
      failed,
      threshold_days: REFRESH_THRESHOLD_DAYS,
    },
    results,
    hint:
      accounts.length === 0
        ? 'Ningún token vence pronto. Todo OK.'
        : `${refreshed}/${accounts.length} renovados, ${failed} fallaron.`,
  });
}
