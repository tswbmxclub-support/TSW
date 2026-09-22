/**
 * Enlaces de WhatsApp del sitio. Es la ÚNICA función que los construye: el
 * botón de contacto genérico y el envío del pedido pasan por aquí.
 *
 * El número sale de `NEXT_PUBLIC_WHATSAPP_NUMERO`: solo dígitos, con el
 * indicativo de Colombia (57) y las diez cifras del celular, 12 en total.
 * Next reemplaza `process.env.NEXT_PUBLIC_*` en tiempo de compilación, así que
 * se lee por nombre completo y sirve igual en servidor y en navegador.
 *
 * Si la variable falta o está mal escrita, no se genera ningún enlace: el
 * botón se deshabilita con el aviso "WhatsApp no configurado". Un enlace roto
 * a wa.me sería peor que ninguno.
 */
const FORMATO_NUMERO = /^57\d{10}$/;

/** Número validado, o null si no está configurado o no cumple el formato. */
export function numeroWhatsApp(): string | null {
  const crudo = (process.env.NEXT_PUBLIC_WHATSAPP_NUMERO ?? "").trim();
  return FORMATO_NUMERO.test(crudo) ? crudo : null;
}

/**
 * `https://wa.me/<numero>?text=<texto>` con el texto codificado, o
 * `https://wa.me/<numero>` sin texto. Null si el número no está configurado.
 */
export function enlaceWhatsApp(texto?: string): string | null {
  const numero = numeroWhatsApp();
  if (!numero) return null;
  const base = `https://wa.me/${numero}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}
