import type { Metadata } from "next";

import { Aviso } from "@/components/ui";
import { FormularioRecuperacion } from "@/features/admin/components/FormularioRecuperacion";

export const metadata: Metadata = { title: "Recuperar contraseña" };

/**
 * Recuperación de la cuenta de usuario. El formulario del panel se reutiliza
 * tal cual: en la vista previa no envía nada real y lo dice el aviso.
 */
export default function PaginaRecuperarUsuario() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="rounded-lg border border-gris-borde bg-blanco p-6 sm:p-8">
        <FormularioRecuperacion />
      </div>
      <Aviso tono="info">Vista previa con datos de muestra: el envío se conecta en la siguiente etapa.</Aviso>
    </div>
  );
}
