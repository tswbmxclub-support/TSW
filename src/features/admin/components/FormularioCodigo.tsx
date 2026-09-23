"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Aviso, Boton, Campo } from "@/components/ui";
import { useMovimientoReducido } from "@/lib/animaciones";
import { solicitarCodigoAcceso, verificarCodigoAcceso } from "../acciones";
import {
  LARGO_CODIGO_ACCESO,
  SEGUNDOS_REENVIO_CODIGO,
  VIGENCIA_CODIGO_ACCESO,
} from "../constantes";
import {
  esquemaSolicitudCodigo,
  esquemaVerificacionCodigo,
  type EntradaSolicitudCodigo,
  type EntradaVerificacionCodigo,
} from "../schemas";

export type FormularioCodigoProps = {
  redirigir?: string;
};

/**
 * Acceso con un código de un solo uso que llega por correo.
 *
 * Dos pasos en la misma tarjeta: pedir el código y escribirlo. **Se pasa al
 * segundo paso siempre**, corresponda el correo a un administrador o no. Si
 * la pantalla se quedara en el primer paso cuando el correo no existe,
 * bastaría con mirarla para saber qué correos son de administradores, y el
 * mensaje idéntico de la Server Action no habría servido de nada.
 *
 * El código lo genera y lo valida Supabase; aquí no se compara nada.
 */
export function FormularioCodigo({ redirigir }: FormularioCodigoProps) {
  const [paso, setPaso] = useState<"correo" | "codigo">("correo");
  const [correo, setCorreo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [esperaReenvio, setEsperaReenvio] = useState(0);
  const [enviando, iniciarEnvio] = useTransition();
  const reducido = useMovimientoReducido();

  const formularioCorreo = useForm<EntradaSolicitudCodigo>({
    resolver: zodResolver(esquemaSolicitudCodigo),
    defaultValues: { correo: "" },
  });

  const formularioCodigo = useForm<EntradaVerificacionCodigo>({
    resolver: zodResolver(esquemaVerificacionCodigo),
    defaultValues: { correo: "", codigo: "", redirigir },
  });

  // Cuenta atrás del reenvío. Con movimiento reducido no se descuenta en
  // pantalla —un número cambiando cada segundo es movimiento aunque no
  // anime—: el temporizador corre igual y solo se avisa cuando termina.
  useEffect(() => {
    if (esperaReenvio <= 0) return;
    const intervalo = window.setInterval(() => {
      setEsperaReenvio((quedan) => Math.max(0, quedan - 1));
    }, 1000);
    return () => window.clearInterval(intervalo);
  }, [esperaReenvio]);

  function pedirCodigo(valor: string) {
    setErrorGeneral(null);
    iniciarEnvio(async () => {
      const resultado = await solicitarCodigoAcceso({ correo: valor });
      if (!resultado.ok) {
        setErrorGeneral(resultado.error);
        return;
      }
      setCorreo(valor);
      formularioCodigo.setValue("correo", valor);
      setAviso(resultado.mensaje ?? null);
      setEsperaReenvio(SEGUNDOS_REENVIO_CODIGO);
      setPaso("codigo");
    });
  }

  const enviarCorreo = formularioCorreo.handleSubmit((datos) => pedirCodigo(datos.correo));

  const enviarCodigo = formularioCodigo.handleSubmit((datos) => {
    setErrorGeneral(null);
    iniciarEnvio(async () => {
      // Con éxito la acción redirige y nunca llega aquí.
      const resultado = await verificarCodigoAcceso(datos);
      if (!resultado.ok) {
        setErrorGeneral(resultado.error);
        for (const [campo, mensaje] of Object.entries(resultado.campos ?? {})) {
          if (campo === "codigo") formularioCodigo.setError("codigo", { message: mensaje });
        }
      }
    });
  });

  function volverAlCorreo() {
    setPaso("correo");
    setAviso(null);
    setErrorGeneral(null);
    setEsperaReenvio(0);
    formularioCodigo.reset({ correo: "", codigo: "", redirigir });
  }

  if (paso === "correo") {
    return (
      <form onSubmit={enviarCorreo} noValidate className="flex flex-col gap-5">
        {errorGeneral && <Aviso tono="error">{errorGeneral}</Aviso>}

        <p className="text-sm text-texto-sec">
          Te mandamos un código de {LARGO_CODIGO_ACCESO} dígitos al correo. No necesitas la contraseña.
        </p>

        <Campo
          etiqueta="Correo"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          error={formularioCorreo.formState.errors.correo?.message}
          {...formularioCorreo.register("correo")}
        />

        <Boton type="submit" cargando={enviando} completo>
          Enviarme un código
        </Boton>
      </form>
    );
  }

  const puedeReenviar = esperaReenvio === 0 && !enviando;

  return (
    <form onSubmit={enviarCodigo} noValidate className="flex flex-col gap-5">
      {errorGeneral && <Aviso tono="error">{errorGeneral}</Aviso>}
      {aviso && !errorGeneral && <Aviso tono="info">{aviso}</Aviso>}

      <input type="hidden" {...formularioCodigo.register("correo")} />
      <input type="hidden" {...formularioCodigo.register("redirigir")} />

      <Campo
        etiqueta={`Código de ${LARGO_CODIGO_ACCESO} dígitos`}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={LARGO_CODIGO_ACCESO}
        required
        autoFocus
        ayuda={`Enviado a ${correo}. Vence ${VIGENCIA_CODIGO_ACCESO} y sirve una sola vez.`}
        error={formularioCodigo.formState.errors.codigo?.message}
        {...formularioCodigo.register("codigo")}
      />

      <Boton type="submit" cargando={enviando} completo>
        Entrar
      </Boton>

      <div className="flex flex-col items-center gap-1">
        <Boton
          type="button"
          variante="fantasma"
          tamano="sm"
          disabled={!puedeReenviar}
          onClick={() => pedirCodigo(correo)}
        >
          {puedeReenviar
            ? "Enviar otro código"
            : reducido
              ? "Espera un momento para pedir otro"
              : `Puedes pedir otro en ${esperaReenvio} s`}
        </Boton>
        <Boton type="button" variante="fantasma" tamano="sm" onClick={volverAlCorreo}>
          Usar otro correo
        </Boton>
      </div>
    </form>
  );
}
