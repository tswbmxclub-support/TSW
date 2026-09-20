import { NextResponse, type NextRequest } from "next/server";

import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Retorno del enlace de recuperación de la cuenta de usuario (flujo PKCE de
 * Supabase). Canjea el `code` por una sesión y lleva a la página de nueva
 * contraseña de /cuenta. Sin código o con código vencido, vuelve a la
 * solicitud con un aviso.
 *
 * Espejo del callback del panel, con una diferencia clave: solo acepta
 * destinos bajo /cuenta. El enlace de una cuenta de usuario jamás termina en
 * el panel, aunque alguien manipule el parámetro `siguiente`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const codigo = searchParams.get("code");
  const siguiente = searchParams.get("siguiente") ?? "/cuenta/restablecer";
  // Solo destinos del área de cuenta: nada de redirecciones abiertas.
  const destino = siguiente.startsWith("/cuenta") && !siguiente.startsWith("//") ? siguiente : "/cuenta";

  if (codigo) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }

  return NextResponse.redirect(`${origin}/cuenta/recuperar?error=enlace`);
}
