-- ---------------------------------------------------------------------------
-- TSW — 19. El contenido del sitio se edita desde el panel
--
-- Hoy los textos de la portada, matrículas, semilleros y la tienda viven en
-- `src/config/contenido.ts`: cambiar una frase es un commit y un despliegue.
-- Esta migración pone ese contenido en la base para que la cliente lo edite en
-- /admin/sitio, y añade el bucket `sitio` para las fotos que acompañan.
--
-- --- Por qué una tabla de clave/valor y no una tabla por sección -------------
--
-- Decisión de Samuel, y la razón es el tamaño: por sección serían cinco tablas,
-- cinco juegos de políticas y cinco RPC para un contenido que una sola persona
-- edita de vez en cuando. Con clave/valor es una tabla, una política y una RPC.
--
-- Lo que se pierde: la base no valida la FORMA del contenido, solo que sea
-- jsonb. Esa validación la hace Zod en el servidor antes de llamar a la RPC, y
-- el tipo de TypeScript sigue siendo el contrato. Es un corte deliberado: la
-- alternativa —columnas tipadas por sección— cuesta cinco veces más SQL para
-- proteger de un error que solo puede cometer el propio panel.
--
-- Lo que NO se pierde: `clave` tiene lista cerrada. Una clave mal escrita no
-- crea una fila huérfana que nadie vuelve a mirar; falla en el sitio.
--
-- --- Por qué hay columna `id` si la clave ya es única -----------------------
--
-- Porque `registrar_auditoria()` (migración 05) saca el id de la fila con
-- `v_despues ->> 'id'` y `evento_auditoria.entidad_id` es `uuid not null`. Sin
-- columna `id`, cada escritura abortaría al intentar insertar NULL. Con ella, el
-- trigger genérico sirve sin tocarlo: es más barato añadir una columna que
-- escribir un trigger de auditoría propio para esta tabla.
--
-- --- Qué NO entra aquí ------------------------------------------------------
--
-- `TIENDA_MUESTRA_PRECIOS` y `LEGALES_APROBADAS` siguen siendo constantes de
-- código, a propósito. El primero se enciende una vez en la vida del proyecto.
-- El segundo es una puerta de cumplimiento legal: en la base, un clic publicaría
-- textos legales sin revisar sin dejar rastro en `main` ni en ninguna revisión
-- de código. Como constante, encenderlo exige un commit, y eso es la
-- característica.
--
-- La tabla tampoco guarda los VALORES POR DEFECTO. Una fila ausente significa
-- "usa lo que dice el código", así que `contenido.ts` sigue siendo la única
-- fuente de los valores de fábrica y `restablecer_contenido` es un DELETE.
-- Sembrarlos aquí los duplicaría y el duplicado envejecería.
-- ---------------------------------------------------------------------------

-- --- La tabla ---------------------------------------------------------------

create table if not exists public.contenido_sitio (
  id             uuid primary key default gen_random_uuid(),
  clave          text not null,
  valor          jsonb not null,
  actualizado_en timestamptz not null default now(),

  constraint contenido_sitio_clave_unica unique (clave),

  -- Lista cerrada, y en la base y no solo en TypeScript: una clave inventada
  -- por una acción mal escrita crearía una fila que nada lee y nadie encuentra.
  constraint contenido_sitio_clave_conocida check (
    clave in ('deportes', 'portada', 'matriculas', 'semilleros', 'tienda')
  ),

  -- Un escalar suelto —`"hola"`, `3`, `null`— no es una sección. Esto no valida
  -- la forma de dentro, solo que haya un objeto o una lista donde debe haberlos.
  constraint contenido_sitio_valor_compuesto check (
    jsonb_typeof(valor) in ('object', 'array')
  )
);

comment on table public.contenido_sitio is
  'Contenido editorial del sitio público, una fila por sección. Fila ausente = se usa el valor por defecto de src/config/contenido.ts. Se escribe solo por guardar_contenido().';
comment on column public.contenido_sitio.clave is
  'Sección: deportes, portada, matriculas, semilleros o tienda. Lista cerrada por CHECK.';
comment on column public.contenido_sitio.valor is
  'La sección completa en jsonb. La forma la valida Zod en el servidor; la base solo exige objeto o lista.';
comment on column public.contenido_sitio.id is
  'Existe para registrar_auditoria(), que lee `id` de la fila y exige un uuid no nulo en evento_auditoria.entidad_id. La clave de negocio es `clave`.';

-- --- Auditoría --------------------------------------------------------------

-- El trigger genérico de la migración 05, sin cambios: deduce la acción, el
-- actor que fijó establecer_actor() y guarda la fila antes y después.
create trigger contenido_sitio_auditoria
  after insert or update or delete on public.contenido_sitio
  for each row execute function public.registrar_auditoria();

-- --- RLS --------------------------------------------------------------------

alter table public.contenido_sitio enable row level security;

-- Lectura: para todo el mundo. Es el contenido del sitio público; no hay estado
-- de borrador ni nada que ocultar, así que `using (true)` y una sola política.
--
-- NO menciona es_admin(), y eso es deliberado: la migración 18 documenta que
-- `anon` no tiene EXECUTE sobre esa función y que evaluarla en una política que
-- alcanza a anon devuelve 42501 y tumba el sitio entero. Aquí no hace falta.
create policy contenido_sitio_lectura on public.contenido_sitio
  for select to anon, authenticated
  using (true);

comment on policy contenido_sitio_lectura on public.contenido_sitio is
  'Lectura pública del contenido del sitio. No menciona es_admin(): anon no tiene EXECUTE sobre esa función (migraciones 13 y 18).';

-- Escritura: NINGUNA política. No es un olvido.
--
-- Con RLS activo y sin política de INSERT, UPDATE ni DELETE, ni `anon` ni
-- `authenticated` pueden escribir, sea administrador o no. La única vía es
-- guardar_contenido(), que es SECURITY DEFINER y solo tiene EXECUTE el
-- service_role, es decir el servidor.
--
-- Las tablas de la migración 13 sí llevan políticas de escritura condicionadas a
-- es_admin(). Son defensa en profundidad para un camino que no existe —el
-- navegador nunca escribe— y aquí se prefiere la negación por defecto: no hay
-- política que revisar, y un usuario con sesión pero sin rol de administrador no
-- tiene ni el camino ni el permiso.

-- --- guardar_contenido ------------------------------------------------------

create or replace function public.guardar_contenido(
  p_actor_id uuid,
  p_clave    text,
  p_valor    jsonb
)
returns public.contenido_sitio
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fila public.contenido_sitio;
begin
  perform public.establecer_actor(p_actor_id);

  if p_clave is null or btrim(p_clave) = '' then
    raise exception 'Falta la sección que se quiere guardar.'
      using errcode = 'null_value_not_allowed';
  end if;

  if p_valor is null then
    raise exception 'Falta el contenido de la sección %.', p_clave
      using errcode = 'null_value_not_allowed';
  end if;

  -- Reemplazo total de la sección, sin coalesce: el formulario del panel manda
  -- la sección completa, igual que el resto de los `guardar_*` del proyecto. Un
  -- merge parcial sobre jsonb dejaría claves viejas que el formulario ya quitó.
  insert into public.contenido_sitio (clave, valor)
  values (btrim(p_clave), p_valor)
  on conflict (clave) do update
    set valor          = excluded.valor,
        actualizado_en = now()
  returning * into v_fila;

  return v_fila;
end;
$$;

comment on function public.guardar_contenido(uuid, text, jsonb) is
  'Crea o reemplaza una sección de contenido del sitio. Reemplazo total: el formulario manda la sección entera. La lista de secciones válidas la impone el CHECK de la tabla.';

revoke execute on function public.guardar_contenido(uuid, text, jsonb) from public, anon, authenticated;
grant  execute on function public.guardar_contenido(uuid, text, jsonb) to service_role;

-- --- restablecer_contenido --------------------------------------------------

create or replace function public.restablecer_contenido(
  p_actor_id uuid,
  p_clave    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.establecer_actor(p_actor_id);

  if p_clave is null or btrim(p_clave) = '' then
    raise exception 'Falta la sección que se quiere restablecer.'
      using errcode = 'null_value_not_allowed';
  end if;

  -- Borrar la fila devuelve la sección a lo que dice src/config/contenido.ts.
  -- Es la razón de que los valores por defecto NO estén en la base: el DELETE
  -- es el botón de "volver a como estaba" y no hay que recordar nada.
  --
  -- Sin `if not found`: restablecer una sección que ya estaba en su valor de
  -- fábrica no es un error, es que no había nada que borrar.
  delete from public.contenido_sitio where clave = btrim(p_clave);
end;
$$;

comment on function public.restablecer_contenido(uuid, text) is
  'Borra la fila de una sección, con lo que el sitio vuelve al valor por defecto de src/config/contenido.ts. No falla si la sección no estaba personalizada.';

revoke execute on function public.restablecer_contenido(uuid, text) from public, anon, authenticated;
grant  execute on function public.restablecer_contenido(uuid, text) to service_role;

-- --- Bucket `sitio` ---------------------------------------------------------
--
-- Fotos de la portada, de la sede y de las tarjetas de deporte, que hoy son
-- archivos del repositorio en /public/imagenes.
--
-- Público, con el mismo tope de 10 MB que los otros tres. Las imágenes de este
-- bucket son institucionales —instalaciones, grupos en plano general—; si alguna
-- vez se sube un primer plano de un menor, aplica el mismo control documental
-- que `competencias`.
--
-- Tres tipos y nada más: PNG, JPEG y WebP.
--
-- **Sin SVG**, y esto es lo importante de la lista. Un SVG es un documento XML
-- que puede llevar `<script>`, y el bucket es público: el archivo se serviría
-- desde el dominio de Supabase con `image/svg+xml`, que el navegador ejecuta. Un
-- solo archivo subido ahí sería XSS alojado en infraestructura de confianza.
--
-- Tampoco AVIF, que sí estaba en el borrador de esta migración: los otros tres
-- buckets lo aceptan, pero aquí no aporta nada —`next/image` ya sirve AVIF
-- convirtiendo desde PNG o JPEG— y cada tipo admitido es un decodificador más
-- que tiene que aguantar un archivo hostil.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sitio', 'sitio', true, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Política propia y no tocar la de los otros tres buckets: las políticas
-- permisivas del mismo comando se combinan con OR, así que añadir una basta y
-- no se arriesga la lectura de los buckets que ya funcionan.
create policy "tsw sitio lectura publica"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'sitio');

-- Escritura exigiendo es_admin(), que es lo que las tres políticas de la
-- migración 09 NO hacen: dicen `to authenticated` y punto, de cuando no había
-- perfiles separados. Hoy una sesión de usuario también es `authenticated`.
--
-- En la práctica el panel sube con la service role, que salta RLS, así que esto
-- es defensa en profundidad. Aquí sí se pone, porque en Storage la alternativa a
-- una política es que no se pueda subir nada, y porque el coste es una línea.
create policy "tsw sitio subida"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sitio'
    and (storage.foldername(name))[1] = 'sitio'
    and public.es_admin()
  );

create policy "tsw sitio reemplazo"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'sitio'
    and (storage.foldername(name))[1] = 'sitio'
    and public.es_admin()
  )
  with check (
    bucket_id = 'sitio'
    and (storage.foldername(name))[1] = 'sitio'
    and public.es_admin()
  );

create policy "tsw sitio borrado"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'sitio'
    and (storage.foldername(name))[1] = 'sitio'
    and public.es_admin()
  );

comment on policy "tsw sitio borrado" on storage.objects is
  'A diferencia de documentos-matricula, aquí sí se borra: una foto de portada se reemplaza, y sin borrado el bucket acumularía huérfanas que nada referencia.';
