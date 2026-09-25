# Punto de retorno

Dónde está el proyecto al cerrar la sesión del **25-09-2026**. Lo que explica el
porqué de cada decisión está en [CLAUDE.md](../CLAUDE.md); aquí solo el estado.

## Rama

`feat/login-otp-landing`, último commit **`425bd02`**, empujada a `origin`.
**29 commits por delante de `main`**, que sigue sin tocar.

Sale de `entrega/v1` y trae, en orden: login por código, migraciones 15 a 18,
la paleta nueva, el menú de clubes, `/semilleros` por club, el contenido real
del documento de la cliente, las tres páginas legales y los chequeos mecánicos.

## Hecho

**Parte E — contenido real** (commits `5be7097`, `708341c`)

- Barra superior y pie con los datos del documento: lema, dos WhatsApp, correo, las dos pistas, barrio, horario, afiliaciones INDER y Liga, © 2026.
- `CONTACTO` sin `direccion`: la cliente da dos sedes y un barrio, no una calle. Lo que falta se oculta, nunca con corchetes visibles.
- Fuera la nota interna de formatos; ahora dice que aplican a todos los clubes y programas.
- "Últimos resultados" oculto entero cuando no hay **resultados** (no cuando no hay competencias).
- Tienda como catálogo sin precios, botón "Pedir por WhatsApp", mensaje de chat sin importes.
- `/semilleros` agrupada por club, con el programa de Habilidades Motrices ramificado por `tipo`, no por slug.

**Parte F — páginas legales** (commits `b6ff4e1`, `c80ee72`)

- Las tres existen y responden 200. `/legal/terminos` y `/legal/devoluciones` no existían y el pie ya las enlazaba.
- Texto adaptado a lo que el sitio hace: sin cuentas de deportistas, sin pago con tarjeta, con el canal de WhatsApp cubierto.
- Cada cambio respecto al borrador de la cliente está en [legales-cambios-para-cliente.md](legales-cambios-para-cliente.md), con texto original y motivo.
- Primitivo `DocumentoLegal` en `/laboratorio`; las tres páginas comparten plantilla.
- Precios fuera del payload RSC, no solo ocultos al pintar.
- Anillo de foco medido sobre build de producción: 230 elementos, 0 por debajo de 3:1.

## Interruptores

Los tres están en `src/config/sitio.ts`. Ninguno se cambia sin el dato que lo
desbloquea.

| Interruptor | Hoy | Se enciende cuando | Lo vigila |
|---|---|---|---|
| `TIENDA_MUESTRA_PRECIOS` | `false` | La cliente fije precio y tallas de los 6 productos | `verificar:payload` (que `precio_centavos` no viaje al navegador) |
| `IDENTIDAD_LEGAL.nitConfirmado` | `false` | Confirme el NIT contra el RUT | `verificar:legales` (dígito DIAN) y `verificar:payload` (que no se publique) |
| `LEGALES_APROBADAS` | `false` | Un abogado devuelva las tres páginas revisadas | `verificar:payload` (aviso de borrador + `noindex`) |

Los tres chequeos se adaptan solos al estado del interruptor: al encenderlo
exigen lo contrario, sin tocar el script.

## Para fusionar a `main`

1. `npm run verificar:completo` en **0** (build, los 7 chequeos, foco).
2. `LEGALES_APROBADAS` en **`true`**. Un texto legal sin revisar, indexado, es un documento que obliga a la corporación y que nadie aprobó.

## Pendientes

**De la cliente** — la lista redactada para ella está en
[contenido-pendiente-cliente.md](contenido-pendiente-cliente.md).

- Dígito de verificación del NIT, confirmado con el RUT.
- Dirección de notificación (la del RUT) para las páginas legales.
- Revisión de un abogado de las tres páginas, con la pregunta del art. 47 sobre bienes personalizados y de uso personal.
- Precios y tallas de los 6 productos; política de cambios de talla; término de garantía; política de envíos.
- Título de la pestaña: hoy el de su documento, con "BMX"; ¿lo cambia al sumar otros deportes?
- Formatos reales en PDF y fotos.

**Míos**

- **URL del preview de Vercel**: la rama está empujada, pero no hay CLI ni `gh` aquí. Hay que leerla del panel de Vercel o del check de GitHub. Ojo: el remoto `Samuelgy2/TSW` redirige a `tswbmxclub-support/TSW`; si el proyecto de Vercel está conectado a la cuenta vieja, puede no disparar.
- **Proveedor Email apagado en Supabase Auth**: es lo que impide entrar al panel en producción. Se enciende en Authentication → Providers → Email, con registro y confirmación apagados, y registrando `${NEXT_PUBLIC_SITE_URL}/admin/auth/callback` en Redirect URLs.
- **Datos de prueba**: los borra Samuel desde el panel, no por SQL. Son las competencias "Competencia publicada 1 y 2" con "Rider 1" y "Rider 2", los tres PDF de prueba de Matrículas y los productos con precios de $10 y $20.

## Trampas del entorno

- **`python - <<'FIN'` cuelga para siempre** en este Git Bash: se queda esperando stdin, la tarea pasa a segundo plano y no imprime nada. Dos de esos procesos fueron lo que parecía "un bucle iterando en el proyecto". Escribir el script a un archivo y ejecutarlo.
- **`next dev` y `next start` se pisan si comparten carpeta de salida.** Resuelto: `distDir` sale de `NEXT_DIST_DIR` y los chequeos usan `.next-verificar` (start) y `.next-verificar-dev` (dev). Por eso el build puede ir primero en `verificar:completo` y por eso los chequeos ya no rompen un `npm run dev` abierto.
- **Build intermitente: sin reproducir.** Falló una vez con `Export encountered an error on /admin`; 5 corridas limpias después. No está arreglado, está sin reproducir. Detalle e hipótesis —dos procesos escribiendo el mismo `.next`, que es justo lo que el punto anterior evita— en [build-intermitente.log](build-intermitente.log).
- Añadir un archivo a un barrel con el dev encendido rompe el bundle con `__webpack_modules__[moduleId] is not a function`. No es import circular: reiniciar.

## Parte G

**Sin empezar, a la espera de decisión de alcance.** Sería la migración 19 y
`/admin/sitio`: pasar al panel el contenido que hoy vive en
`src/config/contenido.ts` y `src/config/sitio.ts`. No se toca hasta que Samuel
lo diga.
