import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'

// El runner de Playwright no carga .env automáticamente; lo necesitamos para el
// reset de DB del beforeAll.
config()

// El nuevo bloqueo deja en sólo lectura un turno ya CERRADO para el encargado.
// Para que este test (que crea+cierra la Mañana de hoy) sea idempotente, borramos
// el cierre de hoy del local piloto antes de correr, así siempre arranca limpio.
test.beforeAll(async () => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL }, { schema: 'cierres' })
  const prisma = new PrismaClient({ adapter })
  const now = new Date()
  const fecha = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  await prisma.cierre.deleteMany({ where: { localId: 1, fecha, turno: 'manana' } })
  await prisma.$disconnect()
})

test('encargado carga y cierra el turno Mañana', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name=email]', 'santelmo@eldesembarco.com')
  await page.fill('input[name=password]', 'santelmo1234')
  await page.click('button:has-text("Entrar")')

  await expect(page).toHaveURL(/\/cierres/)
  await page.click('text=+ Cierre de hoy')

  // La planilla del día tiene DOS bloques (Mañana / Tarde), cada uno es un <section>
  // con su <h2> de título y su botón "Cerrar". Apuntamos al bloque Mañana.
  const manana = page.locator('section', { has: page.getByRole('heading', { name: 'Mañana' }) })
  await expect(manana.getByRole('button', { name: 'Cerrar', exact: true })).toBeVisible()

  // Cada campo de moneda es un <label> con un <span> (texto) + un MoneyInput (text input).
  await manana.locator('label:has-text("Cierre Z") input').fill('100000')
  // diferencia = depositado − (ventaEfectivo − gastosEfectivo). Con efectivo=depositado y
  // sin gastos, la diferencia es 0 → cierra sin nota.
  await manana.locator('label:has-text("Efectivo depositado") input').fill('100000')
  // Ingresos: "Efectivo" es un único campo (el <span> del label es exactamente "Efectivo").
  await manana.locator('label', { hasText: /^Efectivo\$?$/ }).locator('input').fill('100000')

  // Agregar un ingreso individual (tarjeta) — no afecta la diferencia de caja, pero
  // ejercita el flujo nuevo: el botón abre un MODAL con todos los campos; elegimos el
  // medio "Visa crédito", cargamos el monto y confirmamos con "Agregar". Al confirmar
  // el modal se cierra y la línea aparece en la lista compacta.
  await manana.getByRole('button', { name: 'Agregar ingreso' }).first().click()
  const modal = page.getByRole('dialog', { name: 'Agregar ingreso' })
  await expect(modal).toBeVisible()
  await modal.getByRole('combobox').selectOption({ label: 'Visa crédito' })
  await modal.locator('input[inputmode="numeric"]').first().fill('25000')
  await modal.getByRole('button', { name: 'Agregar', exact: true }).click()
  // El modal se cierra y la línea queda en la lista (chip "Visa crédito"). Puede
  // haber más de una si quedó un borrador previo persistido; basta con que aparezca.
  await expect(modal).toBeHidden()
  await expect(manana.getByText('Visa crédito', { exact: true }).first()).toBeVisible()

  await manana.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await expect(manana.getByText('Cerrado correctamente.')).toBeVisible()
})
