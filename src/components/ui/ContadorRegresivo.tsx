"use client";

import { useEffect, useState } from "react";

import { useMovimientoReducido } from "@/lib/animaciones";
import { cn } from "@/lib/utils";

export type ContadorRegresivoProps = {
  /** Fecha objetivo en ISO. Null cuando no hay competencia futura. */
  hasta: string | null;
  /** Qué se está esperando, para el lector de pantalla: "la II válida". */
  etiqueta: string;
  /** Sobre azul profundo. */
  oscuro?: boolean;
  /** Texto del estado vacío. */
  textoVacio?: string;
  className?: string;
};

type Restante = { dias: number; horas: number; minutos: number; segundos: number };

function calcular(hasta: string): Restante | null {
  const diferencia = new Date(hasta).getTime() - Date.now();
  if (Number.isNaN(diferencia) || diferencia <= 0) return null;
  const total = Math.floor(diferencia / 1000);
  return {
    dias: Math.floor(total / 86_400),
    horas: Math.floor((total % 86_400) / 3_600),
    minutos: Math.floor((total % 3_600) / 60),
    segundos: total % 60,
  };
}

const dosCifras = (n: number) => String(n).padStart(2, "0");

/**
 * Cuenta regresiva a una fecha, en cuatro casillas. El primer render, en
 * servidor y en cliente, no muestra números: la hora del servidor y la del
 * navegador difieren y pintarlos produciría un fallo de hidratación. Los
 * dígitos aparecen al montar.
 *
 * Con movimiento reducido el reloj se actualiza cada minuto, no cada
 * segundo: un número cambiando sin parar es movimiento aunque no anime. Con
 * `hasta` en null o en el pasado muestra el estado vacío en vez de ceros.
 */
export function ContadorRegresivo({
  hasta,
  etiqueta,
  oscuro = false,
  textoVacio = "Sin próxima competencia programada.",
  className,
}: ContadorRegresivoProps) {
  const reducido = useMovimientoReducido();
  const [restante, setRestante] = useState<Restante | null | "sin-montar">("sin-montar");

  useEffect(() => {
    if (!hasta) {
      setRestante(null);
      return;
    }
    setRestante(calcular(hasta));
    const intervalo = window.setInterval(() => setRestante(calcular(hasta)), reducido ? 60_000 : 1_000);
    return () => window.clearInterval(intervalo);
  }, [hasta, reducido]);

  if (restante === null) {
    return (
      <p role="status" className={cn("text-sm font-semibold", oscuro ? "text-blanco/80" : "text-texto-sec", className)}>
        {textoVacio}
      </p>
    );
  }

  const montado = restante !== "sin-montar";
  const casillas: { clave: keyof Restante; nombre: string }[] = [
    { clave: "dias", nombre: "Días" },
    { clave: "horas", nombre: "Horas" },
    { clave: "minutos", nombre: "Minutos" },
    { clave: "segundos", nombre: "Segundos" },
  ];

  return (
    <div className={className}>
      <p className="sr-only" aria-live={reducido ? "off" : "polite"} aria-atomic="true">
        {montado
          ? `Faltan ${restante.dias} días, ${restante.horas} horas y ${restante.minutos} minutos para ${etiqueta}.`
          : `Cuenta regresiva para ${etiqueta}.`}
      </p>
      <ul aria-hidden="true" className="grid grid-cols-4 gap-2 sm:gap-3">
        {casillas.map((casilla, indice) => (
          <li
            key={casilla.clave}
            className={cn(
              "flex flex-col items-center rounded-lg border px-2 py-3 sm:py-4",
              oscuro ? "border-blanco/15 bg-azul-medio text-blanco" : "border-gris-borde bg-blanco text-azul-profundo",
              // El último bloque lleva el acento, como en el rediseño: es el que
              // se mueve. Sobre azul medio el acento oscuro no alcanza
              // contraste (2.19:1), así que allí va el acento claro como
              // borde inferior.
              indice === casillas.length - 1 && oscuro && "border-b-4 border-b-acento",
            )}
          >
            <span
              className={cn(
                "font-display text-3xl leading-none tabular-nums sm:text-4xl lg:text-5xl",
                indice === casillas.length - 1 && !oscuro && "text-acento-oscuro",
              )}
            >
              {montado ? dosCifras(restante[casilla.clave]) : "--"}
            </span>
            <span className={cn("mt-1.5 text-[11px] font-bold uppercase tracking-wide sm:text-xs", oscuro ? "text-blanco/70" : "text-texto-sec")}>
              {casilla.nombre}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
