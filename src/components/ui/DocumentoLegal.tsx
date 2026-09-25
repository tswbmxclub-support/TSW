import { Aparece } from "@/lib/animaciones";

/**
 * Un documento legal largo: política de datos, términos, devoluciones.
 *
 * Es un primitivo y no tres páginas con su propio maquetado porque los tres
 * documentos tienen la misma forma —secciones con título, párrafos, listas y
 * pares "término — explicación"— y la misma necesidad: que se pueda leer en un
 * celular y que se pueda llegar a una sección concreta sin barrer el texto.
 *
 * El índice es una lista de enlaces a los `id` de las secciones. En pantalla
 * ancha se queda fijo al lado; en móvil va arriba, que es donde sirve: el
 * documento es largo y el pulgar no quiere recorrerlo entero.
 *
 * Los pares término/explicación van en `<dl>` de verdad. En un documento legal
 * el término es lo que se cita ("según la cláusula de Garantía"), y un lector de
 * pantalla lo anuncia como definición si el marcado lo dice.
 */

export type BloqueLegal =
  | { tipo: "parrafo"; texto: string }
  | { tipo: "lista"; items: string[] }
  | { tipo: "definiciones"; items: { termino: string; texto: string }[] };

export type SeccionLegal = {
  id: string;
  titulo: string;
  bloques: BloqueLegal[];
};

export type DocumentoLegalProps = {
  /** Se usa para el `aria-labelledby` del artículo. */
  tituloId: string;
  titulo: string;
  secciones: SeccionLegal[];
};

const ENLACE_INDICE =
  "inline-flex min-h-[44px] items-center text-sm text-acento-oscuro underline-offset-4 hover:underline " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco";

export function DocumentoLegal({ tituloId, titulo, secciones }: DocumentoLegalProps) {
  return (
    <div className="contenedor grid gap-10 py-12 sm:py-16 lg:grid-cols-[16rem_1fr] lg:gap-16 lg:py-20">
      <nav aria-labelledby="indice-legal" className="lg:sticky lg:top-28 lg:self-start">
        <h2 id="indice-legal" className="text-xs font-bold uppercase tracking-[0.15em] text-texto-sec">
          En esta página
        </h2>
        <ol className="mt-3 flex flex-col border-l border-gris-borde pl-4">
          {secciones.map((seccion) => (
            <li key={seccion.id}>
              <a href={`#${seccion.id}`} className={ENLACE_INDICE}>
                {seccion.titulo}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article aria-labelledby={tituloId} className="max-w-prose">
        {/* El título visible lo pone el hero; aquí solo se referencia para que el
            artículo tenga nombre accesible sin repetirlo en pantalla. */}
        <h2 id={tituloId} className="sr-only">
          {titulo}
        </h2>

        <div className="flex flex-col gap-10">
          {secciones.map((seccion, i) => (
            <Aparece key={seccion.id} indice={Math.min(i, 4)}>
              {/* El ancla del índice apunta a la SECCIÓN y no al título: así el
                  salto deja a la vista el bloque completo. `scroll-mt` compensa
                  el header fijo, que si no taparía el título al llegar. */}
              <section id={seccion.id} aria-labelledby={`titulo-${seccion.id}`} className="scroll-mt-28">
                <h3 id={`titulo-${seccion.id}`} className="text-xl sm:text-2xl">
                  {seccion.titulo}
                </h3>

                <div className="mt-4 flex flex-col gap-4">
                  {seccion.bloques.map((bloque, j) => (
                    <BloqueRenderizado key={j} bloque={bloque} />
                  ))}
                </div>
              </section>
            </Aparece>
          ))}
        </div>
      </article>
    </div>
  );
}

function BloqueRenderizado({ bloque }: { bloque: BloqueLegal }) {
  if (bloque.tipo === "parrafo") {
    return <p className="leading-relaxed text-texto-sec">{bloque.texto}</p>;
  }

  if (bloque.tipo === "lista") {
    return (
      <ul className="flex flex-col gap-2">
        {bloque.items.map((item) => (
          <li key={item} className="flex gap-3 leading-relaxed text-texto-sec">
            <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-acento-oscuro" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <dl className="flex flex-col gap-4">
      {bloque.items.map((item) => (
        <div key={item.termino}>
          <dt className="font-semibold text-azul-profundo">{item.termino}</dt>
          <dd className="mt-1 leading-relaxed text-texto-sec">{item.texto}</dd>
        </div>
      ))}
    </dl>
  );
}
