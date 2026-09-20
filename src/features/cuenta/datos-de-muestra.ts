// DATOS DE MUESTRA: borrar al conectar la base
//
// Todas las vistas nuevas de la corporación multideporte leen de aquí y de
// ningún otro lado. No hay migraciones ni esquema todavía: cuando la base
// exista, este archivo se borra y las consultas lo reemplazan.
//
// Reglas: valores entre corchetes [ASÍ], ninguna cifra ni nombre real de
// persona, ni fecha que parezca real. Los montos en centavos van como texto
// "[MONTO]" porque el precio es `integer` en centavos y su formato real
// llegará con la columna; no se usa formatearPrecio con números inventados.

// --- Deportes ---------------------------------------------------------------

export type DeporteMuestra = {
  id: string;
  nombre: string;
};

export const DEPORTES_MUESTRA: DeporteMuestra[] = [
  { id: "bmx", nombre: "BMX" },
  { id: "deporte-2", nombre: "[DEPORTE 2]" },
];

/** El deporte con el que arranca el selector antes de que el admin elija. */
export const DEPORTE_POR_DEFECTO_ID = "bmx";

// --- Resumen de cuenta (cabecera del área de usuario) -----------------------

export type DeportistaResumen = {
  nombre: string;
  deporte: string;
  nivel: string;
};

export type ResumenCuentaMuestra = {
  titular: string;
  deportistas: DeportistaResumen[];
};

export const RESUMEN_CUENTA_MUESTRA: ResumenCuentaMuestra = {
  titular: "[NOMBRE]",
  deportistas: [
    { nombre: "[DEPORTISTA 1]", deporte: "BMX", nivel: "[NIVEL 1]" },
    { nombre: "[DEPORTISTA 2]", deporte: "[DEPORTE 2]", nivel: "[NIVEL 2]" },
  ],
};

// --- Mensualidades -----------------------------------------------------------

export type EstadoMensualidad = "pagada" | "pendiente" | "vencida";

export type MensualidadMuestra = {
  id: string;
  /** Mes al que corresponde el pago, como "enero de 2026". */
  mes: string;
  estado: EstadoMensualidad;
  /** Monto en centavos o null si todavía no está definido en el esquema. */
  montoCentavos: number | null;
  /** Fecha de pago (si está pagada) o de vencimiento (si no). */
  fecha: string;
  deportista: string;
};

export const MENSUALIDADES_MUESTRA: MensualidadMuestra[] = [
  { id: "m-1", mes: "[MES 1]", estado: "vencida", montoCentavos: null, fecha: "[FECHA VENCIMIENTO]", deportista: "[DEPORTISTA 1]" },
  { id: "m-2", mes: "[MES 2]", estado: "pagada", montoCentavos: null, fecha: "[FECHA DE PAGO]", deportista: "[DEPORTISTA 1]" },
  { id: "m-3", mes: "[MES 3]", estado: "pendiente", montoCentavos: null, fecha: "[FECHA VENCIMIENTO]", deportista: "[DEPORTISTA 1]" },
  { id: "m-4", mes: "[MES 4]", estado: "pendiente", montoCentavos: null, fecha: "[FECHA VENCIMIENTO]", deportista: "[DEPORTISTA 2]" },
];

/**
 * Mes actual del resumen. La fecha real la calculará la base; aquí es una
 * etiqueta de muestra sin fecha inventada.
 */
export const MENSUALIDAD_ACTUAL_MUESTRA: MensualidadMuestra = {
  id: "m-actual",
  mes: "[MES ACTUAL]",
  estado: "pendiente",
  montoCentavos: null,
  fecha: "[FECHA VENCIMIENTO]",
  deportista: "[DEPORTISTA 1]",
};

// --- Jersey ------------------------------------------------------------------

export type EstadoJersey = "entregado" | "pendiente";

export type JerseyMuestra = {
  id: string;
  talla: string;
  estado: EstadoJersey;
  /** Fecha de entrega, o null si todavía no está agendada. */
  fechaEntrega: string | null;
  /** Número o nombre impreso, si aplica. */
  impresion: string | null;
};

export const JERSEY_MUESTRA: JerseyMuestra = {
  id: "j-1",
  talla: "[TALLA]",
  estado: "pendiente",
  fechaEntrega: "[FECHA DE ENTREGA]",
  impresion: "[NOMBRE IMPRESO]",
};

// --- Usuarios del panel (sección /admin/usuarios) ----------------------------

export type EstadoUsuarioPanel = "activo" | "inactivo";

export type UsuarioPanelMuestra = {
  id: string;
  nombre: string;
  correo: string;
  estado: EstadoUsuarioPanel;
  deporte: string;
  deportistas: DeportistaResumen[];
};

export const USUARIOS_PANEL_MUESTRA: UsuarioPanelMuestra[] = [
  {
    id: "u-1",
    nombre: "[NOMBRE USUARIO 1]",
    correo: "[correo1@dominio.com]",
    estado: "activo",
    deporte: "BMX",
    deportistas: RESUMEN_CUENTA_MUESTRA.deportistas,
  },
  {
    id: "u-2",
    nombre: "[NOMBRE USUARIO 2]",
    correo: "[correo2@dominio.com]",
    estado: "inactivo",
    deporte: "[DEPORTE 2]",
    deportistas: [{ nombre: "[DEPORTISTA 3]", deporte: "[DEPORTE 2]", nivel: "[NIVEL 3]" }],
  },
  {
    id: "u-3",
    nombre: "[NOMBRE USUARIO 3]",
    correo: "[correo3@dominio.com]",
    estado: "activo",
    deporte: "BMX",
    deportistas: [{ nombre: "[DEPORTISTA 4]", deporte: "BMX", nivel: "[NIVEL 4]" }],
  },
];

// --- Administradores del panel (sección /admin/administradores) --------------

export type AdministradorMuestra = {
  id: string;
  nombre: string;
  correo: string;
  activo: boolean;
};

export const ADMINISTRADORES_MUESTRA: AdministradorMuestra[] = [
  { id: "a-1", nombre: "[NOMBRE ADMIN 1]", correo: "[admin1@dominio.com]", activo: true },
  { id: "a-2", nombre: "[NOMBRE ADMIN 2]", correo: "[admin2@dominio.com]", activo: false },
];

// --- Historial por año (para /cuenta/mensualidades) ---------------------------

export type AnioMensualidades = {
  anio: string;
  mensualidades: MensualidadMuestra[];
};

export const HISTORIAL_MENSUALIDADES_MUESTRA: AnioMensualidades[] = [
  {
    anio: "[AÑO 1]",
    mensualidades: MENSUALIDADES_MUESTRA,
  },
];
