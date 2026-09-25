"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { TIENDA_MUESTRA_PRECIOS } from "@/config/sitio";
import { formatearPrecio } from "@/lib/utils";
import { consultarVariantesCarrito, type VarianteCarrito } from "./acciones-carrito";
import { construirMensajePedido } from "./whatsapp-pedido";

/**
 * Carrito del comprador.
 *
 * Vive en localStorage porque no hay cuentas: el visitante no inicia sesión.
 * El almacenamiento guarda SOLO `varianteId` y `cantidad`. Nombre, talla,
 * precio y stock se leen de la base al montar (`consultarVariantesCarrito`,
 * anon key) y cada vez que la pestaña vuelve al frente: lo que el visitante
 * ve y lo que va en el mensaje de WhatsApp es el estado real de la tienda,
 * no el que había cuando agregó el artículo.
 *
 * El pedido no reserva stock ni crea filas: se envía por WhatsApp y el club
 * confirma disponibilidad y pago. Por eso el carrito no se vacía solo tras
 * enviar: el visitante puede no haber completado el envío.
 */
const CLAVE = "tsw.carrito.v2";
/** Versión anterior: guardaba precio y nombre. Se migra y se borra. */
const CLAVE_V1 = "tsw.carrito.v1";

/** Lo único que se persiste. */
export type LineaCarrito = {
  varianteId: string;
  cantidad: number;
};

export type EstadoItem =
  /** Con stock: cuenta en el subtotal y va en el mensaje. */
  | "disponible"
  /** Sin unidades ahora mismo: se muestra con aviso y no va en el mensaje. */
  | "agotado";

export type ItemCarrito = VarianteCarrito & {
  cantidad: number;
  estado: EstadoItem;
  /** Qué cambió respecto a lo que el visitante tenía: precio, cantidad ajustada, agotado. */
  aviso: string | null;
};

type ValorCarrito = {
  items: ItemCarrito[];
  /** false hasta leer localStorage Y revalidar contra la base: evita parpadeos. */
  cargado: boolean;
  /** Revalidación en curso (tras la primera). */
  revalidando: boolean;
  /** Artículos que ya no existen o están inactivos: se quitaron del carrito. */
  retirados: number;
  /** Unidades y subtotal solo de los artículos disponibles. */
  unidades: number;
  subtotalCentavos: number;
  /** Texto del pedido con los artículos disponibles, o null si no hay ninguno. */
  mensajeWhatsApp: string | null;
  agregar: (linea: LineaCarrito, detalle: VarianteCarrito) => void;
  cambiarCantidad: (varianteId: string, cantidad: number) => void;
  quitar: (varianteId: string) => void;
  vaciar: () => void;
  revalidar: () => Promise<void>;
};

const ContextoCarrito = createContext<ValorCarrito | null>(null);

function esLinea(valor: unknown): valor is LineaCarrito {
  if (typeof valor !== "object" || valor === null) return false;
  const l = valor as Record<string, unknown>;
  return typeof l.varianteId === "string" && typeof l.cantidad === "number" && l.cantidad > 0;
}

function leerAlmacen(): LineaCarrito[] {
  if (typeof window === "undefined") return [];
  try {
    // La v1 guardaba nombre y precio; de ella solo se rescatan id y cantidad.
    const crudo = window.localStorage.getItem(CLAVE) ?? window.localStorage.getItem(CLAVE_V1);
    window.localStorage.removeItem(CLAVE_V1);
    if (!crudo) return [];
    const datos: unknown = JSON.parse(crudo);
    if (!Array.isArray(datos)) return [];
    return datos
      .map((i: unknown) =>
        typeof i === "object" && i !== null
          ? { varianteId: (i as LineaCarrito).varianteId, cantidad: Number((i as LineaCarrito).cantidad) }
          : null,
      )
      .filter(esLinea);
  } catch {
    // localStorage puede estar bloqueado o traer basura: se empieza vacío.
    return [];
  }
}

export function ProveedorCarrito({ children }: { children: ReactNode }) {
  const [lineas, setLineas] = useState<LineaCarrito[]>([]);
  const [detalles, setDetalles] = useState<Record<string, VarianteCarrito>>({});
  const [avisos, setAvisos] = useState<Record<string, string>>({});
  const [retirados, setRetirados] = useState(0);
  const [leido, setLeido] = useState(false);
  const [revalidado, setRevalidado] = useState(false);
  const [revalidando, setRevalidando] = useState(false);

  // Las revalidaciones leen el estado por ref: se disparan desde eventos
  // (montaje, foco) y no deben capturar un cierre viejo.
  const lineasRef = useRef(lineas);
  const detallesRef = useRef(detalles);
  lineasRef.current = lineas;
  detallesRef.current = detalles;

  useEffect(() => {
    setLineas(leerAlmacen());
    setLeido(true);
  }, []);

  useEffect(() => {
    if (!leido) return;
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(lineas));
    } catch {
      // Modo privado o almacenamiento lleno: el carrito sigue en memoria.
    }
  }, [lineas, leido]);

  /**
   * Contrasta las líneas con la base y ajusta:
   *  · variante ausente (inactiva o borrada): se quita y se cuenta en `retirados`;
   *  · cantidad mayor que el stock disponible: se baja y se avisa;
   *  · sin stock: queda como `agotado`, con aviso;
   *  · precio distinto del que se tenía en memoria: se avisa.
   */
  const revalidar = useCallback(async () => {
    const actuales = lineasRef.current;
    if (actuales.length === 0) {
      setDetalles({});
      setRevalidado(true);
      return;
    }

    setRevalidando(true);
    try {
      const frescos = await consultarVariantesCarrito(actuales.map((l) => l.varianteId));
      const porId = Object.fromEntries(frescos.map((v) => [v.varianteId, v]));
      const previos = detallesRef.current;
      const nuevosAvisos: Record<string, string> = {};
      let quitados = 0;

      const ajustadas = actuales.flatMap((linea) => {
        const fresco = porId[linea.varianteId];
        if (!fresco) {
          quitados++;
          return [];
        }
        const notas: string[] = [];
        const previo = previos[linea.varianteId];
        // Con la tienda en modo catálogo el visitante nunca vio un precio, así
        // que avisarle de que "cambió" solo lo confundiría.
        if (TIENDA_MUESTRA_PRECIOS && previo && previo.precioCentavos !== fresco.precioCentavos) {
          notas.push(`El precio cambió de ${formatearPrecio(previo.precioCentavos)} a ${formatearPrecio(fresco.precioCentavos)}.`);
        }
        let ajustada = linea;
        if (fresco.disponible <= 0) {
          notas.push("Se agotó: no irá en el pedido. Puedes dejarlo por si vuelve a haber unidades.");
        } else if (linea.cantidad > fresco.disponible) {
          notas.push(`Solo quedan ${fresco.disponible} unidad${fresco.disponible === 1 ? "" : "es"}: ajustamos la cantidad.`);
          ajustada = { ...linea, cantidad: fresco.disponible };
        }
        if (notas.length > 0) nuevosAvisos[linea.varianteId] = notas.join(" ");
        return [ajustada];
      });

      setDetalles(porId);
      setAvisos(nuevosAvisos);
      if (quitados > 0) {
        setRetirados((r) => r + quitados);
        setLineas(ajustadas);
      } else if (ajustadas.some((l, i) => l.cantidad !== actuales[i]?.cantidad)) {
        setLineas(ajustadas);
      }
    } catch {
      // Sin red o con error del servidor se conserva lo que había: el
      // visitante sigue viendo su carrito y se reintenta al volver a la pestaña.
    } finally {
      setRevalidando(false);
      setRevalidado(true);
    }
  }, []);

  // Al montar (tras leer localStorage) y cada vez que la pestaña vuelve al frente.
  useEffect(() => {
    if (!leido) return;
    void revalidar();
    const alVolver = () => {
      if (document.visibilityState === "visible") void revalidar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [leido, revalidar]);

  const agregar = useCallback((nueva: LineaCarrito, detalle: VarianteCarrito) => {
    // El detalle que llega es el de la página de producto: sirve para mostrar
    // el artículo al instante; la revalidación lo contrasta enseguida.
    setDetalles((previos) => ({ ...previos, [nueva.varianteId]: detalle }));
    setAvisos((previos) => {
      const resto = { ...previos };
      delete resto[nueva.varianteId];
      return resto;
    });
    setLineas((previas) => {
      const existente = previas.find((l) => l.varianteId === nueva.varianteId);
      if (!existente) return [...previas, { ...nueva, cantidad: Math.min(nueva.cantidad, detalle.disponible) }];
      // La misma talla del mismo producto suma, no duplica la línea.
      const cantidad = Math.min(existente.cantidad + nueva.cantidad, detalle.disponible);
      return previas.map((l) => (l.varianteId === nueva.varianteId ? { ...l, cantidad } : l));
    });
    // Se deja pasar el render para que la ref vea la línea nueva.
    window.setTimeout(() => void revalidar(), 0);
  }, [revalidar]);

  const cambiarCantidad = useCallback((varianteId: string, cantidad: number) => {
    const tope = detallesRef.current[varianteId]?.disponible ?? cantidad;
    setLineas((previas) =>
      previas.flatMap((l) => {
        if (l.varianteId !== varianteId) return [l];
        const acotada = Math.max(0, Math.min(cantidad, tope));
        return acotada === 0 ? [] : [{ ...l, cantidad: acotada }];
      }),
    );
  }, []);

  const quitar = useCallback((varianteId: string) => {
    setLineas((previas) => previas.filter((l) => l.varianteId !== varianteId));
  }, []);

  const vaciar = useCallback(() => {
    setLineas([]);
    setAvisos({});
    setRetirados(0);
  }, []);

  const valor = useMemo<ValorCarrito>(() => {
    const items: ItemCarrito[] = lineas.flatMap((linea) => {
      const detalle = detalles[linea.varianteId];
      // Sin detalle todavía (antes de la primera revalidación) no se pinta.
      if (!detalle) return [];
      return [
        {
          ...detalle,
          cantidad: linea.cantidad,
          estado: detalle.disponible > 0 ? "disponible" : "agotado",
          aviso: avisos[linea.varianteId] ?? null,
        },
      ];
    });
    const disponibles = items.filter((i) => i.estado === "disponible");
    const subtotalCentavos = disponibles.reduce((total, i) => total + i.cantidad * i.precioCentavos, 0);

    return {
      items,
      cargado: leido && revalidado,
      revalidando,
      retirados,
      unidades: disponibles.reduce((total, i) => total + i.cantidad, 0),
      subtotalCentavos,
      mensajeWhatsApp: disponibles.length === 0 ? null : construirMensajePedido(disponibles, subtotalCentavos),
      agregar,
      cambiarCantidad,
      quitar,
      vaciar,
      revalidar,
    };
  }, [lineas, detalles, avisos, leido, revalidado, revalidando, retirados, agregar, cambiarCantidad, quitar, vaciar, revalidar]);

  return <ContextoCarrito.Provider value={valor}>{children}</ContextoCarrito.Provider>;
}

export function useCarrito(): ValorCarrito {
  const valor = useContext(ContextoCarrito);
  if (!valor) throw new Error("useCarrito debe usarse dentro de <ProveedorCarrito>.");
  return valor;
}
