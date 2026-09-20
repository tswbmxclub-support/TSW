import Link from "next/link";

import { Boton } from "@/components/ui";
import { CONTACTO, ENLACES_LEGALES, PIE_INSTITUCIONAL, PIE_SERVICIOS, REDES, SITIO } from "@/config/sitio";

const ENLACE =
  "inline-flex min-h-[44px] items-center text-blanco/85 underline-offset-4 hover:text-blanco hover:underline " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rojo";

/**
 * Pie de cuatro columnas, como en el rediseño: corporación, institucional,
 * servicios al deportista, sede y atención. Contacto y redes viven en la
 * última columna. El acceso al panel sigue siendo un botón discreto abajo.
 */
export function Footer() {
  const anio = new Date().getFullYear();

  return (
    <footer className="bg-azul-profundo text-blanco">
      <div className="contenedor grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-3xl">TSW</p>
          <p className="mt-3 text-sm text-blanco/70">{SITIO.nombreLargo}</p>
          <p className="mt-1 text-sm text-blanco/70">{SITIO.lema}</p>
          <p className="mt-4 text-xs text-blanco/60">[NIT y personería jurídica de la corporación]</p>
        </div>

        <nav aria-labelledby="pie-institucional">
          <h2 id="pie-institucional" className="text-sm uppercase tracking-widest text-blanco/60">
            Institucional
          </h2>
          <ul className="mt-4 flex flex-col gap-2">
            {PIE_INSTITUCIONAL.map((enlace) => (
              <li key={enlace.href + enlace.etiqueta}>
                <Link href={enlace.href} className={ENLACE}>
                  {enlace.etiqueta}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="pie-servicios">
          <h2 id="pie-servicios" className="text-sm uppercase tracking-widest text-blanco/60">
            Servicios al deportista
          </h2>
          <ul className="mt-4 flex flex-col gap-2">
            {PIE_SERVICIOS.map((enlace) => (
              <li key={enlace.href}>
                <Link href={enlace.href} className={ENLACE}>
                  {enlace.etiqueta}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-sm uppercase tracking-widest text-blanco/60">Sede y atención</h2>
          <address className="mt-4 flex flex-col gap-2 not-italic text-blanco/85">
            <span>{CONTACTO.direccion}</span>
            <span>{CONTACTO.ciudad}</span>
            <a href={`tel:${CONTACTO.telefono.replace(/[^\d+]/g, "")}`} className={ENLACE}>
              {CONTACTO.telefono}
            </a>
            <a href={`mailto:${CONTACTO.correo}`} className={ENLACE}>
              {CONTACTO.correo}
            </a>
            <span className="text-blanco/70">{CONTACTO.horario}</span>
          </address>
          <ul className="mt-4 flex flex-wrap gap-x-4">
            {REDES.map((red) => (
              <li key={red.nombre}>
                <a href={red.url} target="_blank" rel="noreferrer noopener" className={ENLACE}>
                  {red.nombre}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="zona-segura-inferior border-t border-blanco/10">
        <div className="contenedor flex flex-col gap-4 py-6 text-sm text-blanco/70 lg:flex-row lg:items-center lg:justify-between">
          <p>
            © {anio} {SITIO.nombreLargo}. Todos los derechos reservados.
          </p>
          {/* Acceso al panel: discreto, pero alcanzable desde cualquier página. */}
          <Boton href="/admin/login" variante="secundario" fondo="oscuro" tamano="sm" className="self-start lg:order-last">
            Acceso administrador
          </Boton>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {ENLACES_LEGALES.map((enlace) => (
              <li key={enlace.href}>
                <Link href={enlace.href} className={ENLACE}>
                  {enlace.etiqueta}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
