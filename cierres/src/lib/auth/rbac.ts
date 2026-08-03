import type { Rol } from '@prisma/client'

export const esCentral = (rol: Rol) => rol === 'central' || rol === 'admin'
export const esAdmin = (rol: Rol) => rol === 'admin'
// Contable: perfil de SOLO LECTURA de todo lo financiero (reportes MP, informes,
// tablero, conciliación, cuenta corriente). NO puede editar cierres, marcar pagos
// ni importar. Ve todos los locales.
export const esContable = (rol: Rol) => rol === 'contable'
// Puede VER las pantallas financieras (central/admin editan; contable sólo consulta).
export const puedeVerFinanzas = (rol: Rol) => esCentral(rol) || esContable(rol)
// Puede elegir/cambiar el local activo del selector (para consultar local por local).
export const puedeElegirLocal = (rol: Rol) => esCentral(rol) || esContable(rol)

// Acciones que MODIFICAN datos: sólo central/admin (nunca contable ni encargado central).
export const puedeSubirCsv = (rol: Rol) => esCentral(rol)
export const puedeReabrir = (rol: Rol) => esCentral(rol)
export const puedeMarcarPagado = (rol: Rol) => esCentral(rol)

// Alta/edición de locales (sucursales): sólo admin. Es una operación estructural
// (crea filas que después se usan en selects de todas las demás pantallas), no
// una tarea operativa del día a día como central/contable.
export const puedeAdministrarLocales = (rol: Rol) => esAdmin(rol)

// Ver el tablero de control: cualquiera que vea finanzas.
export const puedeVerControl = (rol: Rol) => puedeVerFinanzas(rol)

// Pantalla de inicio según rol: administración (central/admin/contable) arranca en el
// panel de administración (dashboard global); el encargado, en sus cierres.
export const homeFor = (rol: Rol): string => (puedeVerFinanzas(rol) ? '/dashboard' : '/cierres')
