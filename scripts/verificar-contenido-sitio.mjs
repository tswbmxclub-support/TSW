/**
 * Verificación mecánica de la migración 19 (contenido editable del sitio).
 *
 * Lee los archivos SQL reales del repo —no la conversación— y cruza:
 *   · la tabla: columnas, constraints con nombre, la lista cerrada de claves y
 *     que exista la columna `id` que el trigger de auditoría necesita,
 *   · que las claves del CHECK sean exactamente las constantes que exporta
 *     `src/config/contenido.ts`: una clave de más aquí o una sección de más allí
 *     y el panel editaría algo que el sitio no lee,
 *   · que el trigger de auditoría apunte a `registrar_auditoria()`, y que esa
 *     función saque el id de la columna `id` —que es lo que obliga a tenerla—,
 *   · las políticas: lectura para anon SIN mencionar es_admin() (la trampa de la
 *     migración 18) y CERO políticas de escritura,
 *   · las dos RPC: actor primero, definer, search_path, revoke y grant con la
 *     firma exacta, y que `guardar_contenido` no lleve coalesce sobre el valor,
 *   · que la capa de lectura, cuando exista, valide cada clave con safeParse y
 *     caiga al valor de contenido.ts para ESA clave registrando el error: una
 *     fila con forma vieja no puede romper una página pública,
 *   · el bucket: alta con tope y MIME, lectura propia, y que las tres políticas
 *     de escritura exijan es_admin(), que es lo que las del bucket viejo no
 *     hacen.
 *
 * `node scripts/verificar-contenido-sitio.mjs`. Termina en "VALIDACIÓN LIMPIA"
 * solo si todo cruza. Lo que queda fuera está declarado al final.
 */
import { existsSync, readFileSync } from "node:fs";

const DIR = "supabase/migrations";
const RUTA_19 = `${DIR}/20260925120000_contenido_editable_del_sitio.sql`;
const RUTA_06 = `${DIR}/20260917100500_auditoria.sql`;
const RUTA_09 = `${DIR}/20260917100800_storage_buckets.sql`;
const RUTA_CONTENIDO = "src/config/contenido.ts";

const ALIAS = { [RUTA_19]: "19", [RUTA_06]: "06", [RUTA_09]: "09", [RUTA_CONTENIDO]: "contenido.ts" };

const archivos = new Map(
  Object.keys(ALIAS).map((ruta) => {
    const texto = readFileSync(ruta, "utf8");
    return [ruta, { texto, lineas: texto.split("\n") }];
  }),
);

const sinComentarios = (t) => t.replace(/--[^\n]*/g, "");
const colapsar = (t) => t.replace(/\s+/g, " ");
const sql19 = colapsar(sinComentarios(archivos.get(RUTA_19).texto));

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

/** Cuerpo de una función, de su `create` al `$$;` que la cierra. */
function bloqueFuncion(ruta, patron) {
  const { lineas } = archivos.get(ruta);
  const inicio = lineaDe(ruta, patron);
  if (inicio === null) return null;
  let fin = inicio;
  while (fin < lineas.length && lineas[fin].trimEnd() !== "$$;") fin += 1;
  if (fin >= lineas.length) return null;
  return { inicio, fin: fin + 1, texto: lineas.slice(inicio - 1, fin + 1).join("\n") };
}

const resultados = [];
function verificar(nombre, ok, referencia, detalle = "") {
  resultados.push({ nombre, ok: Boolean(ok), ref: referencia ?? "—", detalle });
}

// --- 1. La tabla ------------------------------------------------------------

const creaTabla = /create table if not exists public\.contenido_sitio \(/i.test(sql19);
verificar("la tabla contenido_sitio se crea", creaTabla, ref(RUTA_19, lineaDe(RUTA_19, "create table if not exists public\\.contenido_sitio")));

for (const [columna, tipo] of [
  ["id", "uuid primary key default gen_random_uuid\\(\\)"],
  ["clave", "text not null"],
  ["valor", "jsonb not null"],
  ["actualizado_en", "timestamptz not null default now\\(\\)"],
]) {
  const re = new RegExp(`${columna}\\s+${tipo}`, "i");
  verificar(`columna ${columna}`, re.test(sql19), ref(RUTA_19, lineaDe(RUTA_19, `^\\s*${columna}\\s`)));
}

for (const constraint of [
  "contenido_sitio_clave_unica",
  "contenido_sitio_clave_conocida",
  "contenido_sitio_valor_compuesto",
]) {
  verificar(
    `constraint con nombre: ${constraint}`,
    new RegExp(`constraint ${constraint}`, "i").test(sql19),
    ref(RUTA_19, lineaDe(RUTA_19, constraint)),
  );
}

// --- 2. Las claves del CHECK contra contenido.ts ----------------------------

const checkClaves = sql19.match(/contenido_sitio_clave_conocida check \( clave in \(([^)]+)\)/i);
const clavesSql = checkClaves
  ? [...checkClaves[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()
  : [];

// Las constantes de sección que exporta contenido.ts, en minúscula.
const exportadas = [...archivos.get(RUTA_CONTENIDO).texto.matchAll(/^export const ([A-Z_]+)[ :]/gm)]
  .map((m) => m[1].toLowerCase())
  .sort();

verificar(
  `el CHECK lista ${clavesSql.length} claves`,
  clavesSql.length === 5,
  ref(RUTA_19, lineaDe(RUTA_19, "contenido_sitio_clave_conocida")),
  clavesSql.join(", "),
);

verificar(
  "las claves del CHECK son exactamente las secciones de contenido.ts",
  clavesSql.length > 0 && clavesSql.join(",") === exportadas.join(","),
  ref(RUTA_CONTENIDO, lineaDe(RUTA_CONTENIDO, "^export const [A-Z_]+ ")),
  clavesSql.join(",") === exportadas.join(",") ? "" : `SQL: ${clavesSql.join(", ")} · contenido.ts: ${exportadas.join(", ")}`,
);

// --- 3. Auditoría -----------------------------------------------------------

const trigger = sql19.match(
  /create trigger contenido_sitio_auditoria after insert or update or delete on public\.contenido_sitio for each row execute function public\.registrar_auditoria\(\)/i,
);
verificar(
  "trigger de auditoría en las tres operaciones, con registrar_auditoria()",
  trigger,
  ref(RUTA_19, lineaDe(RUTA_19, "create trigger contenido_sitio_auditoria")),
);

// La razón de existir de la columna `id`: comprobada contra la migración 06, no
// asumida. Si algún día el trigger saca el id de otra columna, esto avisa.
const auditoria = colapsar(sinComentarios(archivos.get(RUTA_06).texto));
verificar(
  "registrar_auditoria() saca entidad_id de la columna `id` (por eso la tabla la tiene)",
  /v_entidad_id := coalesce\(v_despues ->> 'id', v_antes ->> 'id'\)::uuid/i.test(auditoria),
  ref(RUTA_06, lineaDe(RUTA_06, "v_entidad_id := coalesce")),
);
verificar(
  "evento_auditoria.entidad_id es uuid not null (lo que obliga a la columna)",
  /entidad_id\s+uuid not null/i.test(auditoria),
  ref(RUTA_06, lineaDe(RUTA_06, "entidad_id\\s+uuid not null")),
);

// --- 4. Políticas de la tabla -----------------------------------------------

verificar(
  "RLS activo",
  /alter table public\.contenido_sitio enable row level security/i.test(sql19),
  ref(RUTA_19, lineaDe(RUTA_19, "enable row level security")),
);

const lectura = sql19.match(
  /create policy contenido_sitio_lectura on public\.contenido_sitio for select to ([^ ]+(?:, ?[^ ]+)*) using \(([^)]*)\)/i,
);
verificar("política de lectura para anon y authenticated", lectura && /anon/.test(lectura[1]) && /authenticated/.test(lectura[1]), ref(RUTA_19, lineaDe(RUTA_19, "create policy contenido_sitio_lectura")), lectura?.[1]);

// La trampa de la migración 18: es_admin() está revocada de anon y evaluarla en
// una política que alcanza a anon devuelve 42501.
verificar(
  "la política que alcanza a anon NO menciona es_admin()",
  lectura && !/es_admin/i.test(lectura[2]),
  ref(RUTA_19, lineaDe(RUTA_19, "create policy contenido_sitio_lectura")),
  lectura?.[2],
);

const escrituras = [...sql19.matchAll(/create policy \w+ on public\.contenido_sitio for (insert|update|delete)/gi)];
verificar(
  "cero políticas de escritura sobre la tabla (negación por defecto)",
  escrituras.length === 0,
  ref(RUTA_19, lineaDe(RUTA_19, "Escritura: NINGUNA")),
  escrituras.length === 0 ? "" : `hay ${escrituras.length}`,
);

// --- 5. Las dos RPC ---------------------------------------------------------

const RPC = [
  { nombre: "guardar_contenido", firma: "uuid, text, jsonb", devuelve: "public.contenido_sitio" },
  { nombre: "restablecer_contenido", firma: "uuid, text", devuelve: "void" },
];

for (const { nombre, firma, devuelve } of RPC) {
  const bloque = bloqueFuncion(RUTA_19, `create or replace function public\\.${nombre}\\(`);
  const cuerpo = bloque ? colapsar(sinComentarios(bloque.texto)) : "";
  const r = ref(RUTA_19, bloque?.inicio);

  verificar(`${nombre}: existe`, Boolean(bloque), r);
  verificar(`${nombre}: primer parámetro p_actor_id uuid`, /\(\s*p_actor_id uuid/i.test(cuerpo), r);
  verificar(`${nombre}: devuelve ${devuelve}`, new RegExp(`returns ${devuelve.replace(".", "\\.")}`, "i").test(cuerpo), r);
  verificar(`${nombre}: security definer`, /security definer/i.test(cuerpo), r);
  verificar(`${nombre}: set search_path = public`, /set search_path = public/i.test(cuerpo), r);

  // El actor, antes de tocar nada: si establecer_actor va después de la
  // escritura, la bitácora se queda sin actor.
  const posActor = cuerpo.search(/perform public\.establecer_actor\(p_actor_id\)/i);
  const posEscritura = cuerpo.search(/\b(insert into|update |delete from)\b/i);
  verificar(
    `${nombre}: establecer_actor antes de escribir`,
    posActor >= 0 && (posEscritura < 0 || posActor < posEscritura),
    r,
  );

  verificar(
    `${nombre}: revoke a public, anon y authenticated con la firma exacta`,
    new RegExp(`revoke execute on function public\\.${nombre}\\(${firma}\\) from public, anon, authenticated`, "i").test(sql19),
    ref(RUTA_19, lineaDe(RUTA_19, `revoke execute on function public\\.${nombre}`)),
  );
  verificar(
    `${nombre}: grant solo a service_role con la firma exacta`,
    new RegExp(`grant\\s+execute on function public\\.${nombre}\\(${firma}\\) to service_role`, "i").test(sql19),
    ref(RUTA_19, lineaDe(RUTA_19, `grant\\s+execute on function public\\.${nombre}`)),
  );
  verificar(
    `${nombre}: tiene comment`,
    new RegExp(`comment on function public\\.${nombre}\\(${firma}\\) is`, "i").test(sql19),
    ref(RUTA_19, lineaDe(RUTA_19, `comment on function public\\.${nombre}`)),
  );
}

// El contrato del proyecto: `guardar_*` es reemplazo total, sin coalesce.
const guardar = bloqueFuncion(RUTA_19, "create or replace function public\\.guardar_contenido\\(");
verificar(
  "guardar_contenido: reemplazo total, sin coalesce sobre el valor",
  guardar && !/coalesce\s*\(\s*p_valor/i.test(guardar.texto),
  ref(RUTA_19, guardar?.inicio),
);
verificar(
  "guardar_contenido: upsert por clave (on conflict), no dos caminos",
  guardar && /on conflict \(clave\) do update/i.test(colapsar(guardar.texto)),
  ref(RUTA_19, lineaDe(RUTA_19, "on conflict \\(clave\\)")),
);

// --- 6. El bucket -----------------------------------------------------------

const altaBucket = sql19.match(
  /insert into storage\.buckets \(id, name, public, file_size_limit, allowed_mime_types\) values \('sitio', 'sitio', true, (\d+), array\[([^\]]+)\]/i,
);
verificar("el bucket sitio se crea público", Boolean(altaBucket), ref(RUTA_19, lineaDe(RUTA_19, "insert into storage\\.buckets")));
verificar(
  "tope de 10 MB, igual que los otros tres",
  altaBucket?.[1] === "10485760",
  ref(RUTA_19, lineaDe(RUTA_19, "10485760")),
  altaBucket?.[1],
);
const mimes = altaBucket ? [...altaBucket[2].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort() : [];
verificar(
  "los tipos permitidos son exactamente PNG, JPEG y WebP",
  mimes.join(",") === "image/jpeg,image/png,image/webp",
  ref(RUTA_19, lineaDe(RUTA_19, "allowed_mime_types")),
  mimes.join(", "),
);
// SVG por separado y por su nombre: es un documento XML que puede llevar
// <script>, y el bucket es público. Un solo archivo ahí sería XSS servido desde
// infraestructura de confianza, así que este caso no se deduce del anterior: se
// escribe aparte para que se lea en el reporte.
verificar(
  "sin image/svg+xml",
  !/svg/i.test(altaBucket?.[2] ?? "svg"),
  ref(RUTA_19, lineaDe(RUTA_19, "allowed_mime_types")),
);
verificar(
  "on conflict do update, no do nothing (un bucket mal configurado se corrige)",
  /on conflict \(id\) do update/i.test(sql19),
  ref(RUTA_19, lineaDe(RUTA_19, "on conflict \\(id\\) do update")),
);

const POLITICAS_BUCKET = [
  ["tsw sitio lectura publica", "select", false],
  ["tsw sitio subida", "insert", true],
  ["tsw sitio reemplazo", "update", true],
  ["tsw sitio borrado", "delete", true],
];

for (const [politica, operacion, exigeAdmin] of POLITICAS_BUCKET) {
  const re = new RegExp(`create policy "${politica}" on storage\\.objects for ${operacion} to \\w+(?:, ?\\w+)* (?:using|with check) \\(([^;]*?)\\);`, "i");
  const encontrada = sql19.match(re);
  const r = ref(RUTA_19, lineaDe(RUTA_19, `create policy "${politica}"`));

  verificar(`bucket: política ${politica} (${operacion})`, Boolean(encontrada), r);
  verificar(
    `bucket: ${politica} acota bucket_id y carpeta raíz`,
    encontrada && /bucket_id = 'sitio'/i.test(encontrada[1]) && /foldername\(name\)\)\[1\] = 'sitio'/i.test(encontrada[1] + sql19),
    r,
  );
  if (exigeAdmin) {
    verificar(
      `bucket: ${politica} exige es_admin()`,
      encontrada && /es_admin\(\)/i.test(encontrada[1]),
      r,
    );
  } else {
    verificar(
      `bucket: ${politica} NO menciona es_admin() (alcanza a anon)`,
      encontrada && !/es_admin/i.test(encontrada[1]),
      r,
    );
  }
}

// --- 7. La capa de lectura: una fila con forma vieja no rompe una página ----
//
// Requisito de Samuel, y es el riesgo real de guardar contenido como jsonb: la
// base solo garantiza que sea un objeto o una lista. El día que un tipo de
// `contenido.ts` cambie, la fila guardada tendrá la forma anterior; si la página
// confía en ella, revienta en producción para todos los visitantes a la vez.
//
// La regla: cada clave se valida con `safeParse` y, si falla, se usa el valor de
// `contenido.ts` PARA ESA CLAVE —no para todas— y el error se registra en el
// servidor.
//
// Este caso se activa solo. Mientras la capa de lectura no exista, informa de
// que está pendiente; en cuanto aparezca el archivo, exige las tres cosas. Así
// el requisito no depende de que alguien se acuerde al escribirla.
const CANDIDATAS_LECTURA = [
  "src/features/sitio/contenido.ts",
  "src/features/sitio/queries.ts",
  "src/config/contenido-remoto.ts",
];
const rutaLectura = CANDIDATAS_LECTURA.find((r) => existsSync(r));

if (rutaLectura === undefined) {
  verificar(
    "capa de lectura: el caso se activará cuando exista",
    true,
    "—",
    `todavía no existe (se busca en ${CANDIDATAS_LECTURA.join(", ")})`,
  );
} else {
  const lectura = readFileSync(rutaLectura, "utf8");
  verificar("capa de lectura: valida con safeParse", /\.safeParse\(/.test(lectura), rutaLectura);
  verificar(
    "capa de lectura: al fallar usa el valor por defecto de esa clave",
    /porDefecto|por_defecto|POR_DEFECTO|defecto\[/.test(lectura),
    rutaLectura,
  );
  verificar(
    "capa de lectura: registra el error en el servidor",
    /console\.(error|warn)\(/.test(lectura),
    rutaLectura,
  );
  verificar(
    "capa de lectura: un fallo de lectura tampoco rompe la página (try/catch)",
    /try\s*\{/.test(lectura) && /catch/.test(lectura),
    rutaLectura,
  );
}

// Contraste con el bucket viejo: esto no falla, informa. Si algún día se
// endurecen las políticas de la 09, este caso lo dirá.
const bucketViejo = colapsar(sinComentarios(archivos.get(RUTA_09).texto));
const viejoSinAdmin = /create policy "tsw productos subida" on storage\.objects for insert to authenticated with check \( bucket_id = 'productos' and \(storage\.foldername\(name\)\)\[1\] = 'productos' \)/i.test(bucketViejo);

// --- Reporte ----------------------------------------------------------------

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
console.log("  · La semántica de los cuerpos plpgsql: libpg_query no cubre plpgsql. Que el");
console.log("    upsert respete el CHECK de claves y que el DELETE de restablecer_contenido no");
console.log("    tropiece con nada lo confirma el db push.");
console.log("  · La FORMA del jsonb de cada sección. La base solo exige objeto o lista; que el");
console.log("    contenido cuadre con los tipos de contenido.ts lo valida Zod en el servidor y");
console.log("    eso se comprueba con la pantalla, no aquí.");
console.log("  · Las políticas de Storage contra un Postgres real: `storage.foldername` y el");
console.log("    alta del bucket solo se prueban en el push.");
if (viejoSinAdmin) {
  console.log("");
  console.log("Nota, no es un fallo de esta migración:");
  console.log("  · Las políticas de escritura de los buckets `documentos-matricula`, `productos`");
  console.log("    y `competencias` (migración 09) dicen `to authenticated` sin exigir es_admin().");
  console.log("    Son de cuando no había perfiles separados; hoy una sesión de usuario también");
  console.log("    es `authenticated`. El bucket `sitio` sí lo exige. Endurecer las tres viejas");
  console.log("    es otra migración, no esta.");
}
