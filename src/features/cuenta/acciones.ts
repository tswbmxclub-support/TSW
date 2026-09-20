"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  RUTA_ACCESO_USUARIO,
  RUTA_RECUPERAR_USUARIO,
  RUTA_RESTABLECER_USUARIO,
} from "@/lib/auth/rutas";
import { destinoSeguro } from "@/lib/auth/sesion";
import { obtenerUsuario } from "@/lib/auth/sesion";
import { registrarAcierto, registrarFallo, segundosDeBloqueo } from "@/lib/auth/limite";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  esquemaAcceso,
  esquemaNuevaContrasena,
  esquemaRecuperacion,
  type EntradaAcceso,
  type EntradaNuevaContrasena,
  type EntradaRecuperacion,
} from "@/features/admin/schemas";
import type { ResultadoAccion } from "@/features/admin/acciones";

/**
 * Server Actions de la puerta de usuario (/cuenta/acceso). Espejo de las del
 * panel (features/admin/acciones.ts) con tres diferencias: el perfil exigido
 * es perfil_usuario ACTIVO, el destino seguro vive bajo /cuenta, y el enlace
 * de recuperación vuelve por /cuenta/auth/callback. El mensaje de credenciales
 * es el mismo en las dos puertas: ni se revela si el correo existe ni de qué
 * tipo es la cuenta.
 *
 * Los helpers `camposDeZod` e `ipDelCliente` son iguales a los del panel: se
 * duplican a propósito para no acoplar las dos features; si crecen, migran a
 * src/lib.
 */

/** Mismo mensaje para usuario inexistente y contraseña errada: no se enumeran usuarios. */
const CREDENCIALES_INCORRECTAS = "Credenciales incorrectas.";

function camposDeZod(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const campos: Record<string, string> = {};
  for (const problema of error.issues) {
    const clave = String(problema.path[0] ?? "_");
    campos[clave] ??= problema.message;
  }
  return campos;
}

async function ipDelCliente(): Promise<string> {
  const cabeceras = await headers();
  return (
    cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    cabeceras.get("x-real-ip") ||
    "desconocida"
  );
}

/** Inicio de sesión del área de cuenta. Exige perfil_usuario ACTIVO. */
export async function iniciarSesionUsuario(entrada: EntradaAcceso): Promise<ResultadoAccion> {
  const datos = esquemaAcceso.safeParse(entrada);
  if (!datos.success) {
    return { ok: false, error: "Revisa los datos.", campos: camposDeZod(datos.error) };
  }

  const clave = `cuenta|${await ipDelCliente()}|${datos.data.correo.toLowerCase()}`;
  const bloqueo = segundosDeBloqueo(clave);
  if (bloqueo > 0) {
    const minutos = Math.ceil(bloqueo / 60);
    return {
      ok: false,
      error: `Demasiados intentos. Espera ${minutos} ${minutos === 1 ? "minuto" : "minutos"} antes de volver a intentar.`,
    };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: datos.data.correo,
    password: datos.data.contrasena,
  });

  if (error) {
    registrarFallo(clave);
    return { ok: false, error: CREDENCIALES_INCORRECTAS };
  }

  // Puerta exclusiva de usuarios: perfil_usuario ACTIVO, vía la RPC es_usuario()
  // (security definer: ve la verdad aunque RLS aún no deje leer nada).
  const { data: esUsuario } = await supabase.rpc("es_usuario");
  if (!esUsuario) {
    await supabase.auth.signOut();
    return { ok: false, error: CREDENCIALES_INCORRECTAS };
  }

  registrarAcierto(clave);
  redirect(destinoSeguro(datos.data.redirigir, "usuario"));
}

/** Cierra la sesión y vuelve a la puerta de /cuenta. */
export async function cerrarSesionUsuario(): Promise<void> {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect(RUTA_ACCESO_USUARIO);
}

/**
 * Envía el enlace de recuperación de una cuenta de usuario. La respuesta es la
 * misma exista o no el correo. El enlace vuelve por /cuenta/auth/callback, que
 * canjea el código y lleva a /cuenta/restablecer: nunca al panel.
 */
export async function solicitarRecuperacionUsuario(
  entrada: EntradaRecuperacion,
): Promise<ResultadoAccion> {
  const datos = esquemaRecuperacion.safeParse(entrada);
  if (!datos.success) {
    return { ok: false, error: "Revisa los datos.", campos: camposDeZod(datos.error) };
  }

  const clave = `cuenta-recuperar|${await ipDelCliente()}`;
  if (segundosDeBloqueo(clave) > 0) {
    return { ok: false, error: "Demasiadas solicitudes. Espera unos minutos." };
  }
  registrarFallo(clave);

  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(datos.data.correo, {
    redirectTo: `${sitio}${RUTA_RECUPERAR_USUARIO.replace("/recuperar", "/auth/callback")}?siguiente=${encodeURIComponent(RUTA_RESTABLECER_USUARIO)}`,
  });

  if (error) {
    console.error("[recuperación de cuenta de usuario]", error.message);
  }

  return {
    ok: true,
    mensaje: "Si el correo corresponde a una cuenta de usuario, recibirás un enlace en unos minutos.",
  };
}

/**
 * Fija la nueva contraseña. Solo exige sesión, no perfil activo: el
 * restablecimiento es justamente el paso ANTES de la activación de una cuenta
 * invitada.
 */
export async function restablecerContrasenaUsuario(
  entrada: EntradaNuevaContrasena,
): Promise<ResultadoAccion> {
  const datos = esquemaNuevaContrasena.safeParse(entrada);
  if (!datos.success) {
    return { ok: false, error: "Revisa los datos.", campos: camposDeZod(datos.error) };
  }

  const sesion = await obtenerUsuario();
  if (!sesion) {
    return { ok: false, error: "El enlace de recuperación venció. Solicita uno nuevo." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: datos.data.contrasena });
  if (error) {
    return { ok: false, error: "No se pudo cambiar la contraseña. Solicita un enlace nuevo e inténtalo otra vez." };
  }

  return { ok: true, mensaje: "Contraseña actualizada." };
}
