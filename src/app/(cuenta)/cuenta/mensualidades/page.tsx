import type { Metadata } from "next";

import { Boton, EstadoVacio, TarjetaMensualidad } from "@/components/ui";
import { HISTORIAL_MENSUALIDADES_MUESTRA } from "@/features/cuenta/datos-de-muestra";

export const metadata: Metadata = { title: "Mensualidades" };

/**
 * Historial completo de mensualidades por deportista, agrupado por año. Las
 * tarjetas van en variante compacta; el mes vivo se distingue solo en el
 * resumen.
 */
export default function PaginaMensualidades() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl sm:text-4xl">Mensualidades</h1>
        <p className="mt-2 text-texto-sec">Historial de pagos por deportista, agrupado por año.</p>
      </div>

      {HISTORIAL_MENSUALIDADES_MUESTRA.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay mensualidades registradas"
          texto="Aparecerán aquí a medida que el club las genere y registre los pagos."
          accion={
            <Boton href="/cuenta" variante="secundario">
              Volver al resumen
            </Boton>
          }
        />
      ) : (
        HISTORIAL_MENSUALIDADES_MUESTRA.map((grupo) => (
          <section key={grupo.anio} aria-labelledby={`titulo-anio-${grupo.anio}`} className="flex flex-col gap-4">
            <h2 id={`titulo-anio-${grupo.anio}`} className="text-2xl">
              {grupo.anio}
            </h2>
            {grupo.mensualidades.length === 0 && (
              <p className="text-sm text-texto-sec">Sin mensualidades registradas en {grupo.anio}.</p>
            )}
            <ul className="grid gap-3 lg:grid-cols-2">
              {grupo.mensualidades.map((m) => (
                <li key={m.id}>
                  <TarjetaMensualidad
                    mes={m.mes}
                    estado={m.estado}
                    montoCentavos={m.montoCentavos}
                    fecha={m.fecha}
                    deportista={m.deportista}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
