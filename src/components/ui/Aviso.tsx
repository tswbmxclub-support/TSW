import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TonoAviso = "error" | "exito" | "aviso" | "info";

const TONOS: Record<TonoAviso, string> = {
  error: "border-error/40 bg-error-fondo text-error",
  exito: "border-exito/30 bg-exito-fondo text-exito",
  aviso: "border-aviso/30 bg-aviso-fondo text-aviso",
  info: "border-gris-borde bg-gris-frio text-azul-profundo",
};

/** Color del borde lateral de la variante destacada, por tono. */
const BORDE_LATERAL: Record<TonoAviso, string> = {
  error: "border-l-error",
  exito: "border-l-exito",
  aviso: "border-l-aviso",
  info: "border-l-azul-profundo",
};

export type AvisoProps = {
  tono?: TonoAviso;
  titulo?: string;
  children: ReactNode;
  /**
   * `linea`: mensaje en línea de formulario o de sección.
   * `destacado`: bloque de página con borde lateral grueso, título en
   * display y una acción a la derecha; para avisos que gobiernan un proceso
   * (la radicación presencial de matrículas).
   */
  variante?: "linea" | "destacado";
  /** Botón o enlace a la derecha en escritorio, debajo en móvil. Solo en `destacado`. */
  accion?: ReactNode;
  className?: string;
};

/**
 * Mensaje en línea: error de un formulario, confirmación de guardado,
 * advertencia antes de una acción. `role="alert"` en error para que el lector
 * de pantalla lo anuncie; `status` en los demás.
 */
export function Aviso({ tono = "info", titulo, children, variante = "linea", accion, className }: AvisoProps) {
  const rol = tono === "error" ? "alert" : "status";

  if (variante === "destacado") {
    return (
      <div
        role={rol}
        className={cn(
          "flex flex-col gap-4 rounded-lg border border-l-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between",
          TONOS[tono],
          BORDE_LATERAL[tono],
          className,
        )}
      >
        <div className="min-w-0">
          {titulo && <p className="font-display text-lg uppercase leading-tight sm:text-xl">{titulo}</p>}
          <div className={cn("text-base", titulo && "mt-2")}>{children}</div>
        </div>
        {accion && <div className="shrink-0">{accion}</div>}
      </div>
    );
  }

  return (
    <div role={rol} className={cn("rounded-md border px-4 py-3 text-sm", TONOS[tono], className)}>
      {titulo && <p className="font-semibold">{titulo}</p>}
      <div className={cn(titulo && "mt-1")}>{children}</div>
    </div>
  );
}
