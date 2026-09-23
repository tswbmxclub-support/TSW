/**
 * Guardián de la paleta.
 *
 * Al quitar `--color-rojo` de `@theme`, una clase `bg-rojo` que se escape deja
 * de existir en silencio: Tailwind no genera la utilidad y no hay error en
 * ninguna parte. El elemento simplemente sale transparente. Este script es lo
 * que convierte ese silencio en un fallo.
 *
 * Comprueba tres cosas:
 *   1. Que no sobreviva ninguna utilidad de rojo (`bg-rojo`, `text-rojo`…).
 *   2. Que no haya hexadecimales de marca sueltos en el código. El rojo de
 *      Mastercross vive en `club.color_identidad`, en la base, no aquí.
 *   3. Que cada token que el código usa exista de verdad en `globals.css`.
 *
 * Se corre con `node scripts/verificar-paleta.mjs`.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const GLOBALS = "src/styles/globals.css";
const css = readFileSync(GLOBALS, "utf8");

const archivos = execSync("git ls-files src", { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter((f) => /\.(tsx?|css)$/.test(f));

/** Tokens declarados en @theme, tal como Tailwind los expone. */
const declarados = new Set([...css.matchAll(/--color-([a-z-]+):/g)].map((m) => m[1]));

/** Prefijos de utilidad que consumen un color del tema. */
const PREFIJOS = ["bg", "text", "border", "border-l", "border-r", "border-t", "border-b", "outline", "accent", "ring", "fill", "stroke", "from", "to", "via", "decoration", "shadow", "caret", "divide"];

const problemas = [];

/**
 * Vacía los comentarios de bloque conservando los saltos de línea, para que
 * los números de línea sigan cuadrando. Los comentarios SÍ pueden nombrar el
 * rojo y su hexadecimal: son los que explican por qué se fue.
 */
function sinComentariosDeBloque(texto) {
  return texto.replace(/\/\*[\s\S]*?\*\//g, (bloque) => bloque.replace(/[^\n]/g, " "));
}

for (const ruta of archivos) {
  const texto = sinComentariosDeBloque(readFileSync(ruta, "utf8"));
  const lineas = texto.split(/\r?\n/);

  lineas.forEach((linea, i) => {
    const ref = `${ruta}:${i + 1}`;

    // 1. Utilidades de rojo. Se ignoran los comentarios, que sí pueden
    //    nombrar el rojo para explicar por qué se fue.
    const sinComentario = linea.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
    for (const m of sinComentario.matchAll(/\b([a-z-]+)-(rojo(?:-oscuro)?)\b/g)) {
      if (PREFIJOS.includes(m[1])) {
        problemas.push(`${ref}  utilidad de rojo viva: ${m[0]}`);
      }
    }
    if (/--color-rojo/.test(sinComentario)) problemas.push(`${ref}  variable --color-rojo`);

    // 2. Hexadecimales de marca sueltos.
    for (const m of linea.matchAll(/#(?:D7263D|A31128)/gi)) {
      problemas.push(`${ref}  hexadecimal de marca suelto: ${m[0]} (el rojo vive en club.color_identidad)`);
    }
  });

  // 3. Tokens usados que no existen en @theme.
  for (const m of texto.matchAll(/\b([a-z-]+)-(acento(?:-oscuro|-hover)?|cian|foco|error(?:-fondo)?)\b(?:\/\d+)?/g)) {
    if (!PREFIJOS.includes(m[1])) continue;
    if (!declarados.has(m[2])) {
      problemas.push(`${ruta}  usa \`${m[0]}\` pero --color-${m[2]} no está en ${GLOBALS}`);
    }
  }
}

// --- Reporte ---------------------------------------------------------------

console.log("");
console.log(`Tokens de color declarados (${declarados.size}): ${[...declarados].join(", ")}`);
console.log(`Archivos revisados: ${archivos.length}`);
console.log("");

if (problemas.length > 0) {
  for (const p of [...new Set(problemas)]) console.log(` FALLA  ${p}`);
  console.log("");
  console.log(`${new Set(problemas).size} problema(s) de paleta.`);
  process.exit(1);
}

console.log("PALETA LIMPIA: ninguna utilidad de rojo, ningún hexadecimal de marca suelto,");
console.log("y todos los tokens que el código usa están declarados.");
console.log("");
console.log("Sin verificar aquí:");
console.log("  · Que cada token esté usado sobre el fondo correcto. Eso es criterio, no");
console.log("    patrón: `text-acento-oscuro` sobre azul profundo compila y se ve fatal.");
console.log("    Los ratios están en la cabecera de globals.css y en /laboratorio.");
console.log("  · Las clases que se arman por concatenación en tiempo de ejecución, que");
console.log("    Tailwind tampoco vería.");
