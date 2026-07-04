# Handoff para sistemas: ventas por hora y por artículo en el bridge de Tango

Para el BI de ventas de los locales necesitamos que el bridge (`tango-bridge.mjs`,
el mismo que hoy expone `/cobros` sobre `vw_CobrosDiarios`) sume **dos endpoints**
que lean **dos vistas nuevas**. Además seguimos necesitando el **hostname fijo**
del túnel de Cloudflare (el quick-tunnel `trycloudflare.com` se cae cada vez que
se reinicia la máquina; hoy 04/07 está caído de nuevo).

## Endpoint 1: `GET /ventas-horas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`

Mismo esquema de auth que `/cobros` (header `x-bridge-secret`). Devuelve JSON:

```json
[
  { "fecha": "2026-07-02", "id_sucursal": 4, "hora": 12, "importe": 152340.50, "tickets": 18 }
]
```

- Una fila por (fecha, sucursal, hora) con la **venta facturada** de esa hora
  (misma definición que el Z: comprobantes de venta, netos de anulaciones) y la
  cantidad de tickets/comprobantes.
- `hora`: 0–23, hora local de emisión del comprobante.
- Todas las sucursales está bien (nosotros filtramos las propias por `id_sucursal`).

## Endpoint 2: `GET /ventas-articulos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`

```json
[
  { "fecha": "2026-07-02", "id_sucursal": 4, "cod_articulo": "030009", "descripcion": "CIABATTA", "rubro": "PANES", "cantidad": 42.0, "importe": 98700.00 }
]
```

- Una fila por (fecha, sucursal, artículo): cantidad vendida e importe facturado
  (renglones de los comprobantes de venta, netos de anulaciones/NC).
- `rubro` es opcional pero muy útil (agrupar burgers vs extras vs bebidas): si el
  artículo tiene rubro/familia en Tango, mandarlo; si no, `null`.

## Vistas sugeridas (borrador — VALIDAR contra el esquema real)

Ustedes conocen el esquema real (armaron `vw_CobrosDiarios` en
`CENTRAL_ESTADISTICA`); esto es orientativo sobre tablas estándar de Tango
(cabecera y renglones de comprobantes de ventas + maestro de artículos):

```sql
-- vw_VentasPorHora: venta e importe por sucursal/fecha/hora.
-- Cabecera de comprobantes de venta (facturas/tickets, excluir anulados;
-- las NC restan). Si la cabecera no guarda hora de emisión, usar el campo
-- de hora del POS/Tiendas.
CREATE VIEW vw_VentasPorHora AS
SELECT
  CAST(c.FECHA_EMIS AS date)        AS fecha,
  c.ID_SUCURSAL                     AS id_sucursal,
  DATEPART(hour, c.HORA_EMIS)       AS hora,          -- VALIDAR nombre del campo
  SUM(c.IMPORTE_TOTAL * CASE WHEN c.TIPO = 'NC' THEN -1 ELSE 1 END) AS importe,
  COUNT(*)                          AS tickets
FROM <comprobantes_venta_cabecera> c
WHERE c.ANULADO = 0
GROUP BY CAST(c.FECHA_EMIS AS date), c.ID_SUCURSAL, DATEPART(hour, c.HORA_EMIS);

-- vw_VentasPorArticulo: cantidad e importe por sucursal/fecha/artículo.
CREATE VIEW vw_VentasPorArticulo AS
SELECT
  CAST(c.FECHA_EMIS AS date)  AS fecha,
  c.ID_SUCURSAL               AS id_sucursal,
  r.COD_ARTICU                AS cod_articulo,
  a.DESCRIPCIO                AS descripcion,
  a.RUBRO                     AS rubro,               -- o NULL si no manejan rubro
  SUM(r.CANTIDAD * CASE WHEN c.TIPO = 'NC' THEN -1 ELSE 1 END) AS cantidad,
  SUM(r.IMPORTE  * CASE WHEN c.TIPO = 'NC' THEN -1 ELSE 1 END) AS importe
FROM <comprobantes_venta_renglones> r
JOIN <comprobantes_venta_cabecera> c ON c.ID_COMPROBANTE = r.ID_COMPROBANTE
JOIN <maestro_articulos> a ON a.COD_ARTICU = r.COD_ARTICU
WHERE c.ANULADO = 0
GROUP BY CAST(c.FECHA_EMIS AS date), c.ID_SUCURSAL, r.COD_ARTICU, a.DESCRIPCIO, a.RUBRO;
```

**Criterio clave:** la suma diaria de cualquiera de las dos vistas para una
sucursal tiene que dar (aprox.) el **Z del día** de esa sucursal — así validamos
que la fuente es venta y no cobros. Ejemplo de control: Microcentro 02/07 debe dar
≈ $1.610.516 (no $720.916 como da `/cobros`).

## En el bridge (`tango-bridge.mjs`)

Duplicar el handler de `/cobros` cambiando la vista y los parámetros; mismos
`desde`/`hasta`, mismo `x-bridge-secret`, mismo formato de error. Nada más.

## Checklist

- [ ] Vista `vw_VentasPorHora` (validada contra el Z de un día conocido)
- [ ] Vista `vw_VentasPorArticulo` (misma validación de total)
- [ ] Endpoints `/ventas-horas` y `/ventas-articulos` en el bridge
- [ ] Hostname fijo del túnel (named tunnel de Cloudflare, no quick-tunnel)
- [ ] Pasarnos la URL nueva para actualizar `TANGO_BRIDGE_URL`
