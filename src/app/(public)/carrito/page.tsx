import type { Metadata } from "next";

import { HeroPagina } from "@/components/ui";
import { ListaCarrito } from "@/features/pedidos/components/ListaCarrito";

export const metadata: Metadata = {
  title: "Carrito",
  description: "Los artículos que vas a pedir por WhatsApp en la tienda del club TSW.",
  robots: { index: false },
};

/**
 * Carrito del comprador. La lista y el resumen son una isla de cliente porque
 * los items viven en localStorage; el hero es de servidor.
 */
export default function PaginaCarrito() {
  return (
    <>
      <HeroPagina
        tono="oscuro"
        antetitulo="Tienda"
        titulo="Carrito"
        bajada="Revisa tallas y cantidades y envía el pedido por WhatsApp. El club confirma disponibilidad y te indica cómo pagar."
      />

      <div className="contenedor py-12 sm:py-16 lg:py-20">
        <ListaCarrito />
      </div>
    </>
  );
}
