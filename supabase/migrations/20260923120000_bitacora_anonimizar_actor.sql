-- ---------------------------------------------------------------------------
-- TSW — 16. La bitácora deja anonimizar al actor, y solo eso
--
-- Dos invariantes de la migración 06 se estorban, y no se notaba hasta que
-- alguien intentó borrar una cuenta:
--
--   · evento_auditoria.actor_id es `references auth.users (id) on delete set
--     null` (migración 06, línea 16): al borrar la cuenta, Postgres tiene que
--     ACTUALIZAR la bitácora para dejar ese actor en NULL.
--   · evento_auditoria_solo_insercion() rechaza todo UPDATE y todo DELETE
--     sobre la bitácora, service role incluida (migración 06, línea 216).
--
-- El UPDATE de la cascada choca con el trigger, la transacción entera se
-- aborta y GoTrue lo devuelve como «Database error deleting user», sin decir
-- por qué. Medido contra el proyecto real el 2026-09-22:
--
--     delete de la cuenta            -> Database error deleting user
--     update actor_id = null a mano  -> 23001 La bitácora de auditoría es de
--                                       solo inserción.
--
-- Consecuencia: NINGUNA cuenta que haya hecho algo en el panel se puede
-- borrar de auth.users. Hoy no estorba porque el panel solo ofrece
-- desactivar, pero convierte una limitación técnica en una política de
-- «no podemos suprimir sus datos», y con la Ley 1581 y datos de menores y
-- acudientes en el horizonte ese es el peor sitio donde estar.
--
-- ---------------------------------------------------------------------------
-- Qué se permite, exactamente
--
-- Un UPDATE pasa solo si se cumple TODO:
--
--   1. old.actor_id no es nulo y new.actor_id es nulo. Solo se anonimiza:
--      poner un actor donde no lo había sería inventar responsables, y
--      cambiar un actor por otro, falsificarlos.
--   2. Ninguna otra columna difiere.
--
-- Lo que la bitácora promete —qué pasó, cuándo y sobre qué fila— sigue
-- siendo inmutable. Lo único que puede cambiar es que el responsable quede
-- anónimo, que es el caso que la propia columna documenta desde la migración
-- 06 («Queda en NULL si el cambio vino de un proceso automático»).
--
-- El DELETE sigue prohibido sin excepción: una purga por retención seguirá
-- exigiendo deshabilitar el trigger a mano en una migración, como decía el
-- comentario original.
--
-- ---------------------------------------------------------------------------
-- Cómo se comprueba que «ninguna otra columna difiere»
--
-- Con dos redes distintas, porque cada una falla donde la otra aguanta:
--
--   · Columna por columna con `is distinct from`, en los tipos reales. Aquí
--     un timestamptz se compara como timestamptz y el enum como enum, así que
--     no hay conversión de por medio que redondee o normalice nada.
--
--   · La fila entera convertida a jsonb, quitando actor_id. Esta no nombra
--     columnas, así que cubre cualquier columna que se añada en el futuro:
--     sin ella, una columna nueva quedaría fuera de la lista de arriba y se
--     podría cambiar libremente con solo poner actor_id en NULL en el mismo
--     UPDATE. La comparación es de texto (`::text`), no de jsonb: `'1'` y
--     `'1.0'` son el mismo jsonb pero distinto texto, y en una bitácora
--     interesa que no cambie ni la forma.
--
-- No se mira de dónde viene el UPDATE —si es una cascada, qué rol lo hace,
-- si hay sesión—: eso no se distingue con fiabilidad desde un trigger, y una
-- condición que se puede fingir no es una condición.
-- ---------------------------------------------------------------------------

-- SECURITY INVOKER, igual que la versión que reemplaza. Por eso no lleva
-- revoke: la migración 10 dejó dicho que estas funciones de trigger no tienen
-- privilegios elevados que prestar y no son un vector.
create or replace function public.evento_auditoria_solo_insercion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     -- 1. Solo anonimizar: de un actor concreto a ninguno.
     and old.actor_id is not null
     and new.actor_id is null
     -- 2a. Red de tipos: columna por columna, sin conversiones.
     and new.id           is not distinct from old.id
     and new.accion       is not distinct from old.accion
     and new.entidad      is not distinct from old.entidad
     and new.entidad_id   is not distinct from old.entidad_id
     and new.antes_json   is not distinct from old.antes_json
     and new.despues_json is not distinct from old.despues_json
     and new.ocurrido_en  is not distinct from old.ocurrido_en
     -- 2b. Red de cobertura: cualquier columna, incluidas las que no existen
     --     todavía. El texto del jsonb, no el jsonb, para que tampoco cambie
     --     la forma de antes_json y despues_json.
     and (to_jsonb(new) - 'actor_id')::text is not distinct from (to_jsonb(old) - 'actor_id')::text
  then
    return new;
  end if;

  -- Mismo mensaje y mismo errcode que antes: lo que ya traducía la aplicación
  -- sigue traduciéndose igual.
  raise exception 'La bitácora de auditoría es de solo inserción.'
    using errcode = 'restrict_violation';
end;
$$;

comment on function public.evento_auditoria_solo_insercion() is
  'Bloquea UPDATE y DELETE sobre evento_auditoria, incluso con la service role key, con una sola excepción: el UPDATE que deja actor_id en NULL sin tocar ninguna otra columna, que es el que hace la cascada ON DELETE SET NULL al borrar una cuenta de auth.users. El DELETE no tiene excepción.';

-- El trigger no se toca: sigue siendo el mismo `before update or delete` de la
-- migración 06 y apunta a esta función, que CREATE OR REPLACE acaba de
-- sustituir. Recrearlo no aportaría nada y perdería su nombre de origen.
