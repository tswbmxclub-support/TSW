"use server";

import { z } from "zod";

import { crearClientePublico } from "@/lib/supabase/publico";
import { TIENDA_MUESTRA_PRECIOS } from "@/config/sitio";
import { disponible } from "@/features/tienda/types";

/** Estado fresco de una variante, tal como lo necesita el carrito. */
export type VarianteCarrito = {
  varianteId: string;
  productoSlug: string;
  nombreProducto: string;
  talla: string;
  /** Ausente con la tienda en modo catálogo: el precio no se consulta. */
  precioCentavos?: number;
  /** Unidades que se pueden pedir ahora: stock menos reservado. */
  disponible: number;
};

const esquemaIds = z.array(z.string().uuid()).max(50);

/**
 * Lectura pública (anon key) de las variantes que hay en el carrito. El
 * carrito guarda solo ids y cantidades; nombre, talla, precio y stock se
 * leen de aquí cada vez que se monta, no de lo que había en el navegador.
 *
 * Una variante que no vuelve en la respuesta ya no está disponible: RLS
 * oculta las inactivas y las de productos inactivos, y el filtro se repite en
 * la consulta para no depender solo de la política.
 */
export async function consultarVariantesCarrito(ids: string[]): Promise<VarianteCarrito[]> {
  const validos = esquemaIds.safeParse(ids);
  if (!validos.success || validos.data.length === 0) return [];

  const supabase = crearClientePublico();
  const filtrada = supabase.from("variante");

  // Dos ramas con la lista de columnas ESCRITA EN CADA UNA, y no una cadena
  // armada en ejecución: el tipo de la fila lo deduce supabase-js leyendo ese
  // literal, y con una cadena calculada se degrada y se pierde la
  // comprobación de columnas. Una unión de los dos literales tampoco vale
  // aquí: el analizador de tipos no la reparte y devuelve ParserError.
  // En modo catálogo el precio NO se consulta, así no viaja en el payload.
  const { data, error } = TIENDA_MUESTRA_PRECIOS
    ? await filtrada
        .select("*, producto!inner(slug, nombre, activo)")
        .in("id", validos.data)
        .eq("activo", true)
        .eq("producto.activo", true)
    : await filtrada
        .select(
          "id, producto_id, talla, sku, stock, stock_reservado, activo, creado_en, actualizado_en, producto!inner(slug, nombre, activo)",
        )
        .in("id", validos.data)
        .eq("activo", true)
        .eq("producto.activo", true);

  if (error) throw error;

  return (data ?? []).map(({ producto, ...variante }) => ({
    varianteId: variante.id,
    productoSlug: producto.slug,
    nombreProducto: producto.nombre,
    talla: variante.talla,
    // Se copia tal cual: si la consulta no lo pidió, llega `undefined`, y no se
    // inventa un 0 que volvería a viajar al navegador.
    precioCentavos: "precio_centavos" in variante ? (variante.precio_centavos as number) : undefined,
    disponible: disponible(variante),
  }));
}
