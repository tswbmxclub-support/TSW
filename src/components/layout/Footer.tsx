import Link from "next/link";

import { Boton } from "@/components/ui";
import {
  CONTACTO,
  ENLACES_LEGALES,
  IDENTIDAD_LEGAL,
  PIE_INSTITUCIONAL,
  PIE_SERVICIOS,
  REDES,
  SITIO,
  UBICACION,
  enlaceTelefono,
} from "@/config/sitio";

const ENLACE =
  "inline-flex min-h-[44px] items-center text-blanco/85 underline-offset-4 hover:text-blanco hover:underline " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco";

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
          {/* El NIT solo aparece confirmado con el RUT: ver IDENTIDAD_LEGAL.
              Las afiliaciones sí están en el documento de la cliente. */}
          <p className="mt-4 text-xs text-blanco/60">
            {IDENTIDAD_LEGAL.nitConfirmado && (
              <>
                NIT {IDENTIDAD_LEGAL.nit}-{IDENTIDAD_LEGAL.nitDv}
                <span aria-hidden="true"> · </span>
              </>
            )}
            {IDENTIDAD_LEGAL.reconocimiento}
            <span aria-hidden="true"> · </span>
            {IDENTIDAD_LEGAL.afiliacion}
          </p>
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
          <h2 className="text-sm uppercase tracking-widest text-blanco/60">Sedes y atención</h2>
          <address className="mt-4 flex flex-col gap-2 not-italic text-blanco/85">
            {/* Dos pistas, las del documento. No hay dirección de calle, así que
                no se pone ninguna: el barrio y la ciudad es lo que hay. */}
            <span>Sedes de entrenamiento:</span>
            <ul className="flex flex-col gap-1">
              {CONTACTO.sedes.map((sede) => (
                <li key={sede}>{sede}</li>
              ))}
            </ul>
            <span>{UBICACION}</span>
            {[CONTACTO.telefono, CONTACTO.telefonoSecundario].map((numero) => (
              <a key={numero} href={enlaceTelefono(numero)} className={ENLACE}>
                {numero}
              </a>
            ))}
            <a href={`mailto:${CONTACTO.correo}`} className={ENLACE}>
              {CONTACTO.correo}
            </a>
            <span className="text-blanco/70">{CONTACTO.horario}</span>
          </address>
          <h2 className="mt-6 text-sm uppercase tracking-widest text-blanco/60">
            Síguenos en Instagram
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {REDES.map((red) => (
              <li key={red.nombre}>
                <a href={red.url} target="_blank" rel="noreferrer noopener" className={ENLACE}>
                  {/* El arroba se saca de la propia URL: una cuenta nueva se
                      añade con su enlace y nada más. */}
                  @{red.url.split("/").filter(Boolean).pop()}
                  <span className="sr-only"> — {red.nombre}</span>
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
