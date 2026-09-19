"use client";

import { EstadoError, type EstadoErrorProps } from "@/components/ui";

export default function ErrorTienda(props: Omit<EstadoErrorProps, "contexto">) {
  return <EstadoError {...props} contexto="la tienda" />;
}
