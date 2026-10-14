"use server";

import { exigirAdmin } from "@/lib/auth";
import { ErrorApp } from "@/lib/errors";
import { ejecutarRpc, revalidarPublico } from "./mutations";
import {
  descartarSubida,
  extensionDe,
  firmarSubida,
  validarDeclarado,
  verificarSubida,
  type SubidaPreparada,
} from "./subida-directa";
import { BUCKET_PRODUCTOS, MAXIMO_IMAGEN_BYTES, MIMES_IMAGEN } from "./constantes";
import {
  esquemaProducto,
  esquemaVariantePanel,
  type EntradaProducto,
  type EntradaVariantePanel,
} from "./schemas";

/** Resultado de una acción de escritura cuando no redirige. */
export type ResultadoEscritura = { ok: true; mensaje?: string } | { ok: false; error: string };

/** Los errores de la app ya vienen legibles; los demás, genérico y registrado. */
function mensajeDe(error: unknown): string {
  if (error instanceof ErrorApp) return error.message;
  console.error("[acciones productos]", error);
  return "No se pudo guardar. Inténtalo de nuevo en un momento.";
}

// --- Productos ---------------------------------------------------------------

export async function guardarProducto(entrada: EntradaProducto): Promise<ResultadoEscritura> {
  const datos = esquemaProducto.safeParse(entrada);
  if (!datos.success) {
    return { ok: false, error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  }

  try {
    const p = datos.data;
    await ejecutarRpc("guardar_producto", {
      p_id: p.id,
      p_nombre: p.nombre,
      p_slug: p.slug,
      p_categoria: p.categoria ?? undefined,
      p_club_id: p.clubId ?? undefined,
      p_descripcion: p.descripcion ?? undefined,
      p_activo: p.activo,
      p_orden: p.orden,
    });
    revalidarPublico("producto");
    return { ok: true, mensaje: p.id ? "Producto actualizado." : "Producto creado." };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}

const OPCIONES_IMAGEN = { mimesPermitidos: MIMES_IMAGEN, maximoBytes: MAXIMO_IMAGEN_BYTES };
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Paso 1 de la subida directa de la foto del producto (ver
 * `subida-directa.ts`). Ruta con UUID: el nombre original nunca llega a Storage.
 */
export async function prepararImagenProducto(id: string, mime: string, tamano: number): Promise<SubidaPreparada> {
  try {
    await exigirAdmin();
    if (!UUID.test(id)) return { ok: false, error: "Producto inválido." };
    const invalido = validarDeclarado(mime, tamano, OPCIONES_IMAGEN);
    if (invalido) return { ok: false, error: invalido };

    const ruta = `productos/${crypto.randomUUID()}.${extensionDe(mime)}`;
    return { ok: true, bucket: BUCKET_PRODUCTOS, ruta, token: await firmarSubida(BUCKET_PRODUCTOS, ruta) };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}

/**
 * Paso 3: verifica el archivo ya subido por firma de bytes y, solo entonces,
 * lo agrega a la galería por RPC con el actor (máximo 8; la base lo controla).
 * Si la RPC falla, el archivo se borra. `producto.imagen_path` ya no se escribe
 * desde aquí: la RPC la deja igual a la foto de orden 0.
 */
export async function confirmarImagenProducto(
  id: string,
  ruta: string,
): Promise<ResultadoEscritura & { foto?: { id: string; storage_path: string; texto_alt: null } }> {
  try {
    await exigirAdmin();
    if (!UUID.test(id)) return { ok: false, error: "Producto inválido." };
    if (!/^productos\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/.test(ruta)) return { ok: false, error: "Ruta de imagen inválida." };

    const verificada = await verificarSubida(BUCKET_PRODUCTOS, ruta, OPCIONES_IMAGEN);
    if (!verificada.ok) return verificada;

    let fotoId: string;
    try {
      fotoId = await ejecutarRpc("agregar_imagen_producto", { p_producto_id: id, p_storage_path: ruta });
    } catch (error) {
      await descartarSubida(BUCKET_PRODUCTOS, ruta);
      throw error;
    }
    revalidarPublico("producto");
    return { ok: true, mensaje: "Foto agregada.", foto: { id: fotoId, storage_path: ruta, texto_alt: null } };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}

/**
 * Borra archivos del bucket DESPUÉS de que la base ya los soltó. Si el borrado
 * falla se registra y no se revierte nada: un archivo huérfano en el bucket es
 * mejor que una foto rota en el sitio.
 */
async function descartarArchivos(rutas: string[]): Promise<void> {
  const resultados = await Promise.allSettled(rutas.map((r) => descartarSubida(BUCKET_PRODUCTOS, r)));
  resultados.forEach((r, i) => {
    if (r.status === "rejected") console.error("[acciones productos] archivo huérfano:", rutas[i], r.reason);
  });
}

/** Quita una foto de la galería: primero la RPC y, si sale bien, el archivo. */
export async function quitarImagenProducto(id: string): Promise<ResultadoEscritura> {
  if (!UUID.test(id)) return { ok: false, error: "Foto inválida." };
  try {
    const ruta = await ejecutarRpc("quitar_imagen_producto", { p_id: id });
    if (ruta) await descartarArchivos([ruta]);
    revalidarPublico("producto");
    return { ok: true, mensaje: "Foto quitada." };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}

/** Recibe la lista COMPLETA de ids en el orden nuevo; la primera es la principal. */
export async function reordenarImagenesProducto(productoId: string, ids: string[]): Promise<ResultadoEscritura> {
  if (!UUID.test(productoId) || ids.length === 0 || !ids.every((i) => UUID.test(i))) {
    return { ok: false, error: "Lista de fotos inválida." };
  }
  try {
    await ejecutarRpc("reordenar_imagenes_producto", { p_producto_id: productoId, p_ids: ids });
    revalidarPublico("producto");
    return { ok: true, mensaje: "Orden guardado." };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}

export async function establecerTextoAltImagen(id: string, texto: string): Promise<ResultadoEscritura> {
  if (!UUID.test(id)) return { ok: false, error: "Foto inválida." };
  if (texto.length > 200) return { ok: false, error: "El texto alternativo admite como máximo 200 caracteres." };
  try {
    await ejecutarRpc("establecer_texto_alt_imagen_producto", { p_id: id, p_texto_alt: texto });
    revalidarPublico("producto");
    return { ok: true, mensaje: "Texto alternativo guardado." };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}

/**
 * Desactivar en vez de eliminar. La FK variante → producto es RESTRICT y
 * pedido_item → variante también: un producto con pedidos no se puede borrar,
 * y la base lo rechazaría. Aquí ni se intenta: la salida es `activo = false`,
 * que lo saca del catálogo público conservando el historial.
 */
export async function alternarProducto(id: string, activo: boolean): Promise<ResultadoEscritura> {
  try {
    // Un booleano, una RPC mínima (migración 12): alternar no es guardar.
    await ejecutarRpc("alternar_producto_activo", { p_id: id, p_activo: activo });
    revalidarPublico("producto");
    return {
      ok: true,
      mensaje: activo
        ? "Producto activado: vuelve a verse en la tienda."
        : "Producto desactivado: ya no se ve en la tienda, pero conserva su historial de pedidos.",
    };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}

/**
 * Eliminar de verdad, solo si nunca se vendió: la RPC rechaza con mensaje claro
 * si hay pedidos. La foto del bucket público se borra después, ya sin fila.
 */
export async function eliminarProducto(id: string): Promise<ResultadoEscritura> {
  if (!UUID.test(id)) return { ok: false, error: "Producto inválido." };
  try {
    const rutas = await ejecutarRpc("eliminar_producto", { p_id: id });
    await descartarArchivos(rutas ?? []);
    revalidarPublico("producto");
    return { ok: true, mensaje: "Producto eliminado." };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}

// --- Variantes -----------------------------------------------------------------

export async function guardarVariante(entrada: EntradaVariantePanel, productoId: string): Promise<ResultadoEscritura> {
  const datos = esquemaVariantePanel.safeParse(entrada);
  if (!datos.success) {
    return { ok: false, error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(productoId)) {
    return { ok: false, error: "Producto inválido." };
  }

  try {
    const v = datos.data;
    // guardar_variante no toca stock_reservado: eso solo lo mueve el ciclo de
    // inventario (reservar, liberar, consumir). El panel muestra el reservado
    // aparte y no lo escribe jamás.
    await ejecutarRpc("guardar_variante", {
      p_id: v.id,
      p_producto_id: productoId,
      p_talla: v.talla,
      p_precio_centavos: v.precioCentavos,
      p_stock: v.stock,
      p_sku: v.sku ?? undefined,
      p_activo: v.activo,
    });
    revalidarPublico("producto");
    return { ok: true, mensaje: v.id ? "Variante actualizada." : "Variante agregada." };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}

/**
 * Desactivar una variante. No hay eliminar: pedido_item apunta a variante con
 * FK RESTRICT y una variante vendida es parte del histórico de una compra.
 */
export async function alternarVariante(id: string, activo: boolean): Promise<ResultadoEscritura> {
  try {
    // Acción parcial: RPC mínima (migración 11). guardar_variante es
    // reemplazo total y aquí pondría el SKU en NULL.
    await ejecutarRpc("alternar_variante_activa", { p_id: id, p_activo: activo });
    revalidarPublico("producto");
    return { ok: true, mensaje: activo ? "Variante activada." : "Variante desactivada." };
  } catch (error) {
    return { ok: false, error: mensajeDe(error) };
  }
}
