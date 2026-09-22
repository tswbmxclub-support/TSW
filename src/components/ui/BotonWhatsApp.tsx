import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import { Boton, type FondoBoton, type TamanoBoton, type VarianteBoton } from "./Boton";

export type BotonWhatsAppProps = {
  /** Texto que llega escrito en el chat. Sin texto, abre la conversación vacía. */
  texto?: string;
  children: ReactNode;
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
  fondo?: FondoBoton;
  completo?: boolean;
  className?: string;
};

/** Color del aviso "no configurado" según el fondo, para que se lea. */
const AVISO_POR_FONDO: Record<FondoBoton, string> = {
  claro: "text-texto-sec",
  oscuro: "text-blanco/80",
  acento: "text-blanco/90",
};

/**
 * Botón que abre WhatsApp. Único punto de entrada a `enlaceWhatsApp`, sirve
 * tanto para el contacto genérico como para enviar un pedido. Abre en pestaña
 * nueva con `rel="noopener noreferrer"` (lo pone Boton con `externo`).
 *
 * Sin número configurado, el botón queda deshabilitado con un aviso: nunca
 * un enlace roto.
 */
export function BotonWhatsApp({
  texto,
  children,
  variante = "primario",
  tamano = "md",
  fondo = "claro",
  completo,
  className,
}: BotonWhatsAppProps) {
  const enlace = enlaceWhatsApp(texto);

  if (enlace === null) {
    return (
      <div className={cn("flex flex-col gap-2", completo && "w-full", className)}>
        <Boton disabled variante={variante} tamano={tamano} fondo={fondo} completo={completo}>
          {children}
        </Boton>
        <p role="status" className={cn("text-sm", AVISO_POR_FONDO[fondo])}>
          WhatsApp no configurado.
        </p>
      </div>
    );
  }

  return (
    <Boton href={enlace} externo variante={variante} tamano={tamano} fondo={fondo} completo={completo} className={className}>
      {children}
    </Boton>
  );
}
