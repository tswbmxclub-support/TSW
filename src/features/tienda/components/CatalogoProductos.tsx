"use client";

import { useMemo, useState } from "react";

import { Filtros, type OpcionTab } from "@/components/ui";
import { TarjetaProducto } from "./TarjetaProducto";
import type { ProductoConVariantes } from "../types";

const TODAS = "todas";

const OPCIONES_CATEGORIA: OpcionTab[] = [
  { valor: TODAS, etiqueta: "Todas" },
  { valor: "uniformes", etiqueta: "Uniformes" },
  { valor: "proteccion", etiqueta: "Protección" },
  { valor: "merchandising", etiqueta: "Merchandising" },
];

/**
 * Catálogo con filtros. El servidor entrega la lista completa ya renderizable
 * y aquí solo se filtra en memoria: no hay paginación porque el catálogo del
 * club es pequeño. RLS deja fuera lo inactivo, así que no se vuelve a preguntar.
 */
export function CatalogoProductos({ productos }: { productos: ProductoConVariantes[] }) {
  const [categoria, setCategoria] = useState(TODAS);
  const [busqueda, setBusqueda] = useState("");

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      const pasaCategoria = categoria === TODAS || p.categoria === categoria;
      const pasaBusqueda =
        texto === "" ||
        p.nombre.toLowerCase().includes(texto) ||
        (p.descripcion ?? "").toLowerCase().includes(texto);
      return pasaCategoria && pasaBusqueda;
    });
  }, [productos, categoria, busqueda]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Filtros
          etiqueta="Filtrar por categoría"
          opciones={OPCIONES_CATEGORIA}
          valor={categoria}
          alCambiar={setCategoria}
        />

        <div>
          <label htmlFor="buscar-producto" className="sr-only">
            Buscar producto por nombre
          </label>
          <input
            id="buscar-producto"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar uniforme, talla…"
            className="h-11 w-full rounded-md border-2 border-gris-borde bg-blanco px-4 text-base text-azul-profundo placeholder:text-texto-sec/70 focus:border-azul-medio focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco sm:w-64"
          />
        </div>
      </div>

      {visibles.length === 0 ? (
        <p
          role="status"
          className="mt-10 rounded-lg border-2 border-dashed border-gris-borde bg-blanco px-6 py-10 text-center text-texto-sec"
        >
          No hay productos con ese filtro.
        </p>
      ) : (
        <>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {visibles.map((p) => (
              <li key={p.id}>
                <TarjetaProducto producto={p} />
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-texto-sec">
            Mostrando {visibles.length} de {productos.length} productos.
          </p>
        </>
      )}
    </div>
  );
}
