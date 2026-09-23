import { Badge, Boton, ContadorRegresivo, Seccion } from "@/components/ui";
import { formatearFecha } from "@/lib/utils";
import type { CompetenciaConResultados } from "../types";

/**
 * Próxima competencia publicada con su cuenta regresiva, sobre azul profundo.
 * Server Component salvo el contador. La competencia llega ya elegida por la
 * página (la de fecha futura más cercana); con null, el contador muestra su
 * estado vacío y el bloque lo dice sin inventar una fecha.
 *
 * `competencia.fecha` es un día del calendario (sin hora). La cuenta apunta
 * al inicio de ese día en Bogotá, que es cuando "ya es el día de la carrera".
 */
export function ProximaCompetencia({ competencia }: { competencia: CompetenciaConResultados | null }) {
  const objetivo = competencia ? `${competencia.fecha}T00:00:00-05:00` : null;

  return (
    <Seccion tono="oscuro" tituloId="titulo-proxima" espaciado="compacto" className="border-t border-blanco/10">
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-center lg:gap-10">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tono="solido">Próxima competencia</Badge>
            {competencia && <Badge tono="claro">{formatearFecha(competencia.fecha)}</Badge>}
          </div>
          <h2 id="titulo-proxima" className="mt-4 text-2xl sm:text-3xl lg:text-4xl">
            {competencia ? competencia.titulo : "Sin próxima competencia programada"}
          </h2>
          <p className="mt-3 max-w-xl text-blanco/80">
            {competencia?.cuerpo ??
              (competencia
                ? "[Descripción de la competencia: lugar, categorías y requisitos.]"
                : "El calendario se actualiza desde el panel. Mientras tanto, abajo están los resultados publicados.")}
          </p>
          {competencia && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Boton href="#titulo-historial" variante="secundario" fondo="oscuro">
                Ver resultados anteriores
              </Boton>
            </div>
          )}
        </div>
        <ContadorRegresivo
          hasta={objetivo}
          etiqueta={competencia ? competencia.titulo : "la siguiente competencia"}
          oscuro
          textoVacio="Cuando el club publique la siguiente fecha, la cuenta regresiva aparecerá aquí."
        />
      </div>
    </Seccion>
  );
}
