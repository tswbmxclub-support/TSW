import type { Enums } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { Badge, type TonoBadge } from "./Badge";

type EstadoPedido = Enums<"estado_pedido">;
type EstadoPublicacion = Enums<"estado_publicacion">;

type Definicion = { etiqueta: string; tono: TonoBadge };

const PEDIDO: Record<EstadoPedido, Definicion> = {
  pendiente: { etiqueta: "Pendiente de pago", tono: "aviso" },
  pagado: { etiqueta: "Pagado", tono: "exito" },
  preparando: { etiqueta: "En preparación", tono: "oscuro" },
  entregado: { etiqueta: "Entregado", tono: "exito" },
  rechazado: { etiqueta: "Rechazado", tono: "acento" },
  expirado: { etiqueta: "Expirado", tono: "neutro" },
  cancelado: { etiqueta: "Cancelado", tono: "neutro" },
};

const PUBLICACION: Record<EstadoPublicacion, Definicion> = {
  borrador: { etiqueta: "Borrador", tono: "aviso" },
  publicado: { etiqueta: "Publicado", tono: "exito" },
  archivado: { etiqueta: "Archivado", tono: "neutro" },
};

const ACTIVO: Record<"true" | "false", Definicion> = {
  true: { etiqueta: "Activo", tono: "exito" },
  false: { etiqueta: "Inactivo", tono: "neutro" },
};

/** Máquinas de estado del módulo de usuario (cambio de alcance 2026-09-19). */
const MENSUALIDAD: Record<"pagada" | "pendiente" | "vencida", Definicion> = {
  pagada: { etiqueta: "Pagada", tono: "exito" },
  pendiente: { etiqueta: "Pendiente", tono: "aviso" },
  vencida: { etiqueta: "Vencida", tono: "acento" },
};

const JERSEY: Record<"entregado" | "pendiente", Definicion> = {
  entregado: { etiqueta: "Entregado", tono: "exito" },
  pendiente: { etiqueta: "Pendiente", tono: "aviso" },
};

export type ChipEstadoProps = {
  className?: string;
} & (
  | { tipo: "pedido"; valor: EstadoPedido }
  | { tipo: "publicacion"; valor: EstadoPublicacion }
  | { tipo: "activo"; valor: boolean }
  | { tipo: "mensualidad"; valor: "pagada" | "pendiente" | "vencida" }
  | { tipo: "jersey"; valor: "entregado" | "pendiente" }
);

/**
 * Estado de un registro con etiqueta en español y color fijo por valor. Las
 * tres máquinas de estado del sistema viven aquí para que "pagado" se vea
 * igual en la tabla de pedidos, en el detalle y en la bitácora.
 */
export function ChipEstado(props: ChipEstadoProps) {
  const definicion =
    props.tipo === "pedido"
      ? PEDIDO[props.valor]
      : props.tipo === "publicacion"
        ? PUBLICACION[props.valor]
        : props.tipo === "mensualidad"
          ? MENSUALIDAD[props.valor]
          : props.tipo === "jersey"
            ? JERSEY[props.valor]
            : ACTIVO[String(props.valor) as "true" | "false"];

  return (
    <Badge tono={definicion.tono} className={cn("gap-1.5", props.className)}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {definicion.etiqueta}
    </Badge>
  );
}

/** Etiquetas sueltas, para filtros y selects. */
export const ETIQUETA_ESTADO_PEDIDO = Object.fromEntries(
  Object.entries(PEDIDO).map(([k, v]) => [k, v.etiqueta]),
) as Record<EstadoPedido, string>;

export const ETIQUETA_ESTADO_PUBLICACION = Object.fromEntries(
  Object.entries(PUBLICACION).map(([k, v]) => [k, v.etiqueta]),
) as Record<EstadoPublicacion, string>;

export const ETIQUETA_ESTADO_MENSUALIDAD = Object.fromEntries(
  Object.entries(MENSUALIDAD).map(([k, v]) => [k, v.etiqueta]),
) as Record<"pagada" | "pendiente" | "vencida", string>;
