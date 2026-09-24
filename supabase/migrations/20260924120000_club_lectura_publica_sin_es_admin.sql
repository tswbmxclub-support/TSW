-- ---------------------------------------------------------------------------
-- TSW — 18. La lectura pública de club deja de llamar a es_admin()
--
-- Corrige un fallo de la migración 17 que tumba el sitio público entero.
--
-- La política que escribí allí era:
--
--   create policy club_lectura_publica on public.club
--     for select to anon, authenticated
--     using (activo or public.es_admin());
--
-- y `es_admin()` está revocada de anon desde la migración 13, a propósito:
-- «Para anon no aportan nada (auth.uid() es NULL) y no se exponen». El EXECUTE
-- de una función SECURITY DEFINER se comprueba contra el rol que LLAMA, no
-- contra el dueño, así que en cuanto anon evalúa esa política Postgres corta:
--
--   42501  permission denied for function es_admin
--
-- Y como `club` se lee en el layout público para armar el menú, el error no se
-- queda en una sección: todas las páginas públicas responden 500. Medido
-- contra el proyecto el 2026-09-24: `nivel`, `producto`, `competencia` y
-- `documento` se leen bien con anon; `club` es la única que falla.
--
-- Esta fue la primera política del proyecto que pone `to anon` y `es_admin()`
-- en la misma expresión. Las de la migración 13 son todas `to authenticated`,
-- que sí tiene el privilegio, y por eso el fallo no había aparecido nunca.
--
-- ---------------------------------------------------------------------------
-- El arreglo: dos políticas, una por rol
--
-- No se le concede `es_admin()` a anon. Esa decisión de la 13 sigue siendo la
-- correcta: anon nunca es administrador —`auth.uid()` es NULL— y darle EXECUTE
-- sería ampliar la superficie para que una función devuelva siempre falso.
--
-- En vez de eso, cada rol tiene su política y solo `authenticated` menciona la
-- función. PostgreSQL combina con OR las políticas permisivas del mismo
-- comando, así que un administrador sigue viendo los clubes inactivos y el
-- público sigue viendo solo los activos.
-- ---------------------------------------------------------------------------

drop policy club_lectura_publica on public.club;

create policy club_lectura_publica on public.club
  for select to anon
  using (activo);

comment on policy club_lectura_publica on public.club is
  'El visitante ve los clubes y programas activos. NO menciona es_admin(): anon no tiene EXECUTE sobre esa función (migración 13) y evaluarla aquí devolvía 42501.';

create policy club_lectura_sesion on public.club
  for select to authenticated
  using (activo or public.es_admin());

comment on policy club_lectura_sesion on public.club is
  'Con sesión: los activos para cualquiera, y todos para el administrador, que necesita ver los desactivados en el panel.';
