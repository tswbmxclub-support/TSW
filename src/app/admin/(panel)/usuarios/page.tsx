import type { Metadata } from "next";

import { PaginaPanel } from "@/components/admin/PaginaPanel";
import { SECCIONES_PANEL } from "@/config/panel";
import { exigirSesionPagina } from "@/lib/auth";
import { deporteActivo } from "@/features/cuenta/deporte-servidor";
import { UsuariosAdmin } from "@/features/cuenta/components/UsuariosAdmin";

export const metadata: Metadata = { title: "Usuarios" };

const SECCION = SECCIONES_PANEL.find((s) => s.href === "/admin/usuarios");

/** Usuarios de la corporación: titulares de cuenta y sus deportistas. */
export default async function PaginaUsuariosPanel() {
  await exigirSesionPagina("/admin/usuarios");
  const deporte = await deporteActivo();

  return (
    <PaginaPanel titulo="Usuarios" descripcion={SECCION?.descripcion} deporte={deporte}>
      <UsuariosAdmin deporteNombre={deporte.nombre} />
    </PaginaPanel>
  );
}
