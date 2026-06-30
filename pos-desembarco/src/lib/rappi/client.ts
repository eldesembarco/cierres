/**
 * Cliente outbound al API de Rappi.
 *
 * Auth: OAuth2 client_credentials. Token TTL = 1 semana.
 * Header: x-authorization: Bearer <token>  (NO es el estándar Authorization)
 *
 * Doc:
 *  - Auth: https://dev-portal.rappi.com/es/authentication-process/
 *  - Orders: https://dev-portal.rappi.com/es/managing-user-orders/
 */

interface AuthResponse {
  access_token: string;
  /** En segundos */
  expires_in?: number;
  token_type?: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

const COUNTRY_DOMAIN_DEFAULT =
  process.env.RAPPI_COUNTRY_DOMAIN ?? "https://services.rappi.com.ar";

const DEV_DOMAIN = "https://microservices.dev.rappi.com";

/** Devuelve el dominio que corresponde según el ambiente */
function authDomain(): string {
  return process.env.RAPPI_USE_DEV === "true" ? DEV_DOMAIN : COUNTRY_DOMAIN_DEFAULT;
}

/** Devuelve null cuando faltan credenciales — el caller usa modo simulación. */
async function getToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const clientId = process.env.RAPPI_CLIENT_ID;
  const clientSecret = process.env.RAPPI_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }

  const url = `${authDomain()}/restaurants/auth/v1/token/login/integrations`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });

  if (!res.ok) {
    throw new Error(`Rappi login failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as AuthResponse;
  // La doc dice TTL 1 semana — si no viene expires_in, asumimos 6.5 días para refresh anticipado
  const expiresIn = json.expires_in ?? 60 * 60 * 24 * 6.5;
  cachedToken = { value: json.access_token, expiresAt: Date.now() + expiresIn * 1000 };
  return json.access_token;
}

/**
 * Llamada autenticada al API de orders.
 * Si no hay creds configuradas, retorna simulated success para demo/QA sin cuenta real.
 */
async function callOrdersApi(
  countryDomain: string,
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: unknown; simulated?: boolean }> {
  const token = await getToken();
  if (token === null) {
    console.log(`[rappi:client] no creds — simulated success on ${path}`);
    return { ok: true, status: 200, data: { simulated: true, message: "Rappi creds not configured — local-only mode" }, simulated: true };
  }
  const url = `${countryDomain}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-authorization": `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  let data: unknown = null;
  try { data = await res.json(); } catch { /* sin body */ }
  return { ok: res.ok, status: res.status, data };
}

/**
 * Acepta un pedido (TAKE).
 * PUT /api/v2/restaurants-integrations-public-api/orders/{orderId}/take/{cookingTime}
 */
export async function takeOrder(countryDomain: string, orderId: string, cookingTimeMin: number) {
  return callOrdersApi(
    countryDomain,
    `/api/v2/restaurants-integrations-public-api/orders/${encodeURIComponent(orderId)}/take/${cookingTimeMin}`,
    { method: "PUT" }
  );
}

/**
 * Rechaza un pedido.
 * PUT /api/v2/restaurants-integrations-public-api/orders/{orderId}/reject
 *
 * IMPORTANTE: rechazar repetidamente deshabilita la tienda en Rappi. Usar con criterio.
 */
export async function rejectOrder(
  countryDomain: string,
  orderId: string,
  reason: string,
  itemsSku: string[] = [],
  itemsIds: string[] = []
) {
  return callOrdersApi(
    countryDomain,
    `/api/v2/restaurants-integrations-public-api/orders/${encodeURIComponent(orderId)}/reject`,
    {
      method: "PUT",
      body: JSON.stringify({ reason, items_sku: itemsSku, items_ids: itemsIds }),
    }
  );
}

/**
 * Marca como listo para retirar.
 * POST /api/v2/restaurants-integrations-public-api/orders/{orderId}/ready-for-pickup
 */
export async function readyForPickup(countryDomain: string, orderId: string) {
  return callOrdersApi(
    countryDomain,
    `/api/v2/restaurants-integrations-public-api/orders/${encodeURIComponent(orderId)}/ready-for-pickup`,
    { method: "POST" }
  );
}

/**
 * GET fallback de pedidos en estado READY (también los pasa a SENT como side effect).
 * Solo llamar como fallback — la fuente principal es el webhook NEW_ORDER.
 */
export async function pollReadyOrders(countryDomain: string, storeId?: string) {
  const qs = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
  return callOrdersApi(
    countryDomain,
    `/api/v2/restaurants-integrations-public-api/orders${qs}`,
    { method: "GET" }
  );
}

export function _resetTokenCache() { cachedToken = null; }
