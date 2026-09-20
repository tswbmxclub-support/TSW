import type { Metadata } from "next";

import { Aviso, HeroPagina } from "@/components/ui";

export const metadata: Metadata = {
  title: "Política de tratamiento de datos",
  description: "Cómo trata TSW los datos personales de deportistas, acudientes y compradores.",
};

/**
 * Política de tratamiento de datos (Ley 1581 de 2012). El texto lo entrega el
 * asesor jurídico de la corporación; hasta entonces la página existe para que
 * el enlace desde /cuenta/acceso no caiga en un 404, y deja claro que el
 * contenido está pendiente. No se redacta aquí ningún texto legal.
 */
export default function PaginaPoliticaDatos() {
  return (
    <>
      <HeroPagina
        tono="oscuro"
        antetitulo="Legal"
        titulo="Política de tratamiento de datos"
        bajada="Cómo se recogen, usan y protegen los datos personales de deportistas, acudientes y compradores."
      />

      <div className="contenedor py-12 sm:py-16 lg:py-20">
        <Aviso tono="info" titulo="Texto pendiente">
          [POLÍTICA DE TRATAMIENTO DE DATOS — la redacta el asesor jurídico de la
          corporación. Debe cubrir: responsable del tratamiento, finalidades,
          datos de menores y autorización del acudiente, derechos del titular y
          canal de atención.]
        </Aviso>
      </div>
    </>
  );
}
