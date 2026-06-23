import { test, expect } from '@playwright/test'

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
  // Canal "Efectivo": el <span> del label es exactamente "Efectivo".
  await manana.locator('label', { hasText: /^Efectivo\$?$/ }).locator('input').fill('100000')

  await manana.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await expect(manana.getByText('Cerrado correctamente.')).toBeVisible()
})
