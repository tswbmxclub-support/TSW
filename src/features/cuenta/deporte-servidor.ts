import "server-only";

import { cookies } from "next/headers";

import { DEPORTES_MUESTRA, DEPORTE_POR_DEFECTO_ID, type DeporteMuestra } from "@/features/cuenta/datos-de-muestra";

/**
 * Nombre de la cookie con el deporte activo del panel. Legible desde el
 * servidor en cualquier página del panel y del área de cuenta.
 */
export const NOMBRE_COOKIE_DEPORTE = "tsw.deporte";

/**
 * Deporte activo según la cookie. Si falta o trae un id desconocido, cae al
 * deporte por defecto de los datos de muestra.
 */
export async function deporteActivo(): Promise<DeporteMuestra> {
  const guardado = (await cookies()).get(NOMBRE_COOKIE_DEPORTE)?.value;
  return DEPORTES_MUESTRA.find((d) => d.id === guardado) ?? DEPORTES_MUESTRA[0] ?? { id: DEPORTE_POR_DEFECTO_ID, nombre: "[DEPORTE]" };
}
