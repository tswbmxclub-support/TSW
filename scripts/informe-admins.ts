/**
 * Informe de la semilla de la migración 13: qué cuentas de auth.users quedaron
 * como administradores y en qué estado. Corre con la service role key.
 *
 *   npx tsx scripts/informe-admins.ts
 */
import { clienteServicio } from "./_comun";

async function main() {
  const supabase = clienteServicio();

  const { data: perfiles, error: errorPerfiles } = await supabase
    .from("perfil_admin")
    .select("id, nombre, activo, creado_en")
    .order("creado_en");
  if (errorPerfiles) {
    console.error("No se pudo leer perfil_admin:", errorPerfiles.message);
    process.exit(1);
  }

  const { data: usuarios, error: errorUsuarios } = await supabase.auth.admin.listUsers();
  if (errorUsuarios) {
    console.error("No se pudo leer auth.users:", errorUsuarios.message);
    process.exit(1);
  }

  const correoPorId = new Map(usuarios.users.map((u) => [u.id, u.email ?? "(sin correo)"]));

  console.log("\nAdministradores según la semilla de la migración 13:\n");
  console.log("ACTIVO  CREADO_EN                  CORREO");
  console.log("------  -------------------------  --------------------------------");

  let activos = 0;
  for (const p of perfiles ?? []) {
    const marca = p.activo ? "sí    " : "no    ";
    if (p.activo) activos += 1;
    const fecha = p.creado_en ? p.creado_en.slice(0, 19).replace("T", " ") : "—";
    console.log(`${marca}  ${fecha}  ${correoPorId.get(p.id) ?? "(usuario borrado de Auth)"}`);
  }

  console.log("");
  console.log(`Total: ${perfiles?.length ?? 0} administradores, ${activos} activos.`);

  const sinPerfil = usuarios.users.filter((u) => !(perfiles ?? []).some((p) => p.id === u.id));
  if (sinPerfil.length > 0) {
    console.log("");
    console.log("ATENCIÓN: cuentas de Auth sin fila de perfil (no entraron a la semilla):");
    for (const u of sinPerfil) console.log(`  - ${u.email ?? "(sin correo)"}`);
  }

  console.log("");
}

main();
