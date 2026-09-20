"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  Aviso,
  Boton,
  Campo,
  ChipEstado,
  EstadoVacio,
  Modal,
  PieModal,
  TablaResponsiva,
  type ColumnaTabla,
} from "@/components/ui";
import { formatearFechaHora } from "@/lib/utils";
import type { AdminPanel } from "../queries-perfiles";
import {
  activarAdministrador,
  desactivarAdministrador,
  editarAdministrador,
  invitarAdministrador,
  reenviarEnlaceAdministrador,
  type ResultadoPerfil,
} from "../acciones-perfiles";

/**
 * Administradores del panel (perfil_admin). Invitar crea la cuenta en Auth y
 * manda el enlace de contraseña; activar y desactivar van por RPC con las
 * salvaguardas en la base (nadie se desactiva a sí mismo, no se desactiva al
 * último activo). La interfaz solo evita el clic obvio: el botón de
 * desactivarse a uno mismo no se ofrece.
 */
export function AdministradoresAdmin({
  administradores,
  actorId,
}: {
  administradores: AdminPanel[];
  actorId: string;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<ResultadoPerfil | null>(null);
  const [invitando, setInvitando] = useState(false);
  const [editando, setEditando] = useState<AdminPanel | null>(null);
  const [desactivando, setDesactivando] = useState<AdminPanel | null>(null);

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

  const columnas: ColumnaTabla<AdminPanel>[] = [
    {
      clave: "nombre",
      titulo: "Nombre",
      principal: true,
      render: (a) => (
        <span className="font-semibold text-azul-profundo">
          {a.nombre}
          {a.id === actorId && <span className="ml-2 text-sm font-normal text-texto-sec">(tú)</span>}
        </span>
      ),
    },
    {
      clave: "correo",
      titulo: "Correo",
      render: (a) => <span className="break-all text-texto-sec">{a.correo ?? "Sin cuenta en Auth"}</span>,
    },
    {
      clave: "estado",
      titulo: "Estado",
      render: (a) => <ChipEstado tipo="activo" valor={a.activo} />,
    },
    {
      clave: "acceso",
      titulo: "Último acceso",
      render: (a) => (
        <span className="text-sm text-texto-sec">
          {a.ultimoAcceso ? formatearFechaHora(a.ultimoAcceso) : "Nunca ha entrado"}
        </span>
      ),
    },
    {
      clave: "acciones",
      titulo: "Acciones",
      alinear: "derecha",
      render: (a) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Boton tamano="sm" variante="secundario" disabled={pendiente} onClick={() => setEditando(a)}>
            Editar
          </Boton>
          {a.activo ? (
            a.id !== actorId && (
              <Boton tamano="sm" variante="fantasma" disabled={pendiente} onClick={() => setDesactivando(a)}>
                Desactivar
              </Boton>
            )
          ) : (
            <Boton tamano="sm" variante="fantasma" disabled={pendiente} onClick={() => ejecutar(() => activarAdministrador(a.id))}>
              Activar
            </Boton>
          )}
          {!a.ultimoAcceso && a.correo && (
            <Boton
              tamano="sm"
              variante="fantasma"
              disabled={pendiente}
              onClick={() => ejecutar(() => reenviarEnlaceAdministrador(a.id))}
            >
              Reenviar enlace
            </Boton>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {aviso && !aviso.ok && <Aviso tono="error">{aviso.error}</Aviso>}
      {aviso?.ok && aviso.mensaje && <Aviso tono="exito">{aviso.mensaje}</Aviso>}

      <div className="flex justify-end">
        <Boton onClick={() => setInvitando(true)} disabled={pendiente}>
          Invitar administrador
        </Boton>
      </div>

      {administradores.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay administradores"
          texto="El primer administrador se invita desde el botón de arriba."
        />
      ) : (
        <TablaResponsiva
          caption="Administradores del panel"
          filas={administradores}
          claveFila={(a) => a.id}
          columnas={columnas}
        />
      )}

      <ModalInvitarAdministrador
        abierto={invitando}
        pendiente={pendiente}
        alCerrar={() => setInvitando(false)}
        alEnviar={(datos) => ejecutar(() => invitarAdministrador(datos), () => setInvitando(false))}
      />

      <ModalEditarAdministrador
        administrador={editando}
        pendiente={pendiente}
        alCerrar={() => setEditando(null)}
        alGuardar={(nombre) =>
          editando && ejecutar(() => editarAdministrador({ id: editando.id, nombre }), () => setEditando(null))
        }
      />

      <Modal
        abierto={desactivando !== null}
        alCerrar={() => setDesactivando(null)}
        titulo="Desactivar administrador"
        pie={
          <PieModal
            alCerrar={() => setDesactivando(null)}
            cargando={pendiente}
            etiquetaGuardar="Desactivar"
            onGuardar={() =>
              desactivando && ejecutar(() => desactivarAdministrador(desactivando.id), () => setDesactivando(null))
            }
          />
        }
      >
        <p className="text-sm text-texto-sec">
          {desactivando?.nombre} dejará de poder entrar al panel. Su cuenta y su rastro en la bitácora se
          conservan; puedes volver a activarla cuando quieras.
        </p>
      </Modal>
    </div>
  );
}

function ModalInvitarAdministrador({
  abierto,
  pendiente,
  alCerrar,
  alEnviar,
}: {
  abierto: boolean;
  pendiente: boolean;
  alCerrar: () => void;
  alEnviar: (datos: { nombre: string; correo: string }) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");

  function cerrar() {
    setNombre("");
    setCorreo("");
    alCerrar();
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={cerrar}
      titulo="Invitar administrador"
      pie={
        <PieModal
          alCerrar={cerrar}
          cargando={pendiente}
          etiquetaGuardar="Crear cuenta y enviar enlace"
          onGuardar={() => alEnviar({ nombre, correo })}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <Aviso tono="info">
          La cuenta nace <strong>inactiva</strong>. Recibirá un correo para fijar su contraseña; cuando lo haya
          hecho, actívala desde esta lista.
        </Aviso>
        <Campo
          etiqueta="Nombre"
          name="admin-nombre"
          autoComplete="name"
          required
          maxLength={120}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Campo
          etiqueta="Correo"
          name="admin-correo"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
      </div>
    </Modal>
  );
}

function ModalEditarAdministrador({
  administrador,
  pendiente,
  alCerrar,
  alGuardar,
}: {
  administrador: AdminPanel | null;
  pendiente: boolean;
  alCerrar: () => void;
  alGuardar: (nombre: string) => void;
}) {
  return (
    <Modal abierto={administrador !== null} alCerrar={alCerrar} titulo="Editar administrador">
      {administrador && (
        <FormularioNombre
          key={administrador.id}
          inicial={administrador.nombre}
          correo={administrador.correo}
          pendiente={pendiente}
          alCancelar={alCerrar}
          alGuardar={alGuardar}
        />
      )}
    </Modal>
  );
}

/**
 * El nombre se edita en un formulario propio con `key` por id: así el estado
 * arranca limpio con cada administrador sin efectos de sincronización. Lleva
 * sus propios botones en vez de PieModal para que Enter envíe el formulario.
 */
function FormularioNombre({
  inicial,
  correo,
  pendiente,
  alCancelar,
  alGuardar,
}: {
  inicial: string;
  correo: string | null;
  pendiente: boolean;
  alCancelar: () => void;
  alGuardar: (nombre: string) => void;
}) {
  const [nombre, setNombre] = useState(inicial);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        alGuardar(nombre);
      }}
    >
      <Campo
        etiqueta="Nombre"
        name="admin-nombre"
        autoComplete="name"
        required
        maxLength={120}
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />
      <p className="text-sm text-texto-sec">
        Correo: {correo ?? "sin cuenta en Auth"}. El correo no se cambia desde aquí.
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Boton type="button" variante="secundario" disabled={pendiente} onClick={alCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={pendiente}>
          Guardar nombre
        </Boton>
      </div>
    </form>
  );
}
