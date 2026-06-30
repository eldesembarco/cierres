# LucIA · Reply Helper · Extensión Chrome

Una extensión de Chrome para que el CM responda reseñas de Google con 1 click,
sin tener que abrir el panel ni copiar/pegar manualmente.

## Qué hace

- **Popup en la barra de Chrome**: muestra todos los borradores pendientes y aprobados del panel
- **3 categorías**: 🚨 Urgentes (1-2★) · ⏳ Pendientes CM (3-4★ con borrador IA) · ✓ Aprobados (5★ auto)
- **Acciones**:
  - 📋 **Copiar** → copia el texto al portapapeles
  - ✓ **Copiar y marcar enviado** → copia + marca el log como SENT en LucIA (cierra el ciclo)
- **FAB en Google Maps**: ícono dorado en la esquina inferior derecha cuando estás en `google.com/maps/*` o `business.google.com/*`. Click → abre el panel de LucIA en nueva pestaña.

## Flujo del CM

1. CM abre Chrome con la extension instalada
2. Click el ícono de la extension en la barra
3. Ve la lista de borradores pendientes con stats arriba
4. Filtra por urgentes / pendientes / aprobados
5. Por cada review:
   - Click "Copiar y marcar enviado"
   - El draft queda en el portapapeles + se marca SENT en LucIA
   - El CM va a Google Maps, abre la review, pega con Ctrl+V, click "Publicar"
6. Refresh del popup → la review desaparece

**Resultado**: 1 click en la extension + 1 ctrl+V + 1 click "Publicar" en Google = ~5 seg por review (vs ir a la web del panel + copiar + pegar).

## Instalación (developer mode)

Mientras no esté en el Chrome Web Store, se carga como "unpacked extension":

1. Abrí Chrome → `chrome://extensions/`
2. Activá el toggle **"Developer mode"** (arriba a la derecha)
3. Click **"Load unpacked"**
4. Seleccioná la carpeta `C:\Users\ferra\Servicios\desembarco-lucia\chrome-extension`
5. Aparece el ícono "LucIA" en la barra de extensiones
6. (Opcional) Pin la extension para tenerla siempre visible

## Auth

La extension usa la **cookie de sesión NextAuth** del browser. Para que funcione:

1. Loguearte una vez en https://desembarco-lucia.vercel.app/login (o el dominio custom cuando esté)
2. La cookie queda guardada en el browser
3. La extension hace `fetch` con `credentials: 'include'` al endpoint `/api/extension/*`
4. NextAuth valida la cookie → autoriza

Si te deslogueas en el panel, la extension va a mostrar "Iniciar sesión" con un link al login.

## Endpoints que consume

| Endpoint | Método | Para qué |
|---|---|---|
| `/api/extension/drafts-pending` | GET | Listar todos los drafts del CM |
| `/api/extension/drafts-pending?reviewId=X` | GET | Buscar draft de una review específica (para futuro content script auto-pegar) |
| `/api/extension/mark-sent` | POST | Marcar log como SENT cuando el CM confirma envío |
| `/api/health` | GET | Discovery del API base (probar dominio custom y fallback) |

CORS: los endpoints permiten origin `*` con `credentials: include` para que extension Chrome y dominios custom puedan consumirlos.

## Próximas mejoras (cuando haya tiempo)

### Auto-detect de review en la página
Hoy la extension solo lista todos los drafts. Cuando el CM está en una review específica, el content script puede:

1. Leer el `reviewId` del DOM o URL
2. Hacer `GET /api/extension/drafts-pending?reviewId=X`
3. Si hay match → mostrar botón floating "🤖 Pegar borrador LucIA"
4. Click → buscar el textarea de respuesta + insertar el texto

Esto reduce a literalmente **1 click** por review (sin abrir popup, sin copiar/pegar).

### Notificaciones push
Cuando llega una nueva review urgente al panel, la extension muestra un badge rojo en el ícono. Click → ve directo la review crítica.

### Settings
- Cambiar el dominio del panel (custom vs vercel.app)
- Filtros default
- Confirmación antes de "marcar como enviado"

## Limitaciones

- Chrome solo (no Firefox/Safari por ahora — manifest v3 difiere)
- No publicada en Chrome Web Store (uso interno via developer mode)
- Si Google cambia el HTML del Maps Manager, el FAB puede dejar de aparecer en la página correcta (fix en `content.js`)
- No hay "auto-pegar" todavía — el CM hace Ctrl+V manualmente

## Iconos

Los archivos `icons/icon16.png`, `icon48.png`, `icon128.png` no están incluidos —
Chrome muestra un placeholder gris. Generá los PNG cuadrados y reemplazalos
en `chrome-extension/icons/`. Recomendación: gradient gold→ember con la "D" en blanco.

## Distribución

Para distribuir a varios CMs sin developer mode:

### Opción A — Chrome Web Store
- Cuenta de developer ($5 una vez)
- Submit con screenshots, descripción, etc.
- Review de Google (~3-7 días)
- Después se instala con 1 click desde el store
- **Privada**: configurable solo para tu Workspace de Google si querés

### Opción B — Distribución interna
- ZIP del folder `chrome-extension/`
- Cada CM hace "Load unpacked" en su Chrome
- Más manual pero suficiente para 2-3 CMs internos

### Opción C — Chrome Enterprise Policy
- Si tu negocio usa Google Workspace Enterprise, podés forzar la instalación
- Sale fuera del scope típico de un piloto, mejor para escala

## Build (no hace falta)

La extension es JavaScript vanilla + HTML + CSS, sin build step. Editás los archivos directos
y Chrome los re-carga cuando tocás "Reload" en `chrome://extensions/`.

Para changelog rápido: bumpá la versión en `manifest.json` antes de cada distribución.
