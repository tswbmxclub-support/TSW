import Link from "next/link";

import { Badge, Boton } from "@/components/ui";
import { DEPORTES, PORTADA } from "@/config/contenido";
import { SITIO } from "@/config/sitio";

/**
 * Portada de la corporación: texto y dos CTAs a la izquierda, tarjeta con los
 * deportes a la derecha (en móvil, debajo). Server Component sin foto a
 * sangre: el peso visual lo ponen el titular y la tarjeta, y así el LCP es
 * texto. Reemplaza al carrusel, que sigue en /laboratorio por si el club lo
 * quiere de vuelta.
 */
export function HeroPortal() {
  return (
    <div className="bg-azul-profundo text-blanco">
      <div className="contenedor grid gap-8 py-12 sm:py-16 lg:grid-cols-[3fr_2fr] lg:items-start lg:gap-12 lg:py-20">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tono="rojo">{PORTADA.etiquetaEntidad}</Badge>
            <Badge tono="claro">{DEPORTES.map((d) => d.nombre).join(" · ")}</Badge>
          </div>
          <h1 className="titulo-hero mt-5">{SITIO.nombreLargo}</h1>
          <p className="mt-4 max-w-xl text-lg text-blanco/85 sm:text-xl">{PORTADA.presentacion}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Boton href="/matriculas" tamano="lg">
              Ver matrículas
            </Boton>
            <Boton href="/semilleros" tamano="lg" variante="secundario" fondo="oscuro">
              Conocer los semilleros
            </Boton>
          </div>
          <p className="mt-6 text-sm text-blanco/60">{PORTADA.aval}</p>
        </div>

        <section
          aria-labelledby="titulo-hero-deportes"
          className="rounded-lg border border-blanco/15 bg-azul-medio p-5 sm:p-6"
        >
          <h2 id="titulo-hero-deportes" className="text-xs font-bold uppercase tracking-[0.2em] text-blanco/70">
            Deportes de la corporación
          </h2>
          <ul className="mt-4 flex flex-col divide-y divide-blanco/10">
            {DEPORTES.map((deporte) => (
              <li key={deporte.id}>
                <Link
                  href={`/semilleros?deporte=${deporte.id}`}
                  className="group flex min-h-[44px] items-center justify-between gap-4 py-3 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rojo"
                >
                  <span className="min-w-0">
                    <span className="block font-display text-lg uppercase leading-tight">{deporte.nombre}</span>
                    <span className="mt-0.5 block text-sm text-blanco/70">{deporte.categoria}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 font-semibold text-blanco/85 transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
