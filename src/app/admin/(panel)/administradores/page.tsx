import type { Metadata } from "next";

import { PaginaPanel } from "@/components/admin/PaginaPanel";
import { SECCIONES_PANEL } from "@/config/panel";
import { exigirSesionPagina } from "@/lib/auth";
import { deporteActivo } from "@/features/cuenta/deporte-servidor";
import { AdministradoresAdmin } from "@/features/cuenta/components/AdministradoresAdmin";

export const metadata: Metadata = { title: "Administradores" };

const SECCION = SECCIONES_PANEL.find((s) => s.href === "/admin/administradores");

/** Administradores del panel: futura tabla perfil_admin, hoy datos de muestra. */
export default async function PaginaAdministradoresPanel() {
  await exigirSesionPagina("/admin/administradores");
  const deporte = await deporteActivo();

  return (
    <PaginaPanel titulo="Administradores" descripcion={SECCION?.descripcion} deporte={deporte}>
      <AdministradoresAdmin />
    </PaginaPanel>
  );
}
