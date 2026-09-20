import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type IndicadorProps = {
  etiqueta: string;
  /**
   * Número ya formateado (o un nodo como CuentaAscendente), o null cuando el
   * dato no existe todavía.
   */
  valor: ReactNode | null;
  /** Línea de contexto: "este mes", "esperando pago". */
  detalle?: ReactNode;
  /** Enlace a la sección que explica la cifra. */
  href?: string;
  /**
   * `panel`: tarjeta compacta del inicio del panel.
   * `cifra`: tarjeta pública de cifra grande (etiqueta arriba, número en
   * titular, texto de apoyo y barra de acento abajo), como la fila de cuatro
   * del rediseño. Sirve también para cupos: con `progreso` la barra se llena
   * en proporción.
   */
  variante?: "panel" | "cifra";
  /** Sobre azul profundo: superficie azul medio y texto blanco. */
  oscuro?: boolean;
  /**
   * Solo en `cifra`: porcentaje 0-100 que llena la barra inferior. Sin él la
   * barra es decorativa y va completa. Con null se muestra vacía y el
   * detalle debe explicar por qué.
   */
  progreso?: number | null;
  className?: string;
};

/**
 * Cifra clave. Con `valor` en null muestra "—" y el detalle explica por qué:
 * no se inventa un cero para que la cuadrícula quede bonita.
 */
export function Indicador({
  etiqueta,
  valor,
  detalle,
  href,
  variante = "panel",
  oscuro = false,
  progreso,
  className,
}: IndicadorProps) {
  const esCifra = variante === "cifra";
  const sinDato = valor === null;

  const contenido = (
    <>
      <p
        className={cn(
          "text-xs font-bold uppercase tracking-[0.15em]",
          oscuro ? "text-blanco/70" : esCifra ? "text-rojo-oscuro" : "text-texto-sec",
        )}
      >
        {etiqueta}
      </p>
      <p
        className={cn(
          "mt-2 font-display leading-none",
          oscuro ? "text-blanco" : "text-azul-profundo",
          esCifra ? "text-5xl sm:text-6xl" : "text-4xl sm:text-5xl",
        )}
      >
        {sinDato ? <span aria-label="Sin dato">—</span> : valor}
      </p>
      {detalle && (
        <p className={cn("mt-2 text-sm", oscuro ? "text-blanco/75" : "text-texto-sec", esCifra && "mt-3")}>
          {detalle}
        </p>
      )}
      {esCifra && <BarraProgreso progreso={progreso} sinDato={sinDato} oscuro={oscuro} />}
    </>
  );

  const base = cn(
    "block rounded-lg border p-5",
    oscuro ? "border-blanco/15 bg-azul-medio" : "border-gris-borde bg-blanco",
    esCifra && "flex flex-col p-6",
  );

  if (href) {
    return (
      <a
        href={href}
        className={cn(
          base,
          "transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rojo",
          oscuro ? "hover:border-blanco/40" : "hover:border-azul-medio",
          className,
        )}
      >
        {contenido}
      </a>
    );
  }

  return <div className={cn(base, className)}>{contenido}</div>;
}

/**
 * Barra inferior de la variante `cifra`. Sin `progreso` es un remate visual
 * completo; con un porcentaje se convierte en medidor (cupos ocupados) y
 * lleva `role="progressbar"` para que el lector de pantalla lo anuncie.
 */
function BarraProgreso({
  progreso,
  sinDato,
  oscuro,
}: {
  progreso: number | null | undefined;
  sinDato: boolean;
  oscuro: boolean;
}) {
  const pista = oscuro ? "bg-blanco/15" : "bg-gris-frio";

  if (progreso === undefined) {
    return <div aria-hidden="true" className="mt-5 h-1 w-full rounded-full bg-rojo" />;
  }

  const porcentaje = progreso === null || sinDato ? 0 : Math.min(100, Math.max(0, progreso));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progreso === null ? undefined : porcentaje}
      aria-valuetext={progreso === null ? "Sin dato" : `${porcentaje} %`}
      className={cn("mt-5 h-1.5 w-full overflow-hidden rounded-full", pista)}
    >
      <div className="h-full rounded-full bg-rojo transition-[width] duration-300" style={{ width: `${porcentaje}%` }} />
    </div>
  );
}
