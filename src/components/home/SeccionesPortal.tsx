import Image from "next/image";

import { Aparece } from "@/lib/animaciones";
import { Card, CardCuerpo, CuentaAscendente, Indicador, ItemDescarga, Seccion, SeccionTitulo, TarjetaDeporte } from "@/components/ui";
import { CIFRAS } from "@/config/sitio";
import { BUCKET_DOCUMENTOS, type DocumentoConVersion } from "@/features/matriculas/types";
import { urlPublicaStorage } from "@/lib/supabase/storage";
import { cn, formatearFecha } from "@/lib/utils";
import { CITA_MUESTRA, DEPORTES_PUBLICO, PILARES_MUESTRA, SEDE_MUESTRA } from "@/features/publico/datos-de-muestra";

/**
 * Secciones de la portada de la corporación, en el orden del rediseño. Todas
 * son Server Components; lo único con estado es la cuenta ascendente de las
 * cifras. Cada una lee de config/sitio o de los datos de muestra públicos.
 */

/** Fila de cuatro cifras sobre azul profundo, con cuenta ascendente cuando hay dato. */
export function CifrasPortal() {
  return (
    <Seccion tono="oscuro" tituloId="titulo-cifras" espaciado="compacto" className="border-t border-blanco/10">
      <h2 id="titulo-cifras" className="sr-only">
        Cifras de la corporación
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CIFRAS.map((cifra, i) => (
          <Aparece key={cifra.etiqueta} indice={i} como="li">
            <Indicador
              variante="cifra"
              oscuro
              etiqueta={cifra.etiqueta}
              valor={
                cifra.valor === null ? (
                  "[CIFRA]"
                ) : (
                  <>
                    <CuentaAscendente hasta={cifra.valor} />
                    {cifra.sufijo}
                  </>
                )
              }
              detalle={cifra.valor === null ? "[Pendiente de confirmar por el club.]" : "[Texto de apoyo de la cifra.]"}
              className="h-full"
            />
          </Aparece>
        ))}
      </ul>
    </Seccion>
  );
}

/** Tres pilares institucionales con ícono, título, texto y remate. */
export function PilaresPortal() {
  return (
    <Seccion tono="claro" tituloId="titulo-pilares">
      <Aparece>
        <SeccionTitulo id="titulo-pilares" bajada="[Bajada: cómo entiende la corporación la formación deportiva.]">
          Nuestros pilares
        </SeccionTitulo>
      </Aparece>
      <ul className="mt-8 grid gap-5 md:grid-cols-3">
        {PILARES_MUESTRA.map((pilar, i) => (
          <Aparece key={pilar.id} indice={i + 1} como="li">
            <Card className="h-full">
              <CardCuerpo className="flex h-full flex-col">
                <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-md bg-azul-profundo text-blanco">
                  <span className="h-2.5 w-2.5 rounded-full bg-rojo" />
                </span>
                <h3 className="mt-5 text-xl leading-tight">{pilar.titulo}</h3>
                <p className="mt-2 flex-1 text-texto-sec">{pilar.texto}</p>
                <p className="mt-5 text-xs font-bold uppercase tracking-wide text-rojo-oscuro">{pilar.pie}</p>
              </CardCuerpo>
            </Card>
          </Aparece>
        ))}
      </ul>
    </Seccion>
  );
}

/** Una tarjeta por deporte de la corporación. */
export function DeportesPortal() {
  // Con dos deportes, dos columnas: una cuadrícula de tres con un hueco se ve rota.
  const columnas = DEPORTES_PUBLICO.length >= 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2";

  return (
    <Seccion tituloId="titulo-deportes">
      <Aparece>
        <SeccionTitulo id="titulo-deportes" bajada="[Bajada: los deportes que forma la corporación y cómo se organizan.]">
          Nuestros deportes
        </SeccionTitulo>
      </Aparece>
      <ul className={cn("mt-8 grid gap-5", columnas)}>
        {DEPORTES_PUBLICO.map((deporte, i) => (
          <Aparece key={deporte.id} indice={i + 1} como="li">
            <TarjetaDeporte
              nombre={deporte.nombre}
              categoria={deporte.categoria}
              descripcion={deporte.descripcion}
              puntos={deporte.puntos}
              imagen={deporte.imagen}
              href={`/semilleros?deporte=${deporte.id}`}
              etiquetaEnlace="Ver semilleros"
              pie={deporte.pie}
              className="h-full"
            />
          </Aparece>
        ))}
      </ul>
    </Seccion>
  );
}

/** Cita institucional: una tarjeta ancha con autor y cargo como placeholders. */
export function CitaPortal() {
  return (
    <Seccion tono="oscuro" espaciado="compacto">
      <Aparece>
        <figure className="rounded-lg border border-blanco/15 bg-azul-medio p-6 sm:p-8 lg:flex lg:items-center lg:gap-8">
          <span aria-hidden="true" className="font-display text-5xl leading-none text-rojo">
            “
          </span>
          <blockquote className="mt-3 flex-1 lg:mt-0">
            <p className="text-lg italic text-blanco/90 sm:text-xl">{CITA_MUESTRA.texto}</p>
          </blockquote>
          <figcaption className="mt-4 text-sm lg:mt-0 lg:shrink-0 lg:text-right">
            <span className="block font-semibold text-blanco">{CITA_MUESTRA.autor}</span>
            <span className="block text-blanco/70">{CITA_MUESTRA.cargo}</span>
          </figcaption>
        </figure>
      </Aparece>
    </Seccion>
  );
}

/**
 * Documentos publicados, hasta cuatro. Leen de la base: si hay menos, se
 * muestran los que haya y no se rellena con marcadores.
 */
export function DocumentosPortal({ documentos }: { documentos: DocumentoConVersion[] }) {
  const visibles = documentos.slice(0, 4);

  return (
    <Seccion tituloId="titulo-documentos-portal">
      <Aparece>
        <SeccionTitulo id="titulo-documentos-portal" bajada="Formatos vigentes para descargar. La radicación es presencial.">
          Documentos
        </SeccionTitulo>
      </Aparece>
      {visibles.length === 0 ? (
        <p className="mt-8 text-texto-sec">Todavía no hay documentos publicados. Aparecerán aquí en cuanto el club los suba.</p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {visibles.map((documento, i) => {
            const version = documento.version_vigente;
            return (
              <Aparece key={documento.id} indice={i + 1} como="li">
                <ItemDescarga
                  titulo={documento.titulo}
                  descripcion={documento.descripcion}
                  meta={
                    version
                      ? [`Versión ${version.version}`, `Publicado el ${formatearFecha(version.publicado_en)}`]
                      : []
                  }
                  href={version ? urlPublicaStorage(BUCKET_DOCUMENTOS, version.storage_path) : undefined}
                  nombreArchivo={version?.nombre_archivo}
                  className="h-full"
                />
              </Aparece>
            );
          })}
        </ul>
      )}
    </Seccion>
  );
}

/** Sede y canales de atención: imagen en lugar del mapa y lista de canales. */
export function SedePortal() {
  return (
    <Seccion tono="claro" tituloId="titulo-sede">
      <Aparece>
        <SeccionTitulo id="titulo-sede" bajada="[Bajada: dónde entrena la corporación y cómo se atiende a las familias.]">
          Sede y atención
        </SeccionTitulo>
      </Aparece>
      <div className="mt-8 grid gap-5 lg:grid-cols-[3fr_2fr]">
        <Aparece indice={1}>
          <Card className="h-full overflow-hidden">
            <div className="relative aspect-[16/9] bg-gris-frio">
              <Image
                src={SEDE_MUESTRA.imagen}
                alt="[Foto o mapa de la sede]"
                fill
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="object-cover"
              />
            </div>
            <CardCuerpo>
              <h3 className="text-xl leading-tight">{SEDE_MUESTRA.nombre}</h3>
              <p className="mt-2 text-texto-sec">{SEDE_MUESTRA.descripcion}</p>
            </CardCuerpo>
          </Card>
        </Aparece>
        <Aparece indice={2}>
          <Card className="h-full">
            <CardCuerpo>
              <h3 className="text-xl leading-tight">Canales de atención</h3>
              <dl className="mt-4 flex flex-col divide-y divide-gris-borde">
                {SEDE_MUESTRA.canales.map((canal) => (
                  <div key={canal.id} className="py-3">
                    <dt className="text-xs font-bold uppercase tracking-wide text-texto-sec">{canal.titulo}</dt>
                    <dd className="mt-1 text-azul-profundo">{canal.texto}</dd>
                  </div>
                ))}
              </dl>
            </CardCuerpo>
          </Card>
        </Aparece>
      </div>
    </Seccion>
  );
}
