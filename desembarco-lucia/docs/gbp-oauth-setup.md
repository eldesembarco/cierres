# GBP OAuth · cómo conseguir el refresh token

El cliente `lib/gbp.ts` necesita 3 valores en `.env.local`:

```
GBP_OAUTH_CLIENT_ID
GBP_OAUTH_CLIENT_SECRET
GBP_REFRESH_TOKEN
```

El refresh token sirve indefinidamente (mientras el usuario no revoque el acceso). Lo conseguís una sola vez con el flow OAuth.

## Pasos

### 1. Crear OAuth Client en Google Cloud Console

1. https://console.cloud.google.com/apis/credentials
2. Seleccioná el proyecto en el que habilitaste Business Profile API
3. **+ Crear credenciales** → **ID de cliente OAuth**
4. Tipo: **Aplicación web**
5. Nombre: `Desembarco LucIA - Server`
6. **URI de redireccionamiento autorizadas**: agregá `https://developers.google.com/oauthplayground`
7. Crear → copiá el **Client ID** y **Client secret** → `.env.local`

### 2. Habilitar las APIs en el proyecto

En https://console.cloud.google.com/apis/library, buscar y habilitar:

- My Business Account Management API
- My Business Business Information API
- Business Profile Performance API
- Google My Business API (legacy v4 — para reviews y reply)

### 3. Conseguir el refresh token con OAuth Playground

1. https://developers.google.com/oauthplayground/
2. Click ⚙️ (arriba derecha) → tildá **"Use your own OAuth credentials"** → pegá Client ID + Client Secret
3. En la lista de la izquierda, scroll abajo y en **"Step 1 Select & authorize APIs"** pegá manualmente estos scopes (uno por línea o separados por espacio en el input):

   ```
   https://www.googleapis.com/auth/business.manage
   ```

   (el scope único `business.manage` cubre las 4 APIs de GBP)

4. Click **"Authorize APIs"** → te lleva a login → **iniciá sesión con `polejavetzky@eldesembarco.com`** (la cuenta con admin sobre las 4 fichas) → otorgá permisos
5. Volves al playground → click **"Exchange authorization code for tokens"**
6. Copiá el **Refresh token** → `.env.local` como `GBP_REFRESH_TOKEN`

### 4. Verificar

```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=$GBP_OAUTH_CLIENT_ID" \
  -d "client_secret=$GBP_OAUTH_CLIENT_SECRET" \
  -d "refresh_token=$GBP_REFRESH_TOKEN" \
  -d "grant_type=refresh_token"
```

Debería devolver un `access_token` válido por 3600 segundos.

Después, probar listar cuentas:

```bash
curl -H "Authorization: Bearer <access_token>" \
  https://mybusinessaccountmanagement.googleapis.com/v1/accounts
```

Debería devolver al menos 1 cuenta (donde están las 4 fichas que administra `polejavetzky`).

## Allowlist (importante)

Las APIs **Business Profile Performance** y **My Business v4 (Reviews)** requieren allowlist explícita de Google. Sin allowlist devuelven `403 PERMISSION_DENIED`.

Formulario: https://developers.google.com/my-business/content/prereqs#request

- Llenar con la cuenta dueña del proyecto Cloud
- Tarda entre días y semanas en aprobarse
- Mientras tanto, las llamadas a `fetchPerformance()` y `listReviews()` van a fallar — pero las de `listAccounts()` y `listLocations()` ya funcionan (no requieren allowlist)

## Compartir el token con n8n

n8n self-hosted necesita el mismo token para correr la ingesta diaria. En n8n:

1. Settings → Credentials → New → **Google OAuth2 API**
2. Pegá el mismo Client ID + Client Secret
3. En **Auth URL** poné: `https://accounts.google.com/o/oauth2/v2/auth`
4. En **Access Token URL**: `https://oauth2.googleapis.com/token`
5. Scope: `https://www.googleapis.com/auth/business.manage`
6. Conectar → loguearte con `polejavetzky@eldesembarco.com`
7. Guardar — n8n maneja el refresh internamente
