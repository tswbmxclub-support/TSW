import type { Metadata } from "next";

import { Aparece } from "@/lib/animaciones";
import { Acordeon, BloqueCTA, Boton, HeroPagina, Indicador, Seccion, SeccionTitulo } from "@/components/ui";
import { SEMILLEROS } from "@/config/contenido";
import { FichaNiveles } from "@/features/niveles/components/FichaNiveles";
import { listarNiveles } from "@/features/niveles/queries";
import { SelectorDeportePublico } from "@/features/publico/components/SelectorDeportePublico";
import { DEPORTES_PUBLICO, deporteDeParametros, enlaceConDeporte, type ParametrosBusqueda } from "@/features/publico/deporte-publico";

const TITULO = "Semilleros y niveles";
const DESCRIPCION =
  "La ruta de formación de la corporación deportiva TSW por deporte: semilleros y niveles con edades, horarios y criterios de promoción.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  openGraph: { title: `${TITULO} | TSW`, description: DESCRIPCION, type: "website" },
};

type Props = { searchParams: Promise<ParametrosBusqueda> };

/**
 * Niveles de formación por deporte. Server Component: los niveles se leen en
 * el servidor. Del rediseño se toman la cabecera con las cifras de la
 * metodología y la ficha por fase; se descartan la rúbrica de promoción con
 * umbrales y la ficha del entrenador, que no existen en el esquema.
 *
 * El deporte aún no filtra la consulta: `nivel` no tiene `deporte_id`.
 */
export default async function PaginaSemilleros({ searchParams }: Props) {
  const [niveles, parametros] = await Promise.all([listarNiveles(), searchParams]);
  const deporte = deporteDeParametros(parametros);

  return (
    <>
      <HeroPagina
        tono="oscuro"
        antetitulo="Formación"
        titulo={`Semilleros · ${deporte.nombre}`}
        bajada={`Del primer contacto con ${deporte.nombre} a la competencia, con criterios de promoción claros en cada etapa.`}
        lateral={<SelectorDeportePublico deportes={DEPORTES_PUBLICO} valor={deporte.id} fondo="oscuro" />}
      />

      <Seccion tono="oscuro" espaciado="compacto" className="border-t border-blanco/10" tituloId="titulo-metodologia">
        <h2 id="titulo-metodologia" className="sr-only">
          La metodología en cifras
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {SEMILLEROS.cifras.map((cifra, i) => (
            <Aparece key={cifra.id} indice={i} como="li">
              <Indicador variante="cifra" oscuro etiqueta={cifra.etiqueta} valor={cifra.valor ?? "[CIFRA]"} detalle={cifra.detalle} className="h-full" />
            </Aparece>
          ))}
        </ul>
      </Seccion>

      <Seccion tituloId="titulo-niveles">
        <Aparece>
          <SeccionTitulo id="titulo-niveles" bajada="Elige un nivel para ver su ficha completa: edades, horarios y criterios de promoción.">
            Estructura por fases
          </SeccionTitulo>
        </Aparece>
        <Aparece indice={1} className="mt-8">
          <FichaNiveles niveles={niveles} />
        </Aparece>
      </Seccion>

      <Seccion tono="claro" tituloId="titulo-preguntas">
        <Aparece>
          <SeccionTitulo id="titulo-preguntas">Preguntas frecuentes</SeccionTitulo>
        </Aparece>
        <Aparece indice={1} className="mt-8 max-w-3xl">
          <Acordeon items={[...SEMILLEROS.preguntas]} />
        </Aparece>
      </Seccion>

      <BloqueCTA
        tituloId="titulo-cta-semilleros"
        titulo="¿Listo para empezar?"
        texto="Descarga los documentos de matrícula y radícalos en la sede."
        acciones={
          <Boton href={enlaceConDeporte("/matriculas", deporte.id)} fondo="franja" tamano="lg">
            Ver documentos de matrícula
          </Boton>
        }
      />
    </>
  );
}
