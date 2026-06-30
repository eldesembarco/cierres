import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  exchangeShortLivedForLongLived,
  getPageAccessTokens,
} from '@/lib/meta';

/**
 * Conecta cuentas Meta (Facebook Pages + Instagram Business) a la app.
 *
 * Flujo:
 *  1. CM va a https://developers.facebook.com/tools/explorer/, genera un User
 *     Access Token corto con los permisos requeridos (ver docs/META-SETUP.md).
 *  2. Pega ese token + un mapping de pageId → brandName en este endpoint.
 *  3. Nosotros:
 *     - Cambiamos el short-lived (1h) por un long-lived (60d) con el App Secret
 *     - Listamos /me/accounts → obtenemos page tokens (también long-lived)
 *     - Por cada Page que esté en el mapping, creamos:
 *         · MetaAccount(channel=MESSENGER, externalId=pageId)
 *         · MetaAccount(channel=INSTAGRAM_DM, externalId=igAccountId) si la
 *           Page tiene IG Business linkeada
 *     - Devolvemos el resumen de qué se creó/updateó.
 *
 * POST /api/admin/meta-accounts/connect
 * Body: {
 *   shortLivedToken: string,
 *   brandMappings: Array<{ pageId: string, brandName: string, handle?: string }>
 * }
 */

interface ConnectInput {
  shortLivedToken?: string;
  brandMappings?: Array<{
    pageId: string;
    brandName: string;
    handle?: string;
  }>;
}

interface ConnectedAccount {
  channel: 'MESSENGER' | 'INSTAGRAM_DM';
  brandName: string;
  externalId: string;
  pageName: string;
  status: 'created' | 'updated';
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 }
    );
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'META_APP_ID o META_APP_SECRET no están configurados. Seguir docs/META-SETUP.md primero.',
      },
      { status: 400 }
    );
  }

  let body: ConnectInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid JSON' },
      { status: 400 }
    );
  }

  if (!body.shortLivedToken) {
    return NextResponse.json(
      { ok: false, error: 'shortLivedToken requerido' },
      { status: 400 }
    );
  }
  if (!body.brandMappings || body.brandMappings.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'brandMappings requerido (array de { pageId, brandName }). Ejemplo: [{"pageId":"12345","brandName":"Mr Tasty"}]',
      },
      { status: 400 }
    );
  }

  // 1. Long-lived user token (60d)
  let longLivedToken: string;
  let userTokenExpiresAt: Date;
  try {
    const ext = await exchangeShortLivedForLongLived(
      appId,
      appSecret,
      body.shortLivedToken
    );
    longLivedToken = ext.accessToken;
    userTokenExpiresAt = ext.expiresAt;
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        step: 'exchange_token',
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 400 }
    );
  }

  // 2. Page tokens
  let pages: Awaited<ReturnType<typeof getPageAccessTokens>>;
  try {
    pages = await getPageAccessTokens(longLivedToken);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        step: 'get_page_tokens',
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 400 }
    );
  }

  // 3. Por cada brandMapping, hacer match con pageId y upsertar
  const mappingByPageId = new Map(
    body.brandMappings.map((m) => [m.pageId, m])
  );
  const connected: ConnectedAccount[] = [];
  const skipped: Array<{ pageId: string; reason: string }> = [];

  for (const page of pages) {
    const mapping = mappingByPageId.get(page.pageId);
    if (!mapping) {
      skipped.push({ pageId: page.pageId, reason: 'sin mapping' });
      continue;
    }

    const tokenExpiresAt = new Date(
      Math.min(
        userTokenExpiresAt.getTime(),
        Date.now() + 60 * 24 * 60 * 60 * 1000
      )
    );

    // Messenger account
    const existingMessenger = await prisma.metaAccount.findUnique({
      where: { externalId: page.pageId },
    });
    await prisma.metaAccount.upsert({
      where: { externalId: page.pageId },
      create: {
        channel: 'MESSENGER',
        externalId: page.pageId,
        brandName: mapping.brandName,
        handle: mapping.handle ?? null,
        pageName: page.pageName,
        accessToken: page.accessToken,
        tokenExpiresAt,
        active: true,
      },
      update: {
        brandName: mapping.brandName,
        handle: mapping.handle ?? null,
        pageName: page.pageName,
        accessToken: page.accessToken,
        tokenExpiresAt,
        active: true,
      },
    });
    connected.push({
      channel: 'MESSENGER',
      brandName: mapping.brandName,
      externalId: page.pageId,
      pageName: page.pageName,
      status: existingMessenger ? 'updated' : 'created',
    });

    // Instagram DM account (si la Page tiene IG Business linkeada)
    if (page.igAccountId) {
      const existingIg = await prisma.metaAccount.findUnique({
        where: { externalId: page.igAccountId },
      });
      await prisma.metaAccount.upsert({
        where: { externalId: page.igAccountId },
        create: {
          channel: 'INSTAGRAM_DM',
          externalId: page.igAccountId,
          brandName: mapping.brandName,
          handle: mapping.handle ?? null,
          pageName: page.pageName,
          // El token de la Page sirve también para IG Business linkeado
          accessToken: page.accessToken,
          tokenExpiresAt,
          active: true,
        },
        update: {
          brandName: mapping.brandName,
          handle: mapping.handle ?? null,
          pageName: page.pageName,
          accessToken: page.accessToken,
          tokenExpiresAt,
          active: true,
        },
      });
      connected.push({
        channel: 'INSTAGRAM_DM',
        brandName: mapping.brandName,
        externalId: page.igAccountId,
        pageName: page.pageName,
        status: existingIg ? 'updated' : 'created',
      });
    }
  }

  return NextResponse.json({
    ok: true,
    connected,
    skipped,
    userTokenExpiresAt: userTokenExpiresAt.toISOString(),
    hint:
      connected.length === 0
        ? 'Ningún Page del token matcheó con tus brandMappings. Verificá los pageIds.'
        : `${connected.length} cuenta(s) conectada(s). Token vence en 60 días — el cron de refresh la mantiene viva.`,
  });
}

/**
 * GET → resumen de las cuentas Meta conectadas.
 * Útil para el admin UI para ver el estado.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const accounts = await prisma.metaAccount.findMany({
    select: {
      id: true,
      channel: true,
      externalId: true,
      brandName: true,
      handle: true,
      pageName: true,
      tokenExpiresAt: true,
      active: true,
      createdAt: true,
    },
    orderBy: { brandName: 'asc' },
  });
  return NextResponse.json({
    ok: true,
    count: accounts.length,
    accounts: accounts.map((a) => ({
      ...a,
      hasToken: true,
      tokenDaysLeft: a.tokenExpiresAt
        ? Math.floor(
            (a.tokenExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
          )
        : null,
    })),
  });
}
