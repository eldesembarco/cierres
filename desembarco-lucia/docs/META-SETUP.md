# Meta Setup · Instagram DMs + Messenger + IG Comments

Guía de configuración paso a paso. Lo bueno: en **modo Development** funciona sin App Review (suficiente para uso interno). App Review se hace después si el panel sale a usuarios externos.

## Pre-requisitos del lado tuyo

### 1. Cuentas Instagram en modo Business

Por cada cuenta IG que quieras conectar (ej. `@mrtasty.ok`, `@eldesembarco`):
- Abrí Instagram → Configuración → Cuenta → **Tipo de cuenta**
- Tiene que decir **"Profesional - Empresa"** (no "Personal" ni "Creador")
- Si dice otra cosa, migrar (gratis, 30 segundos)

### 2. Vincular cada IG a una Página de Facebook

Meta requiere que cada IG Business esté vinculada a una Page de FB para acceder via API.

- IG → Configuración → Centro de cuentas → **Cuentas vinculadas**
- Agregar la Página de FB correspondiente

Si no tenés Página FB para esa marca, crear una gratis: https://www.facebook.com/pages/create

### 3. Meta Business Manager configurado

Ya lo tenés según el screenshot que mandaste (`El Desembarco - General` aparece en https://business.facebook.com).

Asegurate de que las Páginas FB de las marcas estén agregadas como **activos** del Business.

## Paso 1: Crear App de Developer

👉 **https://developers.facebook.com/apps**

1. Login con la cuenta de Pablo Olejavetzky (la admin del Business Manager)
2. **Crear app** → tipo **"Business"**
3. Nombre: `Desembarco LucIA Inbox`
4. Email de contacto: tuyo
5. **Business portfolio**: seleccionar el Business `El Desembarco - General`
6. **Crear app**

## Paso 2: Agregar productos a la app

Dashboard de la app → **"Add products to your app"**:

- ☑ **Messenger** — para mensajes de Pages FB
- ☑ **Instagram** → "Instagram Graph API"
- ☑ **Webhooks** — para notificación tiempo real

## Paso 3: Configurar Webhook (lo más importante)

LucIA recibe los eventos de Meta a este endpoint:

**Production URL**: `https://desembarco-lucia.vercel.app/api/webhooks/meta`

### En la app de Meta:

1. Sidebar izquierdo → **Webhooks**
2. **Page** subscription → "Edit"
   - Callback URL: `https://desembarco-lucia.vercel.app/api/webhooks/meta`
   - Verify Token: (cualquier string secret, lo elegís vos — ej. `lucia-meta-2026-secret`)
   - Subscription fields: tildar `messages`, `messaging_postbacks`
   - **Verify and save** → Meta llama al endpoint con el challenge → tiene que devolver 200
3. **Instagram** subscription → "Edit"
   - Callback URL: igual
   - Verify Token: igual
   - Subscription fields: tildar `messages`, `comments`
   - Verify and save

### En LucIA, agregar las env vars:

```env
META_WEBHOOK_VERIFY_TOKEN="lucia-meta-2026-secret"
META_APP_SECRET="<el App Secret de la app de Meta, sale en Settings → Basic>"
META_APP_ID="<el App ID, también en Settings → Basic>"
```

Subirlas a Vercel:
```bash
vercel env add META_WEBHOOK_VERIFY_TOKEN production
vercel env add META_APP_SECRET production
vercel env add META_APP_ID production
```

Después re-deploy.

## Paso 4: Agregar test users (mientras la app esté en Development)

Sidebar → **Roles** → **Roles**:
- Add People → tu cuenta de FB personal (Pablo Olejavetzky)
- Sumá CMs si tenés (con su FB personal)

**Importante**: solo estos users pueden usar la app mientras esté en Development. Cuando tengamos uso público, hay que pasar a App Review (1-3 semanas).

## Paso 5: Permisos / Scopes

Sidebar → **App Review** → **Permissions and Features**

Para Development bastan estos (no requieren review):
- `pages_show_list`
- `pages_messaging`
- `pages_read_engagement`
- `pages_manage_metadata`
- `instagram_basic`
- `instagram_manage_messages`
- `instagram_manage_comments`

Para producción cuando salga a otros usuarios, requiere App Review por cada uno con video demo.

## Paso 6: Conectar Páginas + obtener tokens

Esto es lo que vamos a automatizar después con un endpoint OAuth en LucIA. Para el setup inicial, lo hacemos manual:

### Opción A — Graph API Explorer (más rápido)

1. https://developers.facebook.com/tools/explorer/
2. Top right: seleccionar **tu app `Desembarco LucIA Inbox`**
3. **User Access Token** → tildar permisos:
   - `pages_show_list`
   - `pages_messaging`
   - `pages_manage_metadata`
   - `pages_read_engagement`
   - `instagram_basic`
   - `instagram_manage_messages`
   - `instagram_manage_comments`
4. **Generate Access Token** → autorizar → te da un token de **1 hora**
5. Copiar ese token → en LucIA usaremos `exchangeShortLivedForLongLived()` para obtener uno de **60 días**
6. Después con el token de larga vida, llamar `getPageAccessTokens()` para obtener los tokens **por página** (también larga vida)

### Después en LucIA:

Crear un endpoint admin (TODO) o hacer manual via Prisma Studio:

```sql
-- Por cada Página/IG que querés conectar, insertar una row en MetaAccount
INSERT INTO "MetaAccount" (id, channel, "externalId", "brandName", handle, "pageName", "accessToken", "tokenExpiresAt", active, "createdAt", "updatedAt")
VALUES
  (cuid(), 'INSTAGRAM_DM', '<IG account ID>', 'Mr Tasty', 'mrtasty.ok', 'Mr Tasty', '<page access token>', NOW() + INTERVAL '60 days', true, NOW(), NOW()),
  (cuid(), 'MESSENGER',    '<FB Page ID>',    'Mr Tasty', NULL,         'Mr Tasty', '<page access token>', NOW() + INTERVAL '60 days', true, NOW(), NOW());
```

O mejor: yo te armo después un endpoint `/api/admin/meta-accounts/connect` que reciba el user token y popule todo automáticamente.

## Cómo verificar que el webhook funciona

Después de configurar todo:

1. Mandate un DM de prueba a `@mrtasty.ok` desde tu cuenta personal
2. Meta dispara webhook → llega a `https://desembarco-lucia.vercel.app/api/webhooks/meta`
3. LucIA inserta `MetaConversation` + `MetaMessage` en DB
4. Abrir `https://desembarco-lucia.vercel.app/dashboard/inbox-meta`
5. Tendría que aparecer la conversación nueva con badge "Nuevo"

## Estado del código en LucIA (hoy)

✅ **Listo**:
- Schema Prisma con modelos `MetaAccount`, `MetaConversation`, `MetaMessage`, `MetaComment`
- `lib/meta.ts` — cliente Graph API con tipos completos + funciones skeleton (listConversations, listMessages, sendMessage, replyToComment, exchangeShortLivedForLongLived, getPageAccessTokens)
- `/api/webhooks/meta` — recibe verification + eventos de Meta, valida HMAC, inserta en DB
- `/dashboard/inbox-meta` — UI con tabs DMs / Comments, stats, lista de conversaciones
- Server actions: `replyToConversationAction`, `generateMetaDraftAction`, `replyToCommentAction`, `markConversationReadAction`, `archiveConversationAction`
- Link en sidebar → "Meta"

⏳ **Pendiente (cuando me pases las credenciales)**:
- Endpoint `/api/admin/meta-accounts/connect` para autoconectar cuentas
- Drawer/modal en cada conversación para responder con flow IA + manual
- Cron de refresh de tokens (60 días → renovar a los 50)
- Detección automática de marca según el page ID

## Próximos pasos

Cuando termines los pasos 1-5:

1. Mandame el **App ID** y **App Secret** (no los pegues acá — me los pasás cuando llegue el momento)
2. Mandame los **Page IDs** de las páginas FB que querés conectar
3. Mandame los **Instagram account IDs** de las cuentas IG (los podés ver con Graph API Explorer ejecutando `me/accounts?fields=instagram_business_account`)
4. Yo termino el setup automatizado del lado del panel y conectamos en una sesión rápida

**Tiempo total estimado del setup tuyo**: ~30-45 min si nunca configuraste apps de Meta. Después es one-time.
