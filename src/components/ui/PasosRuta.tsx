import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PasoRuta = {
  id: string;
  /** "01", "02"… Se muestra grande, en display. */
  numero: string;
  /** Etiqueta corta arriba a la derecha: "Descarga", "Presencial". */
  etiqueta?: string;
  titulo: string;
  texto: ReactNode;
  /** Remate al pie: "Impresión requerida", "Solo en sede". */
  pie?: string;
};

export type PasosRutaProps = {
  pasos: PasoRuta[];
  /** Nombre de la lista para lectores de pantalla. */
  etiqueta: string;
  /** Sobre azul profundo. */
  oscuro?: boolean;
  className?: string;
};

/**
 * Hoja de ruta en tarjetas numeradas: una columna en móvil, dos en tablet y
 * tantas como pasos en escritorio (hasta cuatro). Es una `<ol>`: el orden es
 * parte del contenido, no solo del diseño.
 *
 * Difiere de SelectorDetalle en que aquí no hay nada que elegir: los cuatro
 * pasos se leen de corrido. Para procesos con detalle largo por paso, sigue
 * siendo SelectorDetalle.
 */
export function PasosRuta({ pasos, etiqueta, oscuro = false, className }: PasosRutaProps) {
  return (
    <ol
      aria-label={etiqueta}
      className={cn(
        "grid gap-4 sm:grid-cols-2",
        pasos.length >= 4 ? "xl:grid-cols-4" : pasos.length === 3 ? "lg:grid-cols-3" : "",
        className,
      )}
    >
      {pasos.map((paso) => (
        <li
          key={paso.id}
          className={cn(
            "flex flex-col rounded-lg border p-5",
            oscuro ? "border-blanco/15 bg-azul-medio text-blanco" : "border-gris-borde bg-blanco text-azul-profundo",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <span aria-hidden="true" className="font-display text-4xl leading-none text-rojo sm:text-5xl">
              {paso.numero}
            </span>
            {paso.etiqueta && (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
                  oscuro ? "bg-blanco/10 text-blanco/85" : "bg-gris-frio text-texto-sec",
                )}
              >
                {paso.etiqueta}
              </span>
            )}
          </div>
          <h3 className="mt-4 text-lg leading-tight">
            <span className="sr-only">Paso {paso.numero}: </span>
            {paso.titulo}
          </h3>
          <div className={cn("mt-2 flex-1 text-sm", oscuro ? "text-blanco/80" : "text-texto-sec")}>{paso.texto}</div>
          {paso.pie && (
            <p className={cn("mt-4 text-xs font-bold uppercase tracking-wide", oscuro ? "text-blanco/85" : "text-rojo-oscuro")}>
              {paso.pie}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
