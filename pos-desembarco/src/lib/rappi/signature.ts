/**
 * Verificación del header `Rappi-Signature: t=<timestamp>,sign=<hmac>`.
 *
 * Spec: HMAC-SHA256 sobre `${timestamp}.${rawBody}` con el secret del webhook.
 * Importante: usar el body STRING tal como llegó, antes de cualquier parseo JSON.
 *
 * Doc: https://dev-portal.rappi.com/es/webhook-events/
 */

import crypto from "node:crypto";

export interface SignatureCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Verifica el header firma de Rappi.
 *
 * @param rawBody - cuerpo crudo del request (string o Buffer), exactamente como vino
 * @param header - valor del header `Rappi-Signature`
 * @param secret - shared secret del webhook (env: RAPPI_WEBHOOK_SECRET)
 * @param maxAgeSec - rechazar si el timestamp es más viejo (replay protection). Default 5 min.
 */
export function verifyRappiSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  maxAgeSec = 300
): SignatureCheck {
  if (!header) return { ok: false, reason: "missing Rappi-Signature header" };
  if (!secret) return { ok: false, reason: "RAPPI_WEBHOOK_SECRET not configured" };

  // Parse "t=...,sign=..."
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.trim().split("=");
      return [k?.toLowerCase().trim(), v?.trim() ?? ""];
    })
  );
  const t = parts.t;
  const sign = parts.sign;
  if (!t || !sign) return { ok: false, reason: "malformed Rappi-Signature header" };

  // Replay protection: rechazar timestamps viejos (en segundos o milisegundos — soportamos ambos)
  const ts = Number(t);
  if (Number.isNaN(ts)) return { ok: false, reason: "invalid timestamp" };
  const tsMs = ts < 1e12 ? ts * 1000 : ts;
  const ageMs = Date.now() - tsMs;
  if (Math.abs(ageMs) > maxAgeSec * 1000) {
    return { ok: false, reason: `timestamp out of window (${Math.round(ageMs / 1000)}s)` };
  }

  // Calcular HMAC esperado
  const payload = `${t}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  // Comparación constant-time
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sign, "hex");
  if (a.length !== b.length) return { ok: false, reason: "signature length mismatch" };
  if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: "signature mismatch" };

  return { ok: true };
}
