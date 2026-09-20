"use client";

import { EstadoError, type EstadoErrorProps } from "@/components/ui";

export default function ErrorMensualidadesDelMes(props: Omit<EstadoErrorProps, "contexto">) {
  return <EstadoError {...props} contexto="las mensualidades del mes" />;
}
