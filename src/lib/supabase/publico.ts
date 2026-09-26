import "server-only";

import { createClient } from "@supabase/supabase-js";

import { entornoSupabase } from "./env";
import type { Database } from "./database.types";

/**
 * Cliente para LECTURA PÚBLICA desde el servidor: anon key, sin cookies.
 *
 * `crearClienteServidor()` (server.ts) adjunta la cookie de sesión que traiga
 * el navegador, y eso es lo correcto para el panel, donde la sesión decide
 * qué se ve. Pero las páginas públicas no necesitan sesión para leer, y
 * adjuntarla de todos modos abre dos problemas reales, no hipotéticos:
 *
 * 1. Un token de sesión inválido —vencido, con `iat` en el futuro por un
 *    reloj desincronizado, de una cuenta borrada— hace que CADA consulta de
 *    la página falle, y como el contenido público se lee en el layout y en
 *    cada página, un solo token roto tumba el sitio entero con un 500. No es
 *    un caso de laboratorio: pasó con una cookie vieja del navegador del
 *    propio desarrollador, y el caso realista es un visitante con el reloj
 *    del celular mal puesto.
 * 2. Con sesión de administrador, algunas políticas RLS son más permisivas
 *    (`to authenticated using (activo or es_admin())`), así que la MISMA
 *    consulta devuelve más filas que a un visitante anónimo. Un admin que
 *    navegue el sitio público en la misma pestaña donde tiene sesión vería
 *    productos o clubes inactivos: no es una fuga de datos ajenos, pero es
 *    una vista que no corresponde a "el sitio público", que es justo lo que
 *    dice la regla del proyecto: "las vistas públicas leen con anon key".
 *
 * Por eso este cliente NUNCA lee cookies: siempre anon, pase lo que pase en
 * el navegador. `persistSession` y `autoRefreshToken` en false porque no hay
 * usuario que mantener vivo entre peticiones de un servidor sin estado.
 */
export function crearClientePublico() {
  return createClient<Database>(
    entornoSupabase.NEXT_PUBLIC_SUPABASE_URL,
    entornoSupabase.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
