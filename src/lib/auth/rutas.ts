/**
 * Rutas del panel y del área de cuenta. Sin `server-only`: las lee también el
 * middleware, que corre en el runtime edge y no puede importar `next/headers`.
 */

/** Página de acceso al panel (administradores). */
export const RUTA_LOGIN = "/admin/login";
/** A dónde se entra tras iniciar sesión de administrador si no había destino guardado. */
export const RUTA_PANEL = "/admin";

/** Puerta de acceso de los usuarios (deportistas y acudientes). */
export const RUTA_ACCESO_USUARIO = "/cuenta/acceso";
/** Raíz del área de usuario. */
export const RUTA_CUENTA = "/cuenta";
/** Recuperación de contraseña de la cuenta de usuario. */
export const RUTA_RECUPERAR_USUARIO = "/cuenta/recuperar";
/** Nueva contraseña de la cuenta de usuario, tras el enlace. */
export const RUTA_RESTABLECER_USUARIO = "/cuenta/restablecer";

/**
 * Rutas bajo /admin que no exigen sesión: el acceso, la recuperación de
 * contraseña y el retorno del enlace de recuperación.
 */
export const RUTAS_ADMIN_PUBLICAS = [RUTA_LOGIN, "/admin/recuperar", "/admin/auth/"] as const;

/**
 * Rutas bajo /cuenta que no exigen sesión: la puerta de acceso, la
 * recuperación y el retorno del enlace. /cuenta/restablecer NO es pública:
 * llega con la sesión que abrió el enlace, igual que en el panel.
 */
export const RUTAS_CUENTA_PUBLICAS = [
  RUTA_ACCESO_USUARIO,
  RUTA_RECUPERAR_USUARIO,
  "/cuenta/auth/",
] as const;

export function esRutaAdminPublica(ruta: string): boolean {
  return RUTAS_ADMIN_PUBLICAS.some((publica) =>
    publica.endsWith("/") ? ruta.startsWith(publica) : ruta === publica,
  );
}

export function esRutaCuentaPublica(ruta: string): boolean {
  return RUTAS_CUENTA_PUBLICAS.some((publica) =>
    publica.endsWith("/") ? ruta.startsWith(publica) : ruta === publica,
  );
}
