import { crearClienteServidor } from "@/lib/supabase/server";
import { ErrorNoEncontrado } from "@/lib/errors";
import { CAMPOS_PRODUCTO_PUBLICO, type ProductoConVariantes } from "./types";

/** Catálogo público. RLS deja fuera productos y variantes inactivos. */
export async function listarProductos(): Promise<ProductoConVariantes[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("producto")
    .select(CAMPOS_PRODUCTO_PUBLICO)
    .order("orden", { ascending: true });

  if (error) throw error;

  return (data ?? []).map(({ variante, ...producto }) => ({
    ...producto,
    variantes: variante,
  }));
}

export async function obtenerProductoPorSlug(slug: string): Promise<ProductoConVariantes> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("producto")
    .select(CAMPOS_PRODUCTO_PUBLICO)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new ErrorNoEncontrado("Ese producto no existe o no está disponible.");

  const { variante, ...producto } = data;
  return { ...producto, variantes: variante };
}

/**
 * Selección para la portada. No hay columna `destacado` en `producto`: el
 * criterio es el orden manual que fija el administrador, que es justamente
 * para esto.
 */
export async function listarProductosDestacados(limite = 4): Promise<ProductoConVariantes[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("producto")
    .select(CAMPOS_PRODUCTO_PUBLICO)
    .order("orden", { ascending: true })
    .limit(limite);

  if (error) throw error;

  return (data ?? []).map(({ variante, ...producto }) => ({
    ...producto,
    variantes: variante,
  }));
}

