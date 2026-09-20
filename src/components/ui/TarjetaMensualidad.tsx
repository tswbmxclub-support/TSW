import { formatearPrecio } from "@/lib/utils";
import { Card } from "./Card";
import { ChipEstado } from "./ChipEstado";
import { cn } from "@/lib/utils";

export type EstadoMensualidad = "pagada" | "pendiente" | "vencida";

export type TarjetaMensualidadProps = {
  mes: string;
  estado: EstadoMensualidad;
  /**
   * Monto en centavos, o null mientras el esquema no lo tenga. null se
   * muestra como "[MONTO]": nunca un número inventado.
   */
  montoCentavos: number | null;
  /** Fecha de pago (pagada) o de vencimiento (pendiente / vencida). */
  fecha: string;
  /** Nombre del deportista, cuando la lista mezcla varios. */
  deportista?: string;
  /** `destacada` para el mes actual del resumen; `compacta` para listas. */
  variante?: "compacta" | "destacada";
  className?: string;
};

const ETIQUETA_ESTADO: Record<EstadoMensualidad, "pagada" | "pendiente" | "vencida"> = {
  pagada: "pagada",
  pendiente: "pendiente",
  vencida: "vencida",
};

/**
 * Una mensualidad: mes, estado con ChipEstado, monto y fecha de pago o de
 * vencimiento. Compacta para el historial; destacada para el mes actual, con
 * borde rojo y superficie azul medio para que se distinga de un vistazo.
 *
 * El monto null muestra "[MONTO]": la regla del proyecto prohíbe inventar
 * cifras mientras la base no tenga la columna.
 */
export function TarjetaMensualidad({
  mes,
  estado,
  montoCentavos,
  fecha,
  deportista,
  variante = "compacta",
  className,
}: TarjetaMensualidadProps) {
  const destacada = variante === "destacada";

  const textoFecha =
    estado === "pagada" ? `Pagada el ${fecha}` : estado === "vencida" ? `Venció el ${fecha}` : `Paga antes del ${fecha}`;

  return (
    <Card
      oscura={destacada}
      className={cn("overflow-hidden", destacada && "border-rojo/60 shadow-md", className)}
    >
      <div className={cn("flex flex-col gap-3", destacada ? "p-5 sm:p-6" : "p-4")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {deportista && <p className={cn("text-sm", destacada ? "text-blanco/70" : "text-texto-sec")}>{deportista}</p>}
            <p
              className={cn(
                "font-display uppercase leading-tight",
                destacada ? "text-xl sm:text-2xl" : "text-lg",
              )}
            >
              {mes}
            </p>
          </div>
          <ChipEstado tipo="mensualidad" valor={ETIQUETA_ESTADO[estado]} />
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p
            className={cn(
              "font-display text-2xl leading-none",
              destacada ? "text-blanco" : "text-azul-profundo",
            )}
          >
            {montoCentavos === null ? "[MONTO]" : formatearSeguro(montoCentavos)}
          </p>
          <p className={cn("text-sm", destacada ? "text-blanco/80" : "text-texto-sec")}>{textoFecha}</p>
        </div>
      </div>
    </Card>
  );
}

/**
 * Puente mínimo mientras no existe la columna de precio en la base: si algún
 * día llega un número, sale por formatearPrecio, la única conversión de
 * precios de todo el sitio.
 */
function formatearSeguro(centavos: number): string {
  return formatearPrecio(centavos);
}
