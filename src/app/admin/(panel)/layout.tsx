import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ArmazonPanel } from "@/components/admin/ArmazonPanel";
import { exigirSesionPagina } from "@/lib/auth";
import { deporteActivo } from "@/features/cuenta/deporte-servidor";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s | Panel TSW" },
  robots: { index: false, follow: false },
};

/**
 * Armazón del panel. Verifica la sesión, pero cada página lo vuelve a hacer:
 * Next no re-ejecuta el layout al navegar entre páginas hermanas, así que la
 * comprobación de aquí solo cubre la primera carga.
 *
 * También lee el deporte activo de la cookie tsw.deporte para el selector del
 * armazón. Es preferencia de vista: no filtra consultas todavía.
 */
export default async function LayoutPanel({ children }: { children: ReactNode }) {
  const { usuario } = await exigirSesionPagina("/admin");
  const deporte = await deporteActivo();

  return (
    <ArmazonPanel correo={usuario.email ?? "administrador"} deporte={deporte}>
      {children}
    </ArmazonPanel>
  );
}
