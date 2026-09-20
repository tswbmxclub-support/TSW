import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PaginaPanel } from "@/components/admin/PaginaPanel";
import { Boton } from "@/components/ui";
import { exigirAdminPagina } from "@/lib/auth";
import { deporteActivo } from "@/features/cuenta/deporte-servidor";
import { DetalleUsuarioAdmin } from "@/features/admin/components/UsuariosAdmin";
import { obtenerUsuarioPanel } from "@/features/admin/queries-perfiles";

type Props = { params: Promise<{ id: string }> };

/** Detalle de un titular: cuenta real; mensualidades y jersey de muestra por ahora. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await exigirAdminPagina("/admin/usuarios");
  const { id } = await params;
  const usuario = await obtenerUsuarioPanel(id);
  return { title: usuario ? `Usuario ${usuario.nombre}` : "Usuario" };
}

export default async function PaginaDetalleUsuarioPanel({ params }: Props) {
  const { id } = await params;
  await exigirAdminPagina(`/admin/usuarios/${id}`);
  const [deporte, usuario] = await Promise.all([deporteActivo(), obtenerUsuarioPanel(id)]);
  if (!usuario) notFound();

  return (
    <PaginaPanel
      titulo={usuario.nombre}
      descripcion="Titular de cuenta"
      deporte={deporte}
      accion={
        <Boton href="/admin/usuarios" variante="secundario">
          Volver a usuarios
        </Boton>
      }
    >
      <DetalleUsuarioAdmin usuario={usuario} />
    </PaginaPanel>
  );
}
