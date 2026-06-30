"use client";

import { useEffect, useState } from "react";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** Timestamp ms cuando aceptamos el pedido. Si es undefined, no hay gating. */
  acceptedAt?: number;
  /** Tiempo de prep estimado (minutos) que le prometimos a la plataforma. */
  prepTimeMin?: number;
  /** Click handler */
  onClick: () => void;
  /** Loading state mientras se hace la llamada al middleware */
  busy?: boolean;
  /** Si la app penaliza por marcar ready demasiado temprano. PY mide tiempo de respuesta;
   *  Rappi también pero con menos rigor. Default true (mostrar gating). */
  enforceGating?: boolean;
  /** Variantes de tamaño */
  size?: "default" | "lg";
  /** Estilo extra */
  className?: string;
  /** Texto cuando está habilitado. Default "Marcar como listo" */
  label?: string;
  /** Texto del botón cuando aún no está habilitado. Default "Listo en " + countdown */
  pendingLabel?: string;
}

/**
 * Calcula el momento en que el botón se habilita: máximo entre
 *   - 60% del tiempo de prep transcurrido (ej: 25 min × 0.6 = 15 min)
 *   - 5 min antes del deadline (ej: 25 - 5 = 20 min)
 *
 * El más tarde de los dos. La idea es: no permitir marcar ready cuando todavía estamos
 * a más de 5 min del prep estimado, ni cuando llevamos menos del 60% del tiempo prometido.
 *
 * Para preps cortos (< 8 min) usamos solo el 60% threshold.
 */
function thresholdMs(prepTimeMin: number): number {
  const sixtyPct = prepTimeMin * 0.6;
  const fiveBefore = prepTimeMin - 5;
  // Para prep cortos (<8 min) "5 antes" puede ser muy temprano o negativo
  if (prepTimeMin < 8) return Math.max(1, sixtyPct) * 60_000;
  return Math.max(sixtyPct, fiveBefore) * 60_000;
}

function fmtMmSs(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function ReadyButton({
  acceptedAt,
  prepTimeMin,
  onClick,
  busy,
  enforceGating = true,
  size = "lg",
  className = "",
  label = "Marcar como listo",
  pendingLabel,
}: Props) {
  // tick para refrescar el countdown sin tocar React state demasiado
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5_000);
    return () => clearInterval(id);
  }, []);

  // Sin info → no hay gating
  if (!enforceGating || !acceptedAt || !prepTimeMin) {
    return (
      <Button
        size={size}
        onClick={onClick}
        disabled={busy}
        className={"bg-amber-500 hover:bg-amber-600 text-black font-semibold " + className}
      >
        <Check /> {label}
      </Button>
    );
  }

  const elapsedMs = Date.now() - acceptedAt;
  const thresMs = thresholdMs(prepTimeMin);
  const enabled = elapsedMs >= thresMs;
  const remainingMs = Math.max(0, thresMs - elapsedMs);
  const totalMs = prepTimeMin * 60_000;
  const progressPct = Math.min(100, (elapsedMs / totalMs) * 100);

  if (enabled) {
    return (
      <Button
        size={size}
        onClick={onClick}
        disabled={busy}
        className={"bg-amber-500 hover:bg-amber-600 text-black font-semibold " + className}
      >
        <Check /> {label}
      </Button>
    );
  }

  // Disabled state — muestra countdown + barra de progreso
  return (
    <div className={"relative " + className}>
      <Button
        size={size}
        disabled
        className="w-full bg-stone-300 text-stone-600 dark:bg-stone-700 dark:text-stone-400 font-semibold cursor-not-allowed opacity-90"
        title="El botón se habilita cuando se acerca el tiempo de entrega para que la plataforma no penalice un ready prematuro"
      >
        <Lock size={14} /> {pendingLabel ?? `Listo en ${fmtMmSs(remainingMs / 1000)}`}
      </Button>
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-stone-200 dark:bg-stone-800 rounded-b overflow-hidden pointer-events-none">
        <div
          className="h-full bg-amber-500 transition-[width] duration-1000"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
