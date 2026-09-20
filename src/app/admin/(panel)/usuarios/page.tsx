import type { Metadata } from "next";

import { PaginaPanel } from "@/components/admin/PaginaPanel";
import { Aviso, Boton } from "@/components/ui";
import { SECCIONES_PANEL } from "@/config/panel";
import { exigirAdminPagina } from "@/lib/auth";
import { deporteActivo } from "@/features/cuenta/deporte-servidor";
import { UsuariosAdmin } from "@/features/cuenta/components/UsuariosAdmin";

export const metadata: Metadata = { title: "Usuarios" };

const SECCION = SECCIONES_PANEL.find((s) => s.href === "/admin/usuarios");

/** Usuarios de la corporación: titulares de cuenta y sus deportistas. */
export default async function PaginaUsuariosPanel() {
  await exigirAdminPagina("/admin/usuarios");
  const deporte = await deporteActivo();

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
      <Aviso tono="info" className="mb-6">
        Vista previa con datos de muestra: los usuarios reales llegarán con la tabla perfil_usuario.
      </Aviso>
      <UsuariosAdmin deporteNombre={deporte.nombre} />
    </PaginaPanel>
  );
}
