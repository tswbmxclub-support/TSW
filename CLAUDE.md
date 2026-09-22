# TSW BMX — Contexto del proyecto

## Cómo trabajar conmigo

Soy Samuel. Trátame de forma cercana y directa. Ajusta la extensión al tema:
breve para dudas rápidas, detallado para arquitectura, debugging o decisiones
de diseño. En código, prioriza claridad y buenas prácticas, y explica el porqué
de las decisiones, no solo el qué.

- Una cosa a la vez, esperando visto bueno. No entregues quince archivos de golpe.
- Si algo de lo que decidí parece un error, dímelo. Prefiero discutirlo ahora
  que descubrirlo en producción.
- Las migraciones se aplican con `supabase db push` desde mi terminal. Nada de
  SQL suelto contra el panel de Supabase.
- Antes de cada bloque, lee `/laboratorio` y el código existente, y reutiliza
  en vez de crear variantes nuevas.
- Todo en español: UI, mensajes de error, comentarios.
- Placeholders entre corchetes `[ASÍ]`. **No inventes precios, fechas, nombres
  de riders ni estadísticas.**

### Reglas de verificación (aprendidas a la mala)

Estas nacieron de fallos reales en esta sesión. No las relajes:

- **No reportes como hecho lo que no verificaste en disco.** Hubo un desajuste
  entre lo descrito en conversación y lo escrito en el archivo. Si dices que
  aplicaste un cambio, abre el archivo y cita línea.
- **No des por existente una RPC que no está en remoto.** Los tipos regenerados
  en local hacían compilar código contra funciones que no existían: build limpio
  y PGRST202 en runtime.
- **Tipos y base se regeneran juntos.** `db push` y `gen types` van en el mismo
  paso, nunca separados.
- **Validación mecánica sobre validación a ojo.** Para cada migración nueva:
  script que lea los archivos reales, extraiga firmas de las migraciones de
  origen, cruce nombres de columnas y de constraints, y reporte en tabla con
  archivo:línea. Iterar hasta "VALIDACIÓN LIMPIA", máximo 5 vueltas.
- **libpg_query no cubre los cuerpos plpgsql.** Di siempre qué queda sin
  verificar.

### Nunca te autentiques como un usuario real

Regla nacida de un fallo real: para verificar el panel se abrió sesión con la
cuenta de administrador de Samuel generando un enlace de acceso con la service
role. El resultado fue útil y la intención buena, pero eso es suplantar a una
persona real usando la llave que salta RLS. No se repite.

- **Prohibido autenticarse como una cuenta que pertenece a alguien**, por
  cualquier vía: `generateLink`, OTP, `verifyOtp`, la Admin API, enlaces de
  recuperación o de invitación, o la contraseña. Da igual que la sesión se
  abra en un script y no en un navegador.
- Solo con **permiso explícito de Samuel en ese momento**. Un permiso dado en
  una tarea anterior no vale para la siguiente.
- Para verificar hace falta una cuenta propia: un **usuario temporal**
  `verificacion-<asunto>-<timestamp>@tsw-verificacion.com`, creado para la
  prueba y **borrado al terminar** (el usuario de Auth y su perfil), con el
  borrado confirmado por consulta en el reporte.
- Leer con la service role (listar usuarios, consultar perfiles, mirar
  `updated_at`) **no** es autenticarse y sigue permitido. La línea está en
  abrir sesión en nombre de otra persona.

---

## Qué es el proyecto

Sitio web para **TSW**, una escuela de BMX en Colombia. El cliente pidió cuatro
cosas, en sus palabras:

1. Que la gente pueda **entrar y descargar los documentos para matricularse**.
2. Que él pueda **vender uniformes y merchandising** de la marca TSW.
3. Un **espacio para publicar información de competencias** (quién ganó,
   felicitaciones, novedades).
4. Un lugar donde **escribir sobre los semilleros y los niveles**.

**Un solo rol administrador**, operado por el cliente. No hay cuentas de
deportistas ni registro público. La matrícula se radica presencialmente; el
sitio solo publica los formatos para descargar — por eso no recibe datos
personales de menores, lo que reduce mucho la exposición en habeas data.

Referente visual mencionado por el cliente: bmxenvigado.com. Tomamos su
arquitectura de información, no su diseño.

### Cambio de alcance (2026-09-19) — pendiente de ejecutar

La cliente es una **corporación con varios deportes**, no solo BMX. Tres
cambios aprobados en intención, aún no en código ni en esquema:

1. **Deportes**: tabla `deporte` y `deporte_id` en `nivel`, `competencia`,
   `documento` y `producto` (nulo en producto = merchandising de la marca,
   común a todos). El panel lleva un **selector de deporte** que filtra todo lo
   que administra. El público se organiza por deporte.
2. **Administradores y usuarios en tablas distintas**: `perfil_admin`
   (propuesta de abajo, ahora sí se implementa) y `perfil_usuario`
   (deportista o acudiente). Dos puertas de acceso: `/admin/login` para
   administradores y `/cuenta/acceso` para usuarios. Una sesión de usuario
   **no** es sesión de administrador: las políticas `*_admin` de la migración
   08 dejan de significar "cualquier autenticado" y pasan a exigir
   `es_admin()`.
3. **Módulo de usuario**: el usuario ve su **mensualidad** (estado de pago
   mes a mes) y su **jersey** (talla y entrega). Solo lectura para el usuario;
   el admin registra desde el panel.

Esto invalida dos premisas de arriba: ya **hay cuentas de deportistas** y el
sitio **sí guarda datos personales, incluidos menores**. Ley 1581 aplica de
lleno: ver avisos en el plan de gestión antes de tocar el esquema.

---

## Stack (decidido, no negociable)

- **Next.js 15 (App Router) + TypeScript estricto**, en Vercel.
- **Supabase**: PostgreSQL, Auth (email+contraseña), Storage.
  Proyecto: `gjpbcrhwppnljbxpkhrc`
- Acceso a datos con `@supabase/supabase-js`. Nunca conexión directa al 5432.
- **Tailwind CSS + Framer Motion**. Zod + React Hook Form.
- **Wompi** para pagos. Resend para correos. Vercel Cron para trabajos programados.
- Sin ORM. Sin librería de estado global.

**Por qué monolito y no frontend/backend separados**: el webhook de Wompi y la
conciliación necesitan servidor, pero no justifican un segundo despliegue.
Un repo, un deploy, sin CORS, menos superficie de ataque.

---

## Colorimetría y tipografía

```
--azul-profundo: #0B1B33   fondo oscuro, header, footer
--azul-medio:    #12294D   superficies sobre azul profundo
--rojo:          #D7263D   acento único: CTAs, estados activos
--rojo-oscuro:   #A31128   hover del acento
--blanco:        #FFFFFF
--gris-frio:     #F2F4F7   fondo de secciones claras
--gris-borde:    #DCE3EC
--texto-sec:     #46566F
```

**Archivo Black** (títulos) + **Barlow** (cuerpo), con `next/font/google`.
El rojo es acento, no fondo dominante. Colores como variables CSS expuestas a
Tailwind; ninguno hardcodeado.

---

## Estructura

```
src/
  app/
    (public)/           # sitio público
    admin/              # panel, protegido por middleware
    api/                # route handlers
  features/
    <feature>/
      components/  queries.ts  mutations.ts  schemas.ts  types.ts
  lib/
    supabase/           # clientes: server, browser, admin
    auth/  errors/  utils/
  components/ui/        # primitivos del sistema de diseño
```

Features: `matriculas`, `tienda`, `pedidos`, `competencias`, `niveles`, `admin`.

---

## Decisiones de negocio ya tomadas

| Tema | Decisión |
|---|---|
| Reserva de stock | Caduca a las **2 horas** (PSE y Nequi pueden tardar) |
| Cancelar en `preparando` | **No repone stock**: estampado personalizado |
| Cancelar en `pendiente` | Sí libera la reserva: nunca se produjo nada |
| Buckets de Storage | Los tres **públicos**; el control sobre fotos de menores es documental |
| Auditoría | **No registra** nombre, correo ni teléfono del comprador (Ley 1581) |
| Pedidos desde el panel | El admin **no crea pedidos**. Nacen del checkout |
| Referencia de pedido | `TSW-<año>-<consecutivo 6 dígitos>` |
| Actor en bitácora | **Sí se registra**, vía `establecer_actor()` + RPC |
| Pago manual desde el panel | Permitido, pero **renombrado a "Registrar pago fuera de línea"**, con referencia obligatoria y evento propio en bitácora. En Colombia hay transferencias y Nequi; lo que no puede pasar es confundirlo con un pago de Wompi |

**Pendientes con el cliente** (bloquean la tienda): envíos, cambios y
devoluciones, plazo de cancelación sin costo, descuento a estudiantes,
régimen tributario.

---

## Reglas del esquema

- Todo precio es `integer` en **centavos**. La conversión pesos↔centavos ocurre
  en un solo lugar, no esparcida por los componentes.
- `pedido_item` **copia** precio, nombre y talla al comprar. El histórico no se
  recalcula por JOIN contra `variante`.
- `pedido.total_centavos` lo mantiene un trigger desde los ítems. El monto que
  se firma para Wompi sale de la base, nunca de la aplicación.
- `documento_version` es **inmutable**: publicar archiva la anterior. El número
  de versión va dentro del `storage_path`. El panel no ofrece editar ni
  eliminar versiones publicadas, solo "Publicar nueva versión".
- `transaccion.wompi_id` con UNIQUE: base de la idempotencia del webhook.
- `transicionar_pedido()` es el **único** punto donde cambia el estado de un pedido.
- Tres operaciones de stock: `reservar_stock`, `liberar_reserva` (baja reserva,
  stock intacto), `consumir_reserva` (baja ambos).
- Un producto con pedidos no se puede borrar: la FK es `RESTRICT`. Se desactiva.
- RLS activo en las 12 tablas, negación por defecto.
- `nivel_orden_unico` es **UNIQUE inmediato, no diferible** (migración 02, con
  comentario explicando el porqué). Reordenar niveles pasa por valores
  temporales negativos, no por intercambio directo.

### La regla que gobierna el panel

**Ninguna escritura va directo a las tablas. Todas pasan por RPC, pasando
`p_actor_id`.**

El backend escribe con service role, que no lleva identidad de usuario. Si una
mutation hace `supabase.from('producto').update(...)`, el cambio funciona pero
la bitácora registra `actor_id = NULL`, y toda la trazabilidad queda inservible.

Cada mutation: obtiene la sesión del servidor → llama la RPC con ese `user.id`
como `p_actor_id` → revalida las rutas públicas afectadas.

Si falta una RPC para alguna operación, **dímelo**: se crea en una migración,
no se rodea la regla.

### Contrato de escritura: total vs parcial

Regla nacida de un bug real: las RPC `guardar_*` hacían `set campo = p_campo`
en casi todo, y cualquier acción que llamara con dos o tres parámetros borraba
el resto de la fila (descripciones a NULL, categorías reseteadas, fotos
perdidas, competencias publicadas que se despublicaban solas).

El diagnóstico de fondo no era "falta `coalesce`", era **acciones parciales
llamando a una RPC de guardar-todo**. `alternarProducto` no quiere guardar un
producto, quiere cambiar un booleano.

- **`guardar_*` es reemplazo total, sin `coalesce`.** El formulario *es* el
  estado completo de la fila y manda todos sus campos. Se descartó el
  `coalesce` general porque impediría vaciar un campo opcional: el admin borra
  "horario", guarda, y el valor viejo seguiría ahí.
- **Cada operación parcial tiene su propia RPC mínima**, de dos o tres
  parámetros más `p_actor_id`, con un solo `UPDATE` sobre sus columnas.
- **`estado`, `destacado` e `imagen_path` están fuera del contrato de
  `guardar_*`.** El estado se mueve solo por `publicar_competencia` /
  `archivar_competencia`, el destaque por `destacar_competencia`, y la imagen
  por `establecer_imagen_*`. Mismo principio que `transicionar_pedido()`.
  Si la imagen entrara por dos caminos, cada camino necesitaría su copia de las
  reglas.

### Bloqueos y concurrencia

- Toda RPC que valide contra el **conjunto** de filas (no una sola) debe hacer
  `lock table … in share row exclusive mode` como **primera sentencia tras
  `establecer_actor`, antes de cualquier lectura**. Si el `lock` va después de
  las comprobaciones, esas lecturas ven un estado que ya no es el que se va a
  reescribir.
- `select … for update` **no basta** en esos casos: bloquea filas existentes,
  no impide un `INSERT` concurrente.
- Aplica hoy a `reordenar_niveles`. Aplicará a cualquier RPC futura que cuente
  filas antes de escribir.
- La prueba de concurrencia necesita **dos conexiones vivas** (dos `psql`). El
  SQL editor y el MCP abren una conexión por consulta y no sirven. Si no se
  puede correr, dilo: no la simules ni la des por verificada.

### Invariante de fotos de menores

```sql
alter table public.competencia
  add constraint competencia_imagen_requiere_autorizacion
  check (imagen_path is null or autorizacion_imagen_en is not null);
```

Vive en la tabla, no en una RPC, a propósito: es control documental sobre
imágenes de menores y la garantía tiene que estar lo más abajo posible. Si
aparece un tercer camino de escritura, la base lo para sola.
Desmarcar la autorización con foto presente **rechaza**; no borra el archivo
como efecto secundario.

### Traducción de errores de Postgres

PostgREST no expone el nombre del constraint en un campo aparte: viene dentro
del mensaje. Se extrae con
`/violates (?:check|unique) constraint "([^"]+)"/`. Un `raise exception` nuestro
nunca contiene esa frase, y **esa ausencia es lo que distingue los dos caminos**.

- Sin nombre de constraint → es un `raise` nuestro → se pasa el mensaje tal cual
  (ya está en español y bien redactado).
- Con nombre → se busca en `MENSAJE_POR_CONSTRAINT` (nombre → `{mensaje, tipo}`,
  con `tipo` `validacion` 422 o `conflicto` 409).
- Con nombre fuera de la lista → genérico + `console.error` del nombre.

Esto arregló de paso un bug: `transicionar_pedido` y `reordenar_niveles` lanzan
mensajes claros con el mismo 23514 y el admin veía el genérico.

**`transaccion_wompi_id_unico` queda fuera de la lista a propósito**: es el
mecanismo de idempotencia del webhook. Que salte es el sistema funcionando; el
webhook debe tratarlo como "ya procesado" y responder 200, nunca mostrar un
error al usuario.

**El log por defecto registra `code`, `message` y `hint`, nunca `details`.** En
un CHECK de pedido, Postgres pone en `details` un `Failing row contains (…)` con
nombre, correo y teléfono del comprador — exactamente lo que la decisión de
auditoría y la Ley 1581 evitan guardar.

---

## `/laboratorio` es el estándar de diseño

Contiene los primitivos aprobados y es **la fuente de verdad visual**. El panel
no tiene su propio sistema de diseño: es el mismo, con densidad mayor.

Si falta un componente, se crea como primitivo en `src/components/ui/`, se
agrega a `/laboratorio` con sus variantes y estados, y entonces se usa.

Síntoma de que algo va mal: `className` con valores crudos dentro de una
página. Significa que falta un primitivo o una variante.

Primitivos añadidos en la fase 3: Archivo, CampoMoneda, PieModal, Indicador,
ChipEstado, Aviso, Boton cargando.

---

## Móvil es el caso principal, no la adaptación

La mayoría entra desde el celular. Diseña desde móvil hacia arriba; si escribes
`lg:hidden` para arreglar algo, empezaste por el lado equivocado.

- **Suelo de 360px.** Sin desbordamiento horizontal en ninguna vista.
- Tablas anchas → **tarjetas apiladas**, no se encogen. Aplica también al panel:
  el cliente va a publicar resultados desde el celular.
- Áreas táctiles 44×44px, 8px de separación. Nada que dependa de hover.
- **Inputs a 16px mínimo**: por debajo, Safari iOS hace zoom al enfocar.
- `inputMode`, `type` y `autoComplete` correctos.
- Titulares con `clamp()`. `sizes` correcto en cada `next/image`.
- `viewport-fit=cover` y `env(safe-area-inset-*)`.
- Contraste AA. El rojo sobre azul profundo es el par riesgoso.

## Animaciones

`whileInView` con 16-24px y fade, escalonado de 60ms, máximo 400ms. `layoutId`
en tabs y filtros. Conteo ascendente en las cifras. **`prefers-reduced-motion`
respetado en todo**, vía un hook propio.

---

## Transversales

- **Server Components por defecto.** `'use client'` lo más abajo posible.
- **Server Actions** para mutaciones, con validación Zod del lado servidor.
- Verificación de sesión en **cada página y cada Server Action**, no solo en el
  middleware.
- Las vistas públicas leen con anon key. RLS filtra, **pero filtra también en
  la consulta**: no dependas de la política como única defensa.
- Estados de carga y vacío en toda vista que consulte datos. `loading.tsx` y
  `error.tsx` por ruta.
- `revalidatePath` tras cada escritura del panel.
- **Errores legibles**: nunca el mensaje crudo de Postgres al usuario.
- Confirmación antes de toda acción destructiva. En particular: al cancelar un
  pedido en `preparando`, diálogo que diga explícitamente que **el inventario
  no se repone**.
- Validación de tipo MIME **real** en subidas, no solo extensión. Renombrar a UUID.
- Nada de `dangerouslySetInnerHTML`. Sanitizar en servidor con lista blanca.
- Los módulos con tablas que describen el esquema llevan `server-only`
  importado de verdad, no asumido.

---

## Las cuatro fases

Ordenadas de menor a mayor riesgo a propósito. Los pagos van al final: cuando
lleguen, el resto ya lleva semanas funcionando.

| Fase | Contenido | Estado |
|---|---|---|
| **1** | Esquema, RLS, funciones de negocio, auditoría | ✅ Cerrada |
| **2** | Sistema de diseño y frontend público | ⚠️ Parcial |
| **3** | Panel de administración | 🔄 En curso |
| **4** | Integración con Wompi | ⬜ Pendiente |

### Fase 1 — cerrada y verificada
28 de 28 políticas RLS, 12 de 12 tablas con RLS activo. RLS verificado con anon
key: 18 de 18 casos. Inventario probado en 14 escenarios, incluida concurrencia
(dos reservas simultáneas sobre la última unidad: una pasa, una falla). Bitácora
con actor correcto, sin datos de contacto, cubriendo DELETE. Advisors: 0 ERROR,
5 WARN justificados. Seed idempotente aplicado.

### Fase 2 — parcial, NO cerrada

Hecho: sistema de diseño en `/laboratorio`, carrusel del hero, Home,
`/matriculas`, `/semilleros`, `/competencias`.

**Tienda y carrito listos** (commit `5406ad3`, 2026-09-19): `/tienda`
(catálogo con `CatalogoProductos`), `/tienda/[slug]` (detalle con
`SelectorVariantes`) y `/carrito` (`ListaCarrito` sobre `ProveedorCarrito`,
localStorage `tsw.carrito.v1`). Con `loading.tsx` y `error.tsx` por ruta.

**Sigue sin existir**: el checkout (`esquemaCheckout` está escrito en
`features/pedidos/schemas.ts`, la mutation no), `/pedido/[referencia]`, y la
**revalidación del carrito contra la base al montar** (decidida abajo, no
implementada: hoy `carrito.tsx` solo lee localStorage). Los pedidos del panel
solo podrán nacer cuando exista el checkout.

Decisiones ya tomadas para lo que falta:

- **El carrito NO reserva stock.** Vive en el cliente y guarda solo
  `variante_id` y cantidad. La reserva ocurre al iniciar el checkout, con
  `reservar_stock`, y caduca a las 2 horas. Reservar desde el carrito llenaría
  la base de reservas fantasma.
- El carrito **revalida contra la base al montar**: precios, stock y
  disponibilidad frescos, no los del almacenamiento local. Si algo cambió o se
  agotó, avisa antes de que el usuario llegue al pago.
- `/pedido/[referencia]` es consulta pública por referencia **exacta**, sin
  cuenta. Nunca mostrar datos de otro pedido.
- El checkout llega hasta donde entraría Wompi y se para ahí.

### Fase 3 — en curso

Bloques: **A** login, middleware, armazón e inicio con indicadores ·
**B** documentos, competencias, niveles · **C** productos, pedidos, bitácora.

Existen las 11 rutas del panel, las Server Actions, 12 migraciones y los
primitivos nuevos. Con sesión, las 7 secciones renderizan a 360px y 1280px sin
scroll horizontal. Todo commiteado en `main` (último: `5406ad3`).

**Desplegado en Vercel** (variables de entorno en `0beee5e`). En producción
**no se puede iniciar sesión**: ver bloqueante 2 abajo. Es configuración de
Supabase Auth, no código.

**Lo que está bien y no hay que rehacer**: middleware protegiendo `/admin/*`
salvo login/recuperar/callback con destino guardado; verificación de sesión
repetida en páginas y acciones; mensaje único "Credenciales incorrectas."; sin
enlace de registro; inputs a 16px; MIME real por firma de bytes con renombrado
a UUID; precios convertidos en un solo sitio; stock y reservado separados; sin
eliminar productos ni versiones; solo transiciones válidas de pedido; diálogo
de "el inventario no se repone"; bitácora paginada con antes/después; sin
`dangerouslySetInnerHTML`; cajón lateral móvil con foco atrapado.

> ### ⚠️ ESTADO ACTUAL — bloqueantes
>
> **1. Migraciones 11 y 12 escritas y validadas, pero NO aplicadas a remoto.**
> El remoto tiene 10 migraciones; la última es
> `20260918050500_endurecer_permisos_y_indices`. Las pendientes son
> `20260918120000` (11) y `20260919120000` (12).
> Hasta que se apliquen: guardar competencias, productos con foto, reordenar
> niveles y borrar resultados fallan con PGRST202.
> Causa del retraso: **la CLI de Supabase no estaba instalada**. Ya está, vía
> Scoop en `C:\Users\ne\scoop\shims\` (faltaba añadirla al PATH de usuario).
> Validación de ambas: LIMPIA, 174 puntos, 0 discrepancias.
>
> **2. Proveedor Email apagado en Supabase Auth.** `signInWithPassword` devuelve
> "Email logins are disabled" para cualquier usuario. **Esto es lo que impide
> entrar al panel: no es un problema del esquema.** Se enciende en
> Authentication → Providers → Email, con "Allow new users to sign up" apagado
> y "Confirm email" apagado.
> Falta también registrar `${NEXT_PUBLIC_SITE_URL}/admin/auth/callback` en
> Authentication → URL Configuration → Redirect URLs.
>
> **3. Subidas mayores de 1 MB fallan.** Los PDF e imágenes viajan por Server
> Actions y `next.config.ts` no define `experimental.serverActions.bodySizeLimit`
> (por defecto 1 MB). El PDF además se manda dos veces: en `subirPdfDocumento` y
> otra vez en `publicarVersionDocumento`, que lo revalida sin usarlo.
>
> **4. Server Actions de las migraciones 11 y 12 sin escribir.** Siguen llamando
> a las firmas viejas. Es el siguiente bloque de trabajo, y solo puede empezar
> cuando las RPC existan de verdad en remoto.

**Pendientes menores, ya diagnosticados:**

- Filtro de fechas de pedidos y bitácora en UTC: "hasta 18-09" corta a las 18:59
  hora Colombia.
- Áreas táctiles: flechas ↑↓ de niveles miden 39×44; el enlace de referencia en
  pedidos, 17px de alto.
- "Descargas del mes" sigue en `—`: el esquema no registra descargas (bucket
  público por CDN). Necesitaría tabla + route handler que cuente y redirija.
  Es migración nueva; no se ha aprobado.
- Rate limiting del login: en memoria por instancia (5 intentos/15 min), no
  global. Suficiente como primera capa.
- Usuario de prueba huérfano en Auth:
  `verificacion-auditoria-1789753282429@tsw-verificacion.com`, borrable desde
  el dashboard.

### Fase 4 — pendiente
El navegador nunca decide si un pedido está pagado. La verdad llega por webhook
y se contrasta contra la API de Wompi.

- Leer el body **crudo** con `await req.text()` antes de cualquier parseo, o la
  firma no cuadra nunca.
- Comparación de firmas en tiempo constante.
- Idempotencia por `wompi_id`.
- Verificar que el monto confirmado coincida con el total en base.
- Runtime Node, no Edge, en la ruta del webhook.
- Conciliación por Vercel Cron cada 15 min para webhooks que no llegan.
- Probar seis escenarios: aprobado, declinado, duplicado, webhook perdido,
  firma inválida, monto alterado.

---

## Perfiles: `perfil_admin` y `perfil_usuario` (migración 13, rama `feat/admins-usuarios`)

Implementado el 20-09-2026. Migración 13 aplicada en remoto; las 15 políticas
`authenticated` exigen `es_admin()`. Dos puertas: `/admin/login` y
`/cuenta/acceso`; `exigirAdmin*` / `exigirUsuario*` en cada página y acción.

**Cuentas nuevas — cómo se crean y por qué así:**

- Un **administrador** se crea con
  `auth.admin.createUser({ app_metadata: { tipo: 'admin' } })` y después
  recibe `resetPasswordForEmail`; un **usuario** va por `inviteUserByEmail`,
  que manda el correo en el mismo paso pero no acepta `app_metadata`. Está en
  `features/admin/acciones-perfiles.ts`.
- **El perfil no se deja al trigger** (migración 15, 22-09-2026). GoTrue
  inserta la fila de `auth.users` y escribe `app_metadata` en un UPDATE
  posterior, así que en el INSERT el tipo todavía no está: la versión original
  del hook mandaba a `perfil_usuario` a todo administrador creado desde el
  panel, y esa cuenta recibía "Credenciales incorrectas." para siempre, sin un
  error en ninguna capa. Hoy:
  - `invitarAdministrador` pide el perfil explícitamente con
    `crear_perfil_admin(p_actor_id, p_id, p_nombre)`, con actor en la bitácora.
    Si esa llamada falla, deshace el alta de Auth: una cuenta sin perfil solo
    ocupa el correo.
  - El hook cubre además el **UPDATE de `raw_app_meta_data`**, como red.
  - **Colisión de perfiles**: si el perfil contrario está inactivo, se migra;
    si está **activo**, se rechaza. Migrar un perfil vivo borraría su fila y,
    cuando existan `mensualidad` y `jersey` colgando de `perfil_usuario`,
    arrastraría el historial de pagos por un `ON DELETE CASCADE`.
  - Un rechazo dentro del hook **aborta la operación de Auth**, y la Admin API
    lo devuelve como `500 Error updating user`: GoTrue no propaga el mensaje
    de Postgres. Por eso el camino bueno es la RPC, cuyo mensaje sí llega.
- Toda cuenta nace **inactiva**; activar es un paso deliberado desde el panel.
- **Los enlaces de correo se canjean por `token_hash`** (`verifyOtp`) en
  `/admin/auth/callback` y `/cuenta/auth/callback` (`lib/auth/callback.ts`).
  El formato `?code=` (PKCE) solo funciona en el navegador que pidió el
  enlace; una invitación la pide el admin y la abre otra persona. **Requisito
  de configuración en Supabase** (Authentication → Email Templates):
  - "Reset password": enlace a `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`
  - "Invite user": enlace a `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite`
  y en URL Configuration → Redirect URLs, los dos callbacks con el dominio
  real. Sin esto, invitar crea la cuenta pero el enlace del correo falla.
- El SMTP por defecto de Supabase limita los correos por hora: configurar
  Resend como SMTP antes de invitar en serie.

Lo que sigue vigente de la propuesta original:

```
perfil_admin
├─ id             uuid PK → auth.users(id) ON DELETE CASCADE
├─ nombre         text NOT NULL
├─ activo         boolean NOT NULL DEFAULT false
├─ creado_en      timestamptz
└─ actualizado_en timestamptz
```

- `activo` arranca en `false`; un trigger crea el perfil desactivado al
  aparecer un usuario. Credenciales sin acceso hasta que un admin existente
  active.
- El correo no se copia: vive en `auth.users` y se lee por JOIN.
- Sin columna de rol: un solo rol, y una columna con el mismo valor en todas
  las filas no aporta.
- El middleware pasaría a verificar `perfil_admin.activo`, no solo que haya
  sesión. Hoy cualquier usuario de `auth.users` entra al panel.
- `desactivar_admin` necesita dos salvaguardas: nadie se desactiva a sí mismo,
  y no se puede desactivar al último admin activo. Con `lock table` para que el
  conteo no quede obsoleto.
- **No crea usuarios**: eso requiere la Admin API de Auth, no SQL. Con dos o
  tres usuarios en la vida del proyecto, no se amortiza una pantalla de
  invitaciones.

Acceso al login desde el home: enlace discreto **en el footer**, texto
"Administración". No en el header — el único usuario sabe dónde está la puerta,
y un enlace prominente solo ayuda a los escaneos automáticos.

---

## Verificación al cerrar cada bloque

1. `npm run build` sin errores de tipos ni de ESLint.
2. A 360px: sin scroll horizontal.
3. Recorrido con teclado: foco visible, orden lógico, nada inalcanzable.
4. Para escrituras del panel: confirmar que `evento_auditoria.actor_id` quedó
   con el id del usuario, **no NULL**. (Sigue sin poder hacerse: requiere login
   funcionando y las RPC en remoto.)
5. `/laboratorio` actualizado con los primitivos nuevos.
6. Ningún `className` con valores crudos en páginas.
7. Ninguna escritura directa a tablas: todo por RPC con `p_actor_id`.