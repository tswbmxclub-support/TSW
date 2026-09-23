/** Topes de tamaño: Storage aplica los mismos (migración 09). */
export const MAXIMO_PDF_BYTES = 10 * 1024 * 1024;
export const MAXIMO_IMAGEN_BYTES = 10 * 1024 * 1024;

/** MIME permitidos por bucket. */
export const MIMES_PDF = ["application/pdf"] as const;
export const MIMES_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

/** Buckets de Storage (migración 09). */
export const BUCKET_DOCUMENTOS = "documentos-matricula";
export const BUCKET_PRODUCTOS = "productos";
export const BUCKET_COMPETENCIAS = "competencias";

/** Rutas públicas que toca cada entidad al escribir. Las usa revalidarPublico(). */
export const RUTAS_PUBLICAS = {
  documento: ["/matriculas"],
  nivel: ["/", "/semilleros"],
  competencia: ["/", "/competencias"],
  producto: ["/", "/tienda"],
  pedido: [],
} as const;

/**
 * Código de acceso por correo.
 *
 * El LARGO y la VIGENCIA los fija el dashboard de Supabase (Authentication →
 * Providers → Email → «Email OTP Length» y «Email OTP Expiration»). No hay
 * forma de leerlos desde la API con la anon key ni con la service role, así
 * que se repiten aquí, en un solo sitio, y de aquí los toman el esquema de
 * Zod, el input de la pantalla y el texto del correo. Si cambian allá, se
 * cambian aquí; si se desincronizan, el código llega y la pantalla lo
 * rechaza antes de enviarlo.
 *
 * El largo está medido contra el proyecto real (2026-09-22): generateLink
 * devuelve un email_otp de 8 dígitos, no de 6.
 */
export const LARGO_CODIGO_ACCESO = 8;

/**
 * Plazo de vigencia, tal como se le dice a la persona. Encaja en «El código
 * vence …». El valor sale del dashboard («Email OTP Expiration», fijado en
 * 10 minutos el 2026-09-23): si se cambia allá, se cambia aquí.
 */
export const VIGENCIA_CODIGO_ACCESO = "en 10 minutos";

/** Espera antes de poder pedir otro código, en segundos. */
export const SEGUNDOS_REENVIO_CODIGO = 60;
