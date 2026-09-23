import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TonoBadge = "neutro" | "acento" | "exito" | "aviso" | "oscuro" | "solido" | "claro";

const TONOS: Record<TonoBadge, string> = {
  neutro: "bg-gris-frio text-texto-sec border-gris-borde",
  // Acento tenue: fondo al 10 % y texto en acento oscuro (6.61:1 sobre blanco).
  acento: "bg-acento-oscuro/10 text-acento-oscuro border-acento-oscuro/30",
  // Colores funcionales de globals.css. Medidos: exito 4.69:1, aviso 5.41:1.
  exito: "bg-exito-fondo text-exito border-exito/30",
  aviso: "bg-aviso-fondo text-aviso border-aviso/30",
  oscuro: "bg-azul-profundo text-blanco border-azul-profundo",
  // Acento sólido: solo sobre azul profundo, como chip de antetítulo. El texto
  // va en azul profundo y no en blanco (5.12:1 contra 3.36:1), y así el chip
  // también se separa del fondo marino, que es lo que el acento oscuro no hace.
  solido: "bg-acento text-azul-profundo border-acento",
  // Translúcido sobre azul profundo, para etiquetas secundarias del hero.
  claro: "bg-blanco/10 text-blanco border-blanco/25",
};

export type BadgeProps = {
  children: ReactNode;
  tono?: TonoBadge;
  className?: string;
};

export function Badge({ children, tono = "neutro", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        TONOS[tono],
        className,
      )}
    >
      {children}
    </span>
  );
}
