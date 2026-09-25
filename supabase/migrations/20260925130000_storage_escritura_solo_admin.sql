-- ---------------------------------------------------------------------------
-- TSW — 20. La escritura en Storage exige es_admin()
--
-- Cierra un agujero que dejó la migración 09 y que la 13 no alcanzó.
--
-- --- El agujero -------------------------------------------------------------
--
-- Las siete políticas de escritura de la migración 09 dicen, todas, `to
-- authenticated` y nada más:
--
--   create policy "tsw productos subida"
--     on storage.objects for insert to authenticated
--     with check (bucket_id = 'productos' and (storage.foldername(name))[1] = 'productos');
--
-- Cuando se escribieron, `authenticated` era sinónimo de administrador: no había
-- más cuentas que las del panel. La migración 13 partió los perfiles en
-- `perfil_admin` y `perfil_usuario` y puso `es_admin()` en las quince políticas
-- de TABLA, pero las de Storage se quedaron atrás.
--
-- Hoy una sesión de deportista o de acudiente **también es `authenticated`**. Con
-- su propio token, esa cuenta podía subir, reemplazar y borrar archivos en los
-- tres buckets: cambiar el PDF de matrícula que descarga todo el mundo, o borrar
-- las fotos del catálogo.
--
-- No estaba explotable hoy —el módulo de usuario todavía no está encendido y el
-- panel sube con la service role, que salta RLS— y por eso no lo cazó ninguna
-- prueba. Eso lo hace un agujero latente, no uno inofensivo: se abre solo el día
-- que se active `/cuenta/acceso`.
--
-- --- El arreglo -------------------------------------------------------------
--
-- Se recrea cada política añadiendo `public.es_admin()`. `drop policy` y `create
-- policy` y no `alter`: PostgreSQL no permite cambiar la expresión de una
-- política en su sitio, y recrearla deja el texto completo a la vista en esta
-- migración en vez de repartido entre dos archivos.
--
-- La LECTURA no se toca. `"tsw lectura publica de archivos"` alcanza a `anon` y
-- **no puede mencionar es_admin()**: `anon` no tiene EXECUTE sobre esa función
-- desde la migración 13, y evaluarla devolvería 42501 y tumbaría la descarga de
-- documentos y las fotos del catálogo. Es exactamente el fallo que la migración
-- 18 tuvo que corregir en la tabla `club`. Queda como está, a propósito.
-- ---------------------------------------------------------------------------

-- --- Subidas ----------------------------------------------------------------

drop policy "tsw documentos subida" on storage.objects;

create policy "tsw documentos subida"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos-matricula'
    and (storage.foldername(name))[1] = 'documentos-matricula'
    and public.es_admin()
  );

drop policy "tsw productos subida" on storage.objects;

create policy "tsw productos subida"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'productos'
    and (storage.foldername(name))[1] = 'productos'
    and public.es_admin()
  );

drop policy "tsw competencias subida" on storage.objects;

create policy "tsw competencias subida"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'competencias'
    and (storage.foldername(name))[1] = 'competencias'
    and public.es_admin()
  );

comment on policy "tsw competencias subida" on storage.objects is
  'Fotos de competencias. Contienen menores de edad: solo se sube material con autorización de uso de imagen firmada por el acudiente, y el CHECK de la tabla competencia lo exige. Desde la migración 20, además, solo administradores.';

-- --- Reemplazos -------------------------------------------------------------

drop policy "tsw productos reemplazo" on storage.objects;

create policy "tsw productos reemplazo"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'productos'
    and (storage.foldername(name))[1] = 'productos'
    and public.es_admin()
  )
  with check (
    bucket_id = 'productos'
    and (storage.foldername(name))[1] = 'productos'
    and public.es_admin()
  );

drop policy "tsw competencias reemplazo" on storage.objects;

create policy "tsw competencias reemplazo"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'competencias'
    and (storage.foldername(name))[1] = 'competencias'
    and public.es_admin()
  )
  with check (
    bucket_id = 'competencias'
    and (storage.foldername(name))[1] = 'competencias'
    and public.es_admin()
  );

-- --- Borrados ---------------------------------------------------------------
--
-- `documentos-matricula` sigue sin política de borrado, por lo mismo que decía la
-- migración 09: una versión publicada es evidencia, y la 03 bloquea UPDATE y
-- DELETE sobre su fila. Retirar un PDF se hace publicando una versión nueva.

drop policy "tsw productos borrado" on storage.objects;

create policy "tsw productos borrado"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'productos'
    and (storage.foldername(name))[1] = 'productos'
    and public.es_admin()
  );

drop policy "tsw competencias borrado" on storage.objects;

create policy "tsw competencias borrado"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'competencias'
    and (storage.foldername(name))[1] = 'competencias'
    and public.es_admin()
  );
