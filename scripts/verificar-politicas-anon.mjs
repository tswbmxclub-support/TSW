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
  console.log("HAY DISCREPANCIAS: una política que alcanza a anon llama a una función que anon");
  console.log("no puede ejecutar. Eso no falla en el build: falla cuando entra un visitante.");
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
