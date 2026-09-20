-- ---------------------------------------------------------------------------
-- TSW — 13. Perfiles de administrador y de usuario
--
-- Hasta hoy "tener sesión es ser administrador": las políticas *_admin de la
-- migración 08 usaban using (true) para authenticated porque había un solo
-- usuario en el sistema. Con el cambio de alcance (corporación con varios
-- deportes) eso deja de valer: hay dos poblaciones de cuentas y ninguna puede
-- valer por la otra.
--
-- Lo que hace esta migración, en un solo archivo a propósito —tablas y
-- políticas no pueden desincronizarse ni un despliegue—:
--
--   perfil_admin / perfil_usuario
--       El perfil vive aparte de auth.users (el correo sigue en Auth, se lee
--       por JOIN). Nacen con activo = false: nadie entra sin que un
--       administrador existente lo active.
--
--   Exclusividad
--       Un id no puede existir en las dos tablas a la vez: una cuenta es
--       administrador o usuario, nunca las dos. El control vive en trigger
--       sobre las tablas, no en las RPC, para que ningún camino de escritura
--       futuro pueda saltárselo.
--
--   es_admin() / es_usuario()
--       Los bloques con los que RLS distingue poblaciones. SECURITY DEFINER
--       por necesidad, no por comodidad: la política de perfil_admin consulta
--       perfil_admin, y una política que lee su propia tabla con una función
--       INVOKER recursa hasta el error de Postgres.
--
--   Reescritura de las políticas *_admin de la migración 08
--       Mismos nombres, mismos comentarios; using/with check pasan de (true)
--       a (public.es_admin()). A partir de aquí un usuario autenticado sin
--       perfil de administrador activo no toca nada del panel.
--
--   registrar_auditoria
--       Recorta 'nombre' y 'telefono' SOLO cuando la tabla es un perfil: en
--       producto y nivel, `nombre` es contenido del catálogo y la bitácora
--       necesita conservarlo para contar qué cambió. Decisión aprobada en la
--       sesión del 2026-09-20 (opción A).
--
--   RPC de perfiles
--       Misma convención que el resto del panel: primer parámetro p_actor_id,
--       security definer, search_path = public, y solo service_role puede
--       ejecutarlas. desactivar_admin lleva las dos salvaguardas (nadie se
--       desactiva a sí mismo; no se desactiva al último activo) con lock de
--       tabla antes de contar.
--
-- Semilla: cada usuario que ya existe en auth.users recibe perfil_admin
-- activo, salvo los correos de verificación (@tsw-verificacion.com). Los
-- usuarios que lleguen después nacen desactivados por el trigger del hook.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.perfil_admin (
  -- El correo no se copia: vive en auth.users y se lee por JOIN.
  id             uuid primary key references auth.users (id) on delete cascade,
  nombre         text not null,
  activo         boolean not null default false,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint perfil_admin_nombre_no_vacio check (length(btrim(nombre)) > 0)
);

comment on table public.perfil_admin is
  'Perfil de una cuenta de administrador del panel. La cuenta vive en auth.users; aquí vive solo lo que el sistema necesita saber de la persona: nombre y si está activa.';
comment on column public.perfil_admin.nombre is
  'Nombre para mostrar en el panel y en la bitácora. Dato personal (Ley 1581): la bitácora lo recorta de antes/después.';
comment on column public.perfil_admin.activo is
  'Nace en false: las credenciales existen pero no dan acceso hasta que otro administrador active el perfil. Desactivar es la forma de revocar acceso sin borrar la cuenta de Auth.';
comment on column public.perfil_admin.creado_en is
  'Momento en que se creó la fila del perfil.';
comment on column public.perfil_admin.actualizado_en is
  'Última modificación de la fila, mantenida por set_actualizado_en().';

create table public.perfil_usuario (
  -- El correo no se copia: vive en auth.users y se lee por JOIN.
  id             uuid primary key references auth.users (id) on delete cascade,
  nombre         text not null,
  telefono       text,
  activo         boolean not null default false,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint perfil_usuario_nombre_no_vacio check (length(btrim(nombre)) > 0),
  constraint perfil_usuario_telefono_no_vacio check (telefono is null or length(btrim(telefono)) > 0)
);

comment on table public.perfil_usuario is
  'Perfil de la cuenta del titular de una matrícula: el acudiente o el deportista adulto. Los deportistas menores, las mensualidades y los jerseys llegan en migraciones posteriores y referencian esta fila.';
comment on column public.perfil_usuario.nombre is
  'Nombre del titular. Dato personal (Ley 1581): la bitácora lo recorta de antes/después.';
comment on column public.perfil_usuario.telefono is
  'Teléfono de contacto del titular. Opcional. Dato personal (Ley 1581): la bitácora lo recorta de antes/después.';
comment on column public.perfil_usuario.activo is
  'Nace en false: un administrador debe activar la cuenta antes de que sirva para entrar a /cuenta.';
comment on column public.perfil_usuario.creado_en is
  'Momento en que se creó la fila del perfil.';
comment on column public.perfil_usuario.actualizado_en is
  'Última modificación de la fila, mantenida por set_actualizado_en().';

create trigger perfil_admin_actualizado_en
  before update on public.perfil_admin
  for each row execute function public.set_actualizado_en();

create trigger perfil_usuario_actualizado_en
  before update on public.perfil_usuario
  for each row execute function public.set_actualizado_en();

-- ---------------------------------------------------------------------------
-- Exclusividad: una cuenta es administrador o usuario, nunca las dos
-- ---------------------------------------------------------------------------

-- Vive en trigger sobre las tablas, no en las RPC: si mañana aparece un tercer
-- camino de escritura, la base lo para sola (mismo criterio que la invariante
-- de fotos de menores). El DELETE no se controla: borrar una membresía nunca
-- crea duplicados, y si algún estado anómalo dejara un id en las dos tablas,
-- el borrado es justamente la salida.
create or replace function public.validar_exclusividad_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_otra text;
begin
  if tg_table_name = 'perfil_admin' then
    if exists (select 1 from public.perfil_usuario where id = new.id) then
      v_otra := 'perfil_usuario';
    end if;
  else
    if exists (select 1 from public.perfil_admin where id = new.id) then
      v_otra := 'perfil_admin';
    end if;
  end if;

  if v_otra is not null then
    raise exception 'El id % ya tiene perfil en %: una cuenta es administradora o usuaria, nunca las dos.', new.id, v_otra
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.validar_exclusividad_perfil() is
  'Impide que un mismo id de auth.users tenga fila en perfil_admin y perfil_usuario a la vez. Dispara en INSERT y UPDATE; el DELETE queda libre a propósito.';

create trigger perfil_admin_exclusividad
  before insert or update on public.perfil_admin
  for each row execute function public.validar_exclusividad_perfil();

create trigger perfil_usuario_exclusividad
  before insert or update on public.perfil_usuario
  for each row execute function public.validar_exclusividad_perfil();

-- ---------------------------------------------------------------------------
-- es_admin() / es_usuario()
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER es requisito técnico, no un lujo: la política de lectura de
-- perfil_admin llama a esta función, que lee perfil_admin. Con SECURITY
-- INVOKER la subconsulta volvería a pasar por RLS de perfil_admin y Postgres
-- aborta con "infinite recursion detected in policy". Al correr como dueño
-- (postgres, sin FORCE ROW LEVEL SECURITY según la migración 08) la lectura
-- interna salta RLS y la recursión no existe.
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.perfil_admin
     where id = auth.uid()
       and activo
  );
$$;

comment on function public.es_admin() is
  'Verdad si el usuario de la sesión tiene un perfil de administrador activo. Es el bloque con el que RLS distingue al administrador de cualquier otra cuenta autenticada.';

create or replace function public.es_usuario()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.perfil_usuario
     where id = auth.uid()
       and activo
  );
$$;

comment on function public.es_usuario() is
  'Verdad si el usuario de la sesión tiene un perfil de usuario (titular de matrícula) activo. La usarán las políticas de mensualidades y jerseys cuando lleguen.';

-- Ejecutables por authenticated: son las piezas que las políticas evalúan.
-- Para anon no aportan nada (auth.uid() es NULL) y no se exponen.
revoke execute on function public.es_admin()    from public, anon;
revoke execute on function public.es_usuario() from public, anon;
grant execute on function public.es_admin()    to authenticated, service_role;
grant execute on function public.es_usuario() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS de las dos tablas nuevas
-- ---------------------------------------------------------------------------

alter table public.perfil_admin   enable row level security;
alter table public.perfil_usuario enable row level security;

-- Grants coherentes con la migración 10: se parte de cero y solo entra lo que
-- una política habilita. Lectura; ninguna escritura para roles del navegador.
revoke all on public.perfil_admin   from anon, authenticated;
revoke all on public.perfil_usuario from anon, authenticated;

grant select on public.perfil_admin   to authenticated;
grant select on public.perfil_usuario to authenticated;

-- Sin política de escritura para anon ni authenticated: las RPC corren con
-- service_role (BYPASSRLS) y el hook de Auth es security definer. Un usuario
-- del navegador no se autocrea ni se autoactiva el perfil, por diseño.
create policy perfil_admin_lectura_admin
  on public.perfil_admin for select to authenticated
  using (public.es_admin());

comment on policy perfil_admin_lectura_admin on public.perfil_admin is
  'Solo un administrador activo consulta la lista de administradores. No existe política de escritura para ningún rol del navegador: todo va por RPC con service_role.';

create policy perfil_usuario_lectura
  on public.perfil_usuario for select to authenticated
  using (public.es_admin() or id = auth.uid());

comment on policy perfil_usuario_lectura on public.perfil_usuario is
  'Un administrador ve todos los usuarios; un usuario ve solo su propia fila. No existe política de escritura para ningún rol del navegador: todo va por RPC con service_role.';

-- ---------------------------------------------------------------------------
-- Reescritura de las políticas *_admin de la migración 08
--
-- Mismos nombres, mismos comentarios. Cambia using (true) / with check (true)
-- por public.es_admin(): de "cualquier autenticado es administrador" a "es
-- administrador quien tiene perfil_admin con activo = true". Las políticas de
-- lectura pública (rol anon) de esa migración no se tocan.
-- ---------------------------------------------------------------------------

drop policy if exists producto_admin on public.producto;
create policy producto_admin
  on public.producto for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists variante_admin on public.variante;
create policy variante_admin
  on public.variante for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists nivel_admin on public.nivel;
create policy nivel_admin
  on public.nivel for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists documento_admin on public.documento;
create policy documento_admin
  on public.documento for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists documento_version_admin on public.documento_version;
create policy documento_version_admin
  on public.documento_version for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists competencia_admin on public.competencia;
create policy competencia_admin
  on public.competencia for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists resultado_admin on public.resultado;
create policy resultado_admin
  on public.resultado for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Tres políticas en vez de una FOR ALL, igual que en la migración 08, para que
-- la ausencia de INSERT siga siendo explícita.
drop policy if exists pedido_lectura_admin on public.pedido;
create policy pedido_lectura_admin
  on public.pedido for select to authenticated
  using (public.es_admin());

comment on policy pedido_lectura_admin on public.pedido is
  'El panel consulta pedidos. Crearlos es tarea del checkout público, que corre con service role.';

drop policy if exists pedido_actualizacion_admin on public.pedido;
create policy pedido_actualizacion_admin
  on public.pedido for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists pedido_borrado_admin on public.pedido;
create policy pedido_borrado_admin
  on public.pedido for delete to authenticated
  using (public.es_admin());

drop policy if exists pedido_item_admin on public.pedido_item;
create policy pedido_item_admin
  on public.pedido_item for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists transaccion_admin on public.transaccion;
create policy transaccion_admin
  on public.transaccion for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists evento_auditoria_lectura_admin on public.evento_auditoria;
create policy evento_auditoria_lectura_admin
  on public.evento_auditoria for select to authenticated
  using (public.es_admin());

comment on policy evento_auditoria_lectura_admin on public.evento_auditoria is
  'El administrador consulta la bitácora. No existe política de escritura para ningún rol del navegador.';

-- ---------------------------------------------------------------------------
-- registrar_auditoria: recorte de datos personales acotado a perfiles
-- ---------------------------------------------------------------------------

-- Misma función de la migración 06, con una ampliación decidida en la sesión
-- del 2026-09-20: 'nombre' y 'telefono' se recortan SOLO cuando la tabla es un
-- perfil. El recorte global descartado habría borrado también el nombre de
-- productos y niveles, que es contenido del catálogo y parte de lo que la
-- bitácora debe contar. Los compradores siguen recortándose siempre
-- (comprador_nombre, comprador_email, comprador_telefono).
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes      jsonb;
  v_despues    jsonb;
  v_accion     public.accion_auditoria;
  v_actor      uuid;
  v_entidad_id uuid;
  v_estado_anterior text;
  v_estado_nuevo    text;
begin
  v_antes   := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_despues := case when tg_op = 'DELETE' then null else to_jsonb(new) end;

  -- Ley 1581 de 2012 (habeas data): la bitácora nunca se borra, así que no es
  -- lugar para conservar indefinidamente los datos de contacto del comprador.
  -- Se recortan antes de guardar; el dato vivo sigue en `pedido` el tiempo que
  -- deba estar.
  --
  -- `payload_json` de transaccion también se recorta: el evento crudo de Wompi
  -- ya está guardado en su propia fila y duplicarlo aquí solo infla la tabla.
  --
  -- En las tablas que no tienen estas columnas, el operador `-` sobre jsonb
  -- simplemente no encuentra la clave y no hace nada.
  v_antes := v_antes
    - 'comprador_nombre' - 'comprador_email' - 'comprador_telefono'
    - 'payload_json';
  v_despues := v_despues
    - 'comprador_nombre' - 'comprador_email' - 'comprador_telefono'
    - 'payload_json';

  -- Datos personales de perfiles (Ley 1581): nombre y teléfono de
  -- perfil_admin/perfil_usuario no entran a la bitácora. El actor ya queda
  -- identificado por actor_id; el antes/después de una fila de perfil no
  -- necesita repetir quién es la persona.
  if tg_table_name in ('perfil_admin', 'perfil_usuario') then
    v_antes := v_antes - 'nombre' - 'telefono';
    v_despues := v_despues - 'nombre' - 'telefono';
  end if;

  -- En un DELETE la fila nueva no existe, así que el id sale de la vieja.
  v_entidad_id := coalesce(v_despues ->> 'id', v_antes ->> 'id')::uuid;

  -- Actor: primero la variable de sesión que fija establecer_actor(), después
  -- el JWT. Las escrituras van con la service role key, que no lleva `sub`, así
  -- que sin la variable de sesión el actor se pierde. Por eso toda operación
  -- administrativa entra por una RPC que llama a establecer_actor() primero.
  begin
    v_actor := coalesce(
      nullif(current_setting('app.actor_id', true), '')::uuid,
      auth.uid()
    );
  exception when others then
    v_actor := null;
  end;

  if tg_op = 'INSERT' then
    v_accion := 'crear';
  elsif tg_op = 'DELETE' then
    v_accion := 'eliminar';
  else
    v_estado_anterior := v_antes ->> 'estado';
    v_estado_nuevo    := v_despues ->> 'estado';

    if v_estado_nuevo is distinct from v_estado_anterior then
      -- La tabla tiene columna `estado` y cambió: se nombra el hecho, no el
      -- UPDATE genérico.
      v_accion := case v_estado_nuevo
        when 'publicado' then 'publicar'::public.accion_auditoria
        when 'archivado' then 'archivar'::public.accion_auditoria
        else 'cambiar_estado'::public.accion_auditoria
      end;
    elsif (v_antes ->> 'archivado_en') is null
      and (v_despues ->> 'archivado_en') is not null then
      -- Caso de documento_version, que archiva con fecha y no con estado.
      v_accion := 'archivar';
    else
      v_accion := 'actualizar';
    end if;
  end if;

  insert into public.evento_auditoria (
    actor_id, accion, entidad, entidad_id, antes_json, despues_json
  ) values (
    v_actor,
    v_accion,
    tg_table_name,
    v_entidad_id,
    v_antes,
    v_despues
  );

  return coalesce(new, old);
end;
$$;

comment on function public.registrar_auditoria() is
  'Trigger AFTER INSERT/UPDATE/DELETE genérico. Deduce el verbo del cambio de estado, recorta los datos de contacto del comprador (Ley 1581 de 2012), recorta nombre y telefono en las tablas de perfiles, y el payload crudo de Wompi, y guarda la fila antes y después.';

-- La gestión de perfiles queda trazada: quién creó, activó, desactivó o
-- editó qué perfil, con actor_id y sin datos personales en antes/después.
create trigger perfil_admin_auditoria
  after insert or update or delete on public.perfil_admin
  for each row execute function public.registrar_auditoria();

create trigger perfil_usuario_auditoria
  after insert or update or delete on public.perfil_usuario
  for each row execute function public.registrar_auditoria();

-- ---------------------------------------------------------------------------
-- Hook de Auth: todo usuario nuevo nace con perfil, siempre desactivado
-- ---------------------------------------------------------------------------

-- Dispara con cada INSERT en auth.users. El tipo sale de
-- raw_app_meta_data->>'tipo' ('admin' o 'usuario'); sin valor, es usuario:
-- crear una cuenta de administrador exige pasar explícitamente por la Admin
-- API con app_metadata, algo que ningún flujo público hace por accidente.
-- Siempre activo = false: las credenciales no dan acceso hasta que un
-- administrador existente active el perfil.
create or replace function public.crear_perfil_al_registrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo   text;
  v_nombre text;
begin
  v_tipo := coalesce(new.raw_app_meta_data ->> 'tipo', 'usuario');

  v_nombre := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'nombre', '')), '');
  if v_nombre is null then
    v_nombre := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;
  -- Un nombre vacío rompería el CHECK de la tabla y con él el registro del
  -- usuario en Auth: mejor un valor neutro que un registro fallido.
  if v_nombre is null then
    v_nombre := 'sin nombre';
  end if;

  if v_tipo = 'admin' then
    insert into public.perfil_admin (id, nombre)
    values (new.id, v_nombre)
    on conflict (id) do nothing;
  else
    insert into public.perfil_usuario (id, nombre)
    values (new.id, v_nombre)
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

comment on function public.crear_perfil_al_registrar() is
  'Al registrarse un usuario en auth.users crea su fila de perfil según raw_app_meta_data->>''tipo'' (sin valor: usuario), siempre con activo = false. El nombre inicial sale de raw_user_meta_data->>''nombre'' o de la parte local del correo.';

create trigger en_auth_users_crear_perfil
  after insert on auth.users
  for each row execute function public.crear_perfil_al_registrar();

-- ---------------------------------------------------------------------------
-- Semilla: perfiles de administrador para los usuarios que ya existen
-- ---------------------------------------------------------------------------

-- Cada usuario existente de Auth (salvo los de verificación) queda como
-- administrador ACTIVO: es la única forma de que el panel no quede sin puerta
-- al aplicar esta migración. Los que lleguen después nacen desactivados por el
-- hook de arriba. Idempotente: si la migración se reaplica por reparación, el
-- ON CONFLICT no duplica ni sobreescribe.
insert into public.perfil_admin (id, nombre, activo)
select
  u.id,
  coalesce(
    nullif(btrim(coalesce(u.raw_user_meta_data ->> 'nombre', '')), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'sin nombre'
  ),
  true
  from auth.users u
 where u.email is null
    or lower(u.email) not like '%@tsw-verificacion.com'
on conflict (id) do nothing;

comment on constraint perfil_admin_nombre_no_vacio on public.perfil_admin is
  'El nombre de un administrador no puede quedar vacío ni en espacios.';
comment on constraint perfil_usuario_nombre_no_vacio on public.perfil_usuario is
  'El nombre del titular no puede quedar vacío ni en espacios.';
comment on constraint perfil_usuario_telefono_no_vacio on public.perfil_usuario is
  'Si el teléfono viene, no puede quedar vacío ni en espacios; si no viene, es NULL.';

-- ---------------------------------------------------------------------------
-- RPC de perfiles
--
-- Convención de toda RPC de escritura del panel (migraciones 07, 11 y 12):
-- primer parámetro p_actor_id, security definer, set search_path = public,
-- la primera línea es establecer_actor(), y solo service_role puede
-- ejecutarlas. Ninguna escritura al panel va directo a las tablas.
-- ---------------------------------------------------------------------------

-- --- guardar_perfil_admin ---------------------------------------------------

create or replace function public.guardar_perfil_admin(
  p_actor_id uuid,
  p_id       uuid,
  p_nombre   text
)
returns public.perfil_admin
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fila public.perfil_admin;
begin
  perform public.establecer_actor(p_actor_id);

  if nullif(btrim(p_nombre), '') is null then
    raise exception 'El nombre no puede quedar vacío.'
      using errcode = 'check_violation';
  end if;

  update public.perfil_admin
     set nombre = btrim(p_nombre)
   where id = p_id
  returning * into v_fila;

  if not found then
    raise exception 'El administrador % no existe.', p_id
      using errcode = 'foreign_key_violation';
  end if;

  return v_fila;
end;
$$;

comment on function public.guardar_perfil_admin(uuid, uuid, text) is
  'Cambia el nombre para mostrar de un administrador dejando constancia del autor. activo no se toca aquí: va por activar_admin y desactivar_admin.';

revoke execute on function public.guardar_perfil_admin(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.guardar_perfil_admin(uuid, uuid, text) to service_role;

-- --- activar_admin -----------------------------------------------------------

create or replace function public.activar_admin(
  p_actor_id uuid,
  p_id       uuid
)
returns public.perfil_admin
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activo boolean;
  v_fila   public.perfil_admin;
begin
  perform public.establecer_actor(p_actor_id);

  select activo into v_activo
    from public.perfil_admin
   where id = p_id;

  if not found then
    raise exception 'El administrador % no existe.', p_id
      using errcode = 'foreign_key_violation';
  end if;

  if v_activo then
    raise exception 'El administrador ya está activo.'
      using errcode = 'check_violation';
  end if;

  update public.perfil_admin
     set activo = true
   where id = p_id
  returning * into v_fila;

  -- La fila existe (comprobado arriba); el guardia es la regla de la casa:
  -- ningún INTO sin su IF NOT FOUND.
  if not found then
    raise exception 'El administrador % no existe.', p_id
      using errcode = 'foreign_key_violation';
  end if;

  return v_fila;
end;
$$;

comment on function public.activar_admin(uuid, uuid) is
  'Activa el perfil de un administrador: a partir de aquí sus credenciales dan acceso al panel. Única puerta de entrada, siempre decidida por otro administrador.';

revoke execute on function public.activar_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.activar_admin(uuid, uuid) to service_role;

-- --- desactivar_admin --------------------------------------------------------

-- Las dos salvaguardas viven aquí y no en la aplicación: nadie se desactiva a
-- sí mismo y no se desactiva al último administrador activo. El conteo es una
-- validación sobre el CONJUNTO de filas, así que va lock table in share row
-- exclusive mode inmediatamente después de establecer_actor y antes de
-- cualquier lectura: select … for update no basta, porque no impide el INSERT
-- concurrente de un administrador nuevo mientras se cuenta.
create or replace function public.desactivar_admin(
  p_actor_id uuid,
  p_id       uuid
)
returns public.perfil_admin
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activos integer;
  v_activo  boolean;
  v_fila    public.perfil_admin;
begin
  perform public.establecer_actor(p_actor_id);

  -- Bloqueo de tabla antes de leer: lo que se cuenta abajo es el conjunto que
  -- se va a reescribir. SHARE ROW EXCLUSIVE frena INSERT, UPDATE y DELETE
  -- ajenos hasta el COMMIT sin bloquear las lecturas.
  lock table public.perfil_admin in share row exclusive mode;

  -- Salvaguarda 1: nadie se desactiva a sí mismo (sería dejar el panel sin
  -- la propia llave, con o sin otros administradores).
  if p_id = p_actor_id then
    raise exception 'No puedes desactivar tu propia cuenta de administrador.'
      using errcode = 'check_violation';
  end if;

  select activo into v_activo
    from public.perfil_admin
   where id = p_id;

  if not found then
    raise exception 'El administrador % no existe.', p_id
      using errcode = 'foreign_key_violation';
  end if;

  if not v_activo then
    raise exception 'El administrador ya está desactivado.'
      using errcode = 'check_violation';
  end if;

  -- Salvaguarda 2: no se desactiva al último administrador activo. Ya se sabe
  -- que el objetivo está activo, así que uno de los activos es él: si hay uno
  -- o menos, desactivarlo dejaría el panel sin nadie.
  select count(*) into v_activos
    from public.perfil_admin
   where activo;

  if v_activos <= 1 then
    raise exception 'No se puede desactivar al último administrador activo. Activa otro administrador primero.'
      using errcode = 'check_violation';
  end if;

  update public.perfil_admin
     set activo = false
   where id = p_id
  returning * into v_fila;

  if not found then
    raise exception 'El administrador % no existe.', p_id
      using errcode = 'foreign_key_violation';
  end if;

  return v_fila;
end;
$$;

comment on function public.desactivar_admin(uuid, uuid) is
  'Revoca el acceso al panel de un administrador sin borrar su cuenta de Auth. Rechaza desactivarse a sí mismo y desactivar al último activo; el conteo corre bajo lock table in share row exclusive mode.';

revoke execute on function public.desactivar_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.desactivar_admin(uuid, uuid) to service_role;

-- --- guardar_perfil_usuario --------------------------------------------------

create or replace function public.guardar_perfil_usuario(
  p_actor_id uuid,
  p_id       uuid,
  p_nombre   text,
  p_telefono text
)
returns public.perfil_usuario
language plpgsql
security definer
set search_path = public
as $$
declare
  v_telefono text;
  v_fila     public.perfil_usuario;
begin
  perform public.establecer_actor(p_actor_id);

  if nullif(btrim(p_nombre), '') is null then
    raise exception 'El nombre no puede quedar vacío.'
      using errcode = 'check_violation';
  end if;

  -- Un teléfono en blanco es "sin teléfono": NULL, no cadena vacía.
  v_telefono := nullif(btrim(p_telefono), '');

  update public.perfil_usuario
     set nombre   = btrim(p_nombre),
         telefono = v_telefono
   where id = p_id
  returning * into v_fila;

  if not found then
    raise exception 'El usuario % no existe.', p_id
      using errcode = 'foreign_key_violation';
  end if;

  return v_fila;
end;
$$;

comment on function public.guardar_perfil_usuario(uuid, uuid, text, text) is
  'Cambia nombre y teléfono del titular de una matrícula dejando constancia del autor. activo no se toca aquí: va por activar_usuario y desactivar_usuario.';

revoke execute on function public.guardar_perfil_usuario(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.guardar_perfil_usuario(uuid, uuid, text, text) to service_role;

-- --- activar_usuario ---------------------------------------------------------

create or replace function public.activar_usuario(
  p_actor_id uuid,
  p_id       uuid
)
returns public.perfil_usuario
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activo boolean;
  v_fila   public.perfil_usuario;
begin
  perform public.establecer_actor(p_actor_id);

  select activo into v_activo
    from public.perfil_usuario
   where id = p_id;

  if not found then
    raise exception 'El usuario % no existe.', p_id
      using errcode = 'foreign_key_violation';
  end if;

  if v_activo then
    raise exception 'El usuario ya está activo.'
      using errcode = 'check_violation';
  end if;

  update public.perfil_usuario
     set activo = true
   where id = p_id
  returning * into v_fila;

  if not found then
    raise exception 'El usuario % no existe.', p_id
      using errcode = 'foreign_key_violation';
  end if;

  return v_fila;
end;
$$;

comment on function public.activar_usuario(uuid, uuid) is
  'Activa el perfil de un usuario (titular de matrícula): sus credenciales pasan a servir en /cuenta. Única puerta de entrada, decidida por un administrador.';

revoke execute on function public.activar_usuario(uuid, uuid) from public, anon, authenticated;
grant execute on function public.activar_usuario(uuid, uuid) to service_role;

-- --- desactivar_usuario ------------------------------------------------------

create or replace function public.desactivar_usuario(
  p_actor_id uuid,
  p_id       uuid
)
returns public.perfil_usuario
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activo boolean;
  v_fila   public.perfil_usuario;
begin
  perform public.establecer_actor(p_actor_id);

  select activo into v_activo
    from public.perfil_usuario
   where id = p_id;

  if not found then
    raise exception 'El usuario % no existe.', p_id
      using errcode = 'foreign_key_violation';
  end if;

  if not v_activo then
    raise exception 'El usuario ya está desactivado.'
      using errcode = 'check_violation';
  end if;

  update public.perfil_usuario
     set activo = false
   where id = p_id
  returning * into v_fila;

  if not found then
    raise exception 'El usuario % no existe.', p_id
      using errcode = 'foreign_key_violation';
  end if;

  return v_fila;
end;
$$;

comment on function public.desactivar_usuario(uuid, uuid) is
  'Revoca el acceso a /cuenta de un titular sin borrar su cuenta de Auth ni sus datos de matrícula.';

revoke execute on function public.desactivar_usuario(uuid, uuid) from public, anon, authenticated;
grant execute on function public.desactivar_usuario(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Nota de alcance
--
-- Esta migración NO crea las tablas de deportistas menores, mensualidades ni
-- jerseys: llegan en migraciones posteriores y referencian perfil_usuario.
-- Tampoco toca las políticas de lectura pública (rol anon) de la migración 08,
-- ni los grants de las tablas existentes, que siguen siendo válidos: lo que
-- cambia no es quién puede tocar las tablas, sino qué cuenta autenticada pasa
-- la política.
-- ---------------------------------------------------------------------------
