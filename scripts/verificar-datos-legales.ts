/**
 * Comprobación de los datos legales configurados.
 *
 * Hoy cubre el NIT, que es el único dato del sitio con un dígito de control
 * verificable: si alguien teclea una cifra de más o de menos al pasar el RUT a
 * `src/config/sitio.ts`, el NIT sigue pareciendo un NIT y nadie lo nota. Esta
 * comprobación cruza el dígito configurado contra el algoritmo de la DIAN y
 * corta antes del commit.
 *
 * Los casos de abajo también son la autocomprobación de `calcularDvNit`: las
 * tres ramas del resto (0, 1 y el resto mayor que 1), la tolerancia a los
 * puntos, y el rechazo de lo que no es un NIT. Sin ellos la función sería
 * aritmética sin red, y un error ahí haría fallar el chequeo justo cuando el
 * dato sí está bien.
 *
 * Uso: `npx tsx scripts/verificar-datos-legales.ts`
 */
import assert from "node:assert/strict";

import { IDENTIDAD_LEGAL, NIT_PUBLICO, nitPublicable } from "../src/config/sitio";
import { calcularDvNit } from "../src/lib/utils/nit";

const casos: [string, () => void][] = [
  [
    "el NIT configurado coincide con su dígito de verificación",
    () => {
      const calculado = calcularDvNit(IDENTIDAD_LEGAL.nit);
      assert.equal(
        calculado,
        IDENTIDAD_LEGAL.nitDv,
        `NIT ${IDENTIDAD_LEGAL.nit}: el dígito configurado es ${IDENTIDAD_LEGAL.nitDv} y el algoritmo DIAN da ${calculado}. ` +
          "Si el dígito viene del RUT, la cifra mal teclada está en el NIT base.",
      );
    },
  ],
  [
    "confirmado, el NIT publicable es el número con su dígito",
    () =>
      assert.equal(
        nitPublicable({ nit: IDENTIDAD_LEGAL.nit, nitDv: IDENTIDAD_LEGAL.nitDv, nitConfirmado: true }),
        `${IDENTIDAD_LEGAL.nit}-${IDENTIDAD_LEGAL.nitDv}`,
      ),
  ],
  [
    "sin confirmar, no hay NIT publicable: null, no una cadena a medias",
    () =>
      assert.equal(
        nitPublicable({ nit: IDENTIDAD_LEGAL.nit, nitDv: IDENTIDAD_LEGAL.nitDv, nitConfirmado: false }),
        null,
      ),
  ],
  [
    "NIT_PUBLICO concuerda con el estado configurado hoy",
    () =>
      assert.equal(
        NIT_PUBLICO,
        IDENTIDAD_LEGAL.nitConfirmado ? `${IDENTIDAD_LEGAL.nit}-${IDENTIDAD_LEGAL.nitDv}` : null,
      ),
  ],
  [
    "resto 0: el dígito es el propio resto (el caso de la corporación, suma 759)",
    () => assert.equal(calcularDvNit("902072786"), 0),
  ],
  [
    "resto 1: el dígito es el propio resto, no 11 menos el resto",
    // Suma ponderada 375, resto 1. NIT sintético: sirve para la rama del
    // algoritmo, no identifica a nadie.
    () => assert.equal(calcularDvNit("900000002"), 1),
  ],
  [
    "resto mayor que 1: el dígito es 11 menos el resto",
    // Suma 381, resto 7, dígito 4. También sintético.
    () => assert.equal(calcularDvNit("900000004"), 4),
  ],
  [
    "los puntos y los espacios de la escritura corriente no cambian el resultado",
    () => {
      assert.equal(calcularDvNit("902.072.786"), 0);
      assert.equal(calcularDvNit(" 902 072 786 "), 0);
    },
  ],
  [
    "un NIT con el dígito de verificación pegado detrás se rechaza, no se adivina",
    () => assert.throws(() => calcularDvNit("902.072.786-0"), /NIT inválido/),
  ],
  [
    "lo que no son cifras se rechaza",
    () => {
      assert.throws(() => calcularDvNit(""), /NIT inválido/);
      assert.throws(() => calcularDvNit("[NIT de la corporación]"), /NIT inválido/);
      assert.throws(() => calcularDvNit("9".repeat(16)), /NIT inválido/);
    },
  ],
];

let fallas = 0;
console.log("");
for (const [nombre, comprobar] of casos) {
  try {
    comprobar();
    console.log(`  OK    ${nombre}`);
  } catch (error) {
    fallas += 1;
    console.log(` FALLA  ${nombre}\n        ${error instanceof Error ? error.message.split("\n")[0] : error}`);
  }
}
console.log("");
console.log(`Casos: ${casos.length}, fallidos: ${fallas}`);
console.log("");
if (fallas > 0) process.exit(1);
console.log("VALIDACIÓN LIMPIA");
