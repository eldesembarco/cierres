import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

/**
 * Webhook receiver de Meta (Facebook + Instagram).
 *
 * Meta hace 2 tipos de calls a este endpoint:
 *
 * 1. GET — verification challenge cuando configurás el webhook en developers.facebook.com
 *    Query: ?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=YYY
 *    Respondemos con el challenge tal cual si el verify_token matchea.
 *
 * 2. POST — eventos: mensajes nuevos, comentarios, etc.
 *    Body: { object, entry: [{ id, time, messaging?, changes?, ...}] }
 *    Headers: X-Hub-Signature-256: sha256=<HMAC>
 *
 * Eventos que manejamos:
 *  - object: 'page' → mensajes de Messenger (Página FB)
 *  - object: 'instagram' → DMs y comments de IG
 */

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;
const APP_SECRET = process.env.META_APP_SECRET;

// ────────── GET: verification challenge ──────────

export async function GET(req: NextRequest) {
  if (!VERIFY_TOKEN) {
    return NextResponse.json(
      { ok: false, error: 'META_WEBHOOK_VERIFY_TOKEN no configurado' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
}

// ────────── POST: events ──────────

interface MetaWebhookBody {
  object: 'page' | 'instagram';
  entry: Array<{
    id: string;
    time: number;
    messaging?: Array<MessagingEvent>;
    changes?: Array<ChangeEvent>;
  }>;
}

interface MessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: Array<{ type: string; payload: { url: string } }>;
  };
  read?: { watermark: number };
  delivery?: unknown;
}

interface ChangeEvent {
  field: string; // 'comments' | 'messages' | etc.
  value: {
    id?: string;
    text?: string;
    from?: { id: string; username?: string };
    media?: { id: string };
    created_time?: string;
  };
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!APP_SECRET || !signature) return false;
  const expected = crypto
    .createHmac('sha256', APP_SECRET)
    .update(rawBody)
    .digest('hex');
  const provided = signature.replace(/^sha256=/, '');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(provided, 'hex')
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256');

  // Meta requiere validar firma con APP_SECRET. Si no está configurado, rechazamos.
  if (!APP_SECRET) {
    return NextResponse.json(
      { ok: false, error: 'META_APP_SECRET no configurado' },
      { status: 500 }
    );
  }
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ ok: false, error: 'invalid signature' }, { status: 403 });
  }

  let body: MetaWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }

  const results = {
    messages_processed: 0,
    comments_processed: 0,
    errors: 0,
  };

  for (const entry of body.entry) {
    const accountExternalId = entry.id; // Page ID o IG account ID
    const account = await prisma.metaAccount.findUnique({
      where: { externalId: accountExternalId },
    });

    if (!account) {
      // Cuenta no registrada todavía — saltamos
      console.warn(`[meta-webhook] account ${accountExternalId} no registrada`);
      continue;
    }

    // Mensajes (Messenger + IG DMs)
    if (entry.messaging) {
      for (const evt of entry.messaging) {
        if (!evt.message) continue;
        try {
          await processMessage(account.id, account.channel, account.brandName, accountExternalId, evt);
          results.messages_processed++;
        } catch (e) {
          console.error('[meta-webhook] message error:', e);
          results.errors++;
        }
      }
    }

    // Comments (IG)
    if (entry.changes) {
      for (const change of entry.changes) {
        if (change.field === 'comments') {
          try {
            await processComment(account.id, account.brandName, change.value);
            results.comments_processed++;
          } catch (e) {
            console.error('[meta-webhook] comment error:', e);
            results.errors++;
          }
        }
      }
    }
  }

  // Revalidate del Inbox Meta
  revalidatePath('/dashboard/inbox-meta');
  revalidatePath('/dashboard');

  // Meta espera un 200 rápido (< 5 segs) para no reintentar
  return NextResponse.json({ ok: true, ...results });
}

async function processMessage(
  accountId: string,
  channel: 'INSTAGRAM_DM' | 'MESSENGER' | 'INSTAGRAM_COMMENT',
  brandName: string,
  pageId: string,
  evt: MessagingEvent
) {
  if (!evt.message) return;
  const isFromBrand = evt.sender.id === pageId;
  const contactId = isFromBrand ? evt.recipient.id : evt.sender.id;

  // Upsert conversation
  // Meta no nos da un conversationId limpio en cada mensaje, solo sender/recipient.
  // Usamos el contactId + accountId como clave externa lógica.
  const externalConvId = `${pageId}:${contactId}`;

  const conversation = await prisma.metaConversation.upsert({
    where: { externalId: externalConvId },
    create: {
      externalId: externalConvId,
      channel,
      accountId,
      brandName,
      contactId,
      lastMessageAt: new Date(evt.timestamp),
      lastMessagePreview: evt.message.text?.slice(0, 200),
      unread: !isFromBrand,
      windowExpiresAt: new Date(evt.timestamp + 24 * 60 * 60 * 1000),
    },
    update: {
      lastMessageAt: new Date(evt.timestamp),
      lastMessagePreview: evt.message.text?.slice(0, 200),
      unread: !isFromBrand,
      windowExpiresAt: new Date(evt.timestamp + 24 * 60 * 60 * 1000),
    },
  });

  // Insert message (idempotente por mid)
  await prisma.metaMessage.upsert({
    where: { externalId: evt.message.mid },
    create: {
      externalId: evt.message.mid,
      conversationId: conversation.id,
      fromBrand: isFromBrand,
      text: evt.message.text,
      attachmentType: evt.message.attachments?.[0]?.type,
      attachmentUrl: evt.message.attachments?.[0]?.payload?.url,
      receivedAt: new Date(evt.timestamp),
    },
    update: {},
  });
}

async function processComment(
  accountId: string,
  brandName: string,
  value: ChangeEvent['value']
) {
  if (!value.id || !value.text) return;
  await prisma.metaComment.upsert({
    where: { externalId: value.id },
    create: {
      externalId: value.id,
      channel: 'INSTAGRAM_COMMENT',
      accountId,
      brandName,
      postId: value.media?.id ?? '',
      contactId: value.from?.id ?? '',
      contactName: value.from?.username,
      text: value.text,
      receivedAt: value.created_time ? new Date(value.created_time) : new Date(),
    },
    update: {},
  });
}
