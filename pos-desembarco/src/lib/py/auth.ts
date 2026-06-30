/**
 * Validación del Bearer token entrante de PY (en los webhooks que ELLOS llaman).
 *
 * En staging, PY firma los requests con un JWT (MiddlewareJWTAuth en el spec).
 * El secret/pubkey nos lo da Marcos durante el setup. Hasta tenerlo, validamos
 * un shared-secret simple via env var para que el endpoint no esté abierto.
 *
 * En producción esto debe migrar a verificación JWT real con la pubkey de PY.
 */

import { NextRequest } from "next/server";

export interface AuthCheckResult {
  ok: boolean;
  reason?: string;
}

export function checkInboundAuth(req: NextRequest): AuthCheckResult {
  // Bypass total en dev cuando no hay secret configurado — útil para curls locales
  const expected = process.env.PY_INBOUND_SECRET;
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, reason: "PY_INBOUND_SECRET not configured in production" };
    }
    return { ok: true };
  }

  const auth = req.headers.get("authorization");
  if (!auth) return { ok: false, reason: "missing Authorization header" };

  // Aceptamos "Bearer <token>" o el token directo
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (token !== expected) return { ok: false, reason: "invalid token" };

  return { ok: true };
}
