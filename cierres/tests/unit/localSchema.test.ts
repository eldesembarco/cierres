import { describe, it, expect } from 'vitest'
import { localInputSchema } from '@/app/admin/locales/schema'

const valido = { nombre: 'Desembarco Munro', marcaId: 1 }

describe('localInputSchema', () => {
  it('acepta un alta mínima válida (solo nombre + marca)', () => {
    const r = localInputSchema.parse(valido)
    expect(r.nombre).toBe('Desembarco Munro')
    expect(r.marcaId).toBe(1)
    expect(r.fondoFijoDefault).toBe(0)
    expect(r.tangoSucursalId).toBeNull()
  })

  it('rechaza nombre demasiado corto', () => {
    expect(() => localInputSchema.parse({ ...valido, nombre: 'AB' })).toThrow()
  })

  it('rechaza sin marca', () => {
    expect(() => localInputSchema.parse({ nombre: 'Local sin marca' })).toThrow()
  })

  it('rechaza marcaId inválido (0 o negativo)', () => {
    expect(() => localInputSchema.parse({ ...valido, marcaId: 0 })).toThrow()
  })

  it('rechaza fondoFijoDefault negativo', () => {
    expect(() => localInputSchema.parse({ ...valido, fondoFijoDefault: -100 })).toThrow()
  })

  it('acepta tangoSucursalId numérico y lo castea a number', () => {
    const r = localInputSchema.parse({ ...valido, tangoSucursalId: '42' })
    expect(r.tangoSucursalId).toBe(42)
  })

  it('trata tangoSucursalId vacío como null (sin mapear todavía)', () => {
    const r = localInputSchema.parse({ ...valido, tangoSucursalId: '' })
    expect(r.tangoSucursalId).toBeNull()
  })

  it('recorta espacios del nombre', () => {
    const r = localInputSchema.parse({ ...valido, nombre: '  Desembarco Munro  ' })
    expect(r.nombre).toBe('Desembarco Munro')
  })
})
