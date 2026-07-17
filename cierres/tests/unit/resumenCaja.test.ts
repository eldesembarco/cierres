import { describe, it, expect } from 'vitest'
import { armarResumenCaja, type LocalParaCaja } from '@/lib/tango/resumenCaja'
import type { CobroTangoRow } from '@/lib/tango/cobrosBridge'

const LOCALES: LocalParaCaja[] = [
  { id: 4, nombre: 'Desembarco Villa Urquiza', marca: 'Desembarco', tangoSucursalId: 40 },
  { id: 7, nombre: 'Desembarco Olivos', marca: 'Desembarco', tangoSucursalId: 70 },
  { id: 99, nombre: 'Sin mapeo', marca: 'Desembarco', tangoSucursalId: null },
]

const fila = (id_sucursal: number, medio_pago: string, importe: number): CobroTangoRow => ({
  fecha: '2026-07-16',
  id_sucursal,
  medio_pago,
  importe,
})

describe('armarResumenCaja', () => {
  it('agrupa por local y por cuenta, ordena por importe y calcula totales', () => {
    const r = armarResumenCaja('2026-07-16', [
      fila(40, 'RAPPI', 100000),
      fila(40, 'MERCADOPAGO DELIVERY', 300000.5),
      fila(40, 'RAPPI', 123913), // misma cuenta dos veces → se suma
      fila(70, 'CODIGOPAGO', 5600),
    ], LOCALES)

    expect(r.locales.map((l) => l.localId)).toEqual([4, 7]) // orden total desc
    const urquiza = r.locales[0]
    expect(urquiza.cuentas).toEqual([
      { cuenta: 'MERCADOPAGO DELIVERY', importe: 300000.5 },
      { cuenta: 'RAPPI', importe: 223913 },
    ])
    expect(urquiza.total).toBe(523913.5)
    expect(r.totalGeneral).toBe(529513.5)
  })

  it('ignora sucursales ajenas (franquicias) y normaliza el nombre de la cuenta', () => {
    const r = armarResumenCaja('2026-07-16', [
      fila(12345, 'EFECTIVO', 99999), // sucursal que no mapea a un propio
      fila(40, '  rappi ', 10),
    ], LOCALES)
    expect(r.locales).toHaveLength(1)
    expect(r.locales[0].cuentas).toEqual([{ cuenta: 'RAPPI', importe: 10 }])
    expect(r.totalGeneral).toBe(10)
  })

  it('lista aparte los locales mapeados sin cobros y excluye los sin tango_sucursal_id', () => {
    const r = armarResumenCaja('2026-07-16', [fila(40, 'RAPPI', 10)], LOCALES)
    expect(r.sinCobros).toEqual([{ localId: 7, nombre: 'Desembarco Olivos' }])
  })

  it('descarta filas con importe no numérico (NaN rompería la serialización del cache)', () => {
    const r = armarResumenCaja('2026-07-16', [
      { fecha: '2026-07-16', id_sucursal: 40, medio_pago: 'RAPPI', importe: 'no-numero' as unknown as number },
      fila(40, 'EFECTIVO', 100),
    ], LOCALES)
    expect(r.locales[0].cuentas).toEqual([{ cuenta: 'EFECTIVO', importe: 100 }])
    expect(r.totalGeneral).toBe(100)
  })

  it('día sin filas: todos los mapeados quedan en sinCobros', () => {
    const r = armarResumenCaja('2026-07-16', [], LOCALES)
    expect(r.locales).toEqual([])
    expect(r.sinCobros.map((l) => l.localId)).toEqual([4, 7])
    expect(r.totalGeneral).toBe(0)
  })
})
