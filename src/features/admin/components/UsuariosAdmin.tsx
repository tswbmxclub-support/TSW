"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  Aviso,
  Badge,
  Boton,
  Campo,
  ChipEstado,
  EstadoVacio,
  Modal,
  PieModal,
  Select,
  TablaResponsiva,
  TarjetaJersey,
  TarjetaMensualidad,
  type ColumnaTabla,
} from "@/components/ui";
import { formatearFechaHora } from "@/lib/utils";
import {
  AUTORIZACION_DATOS_MUESTRA,
  MENSUALIDAD_ACTUAL_MUESTRA,
  MENSUALIDADES_MUESTRA,
} from "@/features/cuenta/datos-de-muestra";
import type { UsuarioPanel } from "../queries-perfiles";
import {
  activarUsuario,
  convertirEnAdministrador,
  desactivarUsuario,
  editarUsuario,
  invitarUsuario,
  reenviarEnlaceUsuario,
  type ResultadoPerfil,
} from "../acciones-perfiles";

/** Envío de una acción con aviso y refresco: el mismo patrón de todo el panel. */
function useAccionPerfil() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<ResultadoPerfil | null>(null);

  function ejecutar(accion: () => Promise<ResultadoPerfil>, alTerminar?: () => void) {
    setAviso(null);
    iniciar(async () => {
      const resultado = await accion();
      setAviso(resultado);
      if (resultado.ok) {
        alTerminar?.();
        router.refresh();
      }
    });
  }

  return { pendiente, aviso, ejecutar };
}

function Avisos({ aviso }: { aviso: ResultadoPerfil | null }) {
  if (!aviso) return null;
  if (!aviso.ok) return <Aviso tono="error">{aviso.error}</Aviso>;
  return aviso.mensaje ? <Aviso tono="exito">{aviso.mensaje}</Aviso> : null;
}

// --- Lista ------------------------------------------------------------------

/**
 * Titulares de cuenta (perfil_usuario). Búsqueda por nombre en el cliente:
 * la lista completa ya llegó del servidor y son decenas o cientos de filas,
 * no miles. Invitar crea la cuenta en Auth y manda el correo en un paso.
 */
export function UsuariosAdmin({ usuarios }: { usuarios: UsuarioPanel[] }) {
  const { pendiente, aviso, ejecutar } = useAccionPerfil();
  const [busqueda, setBusqueda] = useState("");
  const [invitando, setInvitando] = useState(false);

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) => u.nombre.toLowerCase().includes(q) || (u.correo ?? "").toLowerCase().includes(q));
  }, [busqueda, usuarios]);

  const columnas: ColumnaTabla<UsuarioPanel>[] = [
    {
      clave: "nombre",
      titulo: "Nombre",
      principal: true,
      render: (u) => <span className="font-semibold text-azul-profundo">{u.nombre}</span>,
    },
    {
      clave: "correo",
      titulo: "Correo",
      render: (u) => <span className="break-all text-texto-sec">{u.correo ?? "Sin cuenta en Auth"}</span>,
    },
    {
      clave: "telefono",
      titulo: "Teléfono",
      render: (u) => <span className="text-texto-sec">{u.telefono ?? "—"}</span>,
    },
    {
      clave: "estado",
      titulo: "Estado",
      render: (u) => <ChipEstado tipo="activo" valor={u.activo} />,
    },
    {
      clave: "acciones",
      titulo: "Acciones",
      alinear: "derecha",
      render: (u) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Boton href={`/admin/usuarios/${u.id}`} tamano="sm" variante="secundario">
            Ver detalle
          </Boton>
          {!u.activo && (
            <Boton tamano="sm" variante="fantasma" disabled={pendiente} onClick={() => ejecutar(() => activarUsuario(u.id))}>
              Activar
            </Boton>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Avisos aviso={aviso} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Campo
          etiqueta="Buscar por nombre o correo"
          name="buscar-usuario"
          type="search"
          placeholder="Escribe parte del nombre…"
          className="w-full sm:max-w-md"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Boton onClick={() => setInvitando(true)} disabled={pendiente}>
          Invitar usuario
        </Boton>
      </div>

      {usuarios.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay usuarios"
          texto="Invita al primer titular de cuenta desde el botón de arriba. Recibirá un correo para fijar su contraseña."
        />
      ) : resultados.length === 0 ? (
        <EstadoVacio
          titulo="Sin usuarios con ese nombre"
          texto="Ningún titular coincide con la búsqueda. Revisa la ortografía o busca por el correo."
        />
      ) : (
        <TablaResponsiva
          caption="Titulares de cuenta"
          filas={resultados}
          claveFila={(u) => u.id}
          columnas={columnas}
        />
      )}

      <p className="text-sm text-texto-sec">
        Mostrando {resultados.length} de {usuarios.length} usuarios.
      </p>

      <ModalInvitarUsuario
        abierto={invitando}
        pendiente={pendiente}
        alCerrar={() => setInvitando(false)}
        alEnviar={(datos) => ejecutar(() => invitarUsuario(datos), () => setInvitando(false))}
      />
    </div>
  );
}

function ModalInvitarUsuario({
  abierto,
  pendiente,
  alCerrar,
  alEnviar,
}: {
  abierto: boolean;
  pendiente: boolean;
  alCerrar: () => void;
  alEnviar: (datos: { nombre: string; correo: string; telefono: string }) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");

  function cerrar() {
    setNombre("");
    setCorreo("");
    setTelefono("");
    alCerrar();
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={cerrar}
      titulo="Invitar usuario"
      pie={
        <PieModal
          alCerrar={cerrar}
          cargando={pendiente}
          etiquetaGuardar="Enviar invitación"
          onGuardar={() => alEnviar({ nombre, correo, telefono })}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <Aviso tono="info">
          La cuenta nace <strong>inactiva</strong>: actívala cuando confirmes la matrícula y la autorización de
          datos del acudiente. El titular recibe un correo para fijar su contraseña.
        </Aviso>
        <Campo
          etiqueta="Nombre del titular"
          ayuda="El acudiente o el deportista adulto. Los deportistas menores se registran después."
          name="usuario-nombre"
          autoComplete="name"
          required
          maxLength={120}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Campo
          etiqueta="Correo"
          name="usuario-correo"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
        <Campo
          etiqueta="Teléfono"
          ayuda="Opcional."
          name="usuario-telefono"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={30}
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
        />
      </div>
    </Modal>
  );
}

// --- Detalle ----------------------------------------------------------------

/**
 * Detalle de un titular: datos de la cuenta (reales, perfil_usuario) y, por
 * ahora, mensualidades y jersey de muestra hasta que exista su esquema. Las
 * acciones de cuenta (editar, activar, desactivar, reenviar enlace) escriben
 * de verdad; "Registrar pago" y "Asignar jersey" siguen siendo vista previa.
 */
export function DetalleUsuarioAdmin({ usuario }: { usuario: UsuarioPanel }) {
  const { pendiente, aviso, ejecutar } = useAccionPerfil();
  const [modal, setModal] = useState<null | "editar" | "desactivar" | "convertir" | "pago" | "jersey">(null);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <Avisos aviso={aviso} />

      {/* --- Cuenta -------------------------------------------------------- */}
      <section aria-labelledby="titulo-cuenta-usuario" className="flex flex-col gap-3">
        <h2 id="titulo-cuenta-usuario" className="text-lg uppercase">Cuenta</h2>
        <div className="rounded-lg border border-gris-borde bg-blanco p-4">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-texto-sec">Correo</dt>
            <dd className="break-all text-azul-profundo">{usuario.correo ?? "Sin cuenta en Auth"}</dd>
            <dt className="text-texto-sec">Teléfono</dt>
            <dd className="text-azul-profundo">{usuario.telefono ?? "—"}</dd>
            <dt className="text-texto-sec">Estado</dt>
            <dd>
              <ChipEstado tipo="activo" valor={usuario.activo} />
            </dd>
            <dt className="text-texto-sec">Último acceso</dt>
            <dd className="text-azul-profundo">
              {usuario.ultimoAcceso ? formatearFechaHora(usuario.ultimoAcceso) : "Nunca ha entrado"}
            </dd>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Boton tamano="sm" variante="secundario" disabled={pendiente} onClick={() => setModal("editar")}>
              Editar datos
            </Boton>
            {usuario.activo ? (
              <Boton tamano="sm" variante="fantasma" disabled={pendiente} onClick={() => setModal("desactivar")}>
                Desactivar
              </Boton>
            ) : (
              <Boton tamano="sm" variante="fantasma" disabled={pendiente} onClick={() => ejecutar(() => activarUsuario(usuario.id))}>
                Activar
              </Boton>
            )}
            {!usuario.activo && (
              <Boton tamano="sm" variante="fantasma" disabled={pendiente} onClick={() => setModal("convertir")}>
                Convertir en administrador
              </Boton>
            )}
            {!usuario.ultimoAcceso && usuario.correo && (
              <Boton tamano="sm" variante="fantasma" disabled={pendiente} onClick={() => ejecutar(() => reenviarEnlaceUsuario(usuario.id))}>
                Reenviar enlace
              </Boton>
            )}
          </div>
        </div>
      </section>

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
            sus datos. El formato firmado se radica en sede; aquí solo se registra que existe. [Dato de muestra:
            el registro real llega con la tabla de deportistas.]
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tono="neutro">{AUTORIZACION_DATOS_MUESTRA.documento ?? "[FORMATO]"}</Badge>
            <span>{AUTORIZACION_DATOS_MUESTRA.fecha ?? "[FECHA DE FIRMA PENDIENTE]"}</span>
          </p>
        </Aviso>
      </section>

      {/* --- Mensualidades y jersey (muestra) ------------------------------ */}
      <Aviso tono="info">
        Mensualidades y jersey se muestran con datos de muestra: su esquema llega en la siguiente etapa.
      </Aviso>

      <section aria-labelledby="titulo-mensualidades-usuario" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="titulo-mensualidades-usuario" className="text-lg uppercase">Mensualidades</h2>
          <Boton tamano="sm" onClick={() => setModal("pago")}>
            Registrar pago
          </Boton>
        </div>
        <ul className="grid gap-3 lg:grid-cols-2">
          <li>
            <TarjetaMensualidad
              mes={MENSUALIDAD_ACTUAL_MUESTRA.mes}
              estado={MENSUALIDAD_ACTUAL_MUESTRA.estado}
              montoCentavos={MENSUALIDAD_ACTUAL_MUESTRA.montoCentavos}
              fecha={MENSUALIDAD_ACTUAL_MUESTRA.fecha}
              variante="destacada"
            />
          </li>
          {MENSUALIDADES_MUESTRA.map((m) => (
            <li key={m.id}>
              <TarjetaMensualidad
                mes={m.mes}
                estado={m.estado}
                montoCentavos={m.montoCentavos}
                fecha={m.fecha}
                variante="compacta"
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-jersey-usuario" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="titulo-jersey-usuario" className="text-lg uppercase">Jersey</h2>
          <Boton tamano="sm" variante="secundario" onClick={() => setModal("jersey")}>
            Asignar jersey
          </Boton>
        </div>
        <TarjetaJersey talla="[TALLA]" estado="pendiente" fechaEntrega="[FECHA DE ENTREGA]" impresion="[NOMBRE IMPRESO]" />
      </section>

      {/* --- Modales reales ------------------------------------------------ */}
      <Modal abierto={modal === "editar"} alCerrar={() => setModal(null)} titulo="Editar datos del titular">
        <FormularioDatosUsuario
          key={`${usuario.id}-${usuario.actualizado_en}`}
          usuario={usuario}
          pendiente={pendiente}
          alCancelar={() => setModal(null)}
          alGuardar={(datos) => ejecutar(() => editarUsuario({ id: usuario.id, ...datos }), () => setModal(null))}
        />
      </Modal>

      <Modal
        abierto={modal === "desactivar"}
        alCerrar={() => setModal(null)}
        titulo="Desactivar cuenta"
        pie={
          <PieModal
            alCerrar={() => setModal(null)}
            cargando={pendiente}
            etiquetaGuardar="Desactivar"
            onGuardar={() => ejecutar(() => desactivarUsuario(usuario.id), () => setModal(null))}
          />
        }
      >
        <p className="text-sm text-texto-sec">
          {usuario.nombre} dejará de poder entrar a su cuenta. Sus datos y los de sus deportistas se conservan;
          puedes volver a activarla cuando quieras.
        </p>
      </Modal>

      <Modal
        abierto={modal === "convertir"}
        alCerrar={() => setModal(null)}
        titulo="Convertir en administrador"
        pie={
          <PieModal
            alCerrar={() => setModal(null)}
            cargando={pendiente}
            etiquetaGuardar="Convertir y eliminar su perfil"
            onGuardar={() =>
              ejecutar(
                () => convertirEnAdministrador(usuario.id),
                () => {
                  setModal(null);
                  // Esta ficha deja de existir en cuanto la conversión pasa:
                  // quedarse aquí mostraría un 404 al refrescar.
                  router.push("/admin/administradores");
                },
              )
            }
          />
        }
      >
        <Aviso tono="aviso" titulo="Esto elimina su perfil de titular">
          Se <strong>borra la ficha de {usuario.nombre} como titular</strong> —nombre, teléfono y todo lo que
          cuelgue de ella— y en su lugar queda una cuenta de administrador con el mismo correo. No es un cambio
          de etiqueta: la fila de titular desaparece y no se puede deshacer desde el panel.
        </Aviso>
        <p className="mt-4 text-sm text-texto-sec">
          Entra a la lista de administradores <strong>inactivo</strong>. Tendrás que activarlo aparte para que
          pueda usar el panel.
        </p>
      </Modal>

      {/* --- Modales de vista previa (esquema pendiente) -------------------- */}
      <Modal
        abierto={modal === "pago"}
        alCerrar={() => setModal(null)}
        titulo="Registrar pago"
        pie={<PieModal alCerrar={() => setModal(null)} onGuardar={() => setModal(null)} etiquetaGuardar="Registrar" />}
      >
        <ModalVistaPrevia>
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
        abierto={modal === "jersey"}
        alCerrar={() => setModal(null)}
        titulo="Asignar jersey"
        pie={<PieModal alCerrar={() => setModal(null)} onGuardar={() => setModal(null)} etiquetaGuardar="Asignar" />}
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
    </div>
  );
}

/** Formulario con `key` por versión de la fila: arranca limpio tras cada guardado. */
function FormularioDatosUsuario({
  usuario,
  pendiente,
  alCancelar,
  alGuardar,
}: {
  usuario: UsuarioPanel;
  pendiente: boolean;
  alCancelar: () => void;
  alGuardar: (datos: { nombre: string; telefono: string }) => void;
}) {
  const [nombre, setNombre] = useState(usuario.nombre);
  const [telefono, setTelefono] = useState(usuario.telefono ?? "");

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        alGuardar({ nombre, telefono });
      }}
    >
      <Campo
        etiqueta="Nombre del titular"
        name="usuario-nombre"
        autoComplete="name"
        required
        maxLength={120}
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />
      <Campo
        etiqueta="Teléfono"
        ayuda="Déjalo vacío para quitarlo."
        name="usuario-telefono"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        maxLength={30}
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
      />
      <p className="text-sm text-texto-sec">
        Correo: {usuario.correo ?? "sin cuenta en Auth"}. El correo no se cambia desde aquí.
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Boton type="button" variante="secundario" disabled={pendiente} onClick={alCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={pendiente}>
          Guardar
        </Boton>
      </div>
    </form>
  );
}

/** Contenido común de los modales que aún no persisten: campos + aviso. */
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
