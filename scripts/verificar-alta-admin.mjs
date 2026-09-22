/**
 * Verificación mecánica de la migración 15 (alta explícita de administradores).
 *
 * Lee los archivos SQL reales del repo —no la conversación— y cruza:
 *   · que las columnas que la 15 escribe existan de verdad en la 13,
 *   · que los nombres de trigger, función y constraint coincidan con su origen,
 *   · la estructura de la RPC (actor primero, definer, search_path, privilegios),
 *   · el orden delete→insert que exige el trigger de exclusividad de la 13,
 *   · la idempotencia (ON CONFLICT) y el guardado sin ruido (IS DISTINCT FROM),
 *   · que `activo` quede fuera del contrato, como manda CLAUDE.md,
 *   · que ningún mensaje de error salga en inglés.
 *
 * Se corre con `node scripts/verificar-alta-admin.mjs`. Termina con
 * "VALIDACIÓN LIMPIA" solo si todo cruza. Los cuerpos plpgsql quedan
 * declarados como sin verificación (ver el final del reporte).
 */
import { readFileSync, readdirSync } from "node:fs";

const DIR = "supabase/migrations";
const RUTA_15 = `${DIR}/20260922120000_alta_explicita_de_administradores.sql`;
const RUTA_14 = `${DIR}/20260920150000_revocar_ejecucion_triggers_perfiles.sql`;
const RUTA_13 = `${DIR}/20260920100000_perfiles_admin_y_usuario.sql`;
const RUTA_07 = `${DIR}/20260917100600_funciones_negocio.sql`;

const ALIAS = { [RUTA_15]: "15", [RUTA_14]: "14", [RUTA_13]: "13", [RUTA_07]: "07" };

const archivos = new Map(
  Object.keys(ALIAS).map((ruta) => {
    const texto = readFileSync(ruta, "utf8");
    return [ruta, { texto, lineas: texto.split("\n") }];
  }),
);

/** Texto sin comentarios `--`: un comentario no debe hacer pasar una prueba. */
function sinComentarios(texto) {
  return texto.replace(/--[^\n]*/g, "");
}

function colapsar(texto) {
  return texto.replace(/\s+/g, " ");
}

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

/** Referencia «15:123» para el reporte. */
function ref(ruta, linea) {
  return linea === null || linea === undefined ? "—" : `${ALIAS[ruta]}:${linea}`;
}

/** Cuerpo completo de una función: desde su `create` hasta la línea `$$;`. */
function bloqueFuncion(ruta, patron) {
  const { lineas } = archivos.get(ruta);
  const inicio = lineaDe(ruta, patron);
  if (inicio === null) return null;
  let fin = inicio;
  while (fin < lineas.length && lineas[fin].trimEnd() !== "$$;") fin += 1;
  if (fin >= lineas.length) return null;
  return { inicio, fin: fin + 1, texto: lineas.slice(inicio - 1, fin + 1).join("\n") };
}

/** Sentencia suelta: desde la línea del patrón hasta la primera acabada en `;`. */
function bloqueDesde(ruta, patron) {
  const { lineas } = archivos.get(ruta);
  const inicio = lineaDe(ruta, patron);
  if (inicio === null) return null;
  let fin = inicio - 1;
  while (fin < lineas.length && !lineas[fin].trimEnd().endsWith(";")) fin += 1;
  return { inicio, fin: fin + 1, texto: lineas.slice(inicio - 1, fin + 1).join("\n") };
}

const resultados = [];
function verificar(nombre, condicion, referencia, detalle = "") {
  resultados.push({ nombre, ok: Boolean(condicion), ref: referencia ?? "—", detalle });
}

/** La primera sentencia tras `begin` debe ser establecer_actor(p_actor_id). */
function primeraSentenciaEsActor(textoFuncion) {
  const cuerpo = sinComentarios(textoFuncion);
  const m = /\bbegin\b/.exec(cuerpo);
  if (!m) return false;
  const desdeBegin = cuerpo.slice(m.index + m[0].length);
  const fin = desdeBegin.indexOf(";");
  if (fin === -1) return false;
  return /^perform public\.establecer_actor\(p_actor_id\)$/.test(desdeBegin.slice(0, fin).trim());
}

// ---------------------------------------------------------------------------
// 0. El archivo: uno solo, y después de la 14
// ---------------------------------------------------------------------------

const migraciones = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
verificar(
  "solo una migración nueva sobre las 14 previas",
  migraciones.length === 15,
  `—`,
  `${migraciones.length} archivos en ${DIR}`,
);
verificar(
  "la 15 es la última por timestamp",
  migraciones[migraciones.length - 1] === RUTA_15.split("/").pop(),
  ref(RUTA_15, 1),
  migraciones[migraciones.length - 1],
);
verificar(
  "la 15 no crea tablas ni tipos nuevos",
  !/^create\s+(table|type)\b/im.test(sinComentarios(archivos.get(RUTA_15).texto)),
  ref(RUTA_15, 1),
  "el alcance aprobado es RPC + hook, nada de esquema nuevo",
);

// ---------------------------------------------------------------------------
// 1. Firmas de origen: lo que la 15 da por existente, existe en la 13 y la 07
// ---------------------------------------------------------------------------

const origenes = [
  [RUTA_13, "create table public\\.perfil_admin \\(", "tabla perfil_admin"],
  [RUTA_13, "create table public\\.perfil_usuario \\(", "tabla perfil_usuario"],
  [RUTA_13, "create or replace function public\\.crear_perfil_al_registrar\\(\\)", "función crear_perfil_al_registrar"],
  [RUTA_13, "create trigger en_auth_users_crear_perfil", "trigger en_auth_users_crear_perfil"],
  [RUTA_13, "create trigger perfil_admin_exclusividad", "trigger de exclusividad en perfil_admin"],
  [RUTA_13, "create trigger perfil_usuario_exclusividad", "trigger de exclusividad en perfil_usuario"],
  [RUTA_13, "create trigger perfil_admin_auditoria", "trigger de auditoría en perfil_admin"],
  [RUTA_13, "create trigger perfil_usuario_auditoria", "trigger de auditoría en perfil_usuario"],
  [RUTA_07, "create or replace function public\\.establecer_actor\\(p_actor_id uuid\\)", "función establecer_actor(uuid)"],
];
for (const [ruta, patron, etiqueta] of origenes) {
  const linea = lineaDe(ruta, `^${patron}`);
  verificar(`origen presente: ${etiqueta}`, linea !== null, ref(ruta, linea));
}

// Columnas reales de las dos tablas, extraídas del CREATE TABLE de la 13.
function columnasDe(ruta, tabla) {
  const bloque = bloqueDesde(ruta, `^create table public\\.${tabla} \\(`);
  if (!bloque) return new Set();
  const cuerpo = sinComentarios(bloque.texto);
  const nombres = new Set();
  for (const linea of cuerpo.split("\n").slice(1)) {
    const m = /^\s{2}([a-z_]+)\s+[a-z]/.exec(linea);
    if (m && m[1] !== "constraint") nombres.add(m[1]);
  }
  return nombres;
}

const colAdmin = columnasDe(RUTA_13, "perfil_admin");
const colUsuario = columnasDe(RUTA_13, "perfil_usuario");
verificar("columnas de perfil_admin leídas de la 13", colAdmin.size >= 5, ref(RUTA_13, lineaDe(RUTA_13, "^create table public\\.perfil_admin")), [...colAdmin].join(", "));
verificar("columnas de perfil_usuario leídas de la 13", colUsuario.size >= 6, ref(RUTA_13, lineaDe(RUTA_13, "^create table public\\.perfil_usuario")), [...colUsuario].join(", "));

const conciliar = bloqueFuncion(RUTA_15, "^create or replace function public\\.conciliar_perfil_de_cuenta\\(");
const rpc = bloqueFuncion(RUTA_15, "^create or replace function public\\.crear_perfil_admin\\(");
const hook = bloqueFuncion(RUTA_15, "^create or replace function public\\.crear_perfil_al_registrar\\(\\)");

verificar("conciliar_perfil_de_cuenta definida", conciliar !== null, ref(RUTA_15, conciliar?.inicio));
verificar("crear_perfil_admin definida", rpc !== null, ref(RUTA_15, rpc?.inicio));
verificar("crear_perfil_al_registrar redefinida", hook !== null, ref(RUTA_15, hook?.inicio));

// Cada columna que la 15 nombra en un INSERT/UPDATE debe existir en su tabla.
if (conciliar) {
  const cuerpo = sinComentarios(conciliar.texto);
  const inserts = [...cuerpo.matchAll(/insert\s+into\s+public\.(perfil_admin|perfil_usuario)\s*\(([^)]*)\)/gi)];
  verificar("conciliar: un INSERT por cada tabla de perfil", inserts.length === 2, ref(RUTA_15, conciliar.inicio));
  for (const [, tabla, lista] of inserts) {
    const reales = tabla === "perfil_admin" ? colAdmin : colUsuario;
    const usadas = lista.split(",").map((c) => c.trim());
    const desconocidas = usadas.filter((c) => !reales.has(c));
    verificar(
      `conciliar: columnas del INSERT en ${tabla} existen en la 13`,
      desconocidas.length === 0,
      ref(RUTA_15, conciliar.inicio),
      desconocidas.length ? `desconocidas: ${desconocidas.join(", ")}` : usadas.join(", "),
    );
  }
  const sets = [...cuerpo.matchAll(/update\s+public\.(perfil_admin|perfil_usuario)\s+set\s+([a-z_]+)\s*=/gi)];
  for (const [, tabla, columna] of sets) {
    const reales = tabla === "perfil_admin" ? colAdmin : colUsuario;
    verificar(
      `conciliar: la columna «${columna}» del UPDATE en ${tabla} existe en la 13`,
      reales.has(columna),
      ref(RUTA_15, conciliar.inicio),
    );
  }
}

// ---------------------------------------------------------------------------
// 2. conciliar_perfil_de_cuenta: preámbulo, orden, idempotencia, rechazo
// ---------------------------------------------------------------------------

if (conciliar) {
  const plana = colapsar(sinComentarios(conciliar.texto));
  const cuerpo = sinComentarios(conciliar.texto);
  const linea = (indice) => ref(RUTA_15, indice === -1 ? null : conciliar.inicio + cuerpo.slice(0, indice).split("\n").length - 1);

  verificar(
    "conciliar: firma (uuid, text, text) returns void",
    /conciliar_perfil_de_cuenta\( p_id uuid, p_tipo text, p_nombre text \) returns void/.test(plana),
    ref(RUTA_15, conciliar.inicio),
  );
  verificar("conciliar: security definer", /security definer/.test(plana), ref(RUTA_15, conciliar.inicio));
  verificar("conciliar: set search_path = public", /set search_path = public/.test(plana), ref(RUTA_15, conciliar.inicio));
  verificar(
    "conciliar: rechaza un tipo que no sea admin ni usuario",
    /p_tipo not in \('admin', 'usuario'\)/.test(plana),
    linea(cuerpo.indexOf("p_tipo not in")),
  );

  // La rama admin y la rama usuario, cada una con su orden.
  for (const [propia, otra] of [["perfil_admin", "perfil_usuario"], ["perfil_usuario", "perfil_admin"]]) {
    const idxDelete = cuerpo.indexOf(`delete from public.${otra} where id = p_id`);
    const idxInsert = cuerpo.indexOf(`insert into public.${propia} (id, nombre)`);
    verificar(
      `conciliar/${propia}: borra el perfil contrario antes de insertar`,
      idxDelete !== -1 && idxInsert !== -1 && idxDelete < idxInsert,
      linea(idxDelete),
      "el trigger de exclusividad de la 13 es BEFORE INSERT: con el orden al revés siempre falla",
    );
    const desdeInsert = idxInsert === -1 ? "" : cuerpo.slice(idxInsert, idxInsert + 240);
    verificar(
      `conciliar/${propia}: INSERT idempotente (on conflict (id) do update)`,
      /on conflict \(id\) do update set nombre = excluded\.nombre/.test(colapsar(desdeInsert)),
      linea(idxInsert),
      "dos altas simultáneas del mismo id no pueden reventar por clave duplicada",
    );
    const idxUpdate = cuerpo.indexOf(`update public.${propia}`);
    const desdeUpdate = idxUpdate === -1 ? "" : colapsar(cuerpo.slice(idxUpdate, idxUpdate + 240));
    verificar(
      `conciliar/${propia}: el refresco de nombre lleva IS DISTINCT FROM`,
      /and nombre is distinct from v_nombre/.test(desdeUpdate),
      linea(idxUpdate),
      "sin él, cada llamada repetida dejaría un evento de auditoría sin cambio real",
    );
  }

  const rechazos = [...cuerpo.matchAll(/raise exception '([^']*(?:''[^']*)*)'/g)].map((m) => m[1]);
  verificar(
    "conciliar: rechaza migrar un perfil ACTIVO, en las dos ramas",
    rechazos.filter((m) => /activo\./i.test(m)).length === 2,
    ref(RUTA_15, conciliar.inicio),
    `${rechazos.length} mensajes en la función`,
  );
  verificar(
    "conciliar: todos los rechazos usan errcode check_violation",
    (cuerpo.match(/raise exception/g) ?? []).length === (cuerpo.match(/using errcode = 'check_violation'/g) ?? []).length,
    ref(RUTA_15, conciliar.inicio),
  );
  verificar(
    "conciliar: NO escribe la columna activo (contrato de CLAUDE.md)",
    !/\bset\b[^;]*\bactivo\s*=/.test(cuerpo) && !/\(id, nombre, activo\)/.test(cuerpo),
    ref(RUTA_15, conciliar.inicio),
    "activo solo se mueve por activar_admin / desactivar_admin",
  );

  const revocacion = bloqueDesde(RUTA_15, "^revoke execute on function public\\.conciliar_perfil_de_cuenta");
  verificar(
    "conciliar: revocada de public, anon, authenticated Y service_role",
    revocacion !== null && /from public, anon, authenticated, service_role/.test(colapsar(revocacion.texto)),
    ref(RUTA_15, revocacion?.inicio),
    "es interna: no es una operación del panel",
  );
  verificar(
    "conciliar: sin GRANT a nadie",
    !new RegExp("grant\\s+execute\\s+on\\s+function\\s+public\\.conciliar_perfil_de_cuenta", "i").test(archivos.get(RUTA_15).texto),
    ref(RUTA_15, conciliar.inicio),
  );
  verificar(
    "conciliar: comentada",
    lineaDe(RUTA_15, "^comment on function public\\.conciliar_perfil_de_cuenta") !== null,
    ref(RUTA_15, lineaDe(RUTA_15, "^comment on function public\\.conciliar_perfil_de_cuenta")),
  );
}

// ---------------------------------------------------------------------------
// 3. crear_perfil_admin: la convención de toda RPC del panel
// ---------------------------------------------------------------------------

if (rpc) {
  const plana = colapsar(sinComentarios(rpc.texto));
  const cuerpo = sinComentarios(rpc.texto);

  verificar(
    "crear_perfil_admin: firma (p_actor_id uuid, p_id uuid, p_nombre text)",
    /crear_perfil_admin\( p_actor_id uuid, p_id uuid, p_nombre text \)/.test(plana),
    ref(RUTA_15, rpc.inicio),
  );
  verificar(
    "crear_perfil_admin: returns public.perfil_admin",
    /returns public\.perfil_admin/.test(plana),
    ref(RUTA_15, rpc.inicio),
  );
  verificar("crear_perfil_admin: security definer", /security definer/.test(plana), ref(RUTA_15, rpc.inicio));
  verificar("crear_perfil_admin: set search_path = public", /set search_path = public/.test(plana), ref(RUTA_15, rpc.inicio));
  verificar(
    "crear_perfil_admin: la primera sentencia es establecer_actor(p_actor_id)",
    primeraSentenciaEsActor(rpc.texto),
    ref(RUTA_15, rpc.inicio),
    "sin esto la bitácora guarda actor_id = NULL",
  );
  verificar(
    "crear_perfil_admin: comprueba que la cuenta exista en auth.users",
    /not exists \(select 1 from auth\.users where id = p_id\)/.test(plana),
    ref(RUTA_15, rpc.inicio),
  );
  verificar(
    "crear_perfil_admin: delega en conciliar_perfil_de_cuenta y no duplica reglas",
    /perform public\.conciliar_perfil_de_cuenta\(p_id, 'admin', btrim\(p_nombre\)\)/.test(plana) &&
      !/insert into public\.perfil_admin/i.test(cuerpo) &&
      !/delete from public\./i.test(cuerpo),
    ref(RUTA_15, rpc.inicio),
  );
  verificar(
    "crear_perfil_admin: NO toca activo",
    !/\bactivo\b/.test(cuerpo),
    ref(RUTA_15, rpc.inicio),
    "activar es un paso aparte, por activar_admin",
  );
  verificar(
    "crear_perfil_admin: rechaza nombre vacío",
    /nullif\(btrim\(p_nombre\), ''\) is null/.test(plana),
    ref(RUTA_15, rpc.inicio),
    `cruza con el constraint perfil_admin_nombre_no_vacio de la 13`,
  );

  const rev = bloqueDesde(RUTA_15, "^revoke execute on function public\\.crear_perfil_admin");
  const gra = bloqueDesde(RUTA_15, "^grant\\s+execute on function public\\.crear_perfil_admin");
  verificar(
    "crear_perfil_admin: revoke de public, anon, authenticated",
    rev !== null && /from public, anon, authenticated;/.test(colapsar(rev.texto)),
    ref(RUTA_15, rev?.inicio),
  );
  verificar(
    "crear_perfil_admin: grant solo a service_role",
    gra !== null && /to service_role;/.test(colapsar(gra.texto)),
    ref(RUTA_15, gra?.inicio),
  );
  verificar(
    "crear_perfil_admin: la firma del revoke/grant coincide con la de la función",
    rev !== null && gra !== null &&
      /crear_perfil_admin\(uuid, uuid, text\)/.test(rev.texto) &&
      /crear_perfil_admin\(uuid, uuid, text\)/.test(gra.texto),
    ref(RUTA_15, rev?.inicio),
    "un revoke sobre una firma que no existe no da error y deja la función abierta",
  );
  verificar(
    "crear_perfil_admin: comentada",
    lineaDe(RUTA_15, "^comment on function public\\.crear_perfil_admin") !== null,
    ref(RUTA_15, lineaDe(RUTA_15, "^comment on function public\\.crear_perfil_admin")),
  );
}

// ---------------------------------------------------------------------------
// 4. El hook y su trigger
// ---------------------------------------------------------------------------

if (hook) {
  const plana = colapsar(sinComentarios(hook.texto));
  const cuerpo = sinComentarios(hook.texto);

  verificar(
    "hook: lee el tipo de raw_app_meta_data con 'usuario' por defecto",
    /v_tipo := coalesce\(new\.raw_app_meta_data ->> 'tipo', 'usuario'\)/.test(plana),
    ref(RUTA_15, hook.inicio),
  );
  verificar(
    "hook: distingue el UPDATE y compara contra old",
    /tg_op = 'UPDATE'/.test(plana) && /old\.raw_app_meta_data ->> 'tipo'/.test(plana),
    ref(RUTA_15, hook.inicio),
  );
  verificar(
    "hook: sale temprano si el tipo no cambió",
    /if v_tipo is not distinct from v_tipo_previo then return new; end if;/.test(plana),
    ref(RUTA_15, hook.inicio),
    "sin esto, cada escritura de app_metadata reconciliaría sin nada que reconciliar",
  );
  verificar(
    "hook: un tipo desconocido cae a 'usuario' en vez de reventar el alta",
    (plana.match(/not in \('admin', 'usuario'\) then v_tipo/g) ?? []).length >= 1,
    ref(RUTA_15, hook.inicio),
  );
  verificar(
    "hook: delega en conciliar_perfil_de_cuenta y no escribe tablas",
    /perform public\.conciliar_perfil_de_cuenta\(new\.id, v_tipo, v_nombre\)/.test(plana) &&
      !/insert into public\.perfil/i.test(cuerpo),
    ref(RUTA_15, hook.inicio),
  );
  verificar(
    "hook: conserva la derivación del nombre de la 13 (metadatos, correo, 'sin nombre')",
    /raw_user_meta_data ->> 'nombre'/.test(plana) &&
      /split_part\(coalesce\(new\.email, ''\), '@', 1\)/.test(plana) &&
      /'sin nombre'/.test(plana),
    ref(RUTA_15, hook.inicio),
  );

  const drop = bloqueDesde(RUTA_15, "^drop trigger if exists en_auth_users_crear_perfil on auth\\.users;");
  const crea = bloqueDesde(RUTA_15, "^create trigger en_auth_users_crear_perfil");
  verificar("trigger: se hace DROP antes de recrear", drop !== null, ref(RUTA_15, drop?.inicio), "ALTER TRIGGER no puede añadir eventos");
  verificar(
    "trigger: after insert or update of raw_app_meta_data on auth.users",
    crea !== null && /after insert or update of raw_app_meta_data on auth\.users for each row execute function public\.crear_perfil_al_registrar\(\);/.test(colapsar(crea.texto)),
    ref(RUTA_15, crea?.inicio),
    "acotado a esa columna: un after update a secas correría en cada inicio de sesión",
  );
  verificar(
    "trigger: el nombre es el mismo que creó la 13 (se reemplaza, no se duplica)",
    drop !== null && crea !== null && lineaDe(RUTA_13, "^create trigger en_auth_users_crear_perfil") !== null,
    ref(RUTA_13, lineaDe(RUTA_13, "^create trigger en_auth_users_crear_perfil")),
  );

  const revHook = bloqueDesde(RUTA_15, "^revoke execute on function public\\.crear_perfil_al_registrar");
  verificar(
    "hook: se repite el revoke de la 14",
    revHook !== null && /from public, anon, authenticated;/.test(colapsar(revHook.texto)),
    ref(RUTA_15, revHook?.inicio),
    `la 14 lo revocó en ${ref(RUTA_14, lineaDe(RUTA_14, "revoke execute on function public\\.crear_perfil_al_registrar"))}`,
  );
  verificar(
    "hook: comentado",
    lineaDe(RUTA_15, "^comment on function public\\.crear_perfil_al_registrar") !== null,
    ref(RUTA_15, lineaDe(RUTA_15, "^comment on function public\\.crear_perfil_al_registrar")),
  );
}

// ---------------------------------------------------------------------------
// 5. Mensajes en español y comillas bien escapadas
// ---------------------------------------------------------------------------

{
  const cuerpo = sinComentarios(archivos.get(RUTA_15).texto);
  const mensajes = [...cuerpo.matchAll(/raise exception '([^']*(?:''[^']*)*)'/g)];
  verificar("hay mensajes de error que revisar", mensajes.length >= 4, ref(RUTA_15, 1), `${mensajes.length} mensajes`);
  const enIngles = mensajes.filter(([, m]) => /\b(the|does not|must|cannot|already exists|invalid)\b/i.test(m));
  verificar(
    "todos los mensajes de error están en español",
    enIngles.length === 0,
    ref(RUTA_15, 1),
    enIngles.map(([, m]) => m.slice(0, 40)).join(" | "),
  );
  const sinPunto = mensajes.filter(([, m]) => !/[.:]$/.test(m.trim()));
  verificar("los mensajes terminan en punto", sinPunto.length === 0, ref(RUTA_15, 1), sinPunto.map(([, m]) => m.slice(0, 40)).join(" | "));

  // Un `%` de más deja «...la cuenta %» literal en pantalla; uno de menos
  // aborta con "too many parameters specified for RAISE".
  const desajustes = [];
  for (const linea of cuerpo.split("\n")) {
    const m = /raise exception '([^']*(?:''[^']*)*)'(.*)$/.exec(linea);
    if (!m) continue;
    const marcadores = (m[1].match(/%/g) ?? []).length;
    const argumentos = m[2].split(",").map((a) => a.trim()).filter(Boolean).length;
    if (marcadores !== argumentos) desajustes.push(`${marcadores}% vs ${argumentos} args: ${m[1].slice(0, 36)}`);
  }
  verificar("cada % de un raise tiene su argumento", desajustes.length === 0, ref(RUTA_15, 1), desajustes.join(" | "));

  const aperturas = (archivos.get(RUTA_15).texto.match(/^as \$\$$/gm) ?? []).length;
  const cierres = (archivos.get(RUTA_15).texto.match(/^\$\$;$/gm) ?? []).length;
  verificar(
    "los cuerpos $$ abren y cierran parejos (tres funciones)",
    aperturas === 3 && cierres === 3,
    ref(RUTA_15, 1),
    `${aperturas} aperturas, ${cierres} cierres`,
  );
}

// ---------------------------------------------------------------------------
// Reporte
// ---------------------------------------------------------------------------

const ancho = Math.max(...resultados.map((r) => r.nombre.length));
let fallas = 0;
console.log("");
for (const r of resultados) {
  if (!r.ok) fallas += 1;
  const detalle = r.detalle ? `  (${r.detalle})` : "";
  console.log(`${r.ok ? "  OK  " : " FALLA"}  ${r.nombre.padEnd(ancho)}  ${r.ref}${detalle}`);
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
console.log("  · La semántica de los cuerpos plpgsql: libpg_query no cubre plpgsql, así que");
console.log("    esto cruza estructura y nombres, no comportamiento. En concreto quedan sin");
console.log("    probar hasta el db push: que el trigger dispare de verdad con el UPDATE que");
console.log("    hace GoTrue al escribir app_metadata, y que el rechazo por perfil activo");
console.log("    aborte la operación de Auth con el mensaje esperado.");
console.log("  · La carrera de dos altas simultáneas del mismo id: el ON CONFLICT la cubre");
console.log("    sobre el papel, pero probarla exige dos conexiones vivas (dos psql).");
console.log("  · Que la RPC exista en remoto: hasta `supabase db push` + `gen types`, el");
console.log("    código que la llame compila contra una función que no está (PGRST202).");
