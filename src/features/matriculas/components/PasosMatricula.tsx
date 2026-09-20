import { PasosRuta, type PasoRuta } from "@/components/ui";
import { CONTACTO } from "@/config/sitio";

/**
 * Los cuatro pasos del proceso, en la hoja de ruta del rediseño. Lo que el
 * club todavía no ha confirmado va entre corchetes; el resto describe el
 * flujo tal como lo define el README: descarga, diligenciamiento y radicación
 * presencial.
 */
const PASOS: PasoRuta[] = [
  {
    id: "descargar",
    numero: "01",
    etiqueta: "Descarga",
    titulo: "Descarga los documentos",
    texto: (
      <>
        <p>
          Baja los formatos vigentes de la lista de abajo. Cada archivo muestra su versión y su fecha
          de publicación: usa siempre el más reciente.
        </p>
        <p className="mt-2">Si un documento aparece como pendiente de publicar, aún no está disponible.</p>
      </>
    ),
    pie: "Impresión requerida",
  },
  {
    id: "diligenciar",
    numero: "02",
    etiqueta: "Formatos",
    titulo: "Diligencia e imprime",
    texto: (
      <>
        <p>Completa cada formato con los datos del deportista y de la persona responsable, e imprímelos.</p>
        <p className="mt-2">[Indicar si se firman a mano o se aceptan firmas digitales.]</p>
      </>
    ),
    pie: "Datos del deportista y del acudiente",
  },
  {
    id: "anexos",
    numero: "03",
    etiqueta: "Anexos",
    titulo: "Reúne los anexos",
    texto: (
      <>
        <p>Junto con los formatos diligenciados, prepara:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>[Documento de identidad del deportista]</li>
          <li>[Documento de identidad del acudiente]</li>
          <li>[Certificado médico o afiliación a salud]</li>
          <li>[Otros anexos que pida el club]</li>
        </ul>
      </>
    ),
    pie: "[Lo que acompaña a los formatos]",
  },
  {
    id: "radicar",
    numero: "04",
    etiqueta: "Presencial",
    titulo: "Radica en la sede",
    texto: (
      <>
        <p>Entrega la carpeta completa en la sede del club. No hay radicación en línea.</p>
        <dl className="mt-3 grid gap-2">
          <div>
            <dt className="font-semibold text-azul-profundo">Dirección</dt>
            <dd>
              {CONTACTO.direccion}, {CONTACTO.ciudad}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-azul-profundo">Horario de atención</dt>
            <dd>{CONTACTO.horario}</dd>
          </div>
        </dl>
      </>
    ),
    pie: "Solo en sede",
  },
];

/** Proceso de matrícula: cuatro tarjetas numeradas. */
export function PasosMatricula() {
  return <PasosRuta pasos={PASOS} etiqueta="Pasos del proceso de matrícula" />;
}
