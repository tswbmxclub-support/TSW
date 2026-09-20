"use client";

import { useMemo, useState } from "react";

import {
  Aviso,
  Boton,
  Campo,
  ChipEstado,
  EstadoVacio,
  ETIQUETA_ESTADO_MENSUALIDAD,
  Filtros,
  Modal,
  PieModal,
  Select,
  TablaResponsiva,
  type ColumnaTabla,
} from "@/components/ui";
import {
  MENSUALIDADES_DEL_MES_MUESTRA,
  type EstadoMensualidad,
  type MensualidadDelMesMuestra,
} from "@/features/cuenta/datos-de-muestra";

const TODOS = "todos";

const OPCIONES_ESTADO = [
  { valor: TODOS, etiqueta: "Todos" },
  ...(Object.entries(ETIQUETA_ESTADO_MENSUALIDAD) as [EstadoMensualidad, string][]).map(([valor, etiqueta]) => ({
    valor,
    etiqueta,
  })),
];

/**
 * Mensualidades del mes en curso, deportista por deportista, sin importar el
 * titular: es la vista con la que el club cobra ("quién no ha pagado este
 * mes"). Filtro por estado y "Registrar pago" en cada fila; el modal es de
 * vista previa y no persiste nada.
 *
 * Cuando exista el esquema, la fila vendrá de una consulta por mes y deporte
 * activo, y el botón llamará a la RPC de registro de pago con p_actor_id.
 */
export function MensualidadesDelMesAdmin({ deporteNombre }: { deporteNombre: string }) {
  const [estado, setEstado] = useState(TODOS);
  const [fila, setFila] = useState<MensualidadDelMesMuestra | null>(null);

  const visibles = useMemo(
    () => MENSUALIDADES_DEL_MES_MUESTRA.filter((m) => estado === TODOS || m.estado === estado),
    [estado],
  );

  const columnas: ColumnaTabla<MensualidadDelMesMuestra>[] = [
    { clave: "deportista", titulo: "Deportista", principal: true, render: (m) => m.deportista },
    { clave: "titular", titulo: "Titular", render: (m) => m.titular },
    { clave: "deporte", titulo: "Deporte", render: (m) => m.deporte },
    { clave: "estado", titulo: "Estado", render: (m) => <ChipEstado tipo="mensualidad" valor={m.estado} /> },
    { clave: "fecha", titulo: "Fecha", render: (m) => m.fecha, className: "whitespace-nowrap" },
    {
      clave: "accion",
      titulo: "Acción",
      alinear: "derecha",
      render: (m) =>
        m.estado === "pagada" ? (
          <span className="text-sm text-texto-sec">Sin pendiente</span>
        ) : (
          <Boton tamano="sm" onClick={() => setFila(m)}>
            Registrar pago
            <span className="sr-only">: {m.deportista}</span>
          </Boton>
        ),
    },
  ];

  const pendientes = MENSUALIDADES_DEL_MES_MUESTRA.filter((m) => m.estado !== "pagada").length;

  return (
    <div className="flex flex-col gap-6">
      <Aviso tono="info">
        Vista previa con datos de muestra. Mes: [MES ACTUAL] · deporte activo: {deporteNombre} (aún no filtra).
      </Aviso>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Filtros etiqueta="Filtrar por estado" opciones={OPCIONES_ESTADO} valor={estado} alCambiar={setEstado} />
        <p role="status" className="text-sm text-texto-sec">
          {pendientes === 1 ? "1 mensualidad sin pagar" : `${pendientes} mensualidades sin pagar`} de{" "}
          {MENSUALIDADES_DEL_MES_MUESTRA.length}
        </p>
      </div>

      {visibles.length === 0 ? (
        <EstadoVacio titulo="Nada con ese estado" texto="Prueba con otro filtro." />
      ) : (
        <TablaResponsiva caption="Mensualidades del mes por deportista" columnas={columnas} filas={visibles} claveFila={(m) => m.id} />
      )}

      <Modal
        abierto={fila !== null}
        alCerrar={() => setFila(null)}
        titulo="Registrar pago"
        pie={<PieModal alCerrar={() => setFila(null)} onGuardar={() => setFila(null)} etiquetaGuardar="Registrar" />}
      >
        <div className="flex flex-col gap-4">
          <Aviso tono="info">Vista previa: esta acción se conecta en la siguiente etapa.</Aviso>
          <Campo etiqueta="Deportista" name="pago-mes-deportista" disabled defaultValue={fila?.deportista ?? ""} />
          <Campo etiqueta="Mes" name="pago-mes-mes" disabled defaultValue="[MES ACTUAL]" />
          <Select
            etiqueta="Medio de pago"
            name="pago-mes-medio"
            opciones={[
              { valor: "transferencia", etiqueta: "Transferencia" },
              { valor: "nequi", etiqueta: "Nequi" },
              { valor: "efectivo", etiqueta: "Efectivo en sede" },
            ]}
          />
          <Campo etiqueta="Referencia" name="pago-mes-referencia" required placeholder="[REFERENCIA]" />
        </div>
      </Modal>
    </div>
  );
}
