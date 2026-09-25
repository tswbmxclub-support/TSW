import { TIENDA_MUESTRA_PRECIOS } from "@/config/sitio";
import { formatearPrecio } from "@/lib/utils";

/** Lo mínimo que necesita una línea del mensaje. */
export type LineaMensaje = {
  nombreProducto: string;
  talla: string;
  cantidad: number;
  precioCentavos: number;
};

/**
 * Precio para el texto del chat. `formatearPrecio` es la única conversión de
 * centavos del proyecto; aquí solo se cambia el espacio duro que pone Intl
 * ("$ 45.000") por uno normal, que WhatsApp muestra igual y encodeURIComponent
 * codifica más corto.
 */
function precio(centavos: number): string {
  return formatearPrecio(centavos).replace(/ /g, " ");
}

/**
 * Texto del pedido que se abre ya escrito en WhatsApp. Función pura: recibe
 * solo las líneas válidas (con stock y disponibles) y el total ya calculado
 * sobre esas mismas líneas.
 *
 *   Hola, quiero hacer este pedido en TSW:
 *
 *   • Camiseta — Talla M — Cantidad 2 — $ 45.000
 *
 *   Total: $ 90.000
 *
 *   Quedo atento a la confirmación de disponibilidad y el pago.
 *
 * Con la tienda en modo catálogo (`TIENDA_MUESTRA_PRECIOS` en false) el
 * mensaje va sin importes ni total, y pide el precio en vez de anunciarlo. Un
 * chat que llega con cifras que la cliente no ha fijado es peor que uno sin
 * ellas: el comprador las da por buenas.
 */
export function construirMensajePedido(lineas: LineaMensaje[], totalCentavos: number): string {
  const cuerpo = lineas
    .map((l) => {
      const linea = `• ${l.nombreProducto} — Talla ${l.talla} — Cantidad ${l.cantidad}`;
      return TIENDA_MUESTRA_PRECIOS ? `${linea} — ${precio(l.precioCentavos)}` : linea;
    })
    .join("\n");

  return [
    "Hola, quiero hacer este pedido en TSW:",
    "",
    cuerpo,
    "",
    ...(TIENDA_MUESTRA_PRECIOS
      ? [`Total: ${precio(totalCentavos)}`, "", "Quedo atento a la confirmación de disponibilidad y el pago."]
      : ["¿Me confirman disponibilidad, precio y cómo pagar?"]),
  ].join("\n");
}
