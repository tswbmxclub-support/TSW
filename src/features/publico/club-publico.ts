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
 * Resuelve el club de la petición.
 *
 * Sin parámetro se devuelve el PRIMERO POR ORDEN, no un slug escrito aquí: el
 * orden lo decide el administrador desde el panel, así que el club por defecto
 * es su decisión y no una constante del código. Hoy es BMX Club TSW, que el
 * documento del cliente llama "el club de la casa, el que da nombre a la
 * corporación".
 *
 * Un slug que no corresponde a ningún club activo NO cae al primero en
 * silencio: se marca como desconocido para que la página redirija a la URL
 * canónica. Caer al primero dejaría una URL que miente —dice un club y
 * muestra otro— y dos direcciones con el mismo contenido.
 */
export function clubDeParametros(
  clubes: Club[],
  parametros: ParametrosBusqueda | undefined,
): ClubSeleccionado {
  const crudo = parametros?.[PARAMETRO_CLUB];
  const slug = Array.isArray(crudo) ? crudo[0] : crudo;

  if (!slug) {
    const primero = clubes[0];
    return primero ? { estado: "por-defecto", club: primero } : { estado: "desconocido", club: null };
  }

  const club = clubes.find((c) => c.slug === slug);
  return club ? { estado: "elegido", club } : { estado: "desconocido", club: null };
}

/** Enlace a una sección pública con el club ya puesto. */
export function enlaceConClub(ruta: string, slug: string): string {
  return `${ruta}?${PARAMETRO_CLUB}=${encodeURIComponent(slug)}`;
}
