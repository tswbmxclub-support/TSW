import type { Club } from "@/features/clubes/types";

/**
 * El club activo de una página pública, a partir de `?club=<slug>`.
 *
 * Parámetro de búsqueda y no segmento de ruta (`/bmx-club-tsw/semilleros`),
 * por lo mismo que se decidió para el deporte: las rutas no se duplican, no
 * hay que repetir `loading.tsx` y `error.tsx` por club, y `revalidatePath`
 * sigue apuntando a las mismas páginas. Si algún día cada club tiene
 * contenido propio que valga indexar aparte, el cambio es de esta función y
 * de los enlaces, no de las páginas.
 *
 * Se usa el SLUG y no el id: sale en la URL, y un uuid ahí no le dice nada a
 * nadie ni sobrevive a una exportación de datos.
 */
export const PARAMETRO_CLUB = "club";

export type ParametrosBusqueda = Record<string, string | string[] | undefined>;

export type ClubSeleccionado =
  /** Sin `?club`: se usa el primero que ordenó el administrador. */
  | { estado: "por-defecto"; club: Club }
  /** `?club=` con un slug que existe y está activo. */
  | { estado: "elegido"; club: Club }
  /** `?club=` con un slug que no existe, está inactivo, o no hay clubes. */
  | { estado: "desconocido"; club: null };

/**
 * El club por defecto: el primero de `tipo = "club"` por orden.
 *
 * Por orden y no por un slug escrito aquí, porque el orden lo decide el
 * administrador desde el panel. Y filtrando por tipo, porque "el primero de la
 * lista" podría acabar siendo un PROGRAMA si alguien reordena: la página de
 * niveles abriría en Habilidades Motrices, que no tiene niveles, y el visitante
 * vería un bloque de texto donde esperaba la ruta formativa.
 *
 * Si no hay ningún club activo se cae al primer registro que haya, sea
 * programa o lo que sea: enseñar el programa es mejor que no enseñar nada.
 * Con la lista vacía devuelve null y la página muestra su estado vacío.
 */
export function clubPorDefecto(clubes: Club[]): Club | null {
  return clubes.find((c) => c.tipo === "club") ?? clubes[0] ?? null;
}

/**
 * Resuelve el club de la petición.
 *
 * Un slug que no corresponde a ningún club activo NO cae al primero en
 * silencio: se marca como desconocido para que la página lo diga y ponga el
 * `canonical` en la URL sin parámetro. Caer al primero sin avisar dejaría una
 * URL que miente —dice un club y muestra otro— y dos direcciones indexables
 * con el mismo contenido.
 */
export function clubDeParametros(
  clubes: Club[],
  parametros: ParametrosBusqueda | undefined,
): ClubSeleccionado {
  const crudo = parametros?.[PARAMETRO_CLUB];
  const slug = Array.isArray(crudo) ? crudo[0] : crudo;

  if (!slug) {
    const porDefecto = clubPorDefecto(clubes);
    return porDefecto ? { estado: "por-defecto", club: porDefecto } : { estado: "desconocido", club: null };
  }

  const club = clubes.find((c) => c.slug === slug);
  return club ? { estado: "elegido", club } : { estado: "desconocido", club: null };
}

/** Enlace a una sección pública con el club ya puesto. */
export function enlaceConClub(ruta: string, slug: string): string {
  return `${ruta}?${PARAMETRO_CLUB}=${encodeURIComponent(slug)}`;
}
