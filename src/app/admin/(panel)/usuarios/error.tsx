"use client";

import { EstadoError, type EstadoErrorProps } from "@/components/ui";

export default function ErrorUsuarios(props: Omit<EstadoErrorProps, "contexto">) {
  return <EstadoError {...props} contexto="la lista de usuarios" />;
}
