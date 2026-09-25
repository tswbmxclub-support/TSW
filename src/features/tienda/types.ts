import { TIENDA_MUESTRA_PRECIOS } from "@/config/sitio";
import type { Enums, Tables } from "@/lib/supabase/database.types";

export type Producto = Tables<"producto">;
export type Variante = Tables<"variante">;
export type CategoriaProducto = Enums<"categoria_producto">;

/**
 * Columnas de `variante` que pide el sitio público, con el precio dentro solo
 * si la tienda enseña precios.
 *
 * No basta con ocultar la cifra al pintar: el payload RSC que viaja al
 * navegador lleva lo que devolvió la consulta, y cualquiera lo lee en el código
 * fuente de la página. Mientras la cliente no fije los precios, eso serían
 * cifras publicadas sin querer.
 *
 * Las dos ramas son literales y no una plantilla armada en ejecución: así
 * supabase-js sigue infiriendo el tipo de cada fila. Con una cadena construida
 * el tipo se degrada y se pierde la comprobación de columnas. Comprobado: con
 * la unión de literales, `tsc` sigue viendo `stock: number`.
 */
export const CAMPOS_PRODUCTO_PUBLICO = TIENDA_MUESTRA_PRECIOS
  ? ("*, variante(*)" as const)
  : ("*, variante(id, producto_id, talla, sku, stock, stock_reservado, activo, creado_en, actualizado_en)" as const);

/**
 * Variante tal como la ve el sitio público: **el precio puede no venir**.
 *
 * Opcional y no rellenado con un 0, porque rellenarlo lo devuelve al payload: el
 * campo viajaba al navegador con un cero, y lo que se pidió es que no viaje. El
 * tipo dice ahora la verdad —en modo catálogo no hay precio— y quien lo use
 * tiene que decidir qué hacer sin él, que es justo lo que se quiere.
 */
export type VariantePublica = Omit<Variante, "precio_centavos"> & { precio_centavos?: number };

/** Producto con sus variantes, tal como se muestra en la tienda pública. */
export type ProductoConVariantes = Producto & {
  variantes: VariantePublica[];
};

/**
 * Producto con las variantes COMPLETAS, para el panel.
 *
 * El administrador siempre ve el precio: es lo que edita, y el modo catálogo es
 * una decisión sobre lo que se publica, no sobre lo que se administra. Tipo
 * aparte y no un optional compartido para que el formulario del panel no tenga
 * que tratar un precio ausente que ahí nunca ocurre.
 */
export type ProductoConVariantesCompletas = Producto & {
  variantes: Variante[];
};

/** Unidades que se pueden vender ahora mismo. */
/** Solo necesita el stock, así que acepta cualquier fila que lo traiga. */
export function disponible(variante: Pick<Variante, "stock" | "stock_reservado">): number {
  return variante.stock - variante.stock_reservado;
}

/**
 * Precio más bajo entre las variantes activas, en centavos. Es una función
 * pura sobre el tipo, no una consulta: vive aquí y no en queries.ts para que
 * las islas de cliente (la tarjeta en el catálogo filtrable) puedan usarla
 * sin arrastrar el cliente server-only de Supabase.
 */
export function precioDesde(producto: ProductoConVariantes): number | null {
  const precios = producto.variantes
    .filter((v) => v.activo)
    .map((v) => v.precio_centavos)
    // En modo catálogo el precio no se consultó y llega `undefined`. Un 0 o un
    // undefined colados aquí harían que la tienda anunciara productos gratis.
    .filter((centavos): centavos is number => typeof centavos === "number" && centavos > 0);
  return precios.length === 0 ? null : Math.min(...precios);
}

/** Bucket de fotos del catálogo, subidas desde el panel. */
export const BUCKET_PRODUCTOS = "productos";

/**
 * Etiqueta legible de cada tipo de prenda. Desde la migración 17 el enum dice
 * QUÉ es el producto; de quién es lo dice `club_id` (nulo = marca TSW).
 */
export const ETIQUETA_CATEGORIA: Record<CategoriaProducto, string> = {
  buso: "Buso",
  guantes: "Guantes",
  camiseta: "Camiseta",
  gorra: "Gorra",
};

/**
 * La etiqueta, o null si el producto no está clasificado. `categoria` es
 * nulable desde la 17: los cuatro productos de la semilla quedaron sin prenda
 * porque sus categorías viejas no traducían a ninguna, y el panel es quien
 * las corrige. Indexar el mapa con null reventaba en tiempo de ejecución.
 */
export function etiquetaCategoria(categoria: CategoriaProducto | null): string | null {
  return categoria ? ETIQUETA_CATEGORIA[categoria] : null;
}

/** Merchandising de la marca: sin club dueño. */
export function esDeLaMarca(producto: Pick<Producto, "club_id">): boolean {
  return producto.club_id === null;
}
