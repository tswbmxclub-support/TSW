import { crearClienteServidor } from "@/lib/supabase/server";
import type { Club, ClubMenu } from "./types";

/**
 * Clubes y programas activos, en el orden que fijó el administrador.
 *
 * RLS ya filtra `activo` (migración 17), pero la consulta lo repite: la
 * política es la barrera, no la única defensa.
 */
export async function listarClubes(): Promise<Club[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("club")
    .select("*")
    .eq("activo", true)
    .order("orden", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Lo mínimo para pintar el menú. Se pide aparte y no se reaprovecha
 * `listarClubes()` porque esto cruza la frontera servidor→cliente en cada
 * página del sitio: la descripción de un club son varios cientos de bytes que
 * el menú no usa.
 */
export async function listarClubesParaMenu(): Promise<ClubMenu[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("club")
    .select("id, nombre, slug, tipo, etiqueta")
    .eq("activo", true)
    .order("orden", { ascending: true });

  if (error) {
    // Esta consulta corre en el layout, o sea en TODAS las páginas públicas.
    // Lanzar aquí convierte un fallo de una entrada del menú en un 500 de
    // todo el sitio —pasó exactamente eso con la política de la migración 17,
    // que hacía a anon ejecutar es_admin()—. El menú es la moldura, no el
    // contenido: si no se puede leer, se pinta sin la entrada de clubes y el
    // fallo queda en el log del servidor, que es donde se diagnostica.
    console.error("[menú de clubes]", error.code, error.message);
    return [];
  }

  return data ?? [];
}

/** Un club por su slug, o null. Solo activos, por la misma razón de arriba. */
export async function obtenerClub(slug: string): Promise<Club | null> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("club")
    .select("*")
    .eq("slug", slug)
    .eq("activo", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}
