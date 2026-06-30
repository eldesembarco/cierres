# Control de cajas — Guía de uso + chequeo del prototipo

*Grupo Desembarco · App: https://cierres-seven.vercel.app · Admin: admin@eldesembarco.com / admin1234*

---

## 1. Qué es (en una frase)

Una app que reemplaza el Excel de cierres y, además, **concilia** lo que cada local declara contra lo que el sistema vendió y contra la plata que entró de verdad. La idea: que **tres números cierren**.

## 2. Las tres patas del control

| Pata | De dónde sale | Qué responde |
|---|---|---|
| **Qué se vendió + cómo se cobró** | **Cierre de caja** (carga del encargado / PDF de Tango) | venta por turno y **forma de cobro** (efectivo/tarjeta/QR/delivery) |
| **Qué plata entró de verdad** | **Mercado Pago** + **PedidosYa** | cobranza real, comisión, devoluciones |
| **Cuánto se depositó** | **Cierre** (efectivo depositado) | el cuadre físico de la caja |

> El **efectivo** es lo único que mueve la *diferencia de caja*. El delivery (Mercado Pago / PedidosYa) entra como **control**, no toca la caja.

---

## 3. Paso a paso — cómo cargar cada archivo

### A) El cierre de caja (la base de todo)
Dos caminos, el resultado es el mismo:
1. **El encargado lo carga** desde el celular: entra a **Cierres → Cierre de hoy**, y por cada turno toca **“+ Agregar ingreso”** (elige el medio: efectivo, tarjeta, Mercado Pago, PedidosYa, Mercado Delivery…) y **“+ Agregar gasto”**. Carga el efectivo depositado y cierra el turno.
2. **Desde el PDF de Tango** (admin): **Importaciones → “Cierre de Tango (PDF)”** → elegís el local y subís el PDF del cierre de turno. Después, en la planilla del día, **“Importar desde Tango”** lo precarga solo.

### B) Mercado Pago (Mercado Delivery) — *NUEVO*
1. Bajá de Mercado Pago el reporte **“collection”** (Excel).
2. En la app: **Importaciones → “Mercado Pago — Mercado Delivery”** → elegí el `.xlsx` → **Importar**.
3. La app te muestra al instante, **por local**: **bruto cobrado**, **neto liquidado**, **comisión de MP** y **devoluciones**. Los locales que no estén mapeados (por su `store_id`) aparecen aparte para agregarlos.

### C) Apps de delivery (PedidosYa)
1. Bajá el CSV **“endOfDay”** de PedidosYa.
2. **Importaciones → “Importar reporte PedidosYa”** → poné la fecha → subí el CSV → **Subir y procesar**.

---

## 4. Cómo leer el cruce (la conciliación)

Entrá a **Control**, elegí **local y día**. Vas a ver una tabla:

| Plataforma | Declarado | App | Dif. | % |
|---|---|---|---|---|
| Mercado Delivery | $1.211.930 | $1.211.930 | 🟢 $0 | 0% |
| PedidosYa | $480.000 | $478.500 | 🟡 −$1.500 | −0,3% |

- **Declarado** = lo que el cierre dice que se vendió por ese canal.
- **App** = lo que Mercado Pago / PedidosYa realmente cobró.
- 🟢 verde = cuadra · 🟡 amarillo = diferencia chica · 🔴 rojo = revisar (faltante, pedido no cobrado, o anulación).

> La **comisión** de Mercado Pago no es un error: es esperada (~2,8%). Por eso el cruce compara contra el **bruto cobrado** (lo que se vendió), y el **neto** (lo que entró a la cuenta) se muestra aparte.

---

## 5. Guion para la demo de mañana (5 minutos)

1. **Entrar como admin** → mostrar el panel y el **selector de local** arriba.
2. **Importaciones → subir el Excel de Mercado Pago** → mostrar el panel: *“San Telmo bruto $1.211.930 / neto $1.183.808 / comisión $28.121 / 17 devoluciones; Microcentro $257.560; Mila&Go sin mapear”*. **Este es el momento fuerte: en 2 segundos sabés cuánto cobró cada local y cuánto se llevó MP.**
3. **Abrir el cierre de San Telmo del 28/05**, cargar un ingreso **Mercado Delivery $1.211.930** y cerrar.
4. **Control → San Telmo → 28/05** → mostrar la fila **Mercado Delivery 🟢 cuadra**. Si cargás $1.200.000 en vez de $1.211.930, se pone 🔴 → *“faltan $11.930”*.
5. Cerrar contando las otras patas: cierre por turno, mobile, control **ciego** para el local (anti-fraude), auditoría, informes con Excel.

---

## 6. Chequeo del prototipo — qué está fuerte y qué mejoraría

### ✅ Lo que ya está sólido (para destacar)
- Cierre **por turno**, **mobile**, carga simple para el encargado.
- Control **ciego** para el local (no ve la diferencia) → anti-fraude, con **auditoría** de cambios.
- **Forma de cobro** desde el cierre de Tango (lo único que mueve la caja).
- **Conciliación de delivery**: PedidosYa **+ Mercado Delivery** (declarado vs plata real, con comisión).
- **Multi-local**, **informes** descargables en Excel, **fondo fijo**, gastos con comprobante.

### 🔧 Lo que mejoraría (priorizado)

**Rápidas (alto impacto, poco esfuerzo):**
1. **Tablero del día** con semáforos: venta total, delivery (declarado vs cobrado) y caja, todo de un vistazo (hoy el control es por local+día).
2. **Mostrar neto y comisión en el Control** (no solo el bruto) → “qué plata entra de verdad”.
3. **Pantalla para mapear locales nuevos** (hoy el `store_id` de MP se mapea por configuración; falta una UI).
4. **Aviso de fechas**: MP liquida a **T+7** → conciliar siempre por **fecha de venta**.

**Medianas:**
5. **Activar la ingesta automática de cierres por mail** (n8n) → hoy el PDF se sube a mano; es la columna vertebral.
6. **Importador de Qlik** para **rentabilidad / CMV / margen** (fase aparte del cuadre).
7. **Gestión de usuarios y locales** desde la app (hoy por configuración).
8. **Cuenta corriente, saldo de fondo fijo y compensaciones** (faltantes/sobrantes que se arrastran) → control financiero más fino.

**Robustez / operación:**
9. **Tolerancia a formatos variables** de los PDF/Excel (cada uno cambia un poco) — ya hecho para Tango; replicar en MP cuando lleguen variantes.
10. **Conciliación de Rappi / Uber** cuando consigamos sus reportes.

> Honesto para la presentación: el prototipo **ya concilia delivery de verdad**. Lo que falta para “producción” es sobre todo **operativo** (activar los correos automáticos, mapear los 16 locales, conseguir reportes del mismo rango) más que técnico.

---

## 7. Accesos

- **App:** https://cierres-seven.vercel.app
- **Admin:** admin@eldesembarco.com / admin1234
- **Encargado (San Telmo):** santelmo@eldesembarco.com / santelmo1234
- Datos de prueba ya cargados: importación de Mercado Pago del 28/05 (San Telmo + Microcentro).
