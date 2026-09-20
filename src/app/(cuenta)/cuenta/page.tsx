import type { Metadata } from "next";

import { Boton, ResumenCuenta, TarjetaJersey, TarjetaMensualidad } from "@/components/ui";
import {
  JERSEY_MUESTRA,
  MENSUALIDAD_ACTUAL_MUESTRA,
  RESUMEN_CUENTA_MUESTRA,
} from "@/features/cuenta/datos-de-muestra";

export const metadata: Metadata = { title: "Resumen" };

/**
 * Resumen de la cuenta de usuario: quién es, a qué deportistas cubre, el mes
 * actual destacado y el jersey. Todo sale del archivo de datos de muestra.
 */
export default function PaginaCuenta() {
  const jersey = JERSEY_MUESTRA;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl sm:text-4xl">Mi cuenta</h1>

      <ResumenCuenta
        titular={RESUMEN_CUENTA_MUESTRA.titular}
        deportistas={RESUMEN_CUENTA_MUESTRA.deportistas}
        enlaceHistorial={{ href: "/cuenta/mensualidades", etiqueta: "Ver mensualidades →" }}
      />

      <section aria-labelledby="titulo-mes-actual" className="flex flex-col gap-3">
        <h2 id="titulo-mes-actual" className="text-lg uppercase">Mes actual</h2>
        <TarjetaMensualidad
          mes={MENSUALIDAD_ACTUAL_MUESTRA.mes}
          estado={MENSUALIDAD_ACTUAL_MUESTRA.estado}
          montoCentavos={MENSUALIDAD_ACTUAL_MUESTRA.montoCentavos}
          fecha={MENSUALIDAD_ACTUAL_MUESTRA.fecha}
          deportista={MENSUALIDAD_ACTUAL_MUESTRA.deportista}
          variante="destacada"
        />
      </section>

      <section aria-labelledby="titulo-jersey" className="flex flex-col gap-3">
        <h2 id="titulo-jersey" className="text-lg uppercase">Jersey</h2>
        <TarjetaJersey
          talla={jersey.talla}
          estado={jersey.estado}
          fechaEntrega={jersey.fechaEntrega}
          impresion={jersey.impresion}
        />
      </section>

      <div>
        <Boton href="/cuenta/mensualidades" variante="secundario">
          Ver historial completo de mensualidades
        </Boton>
      </div>
    </div>
  );
}
