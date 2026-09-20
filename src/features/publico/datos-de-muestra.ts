// DATOS DE MUESTRA: borrar al conectar la base
//
// Contenido del sitio público que el esquema todavía no tiene: los deportes
// de la corporación y lo que se dice de cada uno, los pilares, la cita
// institucional, la sede y las cifras de cupos. Las vistas que ya leen de
// Supabase (documentos, competencias, productos, niveles) siguen leyendo de
// Supabase; este archivo solo cubre el hueco.
//
// Reglas: valores entre corchetes [ASÍ], ninguna cifra, nombre de persona ni
// fecha que parezca real. Los deportes se identifican por el mismo id que
// usa el panel (features/cuenta/datos-de-muestra.ts) para que el selector
// público y el del panel hablen el mismo idioma.

import { DEPORTES_MUESTRA, type DeporteMuestra } from "@/features/cuenta/datos-de-muestra";

// --- Deportes con su presentación pública ------------------------------------

export type DeportePublico = DeporteMuestra & {
  /** Etiqueta corta sobre la foto: "Semilleros y competencia". */
  categoria: string;
  /** Una o dos frases de presentación. */
  descripcion: string;
  /** Dos o tres puntos cortos con lo que ofrece. */
  puntos: string[];
  /** Foto horizontal en /public/imagenes, o null para el marcador. */
  imagen: string | null;
  /** Texto pequeño al pie de la tarjeta. */
  pie: string;
};

export const DEPORTES_PUBLICO: DeportePublico[] = DEPORTES_MUESTRA.map((deporte, indice) => ({
  ...deporte,
  categoria: indice === 0 ? "[Semilleros y competencia]" : "[Categoría del deporte]",
  descripcion:
    indice === 0
      ? "[Presentación del BMX en la corporación: a quién va dirigido y qué ofrece.]"
      : "[Presentación del deporte: a quién va dirigido y qué ofrece.]",
  puntos: ["[Punto destacado 1]", "[Punto destacado 2]"],
  imagen: indice === 0 ? "/imagenes/escuela.jpg" : null,
  pie: "[Cupos por semestre]",
}));

/** Deporte público por id, con el primero como respaldo. */
export function deportePublicoPorId(id: string | undefined): DeportePublico {
  return DEPORTES_PUBLICO.find((d) => d.id === id) ?? DEPORTES_PUBLICO[0]!;
}

// --- Portada: pilares y cita ---------------------------------------------------

export type Pilar = {
  id: string;
  titulo: string;
  texto: string;
  /** Remate al pie: "[Estándar]". */
  pie: string;
};

export const PILARES_MUESTRA: Pilar[] = [
  { id: "formacion", titulo: "[Pilar 1: formación]", texto: "[Qué distingue la metodología de la corporación.]", pie: "[Estándar o aval]" },
  { id: "etica", titulo: "[Pilar 2: ética y convivencia]", texto: "[Compromisos con deportistas y familias.]", pie: "[Comité o reglamento]" },
  { id: "salud", titulo: "[Pilar 3: salud y bienestar]", texto: "[Acompañamiento médico y físico.]", pie: "[Acompañamiento]" },
];

export const CITA_MUESTRA = {
  texto: "[Frase institucional de la corporación, una o dos líneas, en palabras de su dirección.]",
  autor: "[NOMBRE]",
  cargo: "[CARGO]",
};

// --- Sede y canales de atención --------------------------------------------------

export type CanalAtencion = {
  id: string;
  titulo: string;
  texto: string;
};

export const SEDE_MUESTRA = {
  nombre: "[Nombre de la sede]",
  descripcion: "[Qué hay en la sede: pista, oficina, taquilla.]",
  imagen: "/imagenes/sede.jpg",
  canales: [
    { id: "sede", titulo: "Sede administrativa", texto: "[Dirección completa y punto de referencia.]" },
    { id: "horario", titulo: "Horarios", texto: "[Días y horas de atención y de entrenamiento.]" },
    { id: "linea", titulo: "Línea directa y WhatsApp", texto: "[Teléfono y correo de atención.]" },
  ] satisfies CanalAtencion[],
};

// --- Matrículas: cupos y categorías ---------------------------------------------

export type CategoriaMatricula = {
  id: string;
  etiqueta: string;
  titulo: string;
  texto: string;
  /** Rango de edades, como texto: "[4 a 13 años]". */
  edades: string;
};

/** Cupos del periodo, por deporte. Sin dato real: barra en null. */
export const CUPOS_MUESTRA: Record<string, { disponibles: string; ocupacion: number | null }> = Object.fromEntries(
  DEPORTES_MUESTRA.map((d) => [d.id, { disponibles: "[CIFRA]", ocupacion: null }]),
);

export const CATEGORIAS_MATRICULA_MUESTRA: CategoriaMatricula[] = [
  {
    id: "semilleros",
    etiqueta: "[Desarrollo de talentos]",
    titulo: "[Plan semilleros e iniciación]",
    texto: "[Qué incluye el plan de iniciación y cómo se promueve.]",
    edades: "[Edades]",
  },
  {
    id: "rendimiento",
    etiqueta: "[Selección]",
    titulo: "[Plan de alto rendimiento]",
    texto: "[Qué incluye el plan competitivo y sus requisitos.]",
    edades: "[Edades]",
  },
];

// --- Semilleros: cifras de la metodología ---------------------------------------

/** Tres cifras de la ruta formativa, sin valor real: la etiqueta dice qué irá. */
export const CIFRAS_SEMILLEROS_MUESTRA = [
  { id: "etapas", etiqueta: "[Etapas formativas]", detalle: "[Desde la iniciación hasta la competencia.]" },
  { id: "ratio", etiqueta: "[Deportistas por entrenador]", detalle: "[Ratio máximo por grupo.]" },
  { id: "entrenadores", etiqueta: "[Entrenadores certificados]", detalle: "[Formación del cuerpo técnico.]" },
];

// --- Tienda: beneficios -----------------------------------------------------------

export const BENEFICIOS_TIENDA_MUESTRA = [
  { id: "oficial", titulo: "[Dotación oficial]", texto: "[Prendas aprobadas para entrenar y competir.]" },
  { id: "retiro", titulo: "[Retiro en sede]", texto: "[Dónde y cuándo se entregan los pedidos.]" },
  { id: "personalizacion", titulo: "[Personalización]", texto: "[Qué se puede estampar y cómo se pide.]" },
];
