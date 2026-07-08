# Bridge de Tango (SRVTANGO): estado y pendiente de insumos

> Actualizado 2026-07-08. El plan original de este doc (pedirle los endpoints a
> sistemas) quedó obsoleto: el bridge ahora es **nuestro** (`C:\tango-bridge` en
> SRVTANGO, copia de referencia en `cierres/scripts/tango-bridge/`), con túnel
> Cloudflare y auto-registro de URL. Los updates al server se hacen pegando
> bloques de PowerShell/SQL en el server (RDP), como en la instalación.

## Ya funcionando

- `/cobros` (vw_CobrosDiarios), `/ventas-horas` (vw_VentasPorHora, hora por
  `DATEPART(hour, e.FECHA)` + `FECHA_COMERCIAL`), `/ventas-articulos`
  (vw_VentasPorArticulo, importe prorrateado = Z exacto).
- BI backfilleado desde 2026-06-01 y sync diario.

## Pendiente: `/consumo-insumos` (informe de insumos por local)

El endpoint ya está agregado a la copia de referencia del bridge
(`tango-bridge.mjs`, query sobre `dbo.vw_ConsumoInsumos`) y la app ya tiene
tabla, sync tolerante y pantalla `/insumos`. Faltan dos pasos en el server:

### 1. Crear la vista `vw_ConsumoInsumos` en CENTRAL_ESTADISTICA

Contrato que espera el bridge (columnas exactas):

| columna       | tipo         | contenido                                  |
| ------------- | ------------ | ------------------------------------------ |
| FECHA         | date         | día del consumo                            |
| ID_SUCURSAL   | int          | sucursal Tango                             |
| COD_ARTICULO  | varchar      | código del insumo                          |
| DESCRIPCION   | varchar      | descripción del insumo                     |
| RUBRO         | varchar/null | rubro/familia (materia prima, empaque, …)  |
| UNIDAD        | varchar/null | unidad de stock (KG/LT/UN)                 |
| CANTIDAD      | numeric      | cantidad consumida ese día en esa sucursal |

La fuente depende de cómo esté armado Tango (a definir mirando el esquema):

1. **Si los artículos de venta tienen fórmula/composición** y el stock descuenta
   insumos por venta → movimientos de stock de egreso por venta. Opción ideal.
2. **Si no hay fórmulas** → egresos/remitos del CDP hacia cada sucursal
   (lo enviado ≈ lo consumido, con desfase de días). Aproximación aceptable.

Para decidir entre 1 y 2 hay que explorar el esquema real:
`docs/sql/exploracion-insumos.sql` (se corre en SSMS del server, o directo desde
la máquina de Pablo si autoriza la consulta de lectura al SQL de SRVTANGO).

### 2. Actualizar el bridge en el server

Copiar el `tango-bridge.mjs` actualizado a `C:\tango-bridge\` y reiniciar la
tarea programada TangoBridge (o el proceso node). El endpoint nuevo responde 404
hasta ese momento y el sync de la app lo tolera (sincroniza ventas igual y avisa).

## Otros pendientes

- [ ] `TANGO_BRIDGE_SECRET` en los env de Vercel (bi-ventas y cierres) — sin eso
      el cron diario no autentica contra el bridge (el sync manual local sí).
- [ ] Hostname fijo del túnel (named tunnel) — mitigado por el auto-registro.
