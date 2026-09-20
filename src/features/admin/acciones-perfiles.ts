"use server";

import { revalidatePath } from "next/cache";

import { exigirAdmin } from "@/lib/auth";
import { ErrorApp } from "@/lib/errors";
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
 *    El trigger `crear_perfil_al_registrar` decide el tipo de perfil por
 *    `app_metadata.tipo` en el INSERT, y `inviteUserByEmail` no acepta
 *    app_metadata: por eso un administrador se crea con `createUser` (que sí
 *    lo acepta) y recibe después el enlace para fijar su contraseña; un
 *    usuario se crea con `inviteUserByEmail`, que deja el tipo por defecto.
 *    Toda cuenta nace INACTIVA; activarla es un paso aparte y deliberado.
 *
 *  · Editar, activar y desactivar perfiles: RPC de la migración 13 con
 *    p_actor_id, como toda escritura del panel. Nunca UPDATE directo.
 *
 * Los enlaces de invitación y recuperación llegan por correo con el
 * `token_hash` de Supabase y se canjean en /admin/auth/callback o
 * /cuenta/auth/callback (`verifyOtp`). Las plantillas de correo de Supabase
 * deben apuntar a esos callbacks: ver el comentario del callback.
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

function sitio(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Manda el correo de "fija tu contraseña" a la puerta que corresponda. */
async function enviarEnlaceContrasena(correo: string, tipo: "admin" | "usuario"): Promise<void> {
  const callback =
    tipo === "admin"
      ? `${sitio()}/admin/auth/callback?siguiente=/admin/restablecer`
      : `${sitio()}/cuenta/auth/callback?siguiente=/cuenta/restablecer`;

  const { error } = await crearClienteAdmin().auth.resetPasswordForEmail(correo, { redirectTo: callback });
  if (error) {
    console.error("[enlace de contraseña]", error.message);
    throw new ErrorApp(
      "La cuenta quedó creada pero el correo no salió. Usa «Reenviar enlace» en unos minutos.",
      "servicio_externo",
      502,
    );
  }
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

    await enviarEnlaceContrasena(datos.data.correo, "admin");
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

    await enviarEnlaceContrasena(data.user.email, "admin");
    return { ok: true, mensaje: "Enlace enviado." };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}

// --- Usuarios (titulares de cuenta) ------------------------------------------

/**
 * Invita a un titular. `inviteUserByEmail` crea la cuenta y manda el correo
 * en un solo paso; el trigger crea perfil_usuario con el nombre que viaja en
 * `data`. El teléfono no cabe en la invitación, así que se guarda después
 * por la RPC, con el actor.
 */
export async function invitarUsuario(entrada: EntradaInvitacionUsuario): Promise<ResultadoPerfil> {
  const datos = esquemaInvitacionUsuario.safeParse(entrada);
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Revisa los datos." };

  try {
    await exigirAdmin();
    const supabase = crearClienteAdmin();

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(datos.data.correo, {
      data: { nombre: datos.data.nombre },
      redirectTo: `${sitio()}/cuenta/auth/callback?siguiente=/cuenta/restablecer`,
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

    await enviarEnlaceContrasena(data.user.email, "usuario");
    return { ok: true, mensaje: "Enlace enviado." };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}
