/**
 * Chequeo obligatorio antes de fusionar a `main`: build, luego todo lo demás.
 *
 * Existe como script y no como cadena de `&&` en package.json por una razón
 * concreta: el build tiene que salir a `.next-verificar` y no a `.next`, y
 * `VAR=valor npm run build` no funciona en Windows, donde npm ejecuta los
 * scripts con cmd.exe. Aquí la variable se pasa al proceso hijo y funciona
 * igual en los tres sistemas.
 *
 * El build va PRIMERO, como puerta rápida: si no compila, no tiene sentido
 * medir contraste ni desbordamiento. Antes iba en medio porque `next dev`
 * invalidaba el build de producción; ya no, porque dev y start escriben en
 * carpetas distintas (ver CARPETA_SALIDA en _servidor.mjs).
 *
 * Uso: npm run verificar:completo
 */
import { spawn } from "node:child_process";
import process from "node:process";

import { CARPETA_SALIDA } from "./_servidor.mjs";

const PASOS = [
  {
    nombre: "build de producción",
    comando: [process.execPath, ["node_modules/next/dist/bin/next", "build"]],
    // El build que consumirá `verificar:foco` con `next start`.
    entorno: { NEXT_DIST_DIR: CARPETA_SALIDA.start },
  },
  { nombre: "npm run verificar", comando: ["npm", ["run", "verificar"]] },
  { nombre: "npm run verificar:foco", comando: ["npm", ["run", "verificar:foco"]] },
];

function correr(paso) {
  return new Promise((res) => {
    const [programa, argumentos] = paso.comando;
    const hijo = spawn(programa, argumentos, {
      stdio: "inherit",
      // npm en Windows es npm.cmd y necesita shell; el binario de node, no.
      shell: programa === "npm" && process.platform === "win32",
      env: { ...process.env, ...(paso.entorno ?? {}) },
    });
    hijo.on("exit", (codigo) => res(codigo ?? 1));
  });
}

for (const paso of PASOS) {
  console.log(`\n=== ${paso.nombre} ===\n`);
  const codigo = await correr(paso);
  if (codigo !== 0) {
    console.log(`\nFALLÓ: ${paso.nombre} (código ${codigo}). No se sigue.`);
    process.exit(codigo);
  }
}

console.log("\nVERIFICACIÓN COMPLETA LIMPIA: se puede fusionar a main.");
