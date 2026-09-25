/**
 * Validación mecánica de la regla que la migración 17 rompió:
 *
 *   NINGUNA política que incluya el rol `anon` puede invocar una función que
 *   anon no tiene permitido ejecutar.
 *
 * El EXECUTE de una función SECURITY DEFINER se comprueba contra el rol que
 * LLAMA, no contra el dueño. Una política `to anon` que menciona `es_admin()`
 * —revocada de anon en la migración 13— hace que cada SELECT de anon muera con
 * 42501, y si esa tabla se lee en un layout, se cae el sitio entero. No se ve
 * en el esquema, no se ve en el build: se ve cuando un visitante entra.
 *
 * El script lee TODAS las migraciones, arma dos listas —qué funciones tiene
 * revocadas anon y qué políticas nombran a anon— y las cruza.
 *
 * Y la regla simétrica, sobre storage.objects (migración 20):
 *
 *   NINGUNA política de ESCRITURA que alcance a `authenticated` puede dejar de
 *   exigir es_admin().
 *
 * Cuando se escribieron las de la migración 09, `authenticated` era sinónimo de
 * administrador. Desde la 13 hay perfiles de usuario, y una sesión de deportista
 * también es `authenticated`: sin es_admin() en el `with check`, esa cuenta podía
 * reemplazar el PDF de matrícula o borrar las fotos del catálogo. Las dos reglas
 * son la misma idea por los dos lados: la lectura de anon NO debe nombrar la
 * función, y la escritura de authenticated SÍ debe nombrarla.
 *
 * Se corre con `node scripts/verificar-politicas-anon.mjs`.
 */
import { readFileSync, readdirSync } from "node:fs";

const DIR = "supabase/migrations";
const archivos = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

const sinComentarios = (t) => t.replace(/--[^\n]*/g, "");
const colapsar = (t) => t.replace(/\s+/g, " ");

/** Estado acumulado de los privilegios de anon, aplicando las migraciones en orden. */
const revocadasDeAnon = new Set();
/** Políticas vivas, por nombre+tabla. Una migración posterior puede borrarlas. */
const politicas = new Map();
/** Políticas de storage.objects, por nombre. Mismo juego de drop y create. */
const politicasStorage = new Map();

for (const archivo of archivos) {
  const texto = sinComentarios(readFileSync(`${DIR}/${archivo}`, "utf8"));

  // --- Privilegios ---------------------------------------------------------
  for (const m of texto.matchAll(/revoke\s+execute\s+on\s+function\s+public\.([a-z_]+)\s*\([^)]*\)\s+from\s+([^;]+);/gi)) {
    if (/\banon\b|\bpublic\b/i.test(m[2])) revocadasDeAnon.add(m[1]);
  }
  for (const m of texto.matchAll(/grant\s+execute\s+on\s+function\s+public\.([a-z_]+)\s*\([^)]*\)\s+to\s+([^;]+);/gi)) {
    if (/\banon\b/i.test(m[2])) revocadasDeAnon.delete(m[1]);
  }

  // --- Políticas -----------------------------------------------------------
  for (const m of texto.matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?([a-z_]+)\s+on\s+public\.([a-z_]+)\s*;/gi)) {
    politicas.delete(`${m[2]}.${m[1]}`);
  }
  // --- Políticas de storage.objects ---------------------------------------
  //
  // Van aparte porque su nombre lleva comillas y la tabla no es public.*: el
  // parseo de arriba no las ve. Mismo juego de drop/create para que una
  // migración posterior pueda recrearlas (es lo que hace la 20).
  for (const m of texto.matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?"([^"]+)"\s+on\s+storage\.objects\s*;/gi)) {
    politicasStorage.delete(m[1]);
  }
  for (const m of texto.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+storage\.objects([\s\S]*?);/gi)) {
    const cuerpo = colapsar(m[2]);
    const operacion = /\bfor\s+(select|insert|update|delete|all)\b/i.exec(cuerpo)?.[1]?.toLowerCase() ?? "?";
    const roles = /\bto\s+([a-z_, ]+?)\s+(using|with check)/i.exec(cuerpo)?.[1] ?? "";
    politicasStorage.set(m[1], {
      archivo,
      nombre: m[1],
      operacion,
      roles: roles.split(",").map((r) => r.trim()).filter(Boolean),
      cuerpo,
    });
  }

  for (const m of texto.matchAll(/create\s+policy\s+([a-z_]+)\s+on\s+public\.([a-z_]+)([\s\S]*?);/gi)) {
    const cuerpo = colapsar(m[3]);
    const roles = /\bto\s+([a-z_, ]+?)\s+(using|with check)/i.exec(cuerpo)?.[1] ?? "";
    politicas.set(`${m[2]}.${m[1]}`, {
      archivo,
      tabla: m[2],
      nombre: m[1],
      roles: roles.split(",").map((r) => r.trim()).filter(Boolean),
      cuerpo,
    });
  }
}

// ---------------------------------------------------------------------------
// El cruce
// ---------------------------------------------------------------------------

const resultados = [];
const verificar = (nombre, ok, ref, detalle = "") => resultados.push({ nombre, ok, ref, detalle });

verificar(
  "se leyeron las migraciones",
  archivos.length >= 18,
  "—",
  `${archivos.length} archivos`,
);
verificar(
  "hay funciones revocadas de anon que vigilar",
  revocadasDeAnon.size > 0,
  "—",
  [...revocadasDeAnon].sort().join(", "),
);

const conAnon = [...politicas.values()].filter((p) => p.roles.includes("anon"));
verificar("hay políticas que alcanzan a anon", conAnon.length > 0, "—", `${conAnon.length} políticas`);

for (const p of conAnon) {
  const invocadas = [...new Set([...p.cuerpo.matchAll(/public\.([a-z_]+)\s*\(/g)].map((m) => m[1]))];
  const prohibidas = invocadas.filter((f) => revocadasDeAnon.has(f));
  verificar(
    `${p.tabla}.${p.nombre}: no invoca funciones vedadas a anon`,
    prohibidas.length === 0,
    p.archivo.slice(0, 8),
    prohibidas.length
      ? `llama a ${prohibidas.join(", ")}, que anon no puede ejecutar -> 42501 en cada SELECT`
      : (invocadas.length ? `invoca: ${invocadas.join(", ")}` : "sin llamadas a funciones"),
  );
}

// El caso concreto que se rompió, comprobado por nombre.
const lecturaClub = politicas.get("club.club_lectura_publica");
verificar(
  "club: la lectura pública existe y es solo para anon",
  lecturaClub !== undefined && lecturaClub.roles.join(",") === "anon",
  lecturaClub?.archivo.slice(0, 8),
  lecturaClub ? `roles: ${lecturaClub.roles.join(", ")}` : "no existe",
);
verificar(
  "club: la lectura con sesión es la que menciona es_admin()",
  politicas.get("club.club_lectura_sesion")?.cuerpo.includes("es_admin") === true,
  politicas.get("club.club_lectura_sesion")?.archivo.slice(0, 8),
);

// ---------------------------------------------------------------------------
// storage.objects: la escritura exige es_admin(), la lectura de anon no lo nombra
// ---------------------------------------------------------------------------

const ESCRITURA = new Set(["insert", "update", "delete", "all"]);
const storage = [...politicasStorage.values()];

verificar("se leyeron las políticas de storage.objects", storage.length > 0, "—", `${storage.length} políticas`);

for (const p of storage.filter((x) => ESCRITURA.has(x.operacion) && x.roles.includes("authenticated"))) {
  verificar(
    `storage "${p.nombre}" (${p.operacion}): exige es_admin()`,
    /es_admin\s*\(/.test(p.cuerpo),
    p.archivo.slice(0, 8),
    /es_admin\s*\(/.test(p.cuerpo)
      ? ""
      : "authenticated sin es_admin(): una sesión de usuario, no de administrador, podría escribir en el bucket",
  );
}

for (const p of storage.filter((x) => x.roles.includes("anon"))) {
  verificar(
    `storage "${p.nombre}" (${p.operacion}): no nombra es_admin() al alcanzar a anon`,
    !/es_admin/.test(p.cuerpo),
    p.archivo.slice(0, 8),
    /es_admin/.test(p.cuerpo) ? "anon no tiene EXECUTE sobre es_admin() -> 42501 al leer el bucket" : "",
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
  console.log(`${r.ok ? "  OK  " : " FALLA"}  ${r.nombre.padEnd(ancho)}  ${r.ref ?? "—"}${r.detalle ? `  (${r.detalle})` : ""}`);
}
console.log("");
console.log(`Casos: ${resultados.length}, fallidos: ${fallas}`);
console.log("");

if (fallas > 0) {
  console.log("HAY DISCREPANCIAS. Ninguna de las dos se ve en el build:");
  console.log("  · una política que alcanza a anon llamando a una función que anon no puede");
  console.log("    ejecutar falla cuando entra un visitante;");
  console.log("  · una política de escritura `to authenticated` sin es_admin() no falla nunca,");
  console.log("    hasta que una cuenta de usuario la use para escribir donde no debe.");
  process.exit(1);
}

console.log("VALIDACIÓN LIMPIA");
console.log("");
console.log("Sin verificar de forma mecánica:");
console.log("  · Los privilegios reales del remoto. Esto acumula los revoke y grant de los");
console.log("    archivos; si alguien tocó permisos desde el panel de Supabase, no se ve.");
console.log("  · Las funciones que una política llama de forma indirecta: si es_admin()");
console.log("    llamara a otra función revocada, el cruce no lo seguiría.");
console.log("  · Que la política diga lo correcto. Esto comprueba que se pueda ejecutar,");
console.log("    no que filtre bien: eso son las pruebas con anon key contra el remoto.");
