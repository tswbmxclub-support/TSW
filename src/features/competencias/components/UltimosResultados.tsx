"use client";

import { useMemo, useState } from "react";

import { Aparece } from "@/lib/animaciones";
import { Badge, Boton, Card, CardCuerpo, Tabs } from "@/components/ui";
import { formatearFecha } from "@/lib/utils";
import type { CompetenciaConResultados } from "../types";

/**
 * Bloque de resultados de la portada. Las pestañas de año refiltran de verdad:
 * los datos llegan completos desde el servidor y el filtrado es en memoria, sin
 * ida y vuelta a la red.
 *
 * Si no hay ni un resultado publicado, el bloque NO se renderiza: ni título ni
 * estado vacío. Lo pidió la cliente ("ocultar Últimos resultados mientras no
 * haya resultados"), y tiene razón: una portada que estrena con "Todavía no hay
 * competencias publicadas" anuncia que el sitio está a medias.
 *
 * La condición es tener RESULTADOS, no competencias. Una competencia publicada
 * sin podios cargados no da nada que mirar en este bloque —la tabla saldría con
 * "Resultados pendientes de publicar"—, y sigue estando en /competencias, que es
 * la página que sí las lista todas.
 */
export function UltimosResultados({
  competencias,
  limitePorAnio = 2,
}: {
  competencias: CompetenciaConResultados[];
  limitePorAnio?: number;
}) {
  const conResultados = useMemo(
    () => competencias.filter((c) => c.resultados.length > 0),
    [competencias],
  );

  const anios = useMemo(() => {
    const unicos = new Set(conResultados.map((c) => c.fecha.slice(0, 4)));
    return [...unicos].sort((a, b) => Number(b) - Number(a));
  }, [conResultados]);

  const [anio, setAnio] = useState(anios[0] ?? "");

  const visibles = useMemo(
    () => conResultados.filter((c) => c.fecha.startsWith(anio)).slice(0, limitePorAnio),
    [conResultados, anio, limitePorAnio],
  );

  // Después de los hooks, nunca antes: el orden de los hooks no puede depender
  // de los datos.
  if (conResultados.length === 0) return null;

  return (
    <section aria-labelledby="titulo-resultados" className="bg-gris-frio">
      <div className="contenedor py-16 lg:py-20">
        <Aparece>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="titulo-resultados" className="text-3xl sm:text-4xl">
              Últimos resultados
            </h2>
            <Boton href="/competencias" variante="fantasma">
              Ver todas las competencias
            </Boton>
          </div>
        </Aparece>

        <Aparece indice={1} className="mt-8">
          <Tabs
            etiqueta="Año de la competencia"
            opciones={anios.map((a) => ({ valor: a, etiqueta: a }))}
            valor={anio}
            alCambiar={setAnio}
          >
            {visibles.length === 0 ? (
              <p className="text-texto-sec">No hay competencias publicadas de {anio}.</p>
            ) : (
              <ul className="grid gap-5 lg:grid-cols-2">
                {visibles.map((competencia, i) => (
                  <Aparece key={competencia.id} indice={i} como="li">
                    <Card className="h-full">
                      <CardCuerpo>
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge tono="acento">{formatearFecha(competencia.fecha)}</Badge>
                          {competencia.destacado && <Badge tono="oscuro">Destacada</Badge>}
                        </div>

                        <h3 className="mt-3 text-xl">{competencia.titulo}</h3>

                        <table className="mt-4 w-full text-left text-sm">
                          <caption className="sr-only">
                            Resultados de {competencia.titulo}
                          </caption>
                          <thead>
                            <tr className="border-b border-gris-borde text-texto-sec">
                              <th scope="col" className="py-2 pr-3 font-semibold">
                                Puesto
                              </th>
                              <th scope="col" className="py-2 pr-3 font-semibold">
                                Rider
                              </th>
                              <th scope="col" className="py-2 font-semibold">
                                Categoría
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {competencia.resultados.slice(0, 5).map((resultado) => (
                              <tr key={resultado.id} className="border-b border-gris-borde/60">
                                <td className="py-2 pr-3 font-display text-lg text-acento-oscuro">
                                  {resultado.puesto}
                                </td>
                                <td className="py-2 pr-3">{resultado.rider}</td>
                                <td className="py-2 text-texto-sec">{resultado.categoria}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <Boton href="/competencias" variante="fantasma" tamano="sm" className="mt-4 px-0">
                          Ver el historial completo
                        </Boton>
                      </CardCuerpo>
                    </Card>
                  </Aparece>
                ))}
              </ul>
            )}
          </Tabs>
        </Aparece>
      </div>
    </section>
  );
}
