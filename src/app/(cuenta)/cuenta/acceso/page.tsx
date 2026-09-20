import type { Metadata } from "next";
import Link from "next/link";

import { FormularioAcceso } from "@/features/admin/components/FormularioAcceso";

export const metadata: Metadata = { title: "Acceso" };

/**
 * Puerta de los usuarios (deportistas y acudientes). Reutiliza el mismo
 * formulario del panel con otros textos y otro destino de recuperación; una
 * sesión de usuario nunca será sesión de administrador.
 *
 * La nota de tratamiento de datos va aquí y no en el formulario compartido:
 * la cuenta de usuario guarda datos de menores (Ley 1581) y el acudiente debe
 * saber, antes de entrar, bajo qué política se tratan.
 */
export default function PaginaAccesoUsuario() {
  return (
    <div className="mx-auto w-full max-w-md rounded-lg border border-gris-borde bg-blanco p-6 sm:p-8">
      <FormularioAcceso
        titulo="Acceso a mi cuenta"
        textoAyuda="Para deportistas y acudientes. Consulta mensualidades y jerseys."
        enlaceRecuperar="/cuenta/recuperar"
      />
      <p className="mt-6 border-t border-gris-borde pt-4 text-sm text-texto-sec">
        Al entrar aceptas la{" "}
        <Link
          href="/legal/datos"
          className="font-semibold text-azul-profundo underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rojo"
        >
          Política de tratamiento de datos
        </Link>
        . Los datos de los menores a tu cargo se tratan con la autorización que firmaste al matricularlos.
        [Ajustar el texto con el asesor jurídico del club.]
      </p>
    </div>
  );
}
