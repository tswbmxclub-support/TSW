import { NextResponse, type NextRequest } from "next/server";

import { canjearEnlaceDeCorreo } from "@/lib/auth/callback";
import { cuentasHabilitadas } from "@/lib/auth/rutas";

/**
 * Retorno del enlace de correo de la cuenta de usuario (invitación o
 * recuperación de contraseña). Espejo del callback del panel con una
 * diferencia clave: solo acepta destinos bajo /cuenta. El enlace de una cuenta
 * de usuario jamás termina en el panel, aunque alguien manipule `siguiente`.
 */
export async function GET(request: NextRequest) {
  // Segunda capa del apagado de /cuenta/*: los route handlers no pasan por
  // los layouts, así que la comprobación se repite aquí.
  if (!cuentasHabilitadas()) return new NextResponse(null, { status: 404 });

  return canjearEnlaceDeCorreo(request, {
    prefijo: "/cuenta",
    destinoPorDefecto: "/cuenta/restablecer",
    rutaError: "/cuenta/recuperar?error=enlace",
  });
}
