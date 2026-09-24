import type { Metadata } from "next";

import { PaginaPanel } from "@/components/admin/PaginaPanel";
import { SECCIONES_PANEL } from "@/config/panel";
import { exigirAdminPagina } from "@/lib/auth";
import { ProductosAdmin } from "@/features/admin/components/ProductosAdmin";
import { listarProductosPanel } from "@/features/admin/queries";
import { listarClubes } from "@/features/clubes/queries";

export const metadata: Metadata = { title: "Productos" };

const SECCION = SECCIONES_PANEL.find((s) => s.href === "/admin/productos");

/** Productos: catálogo, variantes, precios e inventario. */
export default async function PaginaProductosPanel() {
  await exigirAdminPagina("/admin/productos");
  const [productos, clubes] = await Promise.all([listarProductosPanel(), listarClubes()]);

  return (
    <PaginaPanel titulo="Productos" descripcion={SECCION?.descripcion}>
      <ProductosAdmin productos={productos} clubes={clubes} />
    </PaginaPanel>
  );
}
