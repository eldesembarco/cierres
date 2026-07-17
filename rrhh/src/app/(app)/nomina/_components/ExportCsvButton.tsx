'use client'
// Exporta la nómina filtrada (tal como se ve) a CSV compatible con Excel
// es-AR: separador ";", BOM UTF-8 y fechas dd/mm/aaaa.
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/kit'
import { fmtAntiguedad, fmtFecha, hoyIso } from '@/lib/format'
import type { EmpleadoResumen } from '@/lib/types'

const BOM = String.fromCharCode(0xfeff)

const COLUMNAS = [
  'Legajo', 'Nombre completo', 'CUIL', 'Email', 'Teléfono', 'Empresa', 'Marca',
  'Locación', 'Departamento', 'Posición', 'Convenio', 'Estado',
  'Fecha ingreso', 'Fecha egreso', 'Antigüedad', 'Docs pendientes', 'Docs por vencer',
]

export function ExportCsvButton({ empleados }: { empleados: EmpleadoResumen[] }) {
  const exportar = () => {
    const esc = (v: string | number | null) => {
      if (v === null || v === undefined) return ''
      const s = String(v)
      return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const fecha = (d: string | null) => (d ? fmtFecha(d) : '')
    const filas = empleados.map(e => [
      e.legajo, e.nombreCompleto, e.cuil, e.email, e.telefono, e.empresa, e.marca,
      e.locacion, e.departamento, e.posicion, e.convenio, e.estado,
      fecha(e.fechaIngreso), fecha(e.fechaEgreso),
      e.antiguedadMeses === null ? '' : fmtAntiguedad(e.antiguedadMeses),
      e.docsPendientes, e.docsPorVencer,
    ])
    const csv = BOM + [COLUMNAS, ...filas].map(f => f.map(esc).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `nomina-${hoyIso()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="secondary" icon={Download} onClick={exportar} disabled={empleados.length === 0}>
      Exportar CSV
    </Button>
  )
}
