import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import {
  RUTA_ACCESO_USUARIO,
  RUTA_LOGIN,
  esRutaAdminPublica,
  esRutaCuentaPublica,
} from "@/lib/auth/rutas";

/**
 * Hace dos cosas en cada petición:
 *  1. Refresca la sesión de Supabase (las cookies se renuevan aquí, no en los
 *     Server Components, que no pueden escribirlas).
 *  2. Protege /admin y /cuenta: sin sesión redirige a la puerta correspondiente
 *     guardando el destino.
 *
 * Es conveniencia, no la defensa real. TENER SESIÓN YA NO ES SER
 * ADMINISTRADOR: hay cuentas de administración y cuentas de usuario, y qué
 * perfil tiene la sesión lo comprueba cada página y cada Server Action con
 * `exigirAdminPagina` / `exigirUsuarioPagina` / `exigirAdmin` / `exigirUsuario`.
 * Aquí solo se comprueba que HAYA sesión, sin tocar la base.
 *
 * Solo se consulta al servidor de Auth cuando hay cookie de sesión: la mayoría
 * del tráfico es anónimo y no tiene sentido pagar una ida a Auth por cada
 * página pública.
 */
export async function middleware(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const ruta = request.nextUrl.pathname;
  const esRutaAdmin = ruta.startsWith("/admin");
  const esRutaCuenta = ruta.startsWith("/cuenta");
  const hayCookieSesion = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));

  if (!esRutaAdmin && !esRutaCuenta && !hayCookieSesion) return respuesta;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesNuevas) {
          for (const { name, value } of cookiesNuevas) {
            request.cookies.set(name, value);
          }
          respuesta = NextResponse.next({ request });
          for (const { name, value, options } of cookiesNuevas) {
            respuesta.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() valida el token contra el servidor de Auth; getSession() no.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!esRutaAdmin && !esRutaCuenta) return respuesta;

  if (!user) {
    if (esRutaAdmin && !esRutaAdminPublica(ruta)) {
      const destino = request.nextUrl.clone();
      destino.pathname = RUTA_LOGIN;
      destino.search = "";
      destino.searchParams.set("redirigir", ruta + request.nextUrl.search);
      return NextResponse.redirect(destino);
    }
    if (esRutaCuenta && !esRutaCuentaPublica(ruta)) {
      const destino = request.nextUrl.clone();
      destino.pathname = RUTA_ACCESO_USUARIO;
      destino.search = "";
      destino.searchParams.set("redirigir", ruta + request.nextUrl.search);
      return NextResponse.redirect(destino);
    }
    return respuesta;
  }

  // Con sesión, la puerta correcta la decide cada página, no el middleware:
  // este no consulta perfiles en la base, y una sesión válida puede ser de un
  // administrador INACTIVO (desactivado desde el panel) que solo debe ver la
  // puerta con el aviso correspondiente. Redirigir aquí a /admin o /cuenta
  // provocaría un rebote infinito entre la puerta y la página protegida.

  return respuesta;
}

export const config = {
  matcher: [
    // Todo menos estáticos, imágenes optimizadas, favicon y el webhook de
    // Wompi (que no trae cookies y no debe pagar el costo de refrescar sesión).
    "/((?!_next/static|_next/image|favicon.ico|api/wompi/webhook|.*\\.(?:svg|png|jpg|jpeg|webp|avif|gif|ico|pdf)$).*)",
  ],
};
