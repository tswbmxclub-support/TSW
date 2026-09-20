import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Aviso } from "@/components/ui";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: { default: "Mi cuenta", template: "%s | Mi cuenta TSW" },
  robots: { index: false, follow: false },
};

/**
 * Área de usuario. Cabecera pública ligera (logo, enlace Salir sin acción
 * todavía) y el pie compartido del sitio. En esta etapa no hay protección
 * real: el Aviso fijo de vista previa evita que nadie confunda estos datos
 * de muestra con información real.
 */
export default function LayoutCuenta({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-gris-frio">
      <header className="border-b border-blanco/10 bg-azul-profundo text-blanco">
        <div className="contenedor flex h-16 items-center justify-between">
          <Link
            href="/"
            className="flex min-h-[44px] items-center font-display text-2xl tracking-tight focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rojo"
          >
            TSW
            <span className="ml-2 text-xs font-normal uppercase tracking-[0.2em] text-blanco/60">Mi cuenta</span>
          </Link>

          {/* Sin acción todavía: la sesión de usuario llega en la siguiente etapa. */}
          <span
            aria-disabled="true"
            title="Disponible en la siguiente etapa"
            className="inline-flex min-h-[44px] cursor-not-allowed items-center rounded-md px-3 text-sm font-semibold text-blanco/60"
          >
            Salir
          </span>
        </div>
      </header>

      <main id="contenido" tabIndex={-1} className="contenedor flex-1 py-8 sm:py-10 lg:py-12">
        <Aviso tono="info" className="mb-6">
          Vista previa con datos de muestra.
        </Aviso>
        {children}
      </main>

      <Footer />
    </div>
  );
}
