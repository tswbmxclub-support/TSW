import type { NextRequest } from "next/server";

import { canjearEnlaceDeCorreo } from "@/lib/auth/callback";

/**
 * Retorno del enlace de correo de la cuenta de usuario (invitación o
 * recuperación de contraseña). Espejo del callback del panel con una
 * diferencia clave: solo acepta destinos bajo /cuenta. El enlace de una cuenta
 * de usuario jamás termina en el panel, aunque alguien manipule `siguiente`.
 */
export async function GET(request: NextRequest) {
  return canjearEnlaceDeCorreo(request, {
    prefijo: "/cuenta",
    destinoPorDefecto: "/cuenta/restablecer",
    rutaError: "/cuenta/recuperar?error=enlace",
  });
}
