"use client";

import { EstadoError, type EstadoErrorProps } from "@/components/ui";

export default function ErrorCarrito(props: Omit<EstadoErrorProps, "contexto">) {
  return <EstadoError {...props} contexto="el carrito" />;
}
