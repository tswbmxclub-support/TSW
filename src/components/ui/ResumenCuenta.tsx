import Link from "next/link";

import { Badge } from "./Badge";
import { Card } from "./Card";
import { cn } from "@/lib/utils";

export type DeportistaResumen = { nombre: string; deporte: string; nivel: string };

export type ResumenCuentaProps = {
  titular: string;
  deportistas: DeportistaResumen[];
  /**
   * `acudiente`: el titular representa a uno o varios menores; se listan
   * aparte. `deportista`: el titular es el propio deportista adulto y su
   * ficha va en la cabecera, sin lista. Cambia el layout y el texto, no los
   * datos: por eso es una prop y no dos componentes.
   */
  modo?: "acudiente" | "deportista";
  /** Enlace opcional al historial completo de mensualidades. */
  enlaceHistorial?: { href: string; etiqueta: string };
  className?: string;
};

/**
 * Cabecera del área de usuario: quién es y a quiénes cubre. Server Component,
 * solo lectura. Con la lista de deportistas vacía dice que no hay ninguno
 * asociado, en lugar de mostrar una tarjeta sin cuerpo.
 */
export function ResumenCuenta({
  titular,
  deportistas,
  modo = "acudiente",
  enlaceHistorial,
  className,
}: ResumenCuentaProps) {
  const esDeportista = modo === "deportista";
  const propio = esDeportista ? deportistas[0] : undefined;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-texto-sec">{esDeportista ? "Deportista" : "Titular de la cuenta"}</p>
            <p className="font-display text-xl uppercase leading-tight sm:text-2xl">{titular}</p>
            {propio && (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-texto-sec">
                <Badge tono="oscuro">{propio.deporte}</Badge>
                <span>{propio.nivel}</span>
              </p>
            )}
          </div>
          {enlaceHistorial && (
            <Link
              href={enlaceHistorial.href}
              className="inline-flex min-h-[44px] items-center font-semibold text-acento-oscuro underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
            >
              {enlaceHistorial.etiqueta}
            </Link>
          )}
        </div>

        {!esDeportista &&
          (deportistas.length === 0 ? (
            <p className="rounded-md border-2 border-dashed border-gris-borde px-4 py-3 text-sm text-texto-sec">
              Todavía no hay deportistas asociados a esta cuenta. [El club los vincula al radicar la matrícula.]
            </p>
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Deportistas a cargo">
              {deportistas.map((deportista, indice) => (
                <li
                  key={`${deportista.nombre}-${indice}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-gris-frio px-4 py-3"
                >
                  <span className="font-semibold text-azul-profundo">{deportista.nombre}</span>
                  <span aria-hidden="true" className="hidden text-gris-borde sm:inline">
                    •
                  </span>
                  <span className="text-sm text-texto-sec">{deportista.deporte}</span>
                  <span className="text-sm text-texto-sec">· {deportista.nivel}</span>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </Card>
  );
}
