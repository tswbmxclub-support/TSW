"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { useMovimientoReducido } from "@/lib/animaciones";

export type FotoGaleria = { src: string; alt: string };

/**
 * Carrusel de la ficha: una sola pista con scroll-snap (deslizar en móvil es nativo)
 * que mueven también las flechas, las miniaturas y ← →. Un único estado: `actual`.
 * Sin autoplay. Con movimiento reducido, el salto es instantáneo.
 */
export function GaleriaProducto({ fotos, nombre }: { fotos: FotoGaleria[]; nombre: string }) {
  const pista = useRef<HTMLUListElement>(null);
  // Destino de un desplazamiento lanzado por ir(); mientras exista, onScroll no toca `actual`.
  const destinoProgramado = useRef<number | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [actual, setActual] = useState(0);
  const reducido = useMovimientoReducido();
  const total = fotos.length;
  const varias = total > 1;

  const ir = useCallback(
    (indice: number) => {
      const el = pista.current;
      if (!el || total === 0) return;
      const destino = (indice + total) % total; // circular
      destinoProgramado.current = destino;
      if (temporizador.current) clearTimeout(temporizador.current);
      // Red de seguridad: si el usuario interrumpe con el dedo y nunca se llega al destino,
      // el bloqueo no puede quedar pegado.
      temporizador.current = setTimeout(() => {
        destinoProgramado.current = null;
      }, 1000);
      el.scrollTo({ left: destino * el.clientWidth, behavior: reducido ? "auto" : "smooth" });
      setActual(destino);
    },
    [total, reducido],
  );

  // Deslizar con el dedo: el índice sale de la posición del scroll.
  function alDesplazar() {
    const el = pista.current;
    if (!el || el.clientWidth === 0) return;
    const posicion = el.scrollLeft / el.clientWidth;
    if (destinoProgramado.current !== null) {
      // Desplazamiento de ir(): se ignora hasta llegar al destino.
      if (Math.abs(posicion - destinoProgramado.current) < 0.01) destinoProgramado.current = null;
      return;
    }
    const indice = Math.min(total - 1, Math.max(0, Math.round(posicion)));
    setActual((previo) => (previo === indice ? previo : indice));
  }

  // Fin del desplazamiento: libera el bloqueo donde exista «scrollend»; donde no, lo
  // liberan la llegada al destino (alDesplazar) o el temporizador.
  useEffect(() => {
    const el = pista.current;
    const liberar = () => {
      destinoProgramado.current = null;
    };
    el?.addEventListener("scrollend", liberar);
    return () => {
      el?.removeEventListener("scrollend", liberar);
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  // Al cambiar el ancho (rotar el móvil), mantener la foto actual en su sitio.
  useEffect(() => {
    function alRedimensionar() {
      const el = pista.current;
      if (el) el.scrollTo({ left: actual * el.clientWidth, behavior: "auto" });
    }
    window.addEventListener("resize", alRedimensionar);
    return () => window.removeEventListener("resize", alRedimensionar);
  }, [actual]);

  function alTeclear(evento: KeyboardEvent) {
    if (!varias) return;
    if (evento.key === "ArrowRight") {
      evento.preventDefault();
      ir(actual + 1);
    } else if (evento.key === "ArrowLeft") {
      evento.preventDefault();
      ir(actual - 1);
    }
  }

  if (total === 0) return null;

  const boton =
    "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full " +
    "bg-azul-profundo/70 text-2xl leading-none text-blanco hover:bg-azul-profundo/90 " +
    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco";

  return (
    <section
      aria-roledescription="carrusel"
      aria-label={`Fotos de ${nombre}`}
      onKeyDown={alTeclear}
      className="flex flex-col gap-3"
    >
      <div className="relative">
        <ul
          ref={pista}
          onScroll={alDesplazar}
          tabIndex={varias ? 0 : undefined}
          aria-label={varias ? "Fotos; usa las flechas del teclado para cambiar" : undefined}
          className={
            "flex aspect-square snap-x snap-mandatory overflow-x-auto overflow-y-hidden rounded-lg " +
            "border border-gris-borde bg-gris-frio [scrollbar-width:none] [&::-webkit-scrollbar]:hidden " +
            "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
          }
        >
          {fotos.map((foto, i) => (
            <li
              key={foto.src}
              className="relative h-full w-full shrink-0 snap-center"
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${total}`}
              aria-hidden={i !== actual}
            >
              <Image
                src={foto.src}
                alt={foto.alt}
                fill
                priority={i === 0}
                loading={i === 0 ? undefined : "lazy"}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </li>
          ))}
        </ul>

        {varias && (
          <>
            <button type="button" onClick={() => ir(actual - 1)} aria-label="Foto anterior" className={`${boton} left-2`}>
              <span aria-hidden="true">‹</span>
            </button>
            <button type="button" onClick={() => ir(actual + 1)} aria-label="Foto siguiente" className={`${boton} right-2`}>
              <span aria-hidden="true">›</span>
            </button>
            <span
              aria-hidden="true"
              className="absolute right-2 bottom-2 rounded-full bg-azul-profundo/70 px-2.5 py-1 text-xs font-semibold text-blanco"
            >
              {actual + 1} / {total}
            </span>
          </>
        )}
      </div>

      {/* Anuncio para lector de pantalla; el contador visual va con aria-hidden. */}
      <p className="sr-only" aria-live="polite">
        {varias ? `Foto ${actual + 1} de ${total}` : ""}
      </p>

      {varias && (
        <ul className="flex flex-wrap gap-2" aria-label="Miniaturas">
          {fotos.map((foto, i) => (
            <li key={foto.src}>
              <button
                type="button"
                onClick={() => ir(i)}
                aria-label={`Ver foto ${i + 1} de ${total}`}
                aria-current={i === actual}
                className={
                  "relative block h-14 w-14 overflow-hidden rounded-md border-2 bg-gris-frio " +
                  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco " +
                  (i === actual ? "border-acento-oscuro" : "border-gris-borde hover:border-acento-oscuro")
                }
              >
                <Image src={foto.src} alt="" fill sizes="56px" loading="lazy" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
