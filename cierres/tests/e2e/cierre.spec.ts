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
  // Ingresos: "Efectivo" es un único campo (el <span> del label es exactamente "Efectivo").
  await manana.locator('label', { hasText: /^Efectivo\$?$/ }).locator('input').fill('100000')

  // Agregar un ingreso individual (tarjeta) — no afecta la diferencia de caja, pero
  // ejercita el flujo nuevo de líneas por transacción.
  await manana.getByRole('button', { name: 'Agregar ingreso' }).first().click()
  const lineaIngreso = manana.locator('select:has(optgroup[label="Tarjetas"])').first()
  await lineaIngreso.selectOption('visa_credito')
  // El MoneyInput de la línea es el input de texto que sigue al select del medio.
  await lineaIngreso.locator('xpath=following::input[@inputmode="numeric"][1]').fill('25000')

  await manana.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await expect(manana.getByText('Cerrado correctamente.')).toBeVisible()
})
