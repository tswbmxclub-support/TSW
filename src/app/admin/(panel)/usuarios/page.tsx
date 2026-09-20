import type { Metadata } from "next";

import { PaginaPanel } from "@/components/admin/PaginaPanel";
import { Boton } from "@/components/ui";
import { SECCIONES_PANEL } from "@/config/panel";
import { exigirAdminPagina } from "@/lib/auth";
import { deporteActivo } from "@/features/cuenta/deporte-servidor";
import { UsuariosAdmin } from "@/features/admin/components/UsuariosAdmin";
import { listarUsuarios } from "@/features/admin/queries-perfiles";

export const metadata: Metadata = { title: "Usuarios" };

const SECCION = SECCIONES_PANEL.find((s) => s.href === "/admin/usuarios");

/** Titulares de cuenta (perfil_usuario) con el correo de Auth. */
export default async function PaginaUsuariosPanel() {
  await exigirAdminPagina("/admin/usuarios");
  const [deporte, usuarios] = await Promise.all([deporteActivo(), listarUsuarios()]);

  return (
    <PaginaPanel
      titulo="Usuarios"
      descripcion={SECCION?.descripcion}
      deporte={deporte}
      accion={
        <Boton href="/admin/usuarios/mensualidades" variante="secundario">
          Mensualidades del mes
        </Boton>
      }
    >
      <UsuariosAdmin usuarios={usuarios} />
    </PaginaPanel>
  );
}
