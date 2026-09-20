import type { Metadata } from "next";

import { PaginaPanel } from "@/components/admin/PaginaPanel";
import { SECCIONES_PANEL } from "@/config/panel";
import { exigirAdminPagina } from "@/lib/auth";
import { BitacoraAdmin } from "@/features/admin/components/BitacoraAdmin";
import { POR_PAGINA_BITACORA, listarBitacora } from "@/features/admin/queries";
import { nombresDeActores } from "@/features/admin/queries-perfiles";

export const metadata: Metadata = { title: "Bitácora" };

const SECCION = SECCIONES_PANEL.find((s) => s.href === "/admin/bitacora");

/** Bitácora: solo lectura, filtrable y paginada en el servidor. */
export default async function PaginaBitacoraPanel({
  searchParams,
}: {
  searchParams: Promise<{ entidad?: string; accion?: string; desde?: string; hasta?: string; pagina?: string }>;
}) {
  await exigirAdminPagina("/admin/bitacora");

  const params = await searchParams;
  const pagina = Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1);
  const { eventos, total } = await listarBitacora({
    entidad: params.entidad,
    accion: params.accion,
    desde: params.desde,
    hasta: params.hasta,
    pagina,
  });
  const nombresActores = await nombresDeActores(eventos.map((e) => e.actor_id));

  return (
    <PaginaPanel titulo="Bitácora" descripcion={SECCION?.descripcion}>
      <BitacoraAdmin
        eventos={eventos}
        filtros={{
          entidad: params.entidad,
          accion: params.accion,
          desde: params.desde,
          hasta: params.hasta,
        }}
        pagina={pagina}
        total={total}
        porPagina={POR_PAGINA_BITACORA}
        nombresActores={nombresActores}
      />
    </PaginaPanel>
  );
}
