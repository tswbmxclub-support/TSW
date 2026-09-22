-- ---------------------------------------------------------------------------
-- TSW — 15. Alta explícita de administradores
--
-- Corrige una trampa silenciosa de la migración 13. El hook
-- `crear_perfil_al_registrar` decidía el tipo de perfil leyendo
-- `raw_app_meta_data->>'tipo'` en el INSERT de auth.users, y la Admin API de
-- GoTrue NO escribe app_metadata en ese INSERT: inserta la fila primero y la
-- actualiza después. Resultado medido el 2026-09-22 contra el proyecto real:
--
--     createUser({ app_metadata: { tipo: 'admin' } })
--       -> perfil_admin   : ninguna fila
--       -> perfil_usuario : la cuenta nueva
--
-- El administrador recién creado no aparecía en el panel, es_admin() devolvía
-- falso y al entrar recibía "Credenciales incorrectas." para siempre, sin un
-- solo error en ninguna capa. Dos cambios, uno principal y uno de red:
--
--   crear_perfil_admin(p_actor_id, p_id, p_nombre)   [camino principal]
--       Que una cuenta pase a ser administradora es una decisión con autor,
--       no un efecto colateral de un trigger leyendo metadatos que el
--       proveedor de Auth todavía no ha escrito. El panel la llama después de
--       createUser y el hecho queda en la bitácora con actor_id.
--       Idempotente: si el perfil ya existe no falla por clave duplicada.
--
--   crear_perfil_al_registrar()                      [red de seguridad]
--       Pasa a cubrir INSERT y UPDATE de raw_app_meta_data, de modo que
--       cualquier cuenta creada con tipo 'admin' termine con el perfil
--       correcto aunque nadie llame a la RPC. Sigue sin poder activar nada:
--       todo perfil nace con activo = false.
--
-- Las dos entradas comparten UNA implementación, conciliar_perfil_de_cuenta().
-- Si cada camino llevara su copia de las reglas, al tercer camino habría tres
-- versiones distintas de la misma decisión (mismo criterio que
-- transicionar_pedido y establecer_imagen_*).
--
-- ---------------------------------------------------------------------------
-- El caso de colisión, decidido y documentado
--
-- Una cuenta con perfil_usuario que después recibe tipo 'admin' no puede
-- acabar con fila en las dos tablas: el trigger de exclusividad de la
-- migración 13 lo impide, y con razón. Hay que elegir, y la elección depende
-- de si el perfil que estorba ya sirvió para algo:
--
--   · Perfil INACTIVO  -> se migra (se borra el perfil viejo y se crea el
--     nuevo). Un perfil inactivo nunca dio acceso a nadie: no hay sesión, ni
--     mensualidades, ni jersey colgando de él. Es además el caso normal de
--     nuestro propio flujo, porque el INSERT de GoTrue acaba de crear un
--     perfil_usuario desactivado un milisegundo antes.
--
--   · Perfil ACTIVO    -> se RECHAZA con mensaje en español. Migrar aquí
--     significaría borrar el perfil de una persona que sí usa el sistema y,
--     cuando lleguen las tablas de mensualidad y jersey colgadas de
--     perfil_usuario, arrastrar su historial de pagos por un ON DELETE
--     CASCADE. Un borrado silencioso de historial no puede ser el efecto
--     secundario de marcar una casilla: primero se desactiva el perfil a
--     mano, viéndolo, y entonces se convierte.
--
-- Rechazar dentro del trigger aborta la operación de Auth que lo disparó. Es
-- deliberado: convertir en administradora una cuenta de usuario viva es una
-- decisión que debe fallar a la cara, no a medias.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- conciliar_perfil_de_cuenta: la única copia de las reglas
-- ---------------------------------------------------------------------------

-- Interna: la llaman el hook de Auth y la RPC del panel, las dos SECURITY
-- DEFINER, así que corren como dueño y no necesitan privilegio propio. Se
-- revoca de TODOS los roles, service_role incluido: no es una operación del
-- panel, es el interior de dos operaciones del panel.
--
-- No lleva `lock table`: valida contra UNA fila identificada por p_id, no
-- contra el conjunto (la regla del lock vale para reordenar_niveles y
-- desactivar_admin, que cuentan filas antes de escribir). La carrera que sí
-- existe —dos altas simultáneas del mismo id— la cierra el ON CONFLICT.
create or replace function public.conciliar_perfil_de_cuenta(
  p_id     uuid,
  p_tipo   text,
  p_nombre text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activo boolean;
  v_nombre text;
begin
  if p_tipo not in ('admin', 'usuario') then
    raise exception 'Tipo de perfil desconocido: %. Solo hay admin y usuario.', p_tipo
      using errcode = 'check_violation';
  end if;

  -- El CHECK de las dos tablas exige nombre no vacío; un nombre en blanco
  -- reventaría el alta de la cuenta en Auth. Mejor un valor neutro, que el
  -- panel corrige después, que un registro fallido.
  v_nombre := coalesce(nullif(btrim(p_nombre), ''), 'sin nombre');

  if p_tipo = 'admin' then
    -- Ya es administrador: solo se refresca el nombre, y solo si cambió. Sin
    -- el `is distinct from` cada llamada repetida dejaría un evento de
    -- auditoría que no corresponde a ningún cambio real.
    if exists (select 1 from public.perfil_admin where id = p_id) then
      update public.perfil_admin
         set nombre = v_nombre
       where id = p_id
         and nombre is distinct from v_nombre;
      return;
    end if;

    select activo into v_activo from public.perfil_usuario where id = p_id;
    if found then
      if v_activo then
        raise exception 'La cuenta % tiene un perfil de usuario activo. Desactívalo desde el panel antes de convertirla en administradora: al convertirla se borra su perfil de usuario.', p_id
          using errcode = 'check_violation';
      end if;
      delete from public.perfil_usuario where id = p_id;
    end if;

    insert into public.perfil_admin (id, nombre)
    values (p_id, v_nombre)
    on conflict (id) do update set nombre = excluded.nombre;

  else
    if exists (select 1 from public.perfil_usuario where id = p_id) then
      update public.perfil_usuario
         set nombre = v_nombre
       where id = p_id
         and nombre is distinct from v_nombre;
      return;
    end if;

    select activo into v_activo from public.perfil_admin where id = p_id;
    if found then
      if v_activo then
        raise exception 'La cuenta % tiene un perfil de administrador activo. Desactívalo desde el panel antes de convertirla en cuenta de usuario.', p_id
          using errcode = 'check_violation';
      end if;
      delete from public.perfil_admin where id = p_id;
    end if;

    insert into public.perfil_usuario (id, nombre)
    values (p_id, v_nombre)
    on conflict (id) do update set nombre = excluded.nombre;
  end if;
end;
$$;

comment on function public.conciliar_perfil_de_cuenta(uuid, text, text) is
  'Deja a una cuenta de auth.users con exactamente un perfil, del tipo pedido, sin tocar `activo`. Si el perfil del otro tipo existe y está inactivo, lo migra; si está activo, rechaza. Interna: la usan el hook de Auth y crear_perfil_admin, nunca el panel directamente.';

revoke execute on function public.conciliar_perfil_de_cuenta(uuid, text, text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- crear_perfil_admin: el camino principal, con actor
-- ---------------------------------------------------------------------------

-- Convención de toda RPC de escritura del panel (migraciones 07, 11, 12 y 13):
-- primer parámetro p_actor_id, security definer, set search_path = public, la
-- primera sentencia es establecer_actor(), y solo service_role la ejecuta.
--
-- `activo` queda FUERA a propósito, igual que en guardar_perfil_admin: el
-- perfil nace desactivado y solo activar_admin lo enciende. Dar de alta y dar
-- acceso son dos decisiones, y se toman por separado.
create or replace function public.crear_perfil_admin(
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

  if p_id is null then
    raise exception 'Falta el identificador de la cuenta.'
      using errcode = 'check_violation';
  end if;

  if nullif(btrim(p_nombre), '') is null then
    raise exception 'El nombre no puede quedar vacío.'
      using errcode = 'check_violation';
  end if;

  -- La FK de perfil_admin ya lo garantizaría, pero su mensaje sale en inglés
  -- y con el nombre del constraint dentro: aquí se dice en español qué pasó.
  if not exists (select 1 from auth.users where id = p_id) then
    raise exception 'La cuenta % no existe en Auth. Créala antes de darle perfil de administrador.', p_id
      using errcode = 'foreign_key_violation';
  end if;

  perform public.conciliar_perfil_de_cuenta(p_id, 'admin', btrim(p_nombre));

  select * into v_fila from public.perfil_admin where id = p_id;
  return v_fila;
end;
$$;

comment on function public.crear_perfil_admin(uuid, uuid, text) is
  'Da perfil de administrador a una cuenta que ya existe en auth.users, dejando constancia del autor. Idempotente: si el perfil ya existe actualiza el nombre y no falla por clave duplicada. Nace inactivo: activar es un paso aparte, por activar_admin.';

revoke execute on function public.crear_perfil_admin(uuid, uuid, text) from public, anon, authenticated;
grant  execute on function public.crear_perfil_admin(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Hook de Auth: ahora también en el UPDATE de raw_app_meta_data
-- ---------------------------------------------------------------------------

-- Misma responsabilidad que en la migración 13 —toda cuenta nace con perfil y
-- siempre desactivada— con el momento corregido. El tipo se lee igual
-- (raw_app_meta_data->>'tipo'; sin valor, usuario), pero ya no se lee una sola
-- vez: si GoTrue escribe app_metadata en un UPDATE posterior, el perfil se
-- concilia entonces.
--
-- El nombre sigue saliendo de raw_user_meta_data->>'nombre' o de la parte
-- local del correo. En el UPDATE eso NO reescribe el nombre de un perfil ya
-- existente del tipo correcto salvo que haya cambiado, porque
-- conciliar_perfil_de_cuenta compara antes de escribir.
--
-- Un valor de `tipo` que no sea 'admin' ni 'usuario' se trata como 'usuario'
-- en vez de reventar: el hook corre dentro del alta de la cuenta en Auth, y
-- un dato basura en los metadatos no puede dejar a una persona sin cuenta.
create or replace function public.crear_perfil_al_registrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo        text;
  v_tipo_previo text;
  v_nombre      text;
begin
  v_tipo := coalesce(new.raw_app_meta_data ->> 'tipo', 'usuario');
  if v_tipo not in ('admin', 'usuario') then
    v_tipo := 'usuario';
  end if;

  -- En el UPDATE solo interesa el cambio de tipo. Sin esta salida temprana,
  -- cualquier escritura de app_metadata (GoTrue toca esa columna en varias
  -- operaciones) volvería a pasar por la conciliación sin nada que conciliar.
  if tg_op = 'UPDATE' then
    v_tipo_previo := coalesce(old.raw_app_meta_data ->> 'tipo', 'usuario');
    if v_tipo_previo not in ('admin', 'usuario') then
      v_tipo_previo := 'usuario';
    end if;
    if v_tipo is not distinct from v_tipo_previo then
      return new;
    end if;
  end if;

  v_nombre := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'nombre', '')), '');
  if v_nombre is null then
    v_nombre := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;
  if v_nombre is null then
    v_nombre := 'sin nombre';
  end if;

  perform public.conciliar_perfil_de_cuenta(new.id, v_tipo, v_nombre);

  return new;
end;
$$;

comment on function public.crear_perfil_al_registrar() is
  'Mantiene el perfil de cada cuenta de auth.users al día con raw_app_meta_data->>''tipo'' (sin valor: usuario), en el INSERT y en los UPDATE de esa columna, siempre con activo = false. Delega la decisión en conciliar_perfil_de_cuenta.';

-- El trigger se recrea: ALTER TRIGGER no puede añadir eventos. `update of
-- raw_app_meta_data` acota el disparo a las escrituras de esa columna; un
-- `after update` a secas correría en cada inicio de sesión, que actualiza
-- last_sign_in_at.
drop trigger if exists en_auth_users_crear_perfil on auth.users;

create trigger en_auth_users_crear_perfil
  after insert or update of raw_app_meta_data on auth.users
  for each row execute function public.crear_perfil_al_registrar();

-- CREATE OR REPLACE conserva los privilegios que tenía la función, así que la
-- revocación de la migración 14 sigue en pie. Se repite igualmente: que el
-- estado de permisos de una función se lea en el mismo archivo que su cuerpo
-- vale más que ahorrar dos líneas.
revoke execute on function public.crear_perfil_al_registrar() from public, anon, authenticated;
