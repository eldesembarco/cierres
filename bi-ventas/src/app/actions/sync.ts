'use server'

// Sincronización manual (botón en la home): trae del bridge la venta por
// hora/artículo y el consumo de insumos del rango pedido. Solo central/admin.
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth/auth'
import { ayerAr } from '@/lib/fecha'
import { syncVentasTango } from '@/lib/tango/syncVentas'

const YMD = /^\d{4}-\d{2}-\d{2}$/

export async function sincronizarVentas(formData: FormData) {
  const session = await auth()
  if (!session || !['central', 'admin'].includes(session.user.rol)) redirect('/')

  const desdeRaw = String(formData.get('syncDesde') ?? '')
  const hastaRaw = String(formData.get('syncHasta') ?? '')
  const desde = YMD.test(desdeRaw) ? desdeRaw : ayerAr()
  const hasta = YMD.test(hastaRaw) && hastaRaw >= desde ? hastaRaw : desde

  let msg: string
  try {
    const r = await syncVentasTango(desde, hasta)
    const suma = (k: 'filasHoras' | 'filasArticulos' | 'filasInsumos') =>
      r.dias.reduce((s, d) => s + (d[k] ?? 0), 0)
    msg = `Sincronizado ${desde}${hasta !== desde ? ` a ${hasta}` : ''}: ${suma('filasHoras')} filas por hora, ${suma('filasArticulos')} por artículo, ${suma('filasInsumos')} de insumos.`
    if (r.avisos.length > 0) msg += ` Avisos: ${r.avisos.join(' | ')}`
  } catch (e) {
    msg = `Error: ${e instanceof Error ? e.message : String(e)}`
  }
  revalidatePath('/')
  redirect(`/?syncMsg=${encodeURIComponent(msg)}`)
}
