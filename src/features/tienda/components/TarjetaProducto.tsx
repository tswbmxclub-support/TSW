import Image from "next/image";

import { Badge, CardEnlace, CardCuerpo } from "@/components/ui";
import { urlPublicaStorage } from "@/lib/supabase/storage";
import { formatearPrecio } from "@/lib/utils";
import {
  BUCKET_PRODUCTOS,
  ETIQUETA_CATEGORIA,
  disponible,
  precioDesde,
  type ProductoConVariantes,
} from "../types";

/**
 * Tarjeta de catálogo con la composición del rediseño: chips sobre la foto,
 * categoría en mayúsculas pequeñas, precio a la derecha del título y las
 * tallas disponibles como texto. Server Component: no tiene estado.
 *
 * Toda la tarjeta es un enlace, así que dentro no va ningún control: el
 * selector de talla y el botón de compra viven en /tienda/[slug]. Poner
 * botones dentro de un `<a>` rompe el teclado y el lector de pantalla.
 *
 * La foto vive en el bucket `productos` (migración 12); sin ella va un
 * marcador local, igual que en competencias.
 */
export function TarjetaProducto({
  producto,
  prioridad = false,
}: {
  producto: ProductoConVariantes;
  prioridad?: boolean;
}) {
  const desde = precioDesde(producto);
  const activas = producto.variantes.filter((v) => v.activo);
  const unidades = activas.reduce((total, v) => total + disponible(v), 0);
  const agotado = unidades <= 0;
  const tallas = activas.filter((v) => disponible(v) > 0).map((v) => v.talla);
  const esMarca = producto.categoria === "merchandising";
  const foto = producto.imagen_path
    ? urlPublicaStorage(BUCKET_PRODUCTOS, producto.imagen_path)
    : "/imagenes/producto.jpg";

  return (
    <CardEnlace href={`/tienda/${producto.slug}`} className="flex h-full flex-col overflow-hidden">
      <div className="relative aspect-square bg-gris-frio">
        <Image
          src={foto}
          alt={producto.imagen_path ? `Foto de ${producto.nombre}` : `[Foto de ${producto.nombre}]`}
          fill
          priority={prioridad}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
        <span className="absolute left-3 top-3 flex flex-wrap gap-2">
          {agotado && <Badge tono="oscuro">Agotado</Badge>}
          {esMarca && !agotado && <Badge tono="oscuro">Marca TSW</Badge>}
        </span>
      </div>

      <CardCuerpo className="flex flex-1 flex-col">
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-texto-sec">
          {ETIQUETA_CATEGORIA[producto.categoria]}
        </span>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h3 className="text-lg leading-snug">{producto.nombre}</h3>
          <p className="shrink-0 text-right font-display text-xl text-azul-profundo">
            {desde === null ? (
              <span className="text-sm font-normal text-texto-sec">Precio pendiente</span>
            ) : (
              <>
                <span className="block text-xs font-normal uppercase tracking-wide text-texto-sec">Desde</span>
                {formatearPrecio(desde)}
              </>
            )}
          </p>
        </div>
        {producto.descripcion && <p className="mt-2 line-clamp-2 text-sm text-texto-sec">{producto.descripcion}</p>}

        <div className="mt-auto pt-4">
          {tallas.length > 0 ? (
            <p className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="mr-1 text-xs font-bold uppercase tracking-wide text-texto-sec">Tallas</span>
              {tallas.map((talla) => (
                <span key={talla} className="rounded-md border border-gris-borde px-2 py-0.5 font-semibold text-azul-profundo">
                  {talla}
                </span>
              ))}
            </p>
          ) : (
            <p className="text-sm text-texto-sec">Sin unidades disponibles por ahora.</p>
          )}
          <span
            aria-hidden="true"
            className="mt-3 inline-flex items-center gap-2 font-semibold text-azul-profundo transition-transform group-hover:translate-x-1"
          >
            Ver producto →
          </span>
        </div>
      </CardCuerpo>
    </CardEnlace>
  );
}
