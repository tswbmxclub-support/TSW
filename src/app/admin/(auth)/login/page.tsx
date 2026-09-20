import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RUTA_PANEL, obtenerUsuario } from "@/lib/auth";
import { FormularioAcceso } from "@/features/admin/components/FormularioAcceso";

export const metadata: Metadata = { title: "Acceso" };

/** Acceso al panel. Con sesión activa no hay nada que hacer aquí. */
export default async function PaginaAcceso({
  searchParams,
}: {
  searchParams: Promise<{ redirigir?: string }>;
}) {
  if (await obtenerUsuario()) redirect(RUTA_PANEL);
  const { redirigir } = await searchParams;

  return (
    <FormularioAcceso
      redirigir={redirigir}
      titulo="Acceso al panel"
      textoAyuda="Solo para la administración del club."
    />
  );
}
