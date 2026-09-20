/**
 * Verificación mecánica de la migración 13 (perfiles admin y usuario).
 *
 * Lee los archivos SQL reales del repo —no la conversación— y cruza:
 *   · columnas y constraints de las tablas nuevas,
 *   · políticas *_admin de la migración 08 contra drop+create en la 13,
 *   · estructura de las RPC (actor, lock, salvaguardas, privilegios),
 *   · el recorte de PII acotado a perfiles en registrar_auditoria,
 *   · el hook de auth.users y la semilla.
 *
 * Se corre con `node scripts/verificar-perfiles.mjs`. Termina con
 * "VALIDACIÓN LIMPIA" solo si todo cruza; los cuerpos plpgsql quedan
 * declarados como sin verificación (ver el final del reporte).
 *
 * Sobre los patrones: los SQL del proyecto alinean columnas y firmas con
 * espacios, así que los patrones usan \s+ entre tokens en lugar de espacios
 * literales. Las funciones se extraen hasta su cierre $$; (cortar en el
 * primer ; dejaría fuera el cuerpo).
 */
import { readFileSync } from "node:fs";

const RUTA_13 = "supabase/migrations/20260920100000_perfiles_admin_y_usuario.sql";
const RUTA_08 = "supabase/migrations/20260917100700_politicas_rls.sql";
const RUTA_05 = "supabase/migrations/20260917100500_auditoria.sql";

const archivos = new Map(
  [RUTA_13, RUTA_08, RUTA_05].map((ruta) => {
    const texto = readFileSync(ruta, "utf8");
    return [ruta, { lineas: texto.split("\n"), texto }];
  }),
);

function lineaDe(ruta, patron, ocurrencia = 1) {
  const { lineas } = archivos.get(ruta);
  const re = new RegExp(patron, "i");
  let vista = 0;
  for (let i = 0; i < lineas.length; i++) {
    if (re.test(lineas[i])) {
      vista += 1;
      if (vista === ocurrencia) return i + 1;
    }
  }
  return null;
}

function lineaDeIndice(ruta, indice) {
  if (indice === undefined || indice === -1) return null;
  const { texto } = archivos.get(ruta);
  return texto.slice(0, indice).split("\n").length;
}

/** Bloque-sentencia: desde la línea del patrón hasta la primera que termina en `;`, incluida. */
function bloqueDesde(ruta, patron) {
  const { lineas } = archivos.get(ruta);
  const inicio = lineaDe(ruta, patron); // 1-indexado
  if (inicio === null) return null;
  let fin = inicio - 1; // 0-indexado de la primera línea del bloque
  while (fin < lineas.length && !lineas[fin].trimEnd().endsWith(";")) fin += 1;
  return { inicio, fin: fin + 1, texto: lineas.slice(inicio - 1, fin + 1).join("\n") };
}

/** Cuerpo completo de una función: hasta la línea `$$;` que la cierra. */
function bloqueFuncion(ruta, patron) {
  const { lineas } = archivos.get(ruta);
  const inicio = lineaDe(ruta, patron);
  if (inicio === null) return null;
  let fin = inicio;
  while (fin < lineas.length && lineas[fin].trimEnd() !== "$$;") fin += 1;
  if (fin >= lineas.length) return null;
  return { inicio, fin: fin + 1, texto: lineas.slice(inicio - 1, fin + 1).join("\n") };
}

/** Texto sin comentarios `--`, para que un comentario no haga pasar una prueba. */
function sinComentarios(texto) {
  return texto.replace(/--[^\n]*/g, "");
}

/** Colapsa espacios: para verificar firmas alineadas. */
function colapsar(texto) {
  return texto.replace(/\s+/g, " ");
}

const resultados = [];
function verificar(nombre, condicion, ref, detalle = "") {
  resultados.push({ nombre, ok: Boolean(condicion), ref, detalle });
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
// 1. Tablas: columnas, FK, constraints, trigger actualizado_en
// ---------------------------------------------------------------------------

const tablaAdmin = bloqueDesde(RUTA_13, "^create table public\\.perfil_admin \\(");
const tablaUsuario = bloqueDesde(RUTA_13, "^create table public\\.perfil_usuario \\(");

verificar("perfil_admin: create table presente", tablaAdmin !== null, tablaAdmin && `13:${tablaAdmin.inicio}`);
verificar("perfil_usuario: create table presente", tablaUsuario !== null, tablaUsuario && `13:${tablaUsuario.inicio}`);

const columnasComunes = [
  "id uuid primary key",
  "nombre text not null",
  "activo boolean not null default false",
  "creado_en timestamptz not null default now()",
  "actualizado_en timestamptz not null default now()",
];

if (tablaAdmin && tablaUsuario) {
  const planaAdmin = colapsar(tablaAdmin.texto);
  const planaUsuario = colapsar(tablaUsuario.texto);
  for (const fragmento of columnasComunes) {
    verificar(
      `perfil_admin: columna «${fragmento.split(" ")[0]}»`,
      planaAdmin.includes(fragmento),
      `13:${tablaAdmin.inicio}`,
    );
  }
  for (const fragmento of ["telefono text", ...columnasComunes]) {
    verificar(
      `perfil_usuario: columna «${fragmento.split(" ")[0]}»`,
      planaUsuario.includes(fragmento),
      `13:${tablaUsuario.inicio}`,
    );
  }
  verificar(
    "perfil_admin: sin columna de correo ni de rol",
    !/^\s*(correo|email|rol)\s+/m.test(tablaAdmin.texto),
    `13:${tablaAdmin.inicio}`,
    "El correo vive en auth.users; un solo rol, no hay columna que lo repita.",
  );
  verificar(
    "perfil_admin: FK → auth.users(id) on delete cascade",
    /references auth\.users \(id\) on delete cascade/.test(tablaAdmin.texto),
    `13:${tablaAdmin.inicio}`,
  );
  verificar(
    "perfil_usuario: FK → auth.users(id) on delete cascade",
    /references auth\.users \(id\) on delete cascade/.test(tablaUsuario.texto),
    `13:${tablaUsuario.inicio}`,
  );
}

for (const [tabla, constraint] of [
  ["perfil_admin", "perfil_admin_nombre_no_vacio"],
  ["perfil_usuario", "perfil_usuario_nombre_no_vacio"],
  ["perfil_usuario", "perfil_usuario_telefono_no_vacio"],
]) {
  const def = lineaDe(RUTA_13, `constraint ${constraint}\\b`);
  const comentario = lineaDe(RUTA_13, `comment on constraint ${constraint} on public\\.${tabla}\\b`);
  verificar(`${tabla}: constraint ${constraint}`, def !== null, def && `13:${def}`);
  verificar(`${tabla}: comentario de ${constraint}`, comentario !== null, comentario && `13:${comentario}`);
}

for (const tabla of ["perfil_admin", "perfil_usuario"]) {
  const trig = bloqueDesde(RUTA_13, `create trigger ${tabla}_actualizado_en\\b`);
  verificar(
    `${tabla}: trigger set_actualizado_en`,
    trig !== null && /execute function public\.set_actualizado_en\(\)/.test(trig.texto) && /before update/.test(trig.texto),
    trig && `13:${trig.inicio}`,
  );
}

// ---------------------------------------------------------------------------
// 2. Exclusividad
// ---------------------------------------------------------------------------

const exclusividad = bloqueFuncion(RUTA_13, "create or replace function public\\.validar_exclusividad_perfil\\(\\)");
verificar(
  "exclusividad: función presente, security definer, search_path fijo",
  exclusividad !== null && /security definer/.test(exclusividad.texto) && /set search_path = public/.test(exclusividad.texto),
  exclusividad && `13:${exclusividad.inicio}`,
);
verificar(
  "exclusividad: revisa la otra tabla según tg_table_name",
  exclusividad !== null && /tg_table_name = 'perfil_admin'/.test(exclusividad.texto) && /perfil_usuario where id = new\.id/.test(exclusividad.texto) && /perfil_admin where id = new\.id/.test(exclusividad.texto),
  exclusividad && `13:${exclusividad.inicio}`,
);
verificar(
  "exclusividad: rechaza con check_violation",
  exclusividad !== null && /errcode = 'check_violation'/.test(exclusividad.texto),
  exclusividad && `13:${exclusividad.inicio}`,
);
for (const tabla of ["perfil_admin", "perfil_usuario"]) {
  const trig = bloqueDesde(RUTA_13, `create trigger ${tabla}_exclusividad\\b`);
  verificar(
    `${tabla}: trigger before insert or update`,
    trig !== null && /before insert or update/.test(trig.texto) && /validar_exclusividad_perfil\(\)/.test(trig.texto),
    trig && `13:${trig.inicio}`,
  );
}

// ---------------------------------------------------------------------------
// 3. es_admin() / es_usuario()
// ---------------------------------------------------------------------------

for (const fn of ["es_admin", "es_usuario"]) {
  const bloque = bloqueFuncion(RUTA_13, `create or replace function public\\.${fn}\\(\\)`);
  verificar(`${fn}(): presente`, bloque !== null, bloque && `13:${bloque?.inicio}`);
  if (bloque) {
    verificar(
      `${fn}(): security definer + stable + search_path = public`,
      /security definer/.test(bloque.texto) && /\bstable\b/.test(bloque.texto) && /set search_path = public/.test(bloque.texto),
      `13:${bloque.inicio}`,
    );
    verificar(
      `${fn}(): filtra por id = auth.uid() and activo`,
      /id = auth\.uid\(\)/.test(bloque.texto) && /\band activo\b/.test(bloque.texto),
      `13:${bloque.inicio}`,
    );
    const revoke = lineaDe(RUTA_13, `revoke execute on function public\\.${fn}\\(\\)\\s+from public, anon;`);
    const grant = lineaDe(RUTA_13, `grant execute on function public\\.${fn}\\(\\)\\s+to authenticated, service_role;`);
    verificar(`${fn}(): EXECUTE revocado a public y anon`, revoke !== null, revoke && `13:${revoke}`);
    verificar(`${fn}(): EXECUTE concedido a authenticated`, grant !== null, grant && `13:${grant}`);
  }
}

// ---------------------------------------------------------------------------
// 4. RLS y grants de las tablas nuevas
// ---------------------------------------------------------------------------

for (const tabla of ["perfil_admin", "perfil_usuario"]) {
  const rls = lineaDe(RUTA_13, `alter table public\\.${tabla}\\s+enable row level security;`);
  const revoke = lineaDe(RUTA_13, `revoke all on public\\.${tabla}\\s+from anon, authenticated;`);
  const grant = lineaDe(RUTA_13, `grant select on public\\.${tabla}\\s+to authenticated;`);
  const grantEscritura = lineaDe(RUTA_13, `grant (insert|update|delete|all) on public\\.${tabla}\\s+to (anon|authenticated)`);
  verificar(`${tabla}: RLS activado`, rls !== null, rls && `13:${rls}`);
  verificar(`${tabla}: revoke all a anon y authenticated`, revoke !== null, revoke && `13:${revoke}`);
  verificar(`${tabla}: solo grant select a authenticated`, grant !== null, grant && `13:${grant}`);
  verificar(`${tabla}: sin grants de escritura para roles del navegador`, grantEscritura === null, grantEscritura ? `13:${grantEscritura}` : "13");
}

const politicasPerfil = (archivos.get(RUTA_13).texto.match(/create policy [\s\S]*?;/g) ?? [])
  .filter((p) => /public\.perfil_(admin|usuario)/.test(p));
verificar(
  "perfiles: exactamente 2 políticas, ambas select para authenticated",
  politicasPerfil.length === 2 && politicasPerfil.every((p) => /for select to authenticated/.test(p)),
  `13:${lineaDe(RUTA_13, "create policy perfil_admin_lectura_admin")}`,
);
verificar(
  "perfil_admin: select exige public.es_admin()",
  politicasPerfil.some((p) => /perfil_admin_lectura_admin/.test(p) && /using \(public\.es_admin\(\)\)/.test(p)),
  `13:${lineaDe(RUTA_13, "create policy perfil_admin_lectura_admin")}`,
);
verificar(
  "perfil_usuario: select exige es_admin() o id = auth.uid()",
  politicasPerfil.some((p) => /perfil_usuario_lectura/.test(p) && /public\.es_admin\(\) or id = auth\.uid\(\)/.test(p)),
  `13:${lineaDe(RUTA_13, "create policy perfil_usuario_lectura")}`,
);
verificar(
  "perfiles: ninguna política de escritura (all/insert/update/delete) nueva",
  !politicasPerfil.some((p) => /for (all|insert|update|delete)/.test(p)),
  `13:${lineaDe(RUTA_13, "create policy perfil_admin_lectura_admin")}`,
);

// ---------------------------------------------------------------------------
// 5. Reescritura de las políticas *_admin de la migración 08
// ---------------------------------------------------------------------------

/** [nombre, tabla, modo, llevaWithCheck] */
const ADMIN_POLICIES = [
  ["producto_admin", "public.producto", "all", true],
  ["variante_admin", "public.variante", "all", true],
  ["nivel_admin", "public.nivel", "all", true],
  ["documento_admin", "public.documento", "all", true],
  ["documento_version_admin", "public.documento_version", "all", true],
  ["competencia_admin", "public.competencia", "all", true],
  ["resultado_admin", "public.resultado", "all", true],
  ["pedido_lectura_admin", "public.pedido", "select", false],
  ["pedido_actualizacion_admin", "public.pedido", "update", true],
  ["pedido_borrado_admin", "public.pedido", "delete", false],
  ["pedido_item_admin", "public.pedido_item", "all", true],
  ["transaccion_admin", "public.transaccion", "all", true],
  ["evento_auditoria_lectura_admin", "public.evento_auditoria", "select", false],
];

for (const [nombre] of ADMIN_POLICIES) {
  const origen = lineaDe(RUTA_08, `create policy ${nombre}\\b`);
  verificar(`08 → 13: ${nombre} existía en la migración 08`, origen !== null, origen ? `08:${origen}` : "08:—");
}

for (const [nombre, tabla, modo, conCheck] of ADMIN_POLICIES) {
  const drop = lineaDe(RUTA_13, `drop policy if exists ${nombre} on ${tabla};`);
  const crea = bloqueDesde(RUTA_13, `create policy ${nombre}\\b`);
  const okTabla = crea !== null && crea.texto.includes(`on ${tabla} `);
  const okModo = crea !== null && new RegExp(`for ${modo} to authenticated`).test(crea.texto);
  const okUsing = crea !== null && crea.texto.includes("using (public.es_admin())");
  const okCheck = crea !== null && (conCheck
    ? crea.texto.includes("with check (public.es_admin())")
    : !crea.texto.includes("with check"));
  verificar(`13: ${nombre} — drop previo`, drop !== null, drop ? `13:${drop}` : "13:—");
  verificar(
    `13: ${nombre} — recreate for ${modo} sobre ${tabla} con es_admin()`,
    crea !== null && okTabla && okModo && okUsing && okCheck,
    crea ? `13:${crea.inicio}` : "13:—",
    conCheck ? "using + with check" : "solo using",
  );
}

const texto13Limpio = sinComentarios(archivos.get(RUTA_13).texto);
verificar(
  "13: no queda ningún using (true) ni with check (true) en código",
  !/using \(true\)/.test(texto13Limpio) && !/with check \(true\)/.test(texto13Limpio),
  "13",
);
verificar(
  "13: las políticas públicas (anon) de la 08 no se tocan",
  !/drop policy if exists (producto|variante|nivel|documento|documento_version|competencia|resultado)_lectura_publica/.test(texto13Limpio),
  "13",
);
verificar(
  "13: sin grants nuevos de escritura sobre tablas existentes",
  !/grant (insert|update|delete|all) on public\.(producto|variante|nivel|documento|documento_version|competencia|resultado|pedido|pedido_item|transaccion|evento_auditoria)\b/.test(texto13Limpio),
  "13",
);

// ---------------------------------------------------------------------------
// 6. registrar_auditoria: recorte acotado a perfiles + triggers
// ---------------------------------------------------------------------------

const aud13 = bloqueFuncion(RUTA_13, "create or replace function public\\.registrar_auditoria\\(\\)");
verificar("registrar_auditoria: reescrita en la 13", aud13 !== null, aud13 && `13:${aud13?.inicio}`);
if (aud13) {
  const clavesComprador = ["comprador_nombre", "comprador_email", "comprador_telefono", "payload_json"]
    .every((k) => aud13.texto.includes(`- '${k}'`));
  const acotado = /if tg_table_name in \('perfil_admin', 'perfil_usuario'\) then/.test(aud13.texto) &&
    /v_antes := v_antes - 'nombre' - 'telefono';/.test(aud13.texto) &&
    /v_despues := v_despues - 'nombre' - 'telefono';/.test(aud13.texto);
  verificar("registrar_auditoria: conserva el recorte de comprador y payload", clavesComprador, `13:${aud13.inicio}`);
  verificar("registrar_auditoria: recorte de nombre/telefono acotado a perfiles", acotado, `13:${aud13.inicio}`);
  verificar(
    "registrar_auditoria: conserva la resolución de actor (establecer_actor → auth.uid())",
    /current_setting\('app\.actor_id', true\)/.test(aud13.texto) && /auth\.uid\(\)/.test(aud13.texto),
    `13:${aud13.inicio}`,
  );
  verificar(
    "registrar_auditoria: conserva la deducción de verbo (crear/eliminar/actualizar/publicar/archivar)",
    ["'crear'", "'eliminar'", "'actualizar'", "'publicar'", "'archivar'"].every((v) => aud13.texto.includes(v)),
    `13:${aud13.inicio}`,
  );
}

const aud05 = bloqueFuncion(RUTA_05, "create or replace function public\\.registrar_auditoria\\(\\)");
verificar("05: registrar_auditoria original existe como referencia", aud05 !== null, aud05 && `05:${aud05?.inicio}`);

for (const tabla of ["perfil_admin", "perfil_usuario"]) {
  const trig = bloqueDesde(RUTA_13, `create trigger ${tabla}_auditoria\\b`);
  verificar(
    `${tabla}: trigger de auditoría after insert or update or delete`,
    trig !== null && /after insert or update or delete/.test(trig.texto) && /registrar_auditoria\(\)/.test(trig.texto),
    trig && `13:${trig.inicio}`,
  );
}

// ---------------------------------------------------------------------------
// 7. Hook de auth.users y semilla
// ---------------------------------------------------------------------------

const hook = bloqueFuncion(RUTA_13, "create or replace function public\\.crear_perfil_al_registrar\\(\\)");
verificar(
  "hook: función presente, security definer, search_path fijo",
  hook !== null && /security definer/.test(hook.texto) && /set search_path = public/.test(hook.texto),
  hook && `13:${hook?.inicio}`,
);
if (hook) {
  verificar(
    "hook: tipo por raw_app_meta_data->>'tipo' con usuario por defecto",
    /coalesce\(new\.raw_app_meta_data ->> 'tipo', 'usuario'\)/.test(hook.texto),
    `13:${hook.inicio}`,
  );
  verificar(
    "hook: nombre desde raw_user_meta_data o parte local del correo",
    /raw_user_meta_data ->> 'nombre'/.test(hook.texto) && /split_part\(coalesce\(new\.email, ''\), '@', 1\)/.test(hook.texto),
    `13:${hook.inicio}`,
  );
  const insertAdmin = /insert into public\.perfil_admin \(id, nombre\)/.test(hook.texto);
  const insertUsuario = /insert into public\.perfil_usuario \(id, nombre\)/.test(hook.texto);
  verificar(
    "hook: inserta en la tabla correcta sin tocar activo (default false)",
    insertAdmin && insertUsuario && !/activo/.test(sinComentarios(hook.texto)),
    `13:${hook.inicio}`,
    "Si el INSERT listara activo, alguien podría nacer activo; el default de la tabla decide.",
  );
  verificar(
    "hook: idempotente (on conflict do nothing)",
    /on conflict \(id\) do nothing/.test(hook.texto),
    `13:${hook.inicio}`,
  );
}

const trigHook = bloqueDesde(RUTA_13, "create trigger en_auth_users_crear_perfil\\b");
verificar(
  "hook: trigger after insert on auth.users",
  trigHook !== null && /after insert on auth\.users/.test(trigHook.texto) && /crear_perfil_al_registrar\(\)/.test(trigHook.texto),
  trigHook && `13:${trigHook?.inicio}`,
);

const semilla = bloqueDesde(RUTA_13, "^insert into public\\.perfil_admin \\(id, nombre, activo\\)");
verificar(
  "semilla: insert…select desde auth.users",
  semilla !== null && /from auth\.users/.test(semilla.texto),
  semilla && `13:${semilla?.inicio}`,
);
if (semilla) {
  verificar("semilla: activo = true para los existentes", /^\s*true,?\s*$/m.test(semilla.texto), `13:${semilla.inicio}`);
  verificar(
    "semilla: excluye @tsw-verificacion.com (insensible a mayúsculas)",
    /lower\(u\.email\) not like '%@tsw-verificacion\.com'/.test(semilla.texto),
    `13:${semilla.inicio}`,
  );
  verificar("semilla: idempotente (on conflict do nothing)", /on conflict \(id\) do nothing/.test(semilla.texto), `13:${semilla.inicio}`);
  verificar(
    "semilla: nombre con fallback a la parte local del correo",
    /split_part\(coalesce\(u\.email, ''\), '@', 1\)/.test(semilla.texto),
    `13:${semilla.inicio}`,
  );
}

// ---------------------------------------------------------------------------
// 8. RPC: convenciones de la casa
// ---------------------------------------------------------------------------

const RPCS = [
  ["guardar_perfil_admin", ["p_actor_id uuid", "p_id uuid", "p_nombre text"], "public.perfil_admin"],
  ["activar_admin", ["p_actor_id uuid", "p_id uuid"], "public.perfil_admin"],
  ["desactivar_admin", ["p_actor_id uuid", "p_id uuid"], "public.perfil_admin"],
  ["guardar_perfil_usuario", ["p_actor_id uuid", "p_id uuid", "p_nombre text", "p_telefono text"], "public.perfil_usuario"],
  ["activar_usuario", ["p_actor_id uuid", "p_id uuid"], "public.perfil_usuario"],
  ["desactivar_usuario", ["p_actor_id uuid", "p_id uuid"], "public.perfil_usuario"],
];

for (const [fn, parametros, retorno] of RPCS) {
  const firma = bloqueFuncion(RUTA_13, `create or replace function public\\.${fn}\\(`);
  verificar(`${fn}: presente`, firma !== null, firma && `13:${firma?.inicio}`);
  if (!firma) continue;

  const plana = colapsar(sinComentarios(firma.texto));
  for (const parametro of parametros) {
    // \s+ entre tokens: las firmas alinean con espacios; \b evita que «p_id»
    // calce dentro de otro nombre.
    const reParam = new RegExp(parametro.split(" ").join("\\s+") + "\\b");
    verificar(`${fn}: parámetro ${parametro}`, reParam.test(plana), `13:${firma.inicio}`);
  }
  verificar(
    `${fn}: security definer + search_path = public + returns ${retorno}`,
    /security definer/.test(firma.texto) && /set search_path = public/.test(firma.texto) && firma.texto.includes(`returns ${retorno}`),
    `13:${firma.inicio}`,
  );
  verificar(`${fn}: establecer_actor(p_actor_id) como primera sentencia`, primeraSentenciaEsActor(firma.texto), `13:${firma.inicio}`);

  const revoke = lineaDe(RUTA_13, `revoke execute on function public\\.${fn}\\([^)]*\\)\\s+from public, anon, authenticated;`);
  const grant = lineaDe(RUTA_13, `grant execute on function public\\.${fn}\\([^)]*\\)\\s+to service_role;`);
  verificar(`${fn}: EXECUTE revocado a public/anon/authenticated`, revoke !== null, revoke && `13:${revoke}`);
  verificar(`${fn}: EXECUTE concedido solo a service_role`, grant !== null, grant && `13:${grant}`);
}

// --- Escrituras de las RPC contra las columnas reales de las tablas ---------

const texto13 = archivos.get(RUTA_13).texto;

const mUpdateNombreAdmin = /update public\.perfil_admin\s*\n\s*set nombre\s+= btrim\(p_nombre\)\s*\n\s*where id = p_id/.exec(texto13);
verificar(
  "guardar_perfil_admin: UPDATE solo nombre",
  mUpdateNombreAdmin !== null,
  mUpdateNombreAdmin && `13:${lineaDeIndice(RUTA_13, mUpdateNombreAdmin.index)}`,
);

const fnGuardarUsuario = bloqueFuncion(RUTA_13, "create or replace function public\\.guardar_perfil_usuario\\(");
verificar(
  "guardar_perfil_usuario: UPDATE nombre y telefono",
  fnGuardarUsuario !== null && /update public\.perfil_usuario\s*\n\s*set nombre\s+= btrim\(p_nombre\),\s*\n\s*telefono\s+= v_telefono/.test(fnGuardarUsuario.texto),
  fnGuardarUsuario && `13:${fnGuardarUsuario.inicio}`,
);

const updatesActivo = [...texto13.matchAll(/update public\.(perfil_admin|perfil_usuario)\s*\n\s*set activo = (true|false)/g)];
verificar(
  "activar/desactivar: exactamente cuatro UPDATE de activo (2 admin + 2 usuario)",
  updatesActivo.length === 4 &&
    updatesActivo.filter((m) => m[1] === "perfil_admin" && m[2] === "true").length === 1 &&
    updatesActivo.filter((m) => m[1] === "perfil_admin" && m[2] === "false").length === 1 &&
    updatesActivo.filter((m) => m[1] === "perfil_usuario" && m[2] === "true").length === 1 &&
    updatesActivo.filter((m) => m[1] === "perfil_usuario" && m[2] === "false").length === 1,
  updatesActivo[0] && `13:${lineaDeIndice(RUTA_13, updatesActivo[0].index)}`,
);

// desactivar_admin: orden actor → lock → salvaguardas → conteo → update.
const desactivar = bloqueFuncion(RUTA_13, "create or replace function public\\.desactivar_admin\\(");
if (desactivar) {
  const cuerpo = sinComentarios(desactivar.texto);
  const idx = (patron) => cuerpo.search(new RegExp(patron));
  const idxActor = idx("perform public\\.establecer_actor");
  const idxLock = idx("lock table public\\.perfil_admin in share row exclusive mode;");
  const idxPropio = idx("if p_id = p_actor_id then");
  const idxConteo = idx("select count\\(\\*\\) into v_activos");
  const idxUltimo = idx("v_activos <= 1");
  const idxUpdate = idx("set activo = false");

  const linea = (i) => (i === -1 ? "—" : `13:${desactivar.inicio + cuerpo.slice(0, i).split("\n").length - 1}`);

  verificar(
    "desactivar_admin: lock table tras establecer_actor",
    idxActor !== -1 && idxLock !== -1 && idxActor < idxLock,
    linea(idxLock),
  );
  verificar(
    "desactivar_admin: lock antes de la salvaguarda propia y del conteo",
    idxLock !== -1 && idxPropio !== -1 && idxConteo !== -1 && idxLock < idxPropio && idxLock < idxConteo,
    linea(idxConteo),
  );
  verificar(
    "desactivar_admin: salvaguarda 1 (nadie se desactiva a sí mismo, p_id = p_actor_id)",
    idxPropio !== -1,
    linea(idxPropio),
  );
  verificar(
    "desactivar_admin: salvaguarda 2 (no se desactiva al último activo, conteo <= 1)",
    idxUltimo !== -1,
    linea(idxUltimo),
  );
  verificar(
    "desactivar_admin: el conteo cuenta activos (where activo) y corre tras el lock y antes del update",
    /where activo;/.test(cuerpo) && idxLock < idxConteo && idxConteo < idxUpdate,
    linea(idxUpdate),
  );
}

// ---------------------------------------------------------------------------
// Reporte
// ---------------------------------------------------------------------------

const ancho = Math.max(...resultados.map((r) => r.nombre.length));
let fallas = 0;
console.log("");
for (const r of resultados) {
  const marca = r.ok ? "  OK  " : " FALLA";
  if (!r.ok) fallas += 1;
  const ref = r.ref ?? "—";
  const detalle = r.detalle ? `  (${r.detalle})` : "";
  console.log(`${marca}  ${r.nombre.padEnd(ancho)}  ${ref}${detalle}`);
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
console.log("Sin verificar de forma mecánica (cuerpos plpgsql y entorno):");
console.log("  · La semántica completa de los cuerpos plpgsql: libpg_query no cubre plpgsql.");
console.log("    En particular: que el hook decida bien con un payload real de Auth, que las");
console.log("    excepciones de las RPC salgan con el mensaje y errcode correctos, y que el");
console.log("    conteo de desactivar_admin no tenga una carrera no cubierta por el lock");
console.log("    (la prueba de concurrencia exige dos conexiones vivas: dos psql).");
console.log("  · El comportamiento de es_admin()/es_usuario() dentro de RLS: solo se puede");
console.log("    probar contra la base real (18 casos análogos a los de la migración 08).");
console.log("  · Qué correos reales recibe la semilla: se reporta tras aplicar con db push.");
console.log("  · Recursión de políticas: es_admin() es security definer justamente para");
console.log("    evitarla; la prueba real es el push.");
