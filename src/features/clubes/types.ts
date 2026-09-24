import type { Tables } from "@/lib/supabase/database.types";

export type Club = Tables<"club">;

/**
 * Lo que la navegación necesita de un club, y nada más. El menú se pinta en un
 * componente de cliente: cuanto menos viaje al navegador, mejor.
 */
export type ClubMenu = Pick<Club, "id" | "nombre" | "slug" | "tipo" | "etiqueta">;
