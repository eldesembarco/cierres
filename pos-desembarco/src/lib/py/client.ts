/**
 * Cliente outbound al Middleware de PedidosYa / Delivery Hero.
 *
 * Endpoints que llamamos:
 *  - POST /v2/login                                       → JWT
 *  - POST /v2/order/status/{orderToken}                   → accept / reject
 *  - POST /v2/orders/{orderToken}/preparation-completed   → listo
 *  - POST /v2/orders/{orderToken}/adjust-preparation-time → ajustar tiempo
 *
 * Spec: https://integration-middleware.stg.restaurant-partners.com/apidocs/pos-middleware-api
 */

const BASE_URL =
  process.env.PY_MIDDLEWARE_URL ??
  "https://integration-middleware.stg.restaurant-partners.com";

interface LoginResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/** Devuelve null cuando faltan credenciales — el caller decide modo simulación. */
async function getToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const username = process.env.PY_USERNAME;
  const password = process.env.PY_PASSWORD;
  if (!username || !password) {
    return null;
  }

  const body = new URLSearchParams({
    username,
    password,
    grant_type: "client_credentials",
  });

  const res = await fetch(`${BASE_URL}/v2/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`PY login failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as LoginResponse;
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

interface CallOptions {
  callbackUrl?: string;
  body?: unknown;
}

/**
 * Llama a un endpoint del middleware con auth automática.
 * Si `callbackUrl` está presente (vino en el dispatch payload), usa esa URL absoluta;
 * si no, construye la URL desde `path` relativo a BASE_URL.
 *
 * Si no hay credenciales configuradas (PY_USERNAME/PY_PASSWORD), retorna un
 * "simulated success" en lugar de fallar — útil para demo / QA local sin cuenta real.
 */
async function callMiddleware(
  pathOrFullUrl: string,
  opts: CallOptions = {}
): Promise<{ ok: boolean; status: number; data: unknown; simulated?: boolean }> {
  const token = await getToken();
  if (token === null) {
    console.log(`[py:client] no creds — simulated success on ${pathOrFullUrl}`);
    return { ok: true, status: 200, data: { simulated: true, message: "PY creds not configured — local-only mode" }, simulated: true };
  }
  const url = pathOrFullUrl.startsWith("http") ? pathOrFullUrl : `${BASE_URL}${pathOrFullUrl}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data: unknown = null;
  try { data = await res.json(); } catch { /* sin body */ }
  return { ok: res.ok, status: res.status, data };
}

/**
 * Aceptar pedido. Idealmente usar la `callbackUrls.orderAcceptedUrl` del payload original.
 * Fallback: construir desde el token.
 */
export async function acceptOrder(orderToken: string, callbackUrl?: string, prepTimeMin?: number) {
  const url = callbackUrl ?? `/v2/order/status/${encodeURIComponent(orderToken)}`;
  return callMiddleware(url, {
    body: {
      status: "order_accepted",
      acceptanceTime: new Date().toISOString(),
      ...(prepTimeMin ? { remainingTimeInMinutes: prepTimeMin } : {}),
    },
  });
}

const REJECT_REASONS = new Set([
  "OUT_OF_STOCK",
  "VENDOR_BUSY",
  "RESTAURANT_CLOSED",
  "WRONG_PAYMENT",
  "CONNECTION_ISSUES",
  "OTHER",
] as const);

export type RejectReason = "OUT_OF_STOCK" | "VENDOR_BUSY" | "RESTAURANT_CLOSED" | "WRONG_PAYMENT" | "CONNECTION_ISSUES" | "OTHER";

export async function rejectOrder(orderToken: string, reason: RejectReason, message: string, callbackUrl?: string) {
  if (!REJECT_REASONS.has(reason)) {
    throw new Error(`Invalid reject reason: ${reason}`);
  }
  const url = callbackUrl ?? `/v2/order/status/${encodeURIComponent(orderToken)}`;
  return callMiddleware(url, {
    body: {
      status: "order_rejected",
      reason,
      message,
    },
  });
}

export async function markPreparationCompleted(orderToken: string, callbackUrl?: string) {
  const url = callbackUrl ?? `/v2/orders/${encodeURIComponent(orderToken)}/preparation-completed`;
  return callMiddleware(url, { body: {} });
}

/** Reset del cache para testing */
export function _resetTokenCache() { cachedToken = null; }
