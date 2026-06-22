import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/auth/password'

describe('password', () => {
  it('verifica un hash válido', async () => {
    const hash = await hashPassword('secreto123')
    expect(await verifyPassword('secreto123', hash)).toBe(true)
  })
  it('rechaza una password incorrecta', async () => {
    const hash = await hashPassword('secreto123')
    expect(await verifyPassword('otra', hash)).toBe(false)
  })
})
