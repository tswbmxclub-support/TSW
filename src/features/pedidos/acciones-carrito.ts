"use server";

import { z } from "zod";

import { crearClienteServidor } from "@/lib/supabase/server";
import { disponible } from "@/features/tienda/types";

/** Estado fresco de una variante, tal como lo necesita el carrito. */
export type VarianteCarrito = {
  varianteId: string;
  productoSlug: string;
  nombreProducto: string;
  talla: string;
  precioCentavos: number;
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

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("variante")
    .select("*, producto!inner(slug, nombre, activo)")
    .in("id", validos.data)
    .eq("activo", true)
    .eq("producto.activo", true);

  if (error) throw error;

  return (data ?? []).map(({ producto, ...variante }) => ({
    varianteId: variante.id,
    productoSlug: producto.slug,
    nombreProducto: producto.nombre,
    talla: variante.talla,
    precioCentavos: variante.precio_centavos,
    disponible: disponible(variante),
  }));
}
