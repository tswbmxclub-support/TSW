/**
 * CONTENIDO FIJO DEL SITIO PÚBLICO, EN UN SOLO SITIO.
 *
 * Todo lo que aparece entre corchetes `[ASÍ]` es un marcador: el club envía
 * el dato real y se reemplaza aquí, sin tocar ningún componente. La lista de
 * lo que falta, redactada para el club, está en
 * docs/contenido-pendiente-cliente.md; si agregas un marcador nuevo, agrégalo
 * también allí.
 *
 * Reglas: ninguna cifra, nombre de persona, fecha ni precio inventados. Lo que
 * no se sabe se queda entre corchetes. Los datos de identidad y contacto
 * (nombre, dirección, teléfono, redes, navegación) viven en ./sitio.ts.
 *
 * Lo que NO va aquí: documentos, niveles, competencias y productos, que se
 * administran desde el panel y se leen de Supabase.
 */

// --- Deportes ------------------------------------------------------------------

export type Deporte = {
  /** Identificador estable: va en la URL (?deporte=bmx) y lo usa el panel. */
  id: string;
  nombre: string;
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

/**
 * Los deportes de la corporación. El primero es el que se muestra por
 * defecto. Cuando exista la tabla `deporte`, esta lista sale del panel.
 */
export const DEPORTES: Deporte[] = [
  {
    id: "bmx",
    nombre: "BMX",
    categoria: "[Semilleros y competencia]",
    descripcion: "[Presentación del BMX en la corporación: a quién va dirigido y qué ofrece.]",
    puntos: ["[Punto destacado 1]", "[Punto destacado 2]"],
    imagen: "/imagenes/escuela.jpg",
    pie: "[Cupos por semestre]",
  },
  {
    id: "deporte-2",
    nombre: "[DEPORTE 2]",
    categoria: "[Categoría del deporte]",
    descripcion: "[Presentación del deporte: a quién va dirigido y qué ofrece.]",
    puntos: ["[Punto destacado 1]", "[Punto destacado 2]"],
    imagen: null,
    pie: "[Cupos por semestre]",
  },
];

// --- Portada ---------------------------------------------------------------------

/**
 * Cifra de la franja azul. `valor` en null significa que el dato todavía no
 * existe: la tarjeta lo muestra como pendiente en vez de inventar un número,
 * y la cuenta ascendente se activa sola en cuanto se escriba una cifra real.
 */
export type Cifra = {
  valor: number | null;
  sufijo?: string;
  etiqueta: string;
  /** Texto de apoyo bajo la cifra. */
  detalle: string;
};

export const PORTADA = {
  /** Etiqueta pequeña sobre el titular: tipo de entidad. */
  etiquetaEntidad: "[Entidad deportiva]",
  presentacion: "[Presentación de la corporación en dos frases: qué deportes forma, para quién y con qué enfoque.]",
  aval: "[Aval, reconocimiento o afiliación de la corporación]",
  cifras: [
    { valor: null, sufijo: "+", etiqueta: "[Deportistas formados]", detalle: "[Texto de apoyo de la cifra.]" },
    { valor: null, sufijo: "", etiqueta: "[Años de trayectoria]", detalle: "[Texto de apoyo de la cifra.]" },
    { valor: null, sufijo: "", etiqueta: "[Competencias al año]", detalle: "[Texto de apoyo de la cifra.]" },
    { valor: null, sufijo: "", etiqueta: "[Niveles de formación]", detalle: "[Texto de apoyo de la cifra.]" },
  ] satisfies Cifra[],
  /** Texto de apoyo cuando una cifra sigue en null. */
  cifraPendiente: "[Pendiente de confirmar por el club.]",
  pilaresBajada: "[Bajada: cómo entiende la corporación la formación deportiva.]",
  pilares: [
    { id: "formacion", titulo: "[Pilar 1: formación]", texto: "[Qué distingue la metodología de la corporación.]", pie: "[Estándar o aval]" },
    { id: "etica", titulo: "[Pilar 2: ética y convivencia]", texto: "[Compromisos con deportistas y familias.]", pie: "[Comité o reglamento]" },
    { id: "salud", titulo: "[Pilar 3: salud y bienestar]", texto: "[Acompañamiento médico y físico.]", pie: "[Acompañamiento]" },
  ],
  deportesBajada: "[Bajada: los deportes que forma la corporación y cómo se organizan.]",
  cita: {
    texto: "[Frase institucional de la corporación, una o dos líneas, en palabras de su dirección.]",
    autor: "[NOMBRE]",
    cargo: "[CARGO]",
  },
  sedeBajada: "[Bajada: dónde entrena la corporación y cómo se atiende a las familias.]",
  sede: {
    nombre: "[Nombre de la sede]",
    descripcion: "[Qué hay en la sede: pista, oficina, taquilla.]",
    imagen: "/imagenes/sede.jpg",
    imagenAlt: "[Foto o mapa de la sede]",
    canales: [
      { id: "sede", titulo: "Sede administrativa", texto: "[Dirección completa y punto de referencia.]" },
      { id: "horario", titulo: "Horarios", texto: "[Días y horas de atención y de entrenamiento.]" },
      { id: "linea", titulo: "Línea directa y WhatsApp", texto: "[Teléfono y correo de atención.]" },
    ],
  },
} as const;

// --- Matrículas --------------------------------------------------------------------

export type CategoriaMatricula = {
  id: string;
  etiqueta: string;
  titulo: string;
  texto: string;
  /** Rango de edades, como texto: "[4 a 13 años]". */
  edades: string;
};

export const MATRICULAS = {
  /** Etiqueta sobre el título: estado de la convocatoria. */
  antetitulo: "[Convocatoria abierta]",
  /** Cupos del periodo. `ocupacion` (0-100) pinta la barra; null la oculta. */
  cupos: {
    disponibles: "[CIFRA]",
    ocupacion: null as number | null,
    detalle: "[Ocupación del periodo por categoría.]",
  },
  cierre: {
    fecha: "[FECHA]",
    detalle: "[Hasta cuándo se reciben carpetas sin recargo.]",
  },
  categoriasBajada: (deporte: string) => `[Cómo se organiza la vinculación en ${deporte}.]`,
  categorias: [
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
  ] satisfies CategoriaMatricula[],
  documentosBajada:
    "Cada archivo indica su versión vigente y su fecha de publicación. [Los formatos por deporte llegarán con el esquema; hoy son comunes.]",
  /** Paso 2 de la hoja de ruta. */
  firmas: "[Indicar si se firman a mano o se aceptan firmas digitales.]",
  /** Paso 3: anexos que acompañan a los formatos. */
  anexos: [
    "[Documento de identidad del deportista]",
    "[Documento de identidad del acudiente]",
    "[Certificado médico o afiliación a salud]",
    "[Otros anexos que pida el club]",
  ],
  anexosPie: "[Lo que acompaña a los formatos]",
} as const;

// --- Semilleros ------------------------------------------------------------------

export const SEMILLEROS = {
  /** Tres cifras de la ruta formativa. `valor` en null muestra el marcador. */
  cifras: [
    { id: "etapas", etiqueta: "[Etapas formativas]", valor: null as string | null, detalle: "[Desde la iniciación hasta la competencia.]" },
    { id: "ratio", etiqueta: "[Deportistas por entrenador]", valor: null as string | null, detalle: "[Ratio máximo por grupo.]" },
    { id: "entrenadores", etiqueta: "[Entrenadores certificados]", valor: null as string | null, detalle: "[Formación del cuerpo técnico.]" },
  ],
  /** Preguntas frecuentes. Cambian poco y las edita quien mantiene el sitio. */
  preguntas: [
    {
      id: "edad",
      titulo: "¿Desde qué edad se puede ingresar?",
      contenido: "[Edad mínima de ingreso y si hay tope de edad. Indicar a qué nivel entra un deportista sin experiencia.]",
    },
    {
      id: "bicicleta",
      titulo: "¿Hay que tener bicicleta y protección propias?",
      contenido: "[Política del club sobre bicicletas y elementos de protección: si presta, alquila o exige equipo propio.]",
    },
    {
      id: "horarios",
      titulo: "¿Cuáles son los horarios de entrenamiento?",
      contenido: "Cada nivel tiene su franja. Está en la ficha de cada semillero, arriba en esta página.",
    },
    {
      id: "promocion",
      titulo: "¿Cómo se pasa de un nivel al siguiente?",
      contenido: "[Quién evalúa y con qué frecuencia. El criterio de promoción de cada nivel aparece en su ficha.]",
    },
    {
      id: "costos",
      titulo: "¿Cuánto cuesta la matrícula y la mensualidad?",
      contenido: "[Valores y formas de pago. No se publican hasta que el club los confirme.]",
    },
  ],
} as const;

// --- Tienda ------------------------------------------------------------------------

export const TIENDA = {
  beneficios: [
    { id: "oficial", titulo: "[Dotación oficial]", texto: "[Prendas aprobadas para entrenar y competir.]" },
    { id: "retiro", titulo: "[Retiro en sede]", texto: "[Dónde y cuándo se entregan los pedidos.]" },
    { id: "personalizacion", titulo: "[Personalización]", texto: "[Qué se puede estampar y cómo se pide.]" },
  ],
} as const;
