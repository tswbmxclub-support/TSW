"use client";

import { useMemo, useState } from "react";

import { Aviso, Boton, Stepper } from "@/components/ui";
import { useCarrito } from "@/features/pedidos/carrito";
import { formatearPrecio } from "@/lib/utils";
import { disponible, type ProductoConVariantes } from "../types";

/**
 * Tallas y compra del detalle de producto. Isla de cliente: lo único que
 * cambia en el navegador es la talla elegida, la cantidad y el mensaje de
 * confirmación. El precio viaja con el item; el cobrado lo recalcula la base
 * al confirmar el checkout.
 */
export function SelectorVariantes({ producto }: { producto: ProductoConVariantes }) {
  const { agregar } = useCarrito();
  const variantes = useMemo(
    () => producto.variantes.filter((v) => v.activo),
    [producto.variantes],
  );
  const [varianteId, setVarianteId] = useState<string | null>(variantes[0]?.id ?? null);
  const [cantidad, setCantidad] = useState(1);
  const [agregado, setAgregado] = useState(false);

  const variante = variantes.find((v) => v.id === varianteId) ?? null;
  const unidades = variante ? disponible(variante) : 0;
  const agotado = variantes.length === 0 || variantes.every((v) => disponible(v) <= 0);

  function alAgregar() {
    if (!variante || unidades <= 0) return;
    agregar({
      varianteId: variante.id,
      productoSlug: producto.slug,
      nombreProducto: producto.nombre,
      talla: variante.talla,
      precioCentavos: variante.precio_centavos,
      cantidad: Math.min(cantidad, unidades),
      maximo: unidades,
    });
    setCantidad(1);
    setAgregado(true);
    // El mensaje se va solo: el carrito sigue siendo el canal principal.
    window.setTimeout(() => setAgregado(false), 4000);
  }

  if (agotado) {
    return (
      <Aviso tono="info" titulo="Sin unidades disponibles">
        Este producto no tiene stock activo en este momento. Vuelve más tarde o
        pregunta en el club por la próxima reposición.
      </Aviso>
    );
  }

  return (
    <div>
      {variantes.length > 0 && (
        <fieldset>
          <legend className="text-sm font-semibold text-azul-profundo">Talla</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {variantes.map((v) => {
              const unidadesTalla = disponible(v);
              const sinStock = unidadesTalla <= 0;
              const activa = v.id === varianteId;
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={activa}
                  disabled={sinStock}
                  onClick={() => {
                    setVarianteId(v.id);
                    setCantidad(1);
                    setAgregado(false);
                  }}
                  className={cnBotonTalla(activa, sinStock)}
                >
                  {v.talla}
                  {sinStock && <span className="sr-only"> (agotada)</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {variante && (
        <p className="mt-3 text-sm text-texto-sec">
          {unidades <= 5 ? `¡Quedan ${unidades} unidades!` : `${unidades} unidades disponibles`}{" "}
          · {formatearPrecio(variante.precio_centavos)}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-end gap-6">
        {variante && unidades > 0 && (
          <Stepper
            etiqueta="Cantidad"
            valor={cantidad}
            alCambiar={(valor) => {
              setCantidad(valor);
              setAgregado(false);
            }}
            min={1}
            max={unidades}
            ayuda={unidades <= 5 ? `Máximo ${unidades} por compra` : undefined}
          />
        )}

        <Boton onClick={alAgregar} disabled={!variante || unidades <= 0} tamano="lg">
          Agregar al carrito
        </Boton>
      </div>

      {agregado && (
        <div className="mt-4">
          <Aviso tono="exito">
            <span aria-hidden="true">🛒 </span>
            Agregado: {producto.nombre} · talla {variante?.talla}.{" "}
            <a href="/carrito" className="font-semibold underline">
              Ir al carrito
            </a>
          </Aviso>
        </div>
      )}
    </div>
  );
}

function cnBotonTalla(activa: boolean, sinStock: boolean): string {
  return [
    "min-h-[44px] min-w-[56px] rounded-md border-2 px-4 py-2 text-base font-semibold transition-colors",
    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rojo",
    sinStock
      ? "cursor-not-allowed border-gris-borde bg-gris-frio text-texto-sec/60 line-through"
      : activa
        ? "border-rojo bg-rojo text-blanco"
        : "border-gris-borde bg-blanco text-azul-profundo hover:border-azul-medio",
  ].join(" ");
}
