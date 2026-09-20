-- ---------------------------------------------------------------------------
-- TSW — 14. Revocar EXECUTE de los triggers SECURITY DEFINER de perfiles
--
-- La migración 13 creó dos funciones de trigger con SECURITY DEFINER
-- (crear_perfil_al_registrar y validar_exclusividad_perfil) sin revocar el
-- EXECUTE que Postgres concede a PUBLIC por defecto. El advisor de seguridad
-- las marca como ejecutables por anon y authenticated vía /rest/v1/rpc.
--
-- En la práctica no son un vector: una función que devuelve `trigger` no se
-- puede invocar directamente ("trigger functions can only be called as
-- triggers"). Se revoca igual, por el mismo criterio de la migración 10: los
-- triggers no necesitan el privilegio (se verifica al crearlos, no al
-- dispararse) y el proyecto no deja advertencias sin justificar.
--
-- es_admin() y es_usuario() quedan ejecutables por authenticated a propósito:
-- las puertas de acceso las llaman por RPC para decidir el tipo de sesión.
-- ---------------------------------------------------------------------------

revoke execute on function public.crear_perfil_al_registrar()   from public, anon, authenticated;
revoke execute on function public.validar_exclusividad_perfil() from public, anon, authenticated;
