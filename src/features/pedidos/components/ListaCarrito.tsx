"use client";

import Link from "next/link";

import { Aviso, Boton, BotonWhatsApp, EstadoVacio, Skeleton, Stepper } from "@/components/ui";
import { useCarrito } from "@/features/pedidos/carrito";
import { TIENDA_MUESTRA_PRECIOS, TIENDA_QUE_CONFIRMA } from "@/config/sitio";
import { formatearPrecio } from "@/lib/utils";

const ETIQUETA_PEDIDO = TIENDA_MUESTRA_PRECIOS ? "Enviar pedido por WhatsApp" : "Pedir por WhatsApp";

/**
 * Vista del carrito. Isla de cliente: los items viven en localStorage vía
 * ProveedorCarrito y se revalidan contra la base al montar. Mientras se lee
 * y se revalida va un skeleton, no un "carrito vacío" que parpadea.
 *
 * El pedido sale por WhatsApp con el mensaje ya escrito. Tras enviarlo el
 * carrito NO se vacía solo: el visitante puede no haber completado el envío.
 */
export function ListaCarrito() {
  const { items, cargado, revalidando, retirados, unidades, subtotalCentavos, mensajeWhatsApp, cambiarCantidad, quitar, vaciar } =
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
      <div className="flex flex-col gap-6">
        {retirados > 0 && (
          <Aviso tono="aviso">
            {retirados === 1
              ? "Un artículo del carrito ya no está disponible y se quitó."
              : `${retirados} artículos del carrito ya no están disponibles y se quitaron.`}
          </Aviso>
        )}
        <EstadoVacio
          titulo="Tu carrito está vacío"
          texto="Los uniformes, la protección y el merchandising del club están en la tienda."
          accion={
            <Boton href="/tienda" fondo="franja" tamano="lg">
              Ir a la tienda
            </Boton>
          }
        />
      </div>
    );
  }

  const agotados = items.filter((i) => i.estado === "agotado").length;

  return (
    <div className="grid gap-10 lg:grid-cols-[2fr_1fr] lg:items-start">
      {/* --- Items ---------------------------------------------------------- */}
      <div className="flex flex-col gap-4" aria-busy={revalidando || undefined}>
        {retirados > 0 && (
          <Aviso tono="aviso">
            {retirados === 1
              ? "Un artículo del carrito ya no está disponible y se quitó."
              : `${retirados} artículos del carrito ya no están disponibles y se quitaron.`}
          </Aviso>
        )}

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
                    className="text-lg font-semibold text-azul-profundo hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
                  >
                    {item.nombreProducto}
                  </Link>
                  <p className="mt-1 text-sm text-texto-sec">
                    Talla {item.talla}
                    {TIENDA_MUESTRA_PRECIOS && <> · {formatearPrecio(item.precioCentavos ?? 0)} c/u</>}
                  </p>
                </div>

                <div className="flex flex-wrap items-end gap-4">
                  {item.estado === "disponible" && (
                    <Stepper
                      etiqueta="Cantidad"
                      valor={item.cantidad}
                      alCambiar={(cantidad) => cambiarCantidad(item.varianteId, cantidad)}
                      min={1}
                      max={item.disponible}
                      ayuda={item.disponible <= 5 ? `Máximo ${item.disponible}` : undefined}
                    />
                  )}
                  {TIENDA_MUESTRA_PRECIOS && (
                    <div className="text-right">
                      <p className="text-sm text-texto-sec">Subtotal</p>
                      <p className="font-display text-xl text-azul-profundo">
                        {item.estado === "disponible" ? formatearPrecio(item.cantidad * (item.precioCentavos ?? 0)) : "—"}
                      </p>
                    </div>
                  )}
                  <Boton variante="fantasma" onClick={() => quitar(item.varianteId)}>
                    <span aria-hidden="true">✕</span>
                    <span className="sr-only">
                      Quitar {item.nombreProducto} talla {item.talla} del carrito
                    </span>
                  </Boton>
                </div>
              </div>

              {item.aviso && (
                <Aviso tono={item.estado === "agotado" ? "error" : "aviso"} className="mt-4">
                  {item.aviso}
                </Aviso>
              )}
            </li>
          ))}
        </ul>
      </div>

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
          {agotados > 0 && (
            <div className="flex justify-between">
              <dt className="text-texto-sec">Sin stock (no van en el pedido)</dt>
              <dd className="font-semibold text-azul-profundo">{agotados}</dd>
            </div>
          )}
          {TIENDA_MUESTRA_PRECIOS && (
            <div className="flex justify-between border-t border-gris-borde pt-3 text-base">
              <dt className="font-semibold text-azul-profundo">Total</dt>
              <dd className="font-display text-2xl text-azul-profundo">
                {formatearPrecio(subtotalCentavos)}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-6 flex flex-col gap-3">
          {/* "Pedir por WhatsApp" con la tienda en modo catálogo: es el botón que
              la cliente pidió por ese nombre, y sin precios "enviar el pedido"
              promete más de lo que es —esto pide, no compra—. */}
          {mensajeWhatsApp ? (
            <BotonWhatsApp texto={mensajeWhatsApp} completo>
              {ETIQUETA_PEDIDO}
            </BotonWhatsApp>
          ) : (
            <Boton disabled completo>
              {ETIQUETA_PEDIDO}
            </Boton>
          )}
          <Boton variante="fantasma" onClick={vaciar} completo>
            Vaciar carrito
          </Boton>
        </div>

        <div className="mt-4">
          <Aviso tono="info" titulo="Cómo funciona el pedido">
            Al enviar se abre WhatsApp con el pedido ya escrito: {TIENDA_QUE_CONFIRMA}. El
            carrito no se vacía solo: vacíalo cuando el club te confirme.
          </Aviso>
        </div>
      </aside>
    </div>
  );
}
