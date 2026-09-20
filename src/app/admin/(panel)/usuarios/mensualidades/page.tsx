import type { Metadata } from "next";

import { PaginaPanel } from "@/components/admin/PaginaPanel";
import { Boton } from "@/components/ui";
import { exigirAdminPagina } from "@/lib/auth";
import { deporteActivo } from "@/features/cuenta/deporte-servidor";
import { MensualidadesDelMesAdmin } from "@/features/cuenta/components/MensualidadesDelMesAdmin";

export const metadata: Metadata = { title: "Mensualidades del mes" };

/**
 * Vista transversal de cobro: la mensualidad del mes por deportista, sin
 * pasar por cada usuario. Complementa el detalle por usuario, que sigue
 * siendo el sitio para ver el historial completo.
 */
export default async function PaginaMensualidadesDelMesPanel() {
  await exigirAdminPagina("/admin/usuarios/mensualidades");
  const deporte = await deporteActivo();

  return (
    <PaginaPanel
      titulo="Mensualidades del mes"
      descripcion="Quién ha pagado y quién no, deportista por deportista."
      deporte={deporte}
      accion={
        <Boton href="/admin/usuarios" variante="secundario">
          Volver a usuarios
        </Boton>
      }
    >
      <MensualidadesDelMesAdmin deporteNombre={deporte.nombre} />
    </PaginaPanel>
  );
}
