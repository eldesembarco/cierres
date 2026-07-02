import { hoyAr } from '@/lib/fecha'

// ── AMNISTÍA TEMPORAL DE REAPERTURA (pedido de Pablo, 02/07/2026) ──
// SOLO por hoy (02/07) el encargado puede reabrir su PROPIA caja de AYER (01/07)
// para corregir errores de carga. Normalmente un turno cerrado es de sólo lectura
// para el encargado (control anti-faltantes); esto es una excepción acotada.
//
// Doble candado que la hace AUTO-EXPIRAR (no depende de que alguien la quite):
//   - la fecha del cierre debe ser exactamente 01/07, y
//   - hoy (hora Argentina) debe ser 02/07.
// A partir del 03/07 queda inactiva sola. Igual conviene BORRAR este archivo y sus
// usos (acción reabrirCierre + botón en TurnoCierre) después del 02/07.
export const AMNISTIA_FECHA_CIERRE = '2026-07-01'
export const AMNISTIA_SOLO_EL_DIA = '2026-07-02'

export function amnistiaReaperturaActiva(fechaCierre: string): boolean {
  return fechaCierre === AMNISTIA_FECHA_CIERRE && hoyAr() === AMNISTIA_SOLO_EL_DIA
}
