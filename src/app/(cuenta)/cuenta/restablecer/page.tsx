import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { obtenerUsuario } from "@/lib/auth";
import { restablecerContrasenaUsuario } from "@/features/cuenta/acciones";
import { FormularioNuevaContrasena } from "@/features/admin/components/FormularioNuevaContrasena";

export const metadata: Metadata = { title: "Nueva contraseña" };

/**
 * Llega desde el enlace de recuperación de la cuenta de usuario, ya con
 * sesión. Sin sesión el enlace venció o no se pasó por el callback de /cuenta:
 * se vuelve a pedir uno. Exige sesión pero no perfil activo: el
 * restablecimiento es el paso ANTES de la activación de una cuenta invitada.
 */
export default async function PaginaRestablecerUsuario() {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/cuenta/recuperar?error=enlace");

  return (
    <div className="mx-auto w-full max-w-md rounded-lg border border-gris-borde bg-blanco p-6 sm:p-8">
      <h1 className="text-2xl">Nueva contraseña</h1>
      <p className="mt-2 mb-6 text-sm text-texto-sec">Para la cuenta {usuario.email}.</p>
      <FormularioNuevaContrasena
        accion={restablecerContrasenaUsuario}
        destinoExito="/cuenta"
      />
    </div>
  );
}
