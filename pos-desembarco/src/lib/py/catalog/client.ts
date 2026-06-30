/**
 * Cliente outbound para la Catalog API de PedidosYa.
 *
 * Usa la misma auth (JWT cacheado) que lib/py/client.ts.
 * Si no hay creds → modo simulación (igual que el resto).
 */

import type { Catalog, AvailabilityUpdateRequest, ModifyProductRequest } from "./types";

const BASE_URL = process.env.PY_MIDDLEWARE_URL ?? "https://integration-middleware.stg.restaurant-partners.com";

interface AuthResponse {
  access_token: string;
  expires_in: number;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const username = process.env.PY_USERNAME;
  const password = process.env.PY_PASSWORD;
  if (!username || !password) return null;
  const body = new URLSearchParams({ username, password, grant_type: "client_credentials" });
  const res = await fetch(`${BASE_URL}/v2/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`PY login failed: ${res.status}`);
  const json = (await res.json()) as AuthResponse;
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

interface CallResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  simulated?: boolean;
}

async function call<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<CallResult<T>> {
  const token = await getToken();
  if (token === null) {
    console.log(`[py:catalog] no creds — simulated success on ${init.method ?? "GET"} ${path}`);
    return { ok: true, status: 200, data: null, simulated: true };
  }
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  let data: T | null = null;
  try { data = (await res.json()) as T; } catch { /* sin body */ }
  return { ok: res.ok, status: res.status, data };
}

// ============================================================
// Submit del catálogo completo
// ============================================================

export interface SubmitCatalogResponse {
  menuImportId?: string;
  status?: string;
}

export async function submitCatalog(
  chainCode: string,
  catalog: Catalog
): Promise<CallResult<SubmitCatalogResponse>> {
  return call<SubmitCatalogResponse>(
    `/v2/chains/${encodeURIComponent(chainCode)}/catalog`,
    {
      method: "PUT",
      body: JSON.stringify(catalog),
    }
  );
}

/** Lee logs del último import para ver si hubo errores */
export async function getMenuImportLogs(
  chainCode: string,
  posVendorId: string
): Promise<CallResult> {
  return call(
    `/v2/chains/${encodeURIComponent(chainCode)}/vendors/${encodeURIComponent(posVendorId)}/menu-import-logs`
  );
}

// ============================================================
// Toggle availability (out-of-stock por SKU)
// ============================================================

export async function updateAvailability(
  chainCode: string,
  posVendorId: string,
  body: AvailabilityUpdateRequest
): Promise<CallResult> {
  return call(
    `/v2/chains/${encodeURIComponent(chainCode)}/vendors/${encodeURIComponent(posVendorId)}/catalog/items/availability`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    }
  );
}

// ============================================================
// Modify product (precio, nombre, descripción de UN producto)
// ============================================================

export async function modifyProduct(
  chainCode: string,
  globalEntityId: string,
  platformVendorId: string,
  body: ModifyProductRequest
): Promise<CallResult> {
  return call(
    `/v2/chains/${encodeURIComponent(chainCode)}/globalEntityId/${encodeURIComponent(globalEntityId)}/restaurant/${encodeURIComponent(platformVendorId)}/modify-product`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    }
  );
}

/** Helper: arma el ModifyProductRequest para un cambio de precio simple */
export function buildPriceUpdate(opts: {
  productId: string;
  newPrice: number;
  callbackUrl?: string;
}): ModifyProductRequest {
  return {
    processId: `price-${Date.now()}`,
    batchId: `single-price-update`,
    timestamp: new Date().toISOString(),
    timestampLastChange: new Date().toISOString(),
    callback: opts.callbackUrl,
    product: {
      productId: opts.productId,
      action: "upsert",
      price: String(opts.newPrice),
      updatedFields: ["price"],
    },
  };
}

/** Helper: borrar un producto */
export function buildDeleteProduct(productId: string, callbackUrl?: string): ModifyProductRequest {
  return {
    processId: `delete-${Date.now()}`,
    batchId: `single-delete`,
    timestamp: new Date().toISOString(),
    timestampLastChange: new Date().toISOString(),
    callback: callbackUrl,
    product: {
      productId,
      action: "delete",
      updatedFields: [],
    },
  };
}
