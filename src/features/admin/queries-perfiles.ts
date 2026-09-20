import "server-only";

import type { User } from "@supabase/supabase-js";

import { exigirAdmin } from "@/lib/auth";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

/**
 * Lecturas de perfil_admin y perfil_usuario para el panel.
 *
 * El correo no vive en las tablas de perfil (migración 13): está en auth.users
 * y PostgREST no expone ese esquema. Se lee con la Admin API de Auth
 * (`auth.admin.listUsers` / `getUserById`), que corre con service role y solo
 * desde el servidor. Las filas de perfil se leen con el cliente de la sesión,
 * así RLS sigue siendo la barrera: un administrador inactivo no ve nada.
 */

export type PerfilAdmin = Tables<"perfil_admin">;
export type PerfilUsuario = Tables<"perfil_usuario">;

/** Perfil con el correo de Auth. `correo` es null si la cuenta desapareció de Auth. */
export type AdminPanel = PerfilAdmin & { correo: string | null; ultimoAcceso: string | null };
export type UsuarioPanel = PerfilUsuario & { correo: string | null; ultimoAcceso: string | null };

/**
 * Mapa id → usuario de Auth de todas las cuentas. La Admin API pagina de a
 * 1000; el bucle recorre las páginas que haga falta. Con las decenas o cientos
 * de cuentas que tendrá la corporación, es una o dos llamadas.
 */
async function usuariosDeAuth(): Promise<Map<string, User>> {
  const supabase = crearClienteAdmin();
  const mapa = new Map<string, User>();
  const porPagina = 1000;

  for (let pagina = 1; pagina <= 20; pagina += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: porPagina });
    if (error) throw error;
    for (const usuario of data.users) mapa.set(usuario.id, usuario);
    if (data.users.length < porPagina) break;
  }

  return mapa;
}

function conCorreo<T extends { id: string }>(fila: T, cuentas: Map<string, User>) {
  const cuenta = cuentas.get(fila.id);
  return {
    ...fila,
    correo: cuenta?.email ?? null,
    ultimoAcceso: cuenta?.last_sign_in_at ?? null,
  };
}

/** Administradores del panel, activos primero y luego por nombre. */
export async function listarAdministradores(): Promise<AdminPanel[]> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();

  const [{ data, error }, cuentas] = await Promise.all([
    supabase.from("perfil_admin").select("*").order("activo", { ascending: false }).order("nombre"),
    usuariosDeAuth(),
  ]);
  if (error) throw error;

  return (data ?? []).map((fila) => conCorreo(fila, cuentas));
}

/** Titulares de cuenta (perfil_usuario), activos primero y luego por nombre. */
export async function listarUsuarios(): Promise<UsuarioPanel[]> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();

  const [{ data, error }, cuentas] = await Promise.all([
    supabase.from("perfil_usuario").select("*").order("activo", { ascending: false }).order("nombre"),
    usuariosDeAuth(),
  ]);
  if (error) throw error;

  return (data ?? []).map((fila) => conCorreo(fila, cuentas));
}

/** Un titular por id, con su correo; null si no existe. */
export async function obtenerUsuarioPanel(id: string): Promise<UsuarioPanel | null> {
  await exigirAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("perfil_usuario").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: cuenta } = await crearClienteAdmin().auth.admin.getUserById(id);
  return {
    ...data,
    correo: cuenta?.user?.email ?? null,
    ultimoAcceso: cuenta?.user?.last_sign_in_at ?? null,
  };
}

/**
 * Nombres de los administradores que aparecen como actor en una lista de
 * eventos de la bitácora. Devuelve un mapa id → nombre; los ids sin perfil
 * (cuentas borradas de Auth, o actores que nunca fueron administradores)
 * simplemente no están en el mapa y la interfaz muestra el id recortado.
 */
export async function nombresDeActores(actorIds: (string | null)[]): Promise<Record<string, string>> {
  const ids = [...new Set(actorIds.filter((id): id is string => id !== null))];
  if (ids.length === 0) return {};

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("perfil_admin").select("id, nombre").in("id", ids);
  if (error) throw error;

  return Object.fromEntries((data ?? []).map((fila) => [fila.id, fila.nombre]));
}
