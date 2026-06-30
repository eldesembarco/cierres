/**
 * Meta Graph API client (Instagram + Messenger).
 *
 * Documentación oficial:
 *   - Instagram: https://developers.facebook.com/docs/instagram-platform
 *   - Messenger: https://developers.facebook.com/docs/messenger-platform
 *
 * Auth: Long-lived Page Access Token (60 días, refrescable).
 *       Se guarda en `MetaAccount.accessToken` por marca/página.
 *
 * Estado: SKELETON con tipos + funciones que devuelven placeholders.
 *         Se conecta a la API real cuando tengamos los tokens del usuario.
 *         Estructura ya queda definida para integración rápida.
 */

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ────────── Tipos ──────────

export type MetaChannel = 'INSTAGRAM_DM' | 'MESSENGER' | 'INSTAGRAM_COMMENT';

export interface MetaAccount {
  id: string;
  externalId: string;
  channel: MetaChannel;
  brandName: string;
  handle?: string;
  pageName?: string;
  accessToken: string;
}

export interface MetaConversation {
  externalId: string;
  channel: MetaChannel;
  contactId: string;
  contactName?: string;
  contactImage?: string;
  lastMessageAt: Date;
  lastMessagePreview?: string;
  windowExpiresAt?: Date;
}

export interface MetaMessage {
  externalId: string;
  fromBrand: boolean;
  text?: string;
  attachmentType?: string;
  attachmentUrl?: string;
  receivedAt: Date;
}

export interface MetaComment {
  externalId: string;
  postId: string;
  postCaption?: string;
  postUrl?: string;
  contactId: string;
  contactName?: string;
  text: string;
  receivedAt: Date;
}

// ────────── Helpers ──────────

async function graphFetch<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`;
  const sep = url.includes('?') ? '&' : '?';
  const fullUrl = `${url}${sep}access_token=${encodeURIComponent(accessToken)}`;

  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Meta Graph ${res.status} ${path}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

// ────────── Listar conversaciones ──────────

interface GraphConversationsResponse {
  data: Array<{
    id: string;
    updated_time: string;
    participants: { data: Array<{ id: string; name?: string }> };
    snippet?: string;
    message_count?: number;
    can_reply?: boolean;
  }>;
  paging?: { next?: string };
}

export async function listConversations(
  account: MetaAccount,
  options: { limit?: number; after?: string } = {}
): Promise<MetaConversation[]> {
  const platform = account.channel === 'INSTAGRAM_DM' ? 'instagram' : 'messenger';
  const path = `/${account.externalId}/conversations`;
  const params = new URLSearchParams({
    platform,
    fields: 'id,updated_time,participants,snippet,message_count,can_reply',
    limit: String(options.limit ?? 50),
  });
  if (options.after) params.append('after', options.after);

  const json = await graphFetch<GraphConversationsResponse>(
    `${path}?${params}`,
    account.accessToken
  );

  return json.data.map((c) => {
    const otherParticipant = c.participants.data.find((p) => p.id !== account.externalId);
    return {
      externalId: c.id,
      channel: account.channel,
      contactId: otherParticipant?.id ?? '',
      contactName: otherParticipant?.name,
      lastMessageAt: new Date(c.updated_time),
      lastMessagePreview: c.snippet,
      // 24hr window: si can_reply es true, está dentro
      windowExpiresAt: c.can_reply
        ? new Date(new Date(c.updated_time).getTime() + 24 * 60 * 60 * 1000)
        : undefined,
    };
  });
}

// ────────── Listar mensajes de una conversación ──────────

interface GraphMessagesResponse {
  data: Array<{
    id: string;
    created_time: string;
    from?: { id: string; name?: string };
    to?: { data: Array<{ id: string }> };
    message?: string;
    attachments?: { data: Array<{ mime_type?: string; image_data?: { url: string } }> };
  }>;
}

export async function listMessages(
  account: MetaAccount,
  conversationId: string
): Promise<MetaMessage[]> {
  const json = await graphFetch<GraphMessagesResponse>(
    `/${conversationId}?fields=messages{id,created_time,from,to,message,attachments}`,
    account.accessToken
  );
  // En la práctica Meta devuelve messages como sub-resource. Adaptamos.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages = (json as any).messages?.data ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return messages.map((m: any) => ({
    externalId: m.id,
    fromBrand: m.from?.id === account.externalId,
    text: m.message,
    attachmentType: m.attachments?.data?.[0]?.mime_type,
    attachmentUrl: m.attachments?.data?.[0]?.image_data?.url,
    receivedAt: new Date(m.created_time),
  }));
}

// ────────── Enviar mensaje ──────────

interface SendMessageInput {
  account: MetaAccount;
  recipientId: string;  // PSID o IGSID
  text: string;
  // Si pasaste 24hs, requiere tag. Mensajes "human_agent" permiten extender hasta 7 días.
  tag?: 'HUMAN_AGENT' | 'CONFIRMED_EVENT_UPDATE' | 'POST_PURCHASE_UPDATE';
}

export async function sendMessage(input: SendMessageInput): Promise<{ messageId: string }> {
  const { account, recipientId, text, tag } = input;
  const path = `/${account.externalId}/messages`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = {
    recipient: { id: recipientId },
    message: { text },
    messaging_type: tag ? 'MESSAGE_TAG' : 'RESPONSE',
  };
  if (tag) body.tag = tag;

  const json = await graphFetch<{ message_id: string; recipient_id: string }>(
    path,
    account.accessToken,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );

  return { messageId: json.message_id };
}

// ────────── Comentarios de Instagram ──────────

interface GraphCommentsResponse {
  data: Array<{
    id: string;
    text: string;
    timestamp: string;
    from?: { id: string; username?: string };
    media?: { id: string; permalink?: string; caption?: string };
  }>;
  paging?: { next?: string };
}

/**
 * Lista comentarios recientes recibidos en posts de la cuenta IG.
 * Para esto se usa /me/conversations o webhooks (preferido).
 * Acá listamos directamente los comments.
 */
export async function listRecentComments(
  account: MetaAccount,
  options: { limit?: number } = {}
): Promise<MetaComment[]> {
  // Endpoint para comments en cuentas IG Business: requires permission `instagram_manage_comments`
  // Path típico: /{ig-user-id}/media → cada media tiene .comments{...}
  // Por simplicidad, este skeleton asume que la app webhook los recibe push.
  // Esta función queda para una operación de "refresh manual" si querés.
  void account;
  void options;

  // TODO: implementar con paginación cuando estén los tokens reales
  return [];
}

export async function replyToComment(
  account: MetaAccount,
  commentId: string,
  message: string
): Promise<{ commentId: string }> {
  const json = await graphFetch<{ id: string }>(
    `/${commentId}/replies`,
    account.accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ message }),
    }
  );
  return { commentId: json.id };
}

// ────────── Token management ──────────

interface ExtendTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // segundos
}

/**
 * Cambia un token de corta vida (1 hora) por uno de larga vida (60 días).
 * Lo usamos al setup inicial cuando el user nos pasa el token de la app.
 */
export async function exchangeShortLivedForLongLived(
  appId: string,
  appSecret: string,
  shortLivedToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const url = `${GRAPH_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as ExtendTokenResponse;
  return {
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000),
  };
}

/**
 * De un User Access Token de larga vida, obtiene el Page Access Token de cada
 * página administrada (también de larga vida). Estos son los que usamos para
 * leer/responder en cada Página/IG.
 */
export async function getPageAccessTokens(
  longLivedUserToken: string
): Promise<Array<{ pageId: string; pageName: string; accessToken: string; igAccountId?: string }>> {
  interface PagesResponse {
    data: Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string };
    }>;
  }
  const json = await graphFetch<PagesResponse>(
    `/me/accounts?fields=id,name,access_token,instagram_business_account`,
    longLivedUserToken
  );
  return json.data.map((p) => ({
    pageId: p.id,
    pageName: p.name,
    accessToken: p.access_token,
    igAccountId: p.instagram_business_account?.id,
  }));
}
