import { test, expect } from '@playwright/test'

test('encargado carga y cierra un cierre', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name=email]', 'santelmo@eldesembarco.com')
  await page.fill('input[name=password]', 'santelmo1234')
  await page.click('button:has-text("Entrar")')

  await expect(page).toHaveURL(/\/cierres/)
  await page.click('text=+ Cierre de hoy')

  // El form renderiza, por cada campo, un <label> con un <span> (texto) y un <input> hermano.
  // Apuntamos al <input> dentro del <label> cuyo texto contiene la etiqueta.
  await page.locator('label:has-text("Cierre Z · Turno 1") input').fill('100000')
  // El canal "efectivo" coincide exactamente para no chocar con "Ventas por canal".
  await page.locator('label', { hasText: /^efectivo$/ }).locator('input').fill('100000')

  // diferencia = totalZ - ventaTotal = 100000 - 100000 = 0 → sin nota requerida.
  await page.click('button:has-text("Cerrar")')
  await expect(page.getByText('Cerrado')).toBeVisible()
})
