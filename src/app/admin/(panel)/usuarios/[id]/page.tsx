import type { Metadata } from "next";
import Link from "next/link";

import { PaginaPanel } from "@/components/admin/PaginaPanel";
import { exigirAdminPagina } from "@/lib/auth";
import { deporteActivo } from "@/features/cuenta/deporte-servidor";
import { USUARIOS_PANEL_MUESTRA } from "@/features/cuenta/datos-de-muestra";
import { DetalleUsuarioAdmin } from "@/features/cuenta/components/UsuariosAdmin";

type Props = { params: Promise<{ id: string }> };

/** Detalle de un usuario: mensualidades, jersey y acciones del admin. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const usuario = USUARIOS_PANEL_MUESTRA.find((u) => u.id === id);
  return { title: usuario ? `Usuario ${usuario.nombre}` : "Usuario" };
}

export default async function PaginaDetalleUsuarioPanel({ params }: Props) {
  await exigirAdminPagina("/admin/usuarios");
  const { id } = await params;
  const deporte = await deporteActivo();

  const usuario = USUARIOS_PANEL_MUESTRA.find((u) => u.id === id);
  if (!usuario) {
    return (
      <PaginaPanel titulo="Usuario no encontrado" deporte={deporte}>
        <p className="text-texto-sec">
          No existe este usuario en los datos de muestra.{" "}
          <Link href="/admin/usuarios" className="font-semibold text-rojo underline-offset-4 hover:underline">
            Volver a la lista
          </Link>
        </p>
      </PaginaPanel>
    );
  }

  return (
    <PaginaPanel
      titulo={usuario.nombre}
      descripcion={usuario.correo}
      deporte={deporte}
    >
      <DetalleUsuarioAdmin />
    </PaginaPanel>
  );
}
