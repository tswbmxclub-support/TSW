/**
 * Verificación mecánica de la migración 16 (la bitácora deja anonimizar al
 * actor, y solo eso).
 *
 * Lee los archivos SQL reales del repo —no la conversación— y cruza:
 *   · que la lista de columnas comparadas sea EXACTAMENTE la de la tabla
 *     creada en la migración 06, sin faltar ninguna y sin inventar ninguna,
 *   · que la única excepción sea de actor_id no nulo a NULL,
 *   · que el DELETE siga sin excepción,
 *   · que el mensaje y el errcode no cambien respecto de la 06,
 *   · que no se condicione por rol, sesión ni origen del UPDATE,
 *   · que el trigger de la 06 siga apuntando a esta función.
 *
 * Se corre con `node scripts/verificar-bitacora-actor.mjs`. Termina con
 * "VALIDACIÓN LIMPIA" solo si todo cruza. Los cuerpos plpgsql quedan
 * declarados como sin verificación (ver el final del reporte).
 */
import { readFileSync, readdirSync } from "node:fs";

const DIR = "supabase/migrations";
const RUTA_16 = `${DIR}/20260923120000_bitacora_anonimizar_actor.sql`;
const RUTA_10 = `${DIR}/20260918050500_endurecer_permisos_y_indices.sql`;
const RUTA_06 = `${DIR}/20260917100500_auditoria.sql`;

const ALIAS = { [RUTA_16]: "16", [RUTA_10]: "10", [RUTA_06]: "06" };

const archivos = new Map(
  Object.keys(ALIAS).map((ruta) => {
    const texto = readFileSync(ruta, "utf8");
    return [ruta, { texto, lineas: texto.split("\n") }];
  }),
);

const sinComentarios = (texto) => texto.replace(/--[^\n]*/g, "");
const colapsar = (texto) => texto.replace(/\s+/g, " ");

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

const resultados = [];
const verificar = (nombre, condicion, referencia, detalle = "") =>
  resultados.push({ nombre, ok: Boolean(condicion), ref: referencia ?? "—", detalle });

// ---------------------------------------------------------------------------
// 0. El archivo
// ---------------------------------------------------------------------------

const migraciones = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
verificar("solo una migración nueva sobre las 15 previas", migraciones.length === 16, "—", `${migraciones.length} archivos`);
verificar(
  "la 16 es la última por timestamp",
  migraciones.at(-1) === RUTA_16.split("/").pop(),
  ref(RUTA_16, 1),
  migraciones.at(-1),
);
{
  const cuerpo = sinComentarios(archivos.get(RUTA_16).texto);
  verificar("la 16 no crea ni altera tablas", !/\b(create|alter|drop)\s+table\b/i.test(cuerpo), ref(RUTA_16, 1));
  verificar("la 16 no toca la clave foránea de actor_id", !/references\s+auth\.users/i.test(cuerpo), ref(RUTA_16, 1),
    "el arreglo va en el trigger, no en la FK: ON DELETE SET NULL sigue siendo el comportamiento correcto");
  verificar("la 16 no recrea ni borra el trigger de la 06", !/\b(create|drop)\s+trigger\b/i.test(cuerpo), ref(RUTA_16, 1));
}

// ---------------------------------------------------------------------------
// 1. Origen: la tabla y el trigger de la 06
// ---------------------------------------------------------------------------

const tabla = bloqueDesde(RUTA_06, "^create table public\\.evento_auditoria \\(");
verificar("origen: create table de la 06", tabla !== null, ref(RUTA_06, tabla?.inicio));

const trigger06 = bloqueDesde(RUTA_06, "^create trigger evento_auditoria_inmutable");
verificar("origen: trigger evento_auditoria_inmutable de la 06", trigger06 !== null, ref(RUTA_06, trigger06?.inicio));
verificar(
  "el trigger de la 06 es BEFORE UPDATE OR DELETE y llama a esta función",
  trigger06 !== null &&
    /before update or delete on public\.evento_auditoria for each row execute function public\.evento_auditoria_solo_insercion\(\);/.test(
      colapsar(trigger06.texto),
    ),
  ref(RUTA_06, trigger06?.inicio),
  "por eso basta con CREATE OR REPLACE de la función",
);

const fk = lineaDe(RUTA_06, "actor_id\\s+uuid references auth\\.users \\(id\\) on delete set null");
verificar(
  "la FK de actor_id es ON DELETE SET NULL (es el UPDATE que hay que permitir)",
  fk !== null,
  ref(RUTA_06, fk),
);

// Columnas reales, leídas del CREATE TABLE de la 06.
const columnas = [];
if (tabla) {
  for (const linea of sinComentarios(tabla.texto).split("\n").slice(1)) {
    const m = /^\s{2}([a-z_]+)\s+[a-z]/.exec(linea);
    if (m && m[1] !== "constraint") columnas.push(m[1]);
  }
}
verificar("columnas de evento_auditoria leídas de la 06", columnas.length === 8, ref(RUTA_06, tabla?.inicio), columnas.join(", "));

// ---------------------------------------------------------------------------
// 2. La función nueva
// ---------------------------------------------------------------------------

const fn = bloqueFuncion(RUTA_16, "^create or replace function public\\.evento_auditoria_solo_insercion\\(\\)");
verificar("evento_auditoria_solo_insercion redefinida", fn !== null, ref(RUTA_16, fn?.inicio));

if (fn) {
  const cuerpo = sinComentarios(fn.texto);
  const plana = colapsar(cuerpo);
  const linea = (indice) => ref(RUTA_16, indice === -1 ? null : fn.inicio + cuerpo.slice(0, indice).split("\n").length - 1);

  verificar("returns trigger, language plpgsql", /returns trigger language plpgsql/.test(plana), ref(RUTA_16, fn.inicio));
  verificar("set search_path = public", /set search_path = public/.test(plana), ref(RUTA_16, fn.inicio));
  verificar(
    "sigue siendo SECURITY INVOKER",
    !/security definer/i.test(cuerpo),
    ref(RUTA_16, fn.inicio),
    `la 10 dejó dicho por qué no lleva revoke: ${ref(RUTA_10, lineaDe(RUTA_10, "evento_auditoria_solo_insercion"))}`,
  );

  // --- La excepción: solo UPDATE, solo de actor a NULL ---
  verificar(
    "la excepción exige tg_op = 'UPDATE'",
    /if tg_op = 'UPDATE'/.test(plana),
    linea(cuerpo.indexOf("tg_op")),
    "sin esto, un DELETE entraría por la misma puerta",
  );
  verificar(
    "solo anonimiza: old.actor_id not null y new.actor_id null",
    /and old\.actor_id is not null and new\.actor_id is null/.test(plana),
    linea(cuerpo.indexOf("old.actor_id")),
    "poner un actor donde no lo había, o cambiarlo por otro, sigue prohibido",
  );
  verificar(
    "el DELETE no tiene ninguna excepción",
    !/tg_op\s*=\s*'DELETE'/i.test(cuerpo) && !/tg_op\s*(<>|!=)\s*'UPDATE'/i.test(cuerpo),
    ref(RUTA_16, fn.inicio),
    "cae siempre al raise",
  );

  // --- Red 1: columna por columna, exactamente las de la 06 ---
  const comparadas = [...cuerpo.matchAll(/new\.([a-z_]+)\s+is not distinct from old\.\1/g)].map((m) => m[1]);
  const esperadas = columnas.filter((c) => c !== "actor_id");
  const faltan = esperadas.filter((c) => !comparadas.includes(c));
  const sobran = comparadas.filter((c) => !esperadas.includes(c));
  verificar(
    "compara TODAS las demás columnas de la tabla, una por una",
    faltan.length === 0,
    linea(cuerpo.indexOf("is not distinct from")),
    faltan.length ? `sin comparar: ${faltan.join(", ")}` : comparadas.join(", "),
  );
  verificar(
    "no compara columnas que no existen en la 06",
    sobran.length === 0,
    linea(cuerpo.indexOf("is not distinct from")),
    sobran.length ? `inventadas: ${sobran.join(", ")}` : "todas cruzan con el create table",
  );
  verificar(
    "los dos jsonb entran en la comparación por columna",
    comparadas.includes("antes_json") && comparadas.includes("despues_json"),
    linea(cuerpo.indexOf("antes_json")),
  );
  verificar(
    "actor_id NO está en la comparación por columna",
    !comparadas.includes("actor_id"),
    ref(RUTA_16, fn.inicio),
    "es justo la que puede cambiar",
  );

  // --- Red 2: fila entera menos actor_id, comparada como texto ---
  const idxFila = cuerpo.indexOf("to_jsonb(new)");
  verificar(
    "compara además la fila entera sin actor_id",
    /\(to_jsonb\(new\) - 'actor_id'\)::text is not distinct from \(to_jsonb\(old\) - 'actor_id'\)::text/.test(plana),
    linea(idxFila),
    "cubre cualquier columna que se añada después, que la lista de arriba no conocería",
  );
  verificar(
    "esa comparación es de texto, no de jsonb",
    idxFila !== -1 && /\)::text is not distinct from/.test(cuerpo.slice(idxFila, idxFila + 200)),
    linea(idxFila),
    "'1' y '1.0' son el mismo jsonb y distinto texto; en una bitácora tampoco debe cambiar la forma",
  );

  // --- Lo que NO se puede mirar ---
  const prohibidos = ["current_user", "session_user", "current_setting", "auth.uid", "auth.role", "pg_trigger_depth"];
  const usados = prohibidos.filter((p) => cuerpo.includes(p));
  verificar(
    "no condiciona por rol, sesión ni origen del UPDATE",
    usados.length === 0,
    ref(RUTA_16, fn.inicio),
    usados.length ? `usa: ${usados.join(", ")}` : "una condición que se puede fingir no es una condición",
  );

  // --- El rechazo, idéntico al de la 06 ---
  const mensaje06 = /raise exception '([^']*)'\s*\n\s*using errcode = '([a-z_]+)'/.exec(sinComentarios(archivos.get(RUTA_06).texto));
  const mensaje16 = /raise exception '([^']*)'\s*\n\s*using errcode = '([a-z_]+)'/.exec(cuerpo);
  verificar(
    "el mensaje de rechazo es el mismo que en la 06",
    mensaje06 !== null && mensaje16 !== null && mensaje06[1] === mensaje16[1],
    linea(cuerpo.indexOf("raise exception")),
    mensaje16?.[1],
  );
  verificar(
    "el errcode de rechazo es el mismo que en la 06",
    mensaje06 !== null && mensaje16 !== null && mensaje06[2] === mensaje16[2],
    linea(cuerpo.indexOf("using errcode")),
    `${mensaje16?.[2]} (restrict_violation = 23001, el que ya observa la aplicación)`,
  );
  verificar(
    "solo hay un raise en la función",
    (cuerpo.match(/raise exception/g) ?? []).length === 1,
    ref(RUTA_16, fn.inicio),
    "un segundo mensaje distinguiría casos y diría de más",
  );
  verificar(
    "el único `return new` está dentro de la excepción, antes del raise",
    (cuerpo.match(/return new;/g) ?? []).length === 1 &&
      cuerpo.indexOf("return new;") < cuerpo.indexOf("raise exception"),
    linea(cuerpo.indexOf("return new;")),
  );

  verificar(
    "la función queda comentada",
    lineaDe(RUTA_16, "^comment on function public\\.evento_auditoria_solo_insercion") !== null,
    ref(RUTA_16, lineaDe(RUTA_16, "^comment on function public\\.evento_auditoria_solo_insercion")),
  );

  const aperturas = (archivos.get(RUTA_16).texto.match(/^as \$\$$/gm) ?? []).length;
  const cierres = (archivos.get(RUTA_16).texto.match(/^\$\$;$/gm) ?? []).length;
  verificar("los cuerpos $$ abren y cierran parejos", aperturas === 1 && cierres === 1, ref(RUTA_16, fn.inicio), `${aperturas}/${cierres}`);
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
console.log("  · La semántica del cuerpo plpgsql: libpg_query no cubre plpgsql, así que esto");
console.log("    cruza estructura y nombres, no comportamiento. Hasta el db push quedan sin");
console.log("    probar: que la cascada ON DELETE SET NULL pase de verdad el trigger, que un");
console.log("    UPDATE de cualquier otra columna siga dando 23001, y que el DELETE sobre la");
console.log("    bitácora siga rechazado.");
console.log("  · Que `to_jsonb(new) - 'actor_id'` se comporte igual en una fila con jsonb");
console.log("    nulos que en una con contenido: la prueba es el push.");
console.log("  · Si Postgres dispara el trigger en la cascada de la FK con los mismos OLD y");
console.log("    NEW que en un UPDATE a mano. Se asume que sí; lo demuestra el borrado real");
console.log("    de la cuenta temporal, que es el primer paso después de aplicar.");
