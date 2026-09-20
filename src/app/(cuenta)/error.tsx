"use client";

import { EstadoError, type EstadoErrorProps } from "@/components/ui";

export default function ErrorCuenta(props: Omit<EstadoErrorProps, "contexto">) {
  return <EstadoError {...props} contexto="tu cuenta" />;
}
