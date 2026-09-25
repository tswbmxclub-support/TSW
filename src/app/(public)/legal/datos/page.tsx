import type { Metadata } from "next";

import { DocumentoLegal, HeroPagina } from "@/components/ui";
import { POLITICA_DATOS } from "@/config/legales";

export const metadata: Metadata = {
  title: POLITICA_DATOS.titulo,
  description: POLITICA_DATOS.descripcion,
};

/**
 * El texto sale de `src/config/legales.ts`, que lleva el borrador de la cliente
 * adaptado a lo que el sitio hace hoy. Los cambios están listados en
 * docs/legales-cambios-para-cliente.md para que ella los apruebe.
 */
export default function PaginaPoliticaDatos() {
  return (
    <>
      <HeroPagina tono="oscuro" antetitulo="Legal" titulo={POLITICA_DATOS.titulo} bajada={POLITICA_DATOS.bajada} />
      <DocumentoLegal tituloId="titulo-legal" titulo={POLITICA_DATOS.titulo} secciones={POLITICA_DATOS.secciones} />
    </>
  );
}
