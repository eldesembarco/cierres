# Handoff: POS El Desembarco — Sistema de gestión para bar/cervecería

## Overview
POS multipantalla para bar/cervecería con integración a apps de delivery (PedidosYa, Rappi, MP Envíos), pantalla de cocina (KDS), gestión de salón con mapa de mesas, tablet para mozos, cobro/ticket, delivery propio y reportes de fin de turno.

## About the Design Files
Los archivos en este bundle son **referencias de diseño creadas en HTML/JSX (React vía Babel inline)** — prototipos hi-fi mostrando el look y comportamiento esperado. **No son código de producción para copiar directamente.** El objetivo es **recrear estos diseños en el codebase final** (Next.js / Vite / SwiftUI / nativo / lo que corresponda) usando los patrones, librerías y design system del proyecto destino.

Si todavía no hay codebase, recomendamos: **Next.js + TypeScript + Tailwind + shadcn/ui** para web, o **React Native / Expo** si va a correr en tablets Android. Para el KDS conviene una app dedicada (puede ser PWA) por la pantalla siempre encendida.

## Fidelity
**Hi-fi.** Colores, tipografía, espaciados e interacciones están definidas. Los modificadores, estados y flujos son representativos de la lógica de negocio real. Los datos están mockeados en `data.js` con la lista de precios real (Mayo 2026).

## Pantallas (7)

### 1. POS principal (`pos.html`) — 1920×1080, monitor caja
- Buscador prominente arriba + chips de categorías (Burgers, Veggies, Papas, Entradas, Ensaladas, Tostados, Milanesas, Sandwich Mila, Sin TACC, Combos, Cervezas, Gaseosas, Aguas)
- Grilla de productos a la izquierda (auto-fill, minmax 180px)
- Ticket lateral derecho (440px) con items + totales + acciones
- Topbar con logo, nav entre pantallas, usuario activo
- **Estados de producto**: tag opcional (POPULAR, DESTACADA, VEGGIE, RECARGA, COMBO, PROMO, SIN TACC, PARA 2)

### 2. Salón (`salon.html`) — 1920×1080
- Layout: panel izquierdo 200px (stats + leyenda + filtros sector) / mapa central / panel derecho 320px (detalle de mesa seleccionada)
- Mapa: canvas de 1380×940 con auto-scale, mesas posicionadas absolutas con coordenadas reales del salón
- 14 mesas: 3 sectores (ventana, central, derecho) + 4 barras altas
- **Estados de mesa**: `libre`, `ocupada`, `esperando` (mozo tomando pedido), `porPagar`, `reservada`
- Cada mesa muestra: número grande, pill superior con info del estado (tiempo + total / pago / "esperando" / hora reserva), footer con mozo + items, o capacidad si está libre
- Decoraciones: ventana arriba, BARRA, BAÑOS, COCINA, paredes divisorias

### 3. Tablet Mozo (`mozo.html`) — 1280×800, tablet horizontal
- Layout más compacto que el POS de caja
- Buscador + categorías como chips
- Grilla de productos (auto-fill 160px)
- Ticket lateral 380px
- **Sheet modal de modificadores** al tocar un producto: tamaños (chico/mediano/grande), agregados con costo, sin/con (sin cebolla, etc), notas libres

### 4. KDS Cocina (`kds.html`) — 1920×1080, modo oscuro permanente
- Kanban 3 columnas: Nuevo / En preparación / Listo
- Tickets como cards: número de pedido grande, origen visible (mesa con número, app con tag de color), cronómetro grande
- **Cronómetro rojo a partir de 15 min** (animación pulse-warn)
- Color de borde por origen: amber (mesa), rosa (PedidosYa), rojo (Rappi), celeste (MP), verde oscuro (delivery propio)
- Toque del ticket completo lo bumpea de columna

### 5. Bandeja Apps (`apps.html`) — 1920×1080
- Tabs principales: Activos / Historial
- Filtros chips por app: Todas / PedidosYa / Rappi / MP Envíos (con counts)
- KPIs: Nuevos / Preparando / Listos
- Tabla con columnas: App · ID·Hora · Cliente · Detalle · Estado (sin total ni descuentos en la fila)
- Panel detalle derecho (460px): cliente + pago, items con desglose y descuentos, acciones según estado
- **Comanda modal**: ticket de cocina sin precios, con barcode SVG generado del ID + QR placeholder con finder patterns reales. Botón "Aceptar e imprimir comanda" en pedidos nuevos, "Ver/Reimprimir comanda" en otros estados.

### 6. Cobro / Ticket (`ticket.html`) — 1920×1080
- Layout 3 columnas: ticket de la mesa (preview impreso) / divisor de cuenta + propina / métodos de pago
- Dividir cuenta: 1 / 2 / 3 / 4 / 5+ partes
- Propinas: 0% / 5% / 10% / 15% / otro
- Métodos: efectivo, débito, crédito, MP, transferencia, etc.

### 7. Reportes (`reportes.html`) — 1920×1080
- KPIs (4 cards): facturado total, tickets, ticket promedio, propinas
- Ventas por hora (gráfico de barras)
- Ventas por canal (donut: salón / PedidosYa / Rappi / MP / propio)
- Top productos (lista con barras horizontales)
- Métodos de pago (lista)
- Por mozo (ranking)
- Caja (resumen con totales)

## Design Tokens

### Colors — Brand
```css
--brand-amber: #F5A623;        /* primario */
--brand-amber-deep: #D08813;   /* hover */
--brand-amber-soft: #FCE6BA;   /* fills suaves (light) */
--brand-black: #0E0C0A;
--brand-bottle: #2E7D4B;       /* éxito / mesa libre */
--brand-bottle-soft: #D6EADC;
--brand-rojo: #D62828;         /* alerta / cancelar */
--brand-rojo-soft: #F8D7D7;
--brand-amarillo: #F5A623;     /* warning */
--brand-amarillo-soft: #FCE6BA;
```

### Colors — Apps externas
```css
--app-pedidosya: #FA0050;
--app-rappi: #FF1744;
--app-mp: #00B1EA;
--app-propio: #2E5D3F;
```

### Colors — Light theme
```css
--bg: #F5F3EE;           /* warm beige */
--bg-elevated: #FFFFFF;
--surface: #FFFFFF;
--surface-2: #F5F3EE;
--surface-3: #EAE7DF;
--border: #E2DED4;
--border-strong: #C9C2B2;
--text: #1A1714;
--text-2: #4A413A;
--text-3: #7A7065;
--text-4: #A89E92;
```

### Colors — Dark theme
```css
--bg: #14110E;
--bg-elevated: #1F1B16;
--surface: #25201A;
--surface-2: #2C2620;
--surface-3: #36302A;
--border: #3A332B;
--border-strong: #524739;
--text: #F4EFE6;
--text-2: #D4CCBC;
--text-3: #9A8F7E;
--text-4: #6F6557;
--brand-amber-soft: #4A2E14;
--brand-bottle-soft: #1B3825;
--brand-rojo-soft: #4A1818;
--brand-amarillo-soft: #4A3818;
```

### Typography
- Sans: `Inter`, system-ui, sans-serif (UI general)
- Mono: `JetBrains Mono`, "Courier New", monospace (números tabulares, ticket, comanda)
- Escala: 11px / 12px / 13px / 14px / 16px / 20px (xs/sm/base/md/lg/xl)

### Spacing & Radius
```css
--row-h: 56px;        /* hit target táctil regular */
--tile-h: 92px;
--gap: 12px;
--radius: 10px;
--radius-lg: 14px;
--radius-sm: 6px;
--pad-screen: 24px;
```

### Densidad (3 modos vía `[data-density]`)
- `compact`: row-h 44, tile-h 76, gap 8
- `regular` (default): row-h 56, tile-h 92, gap 12
- `comfortable`: row-h 64, tile-h 108, gap 16

## State Management
Cada pantalla maneja su propio estado local con `React.useState`. Variables clave por pantalla:

- **POS**: categoría seleccionada, filtro buscador, items en ticket, modal modificadores
- **Salón**: mesa seleccionada (`sel`), sector/filtro
- **Mozo**: ídem POS pero más compacto
- **KDS**: tickets agrupados por estado (sin estado interno — derivado de `pedidos`)
- **Apps**: `vista` (activos|historial), `filtro` (all|pedidosya|rappi|mp), `sel` (id pedido), `comanda` (pedido a imprimir)
- **Tweaks globales**: tema (`light`|`dark`), densidad (`compact`|`regular`|`comfortable`), simulación de pedido entrante, override de estado de mesa 5

Persistencia esperada (cuando se construya el back):
- Pedidos en DB con estado: `nuevo` → `preparacion` → `listo` → `entregado` (o `cancelado`)
- Mesas con estado en tiempo real (websocket recomendado)
- Sincronización webhook con PedidosYa, Rappi, MP

## Integraciones esperadas (back)
- **PedidosYa Partners API**: webhooks de pedido nuevo, aceptar/rechazar, marcar listo, marcar entregado
- **Rappi RestaurantesAPI**: ídem
- **Mercado Pago Envíos**: API de envíos + cobro QR/online
- **Impresoras térmicas**: ESC/POS por USB/red para ticket fiscal y comanda. La comanda usa Code 128 para barcode y QR estándar (URL al pedido o ID).
- **AFIP**: emisión de ticket fiscal (factura A/B/C según cliente)

## Files
```
proyecto/
├── *.html                      # 7 pantallas independientes
├── index.html                  # Design canvas con todas las pantallas
├── data.js                     # Mock data (productos reales mayo 2026, mesas, pedidos, inbox apps)
├── styles.css                  # Tokens, base, componentes (btn, pill, card, etc)
├── styles-screens.css          # Estilos específicos por pantalla
├── fullscreen-shell.jsx        # Shell de scaling para 1920×1080 / 1280×800
├── fullscreen.css              # Chrome del shell (dock, toggles)
├── design-canvas.jsx           # Canvas pannnable/zoom para preview
├── tweaks-panel.jsx            # Panel de tweaks (theme, densidad, sim pedido)
└── components/
    ├── icons.jsx               # Iconos SVG inline
    ├── topbar.jsx              # Topbar compartido
    ├── screen-pos.jsx
    ├── screen-salon.jsx
    ├── screen-mozo.jsx
    ├── screen-kds.jsx
    ├── screen-apps.jsx          # incluye ComandaModal, Barcode, QrPlaceholder
    ├── screen-ticket.jsx
    └── screen-reportes.jsx
```

## Lista de productos (extracto)
La lista completa real está en `data.js`. Categorías: Burgers (12), Veggies (2), Papas (5), Entradas (5), Ensaladas (3), Tostados (4), Milanesas (5), Sandwich Mila (3), Sin TACC (2), Combos (2), Cervezas tiradas (6), Gaseosas (17), Aguas (2). Los productos tienen `id`, `cat`, `nombre`, `desc`, `precio`, `modifs` (sin/con), `agregados` (con costo), opcional `sizes` y `tag`.

## Notas para el dev
- Todos los precios están en pesos argentinos (formateo via `fmtAR`)
- Los hit targets en tablet/táctil son ≥44px (densidad compact) o ≥56px (regular)
- El KDS debe correr en monitor siempre encendido, modo oscuro permanente
- La comanda imprime en 80mm térmica (380px de ancho en pantalla equivale ~80mm)
- Idioma: Español (Argentina) — usar "mozo" no "mesero", "ítems" con tilde
- El barcode actual es un mock visual; en producción usar Code 128 real (lib jsbarcode o similar)
- El QR es un placeholder; en producción debe contener el ID del pedido o una URL al detalle

## Próximos pasos sugeridos
1. Definir stack del back (sugerencia: Node + Postgres + Redis + Socket.io)
2. Implementar webhook receivers para PedidosYa/Rappi/MP
3. Driver ESC/POS para impresoras térmicas (cocina + caja)
4. Auth multi-rol (cajero, mozo, cocinero, admin)
5. Sincronización en tiempo real entre POS / Salón / KDS / Tablet
6. Cierre de turno con arqueo de caja y reportes
