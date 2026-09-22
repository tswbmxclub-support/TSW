# Configuración de despliegue (Vercel + Supabase)

Documento interno. Todo lo de aquí vive en paneles externos y no se puede
verificar desde el código: hay que mirarlo a mano antes de entregar.

## 1. Variables de entorno en Vercel

Settings → Environment Variables, en **Production** (y en Preview si se usa).
Solo nombres; los valores están en el gestor de contraseñas.

| Variable | Obligatoria | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sí | URL del proyecto Supabase (`https://gjpbcrhwppnljbxpkhrc.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sí | Lecturas públicas con RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | sí | Escrituras del panel por RPC. **Nunca** con prefijo `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | sí | Dominio público sin barra final. Arma los enlaces de correo: si queda en `localhost`, recuperar contraseña e invitar administradores mandan enlaces rotos |
| `NEXT_PUBLIC_WHATSAPP_NUMERO` | sí | Número del club: solo dígitos, `57` + 10 cifras (12 en total). Sin él, los botones de WhatsApp quedan deshabilitados con el aviso "WhatsApp no configurado" |
| `CUENTAS_HABILITADAS` | no | Cuentas de usuario (`/cuenta/*`). Ausente o distinta de `true` → 404. **No ponerla en `true` en esta entrega** |

No hacen falta todavía: `WOMPI_*`, `CRON_SECRET`, `RESEND_*`, `CORREO_SMTP_*`
(fase 4 y correo propio; el código de `main` no las lee).

Las variables `NEXT_PUBLIC_*` se incrustan al compilar: tras cambiarlas hay
que **redesplegar**, no basta con guardarlas.

## 2. Supabase → Authentication

### Providers → Email

- Enabled: **sí**.
- Allow new users to sign up: **no** (las cuentas las crea el panel).
- Confirm email: **no** (el panel crea las cuentas ya confirmadas).

Verificado el 21-09-2026 con `/auth/v1/settings`: `external.email=true`,
`disable_signup=true`, `mailer_autoconfirm=true`.

### URL Configuration

- **Site URL**: `https://<dominio>`.
- **Redirect URLs** (una por línea):

```
https://<dominio>/admin/auth/callback
https://<dominio>/admin/auth/callback?**
https://<dominio>/cuenta/auth/callback
https://<dominio>/cuenta/auth/callback?**
http://localhost:3000/admin/auth/callback
http://localhost:3000/admin/auth/callback?**
http://localhost:3000/cuenta/auth/callback
http://localhost:3000/cuenta/auth/callback?**
```

El código siempre pasa `redirectTo` **con** cadena de consulta
(`?siguiente=/admin/restablecer`); las entradas con `?**` cubren esa forma.
Si un enlace de correo termina en la Site URL en vez de en el callback, es
que la URL no pasó el filtro: revisar esta lista.

### Email Templates

Por qué hay que tocarlas: las plantillas por defecto de Supabase enlazan con
`{{ .ConfirmationURL }}`, que abre un flujo PKCE (`?code=`) que **solo
funciona en el navegador que pidió el enlace**. Un administrador invita desde
su computador y la persona invitada abre el correo en su celular: sin
`token_hash` el canje falla. `src/lib/auth/callback.ts` espera
`?token_hash=…&type=recovery|invite` y lo canjea con `verifyOtp`; conserva
`?code=` solo como respaldo.

El `redirectTo` que manda el código **ya trae `?`** (por ejemplo
`https://<dominio>/admin/auth/callback?siguiente=/admin/restablecer`), así
que el separador antes de `token_hash` es **`&`**, no `?`.

Qué flujo usa cada plantilla en `main`:

| Flujo | Cómo se dispara | Plantilla | Callback |
|---|---|---|---|
| Administrador olvidó la contraseña | `/admin/recuperar` → `resetPasswordForEmail` | **Reset password** (`type=recovery`) | `/admin/auth/callback?siguiente=/admin/restablecer` |
| Alta de administrador desde el panel | `createUser` + `resetPasswordForEmail` | **Reset password** (`type=recovery`) | `/admin/auth/callback?siguiente=/admin/restablecer` |
| Reenviar enlace a un administrador | `resetPasswordForEmail` | **Reset password** | igual |
| Alta de usuario (deportista/acudiente) | `inviteUserByEmail` | **Invite user** (`type=invite`) | `/cuenta/auth/callback?siguiente=/cuenta/restablecer` (hoy responde 404: cuentas apagadas) |
| Usuario olvidó la contraseña | `/cuenta/recuperar` | **Reset password** | `/cuenta/auth/callback?siguiente=/cuenta/restablecer` (ídem) |

No se usan **Confirm signup** (registro apagado), **Magic Link** ni
**Change email address**; se pueden dejar como están.

**Reset password** — Subject: `Contraseña de acceso a TSW`. Body:

```html
<h2>Fija tu contraseña</h2>
<p>Sigue este enlace para elegir una contraseña nueva de acceso al panel de TSW:</p>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Fijar contraseña</a></p>
<p>Si no pediste este correo, ignóralo: el enlace caduca solo.</p>
```

**Invite user** — Subject: `Invitación a tu cuenta TSW`. Body:

```html
<h2>Te invitaron a TSW</h2>
<p>Sigue este enlace para aceptar la invitación y fijar tu contraseña:</p>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite">Aceptar invitación</a></p>
<p>Si no esperabas este correo, ignóralo.</p>
```

Comprobación rápida: en `/admin/recuperar` pedir un enlace para tu correo,
abrirlo en **otro navegador** (o en el celular) y confirmar que llega a
`/admin/restablecer`. Si llega a `/admin/recuperar?error=enlace`, la
plantilla no lleva `token_hash` o el tipo no coincide.

### SMTP Settings

El SMTP por defecto de Supabase tiene límite de pocos correos por hora y
**solo entrega a los miembros del proyecto**: el correo del cliente no
recibiría ni la recuperación ni la invitación. Antes de invitar al cliente,
configurar SMTP propio (Resend u otro) en Authentication → SMTP Settings, con
remitente en el dominio del club, y subir el límite en Rate Limits.

## 3. Comprobación final antes de entregar

1. `NEXT_PUBLIC_SITE_URL` en Vercel = dominio real. Redesplegar tras cambiar variables.
2. `curl -I https://<dominio>/cuenta/acceso` → `404`.
3. Botón "¿Tienes dudas? Escríbenos" en `/tienda` abre `https://wa.me/57…` (no "WhatsApp no configurado").
4. Recuperación de contraseña de punta a punta con un correo que no sea miembro del proyecto Supabase (prueba el SMTP).
5. Publicar un PDF real mayor de 1 MB desde `/admin/documentos` y descargarlo desde `/matriculas`.
6. Tras esa publicación: `select actor_id from evento_auditoria order by ocurrido_en desc limit 3` con el id del administrador, no NULL.
