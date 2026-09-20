"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Aviso, Boton, Campo } from "@/components/ui";
import { solicitarRecuperacion, type ResultadoAccion } from "../acciones";
import { esquemaRecuperacion, type EntradaRecuperacion } from "../schemas";

export type FormularioRecuperacionProps = {
  avisoInicial?: string;
  /** Acción de recuperación: la del panel por defecto; /cuenta pasa la suya. */
  accion?: (entrada: EntradaRecuperacion) => Promise<ResultadoAccion>;
  /** Etiqueta del campo de correo (varía entre panel y área de cuenta). */
  etiquetaCorreo?: string;
  /** Destino del enlace "Volver al acceso". */
  enlaceVolver?: string;
};

/**
 * Pide el correo y envía el enlace de recuperación. Compartido por las dos
 * puertas: /admin/recuperar usa la acción del panel y /cuenta/recuperar la
 * suya, cuyo enlace vuelve por /cuenta/auth/callback.
 */
export function FormularioRecuperacion({
  avisoInicial,
  accion = solicitarRecuperacion,
  etiquetaCorreo = "Correo del administrador",
  enlaceVolver = "/admin/login",
}: FormularioRecuperacionProps) {
  const [enviando, iniciarEnvio] = useTransition();
  const [mensaje, setMensaje] = useState<{ tono: "error" | "exito"; texto: string } | null>(
    avisoInicial ? { tono: "error", texto: avisoInicial } : null,
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EntradaRecuperacion>({
    resolver: zodResolver(esquemaRecuperacion),
    defaultValues: { correo: "" },
  });

  const enviar = handleSubmit((datos) => {
    setMensaje(null);
    iniciarEnvio(async () => {
      const resultado = await accion(datos);
      setMensaje(
        resultado.ok
          ? { tono: "exito", texto: resultado.mensaje ?? "Revisa tu correo." }
          : { tono: "error", texto: resultado.error },
      );
    });
  });

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}

      <Campo
        etiqueta={etiquetaCorreo}
        type="email"
        inputMode="email"
        autoComplete="username"
        required
        error={errors.correo?.message}
        {...register("correo")}
      />

      <Boton type="submit" cargando={enviando} completo>
        Enviar enlace
      </Boton>

      <p className="text-center text-sm">
        <Link
          href={enlaceVolver}
          className="inline-flex min-h-[44px] items-center text-azul-profundo underline underline-offset-4 hover:text-rojo focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rojo"
        >
          Volver al acceso
        </Link>
      </p>
    </form>
  );
}
