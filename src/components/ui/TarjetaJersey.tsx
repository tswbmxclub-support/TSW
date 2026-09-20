import Link from "next/link";

import { Card } from "./Card";
import { ChipEstado } from "./ChipEstado";
import { cn } from "@/lib/utils";

export type EstadoJersey = "entregado" | "pendiente";

export type TarjetaJerseyProps = {
  /** Talla de la prenda, si ya está asignada; null = sin jersey todavía. */
  talla: string | null;
  estado: EstadoJersey;
  /** Fecha de entrega agendada, o null si no está. */
  fechaEntrega: string | null;
  /** Número o nombre impreso en la espalda, si aplica. */
  impresion?: string | null;
  className?: string;
};

/**
 * El jersey del deportista: talla, estado (entregado / pendiente), fecha de
 * entrega y estampado si aplica. Con `talla` en null muestra el estado vacío:
 * todavía no hay jersey asignado, y eso se dice tal cual en vez de esconder
 * la tarjeta.
 */
export function TarjetaJersey({ talla, estado, fechaEntrega, impresion, className }: TarjetaJerseyProps) {
  const sinJersey = talla === null;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg uppercase leading-tight">Jersey</h3>
          <ChipEstado tipo="jersey" valor={sinJersey ? "pendiente" : estado} />
        </div>

        {sinJersey ? (
          <p className="text-sm text-texto-sec">
            [Todavía no hay jersey asignado. Aparecerá aquí con su talla y fecha de entrega.]
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-texto-sec">Talla</dt>
              <dd className="font-semibold text-azul-profundo">{talla}</dd>
              {impresion && (
                <>
                  <dt className="text-texto-sec">Impreso</dt>
                  <dd className="font-semibold text-azul-profundo">{impresion}</dd>
                </>
              )}
              <dt className="text-texto-sec">{estado === "entregado" ? "Entregado el" : "Entrega"}</dt>
              <dd className="font-semibold text-azul-profundo">{fechaEntrega ?? "[FECHA DE ENTREGA]"}</dd>
            </dl>
          </>
        )}
      </div>
    </Card>
  );
}

/**
 * Cabecera de la cuenta: nombre del titular y, por cada deportista, deporte y
 * nivel. Server Component: es solo lectura.
 */
export type ResumenCuentaProps = {
  titular: string;
  deportistas: { nombre: string; deporte: string; nivel: string }[];
  /** Enlace opcional al historial completo de mensualidades. */
  enlaceHistorial?: { href: string; etiqueta: string };
  className?: string;
};

/** Cabecera del área de usuario: quién es y a quiénes cubre. */
export function ResumenCuenta({ titular, deportistas, enlaceHistorial, className }: ResumenCuentaProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-texto-sec">Titular de la cuenta</p>
            <p className="font-display text-xl uppercase leading-tight sm:text-2xl">{titular}</p>
          </div>
          {enlaceHistorial && (
            <Link
              href={enlaceHistorial.href}
              className="inline-flex min-h-[44px] items-center font-semibold text-rojo underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rojo"
            >
              {enlaceHistorial.etiqueta}
            </Link>
          )}
        </div>

        <ul className="flex flex-col gap-2">
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
      </div>
    </Card>
  );
}
