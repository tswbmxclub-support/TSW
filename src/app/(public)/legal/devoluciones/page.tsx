import type { Metadata } from "next";

import { DocumentoLegal, HeroPagina } from "@/components/ui";
import { DEVOLUCIONES } from "@/config/legales";

export const metadata: Metadata = {
  title: DEVOLUCIONES.titulo,
  description: DEVOLUCIONES.descripcion,
};

/**
 * El texto sale de `src/config/legales.ts`, que lleva el borrador de la cliente
 * adaptado a lo que el sitio hace hoy. Los cambios están listados en
 * docs/legales-cambios-para-cliente.md para que ella los apruebe.
 */
export default function PaginaDevoluciones() {
  return (
    <>
      <HeroPagina tono="oscuro" antetitulo="Legal" titulo={DEVOLUCIONES.titulo} bajada={DEVOLUCIONES.bajada} />
      <DocumentoLegal tituloId="titulo-legal" titulo={DEVOLUCIONES.titulo} secciones={DEVOLUCIONES.secciones} />
    </>
  );
}
