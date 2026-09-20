"use client";

import { useState } from "react";

import { Aviso, Boton, ChipEstado, EstadoVacio, Modal, PieModal, Campo } from "@/components/ui";
import { ADMINISTRADORES_MUESTRA } from "@/features/cuenta/datos-de-muestra";

/**
 * Lista de administradores (vista previa de la futura tabla perfil_admin).
 * Nombre, correo, estado y el botón de invitación. El botón abre un modal que
 * no persiste nada: el alta real pedirá la Admin API de Auth, no SQL.
 */
export function AdministradoresAdmin() {
  const [modalAbierto, setModalAbierto] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Boton onClick={() => setModalAbierto(true)}>Invitar administrador</Boton>
      </div>

      {ADMINISTRADORES_MUESTRA.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay administradores"
          texto="El primer administrador se invita desde el botón de arriba."
        />
      ) : (
        <>
          {/* --- Escritorio: tabla ---------------------------------------- */}
          <div className="hidden overflow-hidden rounded-lg border border-gris-borde bg-blanco md:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Administradores del panel</caption>
              <thead>
                <tr className="border-b-2 border-gris-borde text-sm text-texto-sec">
                  <th scope="col" className="py-3 pr-4 font-semibold uppercase tracking-wide">Nombre</th>
                  <th scope="col" className="py-3 pr-4 font-semibold uppercase tracking-wide">Correo</th>
                  <th scope="col" className="py-3 pr-4 font-semibold uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody>
                {ADMINISTRADORES_MUESTRA.map((admin) => (
                  <tr key={admin.id} className="border-b border-gris-borde last:border-0">
                    <td className="py-4 pr-4 font-semibold text-azul-profundo">{admin.nombre}</td>
                    <td className="py-4 pr-4 text-texto-sec">{admin.correo}</td>
                    <td className="py-4 pr-4">
                      <ChipEstado tipo="activo" valor={admin.activo} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* --- Móvil: tarjetas apiladas ---------------------------------- */}
          <ul className="flex flex-col gap-3 md:hidden" aria-label="Administradores del panel">
            {ADMINISTRADORES_MUESTRA.map((admin) => (
              <li key={admin.id} className="rounded-lg border border-gris-borde bg-blanco p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-azul-profundo">{admin.nombre}</p>
                  <ChipEstado tipo="activo" valor={admin.activo} />
                </div>
                <p className="mt-2 break-all text-sm text-texto-sec">{admin.correo}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal
        abierto={modalAbierto}
        alCerrar={() => setModalAbierto(false)}
        titulo="Invitar administrador"
        pie={<PieModal alCerrar={() => setModalAbierto(false)} onGuardar={() => setModalAbierto(false)} etiquetaGuardar="Enviar invitación" />}
      >
        <div className="flex flex-col gap-4">
          <Aviso tono="aviso" titulo="Vista previa: esta acción se conecta en la siguiente etapa">
            Nada se guarda todavía.
          </Aviso>
          <Campo etiqueta="Nombre" name="admin-nombre" autoComplete="name" required placeholder="[NOMBRE]" />
          <Campo etiqueta="Correo" name="admin-correo" type="email" inputMode="email" autoComplete="email" required placeholder="[correo@dominio.com]" />
        </div>
      </Modal>
    </div>
  );
}
