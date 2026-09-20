import type { NextRequest } from "next/server";

import { canjearEnlaceDeCorreo } from "@/lib/auth/callback";

/**
 * Retorno del enlace de correo del panel (recuperación de contraseña o alta
 * de un administrador). Canjea el enlace por una sesión y lleva a la página
 * de nueva contraseña; con enlace inválido o vencido, vuelve a la solicitud
 * con un aviso. Solo acepta destinos bajo /admin. La mecánica del canje
 * (PKCE vs token_hash) está documentada en src/lib/auth/callback.ts.
 */
export async function GET(request: NextRequest) {
  return canjearEnlaceDeCorreo(request, {
    prefijo: "/admin",
    destinoPorDefecto: "/admin/restablecer",
    rutaError: "/admin/recuperar?error=enlace",
  });
}
