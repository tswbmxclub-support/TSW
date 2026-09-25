import type { Metadata } from "next";

import { DocumentoLegal, HeroPagina } from "@/components/ui";
import { TERMINOS } from "@/config/legales";

export const metadata: Metadata = {
  title: TERMINOS.titulo,
  description: TERMINOS.descripcion,
};

/**
 * El texto sale de `src/config/legales.ts`, que lleva el borrador de la cliente
 * adaptado a lo que el sitio hace hoy. Los cambios están listados en
 * docs/legales-cambios-para-cliente.md para que ella los apruebe.
 */
export default function PaginaTerminos() {
  return (
    <>
      <HeroPagina tono="oscuro" antetitulo="Legal" titulo={TERMINOS.titulo} bajada={TERMINOS.bajada} />
      <DocumentoLegal tituloId="titulo-legal" titulo={TERMINOS.titulo} secciones={TERMINOS.secciones} />
    </>
  );
}
