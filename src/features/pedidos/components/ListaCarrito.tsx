"use client";

import Link from "next/link";

import { Aviso, Boton, EstadoVacio, Skeleton, Stepper } from "@/components/ui";
import { useCarrito } from "@/features/pedidos/carrito";
import { formatearPrecio } from "@/lib/utils";

/**
 * Vista del carrito. Isla de cliente: los items viven en localStorage vía
 * ProveedorCarrito. Mientras localStorage se lee va un skeleton, no un
 * "carrito vacío" que parpadea.
 */
export function ListaCarrito() {
  const { items, cargado, unidades, subtotalCentavos, cambiarCantidad, quitar, vaciar } =
    useCarrito();

  if (!cargado) {
    return (
      <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EstadoVacio
        titulo="Tu carrito está vacío"
        texto="Los uniformes, la protección y el merchandising del club están en la tienda."
        accion={
          <Boton href="/tienda" fondo="acento" tamano="lg">
            Ir a la tienda
          </Boton>
        }
      />
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[2fr_1fr] lg:items-start">
      {/* --- Items ---------------------------------------------------------- */}
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li
            key={item.varianteId}
            className="rounded-lg border border-gris-borde bg-blanco p-4 sm:p-5"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Link
                  href={`/tienda/${item.productoSlug}`}
                  className="text-lg font-semibold text-azul-profundo hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rojo"
                >
                  {item.nombreProducto}
                </Link>
                <p className="mt-1 text-sm text-texto-sec">
                  Talla {item.talla} · {formatearPrecio(item.precioCentavos)} c/u
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-4">
                <Stepper
                  etiqueta="Cantidad"
                  valor={item.cantidad}
                  alCambiar={(cantidad) => cambiarCantidad(item.varianteId, cantidad)}
                  min={1}
                  max={item.maximo}
                  ayuda={item.maximo <= 5 ? `Máximo ${item.maximo}` : undefined}
                />
                <div className="text-right">
                  <p className="text-sm text-texto-sec">Subtotal</p>
                  <p className="font-display text-xl text-azul-profundo">
                    {formatearPrecio(item.cantidad * item.precioCentavos)}
                  </p>
                </div>
                <Boton variante="fantasma" onClick={() => quitar(item.varianteId)}>
                  <span aria-hidden="true">✕</span>
                  <span className="sr-only">
                    Quitar {item.nombreProducto} talla {item.talla} del carrito
                  </span>
                </Boton>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* --- Resumen -------------------------------------------------------- */}
      <aside
        aria-label="Resumen del pedido"
        className="rounded-lg border border-gris-borde bg-blanco p-6 lg:sticky lg:top-28"
      >
        <h2 className="text-xl font-display uppercase">Resumen</h2>

        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-texto-sec">Artículos</dt>
            <dd className="font-semibold text-azul-profundo">
              {unidades} unidad{unidades === 1 ? "" : "es"}
            </dd>
          </div>
          <div className="flex justify-between border-t border-gris-borde pt-3 text-base">
            <dt className="font-semibold text-azul-profundo">Subtotal</dt>
            <dd className="font-display text-2xl text-azul-profundo">
              {formatearPrecio(subtotalCentavos)}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col gap-3">
          <Boton disabled tamano="lg" completo>
            Finalizar compra
          </Boton>
          <Boton variante="fantasma" onClick={vaciar} completo>
            Vaciar carrito
          </Boton>
        </div>

        <div className="mt-4">
          <Aviso tono="info" titulo="Pago con Wompi">
            El checkout en línea se activa en cuanto quede conectada la pasarela. El total
            definitivo lo calcula el servidor al confirmar el pedido.
          </Aviso>
        </div>
      </aside>
    </div>
  );
}
