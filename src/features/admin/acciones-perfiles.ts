"use server";

import { revalidatePath } from "next/cache";

import { exigirAdmin } from "@/lib/auth";
import { ErrorApp } from "@/lib/errors";
import { enviarInvitacion } from "@/lib/auth/enlaces";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { ejecutarRpc } from "./mutations";
import { estadoDeCuentaPorCorreo } from "./queries-perfiles";
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
 *    Un administrador se crea con `createUser`; un usuario, también, aunque
 *    antes fuera con `inviteUserByEmail`. El correo se confirma de oficio: lo
 *    escribió un administrador, no un desconocido.
 *
 *    El PERFIL no se deja al trigger (migración 15): GoTrue inserta la fila
 *    de auth.users y escribe app_metadata en un UPDATE posterior, así que en
 *    el INSERT el tipo todavía no está. El hook concilia en ese UPDATE, pero
 *    el alta de un administrador la pide esta acción, explícitamente y con
 *    actor, llamando a `crear_perfil_admin`.
 *
 *    Toda cuenta nace INACTIVA; activarla es un paso aparte y deliberado.
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
 * El rechazo de conciliar_perfil_de_cuenta cuando la cuenta ya tiene un
 * perfil de usuario ACTIVO (migración 15). Llega como check_violation sin
 * nombre de constraint, así que traducirErrorPostgres lo devuelve tal cual:
 * un texto correcto pero con el uuid dentro, que al administrador no le dice
 * nada. Se reconoce por su texto —es un mensaje nuestro, no de Postgres— y se
 * cambia por uno accionable.
 */
const PERFIL_USUARIO_ACTIVO = /perfil de usuario activo/i;
const YA_ES_USUARIO_ACTIVO =
  "Esa persona ya tiene una cuenta de usuario activa. Desactívala antes de darle acceso de administrador.";

/**
 * Por qué se rechazó un alta con correo repetido, en términos de lo que el
 * administrador puede hacer al respecto.
 *
 * «Ya existe una cuenta con ese correo.» es cierto y no sirve de nada: no dice
 * si esa persona ya es administradora, si está desactivada y basta con
 * activarla, o si tiene una cuenta de usuario por medio. La cuenta ya existe y
 * quien pregunta es un administrador con sesión, así que aquí no hay
 * enumeración de correos que proteger: la hay en las puertas de acceso, no en
 * el panel.
 */
async function motivoDeCorreoRepetido(correo: string): Promise<string> {
  const estado = await estadoDeCuentaPorCorreo(correo);
  if (!estado.existe) return YA_REGISTRADO;

  if (estado.tipo === "admin") {
    return estado.activo
      ? "Esa persona ya es administradora."
      : "Esa persona ya tiene cuenta de administrador, pero está inactiva. Actívala desde la lista.";
  }

  if (estado.tipo === "usuario") {
    // PENDIENTE (aprobado, va después del acceso por código): acción propia
    // «convertir en administradora» para este caso, con confirmación que diga
    // en palabras que se ELIMINA su perfil de usuario —no un "¿estás seguro?"
    // genérico—. La RPC ya sabe hacerlo: crear_perfil_admin migra un perfil
    // contrario inactivo (migración 15).
    //
    // Cuando existan `mensualidad` y `jersey` colgando de perfil_usuario, esa
    // acción tendrá que RECHAZAR si la persona tiene historial, aunque su
    // perfil esté inactivo: hoy «inactivo» equivale a «nunca se usó», y en
    // cuanto haya pagos registrados deja de equivaler. El ON DELETE CASCADE se
    // llevaría ese historial sin avisar. Anotado ahora, mientras el caso
    // todavía no puede ocurrir.
    return estado.activo
      ? YA_ES_USUARIO_ACTIVO
      : "Esa persona ya tiene una cuenta de usuario, hoy inactiva. Convertirla en administradora todavía no se hace desde el panel.";
  }

  return YA_REGISTRADO;
}

/**
 * Crea la cuenta de un administrador y le manda el enlace para fijar su
 * contraseña. Nace inactivo: hay que activarlo desde la lista cuando haya
 * fijado su contraseña. El correo se confirma de oficio: lo escribió un
 * administrador, no un desconocido.
 *
 * El perfil se pide explícitamente con `crear_perfil_admin` (migración 15) en
 * vez de confiar en el hook de Auth. La Admin API de GoTrue no escribe
 * app_metadata en el INSERT de auth.users —inserta primero y actualiza
 * después—, así que durante un instante la cuenta es de tipo usuario. El hook
 * arreglado la concilia en ese UPDATE, pero el alta de un administrador no
 * puede depender de en qué orden escriba sus columnas un proveedor externo:
 * aquí se dice, con actor y constancia en la bitácora.
 */
export async function invitarAdministrador(entrada: EntradaInvitacionAdmin): Promise<ResultadoPerfil> {
  const datos = esquemaInvitacionAdmin.safeParse(entrada);
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Revisa los datos." };

  try {
    await exigirAdmin();
    const supabase = crearClienteAdmin();

    const { data, error } = await supabase.auth.admin.createUser({
      email: datos.data.correo,
      email_confirm: true,
      app_metadata: { tipo: "admin" },
      user_metadata: { nombre: datos.data.nombre },
    });
    if (esCorreoRepetido(error)) {
      return { ok: false, error: await motivoDeCorreoRepetido(datos.data.correo) };
    }
    if (error) throw error;

    try {
      await ejecutarRpc("crear_perfil_admin", {
        p_id: data.user.id,
        p_nombre: datos.data.nombre,
      });
    } catch (errorPerfil) {
      // La cuenta de Auth ya existe y sin perfil de administrador no sirve
      // para nada: si se deja, el correo queda ocupado y el siguiente intento
      // choca con "Ya existe una cuenta con ese correo." Se deshace el alta
      // para que reintentar sea posible. El borrado arrastra el perfil por la
      // FK con ON DELETE CASCADE.
      await supabase.auth.admin.deleteUser(data.user.id);
      if (errorPerfil instanceof ErrorApp && PERFIL_USUARIO_ACTIVO.test(errorPerfil.message)) {
        return { ok: false, error: YA_ES_USUARIO_ACTIVO };
      }
      throw errorPerfil;
    }

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
    if (esCorreoRepetido(error)) {
      return { ok: false, error: await motivoDeCorreoRepetido(datos.data.correo) };
    }
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
