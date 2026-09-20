import type { Metadata } from "next";

import { PaginaPanel } from "@/components/admin/PaginaPanel";
import { SECCIONES_PANEL } from "@/config/panel";
import { exigirAdminPagina } from "@/lib/auth";
import { deporteActivo } from "@/features/cuenta/deporte-servidor";
import { AdministradoresAdmin } from "@/features/admin/components/AdministradoresAdmin";
import { listarAdministradores } from "@/features/admin/queries-perfiles";

export const metadata: Metadata = { title: "Administradores" };

const SECCION = SECCIONES_PANEL.find((s) => s.href === "/admin/administradores");

/** Administradores del panel: perfil_admin con el correo de Auth. */
export default async function PaginaAdministradoresPanel() {
  const { usuario } = await exigirAdminPagina("/admin/administradores");
  const [deporte, administradores] = await Promise.all([deporteActivo(), listarAdministradores()]);

  return (
    <PaginaPanel titulo="Administradores" descripcion={SECCION?.descripcion} deporte={deporte}>
      <AdministradoresAdmin administradores={administradores} actorId={usuario.id} />
    </PaginaPanel>
  );
}
