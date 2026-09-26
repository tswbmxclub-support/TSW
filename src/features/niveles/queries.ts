import { crearClientePublico } from "@/lib/supabase/publico";
import type { Nivel } from "./types";

/**
 * Semilleros y niveles activos de UN club, en el orden que fijó el
 * administrador. RLS ya filtra `activo`; se repite aquí para no depender solo
 * de la política.
 *
 * El club es obligatorio desde la migración 17: sin filtrar, la página
 * mezclaría los seis niveles de los dos clubes y mostraría "Minirider" e
 * "Intermedio" dos veces, que es exactamente lo que se veía al aplicarla.
 */
export async function listarNiveles(clubId: string): Promise<Nivel[]> {
  const supabase = crearClientePublico();
  const { data, error } = await supabase
    .from("nivel")
    .select("*")
    .eq("club_id", clubId)
    .eq("activo", true)
    .order("orden", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
