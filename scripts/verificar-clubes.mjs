/**
 * Verificación mecánica de la migración 17 (clubes y programas).
 *
 * Lee los archivos SQL reales del repo —no la conversación— y cruza:
 *   · la tabla club: columnas, constraints con nombre, CHECK de tipo cerrado y
 *     `deporte` SIN lista cerrada, que es la decisión que se tomó,
 *   · que las columnas que las semillas escriben existan en su CREATE TABLE, y
 *     que los slugs de club que usa la semilla de niveles existan en la de
 *     clubes,
 *   · el orden de las sentencias sobre `nivel`: relleno antes de NOT NULL,
 *     drop del unique global antes del unique por club,
 *   · la danza del enum: la función que lo usa se borra antes de renombrar el
 *     tipo y se recrea después,
 *   · reordenar_niveles: lock primero, pertenencia al club comprobada, y
 *     v_base calculado DENTRO del club,
 *   · que cada RPC nueva lleve actor, definer, search_path, revoke y grant con
 *     la firma exacta.
 *
 * Se corre con `node scripts/verificar-clubes.mjs`. Termina con "VALIDACIÓN
 * LIMPIA" solo si todo cruza. Los cuerpos plpgsql quedan declarados como sin
 * verificación (ver el final del reporte).
 */
import { readFileSync, readdirSync } from "node:fs";

const DIR = "supabase/migrations";
const RUTA_17 = `${DIR}/20260923170000_clubes_y_programas.sql`;
const RUTA_11 = `${DIR}/20260918120000_rpc_faltantes_del_panel.sql`;
const RUTA_07 = `${DIR}/20260917100600_funciones_negocio.sql`;
const RUTA_06 = `${DIR}/20260917100500_auditoria.sql`;
const RUTA_02 = `${DIR}/20260917100100_tablas_catalogo.sql`;
const RUTA_01 = `${DIR}/20260917100000_enums_y_extensiones.sql`;

const ALIAS = {
  [RUTA_17]: "17", [RUTA_11]: "11", [RUTA_07]: "07",
  [RUTA_06]: "06", [RUTA_02]: "02", [RUTA_01]: "01",
};

const archivos = new Map(
  Object.keys(ALIAS).map((ruta) => {
    const texto = readFileSync(ruta, "utf8");
    return [ruta, { texto, lineas: texto.split("\n") }];
  }),
);

const sinComentarios = (t) => t.replace(/--[^\n]*/g, "");
const colapsar = (t) => t.replace(/\s+/g, " ");

function lineaDe(ruta, patron, ocurrencia = 1) {
  const { lineas } = archivos.get(ruta);
  const re = new RegExp(patron, "i");
  let vistas = 0;
  for (let i = 0; i < lineas.length; i++) {
    if (re.test(lineas[i])) {
      vistas += 1;
      if (vistas === ocurrencia) return i + 1;
    }
  }
  return null;
}

const ref = (ruta, linea) => (linea == null ? "—" : `${ALIAS[ruta]}:${linea}`);

function bloqueFuncion(ruta, patron) {
  const { lineas } = archivos.get(ruta);
  const inicio = lineaDe(ruta, patron);
  if (inicio === null) return null;
  let fin = inicio;
  while (fin < lineas.length && lineas[fin].trimEnd() !== "$$;") fin += 1;
  if (fin >= lineas.length) return null;
  return { inicio, fin: fin + 1, texto: lineas.slice(inicio - 1, fin + 1).join("\n") };
}

function bloqueDesde(ruta, patron) {
  const { lineas } = archivos.get(ruta);
  const inicio = lineaDe(ruta, patron);
  if (inicio === null) return null;
  let fin = inicio - 1;
  while (fin < lineas.length && !lineas[fin].trimEnd().endsWith(";")) fin += 1;
  return { inicio, fin: fin + 1, texto: lineas.slice(inicio - 1, fin + 1).join("\n") };
}

/** Índice del primer match en el texto sin comentarios del archivo. */
function posicion(ruta, aguja) {
  return sinComentarios(archivos.get(ruta).texto).indexOf(aguja);
}

const resultados = [];
const verificar = (nombre, condicion, referencia, detalle = "") =>
  resultados.push({ nombre, ok: Boolean(condicion), ref: referencia ?? "—", detalle });

function primeraSentenciaEsActor(textoFuncion) {
  const cuerpo = sinComentarios(textoFuncion);
  const m = /\bbegin\b/.exec(cuerpo);
  if (!m) return false;
  const desdeBegin = cuerpo.slice(m.index + m[0].length);
  const fin = desdeBegin.indexOf(";");
  if (fin === -1) return false;
  return /^perform public\.establecer_actor\(p_actor_id\)$/.test(desdeBegin.slice(0, fin).trim());
}

/** Columnas de un CREATE TABLE, leídas del archivo donde vive. */
function columnasDe(ruta, tabla) {
  const bloque = bloqueDesde(ruta, `^create table public\\.${tabla} \\(`);
  if (!bloque) return [];
  const nombres = [];
  for (const linea of sinComentarios(bloque.texto).split("\n").slice(1)) {
    const m = /^\s{2}([a-z_]+)\s+[a-z]/.exec(linea);
    if (m && m[1] !== "constraint") nombres.push(m[1]);
  }
  return nombres;
}

const texto17 = sinComentarios(archivos.get(RUTA_17).texto);
const plano17 = colapsar(texto17);

// ---------------------------------------------------------------------------
// 0. El archivo
// ---------------------------------------------------------------------------

const migraciones = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
verificar("solo una migración nueva sobre las 16 previas", migraciones.length === 17, "—", `${migraciones.length} archivos`);
verificar("la 17 es la última por timestamp", migraciones.at(-1) === RUTA_17.split("/").pop(), ref(RUTA_17, 1), migraciones.at(-1));

// ---------------------------------------------------------------------------
// 1. Tabla club
// ---------------------------------------------------------------------------

const columnasClub = columnasDe(RUTA_17, "club");
const esperadasClub = [
  "id", "nombre", "slug", "tipo", "deporte", "etiqueta", "descripcion",
  "color_identidad", "logo_path", "instagram_url", "orden", "activo",
  "creado_en", "actualizado_en",
];
verificar(
  "club: están las columnas acordadas",
  esperadasClub.every((c) => columnasClub.includes(c)),
  ref(RUTA_17, lineaDe(RUTA_17, "^create table public\\.club \\(")),
  columnasClub.join(", "),
);

const constraintsClub = [
  ["club_slug_unico", "unique \\(slug\\)"],
  ["club_slug_formato", "check \\(slug ~"],
  ["club_nombre_no_vacio", "check \\(length\\(btrim\\(nombre\\)\\) > 0\\)"],
  ["club_deporte_no_vacio", "check \\(length\\(btrim\\(deporte\\)\\) > 0\\)"],
  ["club_tipo_valido", "check \\(tipo in \\('club', 'programa'\\)\\)"],
  ["club_color_hexadecimal", "check \\(color_identidad is null or color_identidad ~"],
];
for (const [nombre, patron] of constraintsClub) {
  const linea = lineaDe(RUTA_17, `constraint ${nombre} ${patron}`);
  verificar(`club: constraint ${nombre}`, linea !== null, ref(RUTA_17, linea));
}

verificar(
  "club: `deporte` NO tiene lista cerrada (ni enum ni check de valores)",
  !/create type[^;]*deporte/i.test(texto17) && !/check \(deporte in \(/i.test(texto17),
  ref(RUTA_17, lineaDe(RUTA_17, "deporte\\s+text not null")),
  "un deporte nuevo no puede costar una migración",
);
verificar(
  "club: `orden` NO es único",
  !/unique \([^)]*\borden\b[^)]*\)/i.test(sinComentarios(bloqueDesde(RUTA_17, "^create table public\\.club \\(")?.texto ?? "")),
  ref(RUTA_17, lineaDe(RUTA_17, "orden\\s+integer not null default 0")),
  "no es una secuencia formativa: sin unicidad no hace falta RPC de reordenamiento",
);
verificar(
  "club: trigger de actualizado_en, con la función de su origen",
  lineaDe(RUTA_17, "^create trigger club_actualizado_en") !== null &&
    lineaDe(RUTA_02, "function public\\.set_actualizado_en") !== null,
  ref(RUTA_17, lineaDe(RUTA_17, "^create trigger club_actualizado_en")),
);
verificar(
  "club: trigger de auditoría cubriendo INSERT, UPDATE y DELETE",
  /create trigger club_auditoria after insert or update or delete on public\.club for each row execute function public\.registrar_auditoria\(\);/.test(plano17) &&
    lineaDe(RUTA_06, "function public\\.registrar_auditoria") !== null,
  ref(RUTA_17, lineaDe(RUTA_17, "^create trigger club_auditoria")),
);

// --- RLS ---
verificar("club: RLS activado", /alter table public\.club enable row level security;/.test(plano17), ref(RUTA_17, lineaDe(RUTA_17, "enable row level security")));
verificar(
  "club: lectura pública solo de los activos (o admin)",
  /create policy club_lectura_publica on public\.club for select to anon, authenticated using \(activo or public\.es_admin\(\)\);/.test(plano17),
  ref(RUTA_17, lineaDe(RUTA_17, "club_lectura_publica")),
);
verificar(
  "club: escritura exige es_admin() en using y en with check",
  /create policy club_escritura_admin on public\.club for all to authenticated using \(public\.es_admin\(\)\) with check \(public\.es_admin\(\)\);/.test(plano17),
  ref(RUTA_17, lineaDe(RUTA_17, "club_escritura_admin")),
);

// --- Semilla de clubes ---
const semillaClub = bloqueDesde(RUTA_17, "^insert into public\\.club \\(");
verificar("semilla de clubes presente", semillaClub !== null, ref(RUTA_17, semillaClub?.inicio));
let slugsSembrados = [];
if (semillaClub) {
  const listaCols = /insert into public\.club \(([^)]*)\)/.exec(colapsar(semillaClub.texto))?.[1] ?? "";
  const usadas = listaCols.split(",").map((c) => c.trim());
  const desconocidas = usadas.filter((c) => !columnasClub.includes(c));
  verificar(
    "semilla de clubes: todas sus columnas existen en el create table",
    desconocidas.length === 0,
    ref(RUTA_17, semillaClub.inicio),
    desconocidas.length ? `desconocidas: ${desconocidas.join(", ")}` : usadas.join(", "),
  );
  slugsSembrados = [...semillaClub.texto.matchAll(/'([a-z0-9-]+)',\s*\n?\s*'(club|programa)'/g)].map((m) => m[1]);
  verificar(
    "semilla de clubes: dos clubes y un programa",
    slugsSembrados.length === 3 && /'programa'/.test(semillaClub.texto),
    ref(RUTA_17, semillaClub.inicio),
    slugsSembrados.join(", "),
  );
  verificar(
    "semilla de clubes: idempotente (on conflict do nothing)",
    /on conflict \(slug\) do nothing/.test(colapsar(semillaClub.texto)),
    ref(RUTA_17, semillaClub.inicio),
  );
}

// ---------------------------------------------------------------------------
// 2. nivel
// ---------------------------------------------------------------------------

const columnasNivel = columnasDe(RUTA_02, "nivel");
verificar("columnas de nivel leídas de la 02", columnasNivel.length >= 9, ref(RUTA_02, lineaDe(RUTA_02, "^create table public\\.nivel \\(")), columnasNivel.join(", "));

verificar(
  "nivel: se añaden club_id y cupo_maximo",
  /alter table public\.nivel add column club_id uuid, add column cupo_maximo integer;/.test(plano17),
  ref(RUTA_17, lineaDe(RUTA_17, "add column club_id")),
);

const iRelleno = posicion(RUTA_17, "update public.nivel\n   set club_id =");
const iBorrado = posicion(RUTA_17, "delete from public.nivel");
const iNotNull = posicion(RUTA_17, "alter column club_id set not null");
const iFk = posicion(RUTA_17, "add constraint nivel_club_fk");
const iDropUnico = posicion(RUTA_17, "drop constraint nivel_orden_unico");
const iAddUnico = posicion(RUTA_17, "add constraint nivel_orden_unico unique (club_id, orden)");

verificar("nivel: el relleno de club_id va antes del SET NOT NULL", iRelleno !== -1 && iNotNull !== -1 && iRelleno < iNotNull, ref(RUTA_17, lineaDe(RUTA_17, "set club_id =")));
verificar("nivel: el borrado de marcadores va antes del SET NOT NULL", iBorrado !== -1 && iBorrado < iNotNull, ref(RUTA_17, lineaDe(RUTA_17, "^delete from public\\.nivel")));
verificar(
  "nivel: el borrado solo toca nombres entre corchetes",
  /delete from public\.nivel where nombre like '\[%';/.test(plano17),
  ref(RUTA_17, lineaDe(RUTA_17, "^delete from public\\.nivel")),
  "un nivel editado desde el panel sobrevive; el club sería una suposición y hay que revisarlo",
);
verificar("nivel: la FK se añade después del NOT NULL", iFk !== -1 && iNotNull < iFk, ref(RUTA_17, lineaDe(RUTA_17, "add constraint nivel_club_fk")));
verificar(
  "nivel: la FK del club es RESTRICT, no CASCADE",
  /add constraint nivel_club_fk foreign key \(club_id\) references public\.club \(id\) on delete restrict;/.test(plano17),
  ref(RUTA_17, lineaDe(RUTA_17, "nivel_club_fk")),
  "borrar un club no puede llevarse sus niveles",
);
verificar("nivel: el unique global se borra antes de crear el nuevo", iDropUnico !== -1 && iAddUnico !== -1 && iDropUnico < iAddUnico, ref(RUTA_17, lineaDe(RUTA_17, "drop constraint nivel_orden_unico")));
verificar(
  "nivel: el unique pasa a (club_id, orden)",
  iAddUnico !== -1,
  ref(RUTA_17, lineaDe(RUTA_17, "unique \\(club_id, orden\\)")),
  `el global estaba en ${ref(RUTA_02, lineaDe(RUTA_02, "constraint nivel_orden_unico unique \\(orden\\)"))}`,
);

// --- Semilla de niveles ---
const semillaNivel = bloqueDesde(RUTA_17, "^insert into public\\.nivel \\(");
verificar("semilla de niveles presente", semillaNivel !== null, ref(RUTA_17, semillaNivel?.inicio));
if (semillaNivel) {
  const listaCols = /insert into public\.nivel \(([^)]*)\)/.exec(colapsar(semillaNivel.texto))?.[1] ?? "";
  const usadas = listaCols.split(",").map((c) => c.trim());
  const reales = [...columnasNivel, "club_id", "cupo_maximo"];
  const desconocidas = usadas.filter((c) => !reales.includes(c));
  verificar(
    "semilla de niveles: todas sus columnas existen",
    desconocidas.length === 0,
    ref(RUTA_17, semillaNivel.inicio),
    desconocidas.length ? `desconocidas: ${desconocidas.join(", ")}` : usadas.join(", "),
  );
  const slugsUsados = [...new Set([...semillaNivel.texto.matchAll(/\('(bmx-[a-z-]+|habilidades-motrices)',/g)].map((m) => m[1]))];
  const huerfanos = slugsUsados.filter((s) => !slugsSembrados.includes(s));
  verificar(
    "semilla de niveles: sus slugs de club existen en la semilla de clubes",
    huerfanos.length === 0,
    ref(RUTA_17, semillaNivel.inicio),
    huerfanos.length ? `sin club: ${huerfanos.join(", ")}` : slugsUsados.join(", "),
  );
  const filas = (semillaNivel.texto.match(/^\s{4}\('/gm) ?? []).length;
  verificar("semilla de niveles: seis niveles", filas === 6, ref(RUTA_17, semillaNivel.inicio), `${filas} filas`);
  verificar(
    "semilla de niveles: idempotente por (club_id, orden)",
    /on conflict \(club_id, orden\) do nothing/.test(colapsar(semillaNivel.texto)),
    ref(RUTA_17, semillaNivel.inicio),
  );
  verificar(
    "semilla de niveles: Minirider e Intermedio en los dos clubes",
    (semillaNivel.texto.match(/'Minirider'/g) ?? []).length === 2 &&
      (semillaNivel.texto.match(/'Intermedio'/g) ?? []).length === 2,
    ref(RUTA_17, semillaNivel.inicio),
  );
}

// ---------------------------------------------------------------------------
// 3. producto y el enum
// ---------------------------------------------------------------------------

const iDropFn = posicion(RUTA_17, "drop function if exists public.guardar_producto");
const iRename = posicion(RUTA_17, "alter type public.categoria_producto rename to");
const iCreaTipo = posicion(RUTA_17, "create type public.categoria_producto as enum");
const iAlterCol = posicion(RUTA_17, "alter column categoria type public.categoria_producto");
const iDropTipo = posicion(RUTA_17, "drop type public.categoria_producto_obsoleto");
const iCreaFn = posicion(RUTA_17, "create or replace function public.guardar_producto");

verificar(
  "enum: la función que lo usa se borra antes de renombrar el tipo",
  iDropFn !== -1 && iRename !== -1 && iDropFn < iRename,
  ref(RUTA_17, lineaDe(RUTA_17, "^drop function if exists public\\.guardar_producto")),
  "el tipo viejo no se puede borrar mientras una función lo tenga en su firma",
);
verificar("enum: renombrar → crear → convertir → borrar, en ese orden",
  iRename < iCreaTipo && iCreaTipo < iAlterCol && iAlterCol < iDropTipo,
  ref(RUTA_17, lineaDe(RUTA_17, "rename to categoria_producto_obsoleto")));
verificar("enum: guardar_producto se recrea después de borrar el tipo viejo", iDropTipo < iCreaFn, ref(RUTA_17, lineaDe(RUTA_17, "^create or replace function public\\.guardar_producto")));

const valoresNuevos = /create type public\.categoria_producto as enum \(([^)]*)\)/.exec(plano17)?.[1] ?? "";
verificar(
  "enum: valores de tipo de prenda, salidos de los seis productos del documento",
  /'buso'/.test(valoresNuevos) && /'guantes'/.test(valoresNuevos) && /'camiseta'/.test(valoresNuevos) && /'gorra'/.test(valoresNuevos),
  ref(RUTA_17, lineaDe(RUTA_17, "as enum \\('buso'")),
  valoresNuevos.trim(),
);
const viejos = ["uniformes", "proteccion", "merchandising"];
verificar(
  "enum: ningún valor viejo sobrevive",
  !viejos.some((v) => new RegExp(`'${v}'`).test(valoresNuevos)),
  ref(RUTA_01, lineaDe(RUTA_01, "create type public\\.categoria_producto as enum")),
  `los de la 01 eran: ${viejos.join(", ")}`,
);
verificar(
  "enum: la conversión NO traduce valores (using null)",
  /alter column categoria type public\.categoria_producto using null/.test(plano17),
  ref(RUTA_17, lineaDe(RUTA_17, "using null")),
  "adivinar la prenda de «kit de protección» sería inventar el catálogo",
);
verificar(
  "producto: categoria pasa a ser nulable",
  /alter column categoria drop not null/.test(plano17),
  ref(RUTA_17, lineaDe(RUTA_17, "drop not null")),
  "la alternativa era un valor `otros` que ensuciaría el filtro para siempre",
);
verificar(
  "producto: club_id nulable con FK RESTRICT",
  /add column club_id uuid references public\.club \(id\) on delete restrict;/.test(plano17),
  ref(RUTA_17, lineaDe(RUTA_17, "add column club_id uuid references")),
  "nulo = marca TSW, no «sin asignar»",
);

// ---------------------------------------------------------------------------
// 4. Las RPC
// ---------------------------------------------------------------------------

const rpcs = [
  ["guardar_club", "uuid, uuid, text, text, text, text, text, text, text, text, integer"],
  ["alternar_club_activo", "uuid, uuid, boolean"],
  ["establecer_logo_club", "uuid, uuid, text"],
  ["guardar_nivel", "uuid, uuid, uuid, text, integer, text, integer, text, text, text, boolean"],
  ["reordenar_niveles", "uuid, uuid, uuid\\[\\]"],
  ["guardar_producto", "uuid, uuid, text, text, public.categoria_producto, uuid, text, boolean, integer"],
];

for (const [nombre, firma] of rpcs) {
  const fn = bloqueFuncion(RUTA_17, `^create or replace function public\\.${nombre}\\(`);
  verificar(`${nombre}: definida`, fn !== null, ref(RUTA_17, fn?.inicio));
  if (!fn) continue;

  const plana = colapsar(sinComentarios(fn.texto));
  verificar(`${nombre}: security definer`, /security definer/.test(plana), ref(RUTA_17, fn.inicio));
  verificar(`${nombre}: set search_path = public`, /set search_path = public/.test(plana), ref(RUTA_17, fn.inicio));
  verificar(`${nombre}: la primera sentencia es establecer_actor(p_actor_id)`, primeraSentenciaEsActor(fn.texto), ref(RUTA_17, fn.inicio));

  const rev = lineaDe(RUTA_17, `^revoke execute on function public\\.${nombre}\\(${firma}\\) from public, anon, authenticated;`);
  const gra = lineaDe(RUTA_17, `^grant\\s+execute on function public\\.${nombre}\\(${firma}\\) to service_role;`);
  verificar(`${nombre}: revoke con la firma exacta`, rev !== null, ref(RUTA_17, rev), "un revoke sobre una firma que no existe no da error y deja la función abierta");
  verificar(`${nombre}: grant solo a service_role`, gra !== null, ref(RUTA_17, gra));
  verificar(
    `${nombre}: comentada`,
    lineaDe(RUTA_17, `^comment on function public\\.${nombre}\\(`) !== null,
    ref(RUTA_17, lineaDe(RUTA_17, `^comment on function public\\.${nombre}\\(`)),
  );
}

// --- Firmas viejas retiradas ---
for (const [nombre, firmaVieja, origen] of [
  ["guardar_nivel", "uuid, uuid, text, integer, text, text, text, text, boolean", RUTA_07],
  ["reordenar_niveles", "uuid, uuid\\[\\]", RUTA_11],
]) {
  const linea = lineaDe(RUTA_17, `^drop function if exists public\\.${nombre}\\(${firmaVieja}\\);`);
  verificar(
    `${nombre}: la firma vieja se retira explícitamente`,
    linea !== null,
    ref(RUTA_17, linea),
    `sin el drop quedarían dos sobrecargas; la vieja vivía en ${ALIAS[origen]}`,
  );
}

// --- reordenar_niveles: lo que cambió ---
{
  const fn = bloqueFuncion(RUTA_17, "^create or replace function public\\.reordenar_niveles\\(");
  if (fn) {
    const cuerpo = sinComentarios(fn.texto);
    const plana = colapsar(cuerpo);
    const idxActor = cuerpo.indexOf("establecer_actor");
    const idxLock = cuerpo.indexOf("lock table public.nivel");
    const idxLecturas = cuerpo.indexOf("select count(*)");
    const idxUpdate = cuerpo.indexOf("update public.nivel");

    verificar(
      "reordenar_niveles: el lock es de tabla y va justo tras el actor, antes de leer",
      idxLock !== -1 && idxActor < idxLock && idxLock < idxLecturas && idxLecturas < idxUpdate,
      ref(RUTA_17, fn.inicio),
      "Postgres no bloquea subconjuntos: acotarlo al club dejaría abierta la carrera del INSERT",
    );
    verificar(
      "reordenar_niveles: in share row exclusive mode",
      /lock table public\.nivel in share row exclusive mode;/.test(plana),
      ref(RUTA_17, fn.inicio),
    );
    verificar(
      "reordenar_niveles: comprueba que los ids sean del club indicado",
      /n\.club_id is distinct from p_club_id/.test(plana) && /Estos niveles no pertenecen al club indicado\./.test(cuerpo),
      ref(RUTA_17, fn.inicio),
      "con el mensaje específico, no el genérico",
    );
    verificar(
      "reordenar_niveles: v_base y el conteo se calculan DENTRO del club",
      /into v_total, v_base from public\.nivel where club_id = p_club_id;/.test(plana),
      ref(RUTA_17, fn.inicio),
      "con el mínimo global la garantía dependería de filas que la sentencia no toca",
    );
    verificar(
      "reordenar_niveles: sigue el paso por negativos, no el intercambio directo",
      /set orden = v_base - ordenado\.posicion/.test(plana),
      ref(RUTA_17, fn.inicio),
    );
  }
}

// --- guardar_nivel y guardar_producto: el club ---
{
  const nivel = bloqueFuncion(RUTA_17, "^create or replace function public\\.guardar_nivel\\(");
  if (nivel) {
    const plana = colapsar(sinComentarios(nivel.texto));
    verificar("guardar_nivel: exige club", /if p_club_id is null then/.test(plana) && /Falta el club del nivel\./.test(nivel.texto), ref(RUTA_17, nivel.inicio));
    verificar("guardar_nivel: comprueba que el club exista", /not exists \(select 1 from public\.club where id = p_club_id\)/.test(plana), ref(RUTA_17, nivel.inicio));
  }
  const prod = bloqueFuncion(RUTA_17, "^create or replace function public\\.guardar_producto\\(");
  if (prod) {
    const plana = colapsar(sinComentarios(prod.texto));
    verificar(
      "guardar_producto: club nulo es válido y solo se comprueba si viene",
      /if p_club_id is not null and not exists \(select 1 from public\.club where id = p_club_id\)/.test(plana),
      ref(RUTA_17, prod.inicio),
      "nulo = marca TSW",
    );
    verificar(
      "guardar_producto: sigue siendo reemplazo total, sin coalesce",
      !/coalesce\(p_/.test(sinComentarios(prod.texto)),
      ref(RUTA_17, prod.inicio),
      `la versión vigente es la de la 12 (${ALIAS[RUTA_11]} no la tocó); reintroducir coalesce rompería el contrato de CLAUDE.md`,
    );
  }
  const club = bloqueFuncion(RUTA_17, "^create or replace function public\\.guardar_club\\(");
  if (club) {
    const cuerpo = sinComentarios(club.texto);
    verificar(
      "guardar_club: no toca activo ni logo_path (contrato de CLAUDE.md)",
      !/\bactivo\s*=/.test(cuerpo) && !/\blogo_path\s*=/.test(cuerpo),
      ref(RUTA_17, club.inicio),
      "van por alternar_club_activo y establecer_logo_club",
    );
    verificar(
      "guardar_club: reemplazo total, sin coalesce en los campos de texto",
      !/coalesce\(p_nombre, nombre\)/.test(cuerpo) && !/coalesce\(p_etiqueta/.test(cuerpo),
      ref(RUTA_17, club.inicio),
      "con coalesce, vaciar la etiqueta desde el panel no la vaciaría",
    );
  }
}

// ---------------------------------------------------------------------------
// 5. Mensajes
// ---------------------------------------------------------------------------

{
  // Los argumentos de un raise pueden seguir en la línea de abajo, así que el
  // resto se toma hasta `using errcode` o hasta el `;`, no hasta el fin de línea.
  const mensajes = [...texto17.matchAll(/raise exception '([^']*(?:''[^']*)*)'([\s\S]*?)(?:using errcode|;)/g)];
  verificar("hay mensajes de error que revisar", mensajes.length >= 8, ref(RUTA_17, 1), `${mensajes.length} mensajes`);
  const enIngles = mensajes.filter(([, m]) => /\b(the|does not|must|cannot|already exists|invalid)\b/i.test(m));
  verificar("todos los mensajes están en español", enIngles.length === 0, ref(RUTA_17, 1), enIngles.map(([, m]) => m.slice(0, 40)).join(" | "));
  /** Corta por comas de primer nivel: `array_length(p_ids, 1)` es UN argumento. */
  function argumentosDe(resto) {
    const partes = [];
    let nivel = 0;
    let actual = "";
    for (const c of resto) {
      if (c === "(") nivel += 1;
      else if (c === ")") nivel -= 1;
      if (c === "," && nivel === 0) {
        partes.push(actual);
        actual = "";
      } else {
        actual += c;
      }
    }
    partes.push(actual);
    return partes.map((p) => p.trim()).filter(Boolean);
  }

  const desajustes = [];
  for (const [, msg, resto] of mensajes) {
    const marcadores = (msg.match(/%/g) ?? []).length;
    const argumentos = argumentosDe(resto).length;
    if (marcadores !== argumentos) desajustes.push(`${marcadores}% vs ${argumentos}: ${msg.slice(0, 32)}`);
  }
  verificar("cada % de un raise tiene su argumento", desajustes.length === 0, ref(RUTA_17, 1), desajustes.join(" | "));

  const aperturas = (archivos.get(RUTA_17).texto.match(/^as \$\$$/gm) ?? []).length;
  const cierres = (archivos.get(RUTA_17).texto.match(/^\$\$;$/gm) ?? []).length;
  verificar("los cuerpos $$ abren y cierran parejos", aperturas === cierres && aperturas === rpcs.length, ref(RUTA_17, 1), `${aperturas}/${cierres} para ${rpcs.length} funciones`);
}

// ---------------------------------------------------------------------------
// Reporte
// ---------------------------------------------------------------------------

const ancho = Math.max(...resultados.map((r) => r.nombre.length));
let fallas = 0;
console.log("");
for (const r of resultados) {
  if (!r.ok) fallas += 1;
  console.log(`${r.ok ? "  OK  " : " FALLA"}  ${r.nombre.padEnd(ancho)}  ${r.ref}${r.detalle ? `  (${r.detalle})` : ""}`);
}
console.log("");
console.log(`Casos: ${resultados.length}, fallidos: ${fallas}`);
console.log("");

if (fallas > 0) {
  console.log("HAY DISCREPANCIAS: corregir la migración y volver a correr este script (máximo 5 vueltas).");
  process.exit(1);
}

console.log("VALIDACIÓN LIMPIA");
console.log("");
console.log("Sin verificar de forma mecánica:");
console.log("  · La semántica de los cuerpos plpgsql: libpg_query no cubre plpgsql. Queda sin");
console.log("    probar hasta el db push que reordenar_niveles no choque con el unique nuevo,");
console.log("    y que la conversión del enum no tropiece con alguna dependencia no vista.");
console.log("  · La danza del enum contra un Postgres real: si algo más dependiera de");
console.log("    categoria_producto, el drop del tipo viejo fallaría. Solo guardar_producto lo");
console.log("    usa según los archivos, pero eso es lo que el push confirma.");
console.log("  · La carrera de dos reordenamientos simultáneos: el lock la cubre sobre el");
console.log("    papel, probarla exige dos conexiones vivas (dos psql).");
console.log("  · Los textos de la semilla contra el documento del cliente: se copiaron a mano");
console.log("    y hay que leerlos en pantalla.");
