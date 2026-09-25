/**
 * Comprobación de la migración 19 CONTRA EL REMOTO, con la anon key.
 *
 * El SQL ya lo cruza `verificar:contenido` leyendo los archivos. Esto comprueba
 * lo que los archivos no pueden decir: que con la llave que usa el navegador la
 * lectura funciona y la escritura no.
 *
 * Por qué importa la lectura: la política de `contenido_sitio` NO menciona
 * `es_admin()`, y la razón es que `anon` no tiene EXECUTE sobre esa función. Si
 * alguien la añadiera, cada SELECT de anon moriría con 42501 y —como el
 * contenido se lee en las páginas públicas— se caería el sitio entero, igual que
 * pasó con `club` en la migración 17. Este caso lo detecta en un segundo.
 *
 * Por qué importa la escritura: la tabla no tiene ninguna política de INSERT,
 * UPDATE ni DELETE. Con RLS activo eso significa que nadie escribe salvo el
 * service_role por la RPC. Aquí se comprueba con la llave real, no leyendo el
 * esquema.
 *
 * `npm run verificar:contenido-remoto`. Crea un usuario temporal propio para ser
 * el actor de la bitácora y lo borra al terminar, confirmando el borrado por
 * consulta: es el método que prescribe CLAUDE.md, y no se abre ninguna sesión.
 */
import { cargarEnvLocal, clienteAnon, clienteServicio } from "./_comun";

cargarEnvLocal();

async function main(): Promise<void> {

  const anon = clienteAnon();
  const casos: { nombre: string; ok: boolean; detalle: string }[] = [];
  const anotar = (nombre: string, ok: boolean, detalle = "") => casos.push({ nombre, ok, detalle });

  // --- 1. Lectura con anon ----------------------------------------------------

  const lectura = await anon.from("contenido_sitio").select("clave, actualizado_en");
  anotar(
    "anon puede LEER contenido_sitio",
    lectura.error === null,
    lectura.error ? `${lectura.error.code ?? "?"}: ${lectura.error.message}` : `${lectura.data?.length ?? 0} filas`,
  );
  anotar(
    "la lectura no muere con 42501 (la política no llama a es_admin)",
    lectura.error?.code !== "42501",
    lectura.error?.code === "42501" ? "permission denied: alguien metió es_admin() en la política de anon" : "",
  );

  // --- 2. Escritura con anon --------------------------------------------------

  // `portada` es una clave válida del CHECK a propósito: si el insert fallara por
  // la lista de claves en vez de por RLS, la prueba no diría nada sobre RLS.
  const insercion = await anon
    .from("contenido_sitio")
    .insert({ clave: "portada", valor: { colado: "por anon" } });

  anotar(
    "anon NO puede insertar (no hay política de escritura)",
    insercion.error !== null,
    insercion.error ? `rechazado con ${insercion.error.code ?? "?"}` : "SE ESCRIBIÓ: hay una política de escritura que no debería existir",
  );

  const actualizacion = await anon
    .from("contenido_sitio")
    .update({ valor: { colado: "por anon" } })
    .eq("clave", "portada");

  anotar(
    "anon NO puede actualizar",
    actualizacion.error !== null || (actualizacion.count ?? 0) === 0,
    actualizacion.error ? `rechazado con ${actualizacion.error.code ?? "?"}` : "sin filas afectadas",
  );

  const borrado = await anon.from("contenido_sitio").delete().eq("clave", "portada");
  anotar(
    "anon NO puede borrar",
    borrado.error !== null || (borrado.count ?? 0) === 0,
    borrado.error ? `rechazado con ${borrado.error.code ?? "?"}` : "sin filas afectadas",
  );

  // --- 3. Las RPC no están al alcance de anon ---------------------------------

  const rpc = await anon.rpc("guardar_contenido", {
    p_actor_id: "00000000-0000-0000-0000-000000000000",
    p_clave: "portada",
    p_valor: { colado: "por anon" },
  });
  anotar(
    "anon NO puede llamar a guardar_contenido",
    rpc.error !== null,
    rpc.error ? `rechazado con ${rpc.error.code ?? "?"}` : "SE EJECUTÓ: el revoke no está en remoto",
  );

  const rpcReset = await anon.rpc("restablecer_contenido", {
    p_actor_id: "00000000-0000-0000-0000-000000000000",
    p_clave: "portada",
  });
  anotar(
    "anon NO puede llamar a restablecer_contenido",
    rpcReset.error !== null,
    rpcReset.error ? `rechazado con ${rpcReset.error.code ?? "?"}` : "SE EJECUTÓ: el revoke no está en remoto",
  );

  // --- 4. Que el sitio público sigue leyendo lo de siempre --------------------
  //
  // La migración 20 tocó las políticas de Storage. Si algo se rompió ahí, la
  // lectura de los buckets desde el cliente deja de funcionar y las fotos y los
  // PDF desaparecen del sitio. Se comprueba listando, que es lo que pasa por RLS.

  for (const bucket of ["documentos-matricula", "productos", "competencias", "sitio"]) {
    const lista = await anon.storage.from(bucket).list("", { limit: 1 });
    anotar(
      `anon puede LISTAR el bucket ${bucket}`,
      lista.error === null,
      lista.error ? lista.error.message : `${lista.data?.length ?? 0} objeto(s) visibles`,
    );
  }

  // --- 5. La bitácora registra el actor real ---------------------------------
  //
  // Esto necesita una escritura de verdad, y una escritura necesita un
  // `p_actor_id` que exista en `auth.users`: la FK de `evento_auditoria.actor_id`
  // rechaza un uuid inventado.
  //
  // Se hace con un USUARIO TEMPORAL PROPIO, que es el método que prescribe
  // CLAUDE.md, y no con la cuenta de Samuel: pasar su id atribuiría a él un
  // cambio que no hizo, y eso es falsear la bitácora. Crear una cuenta propia no
  // es autenticarse como nadie; aquí no se abre ninguna sesión.
  //
  // Se borra al terminar, y el borrado se confirma por consulta. El id del actor
  // se lee ANTES del borrado: al eliminar la cuenta, la FK `on delete set null`
  // deja el evento con `actor_id` en NULL (migración 16), que es lo correcto y no
  // serviría como prueba.
  const servicio = clienteServicio();
  const correo = `verificacion-contenido-${Date.now()}@tsw-verificacion.com`;
  const alta = await servicio.auth.admin.createUser({
    email: correo,
    password: `Verificacion-${Date.now()}!`,
    email_confirm: true,
  });

  if (alta.error || !alta.data.user) {
    anotar("usuario temporal creado para ser el actor", false, alta.error?.message ?? "sin usuario");
  } else {
    const actorId = alta.data.user.id;
    anotar("usuario temporal creado para ser el actor", true, `id ${actorId.slice(0, 8)}…`);

    const crear = await servicio.rpc("guardar_contenido", {
      p_actor_id: actorId,
      p_clave: "tienda",
      p_valor: { beneficios: [{ id: "prueba", titulo: "Prueba de verificación", texto: "Se borra al terminar." }] },
    });
    anotar("guardar_contenido escribe (service role)", crear.error === null, crear.error?.message ?? "fila creada");

    const actualizar = await servicio.rpc("guardar_contenido", {
      p_actor_id: actorId,
      p_clave: "tienda",
      p_valor: { beneficios: [{ id: "prueba", titulo: "Prueba modificada", texto: "Se borra al terminar." }] },
    });
    anotar("guardar_contenido reemplaza la misma clave", actualizar.error === null, actualizar.error?.message ?? "fila actualizada");

    const restablecer = await servicio.rpc("restablecer_contenido", { p_actor_id: actorId, p_clave: "tienda" });
    anotar("restablecer_contenido borra la fila", restablecer.error === null, restablecer.error?.message ?? "fila borrada");

    // Los tres eventos, con el actor, ANTES de borrar la cuenta.
    const eventos = await servicio
      .from("evento_auditoria")
      .select("accion, entidad, actor_id")
      .eq("entidad", "contenido_sitio")
      .eq("actor_id", actorId)
      .order("ocurrido_en", { ascending: true });

    const acciones = (eventos.data ?? []).map((e) => e.accion);
    anotar(
      "la bitácora registró las tres escrituras con el actor real",
      eventos.error === null && acciones.length === 3,
      eventos.error ? eventos.error.message : `acciones: ${acciones.join(", ")}`,
    );
    anotar(
      "ningún evento quedó con actor_id en NULL",
      (eventos.data ?? []).every((e) => e.actor_id === actorId),
      `${(eventos.data ?? []).length} eventos con actor ${actorId.slice(0, 8)}…`,
    );

    // La fila de prueba no se queda: restablecer_contenido ya la borró, pero se
    // confirma, porque una fila colada cambiaría el contenido del sitio público.
    const restante = await anon.from("contenido_sitio").select("clave").eq("clave", "tienda");
    anotar("no queda la fila de prueba en contenido_sitio", (restante.data?.length ?? 0) === 0, `${restante.data?.length ?? 0} filas`);

    // --- Limpieza -----------------------------------------------------------
    const baja = await servicio.auth.admin.deleteUser(actorId);
    anotar("usuario temporal eliminado", baja.error === null, baja.error?.message ?? "");

    const buscar = await servicio.auth.admin.listUsers();
    const sigue = (buscar.data?.users ?? []).some((u) => u.id === actorId);
    anotar("el borrado del usuario confirmado por consulta", !sigue, sigue ? "SIGUE EXISTIENDO" : "no aparece en auth.users");

    const perfil = await servicio.from("perfil_usuario").select("id").eq("id", actorId);
    anotar("su perfil también desapareció", (perfil.data?.length ?? 0) === 0, `${perfil.data?.length ?? 0} filas`);

    // La bitácora NO se borra: sus eventos siguen ahí con el actor anonimizado.
    const tras = await servicio
      .from("evento_auditoria")
      .select("accion")
      .eq("entidad", "contenido_sitio")
      .is("actor_id", null);
    anotar(
      "los eventos siguen en la bitácora con el actor anonimizado (migración 16)",
      (tras.data?.length ?? 0) >= 3,
      `${tras.data?.length ?? 0} eventos con actor_id NULL`,
    );
  }

  // --- Reporte ----------------------------------------------------------------

  const ancho = Math.max(...casos.map((c) => c.nombre.length));
  let fallas = 0;
  console.log("");
  for (const c of casos) {
    if (!c.ok) fallas += 1;
    console.log(`${c.ok ? "  OK  " : " FALLA"}  ${c.nombre.padEnd(ancho)}  ${c.detalle}`);
  }
  console.log("");
  console.log(`Casos: ${casos.length}, fallidos: ${fallas}`);
  console.log("");

  if (fallas > 0) process.exit(1);

  console.log("VERIFICACIÓN LIMPIA contra el remoto.");
  console.log("");
  console.log("Sin comprobar aquí:");
  console.log("  · Que un usuario CON SESIÓN y sin rol de administrador no escriba. Lo de arriba");
  console.log("    prueba que anon no escribe y que no hay política de escritura para NADIE, que");
  console.log("    es más fuerte; intentarlo con una sesión de usuario exige autenticarse con");
  console.log("    esa cuenta, y eso necesita permiso explícito de Samuel.");
  console.log("  · Que el panel escriba de verdad: faltan la capa de lectura y la pantalla.");

}

void main();
