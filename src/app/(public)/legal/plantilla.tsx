import type { Metadata } from "next";

import { Aviso, DocumentoLegal, HeroPagina } from "@/components/ui";
import type { ContenidoLegal } from "@/config/legales";
import { LEGALES_APROBADAS } from "@/config/sitio";

/**
 * Las tres páginas legales son la misma página con otro texto, así que comparten
 * plantilla: el aviso de borrador y el `noindex` viven en un sitio y no en tres
 * copias que se desincronizan la primera vez que alguien toque una.
 *
 * El texto de cada documento está en `src/config/legales.ts`.
 */

export const AVISO_BORRADOR = "Borrador pendiente de revisión legal";

/** Metadatos de una página legal. `noindex` mientras el texto no esté aprobado. */
export function metadataLegal(documento: ContenidoLegal): Metadata {
  return {
    title: documento.titulo,
    description: documento.descripcion,
    // `follow` se mantiene: los enlaces internos de la página siguen valiendo
    // para el rastreo del resto del sitio; lo que no debe indexarse es ESTE texto.
    ...(LEGALES_APROBADAS ? {} : { robots: { index: false, follow: true } }),
  };
}

export function PaginaLegal({ documento }: { documento: ContenidoLegal }) {
  return (
    <>
      <HeroPagina tono="oscuro" antetitulo="Legal" titulo={documento.titulo} bajada={documento.bajada} />

      {!LEGALES_APROBADAS && (
        <div className="contenedor pt-8">
          <Aviso tono="aviso" titulo={AVISO_BORRADOR}>
            Este texto es una adaptación de los borradores de la corporación al funcionamiento
            actual del sitio. Todavía no lo ha revisado un abogado, así que no debe tomarse como
            la versión definitiva.
          </Aviso>
        </div>
      )}

      <DocumentoLegal tituloId="titulo-legal" titulo={documento.titulo} secciones={documento.secciones} />
    </>
  );
}
