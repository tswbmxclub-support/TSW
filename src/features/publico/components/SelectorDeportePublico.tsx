"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { SelectorDeporte, type OpcionDeporte } from "@/components/ui";
import { enlaceConDeporte } from "../deporte-publico";

export type SelectorDeportePublicoProps = {
  deportes: OpcionDeporte[];
  /** Id del deporte activo, resuelto en el servidor desde `?deporte=`. */
  valor: string;
  /** Sobre el HeroPagina oscuro va la paleta oscura del selector. */
  fondo?: "oscuro" | "claro";
};

/**
 * Enlace entre el primitivo SelectorDeporte y las páginas públicas: elegir un
 * deporte navega a la misma ruta con `?deporte=<id>`. No usa useSearchParams
 * (obligaría a un Suspense en cada página); el valor llega del servidor.
 */
export function SelectorDeportePublico({ deportes, valor, fondo = "claro" }: SelectorDeportePublicoProps) {
  const router = useRouter();
  const ruta = usePathname();
  const [pendiente, iniciar] = useTransition();

  return (
    <div aria-busy={pendiente || undefined} className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-[0.15em] opacity-70">Deporte</span>
      <SelectorDeporte
        deportes={deportes}
        valor={valor}
        fondo={fondo}
        alCambiar={(id) => iniciar(() => router.push(enlaceConDeporte(ruta, id), { scroll: false }))}
      />
    </div>
  );
}
