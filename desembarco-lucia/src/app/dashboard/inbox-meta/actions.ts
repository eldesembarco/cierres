'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  sendMessage as metaSendMessage,
  replyToComment as metaReplyToComment,
  type MetaAccount,
} from '@/lib/meta';
import { generateDraft, type ReviewContext } from '@/lib/llm';

/**
 * Server actions del Inbox Meta (Instagram DMs + Messenger + IG Comments).
 *
 * Mismo patrón que el Inbox de Reviews:
 *  - Generar draft IA con el classifier de tonos por marca
 *  - Editar draft
 *  - Enviar (acá sí podemos hacer real-send via API porque Meta nos lo permite
 *    en development mode con test users)
 *  - Marcar como leído / archivar
 */

interface ReplyToConversationInput {
  conversationId: string;  // ID interno de la DB
  text: string;
  edited?: boolean;
  draftLogId?: string;     // Si vino de un draft IA, link al ResponseLog
}

export async function replyToConversationAction(input: ReplyToConversationInput) {
  if (!input.text || input.text.trim().length < 2) {
    return { ok: false as const, error: 'Mensaje muy corto' };
  }

  const conv = await prisma.metaConversation.findUnique({
    where: { id: input.conversationId },
    include: { account: true },
  });

  if (!conv) return { ok: false as const, error: 'Conversation no encontrada' };
  if (!conv.account.accessToken) {
    return { ok: false as const, error: 'Sin access token configurado para esta cuenta Meta' };
  }

  const account: MetaAccount = {
    id: conv.account.id,
    externalId: conv.account.externalId,
    channel: conv.account.channel,
    brandName: conv.account.brandName,
    handle: conv.account.handle ?? undefined,
    pageName: conv.account.pageName ?? undefined,
    accessToken: conv.account.accessToken,
  };

  // Chequear ventana de 24hs
  const windowExpired =
    conv.windowExpiresAt && conv.windowExpiresAt.getTime() < Date.now();

  try {
    const result = await metaSendMessage({
      account,
      recipientId: conv.contactId,
      text: input.text.trim(),
      tag: windowExpired ? 'HUMAN_AGENT' : undefined,
    });

    // Insertar como mensaje saliente
    await prisma.metaMessage.create({
      data: {
        externalId: result.messageId,
        conversationId: conv.id,
        fromBrand: true,
        text: input.text.trim(),
        receivedAt: new Date(),
        responseLogId: input.draftLogId ?? null,
      },
    });

    // Actualizar conv (marcar leído + bump lastMessageAt)
    await prisma.metaConversation.update({
      where: { id: conv.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: input.text.slice(0, 200),
        unread: false,
      },
    });

    if (input.draftLogId) {
      await prisma.responseLog.update({
        where: { id: input.draftLogId },
        data: { action: 'SENT', sentAt: new Date(), finalText: input.text.trim() },
      });
    }

    revalidatePath('/dashboard/inbox-meta');
    revalidatePath('/dashboard');
    return { ok: true as const, messageId: result.messageId };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function generateMetaDraftAction(input: {
  conversationId: string;
}) {
  const conv = await prisma.metaConversation.findUnique({
    where: { id: input.conversationId },
    include: {
      account: true,
      messages: { orderBy: { receivedAt: 'desc' }, take: 5 },
    },
  });
  if (!conv) return { ok: false as const, error: 'Conversation no encontrada' };

  const lastMessage = conv.messages.find((m) => !m.fromBrand);
  if (!lastMessage?.text) {
    return { ok: false as const, error: 'No hay mensaje del cliente para responder' };
  }

  // Reusamos el sistema de drafts del Inbox de Reviews — el prompt está optimizado
  // para reseñas, pero la base sirve. En el futuro se puede hacer un prompt
  // específico para DMs (más conversacional, menos "respuesta pública").
  const ctx: ReviewContext = {
    reviewId: conv.externalId,
    placeId: '',
    brand: conv.brandName,
    localName: conv.account.pageName ?? conv.brandName,
    rating: 0, // n/a para DMs
    reviewText: lastMessage.text,
    reviewerName: conv.contactName ?? 'Cliente',
    reviewDate: lastMessage.receivedAt.toISOString(),
  };

  try {
    const result = await generateDraft(ctx);
    const log = await prisma.responseLog.create({
      data: {
        reviewId: conv.externalId,
        placeId: '',
        brand: conv.brandName,
        rating: 0,
        reviewText: lastMessage.text,
        prompt: result.prompt,
        draft: result.draft,
        action: 'PENDING',
        llmProvider: result.provider,
        llmModel: result.model,
      },
    });
    return {
      ok: true as const,
      logId: log.id,
      draft: result.draft,
      provider: result.provider,
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

interface ReplyToCommentInput {
  commentId: string; // ID interno de la DB
  text: string;
}

export async function replyToCommentAction(input: ReplyToCommentInput) {
  if (!input.text || input.text.trim().length < 2) {
    return { ok: false as const, error: 'Respuesta muy corta' };
  }

  const comment = await prisma.metaComment.findUnique({
    where: { id: input.commentId },
    include: { account: true },
  });

  if (!comment) return { ok: false as const, error: 'Comment no encontrado' };
  if (!comment.account.accessToken) {
    return { ok: false as const, error: 'Sin access token configurado' };
  }

  const account: MetaAccount = {
    id: comment.account.id,
    externalId: comment.account.externalId,
    channel: comment.account.channel,
    brandName: comment.account.brandName,
    accessToken: comment.account.accessToken,
  };

  try {
    await metaReplyToComment(account, comment.externalId, input.text.trim());
    await prisma.metaComment.update({
      where: { id: comment.id },
      data: {
        replied: true,
        reply: input.text.trim(),
        repliedAt: new Date(),
      },
    });
    revalidatePath('/dashboard/inbox-meta');
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function markConversationReadAction(conversationId: string) {
  await prisma.metaConversation.update({
    where: { id: conversationId },
    data: { unread: false },
  });
  revalidatePath('/dashboard/inbox-meta');
  return { ok: true as const };
}

export async function archiveConversationAction(conversationId: string) {
  await prisma.metaConversation.update({
    where: { id: conversationId },
    data: { archived: true },
  });
  revalidatePath('/dashboard/inbox-meta');
  return { ok: true as const };
}
