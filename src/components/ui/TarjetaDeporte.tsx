import Image from "next/image";
import Link from "next/link";

import { Badge } from "./Badge";
import { cn } from "@/lib/utils";

export type TarjetaDeporteProps = {
  nombre: string;
  /** Etiqueta corta sobre la foto: "Semilleros", "Alto rendimiento". */
  categoria?: string;
  descripcion: string;
  /** Dos o tres puntos cortos con lo que ofrece el deporte. */
  puntos?: string[];
  /** Foto horizontal. Sin ella va el marcador local. */
  imagen?: string | null;
  alt?: string;
  /** Destino del enlace del pie; sin él, la tarjeta es solo informativa. */
  href?: string;
  etiquetaEnlace?: string;
  /** Texto pequeño a la izquierda del enlace: "Cupos por semestre". */
  pie?: string;
  className?: string;
};

/**
 * Tarjeta de un deporte de la corporación: foto con chip, título, texto,
 * lista de puntos y pie con enlace. Server Component. Solo el enlace del pie
 * es interactivo, para no meter controles dentro de un `<a>` de tarjeta.
 */
export function TarjetaDeporte({
  nombre,
  categoria,
  descripcion,
  puntos = [],
  imagen,
  alt,
  href,
  etiquetaEnlace = "Ver más",
  pie,
  className,
}: TarjetaDeporteProps) {
  const foto = imagen ?? "/imagenes/deporte.jpg";

  return (
    <article className={cn("flex flex-col overflow-hidden rounded-lg border border-gris-borde bg-blanco", className)}>
      <div className="relative aspect-[16/9] bg-gris-frio">
        <Image
          src={foto}
          alt={alt ?? (imagen ? `Foto de ${nombre}` : `[Foto de ${nombre}]`)}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
        {categoria && (
          <span className="absolute bottom-3 left-3">
            <Badge tono="oscuro">{categoria}</Badge>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-xl leading-tight sm:text-2xl">{nombre}</h3>
        <p className="mt-2 text-sm text-texto-sec">{descripcion}</p>
        {puntos.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5 text-sm font-semibold text-azul-profundo">
            {puntos.map((punto) => (
              <li key={punto} className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-acento-oscuro" />
                <span>{punto}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(pie || href) && (
        <div className="flex items-center justify-between gap-3 border-t border-gris-borde bg-gris-frio px-5 py-2">
          <span className="text-xs font-bold uppercase tracking-wide text-texto-sec">{pie}</span>
          {href && (
            <Link
              href={href}
              className="inline-flex min-h-[44px] items-center font-semibold text-acento-oscuro underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
            >
              {etiquetaEnlace}
              <span className="sr-only">: {nombre}</span>
              <span aria-hidden="true" className="ml-1">
                →
              </span>
            </Link>
          )}
        </div>
      )}
    </article>
  );
}
