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

/** Etiqueta legible de cada categoría del enum `categoria_producto`. */
export const ETIQUETA_CATEGORIA: Record<CategoriaProducto, string> = {
  uniformes: "Uniformes",
  proteccion: "Protección",
  merchandising: "Merchandising",
};
