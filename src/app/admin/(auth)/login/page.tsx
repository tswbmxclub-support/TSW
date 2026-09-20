import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RUTA_CUENTA, RUTA_PANEL, obtenerPerfil } from "@/lib/auth";
import { FormularioAcceso } from "@/features/admin/components/FormularioAcceso";

export const metadata: Metadata = { title: "Acceso" };

/**
 * Acceso al panel. Con una sesión ya abierta no hay nada que hacer aquí: al
 * panel si es de administrador, a /cuenta si es de usuario. Una sesión sin
 * perfil (cuenta sin activar) se queda: la puerta es donde ve el aviso, y al
 * intentar entrar recibirá "Credenciales incorrectas." en vez de una pista
 * sobre el estado de su cuenta.
 */
export default async function PaginaAcceso({
  searchParams,
}: {
  searchParams: Promise<{ redirigir?: string }>;
}) {
  const { redirigir } = await searchParams;
  const sesion = await obtenerPerfil();
  if (sesion) redirect(sesion.tipo === "usuario" ? RUTA_CUENTA : RUTA_PANEL);

  return (
    <FormularioAcceso
      redirigir={redirigir}
      titulo="Acceso al panel"
      textoAyuda="Solo para la administración del club."
    />
  );
}
