-- ---------------------------------------------------------------------------
-- TSW — 17. Clubes y programas
--
-- La corporación no es una escuela: agrupa BMX Club TSW, BMX Mastercross y el
-- Programa de Habilidades Motrices, y el cliente anticipa clubes de otros
-- deportes. Todo lo que el sitio muestra por club —niveles, productos,
-- identidad— cuelga de aquí.
--
-- ---------------------------------------------------------------------------
-- Las tres decisiones que gobiernan este archivo
--
-- 1. UNA tabla, con `tipo`, no dos tablas ni un booleano.
--
--    Habilidades Motrices no es un club, pero el sitio lo trata al mismo nivel
--    en los cuatro sitios donde aparece: el selector de Semilleros, las
--    categorías de vinculación de Matrículas, las tarjetas de la portada y la
--    sección «Nuestros clubes y programa». Dos tablas obligarían a unir dos
--    consultas y a duplicar orden, activo, logo y color para pintar una lista
--    que la persona ve como una sola.
--
--    `tipo` y no `es_club`: un booleano describe lo que la fila NO es, y a la
--    primera excepción pasa a significar «la otra cosa». Con `tipo`, un
--    semillero o una escuela son un valor más.
--
--    `tipo` lleva CHECK y `deporte` no, y la diferencia no es capricho: `tipo`
--    decide CÓMO RENDERIZA el sitio (un programa no tiene niveles ni grupo
--    competitivo), así que un valor nuevo llega acompañado de la plantilla que
--    lo dibuja — o sea, de código, o sea, de un despliegue. `deporte` es un
--    dato que solo se muestra: un enum o un CHECK ahí obligaría a una
--    migración cada vez que la corporación sume un deporte, que es justo lo
--    que hay que evitar.
--
-- 2. `nivel.club_id` y `unique (club_id, orden)`.
--
--    Minirider e Intermedio existen en los dos clubes con la misma
--    descripción y horarios distintos: son filas distintas, y el orden 1 tiene
--    que poder repetirse entre clubes.
--
--    `reordenar_niveles` pasa a recibir `p_club_id`. El `lock table` sigue
--    siendo sobre la tabla ENTERA y sigue haciendo falta: Postgres no bloquea
--    subconjuntos de filas, y `select … for update` no impide el INSERT
--    concurrente de un nivel nuevo en ese club, que es la carrera que el lock
--    existe para cerrar. Bloquear la tabla para una operación manual de panel,
--    que ocurre una vez cada varios meses, no tiene costo real.
--
--    El `v_base` de los valores temporales ahora se calcula DENTRO DEL CLUB.
--    El global también funcionaría por casualidad —los temporales quedan por
--    debajo del mínimo de todas las filas, luego también del mínimo del club—,
--    pero haría depender la garantía de filas que la sentencia no toca. Con el
--    mínimo del club, el razonamiento se cierra sobre lo que se reescribe.
--
-- 3. `producto.club_id` nulable, y el enum se reconvierte a tipo de prenda.
--
--    `categoria` mezclaba dos ejes: de quién es el producto y qué prenda es.
--    El primero va a `club_id` (nulo = marca TSW, común a todos, misma regla
--    que tenía prevista `deporte_id`); el segundo se queda en el enum, que
--    ahora sí es un conjunto cerrado y útil para filtrar el catálogo.
--
--    Los valores salen de los seis productos del documento del cliente: buso,
--    guantes, camiseta y gorra. No hay un quinto: `jersey` no aparece en el
--    catálogo —el jersey del documento es el del módulo de deportistas, que es
--    otra cosa— y no se inventa.
--
--    MIGRACIÓN DE DATOS, EXPLÍCITA Y SIN ADIVINAR. Los cuatro productos que
--    hay hoy son marcadores de posición («[Uniforme oficial — nombre
--    pendiente]», etc.) con precios de prueba, y sus categorías viejas
--    (uniformes, proteccion, merchandising) no traducen a ninguna prenda: un
--    «kit de protección» no es un buso ni unos guantes. Quedan con `categoria`
--    y `club_id` en NULL, para corregir desde el panel o borrar. Por eso
--    `categoria` pasa a ser nulable: la alternativa era un valor `otros` que
--    ensuciaría el filtro para siempre.
--
-- ---------------------------------------------------------------------------
-- Dos cosas que añadí y conviene revisar
--
--  · `nivel.cupo_maximo`. El documento da «Grupos: máximo 14 deportistas»
--    (25 en Avanzado) para cinco de los seis niveles. Sin columna, ese dato o
--    se pierde o se pega dentro de la descripción, donde el panel no lo puede
--    editar aparte. Es un integer nulable.
--
--  · `club.orden` NO es único, al revés que `nivel.orden`. El orden de los
--    niveles es una ruta formativa, una secuencia estricta donde dos niveles
--    no pueden ocupar el mismo puesto; el de los clubes es solo el orden en
--    que se listan. Sin unicidad no hace falta una RPC de reordenamiento con
--    lock y valores temporales para tres filas.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Tabla club
-- ---------------------------------------------------------------------------

create table public.club (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  slug             text not null,
  tipo             text not null default 'club',
  -- Dato, no catálogo cerrado: ver la decisión 1 de la cabecera.
  deporte          text not null,
  etiqueta         text,
  descripcion      text,
  -- Color de identidad en hexadecimal, del logo de cada club. El sistema de
  -- diseño ya no tiene un rojo global: el rojo es de Mastercross y vive aquí.
  color_identidad  text,
  logo_path        text,
  instagram_url    text,
  orden            integer not null default 0,
  activo           boolean not null default true,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),

  constraint club_slug_unico unique (slug),
  constraint club_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint club_nombre_no_vacio check (length(btrim(nombre)) > 0),
  constraint club_deporte_no_vacio check (length(btrim(deporte)) > 0),
  constraint club_tipo_valido check (tipo in ('club', 'programa')),
  constraint club_color_hexadecimal check (color_identidad is null or color_identidad ~ '^#[0-9A-Fa-f]{6}$')
);

comment on table public.club is
  'Club o programa de la corporación. Una sola tabla para los dos: el sitio los lista juntos en el menú, en el selector de niveles y en las categorías de vinculación.';
comment on column public.club.tipo is
  'club o programa. Decide cómo renderiza el sitio: un programa no tiene niveles ni grupo competitivo. Lleva CHECK porque un valor nuevo exige la plantilla que lo dibuje; `deporte` no lo lleva por lo contrario.';
comment on column public.club.deporte is
  'Deporte del club, como texto editable desde el panel. Sin enum ni CHECK a propósito: la corporación busca representación en otros deportes y cada uno no puede costar una migración.';
comment on column public.club.etiqueta is
  'Rótulo corto para las tarjetas, p. ej. "El club de la casa".';
comment on column public.club.color_identidad is
  'Color de identidad en #RRGGBB. Es del club, no del sistema de diseño: los componentes genéricos no lo usan.';
comment on column public.club.logo_path is
  'Ruta del logo en Storage. Nulo mientras no se haya subido; el logo de la corporación no vive aquí, es del sitio.';
comment on column public.club.orden is
  'Posición en las listas, menor primero. NO es único: a diferencia de nivel.orden esto no es una secuencia formativa, solo un orden de presentación.';

create trigger club_actualizado_en
  before update on public.club
  for each row execute function public.set_actualizado_en();

create trigger club_auditoria
  after insert or update or delete on public.club
  for each row execute function public.registrar_auditoria();

create index club_activo_orden_idx
  on public.club (orden)
  where activo;

comment on index public.club_activo_orden_idx is
  'Listado público de clubes y programas activos, en su orden.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.club enable row level security;

-- El público ve los activos; el panel, todos. Mismo patrón que nivel y
-- producto en la migración 08, y con es_admin() desde la 13.
create policy club_lectura_publica on public.club
  for select to anon, authenticated
  using (activo or public.es_admin());

create policy club_escritura_admin on public.club
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ---------------------------------------------------------------------------
-- Semilla: los dos clubes y el programa
--
-- Textos tomados del documento del cliente (versión del 22-09-2026), sin
-- reescribir. Lo que el documento no da queda en NULL y se reporta: el color
-- de Habilidades Motrices y los tres logos, que llegan con el bucket.
-- ---------------------------------------------------------------------------

insert into public.club (nombre, slug, tipo, deporte, etiqueta, descripcion, color_identidad, instagram_url, orden)
values
  (
    'BMX Club TSW',
    'bmx-club-tsw',
    'club',
    'BMX',
    'El club de la casa',
    'TSW es el club de la casa, el que da nombre a la corporación. Forma riders de todas las edades y niveles, desde la iniciación, y cuenta con un grupo competitivo que representa a la corporación en válidas regionales, departamentales y nacionales.',
    '#008DFE',
    'https://www.instagram.com/bmx_clubtsw',
    1
  ),
  (
    'BMX Mastercross',
    'bmx-mastercross',
    'club',
    'BMX',
    'Club acogido · Desde 2022',
    'Mastercross nació en 2022 y hoy crece con el respaldo de la Corporación Deportiva TSW. Su enfoque es la formación: trabaja por niveles de habilidad, para que cada rider avance según lo que domina y no por su edad. Lo identifican sus colores negro, rojo y blanco.',
    '#D7263D',
    'https://www.instagram.com/bmxmastercross',
    2
  ),
  (
    'Habilidades Motrices',
    'habilidades-motrices',
    'programa',
    'Habilidades motrices',
    'Todas las edades · Personalizado',
    'Sesiones personalizadas para niños, jóvenes y adultos que fortalecen el equilibrio, la coordinación, la agilidad y la confianza en el propio cuerpo. Es una base sólida para el BMX y para cualquier otro deporte, adaptada a la edad y las necesidades de cada persona.',
    null,
    null,
    3
  )
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- nivel: club_id, cupo_maximo y el unique por club
-- ---------------------------------------------------------------------------

alter table public.nivel
  add column club_id     uuid,
  add column cupo_maximo integer;

comment on column public.nivel.club_id is
  'Club al que pertenece el nivel. Minirider e Intermedio existen en los dos clubes: son filas distintas con el mismo nombre y horarios propios.';
comment on column public.nivel.cupo_maximo is
  'Máximo de deportistas por grupo. Nulo si el nivel no fija cupo.';

-- Los niveles que hay hoy son la semilla de la fase 1, todos con el nombre
-- entre corchetes. Se asignan al club de la casa para poder poner NOT NULL, y
-- justo después se borran los que siguen siendo marcadores de posición. Si
-- alguno se hubiera editado desde el panel, sobrevive asignado a TSW —y eso
-- hay que revisarlo a mano, porque el club sería una suposición—.
update public.nivel
   set club_id = (select id from public.club where slug = 'bmx-club-tsw')
 where club_id is null;

delete from public.nivel
 where nombre like '[%';

alter table public.nivel
  alter column club_id set not null;

alter table public.nivel
  add constraint nivel_club_fk foreign key (club_id) references public.club (id) on delete restrict;

comment on constraint nivel_club_fk on public.nivel is
  'RESTRICT y no CASCADE: borrar un club no puede llevarse sus niveles por delante. Un club que se va se desactiva.';

-- El unique global se va: el orden 1 tiene que poder existir en cada club.
alter table public.nivel drop constraint nivel_orden_unico;

alter table public.nivel
  add constraint nivel_orden_unico unique (club_id, orden);

comment on constraint nivel_orden_unico on public.nivel is
  'Un puesto por club. Sigue siendo UNIQUE inmediato, no diferible: reordenar pasa por valores temporales negativos, nunca por un intercambio directo.';

-- ---------------------------------------------------------------------------
-- Semilla: los seis niveles del documento
--
-- Minirider e Intermedio comparten descripción, edades y cupo entre los dos
-- clubes —el documento dice «los mismos de TSW»— y cambian de horario.
-- ---------------------------------------------------------------------------

insert into public.nivel (club_id, nombre, orden, rango_edad, cupo_maximo, horario, descripcion, criterio_promocion, activo)
select c.id, v.nombre, v.orden, v.rango_edad, v.cupo_maximo, v.horario, v.descripcion, v.criterio_promocion, true
  from (values
    ('bmx-club-tsw', 'Minirider', 1, 'De 2 años y medio a 5 años', 14,
     'Miércoles y viernes, 4:00 a 6:00 p. m. · sábados, 2:00 a 4:00 p. m.',
     'El primer contacto con la pista, en bici de impulso (sin pedales). A través del juego, los más pequeños desarrollan equilibrio, dirección y frenado, y ganan confianza sobre ruedas.',
     'Mantener el equilibrio, frenar y girar con control en la bici de impulso, y estar listo para la bici de pedal.'),
    ('bmx-club-tsw', 'Intermedio', 2, 'De 4 a 13 años', 14,
     'Miércoles y viernes, 4:00 a 6:00 p. m. · sábados, 2:00 a 4:00 p. m.',
     'Paso a la bici de pedal. Se trabajan el pedaleo, la posición sobre la bici, las curvas y los primeros obstáculos de la pista.',
     'Recorrer la pista completa con técnica y seguridad, y dominar la salida y las curvas.'),
    ('bmx-club-tsw', 'Avanzado · Grupo competitivo', 3, 'De 6 a 16 años', 25,
     'Lunes a viernes, 6:00 a 8:30 p. m.',
     'El nivel más alto del club. Los riders perfeccionan la salida desde la rampa, los saltos, la velocidad y la lectura de la pista, y representan a TSW en válidas regionales, departamentales y nacionales.',
     'Ingreso: según el desempeño y los resultados del rider.'),
    ('bmx-mastercross', 'Minirider', 1, 'De 2 años y medio a 5 años', 14,
     'Martes y jueves, 4:00 a 6:00 p. m. · domingos, 8:00 a 10:00 a. m. y 2:00 a 4:00 p. m.',
     'El primer contacto con la pista, en bici de impulso (sin pedales). A través del juego, los más pequeños desarrollan equilibrio, dirección y frenado, y ganan confianza sobre ruedas.',
     'Mantener el equilibrio, frenar y girar con control en la bici de impulso, y estar listo para la bici de pedal.'),
    ('bmx-mastercross', 'Intermedio', 2, 'De 4 a 13 años', 14,
     'Martes y jueves, 4:00 a 6:00 p. m.',
     'Paso a la bici de pedal. Se trabajan el pedaleo, la posición sobre la bici, las curvas y los primeros obstáculos de la pista.',
     'Recorrer la pista completa con técnica y seguridad, y dominar la salida y las curvas.'),
    ('bmx-mastercross', 'Avanzado', 3, 'De 6 a 16 años', 25,
     'Miércoles, jueves y viernes, 6:00 a 8:00 p. m.',
     'Perfeccionamiento técnico: salida desde la rampa, saltos, velocidad y lectura de la pista, con preparación física adaptada a cada edad.',
     'Es el nivel más alto de formación del club. El rider sigue perfeccionando su técnica y su dominio de la pista.')
  ) as v(slug_club, nombre, orden, rango_edad, cupo_maximo, horario, descripcion, criterio_promocion)
  join public.club c on c.slug = v.slug_club
on conflict (club_id, orden) do nothing;

-- ---------------------------------------------------------------------------
-- producto: club_id y el enum reconvertido
--
-- El orden importa: guardar_producto lleva el enum viejo en su firma, así que
-- la función se borra antes de tocar el tipo y se recrea después. Un CREATE OR
-- REPLACE no serviría: cambia la lista de parámetros.
-- ---------------------------------------------------------------------------

drop function if exists public.guardar_producto(uuid, uuid, text, text, public.categoria_producto, text, boolean, integer);

alter type public.categoria_producto rename to categoria_producto_obsoleto;

create type public.categoria_producto as enum ('buso', 'guantes', 'camiseta', 'gorra');

comment on type public.categoria_producto is
  'Tipo de prenda del catálogo. Sale de los seis productos del documento del cliente. De quién es el producto ya no se guarda aquí: eso es producto.club_id.';

-- USING null y no una traducción: uniformes, proteccion y merchandising no
-- corresponden a ninguna prenda. Adivinarlas sería inventar el catálogo.
alter table public.producto
  alter column categoria drop not null,
  alter column categoria type public.categoria_producto using null;

drop type public.categoria_producto_obsoleto;

comment on column public.producto.categoria is
  'Tipo de prenda. Nulo mientras no esté clasificado: las filas de la semilla de la fase 1 quedaron así porque su categoría vieja no traducía a ninguna prenda.';

alter table public.producto
  add column club_id uuid references public.club (id) on delete restrict;

comment on column public.producto.club_id is
  'Club dueño del producto. NULO = merchandising de la marca TSW, común a todos. Misma regla que estaba prevista para deporte_id.';

create index producto_club_activo_idx
  on public.producto (club_id)
  where activo;

comment on index public.producto_club_activo_idx is
  'Catálogo filtrado por club, que es como lo presenta la tienda.';

-- ---------------------------------------------------------------------------
-- RPC de club
--
-- Misma convención que el resto del panel: p_actor_id primero, security
-- definer, search_path = public, establecer_actor como primera sentencia, y
-- solo service_role ejecuta. `logo_path` queda FUERA de guardar_club, como
-- imagen_path en competencia y producto: entra por establecer_logo_club y por
-- ningún otro sitio. `activo` igual, por alternar_club_activo.
-- ---------------------------------------------------------------------------

create or replace function public.guardar_club(
  p_actor_id        uuid,
  p_id              uuid    default null,
  p_nombre          text    default null,
  p_slug            text    default null,
  p_tipo            text    default 'club',
  p_deporte         text    default null,
  p_etiqueta        text    default null,
  p_descripcion     text    default null,
  p_color_identidad text    default null,
  p_instagram_url   text    default null,
  p_orden           integer default 0
)
returns public.club
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fila public.club;
begin
  perform public.establecer_actor(p_actor_id);

  if p_id is null then
    insert into public.club (nombre, slug, tipo, deporte, etiqueta, descripcion, color_identidad, instagram_url, orden)
    values (p_nombre, p_slug, p_tipo, p_deporte, nullif(btrim(p_etiqueta), ''), nullif(btrim(p_descripcion), ''),
            nullif(btrim(p_color_identidad), ''), nullif(btrim(p_instagram_url), ''), coalesce(p_orden, 0))
    returning * into v_fila;
  else
    -- Reemplazo total, sin coalesce: el formulario es el estado completo de la
    -- fila. Con coalesce, vaciar la etiqueta desde el panel no la vaciaría.
    update public.club
       set nombre          = p_nombre,
           slug            = p_slug,
           tipo            = p_tipo,
           deporte         = p_deporte,
           etiqueta        = nullif(btrim(p_etiqueta), ''),
           descripcion     = nullif(btrim(p_descripcion), ''),
           color_identidad = nullif(btrim(p_color_identidad), ''),
           instagram_url   = nullif(btrim(p_instagram_url), ''),
           orden           = coalesce(p_orden, 0)
     where id = p_id
    returning * into v_fila;

    if not found then
      raise exception 'El club % no existe.', p_id
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  return v_fila;
end;
$$;

comment on function public.guardar_club(uuid, uuid, text, text, text, text, text, text, text, text, integer) is
  'Crea o actualiza un club o programa. Reemplazo total: el formulario manda todos sus campos. activo y logo_path quedan fuera, por alternar_club_activo y establecer_logo_club.';

revoke execute on function public.guardar_club(uuid, uuid, text, text, text, text, text, text, text, text, integer) from public, anon, authenticated;
grant  execute on function public.guardar_club(uuid, uuid, text, text, text, text, text, text, text, text, integer) to service_role;

-- --- alternar_club_activo ---------------------------------------------------

create or replace function public.alternar_club_activo(
  p_actor_id uuid,
  p_id       uuid,
  p_activo   boolean
)
returns public.club
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fila public.club;
begin
  perform public.establecer_actor(p_actor_id);

  update public.club set activo = p_activo where id = p_id
  returning * into v_fila;

  if not found then
    raise exception 'El club % no existe.', p_id
      using errcode = 'foreign_key_violation';
  end if;

  return v_fila;
end;
$$;

comment on function public.alternar_club_activo(uuid, uuid, boolean) is
  'Muestra u oculta un club o programa en el sitio público. Operación parcial con su propia RPC: no pasa por guardar_club.';

revoke execute on function public.alternar_club_activo(uuid, uuid, boolean) from public, anon, authenticated;
grant  execute on function public.alternar_club_activo(uuid, uuid, boolean) to service_role;

-- --- establecer_logo_club ---------------------------------------------------

create or replace function public.establecer_logo_club(
  p_actor_id  uuid,
  p_id        uuid,
  p_logo_path text
)
returns public.club
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fila public.club;
begin
  perform public.establecer_actor(p_actor_id);

  update public.club set logo_path = nullif(btrim(p_logo_path), '') where id = p_id
  returning * into v_fila;

  if not found then
    raise exception 'El club % no existe.', p_id
      using errcode = 'foreign_key_violation';
  end if;

  return v_fila;
end;
$$;

comment on function public.establecer_logo_club(uuid, uuid, text) is
  'Único camino por el que cambia el logo de un club. Mismo principio que establecer_imagen_producto: si la imagen entrara por dos caminos, cada camino necesitaría su copia de las reglas.';

revoke execute on function public.establecer_logo_club(uuid, uuid, text) from public, anon, authenticated;
grant  execute on function public.establecer_logo_club(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- guardar_nivel, ahora con club
-- ---------------------------------------------------------------------------

drop function if exists public.guardar_nivel(uuid, uuid, text, integer, text, text, text, text, boolean);

create or replace function public.guardar_nivel(
  p_actor_id           uuid,
  p_id                 uuid    default null,
  p_club_id            uuid    default null,
  p_nombre             text    default null,
  p_orden              integer default null,
  p_rango_edad         text    default null,
  p_cupo_maximo        integer default null,
  p_horario            text    default null,
  p_descripcion        text    default null,
  p_criterio_promocion text    default null,
  p_activo             boolean default true
)
returns public.nivel
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fila public.nivel;
begin
  perform public.establecer_actor(p_actor_id);

  if p_club_id is null then
    raise exception 'Falta el club del nivel.'
      using errcode = 'check_violation';
  end if;

  if not exists (select 1 from public.club where id = p_club_id) then
    raise exception 'El club % no existe.', p_club_id
      using errcode = 'foreign_key_violation';
  end if;

  if p_id is null then
    insert into public.nivel (club_id, nombre, orden, rango_edad, cupo_maximo, horario, descripcion, criterio_promocion, activo)
    values (p_club_id, p_nombre, p_orden, p_rango_edad, p_cupo_maximo, p_horario, p_descripcion, p_criterio_promocion, p_activo)
    returning * into v_fila;
  else
    update public.nivel
       set club_id            = p_club_id,
           nombre             = coalesce(p_nombre, nombre),
           orden              = coalesce(p_orden, orden),
           rango_edad         = p_rango_edad,
           cupo_maximo        = p_cupo_maximo,
           horario            = p_horario,
           descripcion        = p_descripcion,
           criterio_promocion = p_criterio_promocion,
           activo             = p_activo
     where id = p_id
    returning * into v_fila;

    if not found then
      raise exception 'El nivel % no existe.', p_id
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  return v_fila;
end;
$$;

comment on function public.guardar_nivel(uuid, uuid, uuid, text, integer, text, integer, text, text, text, boolean) is
  'Crea o actualiza un nivel dentro de un club. El club es obligatorio: un nivel sin club no se puede listar ni ordenar.';

revoke execute on function public.guardar_nivel(uuid, uuid, uuid, text, integer, text, integer, text, text, text, boolean) from public, anon, authenticated;
grant  execute on function public.guardar_nivel(uuid, uuid, uuid, text, integer, text, integer, text, text, text, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- reordenar_niveles, dentro de un club
-- ---------------------------------------------------------------------------

drop function if exists public.reordenar_niveles(uuid, uuid[]);

create or replace function public.reordenar_niveles(
  p_actor_id uuid,
  p_club_id  uuid,
  p_ids      uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_base  integer;
begin
  perform public.establecer_actor(p_actor_id);

  -- Bloqueo de la tabla ENTERA, no del club: Postgres no bloquea subconjuntos
  -- de filas, y FOR UPDATE solo retiene las que ya existen —dejaría colarse un
  -- INSERT concurrente en este mismo club entre las comprobaciones y el
  -- reacomodo—. Va antes de cualquier lectura: todo lo que se comprueba abajo
  -- se comprueba sobre el conjunto que se va a reescribir.
  lock table public.nivel in share row exclusive mode;

  if p_club_id is null then
    raise exception 'Falta el club cuyos niveles se reordenan.'
      using errcode = 'check_violation';
  end if;

  if array_length(p_ids, 1) is null then
    raise exception 'La lista de niveles está vacía.'
      using errcode = 'check_violation';
  end if;

  if (select count(*) from unnest(p_ids) u) <> (select count(distinct u) from unnest(p_ids) u) then
    raise exception 'La lista de niveles tiene ids repetidos.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
      from unnest(p_ids) as u(id)
     where not exists (select 1 from public.nivel n where n.id = u.id)
  ) then
    raise exception 'Algún nivel de la lista ya no existe. Recarga la página e inténtalo de nuevo.'
      using errcode = 'foreign_key_violation';
  end if;

  -- Todos los ids tienen que ser DE ESTE CLUB. Sin esta comprobación, un id
  -- de otro club colado en la lista dejaría un orden duplicado en un club y un
  -- hueco en el otro, y el unique por club no lo vería venir.
  if exists (
    select 1
      from public.nivel n
      join unnest(p_ids) as u(id) on u.id = n.id
     where n.club_id is distinct from p_club_id
  ) then
    raise exception 'Estos niveles no pertenecen al club indicado.'
      using errcode = 'check_violation';
  end if;

  -- Conjunto completo DEL CLUB, y v_base calculado dentro del club: los
  -- temporales quedan por debajo del mínimo de este club y por debajo de 1,
  -- fuera del rango final. Con el mínimo global la garantía dependería de
  -- filas que esta sentencia no toca.
  select count(*), least(coalesce(min(orden), 0), 0)
    into v_total, v_base
    from public.nivel
   where club_id = p_club_id;

  if v_total <> array_length(p_ids, 1) then
    raise exception 'La lista debe incluir todos los niveles del club (hay % y llegaron %). Recarga la página e inténtalo de nuevo.',
      v_total, array_length(p_ids, 1)
      using errcode = 'check_violation';
  end if;

  -- Paso 1: todos a negativos libres, por debajo del mínimo del club.
  update public.nivel n
     set orden = v_base - ordenado.posicion
    from unnest(p_ids) with ordinality as ordenado(id, posicion)
   where n.id = ordenado.id;

  -- Paso 2: posiciones finales 1..N. Dentro del club no queda ningún positivo
  -- ocupado; los otros clubes conservan los suyos y no estorban, porque el
  -- unique es por (club_id, orden).
  update public.nivel n
     set orden = ordenado.posicion
    from unnest(p_ids) with ordinality as ordenado(id, posicion)
   where n.id = ordenado.id;
end;
$$;

comment on function public.reordenar_niveles(uuid, uuid, uuid[]) is
  'Reordena los niveles de UN club según la posición de cada id en el arreglo, en una sola transacción y sin constraints diferidos. Exige el conjunto completo del club: no reordena parcialidades ni mezcla clubes.';

revoke execute on function public.reordenar_niveles(uuid, uuid, uuid[]) from public, anon, authenticated;
grant  execute on function public.reordenar_niveles(uuid, uuid, uuid[]) to service_role;

-- ---------------------------------------------------------------------------
-- guardar_producto, ahora con club y con la categoría nulable
-- ---------------------------------------------------------------------------

create or replace function public.guardar_producto(
  p_actor_id    uuid,
  p_id          uuid    default null,
  p_nombre      text    default null,
  p_slug        text    default null,
  p_categoria   public.categoria_producto default null,
  p_club_id     uuid    default null,
  p_descripcion text    default null,
  p_activo      boolean default true,
  p_orden       integer default 0
)
returns public.producto
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fila public.producto;
begin
  perform public.establecer_actor(p_actor_id);

  if p_club_id is not null and not exists (select 1 from public.club where id = p_club_id) then
    raise exception 'El club % no existe.', p_club_id
      using errcode = 'foreign_key_violation';
  end if;

  -- Reemplazo total, sin coalesce, igual que la versión de la migración 12:
  -- lo que llega se escribe, y vaciar un campo opcional es una decisión válida
  -- del administrador. Lo único que cambia respecto de la 12 es club_id.
  if p_id is null then
    insert into public.producto (nombre, slug, categoria, club_id, descripcion, activo, orden)
    values (p_nombre, p_slug, p_categoria, p_club_id, p_descripcion, p_activo, p_orden)
    returning * into v_fila;
  else
    update public.producto
       set nombre      = p_nombre,
           slug        = p_slug,
           categoria   = p_categoria,
           club_id     = p_club_id,
           descripcion = p_descripcion,
           activo      = p_activo,
           orden       = p_orden
     where id = p_id
    returning * into v_fila;

    if not found then
      raise exception 'El producto % no existe.', p_id
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  return v_fila;
end;
$$;

comment on function public.guardar_producto(uuid, uuid, text, text, public.categoria_producto, uuid, text, boolean, integer) is
  'Crea o actualiza un producto del catálogo. p_club_id nulo significa merchandising de la marca TSW, no "sin asignar". imagen_path sigue fuera, por establecer_imagen_producto.';

revoke execute on function public.guardar_producto(uuid, uuid, text, text, public.categoria_producto, uuid, text, boolean, integer) from public, anon, authenticated;
grant  execute on function public.guardar_producto(uuid, uuid, text, text, public.categoria_producto, uuid, text, boolean, integer) to service_role;
