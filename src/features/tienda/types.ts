import type { Enums, Tables } from "@/lib/supabase/database.types";

export type Producto = Tables<"producto">;
export type Variante = Tables<"variante">;
export type CategoriaProducto = Enums<"categoria_producto">;

/** Producto con sus variantes, tal como se muestra en la tienda. */
export type ProductoConVariantes = Producto & {
  variantes: Variante[];
};

/** Unidades que se pueden vender ahora mismo. */
export function disponible(variante: Variante): number {
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
    .map((v) => v.precio_centavos);
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
