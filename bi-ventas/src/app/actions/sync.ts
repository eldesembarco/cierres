'use server'

// Sincronización manual (botón en la home): trae del bridge la venta por
// hora/artículo del rango pedido y la guarda. Solo central/admin.
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
    const horas = r.dias.reduce((s, d) => s + d.filasHoras, 0)
    const arts = r.dias.reduce((s, d) => s + d.filasArticulos, 0)
    msg = `Sincronizado ${desde}${hasta !== desde ? ` a ${hasta}` : ''}: ${horas} filas por hora, ${arts} por artículo.`
  } catch (e) {
    msg = `Error: ${e instanceof Error ? e.message : String(e)}`
  }
  revalidatePath('/')
  redirect(`/?syncMsg=${encodeURIComponent(msg)}`)
}
