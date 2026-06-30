# Facturas IA · Handoff de integración con backend (n8n + Gemini)

## Qué es este paquete

Prototipo funcional del **Panel de Servicios de El Desembarco** — gestión de facturas recurrentes de 18 locales y 28 servicios.

- **Formato**: HTML + React 18 (via CDN) + Babel standalone. **No hay build step.**
- Los `.jsx` se transpilan en el navegador al vuelo. Para producción conviene migrarlo a **Vite + React** (ver sección "Migración recomendada" al final).
- **Stack del prototipo**: vanilla — sin TypeScript, sin Tailwind, sin Next.js, sin package.json.

---

## Árbol del proyecto

```
facturas-ia/
├── Facturas IA.html        ← entry point
├── styles.css              ← todos los estilos (tokens de color + temas)
├── tweaks-panel.jsx        ← panel de ajustes (reutilizable)
├── data.jsx                ← ⚠️ MOCK DATA — reemplazar por llamada API
├── shared.jsx              ← Icon + Sidebar
├── panel.jsx               ← Vista principal: matriz Local × Servicio
├── spreadsheet.jsx         ← Vista planilla plana
├── detail.jsx              ← Drawer lateral con detalle
├── payment.jsx             ← Modal de registrar/revertir pago
├── app.jsx                 ← Root: routing + state + wiring
└── README-INTEGRACION.md   ← este archivo
```

---

## 1. Datos hardcodeados (MOCKS a reemplazar)

**Todo el mock vive en `data.jsx`.** Ningún otro archivo contiene datos — solo lo consumen desde `window.*`.

### 1.1 Constantes (probablemente quedan igual en producción)

```jsx
const LOCALES = ["Anexo", "Boedo", "CDP", ...];                    // 18 strings
const SERVICIOS = ["Agip", "Edenor", "Metrogas", ...];             // 28 strings
const FORMAS_PAGO = ["Debito Automatico", "Transferencia", ...];    // 5 opciones
const MESES = ["2026-04", "2026-05", ...];                          // 9 meses
const MES_ACTUAL = "2026-04";
const SERVICIO_CATEGORIA = { "Edenor": "Energía", ... };            // agrupación columnas
const CATEGORIA_COLOR = { "Energía": "oklch(...)", ... };
```

→ En producción, `LOCALES` y `SERVICIOS` deberían venir de la DB (`GET /api/locales`, `GET /api/servicios`).
→ `MESES` se puede derivar dinámicamente (últimos 12 meses + próximos 3).
→ `MES_ACTUAL` debería ser `new Date().toISOString().slice(0, 7)`.

### 1.2 Dataset principal — `SERVICIOS_DATA`

Array con ~2090 objetos, **esta es la data que tiene que venir del backend**. Un objeto luce así:

```json
{
  "id": "SVC-0001",
  "mes": "2026-04",
  "local": "Boedo",
  "servicio": "Metrogas",
  "monto": 5351.85,
  "vence": "2026-04-16",
  "estado": "VENCIDO",
  "pago": null,
  "forma": null,
  "cliente": "10747695400",
  "titular": "Arata C",
  "tel": "0800-333-6427",
  "user": "adm@eldesembarco.com",
  "pass": "Adm2023.",
  "obs": null
}
```

**Estados posibles**: `"PAGO"` | `"DEUDA"` | `"VENCIDO"` (string literal).

---

## 2. Acciones del usuario → Endpoints a implementar

### `GET /api/facturas?mes=YYYY-MM`
**Qué**: Trae todas las facturas del mes.
**Dónde**: `app.jsx` línea ~17 → `React.useState(SERVICIOS_DATA)` se reemplaza por `useEffect` + `fetch`.
**Respuesta**: `[{ id, mes, local, servicio, monto, vence, estado, pago, forma, cliente, titular, tel, user, pass, obs }]`

### `POST /api/facturas/:id/pago`
**Qué**: Registra un pago manual.
**Disparador**: Modal `PaymentModal` → botón "Confirmar pago" → `onConfirm(updated)` → `confirmPayment` en `app.jsx`.
**Payload**:
```json
{
  "fecha": "2026-04-24",
  "monto": 45200,
  "forma": "Transferencia",
  "nota": "N° 1234567"
}
```
**Respuesta**: factura actualizada con `estado: "PAGO"`, `pago: <fecha>`, `forma: <forma>`.

### `POST /api/facturas/:id/revert`
**Qué**: Revierte un pago (vuelve a DEUDA o VENCIDO según fecha).
**Disparador**: Detail drawer → botón "Revertir pago" (solo visible si `estado === "PAGO"`).
**Payload**: ninguno.
**Respuesta**: factura actualizada con `pago: null`, `estado: "DEUDA"` o `"VENCIDO"`.

### `POST /api/ingesta` *(pendiente de implementar en el front)*
**Qué**: Subir un PDF/foto de factura y mandarlo a n8n para que Gemini extraiga los campos.
**Payload**: `multipart/form-data` con el archivo.
**Flujo**:
1. Frontend sube archivo → `POST /api/ingesta` → webhook n8n
2. n8n ejecuta workflow: OCR → Gemini → match local+servicio
3. n8n devuelve `{ id, campos_extraidos, confianza }` y lo guarda en cola de revisión
4. Si `confianza > 0.85` → auto-inserta en `facturas`. Si no → queda en `/api/revision`.

### `GET /api/revision`
**Qué**: Cola de facturas ingestadas por IA con baja confianza — requieren validación humana.
**Vista asociada**: `page === "revision"` (hoy placeholder).

### `GET /api/calendario?mes=YYYY-MM`
**Qué**: Vencimientos del mes agrupados por día. Derivable del endpoint principal.
**Vista**: `page === "calendario"` (hoy placeholder).

### `GET /api/reportes?from=YYYY-MM&to=YYYY-MM`
**Qué**: Gasto total por local / categoría / servicio.
**Vista**: `page === "reportes"` (hoy placeholder).

### `GET/POST /api/alertas`
**Qué**: Configuración de alertas por email (ej. "avisar 3 días antes del vencimiento").
**Vista**: `page === "alertas"` (hoy placeholder).

---

## 3. Rutas / pantallas de la app

El router es casero con `useState("panel")` en `app.jsx`. Cada valor de `page` matchea una vista:

| `page`          | Componente                  | Implementado | Descripción |
|-----------------|-----------------------------|--------------|-------------|
| `panel`         | `<Panel>` (panel.jsx)       | ✅           | Matriz Local × Servicio con filtros de estado, categoría, búsqueda. Default landing. |
| `planilla`      | `<Spreadsheet>` (spreadsheet.jsx) | ✅     | Tabla plana con todos los registros, columnas configurables. |
| `locales`       | `<Panel>` (mismo)           | ✅ (reusa)   | Vista alternativa (pendiente: filtrar/agrupar por local). |
| `vencidos`      | `<Panel>` (mismo)           | ✅ (reusa)   | Filtrado por estado === VENCIDO. |
| `calendario`    | `<EmptyPage>`               | ❌           | Vencimientos del mes en calendar view. |
| `ingesta`       | `<EmptyPage>`               | ❌ ⚠️        | **Drop zone de PDFs** → dispara `POST /api/ingesta`. |
| `revision`      | `<EmptyPage>`               | ❌ ⚠️        | Cola de extracciones IA con baja confianza. |
| `reportes`      | `<EmptyPage>`               | ❌           | Análisis por local/categoría. |
| `alertas`       | `<EmptyPage>`               | ❌           | Configuración de alertas email. |

### Componentes auxiliares
- **`<Detail>`** (detail.jsx): drawer lateral que se abre al clickear cualquier celda. Muestra monto, fecha, credenciales web (user/pass con toggle + copiar), histórico, observaciones.
- **`<PaymentModal>`** (payment.jsx): modal de registrar pago, con fecha, monto, forma de pago y nota.
- **`<Sidebar>`** (shared.jsx): navegación lateral con contadores de vencidos.
- **`<TweaksPanel>`** (tweaks-panel.jsx): panel de preferencias (tema, densidad, modo de celda). **Puede eliminarse en producción** — es solo para prototipar.

---

## 4. Puntos exactos donde enchufar el backend

Buscá en `app.jsx` los comentarios `🔌 INTEGRACIÓN BACKEND:` — están los 3 lugares donde hay que reemplazar el mock por un `fetch`:

```jsx
// 1. Carga inicial (línea ~17)
const [data, setData] = React.useState(SERVICIOS_DATA);
// → Reemplazar por:
// const [data, setData] = React.useState([]);
// React.useEffect(() => {
//   fetch(`/api/facturas?mes=${MES_ACTUAL}`)
//     .then(r => r.json()).then(setData);
// }, []);

// 2. Revertir pago (línea ~28)
setData(prev => prev.map(r => r.id === reverted.id ? reverted : r));
// → Reemplazar por:
// await fetch(`/api/facturas/${reverted.id}/revert`, { method: "POST" });
// setData(prev => prev.map(r => r.id === reverted.id ? reverted : r));

// 3. Confirmar pago (línea ~38)
setData(prev => prev.map(r => r.id === updated.id ? updated : r));
// → Reemplazar por:
// await fetch(`/api/facturas/${updated.id}/pago`, {
//   method: "POST",
//   headers: { "Content-Type": "application/json" },
//   body: JSON.stringify({ fecha: updated.pago, monto: updated.monto, forma: updated.forma, nota: updated.obs })
// });
// setData(prev => prev.map(r => r.id === updated.id ? updated : r));
```

---

## 5. Migración recomendada a Vite + React + TypeScript

Para llevarlo a producción sugiero:

```
npm create vite@latest facturas-ia -- --template react-ts
```

- Renombrar `.jsx` → `.tsx` y definir tipos para `Factura`, `Local`, `Servicio`.
- Reemplazar `Object.assign(window, {...})` por `export` / `import`.
- Reemplazar `React.useState` y `React.useEffect` por imports explícitos.
- Quitar Babel y React por CDN → usar las deps del `package.json`.
- Agregar **TanStack Query** para manejar fetching + cache.
- Tailwind o Vanilla Extract para estilos, o mantener el `styles.css` tal cual (ya es CSS nativo).

### Schema SQL sugerido (Postgres/Supabase)

```sql
create table locales (
  id serial primary key,
  nombre text unique not null,
  marca text,  -- 'Desembarco' | 'Mr Tasty' | 'Mila & Go'
  direccion text
);

create table servicios (
  id serial primary key,
  nombre text unique not null,
  categoria text not null
);

create table facturas (
  id text primary key,           -- 'SVC-0001'
  mes text not null,             -- '2026-04'
  local_id int references locales(id),
  servicio_id int references servicios(id),
  monto numeric(12,2),
  vence date,
  estado text not null check (estado in ('PAGO','DEUDA','VENCIDO')),
  pago date,
  forma text,
  cliente text,
  titular text,
  tel text,
  user_web text,
  pass_web text,
  obs text,
  -- metadata ingesta IA
  pdf_url text,
  ia_confianza numeric(3,2),
  ia_revisado boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on facturas (mes, local_id);
create index on facturas (estado) where estado != 'PAGO';

create table pagos (              -- historial de pagos (auditoría)
  id serial primary key,
  factura_id text references facturas(id),
  fecha date, monto numeric, forma text, nota text,
  created_by text,
  created_at timestamptz default now()
);
```

### Flow sugerido de n8n

```
[Webhook: POST /ingesta]
   ↓
[Gemini Vision] → extrae { local, servicio, monto, vencimiento, n_cliente, confianza }
   ↓
[Match fuzzy a LOCALES y SERVICIOS]
   ↓
[IF confianza > 0.85]
   ├─ YES → [Supabase: INSERT en facturas]
   └─ NO  → [Supabase: INSERT en revision_queue]
```

---

## 6. Tokens de diseño (ya en styles.css como CSS vars)

```css
:root {
  /* Paleta El Desembarco (claro) */
  --bg: oklch(0.95 0.014 72);         /* crema papel */
  --bg-elev: oklch(0.98 0.008 80);
  --ink: oklch(0.14 0.008 40);
  --accent: oklch(0.55 0.18 28);       /* rojo Desembarco */
  --accent-2: oklch(0.65 0.14 75);     /* dorado */
  --success: oklch(0.55 0.14 155);
  --warn: oklch(0.68 0.16 65);
  --danger: oklch(0.55 0.20 28);
}

[data-theme="dark"] { ... }   /* tema oscuro por default */
[data-theme="mercury"] { ... } /* tema azul alternativo */
```

**Fuentes**: Playfair Display (display italic) + Oswald (labels/headers en mayúsculas) + Inter (UI) + Geist Mono (monospace).

---

**Contacto**: Proyecto diseñado en Claude. Si tu dev necesita aclaraciones, lo más útil es compartirle el prototipo visual corriendo + este README.
