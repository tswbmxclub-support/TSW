import type { Metadata } from "next";

import { Aparece } from "@/lib/animaciones";
import { BloqueCTA, Boton, HeroPagina, Seccion, SeccionTitulo } from "@/components/ui";
import { listarProductos } from "@/features/tienda/queries";
import { CatalogoProductos } from "@/features/tienda/components/CatalogoProductos";

const TITULO = "Tienda";
const DESCRIPCION =
  "Uniformes, protección y merchandising oficial de la escuela de BMX TSW. Paga en línea con Wompi.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  openGraph: { title: `${TITULO} | TSW`, description: DESCRIPCION, type: "website" },
};

/**
 * Catálogo público. Server Component: una sola consulta; los filtros y la
 * búsqueda son una isla de cliente que recibe la lista ya lista.
 */
export default async function PaginaTienda() {
  const productos = await listarProductos();

  return (
    <>
      <HeroPagina
        antetitulo="Catálogo oficial"
        titulo="Tienda"
        bajada="Uniformes, protección y merchandising del club. El pago se procesa con Wompi y el pedido queda reservado mientras se confirma."
      />

      <Seccion tituloId="titulo-catalogo">
        <Aparece>
          <SeccionTitulo id="titulo-catalogo" bajada="Filtra por categoría o busca por nombre.">
            Catálogo
          </SeccionTitulo>
        </Aparece>
        <Aparece indice={1} className="mt-8">
          {productos.length === 0 ? (
            <p
              role="status"
              className="rounded-lg border-2 border-dashed border-gris-borde bg-blanco px-6 py-10 text-center text-texto-sec"
            >
              Todavía no hay productos publicados. Aparecerán aquí en cuanto se activen.
            </p>
          ) : (
            <CatalogoProductos productos={productos} />
          )}
        </Aparece>
      </Seccion>

      <BloqueCTA
        tituloId="titulo-cta-tienda"
        titulo="¿Dudas con las tallas?"
        texto="Escríbenos por WhatsApp antes de pagar: te ayudamos a elegir la talla correcta para evitar devoluciones."
        acciones={
          <Boton href="/matriculas" fondo="acento" tamano="lg">
            Ver contactos del club
          </Boton>
        }
      />
    </>
  );
}
