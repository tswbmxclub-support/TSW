-- Galería de fotos por producto: tabla producto_imagen.
--
-- Hasta ahora un producto tenía UNA foto (producto.imagen_path, escrita solo
-- por establecer_imagen_producto, migración 12) y subir otra reemplazaba la
-- anterior. Las fotos cuelgan del PRODUCTO, no de la variante/talla.
--
-- Compatibilidad: la foto principal es la de orden 0. producto.imagen_path
-- queda como columna DERIVADA: las RPC de abajo la mantienen sincronizada con
-- esa foto para no romper lo que todavía la lee. Se retira en una migración
-- posterior. establecer_imagen_producto sigue existiendo pero el panel ya no
-- la usa: escribir imagen_path por ahí desincronizaría la galería.
--
-- Convención de las RPC nuevas (la de 20261010130000_endurecer_funciones):
-- security definer, `set search_path = ''` y TODO calificado (public.xxx),
-- establecer_actor() como primera sentencia, y EXECUTE solo para service_role.
-- Postgres da EXECUTE a PUBLIC por defecto y Supabase además a anon y
-- authenticated: por eso cada función lleva su REVOKE/GRANT, y eliminar_producto
-- los repite porque DROP + CREATE pierde los permisos que tenía.
--
-- Concurrencia del tope de 8: se bloquea la FILA del producto (FOR UPDATE)
-- antes de contar. Serializa las operaciones sobre las fotos de un mismo
-- producto sin bloquear la tabla entera. Vale porque todas las RPC que mueven
-- fotos pasan por ese mismo bloqueo; un INSERT directo no existe (sin
-- políticas de escritura).
--
-- UNIQUE (producto_id, orden) es INMEDIATO, no diferible (igual que
-- nivel_orden_unico): reordenar y compactar pasan por valores negativos
-- temporales, no por intercambio directo.

-- ---------------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------------

create table public.producto_imagen (
  id           uuid primary key default gen_random_uuid(),
  producto_id  uuid not null references public.producto (id) on delete cascade,
  storage_path text not null,
  texto_alt    text,
  orden        integer not null,
  creado_en    timestamptz not null default now(),
  constraint producto_imagen_ruta_unica unique (storage_path),
  constraint producto_imagen_orden_unico unique (producto_id, orden),
  constraint producto_imagen_alt_largo check (texto_alt is null or char_length(texto_alt) <= 200)
);

comment on table public.producto_imagen is
  'Galería del producto. orden 0 = foto principal (la del catálogo). Máximo 8 por producto, controlado en agregar_imagen_producto. Solo se escribe por RPC.';
comment on column public.producto_imagen.storage_path is
  'Ruta dentro del bucket productos (productos/{uuid}.{ext}). La URL pública la arma la aplicación.';
comment on column public.producto_imagen.texto_alt is
  'Texto alternativo de la foto (accesibilidad). NULL = la aplicación usa «Foto de <producto>».';

create trigger producto_imagen_auditoria
  after insert or update or delete on public.producto_imagen
  for each row execute function public.registrar_auditoria();

-- ---------------------------------------------------------------------------
-- RLS: lectura pública solo de fotos de productos activos; escritura solo RPC
-- ---------------------------------------------------------------------------

alter table public.producto_imagen enable row level security;

create policy producto_imagen_lectura_publica
  on public.producto_imagen for select to anon
  using (
    exists (
      select 1
        from public.producto p
       where p.id = producto_imagen.producto_id
         and p.activo
    )
  );

comment on policy producto_imagen_lectura_publica on public.producto_imagen is
  'Solo fotos de productos activos (mismo criterio que variante_lectura_publica).';

-- Nace exigiendo el segundo factor (migración 20261010120000): no usa es_admin().
create policy producto_imagen_lectura_admin
  on public.producto_imagen for select to authenticated
  using (public.es_admin_aal2());

-- Sin políticas de INSERT/UPDATE/DELETE: negación por defecto. Además se quitan
-- los privilegios de tabla que Supabase otorga por defecto; el panel escribe
-- con service role a través de las RPC.
revoke all on public.producto_imagen from public, anon, authenticated;
grant select on public.producto_imagen to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Migración de datos: cada imagen_path existente pasa a orden 0
-- ---------------------------------------------------------------------------

insert into public.producto_imagen (producto_id, storage_path, orden)
select id, imagen_path, 0
  from public.producto
 where imagen_path is not null;

-- ---------------------------------------------------------------------------
-- agregar_imagen_producto
-- ---------------------------------------------------------------------------

create function public.agregar_imagen_producto(
  p_actor_id    uuid,
  p_producto_id uuid,
  p_storage_path text,
  p_texto_alt   text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_id    uuid;
begin
  perform public.establecer_actor(p_actor_id);

  if p_storage_path is null
     or p_storage_path !~ '^productos/[0-9a-f-]{36}\.(jpg|png|webp|avif)$' then
    raise exception 'Ruta de imagen inválida.'
      using errcode = 'check_violation';
  end if;

  -- Serializa por producto ANTES de contar (ver cabecera).
  perform 1 from public.producto where id = p_producto_id for update;
  if not found then
    raise exception 'El producto % no existe.', p_producto_id
      using errcode = 'foreign_key_violation';
  end if;

  select count(*) into v_total
    from public.producto_imagen
   where producto_id = p_producto_id;

  if v_total >= 8 then
    raise exception 'Un producto admite como máximo 8 fotos. Quita una antes de agregar otra.'
      using errcode = 'check_violation';
  end if;

  insert into public.producto_imagen (producto_id, storage_path, texto_alt, orden)
  values (p_producto_id, p_storage_path, nullif(btrim(p_texto_alt), ''), v_total)
  returning id into v_id;
  -- v_total == siguiente orden: las posiciones siempre son 0..n-1 sin huecos
  -- (quitar compacta, reordenar reescribe la secuencia completa).

  update public.producto
     set imagen_path = (
           select storage_path from public.producto_imagen
            where producto_id = p_producto_id and orden = 0
         )
   where id = p_producto_id;

  return v_id;
end;
$$;

comment on function public.agregar_imagen_producto(uuid, uuid, text, text) is
  'Agrega una foto al final de la galería del producto (máximo 8) y mantiene producto.imagen_path igual a la de orden 0. Devuelve el id de la foto.';

revoke execute on function public.agregar_imagen_producto(uuid, uuid, text, text) from public, anon, authenticated;
grant  execute on function public.agregar_imagen_producto(uuid, uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- quitar_imagen_producto
-- ---------------------------------------------------------------------------

-- Devuelve la ruta para que la aplicación borre el archivo del bucket: la base
-- no toca Storage. Las fotos siguientes suben una posición (si se quita la
-- principal, la segunda pasa a ser la principal).
create function public.quitar_imagen_producto(
  p_actor_id uuid,
  p_id       uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_producto uuid;
  v_orden    integer;
  v_ruta     text;
begin
  perform public.establecer_actor(p_actor_id);

  select producto_id into v_producto
    from public.producto_imagen
   where id = p_id;
  if not found then
    raise exception 'La foto % no existe.', p_id
      using errcode = 'foreign_key_violation';
  end if;

  perform 1 from public.producto where id = v_producto for update;

  -- Se relee con el producto ya bloqueado: otra sesión pudo quitarla en medio.
  select orden, storage_path into v_orden, v_ruta
    from public.producto_imagen
   where id = p_id
   for update;
  if not found then
    raise exception 'La foto % no existe.', p_id
      using errcode = 'foreign_key_violation';
  end if;

  delete from public.producto_imagen where id = p_id;

  -- Compactar sin chocar con el UNIQUE inmediato: primero a negativos, después
  -- a su posición final (orden - 1).
  update public.producto_imagen
     set orden = -orden - 1
   where producto_id = v_producto and orden > v_orden;
  update public.producto_imagen
     set orden = -orden - 2
   where producto_id = v_producto and orden < 0;

  update public.producto
     set imagen_path = (
           select storage_path from public.producto_imagen
            where producto_id = v_producto and orden = 0
         )
   where id = v_producto;

  return v_ruta;
end;
$$;

comment on function public.quitar_imagen_producto(uuid, uuid) is
  'Quita una foto de la galería, compacta el orden y mantiene producto.imagen_path. Devuelve la ruta para que la aplicación borre el archivo del bucket.';

revoke execute on function public.quitar_imagen_producto(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.quitar_imagen_producto(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- reordenar_imagenes_producto
-- ---------------------------------------------------------------------------

-- Recibe la lista COMPLETA en el orden nuevo. Una lista parcial dejaría una
-- foto fuera con un orden que otra va a recibir.
create function public.reordenar_imagenes_producto(
  p_actor_id    uuid,
  p_producto_id uuid,
  p_ids         uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  perform public.establecer_actor(p_actor_id);

  perform 1 from public.producto where id = p_producto_id for update;
  if not found then
    raise exception 'El producto % no existe.', p_producto_id
      using errcode = 'foreign_key_violation';
  end if;

  select count(*) into v_total
    from public.producto_imagen
   where producto_id = p_producto_id;

  if array_length(p_ids, 1) is null then
    raise exception 'La lista de fotos está vacía.'
      using errcode = 'check_violation';
  end if;

  if array_length(p_ids, 1) <> v_total then
    raise exception 'La lista debe incluir todas las fotos del producto, ni más ni menos.'
      using errcode = 'check_violation';
  end if;

  if (select count(distinct x) from unnest(p_ids) as x) <> v_total then
    raise exception 'La lista de fotos tiene elementos repetidos o vacíos.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
      from unnest(p_ids) as x
     where not exists (
       select 1 from public.producto_imagen i
        where i.id = x and i.producto_id = p_producto_id
     )
  ) then
    raise exception 'La lista incluye fotos que no son de este producto.'
      using errcode = 'check_violation';
  end if;

  -- Paso 1: todas a negativos (-1..-n): sin choque entre sí ni con 0..n-1.
  update public.producto_imagen
     set orden = -orden - 1
   where producto_id = p_producto_id;

  -- Paso 2: posición final = posición en el arreglo, desde 0.
  update public.producto_imagen i
     set orden = n.pos - 1
    from unnest(p_ids) with ordinality as n(id, pos)
   where i.id = n.id and i.producto_id = p_producto_id;

  update public.producto
     set imagen_path = (
           select storage_path from public.producto_imagen
            where producto_id = p_producto_id and orden = 0
         )
   where id = p_producto_id;
end;
$$;

comment on function public.reordenar_imagenes_producto(uuid, uuid, uuid[]) is
  'Reescribe el orden de la galería con la lista completa de ids. Rechaza listas incompletas, repetidas o con fotos de otro producto. Mantiene producto.imagen_path.';

revoke execute on function public.reordenar_imagenes_producto(uuid, uuid, uuid[]) from public, anon, authenticated;
grant  execute on function public.reordenar_imagenes_producto(uuid, uuid, uuid[]) to service_role;

-- ---------------------------------------------------------------------------
-- establecer_texto_alt_imagen_producto
-- ---------------------------------------------------------------------------

-- RPC mínima: cambiar el texto alternativo no es guardar la galería.
create function public.establecer_texto_alt_imagen_producto(
  p_actor_id  uuid,
  p_id        uuid,
  p_texto_alt text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.establecer_actor(p_actor_id);

  update public.producto_imagen
     set texto_alt = nullif(btrim(p_texto_alt), '')
   where id = p_id;

  if not found then
    raise exception 'La foto % no existe.', p_id
      using errcode = 'foreign_key_violation';
  end if;
end;
$$;

comment on function public.establecer_texto_alt_imagen_producto(uuid, uuid, text) is
  'Fija el texto alternativo de una foto. Vacío = NULL (la aplicación usa «Foto de <producto>»).';

revoke execute on function public.establecer_texto_alt_imagen_producto(uuid, uuid, text) from public, anon, authenticated;
grant  execute on function public.establecer_texto_alt_imagen_producto(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- eliminar_producto: ahora devuelve TODAS las rutas
-- ---------------------------------------------------------------------------

-- Cambia el tipo de retorno (text -> text[]): hace falta DROP. Se pierden los
-- permisos, que se reaplican abajo. Sin cascade: nada depende de la función.
drop function public.eliminar_producto(uuid, uuid);

create function public.eliminar_producto(
  p_actor_id uuid,
  p_id       uuid
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_imagen text;
  v_rutas  text[];
begin
  perform public.establecer_actor(p_actor_id);

  select imagen_path into v_imagen
    from public.producto
   where id = p_id
   for update;

  if not found then
    raise exception 'El producto % no existe.', p_id
      using errcode = 'foreign_key_violation';
  end if;

  if exists (
    select 1
      from public.pedido_item i
      join public.variante v on v.id = i.variante_id
     where v.producto_id = p_id
  ) then
    raise exception 'Este producto ya tiene pedidos y no se puede eliminar. Desactívalo: deja de verse en la tienda y conserva su historial.'
      using errcode = 'restrict_violation';
  end if;

  v_rutas := array(
    select storage_path from public.producto_imagen
     where producto_id = p_id
     order by orden
  );
  -- Red: si imagen_path apuntara a un archivo que la galería no tiene, también se descarta.
  if v_imagen is not null and not (v_imagen = any (v_rutas)) then
    v_rutas := v_rutas || v_imagen;
  end if;

  delete from public.variante where producto_id = p_id;
  delete from public.producto where id = p_id;  -- producto_imagen cae en cascada

  return v_rutas;
end;
$$;

comment on function public.eliminar_producto(uuid, uuid) is
  'Elimina un producto y sus variantes solo si ninguna tiene pedidos. Devuelve las rutas de TODAS sus fotos (arreglo, posiblemente vacío) para que la aplicación borre los archivos.';

revoke execute on function public.eliminar_producto(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.eliminar_producto(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Aserción final: si algo no cuadra, la migración aborta entera
-- ---------------------------------------------------------------------------

do $$
declare
  v_malas   text;
  v_sin_mig integer;
begin
  -- 1. No se perdió ninguna foto en la migración de datos.
  select count(*) into v_sin_mig
    from public.producto p
   where p.imagen_path is not null
     and not exists (
       select 1 from public.producto_imagen i
        where i.producto_id = p.id and i.orden = 0 and i.storage_path = p.imagen_path
     );
  if v_sin_mig > 0 then
    raise exception '% producto(s) con imagen_path no pasaron a producto_imagen.', v_sin_mig;
  end if;

  -- 2. Ninguna de las 5 funciones es ejecutable por anon ni authenticated;
  --    service_role sí.
  select string_agg(f || ' (' || r || ')', ', ')
    into v_malas
    from (values
      ('public.agregar_imagen_producto(uuid, uuid, text, text)'),
      ('public.quitar_imagen_producto(uuid, uuid)'),
      ('public.reordenar_imagenes_producto(uuid, uuid, uuid[])'),
      ('public.establecer_texto_alt_imagen_producto(uuid, uuid, text)'),
      ('public.eliminar_producto(uuid, uuid)')
    ) as fn(f)
    cross join (values ('anon'), ('authenticated')) as rol(r)
   where has_function_privilege(rol.r, to_regprocedure(fn.f), 'execute');
  if v_malas is not null then
    raise exception 'Siguen ejecutables: %', v_malas;
  end if;

  if exists (
    select 1
      from (values
        ('public.agregar_imagen_producto(uuid, uuid, text, text)'),
        ('public.quitar_imagen_producto(uuid, uuid)'),
        ('public.reordenar_imagenes_producto(uuid, uuid, uuid[])'),
        ('public.establecer_texto_alt_imagen_producto(uuid, uuid, text)'),
        ('public.eliminar_producto(uuid, uuid)')
      ) as fn(f)
     where not has_function_privilege('service_role', to_regprocedure(fn.f), 'execute')
  ) then
    raise exception 'service_role perdió EXECUTE en alguna RPC de fotos: el panel no podría usarlas.';
  end if;

  -- 3. search_path fijo y vacío en las 5.
  if exists (
    select 1 from pg_proc p
     where p.oid in (
       'public.agregar_imagen_producto(uuid, uuid, text, text)'::regprocedure,
       'public.quitar_imagen_producto(uuid, uuid)'::regprocedure,
       'public.reordenar_imagenes_producto(uuid, uuid, uuid[])'::regprocedure,
       'public.establecer_texto_alt_imagen_producto(uuid, uuid, text)'::regprocedure,
       'public.eliminar_producto(uuid, uuid)'::regprocedure
     )
       and not coalesce(p.proconfig, '{}') @> array['search_path=""']
  ) then
    raise exception 'search_path no quedó fijado en '''' en alguna RPC de fotos.';
  end if;

  -- 4. RLS activo; ninguna política de escritura; las de authenticated exigen aal2.
  if not (select relrowsecurity from pg_class where oid = 'public.producto_imagen'::regclass) then
    raise exception 'producto_imagen sin RLS.';
  end if;

  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'producto_imagen'
       and cmd <> 'SELECT'
  ) then
    raise exception 'producto_imagen tiene una política de escritura: solo se escribe por RPC.';
  end if;

  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'producto_imagen'
       and roles::text[] && array['authenticated', 'public']
       and coalesce(qual, '') not like '%es_admin_aal2()%'
  ) then
    raise exception 'Una política de producto_imagen para authenticated no exige es_admin_aal2().';
  end if;

  -- 5. anon no puede escribir por privilegios de tabla.
  if has_table_privilege('anon', 'public.producto_imagen', 'insert,update,delete')
     or has_table_privilege('authenticated', 'public.producto_imagen', 'insert,update,delete') then
    raise exception 'anon o authenticated conservan privilegios de escritura sobre producto_imagen.';
  end if;
end
$$;
