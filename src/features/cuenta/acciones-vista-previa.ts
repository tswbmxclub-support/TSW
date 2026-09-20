"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { OPCIONES_SELECTOR_PANEL } from "@/features/cuenta/datos-de-muestra";
import { NOMBRE_COOKIE_DEPORTE } from "@/features/cuenta/deporte-servidor";

/**
 * Acción de vista previa: fija la cookie tsw.deporte y revalida el panel.
 *
 * Vive aquí y no en features/admin/acciones.ts porque no es una operación de
 * administración: no escribe en la base ni pasa por RPC con p_actor_id; solo
 * guarda la preferencia visual. Cuando la tabla deporte exista, esta acción se
 * reemplaza por la consulta real y la cookie deja de ser la fuente.
 *
 * La validación es contra la lista de muestra: un id desconocido cae al
 * deporte por defecto, igual que en la lectura.
 */
export async function elegirDeporte(id: string): Promise<void> {
  const deporte = OPCIONES_SELECTOR_PANEL.find((d) => d.id === id);
  if (!deporte) return;

  const cookie = await cookies();
  cookie.set(NOMBRE_COOKIE_DEPORTE, deporte.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/admin", "layout");
}
