import type { Metadata } from "next";

import { solicitarRecuperacionUsuario } from "@/features/cuenta/acciones";
import { FormularioRecuperacion } from "@/features/admin/components/FormularioRecuperacion";

export const metadata: Metadata = { title: "Recuperar contraseña" };

/** Recuperación de la cuenta de usuario, con su propia acción y textos. */
export default async function PaginaRecuperarUsuario({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const aviso =
    error === "enlace" ? "El enlace no es válido o ya venció. Pide uno nuevo." : undefined;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="rounded-lg border border-gris-borde bg-blanco p-6 sm:p-8">
        <FormularioRecuperacion
          avisoInicial={aviso}
          accion={solicitarRecuperacionUsuario}
          etiquetaCorreo="Correo de la cuenta"
          enlaceVolver="/cuenta/acceso"
        />
      </div>
    </div>
  );
}
