"use server";

import { revalidatePath } from "next/cache";

import { exigirAdmin } from "@/lib/auth";
import { ErrorApp } from "@/lib/errors";
import { enviarInvitacion } from "@/lib/auth/enlaces";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { ejecutarRpc } from "./mutations";
import {
  esquemaEdicionAdmin,
  esquemaEdicionUsuario,
  esquemaInvitacionAdmin,
  esquemaInvitacionUsuario,
  type EntradaEdicionAdmin,
  type EntradaEdicionUsuario,
  type EntradaInvitacionAdmin,
  type EntradaInvitacionUsuario,
} from "./schemas";

/**
 * Gestión de administradores y usuarios (migración 13).
 *
 * Dos clases de operación, con dos mecanismos:
 *
 *  · Crear cuentas: SOLO la Admin API de Auth puede insertar en auth.users.
 *    Siempre `createUser` con el correo confirmado de oficio (lo escribió un
 *    administrador). El trigger `crear_perfil_al_registrar` decide el tipo de
 *    perfil por `app_metadata.tipo` en el INSERT: `admin` lo lleva explícito;
 *    sin él, es usuario. Toda cuenta nace INACTIVA; activarla es un paso
 *    aparte y deliberado.
 *
 *  · Enviar el enlace: lo hace la aplicación (lib/auth/enlaces.ts), no
 *    Supabase. Por eso no se usa `inviteUserByEmail`: mandaría el correo con
 *    la plantilla de Supabase, en inglés y con el formato PKCE que no
 *    sobrevive a abrirse en otro dispositivo.
 *
 *  · Editar, activar y desactivar perfiles: RPC de la migración 13 con
 *    p_actor_id, como toda escritura del panel. Nunca UPDATE directo.
 */

export type ResultadoPerfil = { ok: true; mensaje?: string } | { ok: false; error: string };

const YA_REGISTRADO = "Ya existe una cuenta con ese correo.";

function mensajeDe(error: unknown): string {
  if (error instanceof ErrorApp) return error.message;
  console.error("[acciones perfiles]", error);
  return "No se pudo completar la operación. Inténtalo de nuevo en un momento.";
}

/** Error de la Admin API cuando el correo ya tiene cuenta. */
function esCorreoRepetido(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "email_exists" || /already (been )?registered/i.test(error.message ?? "");
}

/**
 * Manda la invitación a una cuenta recién creada. Si el correo no sale, la
 * cuenta ya existe: se avisa para que el admin use «Reenviar enlace» en vez
 * de volver a invitar (que fallaría con "ya existe").
 */
async function enviarEnlaceInvitacion(correo: string, tipo: "admin" | "usuario", nombre: string): Promise<void> {
  try {
    await enviarInvitacion(correo, tipo, nombre);
  } catch (error) {
    console.error("[invitación]", error instanceof Error ? error.message : error);
    throw new ErrorApp(
      "La cuenta quedó creada pero el correo no salió. Usa «Reenviar enlace» en unos minutos.",
      "servicio_externo",
      502,
    );
  }
}

/** Nombre guardado al crear la cuenta, para el saludo del correo. */
function nombreDe(usuario: { user_metadata?: Record<string, unknown> }): string | null {
  const nombre = usuario.user_metadata?.nombre;
  return typeof nombre === "string" && nombre.trim() ? nombre : null;
}

function revalidarPerfiles(tipo: "admin" | "usuario", id?: string) {
  revalidatePath(tipo === "admin" ? "/admin/administradores" : "/admin/usuarios");
  if (id) revalidatePath(`/admin/usuarios/${id}`);
  // La bitácora muestra el nombre del actor: si cambia, que se vea.
  revalidatePath("/admin/bitacora");
  revalidatePath("/admin");
}

// --- Administradores ---------------------------------------------------------

/**
 * Crea la cuenta de un administrador y le manda el enlace para fijar su
 * contraseña. Nace inactivo: hay que activarlo desde la lista cuando haya
 * fijado su contraseña. El correo se confirma de oficio: lo escribió un
 * administrador, no un desconocido.
 */
export async function invitarAdministrador(entrada: EntradaInvitacionAdmin): Promise<ResultadoPerfil> {
  const datos = esquemaInvitacionAdmin.safeParse(entrada);
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Revisa los datos." };

  try {
    await exigirAdmin();
    const supabase = crearClienteAdmin();

    const { error } = await supabase.auth.admin.createUser({
      email: datos.data.correo,
      email_confirm: true,
      app_metadata: { tipo: "admin" },
      user_metadata: { nombre: datos.data.nombre },
    });
    if (esCorreoRepetido(error)) return { ok: false, error: YA_REGISTRADO };
    if (error) throw error;

    await enviarEnlaceInvitacion(datos.data.correo, "admin", datos.data.nombre);
    revalidarPerfiles("admin");
    return {
      ok: true,
      mensaje: `Cuenta creada. ${datos.data.nombre} recibirá un correo para fijar su contraseña; actívala cuando lo haya hecho.`,
    };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}

export async function editarAdministrador(entrada: EntradaEdicionAdmin): Promise<ResultadoPerfil> {
  const datos = esquemaEdicionAdmin.safeParse(entrada);
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Revisa los datos." };

  try {
    await ejecutarRpc("guardar_perfil_admin", { p_id: datos.data.id, p_nombre: datos.data.nombre });
    revalidarPerfiles("admin");
    return { ok: true, mensaje: "Nombre actualizado." };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}

export async function activarAdministrador(id: string): Promise<ResultadoPerfil> {
  try {
    await ejecutarRpc("activar_admin", { p_id: id });
    revalidarPerfiles("admin");
    return { ok: true, mensaje: "Administrador activado: ya puede entrar al panel." };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}

/** Las dos salvaguardas (no a sí mismo, no al último activo) las aplica la RPC. */
export async function desactivarAdministrador(id: string): Promise<ResultadoPerfil> {
  try {
    await ejecutarRpc("desactivar_admin", { p_id: id });
    revalidarPerfiles("admin");
    return { ok: true, mensaje: "Administrador desactivado: sus credenciales ya no abren el panel." };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}

/** Vuelve a mandar el enlace para fijar contraseña a un administrador existente. */
export async function reenviarEnlaceAdministrador(id: string): Promise<ResultadoPerfil> {
  try {
    await exigirAdmin();
    const { data, error } = await crearClienteAdmin().auth.admin.getUserById(id);
    if (error || !data.user?.email) return { ok: false, error: "Esa cuenta no existe en Auth." };

    await enviarInvitacion(data.user.email, "admin", nombreDe(data.user));
    return { ok: true, mensaje: "Enlace enviado." };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}

// --- Usuarios (titulares de cuenta) ------------------------------------------

/**
 * Invita a un titular: crea la cuenta, guarda el teléfono por RPC (con el
 * actor) y manda el correo con el enlace para fijar la contraseña.
 */
export async function invitarUsuario(entrada: EntradaInvitacionUsuario): Promise<ResultadoPerfil> {
  const datos = esquemaInvitacionUsuario.safeParse(entrada);
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Revisa los datos." };

  try {
    await exigirAdmin();
    const supabase = crearClienteAdmin();

    // Sin app_metadata.tipo: el trigger crea perfil_usuario.
    const { data, error } = await supabase.auth.admin.createUser({
      email: datos.data.correo,
      email_confirm: true,
      user_metadata: { nombre: datos.data.nombre },
    });
    if (esCorreoRepetido(error)) return { ok: false, error: YA_REGISTRADO };
    if (error) throw error;

    if (datos.data.telefono) {
      await ejecutarRpc("guardar_perfil_usuario", {
        p_id: data.user.id,
        p_nombre: datos.data.nombre,
        p_telefono: datos.data.telefono,
      });
    }

    await enviarEnlaceInvitacion(datos.data.correo, "usuario", datos.data.nombre);
    revalidarPerfiles("usuario");
    return {
      ok: true,
      mensaje: `Invitación enviada a ${datos.data.correo}. La cuenta queda inactiva hasta que la actives.`,
    };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}

export async function editarUsuario(entrada: EntradaEdicionUsuario): Promise<ResultadoPerfil> {
  const datos = esquemaEdicionUsuario.safeParse(entrada);
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Revisa los datos." };

  try {
    // La RPC convierte la cadena vacía en NULL (nullif + btrim): así se vacía
    // el teléfono sin pelear con el tipo generado, que no admite null.
    await ejecutarRpc("guardar_perfil_usuario", {
      p_id: datos.data.id,
      p_nombre: datos.data.nombre,
      p_telefono: datos.data.telefono ?? "",
    });
    revalidarPerfiles("usuario", datos.data.id);
    return { ok: true, mensaje: "Datos actualizados." };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}

export async function activarUsuario(id: string): Promise<ResultadoPerfil> {
  try {
    await ejecutarRpc("activar_usuario", { p_id: id });
    revalidarPerfiles("usuario", id);
    return { ok: true, mensaje: "Cuenta activada: el titular ya puede entrar a su cuenta." };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}

export async function desactivarUsuario(id: string): Promise<ResultadoPerfil> {
  try {
    await ejecutarRpc("desactivar_usuario", { p_id: id });
    revalidarPerfiles("usuario", id);
    return { ok: true, mensaje: "Cuenta desactivada. Sus datos se conservan." };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}

/** Vuelve a mandar el enlace para fijar contraseña a un titular existente. */
export async function reenviarEnlaceUsuario(id: string): Promise<ResultadoPerfil> {
  try {
    await exigirAdmin();
    const { data, error } = await crearClienteAdmin().auth.admin.getUserById(id);
    if (error || !data.user?.email) return { ok: false, error: "Esa cuenta no existe en Auth." };

    await enviarInvitacion(data.user.email, "usuario", nombreDe(data.user));
    return { ok: true, mensaje: "Enlace enviado." };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}
