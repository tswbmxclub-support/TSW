/**
 * Identidad, contacto y navegación del sitio.
 *
 * Todo lo que aparece entre corchetes es un placeholder: se reemplaza aquí
 * cuando el club entregue la información. Ninguna página inventa teléfonos ni
 * direcciones. El resto del contenido fijo (portada, matrículas, semilleros,
 * tienda, deportes) vive en ./contenido.ts.
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
  // El WhatsApp no va aquí: sale de NEXT_PUBLIC_WHATSAPP_NUMERO (src/lib/whatsapp.ts).
} as const;

/**
 * Las tres cuentas de Instagram del documento del cliente (22-09-2026). No hay
 * Facebook ni YouTube: los iconos que estaban antes apuntaban a una URL entre
 * corchetes, así que eran enlaces rotos con forma de red social.
 */
export const REDES = [
  { nombre: "Corporación Deportiva TSW", url: "https://www.instagram.com/corporaciond.tsw" },
  { nombre: "BMX Club TSW", url: "https://www.instagram.com/bmx_clubtsw" },
  { nombre: "BMX Mastercross", url: "https://www.instagram.com/bmxmastercross" },
] as const;

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
  // El documento del cliente pide renombrarlo o quitarlo: se llamaba
  // "[Estatutos y reglamentos]" —un placeholder— y llevaba a Matrículas, que
  // es donde de verdad se descarga el reglamento interno. Renombrado, no
  // inventado: no hay URL propia del PDF hasta que se publique su versión.
  { etiqueta: "Reglamento interno", href: "/matriculas" },
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
