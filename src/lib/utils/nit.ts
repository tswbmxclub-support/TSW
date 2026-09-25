/**
 * Dígito de verificación del NIT, algoritmo de la DIAN.
 *
 * Existe para una sola cosa: que un NIT mal teclado no llegue a las páginas
 * legales. El NIT identifica a la corporación frente a la DIAN y aparece en la
 * política de tratamiento de datos y en los términos; con el dígito equivocado
 * el dato es inservible y nadie lo nota a ojo, porque un dígito es un dígito.
 * `npm run verificar:legales` cruza el configurado contra esta función.
 *
 * El algoritmo: se recorre el NIT **sin** dígito de verificación de derecha a
 * izquierda, cada cifra se multiplica por su primo de la tabla, se suman los
 * productos y se toma el resto entre 11. Con resto 0 o 1 el dígito ES el resto;
 * con cualquier otro, es 11 menos el resto. Los dos casos del resto no son un
 * capricho teórico: sin ellos el dígito podría salir 10 u 11, que no son cifras.
 */

/**
 * Primos de la DIAN, en el orden en que se aplican desde la cifra de la
 * derecha. Quince, que es el largo máximo del NIT en el RUT.
 */
const PRIMOS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71] as const;

/**
 * Calcula el dígito de verificación de un NIT.
 *
 * @param nit NIT **sin** el dígito de verificación. Se aceptan los puntos y los
 *   espacios con que se escribe de forma corriente (`902.072.786`), no el
 *   dígito pegado detrás: `calcularDvNit("902.072.786-0")` no tiene sentido y
 *   lanza, porque el `0` final se tomaría como una cifra más del NIT y el
 *   resultado sería otro número igual de creíble. Esa es exactamente la clase
 *   de error silencioso que esta función existe para evitar, así que se rechaza
 *   en vez de adivinar.
 * @returns El dígito, de 0 a 9.
 */
export function calcularDvNit(nit: string): number {
  const cifras = nit.replace(/[.\s]/g, "");

  if (!/^\d{1,15}$/.test(cifras)) {
    throw new Error(
      `NIT inválido: se esperaban de 1 a 15 cifras sin dígito de verificación, y llegó "${nit}".`,
    );
  }

  // Se recorre la tabla de primos y no las cifras: así el índice nunca se sale
  // de la tabla, y el corte cubre los NIT más cortos que quince cifras.
  let suma = 0;
  for (const [i, primo] of PRIMOS.entries()) {
    const cifra = cifras[cifras.length - 1 - i];
    if (cifra === undefined) break;
    suma += Number(cifra) * primo;
  }

  const resto = suma % 11;
  return resto < 2 ? resto : 11 - resto;
}
