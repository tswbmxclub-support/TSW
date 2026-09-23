import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Aviso } from "@/components/ui";
import { RUTA_CUENTA, RUTA_PANEL, obtenerPerfil } from "@/lib/auth";
import { iniciarSesionUsuario } from "@/features/cuenta/acciones";
import { FormularioAcceso } from "@/features/admin/components/FormularioAcceso";

export const metadata: Metadata = { title: "Acceso" };

/**
 * Puerta de los usuarios (deportistas y acudientes). Reutiliza el formulario
 * del panel con la acción de cuenta: una sesión de usuario nunca será sesión
 * de administrador. La nota de tratamiento de datos va aquí y no en el
 * formulario compartido: la cuenta de usuario guarda datos de menores
 * (Ley 1581) y el acudiente debe saber, antes de entrar, bajo qué política se
 * tratan.
 */
export default async function PaginaAccesoUsuario({
  searchParams,
}: {
  searchParams: Promise<{ redirigir?: string; inactivo?: string }>;
}) {
  const { redirigir, inactivo } = await searchParams;

  // Un administrador que llega a la puerta de usuario: al panel. Un usuario
  // ACTIVO con sesión: a su cuenta. Un usuario inactivo con sesión (acaba de
  // fijar su contraseña desde el enlace de invitación) se queda aquí con el
  // aviso: mandarlo a /cuenta lo devolvería a esta puerta en bucle, porque
  // exigirUsuarioPagina rechaza perfiles inactivos.
  const sesion = await obtenerPerfil();
  if (sesion?.tipo === "admin") redirect(RUTA_PANEL);
  if (sesion?.tipo === "usuario" && sesion.perfil.activo) redirect(RUTA_CUENTA);
  const cuentaInactiva = Boolean(inactivo) || sesion?.tipo === "usuario";

  return (
    <>
      {cuentaInactiva && (
        <Aviso tono="info" className="mb-5">
          Tu cuenta está creada pero todavía no está activa. El club la activa cuando
          confirma tu matrícula; inténtalo de nuevo más tarde.
        </Aviso>
      )}
      <FormularioAcceso
        redirigir={redirigir}
        titulo="Acceso a mi cuenta"
        textoAyuda="Para deportistas y acudientes. Consulta mensualidades y jerseys."
        enlaceRecuperar="/cuenta/recuperar"
        accion={iniciarSesionUsuario}
      />
      <p className="mt-6 border-t border-gris-borde pt-4 text-sm text-texto-sec">
        Al entrar aceptas la{" "}
        <Link
          href="/legal/datos"
          className="font-semibold text-azul-profundo underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
        >
          Política de tratamiento de datos
        </Link>
        . Los datos de los menores a tu cargo se tratan con la autorización que firmaste al matricularlos.
        [Ajustar el texto con el asesor jurídico del club.]
      </p>
    </>
  );
}
