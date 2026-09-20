import type { Metadata } from "next";

import { Boton, EstadoVacio, ResumenCuenta, TarjetaJersey, TarjetaMensualidad } from "@/components/ui";
import {
  JERSEY_MUESTRA,
  MENSUALIDAD_ACTUAL_MUESTRA,
  RESUMEN_CUENTA_MUESTRA,
} from "@/features/cuenta/datos-de-muestra";

export const metadata: Metadata = { title: "Resumen" };

/**
 * Resumen de la cuenta de usuario: quién es, a qué deportistas cubre, el mes
 * actual destacado y el jersey. Todo sale del archivo de datos de muestra.
 *
 * Con la cuenta sin deportistas no hay mensualidad ni jersey que mostrar: se
 * dice y se remite a la sede, en vez de pintar tarjetas vacías.
 */
export default function PaginaCuenta() {
  const cuenta = RESUMEN_CUENTA_MUESTRA;
  const sinDeportistas = cuenta.deportistas.length === 0;
  const mensualidad = sinDeportistas ? null : MENSUALIDAD_ACTUAL_MUESTRA;
  const jersey = sinDeportistas ? null : JERSEY_MUESTRA;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl sm:text-4xl">Mi cuenta</h1>

      <ResumenCuenta
        titular={cuenta.titular}
        modo={cuenta.modo}
        deportistas={cuenta.deportistas}
        enlaceHistorial={sinDeportistas ? undefined : { href: "/cuenta/mensualidades", etiqueta: "Ver mensualidades →" }}
      />

      {sinDeportistas ? (
        <EstadoVacio
          titulo="Sin deportistas vinculados"
          texto="Cuando el club vincule un deportista a tu cuenta, aquí verás su mensualidad y su jersey."
          accion={
            <Boton href="/matriculas" variante="secundario">
              Ver cómo matricular
            </Boton>
          }
        />
      ) : (
        <>
          <section aria-labelledby="titulo-mes-actual" className="flex flex-col gap-3">
            <h2 id="titulo-mes-actual" className="text-lg uppercase">Mes actual</h2>
            {mensualidad ? (
              <TarjetaMensualidad
                mes={mensualidad.mes}
                estado={mensualidad.estado}
                montoCentavos={mensualidad.montoCentavos}
                fecha={mensualidad.fecha}
                deportista={mensualidad.deportista}
                variante="destacada"
              />
            ) : (
              <EstadoVacio titulo="Sin mensualidad este mes" texto="El club todavía no ha generado la mensualidad de este mes." />
            )}
          </section>

          <section aria-labelledby="titulo-jersey" className="flex flex-col gap-3">
            <h2 id="titulo-jersey" className="text-lg uppercase">Jersey</h2>
            <TarjetaJersey
              talla={jersey?.talla ?? null}
              estado={jersey?.estado ?? "pendiente"}
              fechaEntrega={jersey?.fechaEntrega ?? null}
              impresion={jersey?.impresion}
            />
          </section>

          <div>
            <Boton href="/cuenta/mensualidades" variante="secundario">
              Ver historial completo de mensualidades
            </Boton>
          </div>
        </>
      )}
    </div>
  );
}
