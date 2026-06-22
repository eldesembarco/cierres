import type { Rol } from '@prisma/client'

export const esCentral = (rol: Rol) => rol === 'central' || rol === 'admin'
export const puedeSubirCsv = (rol: Rol) => esCentral(rol)
export const puedeVerControl = (rol: Rol) => esCentral(rol)
export const puedeReabrir = (rol: Rol) => esCentral(rol)
export const esAdmin = (rol: Rol) => rol === 'admin'
