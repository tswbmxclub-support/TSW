"use client";

import { useEffect, useId, useRef, useState } from "react";

import { useTrampaFoco } from "@/lib/accesibilidad/trampaFoco";
import { AnimatePresence, motion, useMovimientoReducido } from "@/lib/animaciones";
import { Badge } from "./Badge";
import { cn } from "@/lib/utils";

export type OpcionDeporte = {
  id: string;
  nombre: string;
};

export type SelectorDeporteProps = {
  /** Deportes disponibles; vienen de los datos de muestra por ahora. */
  deportes: OpcionDeporte[];
  /** Id del deporte activo (controlado por la cookie tsw.deporte). */
  valor: string;
  /** Cambio de deporte. El controlador decide si persiste en cookie. */
  alCambiar: (id: string) => void;
  /** En el panel convive con fondo azul profundo; sobre fondo claro, variante invertida. */
  fondo?: "oscuro" | "claro";
  className?: string;
};

/**
 * Selector del deporte activo. En escritorio es un desplegable compacto para la
 * cabecera; en móvil, un botón que abre una hoja inferior con la lista. El
 * deporte activo se muestra con el lenguaje visual de ChipEstado: la misma
 * insignia, para que "en qué deporte estoy parado" se lea igual en todo el
 * panel y en el laboratorio.
 *
 * Accesible: abre con clic, Enter o ↓; la lista navega con ↑↓ y confirma con
 * Enter; Escape y el clic fuera cierran; en móvil el foco queda atrapado en la
 * hoja con useTrampaFoco y vuelve al botón al cerrar.
 */
export function SelectorDeporte({ deportes, valor, alCambiar, fondo = "oscuro", className }: SelectorDeporteProps) {
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState<string | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const hoja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const listaId = useId();
  const reducido = useMovimientoReducido();

  const activo = deportes.find((d) => d.id === valor) ?? deportes[0];

  useTrampaFoco(hoja, abierto);

  // Escape y clic fuera cierran (el desplegable de escritorio; la hoja móvil
  // ya los resuelve con useTrampaFoco y su velo).
  useEffect(() => {
    if (!abierto) return;

    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        setAbierto(false);
        boton.current?.focus();
      }
    }
    function alClicFuera(evento: MouseEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false);
    }

    document.addEventListener("keydown", alTeclear);
    document.addEventListener("mousedown", alClicFuera);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("mousedown", alClicFuera);
    };
  }, [abierto]);

  function abrir() {
    setResaltado(activo?.id ?? null);
    setAbierto(true);
  }

  function elegir(id: string) {
    alCambiar(id);
    setAbierto(false);
    // El foco vuelve al control, no queda perdido.
    boton.current?.focus();
  }

  /**
   * Teclas del botón cuando la lista está abierta. El foco nunca sale del
   * botón (patrón aria-activedescendant): ↑↓ mueven el resaltado, Enter o
   * Espacio confirman, Escape y Tab cierran. Si la lista está cerrada, ↓ la
   * abre. Funciona igual en escritorio; la hoja móvil no lo usa porque sus
   * opciones son botones reales que recorre el Tab.
   */
  function alTeclearBoton(evento: React.KeyboardEvent<HTMLButtonElement>) {
    if (!abierto) {
      if (evento.key === "ArrowDown") {
        evento.preventDefault();
        abrir();
      }
      return;
    }

    const indice = deportes.findIndex((d) => d.id === resaltado);
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setResaltado(deportes[(indice + 1) % deportes.length]?.id ?? null);
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setResaltado(deportes[(indice - 1 + deportes.length) % deportes.length]?.id ?? null);
    } else if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      if (resaltado) elegir(resaltado);
    } else if (evento.key === "Escape" || evento.key === "Tab") {
      setAbierto(false);
    }
  }

  if (!activo) return null;

  return (
    <div ref={contenedor} className={cn("relative", className)}>
      <button
        ref={boton}
        type="button"
        // combobox de solo selección (patrón "select-only" de WAI-ARIA): es el
        // único rol que admite aria-activedescendant con la lista aparte.
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={listaId}
        aria-activedescendant={abierto && resaltado ? `${listaId}-opcion-${resaltado}` : undefined}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={alTeclearBoton}
        className={cn(
          "flex min-h-[44px] items-center gap-2 rounded-md border px-3 text-sm font-semibold",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco",
          fondo === "oscuro"
            ? "border-blanco/25 bg-azul-medio text-blanco hover:border-blanco/50"
            : "border-gris-borde bg-blanco text-azul-profundo hover:border-azul-medio",
        )}
      >
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-acento-oscuro" />
        <span className="max-w-40 truncate">{activo.nombre}</span>
        <span aria-hidden="true" className={cn("text-xs transition-transform duration-200", abierto && "rotate-180")}>
          ▾
        </span>
        <span className="sr-only">Cambiar deporte activo. Actual: {activo.nombre}</span>
      </button>

      {/* --- Desplegable de escritorio (lg en adelante) ---------------------- */}
      <AnimatePresence>
        {abierto && (
          <motion.ul
            id={listaId}
            role="listbox"
            aria-labelledby={`${listaId}-titulo`}
            initial={reducido ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducido ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "absolute left-0 top-full z-50 mt-2 hidden w-56 overflow-hidden rounded-lg border p-1 shadow-xl lg:block",
              fondo === "oscuro"
                ? "border-blanco/15 bg-azul-medio text-blanco"
                : "border-gris-borde bg-blanco text-azul-profundo",
            )}
          >
            {deportes.map((deporte) => {
              const esActivo = deporte.id === activo.id;
              const esResaltado = deporte.id === resaltado;
              return (
                <li
                  key={deporte.id}
                  id={`${listaId}-opcion-${deporte.id}`}
                  role="option"
                  aria-selected={esActivo}
                  className={cn(
                    esResaltado && (fondo === "oscuro" ? "bg-blanco/10" : "bg-gris-frio"),
                  )}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => elegir(deporte.id)}
                    onMouseEnter={() => setResaltado(deporte.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium",
                      "min-h-[44px]",
                      esResaltado && (fondo === "oscuro" ? "bg-blanco/10" : "bg-gris-frio"),
                      !esResaltado && !esActivo && (fondo === "oscuro" ? "text-blanco/80" : "text-azul-profundo"),
                    )}
                  >
                    {deporte.nombre}
                    {esActivo && <Badge tono="acento">Activo</Badge>}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>

      {/* --- Hoja inferior de móvil (bajo lg) -------------------------------- */}
      <AnimatePresence>
        {abierto && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              aria-hidden="true"
              onClick={() => setAbierto(false)}
              className="absolute inset-0 bg-azul-profundo/70"
              initial={reducido ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reducido ? undefined : { opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.div
              ref={hoja}
              role="dialog"
              aria-modal="true"
              aria-label="Elegir deporte"
              className="absolute inset-x-0 bottom-0 rounded-t-xl bg-blanco p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-azul-profundo"
              initial={reducido ? false : { y: 48, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reducido ? undefined : { y: 48, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gris-borde" aria-hidden="true" />
              <p className="text-sm font-semibold uppercase tracking-wide text-texto-sec">Elegir deporte</p>
              <ul className="mt-3 flex flex-col gap-2">
                {deportes.map((deporte) => {
                  const esActivo = deporte.id === activo.id;
                  return (
                    <li key={deporte.id}>
                      <button
                        type="button"
                        onClick={() => elegir(deporte.id)}
                        aria-current={esActivo ? "true" : undefined}
                        className={cn(
                          "flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md border px-4 py-3 text-left font-semibold",
                          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco",
                          esActivo ? "border-acento-oscuro bg-acento-oscuro/5 text-acento-oscuro" : "border-gris-borde bg-blanco",
                        )}
                      >
                        {deporte.nombre}
                        {esActivo && <Badge tono="acento">Activo</Badge>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
