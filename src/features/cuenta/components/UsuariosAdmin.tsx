"use client";

import { useMemo, useState } from "react";

import {
  Aviso,
  AreaTexto,
  Badge,
  Boton,
  Campo,
  ChipEstado,
  EstadoVacio,
  Modal,
  PieModal,
  Select,
  TarjetaJersey,
  TarjetaMensualidad,
} from "@/components/ui";
import {
  AUTORIZACION_DATOS_MUESTRA,
  MENSUALIDAD_ACTUAL_MUESTRA,
  MENSUALIDADES_MUESTRA,
  USUARIOS_PANEL_MUESTRA,
  type UsuarioPanelMuestra,
} from "@/features/cuenta/datos-de-muestra";

/**
 * Bandeja de usuarios de la corporación (vista previa). Búsqueda por nombre,
 * tarjetas en móvil y tabla en escritorio; el detalle con mensualidades y
 * jerseys vive en /admin/usuarios/[id].
 *
 * Los botones de acción abren modales que no persisten nada: muestran el
 * Aviso de vista previa. La escritura real llegará con la tabla
 * perfil_usuario y sus RPC.
 */
export function UsuariosAdmin({ deporteNombre }: { deporteNombre: string }) {
  const [busqueda, setBusqueda] = useState("");

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return USUARIOS_PANEL_MUESTRA;
    return USUARIOS_PANEL_MUESTRA.filter((u) => u.nombre.toLowerCase().includes(q));
  }, [busqueda]);

  return (
    <div className="flex flex-col gap-6">
      <Campo
        etiqueta="Buscar usuario por nombre"
        name="buscar-usuario"
        type="search"
        placeholder="Escribe parte del nombre…"
        className="max-w-md"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {resultados.length === 0 ? (
        <EstadoVacio
          titulo="Sin usuarios con ese nombre"
          texto="Ningún titular de cuenta coincide con la búsqueda. Revisa la ortografía o busca por otro apellido."
        />
      ) : (
        <>
          {/* --- Escritorio: tabla ---------------------------------------- */}
          <div className="hidden overflow-hidden rounded-lg border border-gris-borde bg-blanco md:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Usuarios de la corporación</caption>
              <thead>
                <tr className="border-b-2 border-gris-borde text-sm text-texto-sec">
                  <th scope="col" className="py-3 pr-4 font-semibold uppercase tracking-wide">Nombre</th>
                  <th scope="col" className="py-3 pr-4 font-semibold uppercase tracking-wide">Correo</th>
                  <th scope="col" className="py-3 pr-4 font-semibold uppercase tracking-wide">Deporte</th>
                  <th scope="col" className="py-3 pr-4 font-semibold uppercase tracking-wide">Estado</th>
                  <th scope="col" className="py-3 pr-4" />
                </tr>
              </thead>
              <tbody>
                {resultados.map((usuario) => (
                  <tr key={usuario.id} className="border-b border-gris-borde last:border-0">
                    <td className="py-4 pr-4 font-semibold text-azul-profundo">{usuario.nombre}</td>
                    <td className="py-4 pr-4 text-texto-sec">{usuario.correo}</td>
                    <td className="py-4 pr-4 text-azul-profundo">{usuario.deporte}</td>
                    <td className="py-4 pr-4">
                      <ChipEstado tipo="activo" valor={usuario.estado === "activo"} />
                    </td>
                    <td className="py-4 pr-4 text-right">
                      <Boton href={`/admin/usuarios/${usuario.id}`} tamano="sm" variante="secundario">
                        Ver detalle
                      </Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* --- Móvil: tarjetas apiladas ---------------------------------- */}
          <ul className="flex flex-col gap-3 md:hidden" aria-label="Usuarios de la corporación">
            {resultados.map((usuario) => (
              <li key={usuario.id} className="rounded-lg border border-gris-borde bg-blanco p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-azul-profundo">{usuario.nombre}</p>
                  <ChipEstado tipo="activo" valor={usuario.estado === "activo"} />
                </div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-texto-sec">Correo</dt>
                  <dd className="break-all text-azul-profundo">{usuario.correo}</dd>
                  <dt className="text-texto-sec">Deporte</dt>
                  <dd className="text-azul-profundo">{usuario.deporte}</dd>
                </dl>
                <div className="mt-4">
                  <Boton href={`/admin/usuarios/${usuario.id}`} tamano="sm" variante="secundario" completo>
                    Ver detalle
                  </Boton>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-sm text-texto-sec">
        Mostrando {resultados.length} de {USUARIOS_PANEL_MUESTRA.length} usuarios · deporte activo: {deporteNombre}
      </p>
    </div>
  );
}

/**
 * Detalle de un usuario: resumen de cuenta, mensualidades y jersey, con los
 * cuatro botones de acción del admin. Toda acción muestra el modal de vista
 * previa; nada persiste.
 */
export function DetalleUsuarioAdmin() {
  const usuario: UsuarioPanelMuestra = USUARIOS_PANEL_MUESTRA[0]!;
  const [modalAbierto, setModalAbierto] = useState<null | "pago" | "jersey" | "invitar" | "desactivar">(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <Boton tamano="sm" onClick={() => setModalAbierto("pago")}>
          Registrar pago
        </Boton>
        <Boton tamano="sm" variante="secundario" onClick={() => setModalAbierto("jersey")}>
          Asignar jersey
        </Boton>
        <Boton tamano="sm" variante="secundario" onClick={() => setModalAbierto("invitar")}>
          Invitar por correo
        </Boton>
        <Boton tamano="sm" variante="secundario" className="text-rojo-oscuro" onClick={() => setModalAbierto("desactivar")}>
          Desactivar
        </Boton>
      </div>

      {/* --- Tratamiento de datos (Ley 1581) ------------------------------ */}
      <section aria-labelledby="titulo-datos-usuario" className="flex flex-col gap-3">
        <h2 id="titulo-datos-usuario" className="text-lg uppercase">Autorización de datos</h2>
        <Aviso
          tono={AUTORIZACION_DATOS_MUESTRA.estado === "firmada" ? "exito" : "aviso"}
          titulo={
            AUTORIZACION_DATOS_MUESTRA.estado === "firmada"
              ? "Autorización del acudiente firmada"
              : "Autorización del acudiente pendiente"
          }
        >
          <p>
            Con menores en la cuenta, la Ley 1581 exige constancia de la autorización del acudiente para tratar
            sus datos. El formato firmado se radica en sede; aquí solo se registra que existe.
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tono="neutro">{AUTORIZACION_DATOS_MUESTRA.documento ?? "[FORMATO]"}</Badge>
            <span>{AUTORIZACION_DATOS_MUESTRA.fecha ?? "[FECHA DE FIRMA PENDIENTE]"}</span>
          </p>
        </Aviso>
      </section>

      {/* --- Historial de mensualidades ---------------------------------- */}
      <section aria-labelledby="titulo-mensualidades-usuario" className="flex flex-col gap-3">
        <h2 id="titulo-mensualidades-usuario" className="text-lg uppercase">Mensualidades</h2>
        <ul className="grid gap-3 lg:grid-cols-2">
          <li>
            {/* La tarjeta destacada del mes actual, la misma del área de usuario. */}
            <TarjetaMensualidadDeportista mensualidad={MENSUALIDAD_ACTUAL_MUESTRA} destacada />
          </li>
          {MENSUALIDADES_MUESTRA.map((m) => (
            <li key={m.id}>
              <TarjetaMensualidadDeportista mensualidad={m} />
            </li>
          ))}
        </ul>
      </section>

      {/* --- Jersey ------------------------------------------------------- */}
      <section aria-labelledby="titulo-jersey-usuario" className="flex flex-col gap-3">
        <h2 id="titulo-jersey-usuario" className="text-lg uppercase">Jersey</h2>
        <TarjetaJerseyDetalle />
      </section>

      {/* --- Modales de vista previa -------------------------------------- */}
      <Modal
        abierto={modalAbierto === "pago"}
        alCerrar={() => setModalAbierto(null)}
        titulo="Registrar pago"
        pie={<PieModal alCerrar={() => setModalAbierto(null)} onGuardar={() => setModalAbierto(null)} etiquetaGuardar="Registrar" />}
      >
        <ModalVistaPrevia>
          <Campo etiqueta="Deportista" name="pago-deportista" disabled defaultValue={usuario.deportistas[0]?.nombre} />
          <Campo etiqueta="Mes" name="pago-mes" disabled defaultValue={MENSUALIDAD_ACTUAL_MUESTRA.mes} />
          <Select
            etiqueta="Medio de pago"
            name="pago-medio"
            opciones={[
              { valor: "transferencia", etiqueta: "Transferencia" },
              { valor: "nequi", etiqueta: "Nequi" },
              { valor: "efectivo", etiqueta: "Efectivo en sede" },
            ]}
          />
          <Campo etiqueta="Referencia" name="pago-referencia" required placeholder="[REFERENCIA]" />
        </ModalVistaPrevia>
      </Modal>

      <Modal
        abierto={modalAbierto === "jersey"}
        alCerrar={() => setModalAbierto(null)}
        titulo="Asignar jersey"
        pie={<PieModal alCerrar={() => setModalAbierto(null)} onGuardar={() => setModalAbierto(null)} etiquetaGuardar="Asignar" />}
      >
        <ModalVistaPrevia>
          <Select
            etiqueta="Talla"
            name="jersey-talla"
            marcador="Selecciona una talla"
            opciones={[
              { valor: "s", etiqueta: "S" },
              { valor: "m", etiqueta: "M" },
              { valor: "l", etiqueta: "L" },
              { valor: "xl", etiqueta: "XL" },
            ]}
          />
          <Campo etiqueta="Nombre o número impreso" name="jersey-impresion" placeholder="[NOMBRE IMPRESO]" />
        </ModalVistaPrevia>
      </Modal>

      <Modal
        abierto={modalAbierto === "invitar"}
        alCerrar={() => setModalAbierto(null)}
        titulo="Invitar por correo"
        pie={<PieModal alCerrar={() => setModalAbierto(null)} onGuardar={() => setModalAbierto(null)} etiquetaGuardar="Enviar invitación" />}
      >
        <ModalVistaPrevia>
          <Campo etiqueta="Correo" name="invitar-correo" type="email" inputMode="email" autoComplete="email" defaultValue={usuario.correo} />
          <AreaTexto etiqueta="Mensaje" name="invitar-mensaje" ayuda="Opcional." />
        </ModalVistaPrevia>
      </Modal>

      <Modal
        abierto={modalAbierto === "desactivar"}
        alCerrar={() => setModalAbierto(null)}
        titulo="Desactivar usuario"
        pie={<PieModal alCerrar={() => setModalAbierto(null)} onGuardar={() => setModalAbierto(null)} etiquetaGuardar="Desactivar" />}
      >
        <ModalVistaPrevia>
          <p className="text-sm text-texto-sec">
            Al desactivar, {usuario.nombre} deja de ver su cuenta. Sus datos se conservan.
          </p>
        </ModalVistaPrevia>
      </Modal>
    </div>
  );
}

/* --- Piezas internas del detalle, sobre los primitivos de la cuenta ----- */

function TarjetaMensualidadDeportista({
  mensualidad,
  destacada = false,
}: {
  mensualidad: { mes: string; estado: "pagada" | "pendiente" | "vencida"; montoCentavos: number | null; fecha: string };
  destacada?: boolean;
}) {
  return (
    <TarjetaMensualidad
      mes={mensualidad.mes}
      estado={mensualidad.estado}
      montoCentavos={mensualidad.montoCentavos}
      fecha={mensualidad.fecha}
      variante={destacada ? "destacada" : "compacta"}
    />
  );
}

function TarjetaJerseyDetalle() {
  return <TarjetaJersey talla="[TALLA]" estado="pendiente" fechaEntrega="[FECHA DE ENTREGA]" impresion="[NOMBRE IMPRESO]" />;
}

/** Contenido común de los modales: campos + aviso de vista previa. */
function ModalVistaPrevia({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <Aviso tono="aviso" titulo="Vista previa: esta acción se conecta en la siguiente etapa">
        Nada se guarda todavía.
      </Aviso>
      {children}
    </div>
  );
}
