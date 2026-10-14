import { crearClientePublico } from "@/lib/supabase/publico";
import { ErrorNoEncontrado } from "@/lib/errors";
import {
  CAMPOS_PRODUCTO_PUBLICO,
  type FotoProducto,
  type Producto,
  type ProductoConVariantes,
  type VariantePublica,
} from "./types";

/** Fila tal como la devuelve CAMPOS_PRODUCTO_PUBLICO. */
type FilaProductoPublico = Producto & { variante: VariantePublica[]; producto_imagen: FotoProducto[] };

function aProducto({ variante, producto_imagen, ...producto }: FilaProductoPublico): ProductoConVariantes {
  return {
    ...producto,
    variantes: variante,
    imagenes: [...producto_imagen].sort((a, b) => a.orden - b.orden),
  };
}

/** Catálogo público. RLS deja fuera productos y variantes inactivos. */
export async function listarProductos(): Promise<ProductoConVariantes[]> {
  const supabase = crearClientePublico();
  const { data, error } = await supabase
    .from("producto")
    .select(CAMPOS_PRODUCTO_PUBLICO)
    .order("orden", { ascending: true });

  if (error) throw error;

  return (data ?? []).map(aProducto);
}

export async function obtenerProductoPorSlug(slug: string): Promise<ProductoConVariantes> {
  const supabase = crearClientePublico();
  const { data, error } = await supabase
    .from("producto")
    .select(CAMPOS_PRODUCTO_PUBLICO)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new ErrorNoEncontrado("Ese producto no existe o no está disponible.");

  return aProducto(data);
}

/**
 * Selección para la portada. No hay columna `destacado` en `producto`: el
 * criterio es el orden manual que fija el administrador, que es justamente
 * para esto.
 */
export async function listarProductosDestacados(limite = 4): Promise<ProductoConVariantes[]> {
  const supabase = crearClientePublico();
  const { data, error } = await supabase
    .from("producto")
    .select(CAMPOS_PRODUCTO_PUBLICO)
    .order("orden", { ascending: true })
    .limit(limite);

  if (error) throw error;

  return (data ?? []).map(aProducto);
}
