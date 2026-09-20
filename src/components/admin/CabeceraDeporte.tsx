"use client";

import { useTransition } from "react";

import { SelectorDeporte, type OpcionDeporte } from "@/components/ui";
import { elegirDeporte } from "@/features/cuenta/acciones-vista-previa";

export type CabeceraDeporteProps = {
  deportes: OpcionDeporte[];
  valor: string;
};

/**
 * Enlace entre el primitivo SelectorDeporte y el panel: al cambiar, llama a la
 * Server Action que fija la cookie tsw.deporte y revalida. El botón se queda
 * en estado de carga durante la transición.
 */
export function CabeceraDeporte({ deportes, valor }: CabeceraDeporteProps) {
  const [pendiente, iniciar] = useTransition();

  return (
    <div aria-busy={pendiente || undefined}>
      <SelectorDeporte
        deportes={deportes}
        valor={valor}
        alCambiar={(id) => iniciar(async () => void (await elegirDeporte(id)))}
        fondo="oscuro"
      />
    </div>
  );
}
