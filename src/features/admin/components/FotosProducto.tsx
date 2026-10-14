"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Archivo, Aviso, Boton, Campo } from "@/components/ui";
import { urlPublicaStorage } from "@/lib/supabase/storage";
import { MAXIMO_IMAGEN_BYTES, MIMES_IMAGEN } from "../constantes";
import {
  confirmarImagenProducto,
  establecerTextoAltImagen,
  prepararImagenProducto,
  quitarImagenProducto,
  reordenarImagenesProducto,
} from "../acciones-productos";
import { subirDirecto } from "../subir-directo";

/** Mismo tope que `agregar_imagen_producto`; la base es la que lo hace cumplir. */
const MAXIMO_FOTOS = 8;

type Foto = { id: string; storage_path: string; texto_alt: string | null };
type Estado = { ok: boolean; mensaje?: string; error?: string };

/**
 * Sección «Fotos» del modal Editar producto. La primera es la principal. Cada
 * cambio se guarda por su acción al instante (subir, quitar, mover, texto
 * alternativo): no depende del botón «Guardar» del formulario.
 */
export function FotosProducto({ productoId, nombre, inicial }: { productoId: string; nombre: string; inicial: Foto[] }) {
  const router = useRouter();
  const [fotos, setFotos] = useState<Foto[]>(inicial);
  // Borrador del texto alternativo por foto; se guarda al salir del campo.
  const [alts, setAlts] = useState<Record<string, string>>(() =>
    Object.fromEntries(inicial.map((f) => [f.id, f.texto_alt ?? ""])),
  );
  const [ocupado, setOcupado] = useState(false);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [porQuitar, setPorQuitar] = useState<Foto | null>(null);
  // Cambiar la clave de <Archivo> lo vacía y permite subir el mismo archivo otra vez.
  const [claveArchivo, setClaveArchivo] = useState(0);
  // Destinos del foco al quitar una foto: la tarjeta que ocupa su lugar, o el encabezado si no queda ninguna.
  const encabezado = useRef<HTMLHeadingElement>(null);
  const tarjetas = useRef(new Map<string, HTMLLIElement>());

  const lleno = fotos.length >= MAXIMO_FOTOS;

  async function subir(archivo: File | null) {
    if (!archivo) return;
    setEstado(null);
    setOcupado(true);
    const resultado = await subirDirecto(
      archivo,
      { mimesPermitidos: MIMES_IMAGEN, maximoBytes: MAXIMO_IMAGEN_BYTES },
      (mime, tamano) => prepararImagenProducto(productoId, mime, tamano),
      (ruta) => confirmarImagenProducto(productoId, ruta),
    );
    setOcupado(false);
    setEstado(resultado);
    if (resultado.ok && "foto" in resultado && resultado.foto) {
      const nueva = resultado.foto;
      setFotos((previas) => [...previas, nueva]);
      setAlts((previos) => ({ ...previos, [nueva.id]: "" }));
      setClaveArchivo((k) => k + 1);
      router.refresh();
    }
  }

  async function mover(indice: number, delta: -1 | 1) {
    const destino = indice + delta;
    if (destino < 0 || destino >= fotos.length) return;
    const nuevas = [...fotos];
    [nuevas[indice], nuevas[destino]] = [nuevas[destino]!, nuevas[indice]!];

    setEstado(null);
    setOcupado(true);
    const resultado = await reordenarImagenesProducto(productoId, nuevas.map((f) => f.id));
    setOcupado(false);
    setEstado(resultado);
    if (resultado.ok) {
      setFotos(nuevas);
      router.refresh();
    }
  }

  async function quitar(foto: Foto, indice: number) {
    setPorQuitar(null);
    setEstado(null);
    setOcupado(true);
    const resultado = await quitarImagenProducto(foto.id);
    setOcupado(false);
    setEstado(resultado);
    if (resultado.ok) {
      const restantes = fotos.filter((f) => f.id !== foto.id);
      setFotos(restantes);
      const siguiente = restantes[Math.min(indice, restantes.length - 1)];
      requestAnimationFrame(() =>
        (siguiente ? tarjetas.current.get(siguiente.id) : encabezado.current)?.focus(),
      );
      router.refresh();
    }
  }

  async function guardarAlt(foto: Foto) {
    const texto = (alts[foto.id] ?? "").trim();
    if (texto === (foto.texto_alt ?? "")) return;
    setEstado(null);
    const resultado = await establecerTextoAltImagen(foto.id, texto);
    setEstado(resultado);
    if (resultado.ok) {
      setFotos((previas) => previas.map((f) => (f.id === foto.id ? { ...f, texto_alt: texto || null } : f)));
    }
  }

  return (
    <section aria-labelledby={`fotos-${productoId}`} className="flex flex-col gap-3 border-t border-gris-borde pt-4">
      <h3 id={`fotos-${productoId}`} ref={encabezado} tabIndex={-1} className="text-base">
        Fotos
      </h3>
      <p className="text-sm text-texto-sec">La primera es la principal: sale en el catálogo.</p>

      {fotos.length === 0 && <p className="text-sm text-texto-sec">Este producto todavía no tiene fotos.</p>}

      <ol className="flex flex-col gap-3">
        {fotos.map((foto, i) => (
          <li
            key={foto.id}
            tabIndex={-1}
            ref={(el) => {
              if (el) tarjetas.current.set(foto.id, el);
              else tarjetas.current.delete(foto.id);
            }}
            className="flex flex-col gap-3 rounded-md border border-gris-borde p-3 sm:flex-row sm:items-start">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md border border-gris-borde bg-gris-frio">
              <Image
                src={urlPublicaStorage("productos", foto.storage_path)}
                alt={foto.texto_alt ?? `Foto ${i + 1} de ${nombre}`}
                fill
                sizes="96px"
                className="object-cover"
                unoptimized
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-sm font-semibold text-azul-profundo">{i === 0 ? "Foto principal" : `Foto ${i + 1}`}</p>
              <Campo
                etiqueta="Texto alternativo"
                value={alts[foto.id] ?? ""}
                maxLength={200}
                onChange={(e) => setAlts((previos) => ({ ...previos, [foto.id]: e.target.value }))}
                onBlur={() => void guardarAlt(foto)}
                ayuda="Describe la foto para quien no la ve. Se guarda al salir del campo."
              />
              {porQuitar?.id === foto.id ? (
                // Confirmación en la propia tarjeta: un diálogo dentro del modal del producto
                // pelearía por el foco y por Escape con el modal padre.
                <div role="group" aria-label={`Confirmar quitar foto ${i + 1}`} className="flex flex-col gap-2">
                  <p className="text-sm text-texto-sec">
                    Se quita de la galería y se borra el archivo.{" "}
                    <strong className="text-azul-profundo">No se puede deshacer.</strong>
                    {i === 0 && fotos.length > 1 && " La siguiente pasará a ser la principal."}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Boton tamano="sm" variante="fantasma" onClick={() => setPorQuitar(null)}>
                      Cancelar
                    </Boton>
                    <Boton tamano="sm" disabled={ocupado} onClick={() => void quitar(foto, i)}>
                      Sí, quitar<span className="sr-only"> foto {i + 1}</span>
                    </Boton>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Boton
                    tamano="sm"
                    variante="fantasma"
                    className="min-w-[44px]"
                    disabled={ocupado || i === 0}
                    onClick={() => void mover(i, -1)}
                  >
                    ↑ <span className="sr-only">Subir foto {i + 1}</span>
                  </Boton>
                  <Boton
                    tamano="sm"
                    variante="fantasma"
                    className="min-w-[44px]"
                    disabled={ocupado || i === fotos.length - 1}
                    onClick={() => void mover(i, 1)}
                  >
                    ↓ <span className="sr-only">Bajar foto {i + 1}</span>
                  </Boton>
                  <Boton tamano="sm" variante="secundario" disabled={ocupado} onClick={() => setPorQuitar(foto)}>
                    Quitar<span className="sr-only"> foto {i + 1}</span>
                  </Boton>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      <Archivo
        key={claveArchivo}
        etiqueta="Agregar foto"
        mimesPermitidos={MIMES_IMAGEN}
        descripcionTipos="JPG, PNG, WebP o AVIF"
        maximoBytes={MAXIMO_IMAGEN_BYTES}
        ayuda="Se renombra a un identificador interno; el nombre original no llega al servidor de archivos."
        alSeleccionar={(a) => void subir(a as File | null)}
        disabled={ocupado || lleno}
      />
      {lleno && (
        <p className="text-sm text-texto-sec">
          Llegaste al máximo de {MAXIMO_FOTOS} fotos. Quita una para poder agregar otra.
        </p>
      )}
      {ocupado && <p className="text-sm text-texto-sec">Guardando…</p>}
      {estado?.error && <Aviso tono="error">{estado.error}</Aviso>}
      {estado?.ok && estado.mensaje && <Aviso tono="exito">{estado.mensaje}</Aviso>}
    </section>
  );
}
