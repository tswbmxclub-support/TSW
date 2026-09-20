import type { Metadata } from "next";

import { FormularioAcceso } from "@/features/admin/components/FormularioAcceso";

export const metadata: Metadata = { title: "Acceso" };

/**
 * Puerta de los usuarios (deportistas y acudientes). Reutiliza el mismo
 * formulario del panel con otros textos y otro destino de recuperación; una
 * sesión de usuario nunca será sesión de administrador.
 */
export default function PaginaAccesoUsuario() {
  return (
    <div className="mx-auto w-full max-w-md rounded-lg border border-gris-borde bg-blanco p-6 sm:p-8">
      <FormularioAcceso
        titulo="Acceso a mi cuenta"
        textoAyuda="Para deportistas y acudientes. Consulta mensualidades y jerseys."
        enlaceRecuperar="/cuenta/recuperar"
      />
    </div>
  );
}
