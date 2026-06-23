import { test, expect } from '@playwright/test'

test('encargado carga y cierra un cierre', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name=email]', 'santelmo@eldesembarco.com')
  await page.fill('input[name=password]', 'santelmo1234')
  await page.click('button:has-text("Entrar")')

  await expect(page).toHaveURL(/\/cierres/)
  await page.click('text=+ Cierre de hoy')
  // Esperamos a que el form del día monte (la TopBar también tiene un botón
  // "Cerrar sesión", así que sincronizamos contra un control propio del form).
  await expect(page.getByRole('button', { name: 'Cerrar caja' })).toBeVisible()

  // Cada campo de moneda es un <label> con un <span> (texto) + un MoneyInput (text input).
  // Apuntamos al <input> dentro del <label> cuyo texto contiene la etiqueta.
  await page.locator('label:has-text("Cierre Z · Turno 1") input').fill('100000')
  // Con la diferencia EXACTA (depositado − (ventaEfectivo − gastos)), para cerrar limpio
  // hay que depositar lo mismo que entró en efectivo.
  await page.locator('label:has-text("Efectivo depositado · Turno 1") input').fill('100000')
  // Canal "Efectivo": el <span> del label es exactamente "Efectivo" (sin "depositado").
  await page.locator('label', { hasText: /^Efectivo\$?$/ }).locator('input').fill('100000')

  // diferencia = totalDepositado − (ventaEfectivo − gastos) = 100000 − (100000 − 0) = 0 → cierra sin nota.
  // OJO: la TopBar tiene un botón "Cerrar sesión"; apuntamos exactamente a "Cerrar caja".
  await page.getByRole('button', { name: 'Cerrar caja' }).click()
  await expect(page.getByText('Cerrado correctamente.')).toBeVisible()
})
