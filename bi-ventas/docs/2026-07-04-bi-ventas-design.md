# BI de ventas por local (fuente Tango) — diseño

**Fecha:** 2026-07-04 · **Estado:** aprobado por Pablo (sección dentro de la app de cierres)

## Qué responde

Facturación por local y período, venta por hora, venta por artículo (ranking de
productos y extras), tickets y ticket promedio, con comparativas entre locales y
contra períodos anteriores.

## Por qué NO se usa `/cobros` ni la base de cierres

- `/cobros` (vw_CobrosDiarios) son cobros de caja: universo más chico que la venta
  real (Microcentro 02/07: Z $1.610.516 vs cobros $720.916). No sirve como fuente.
- La base de cierres tiene venta por canal y monto Z, pero no hora ni artículo.

## Arquitectura

```
Tango (SQL Server, máquina de sistemas)
  └─ vistas nuevas: vw_VentasPorHora, vw_VentasPorArticulo   ← [handoff a sistemas]
       └─ bridge (tango-bridge.mjs, Cloudflare Tunnel)
            ├─ GET /ventas-horas?desde&hasta
            └─ GET /ventas-articulos?desde&hasta
                 └─ POST/GET /api/tango/sync-ventas (cron diario + botón manual)
                      └─ Postgres (tablas agregadas)
                           └─ página /ventas (admin/central/contable)
```

**Sincronizamos a nuestra base en vez de consultar en vivo** porque el túnel es
efímero y la máquina de Tango puede estar apagada: el BI sigue funcionando con lo
ya sincronizado, y el histórico consulta rápido.

## Datos (agregados, no ticket a ticket)

- `venta_tango_hora` (local, fecha, hora 0–23): monto, tickets. Única por
  (local, fecha, hora). ~20 locales × 24 filas/día.
- `venta_tango_articulo` (local, fecha, código): descripción, rubro?, cantidad,
  monto. Única por (local, fecha, código).
- `venta_tango_sync` (fecha): filas recibidas y cuándo, para ver cobertura y
  detectar días sin sincronizar.

Guardar agregados (no comprobantes) mantiene el volumen trivial y cubre todo lo
pedido. Si algún día hace falta detalle por ticket, se agrega otra vista al bridge.

El re-sync de un día es idempotente: borra y reinserta ese (fecha, local).

## Sync

- `src/lib/tango/ventasBridge.ts`: fetch de ambos endpoints (mismo patrón y secret
  que `cobrosBridge.ts`), mapeo `id_sucursal → localId` vía `Local.tangoSucursalId`.
- `/api/tango/sync-ventas`: `GET` para el cron de Vercel (Bearer `CRON_SECRET`) y
  `POST` manual (sesión central/admin o `x-sync-secret` = `TANGO_INGEST_SECRET`).
  Parámetros `desde`/`hasta` (default: ayer). Cron diario a la mañana.
- Si el bridge está caído, el sync falla con error claro y el BI sigue mostrando lo
  sincronizado hasta entonces (banner de "último día sincronizado").

## Pantalla `/ventas`

Visible para `central`, `admin`, `contable` (mismo `puedeVerFinanzas`). Filtros GET
como en `/informes`: rango de fechas, local (o todos), marca.

1. KPIs: facturación, tickets, ticket promedio, y variación vs período anterior de
   igual longitud.
2. Facturación por local: tabla con monto, share, tickets, ticket promedio y
   variación; ordenada por monto (ranking).
3. Curva horaria: barras CSS por hora (suma del período, filtrable por local).
4. Ranking de artículos: top N por cantidad y por monto, filtrable por local. Los
   extras/adicionales son artículos y salen acá (si Tango trae `rubro`, se puede
   agrupar por categoría).

Sin librería de charts: barras con divs + Tailwind, como el resto de la app.

## Dependencia externa (bloqueante para ver datos)

Sistemas debe: (1) crear las 2 vistas en la base de Tango, (2) agregar los 2
endpoints al bridge, (3) dar hostname fijo del túnel (pendiente de antes). El
contrato exacto está en `docs/tango-bridge-ventas-handoff.md`. Todo lo de nuestro
lado queda deployado y funcional; apenas el bridge exponga los endpoints, el cron
empieza a llenar datos.
