import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { cuentasHabilitadas } from "@/lib/auth/rutas";

export const metadata: Metadata = {
  title: { default: "Acceso a mi cuenta", template: "%s | Mi cuenta TSW" },
  robots: { index: false, follow: false },
};

/**
 * Páginas de acceso de la cuenta de usuario: una tarjeta centrada, sin la
 * cabecera del área ("Salir", aviso de datos de muestra) que solo tiene
 * sentido con sesión. Espejo de src/app/admin/(auth)/layout.tsx.
 */
export default function LayoutAccesoCuenta({ children }: { children: ReactNode }) {
  // Segunda capa del apagado de /cuenta/* (la primera es el middleware).
  if (!cuentasHabilitadas()) notFound();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-gris-frio px-4 py-10">
      <Link
        href="/"
        className="mb-6 font-display text-3xl tracking-tight text-azul-profundo focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
      >
        TSW
        <span className="ml-2 text-xs font-normal uppercase tracking-[0.2em] text-texto-sec">Mi cuenta</span>
      </Link>
      <div className="w-full max-w-md rounded-lg border border-gris-borde bg-blanco p-6 sm:p-8">{children}</div>
    </main>
  );
}
