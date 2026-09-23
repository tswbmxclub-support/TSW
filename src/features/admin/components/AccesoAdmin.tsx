"use client";

import { useState } from "react";

import { Tabs } from "@/components/ui";
import { FormularioAcceso } from "./FormularioAcceso";
import { FormularioCodigo } from "./FormularioCodigo";

const OPCIONES = [
  { valor: "contrasena", etiqueta: "Contraseña" },
  { valor: "codigo", etiqueta: "Código por correo" },
];

export type AccesoAdminProps = {
  redirigir?: string;
};

/**
 * Puerta del panel con sus dos formas de entrar: contraseña, o un código de
 * un solo uso que llega al correo.
 *
 * Pestañas y no dos páginas: las dos vías empiezan por el mismo correo y
 * cambiar de idea no debería costar una navegación. La contraseña va primero
 * porque es la vía normal; el código es la salida cuando no se recuerda, sin
 * llegar a cambiarla.
 *
 * El componente vive aquí y no en la página porque el cambio de pestaña es
 * estado de cliente; la página sigue siendo un Server Component que
 * comprueba la sesión antes de pintar nada.
 */
export function AccesoAdmin({ redirigir }: AccesoAdminProps) {
  const [modo, setModo] = useState("contrasena");

  return (
    <>
      <h1 className="text-2xl">Acceso al panel</h1>
      <p className="mt-2 mb-6 text-sm text-texto-sec">Solo para la administración del club.</p>

      <Tabs opciones={OPCIONES} valor={modo} alCambiar={setModo} etiqueta="Forma de entrar">
        {modo === "contrasena" ? (
          <FormularioAcceso redirigir={redirigir} />
        ) : (
          <FormularioCodigo redirigir={redirigir} />
        )}
      </Tabs>
    </>
  );
}
