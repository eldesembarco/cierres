# Gestión de menú · PedidosYa (Delivery Hero)

Doc de referencia para entender qué se puede hacer con el catálogo de PY desde el POS y cómo encaja con la data interna de El Desembarco.

---

## TL;DR

PY te da **3 caminos** para manipular el menú, ordenados por intrusividad:

| Acción | Endpoint | Cuándo |
|---|---|---|
| 🔄 **Update masivo** del catálogo entero | `PUT /v2/chains/{chainCode}/catalog` | Lanzamiento, cambio de precios global, agregar 10+ productos nuevos, cambio de temporada |
| ✏️ **Modificar 1 producto** (precio, nombre, descripción) | `PUT /v2/chains/{chainCode}/globalEntityId/.../modify-product` | Subiste el precio del Doble Cheese, cambiaste descripción, querés borrar 1 ítem |
| 🚫 **Toggle disponibilidad** | `PUT /v2/chains/{chainCode}/vendors/{posVendorId}/catalog/items/availability` | Se acabó la panceta, ahora podés/no podés vender X. Es lo que más vas a usar día a día. |

**Regla práctica**: cambios estructurales (productos nuevos / categorías) → catálogo completo. Cambios menores (precio de uno, fuera de stock) → endpoints específicos.

---

## Glosario rápido

| Término | Qué es |
|---|---|
| **chainCode** | ID que PY te asigna a la cadena "El Desembarco" (cubre todas las sucursales) |
| **posVendorId** | ID interno nuestro de la sucursal en PY (ej `POS_DESEMBARCO_001` Cabildo) |
| **platformVendorId** | ID que PY le da a la sucursal en su plataforma (distinto del nuestro, lo asignan ellos) |
| **globalEntityId** | Identificador del país/región (ej `FP_AR` = Foodpanda Argentina) |
| **menuImportId** | Token que identifica un import en proceso (asíncrono) |
| **Pandora** | Backend nuevo de DH. PY Argentina está en Pandora — significa que `modify-product` funciona |

---

## Camino A · Subir el catálogo completo

### Endpoint

```http
PUT /v2/chains/{chainCode}/catalog
Authorization: Bearer <jwt>
Content-Type: application/json
```

### Body

Estructura jerárquica:

```
Catalog
└── Menu (uno o más, con horarios)
    └── Category[] (Burgers, Veggies, Cervezas…)
        └── Product[] (cada hamburguesa, cerveza, etc.)
            ├── Topping[] (grupos de agregados con min/max selección)
            └── Variant[] (referencias a otros Products — tamaños, sabores)
└── ScheduleEntry[] (horarios reusables)
```

### Comportamiento

- **Asíncrono**: respondés `202 Accepted` con un `menuImportId`
- PY procesa el catálogo y **te llama a una callback URL** que vos especificás en el request body (`callbackUrl` en el JSON)
- En esa callback recibís el resultado: SUCCESS / PARTIAL / FAILED + array de errores específicos
- En paralelo podés pollear `GET /v2/chains/{chainCode}/vendors/{posVendorId}/menu-import-logs` para ver el log

### Cuándo usarlo

- ✅ Lanzamiento inicial (la primera vez)
- ✅ Cambio masivo de precios (ej inflación trimestral)
- ✅ Cambio de temporada (sumar 8 productos nuevos de invierno)
- ✅ Reorganización de categorías
- ❌ Cambio de 1 producto puntual → usar modify-product
- ❌ Out-of-stock → usar availability

### Limitaciones

- Imágenes **mínimo 640×270** o se acepta `<Image></Image>` vacío (sin imagen)
- Si una imagen no cumple el tamaño, todo el import marca FAILED
- El orden de categorías = orden en el array
- Posición de toppings dentro de un Product = orden en el array

---

## Camino B · Modificar un producto

### Endpoint

```http
PUT /v2/chains/{chainCode}/globalEntityId/{globalEntityId}/restaurant/{platformVendorId}/modify-product
Authorization: Bearer <jwt>
Content-Type: application/json
```

### Casos de uso soportados (Pandora — incluye PY Argentina)

| Caso | Soportado |
|---|---|
| Activar / desactivar producto **padre** | ✅ |
| Update **nombre** (por locale) | ✅ |
| Update **descripción** (por locale) | ✅ |
| Update **precio** (a 0 o positivo) | ✅ |
| Update **tags** (se appendea al array existente) | ✅ |
| Update **packaging charge** | ✅ |
| **Borrar producto** | ✅ |
| Linkear topping existente a un producto | ✅ |
| Quitar topping de un producto | ✅ |
| Activar / desactivar producto **hijo** (variante) | ❌ |
| Update **posición de categoría** | ❌ |
| Callback de modify-product | ❌ todavía |

### Body con ejemplo

```json
{
  "processId": "EDESEMBARCO-2026-05-06-001",
  "batchId": "subida-mensual",
  "timestamp": "2026-05-06T10:00:00Z",
  "timestampLastChange": "2026-05-06T09:55:00Z",
  "callback": "https://pos-desembarco.vercel.app/api/py/menu/callback",
  "product": {
    "productId": "burger-bajoncito",
    "parentId": null,
    "action": "upsert",
    "names": [
      { "locale": "es-AR", "value": "Bajoncito", "action": "upsert", "updatedFields": ["value"] }
    ],
    "descriptions": [
      { "locale": "es-AR", "value": "Medallón, cheddar, panceta + papas", "action": "upsert", "updatedFields": ["value"] }
    ],
    "price": "14000",
    "updatedFields": ["price", "name", "description"]
  }
}
```

### Cuándo usarlo

- ✅ Cambiaste el precio del Bajoncito de $14000 a $15500
- ✅ Editaste la descripción ("Ahora con cebolla caramelizada")
- ✅ Querés borrar un producto que ya no vendés
- ✅ Sumar/quitar un topping a un producto puntual
- ❌ Sumar 10 productos nuevos → catálogo completo

### Limitaciones

- Solo **plataformas Pandora** (PY AR está en Pandora ✓ pero verificar con TAM)
- Para producto hijo (variante específica como "Mila Pollo" cuando el padre es "Mila Clásica") tenés que ir por el padre
- No hay callback todavía — tenés que asumir éxito si el HTTP fue 200

---

## Camino C · Toggle disponibilidad

### Endpoint

```http
PUT /v2/chains/{chainCode}/vendors/{posVendorId}/catalog/items/availability
Authorization: Bearer <jwt>
Content-Type: application/json
```

### Body

```json
{
  "items": [
    { "remoteCode": "130001", "available": false, "reason": "OUT_OF_STOCK" },
    { "remoteCode": "140012", "available": true }
  ]
}
```

### Comportamiento

- Síncrono (200/204 directo)
- Acepta múltiples items en un solo request — ideal para batch al cierre
- Cuando marcás `available: false`, el producto se ve **agotado** en PY pero no se borra

### Cuándo usarlo

- ✅ Se acabó la panceta → marcar Bajoncito + San Antonio + Petit Butter como out-of-stock
- ✅ Vuelve el stock por la mañana → re-enable todo
- ✅ Productos por horario manual (ej cervezas solo después de 18hs si no usás Schedules)
- ❌ Para borrar definitivo → usar modify-product con `action: "delete"`

### Endpoint complementario (en development)

```http
GET /v2/chains/{chainCode}/vendors/{posVendorId}/catalog/items/unavailable
```

Te devuelve la lista de items actualmente marcados como no disponibles. La doc dice "in development" — verificar antes de depender de él.

---

## Schema del Catalog (lo que espera PY)

Los nombres de los tipos vienen del archivo oficial [`catalog-schema.yaml`](catalog-schema.yaml) (1176 líneas).

### Catalog (root)

```ts
{
  catalogId: UUID,
  vendors: { [posVendorId]: { id, type: "Vendor" } },  // qué sucursales aplican
  menus:   { [menuId]: Menu },
  categories: { [categoryId]: Category },
  products:   { [productId]: Product },
  toppings:   { [toppingId]: Topping },
  images:     { [imageId]: Image },
  schedules:  { [scheduleId]: ScheduleEntry },
  callbackUrl: "https://...",                  // donde PY te avisa el resultado
}
```

PY usa **referencias por UUID** entre entidades — Menu referencia Categories, Category referencia Products, Product referencia Toppings y Variants. No hay anidamiento — todo va a nivel root y se conecta por ID.

### Product (lo que más vas a tocar)

```ts
{
  id: UUID,
  type: "Product",
  title: { default: "Bajoncito", "es-AR": "Bajoncito" },     // multi-locale
  description: { default: "Medallón, cheddar, panceta + papas" },
  price: "14000",                                              // string!
  containerPrice: "0",
  active: true,                                                // toggle on/off
  calories: 850,
  isPrepackedItem: false,
  isExpressItem: false,
  variants: { [productId]: { id, type: "Product", order: 1 } }, // tamaños
  toppings: { [toppingId]: { id, type: "Topping", order: 1 } }, // agregados
  images:   { [imageId]:   { id, type: "Image",   order: 1 } },
  parent: { id: parentProductId, type: "Product" },            // si es variante
  tags: { masterCategory: [...], occasionType: [...], ageRestricted: [...] },
  foodLabeling: { allergens: [...], nutritionalInfo: { calories, sodium, ... } }
}
```

**Notable**:
- `price` es **string** (no number) — para evitar problemas de float
- `active: false` lo desactiva sin borrarlo
- Soporta múltiples idiomas en `title` y `description`
- `parent` define jerarquía padre/hijo (Mila Clásica padre → Mila Carne / Mila Pollo hijos)

### Topping (grupos de agregados)

```ts
{
  id: UUID,
  type: "Topping",
  title: { default: "Agregados extra" },
  minSelection: 0,
  maxSelection: 3,                              // cuántos puede elegir el cliente
  products: { [productId]: { id, type: "Product", order: 1 } }   // los toppings son Products
}
```

**Importante**: cada topping individual (Extra cheddar, Huevo, etc.) es **un Product** con su precio. El "Topping" en sí es solo el GRUPO. El `Product` referenciado puede tener `price: "1400"`.

### Variant (tamaños)

No es un tipo separado — un Product variant es otro Product con `parent` apuntando al padre y se referencia desde `parent.variants`.

### Multi-locale

Todos los textos visibles soportan locale dictionary:

```json
{
  "title": {
    "default": "Bajoncito",
    "es-AR": "Bajoncito",
    "en-US": "Mini Burger Combo"
  }
}
```

Útil para zonas turísticas. Para Argentina solamente con `default` o `es-AR` alcanza.

### Tags estructurados

```ts
{
  masterCategory: ["BURGERS", "MAIN_COURSE"],   // taxonomía PY
  occasionType: ["GROUP_FRIENDLY", "QUICK_BITE"], // ocasión
  ageRestricted: ["ALCOHOL"]                       // restricciones legales
}
```

PY los usa para filtros y búsqueda en su app. Cuanto mejor taggees, mejor descubribilidad.

### FoodLabeling (regulación europea, recomendado)

```ts
{
  allergens: ["GLUTEN", "DAIRY", "NUTS", "EGG"],
  nutritionalInfo: {
    calories: 850,
    fat: 42, saturatedFat: 18,
    carbs: 65, sugar: 12,
    protein: 38,
    salt: 2.1
  }
}
```

No es obligatorio en Argentina pero ayuda a clientes con alergias.

### Schedules

```ts
{
  id: UUID,
  type: "ScheduleEntry",
  weekdays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  start: "11:00",
  end: "15:00"
}
```

Asociás el schedule a un Menu o Category — esa parte solo aparece en PY durante esos horarios. Casos:

- Menú **almuerzo**: lunes a viernes 11–15
- **Brunch**: sábado y domingo 10–14
- **Cervezas**: todos los días desde 18hs (legal para alcohol)
- **Happy hour**: jueves 17–20

---

## Mapeo de El Desembarco interno → Catálogo PY

Hoy nuestro `Producto` interno ([src/lib/data.ts](../src/lib/data.ts)):

```ts
interface Producto {
  id: string;                       // "130001" (formato 6 dígitos POS)
  cat: CategoriaId;                 // "burgers" | "veggies" | etc.
  nombre: string;                   // "Bajoncito"
  desc?: string;
  precio: number;                   // 14000
  modifs?: string[];                // ["Sin cebolla", "Sin tomate", ...]
  agregados?: [string, number][];   // [["Extra cheddar", 1400], ...]
  sizes?: [string, number][];       // [["Carne", 0], ["Pollo", 0]]
  tag?: ProductoTag;                // "POPULAR" | "DESTACADA" | etc.
}
```

### Mapeo

| Nuestro | PY Catalog | Cómo |
|---|---|---|
| `cat: "burgers"` | Category | Una Category PY por cada CategoriaId, con `title` desde nuestras `categorias[]` |
| `id: "130001"` | Product.id | UUID determinístico desde `id` (mismo string siempre genera mismo UUID) |
| `nombre` | Product.title.default | Direct |
| `desc` | Product.description.default | Direct |
| `precio` | Product.price | `String(precio)` |
| `modifs` (array de strings sin precio) | Topping group `minSelection: 0, maxSelection: 99`, cada string como Product con `price: "0"` | "Sin cebolla", "Cocción jugosa" — todos $0, libre selección |
| `agregados` (array de `[name, price]`) | Topping group `minSelection: 0, maxSelection: 3`, cada `[name, price]` como Product con `price: String(price)` | "Extra cheddar +$1400" |
| `sizes` (array de `[name, priceMod]`) | Variants | Crear N Products hijos con `parent` apuntando al padre. `price = padre.precio + priceMod` |
| `tag: "POPULAR"` | Product.tags.masterCategory | `["POPULAR"]` |
| `tag: "SIN TACC"` | Product.foodLabeling.allergens | `excluyendo: ["GLUTEN"]` |
| `tag: "VEGGIE"` | Product.tags.masterCategory | `["VEGETARIAN"]` |

### Ejemplo concreto

Nuestro:
```ts
{ id: "130001", cat: "burgers", nombre: "Bajoncito", desc: "Medallón, cheddar, panceta + papas", precio: 14000, modifs: modBurger, agregados: addBurger, tag: "POPULAR" }
```

Sale como (extracto):
```json
{
  "products": {
    "ed-prod-130001": {
      "id": "ed-prod-130001",
      "type": "Product",
      "title": { "default": "Bajoncito" },
      "description": { "default": "Medallón, cheddar, panceta + papas" },
      "price": "14000",
      "active": true,
      "tags": { "masterCategory": ["POPULAR", "BURGERS"] },
      "toppings": {
        "ed-modifs-130001": { "id": "ed-modifs-130001", "type": "Topping", "order": 1 },
        "ed-agreg-130001":  { "id": "ed-agreg-130001",  "type": "Topping", "order": 2 }
      }
    }
  },
  "toppings": {
    "ed-modifs-130001": {
      "id": "ed-modifs-130001",
      "type": "Topping",
      "title": { "default": "Modificadores" },
      "minSelection": 0,
      "maxSelection": 9,
      "products": {
        "ed-mod-sin-cebolla":  { "id": "ed-mod-sin-cebolla",  "type": "Product", "order": 1 },
        "ed-mod-sin-tomate":   { "id": "ed-mod-sin-tomate",   "type": "Product", "order": 2 }
      }
    },
    "ed-agreg-130001": {
      "id": "ed-agreg-130001",
      "type": "Topping",
      "title": { "default": "Agregados" },
      "minSelection": 0,
      "maxSelection": 3,
      "products": {
        "ed-agr-extra-cheddar": { "id": "ed-agr-extra-cheddar", "type": "Product", "order": 1 }
      }
    }
  }
}
```

Los toppings (Sin cebolla, Extra cheddar, etc.) se **deduplican** entre productos: hay un solo `ed-mod-sin-cebolla` global y todos los burgers que lo aceptan lo referencian. Reduce el tamaño del catálogo y mantiene consistencia.

---

## Decisiones operativas

### IDs determinísticos vs aleatorios

**Determinísticos** (recomendado). Usamos `ed-prod-${nuestroId}` como ID. Ventajas:

- Re-subir el catálogo no genera duplicados
- `modify-product` puede targetear directo por ID
- Los logs son legibles ("ed-prod-130001 falló")
- Idempotente

**Aleatorios** (UUID v4): cada submit es un mundo nuevo. PY no detecta que es el mismo Bajoncito y crea otro. Mal.

### Cuándo subir catálogo completo vs modify-product

| Escenario | Mejor approach |
|---|---|
| Subiste de precio 5 productos | 5 modify-product llamadas (rápido y atómico por producto) |
| Subiste de precio TODOS por inflación | Catálogo completo (single transaction) |
| Sumaste un producto nuevo | Catálogo completo (PY no soporta "create-product" individual) |
| Borraste un producto | modify-product con `action: "delete"` |
| Cambiaste el orden de categorías | Catálogo completo |
| Out-of-stock temporal | availability toggle |
| Cerraste la sucursal por reforma | availability toggle vendor (otro endpoint, ver "vendors availability") |

### Imágenes

Hoy en `data.ts` no tenemos URLs de imagen. Opciones:

1. **Sin imágenes** (válido — PY acepta `<Image></Image>` vacío). Producto se ve sin foto. **Recomendado para arrancar.**
2. **Cargar fotos a Vercel Blob / Cloudinary** y poner URLs en una nueva propiedad `imageUrl?: string` en `Producto`.
3. **Re-usar las que ya están en menúdigital.eldesembarco** si las hubiera.

Mínimo 640×270. Hoy 1920×1080 es lo standard.

### Multi-sucursal

`vendors` en el Catalog acepta múltiples `posVendorId`. Estrategia:

- **A** (recomendado): UN catálogo para todas las sucursales si el menú es idéntico. Cuando arranquemos así.
- **B**: catálogos distintos por sucursal si Cabildo tiene Bajoncito Doble y Gualeguaychú no. Más complejo.
- **C**: catálogo igual + availability toggle por sucursal para diferencias menores. **Lo más práctico para empezar**.

---

## Trigger desde PY (camino C inverso)

PY puede pedirte que les pushees el menú actualizado en cualquier momento. Te llega como webhook:

```http
POST /api/py/menu/{remoteId}
Authorization: Bearer <token>
```

Vos respondés 200 con el menuImportId y luego hacés `POST /v2/menu/{vendorCode}/{menuImportId}` con el catálogo actualizado.

Esto NO está implementado todavía en nuestro código. Para implementar:

1. Endpoint `/api/py/menu/[remoteId]/route.ts` que recibe el trigger
2. Buildear el catálogo desde nuestro `data.ts`
3. Hacer el POST al middleware

---

## Pre-requisitos antes de poder hacer cualquier cosa

| Requisito | Quién lo provee | Estado |
|---|---|---|
| `chainCode` | Marcos (TAM PY) | ⏳ pendiente |
| `posVendorId` por sucursal | Definimos nosotros + confirmamos con Marcos | ⏳ pendiente |
| `globalEntityId` (FP_AR) | Marcos | ⏳ pendiente |
| `platformVendorId` por sucursal | Marcos lo asigna después de submit catalog inicial | ⏳ pendiente |
| `PY_USERNAME` / `PY_PASSWORD` | Marcos cifrado con nuestra PGP | ⏳ pendiente |
| Imágenes 640×270+ | Vos | ⚠️ opcional para arrancar |
| Lista final de productos en PY | Vos (no todos los productos del salón van a delivery) | ⏳ pendiente |
| Locale strategy | Decisión nuestra | ✓ decidido: solo `default` (es-AR implícito) |

---

## Próxima implementación (post creds)

1. **Builder** ([src/lib/py/catalog/builder.ts](../../src/lib/py/catalog/builder.ts)) — convierte `Producto[]` interno → JSON Catalog oficial
2. **Cliente** ([src/lib/py/catalog/client.ts](../../src/lib/py/catalog/client.ts)) — wrappers de submit + availability + modify-product
3. **Endpoints internos**:
   - `POST /api/py/menu/preview` — devuelve el JSON que se subiría (para testing)
   - `POST /api/py/menu/submit` — buildear + push al middleware
   - `PUT /api/py/menu/availability/[sku]` — toggle on/off rápido
   - `PUT /api/py/menu/product/[id]` — modify product (precio, nombre, etc)
4. **Plugin endpoint** `/api/py/menu/[remoteId]` — recibe el trigger de PY (cuando ellos piden refresh)
5. **UI** `/admin/menu` — pantalla con ver catálogo + toggle availability + edit precio

---

## Limitaciones conocidas

- **No podés**: cambiar la posición visual de categorías sin re-subir todo
- **No podés**: actualizar producto hijo (variante) directo — hay que ir por el padre
- **No podés**: subir imágenes < 640×270
- **No podés**: borrar una categoría entera con un endpoint — hay que mandar catálogo nuevo sin esa categoría
- **No podés**: ver el resultado final de modify-product por callback — solo HTTP 200
- **`Get items unavailability`** está marcado "IN DEVELOPMENT" — no confíes en él para QA todavía

---

## Referencias oficiales

- Catalog Import: https://integration-middleware.stg.restaurant-partners.com/apidocs/pos-middleware-api#tag/Catalog-Import
- Catalog Item Availability: https://integration-middleware.stg.restaurant-partners.com/apidocs/pos-middleware-api#tag/Catalog-Item-Availability
- Modify Product Details: https://integration-middleware.stg.restaurant-partners.com/apidocs/pos-middleware-api#tag/Modify-Product-Details
- Schema completo (local): [catalog-schema.yaml](catalog-schema.yaml)
- Spec middleware completa (local): [middleware.yaml](middleware.yaml)
