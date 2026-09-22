/**
 * Datos del club que todavía no tengo.
 *
 * Todo lo que aparece entre corchetes es un placeholder: se reemplaza aquí, en
 * un solo sitio, cuando el club entregue la información. Ninguna página inventa
 * teléfonos, direcciones ni cifras.
 */

export const SITIO = {
  nombre: "TSW",
  nombreLargo: "[Corporación Deportiva TSW]",
  /** Texto corto bajo el logo: qué es la entidad. */
  subtitulo: "Corporación deportiva",
  lema: "[Lema de la corporación]",
  descripcion:
    "Corporación deportiva: matrículas, semilleros, competencias y dotación oficial de cada deporte.",
} as const;

export const CONTACTO = {
  telefono: "[+57 300 000 0000]",
  telefonoEnlace: "tel:",
  correo: "[correo@dominio.com]",
  direccion: "[Dirección de la sede]",
  ciudad: "[Ciudad]",
  horario: "[Horario de atención]",
  whatsapp: "[https://wa.me/57XXXXXXXXXX]",
} as const;

export const REDES = [
  { nombre: "Instagram", url: "[https://instagram.com/...]" },
  { nombre: "Facebook", url: "[https://facebook.com/...]" },
  { nombre: "YouTube", url: "[https://youtube.com/...]" },
] as const;

/**
 * Cifras de la franja roja de la portada.
 *
 * `valor` en `null` significa que el dato todavía no existe: la tarjeta lo
 * muestra como pendiente en vez de inventar un número, y la cuenta ascendente
 * se activa sola en cuanto se escriba una cifra real.
 */
export type Cifra = {
  valor: number | null;
  sufijo?: string;
  etiqueta: string;
};

export const CIFRAS: Cifra[] = [
  { valor: null, sufijo: "+", etiqueta: "[Deportistas formados]" },
  { valor: null, sufijo: "", etiqueta: "[Años de trayectoria]" },
  { valor: null, sufijo: "", etiqueta: "[Competencias al año]" },
  { valor: null, sufijo: "", etiqueta: "[Niveles de formación]" },
];

/**
 * Navegación principal, plana como en el rediseño: cinco puertas, sin
 * submenú. El submenú sigue soportado por Header por si vuelve a hacer falta.
 */
export type EnlaceNav = {
  etiqueta: string;
  href: string;
  submenu?: { etiqueta: string; href: string; descripcion: string }[];
};

export const NAVEGACION: EnlaceNav[] = [
  { etiqueta: "Corporación", href: "/" },
  { etiqueta: "Semilleros", href: "/semilleros" },
  { etiqueta: "Competencias", href: "/competencias" },
  { etiqueta: "Matrículas", href: "/matriculas" },
  { etiqueta: "Tienda", href: "/tienda" },
];

/** Columnas del pie, como en el rediseño: institucional, servicios y sede. */
export const PIE_INSTITUCIONAL = [
  { etiqueta: "Nuestros pilares", href: "/#titulo-pilares" },
  { etiqueta: "Nuestros deportes", href: "/#titulo-deportes" },
  { etiqueta: "Documentos", href: "/#titulo-documentos-portal" },
  { etiqueta: "[Estatutos y reglamentos]", href: "/matriculas" },
] as const;

export const PIE_SERVICIOS = [
  { etiqueta: "Semilleros y niveles", href: "/semilleros" },
  { etiqueta: "Competencias y resultados", href: "/competencias" },
  { etiqueta: "Matrículas", href: "/matriculas" },
  { etiqueta: "Dotación y tienda", href: "/tienda" },
  // "Mi cuenta" (/cuenta/acceso) vuelve cuando se habiliten las cuentas de usuario.
] as const;

export const ENLACES_LEGALES = [
  { etiqueta: "Política de tratamiento de datos", href: "/legal/datos" },
  { etiqueta: "Términos y condiciones", href: "/legal/terminos" },
  { etiqueta: "Política de devoluciones", href: "/legal/devoluciones" },
] as const;
