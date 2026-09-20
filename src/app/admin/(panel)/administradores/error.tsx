"use client";

import { EstadoError, type EstadoErrorProps } from "@/components/ui";

export default function ErrorAdministradores(props: Omit<EstadoErrorProps, "contexto">) {
  return <EstadoError {...props} contexto="la lista de administradores" />;
}
