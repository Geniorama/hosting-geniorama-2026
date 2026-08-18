-- Backfill de periodos para los pedidos que ya existían antes de 0009.
--
-- Es idempotente: cada paso sólo toca filas que aún no tienen el dato, así que
-- se puede correr dos veces sin efecto.
--
-- ⚠ ANTES DE CORRERLO: el paso 3 existe para que este backfill NO le mande a
-- ningún cliente un correo de "tu plan venció" con efecto retroactivo. Los
-- pedidos cuyo periodo ya pasó quedan con todos los avisos marcados como
-- enviados, porque muchos de esos servicios se renovaron por fuera del sistema
-- (transferencia, factura manual) y el sistema no tiene forma de saberlo.
-- Correr los pasos 1 y 2 sin el 3 dispararía ese envío en el siguiente barrido.

-- Correr el archivo COMPLETO de una sola vez. Sin BEGIN/COMMIT explícito a
-- propósito: tanto el editor SQL de Supabase como `supabase db push` ya
-- envuelven el lote en una transacción, y un BEGIN anidado haría que el COMMIT
-- cerrara la transacción externa antes de tiempo. Correr los pasos sueltos
-- dejaría el trigger desactivado si algo falla a mitad.

-- La tabla tiene el trigger orders_set_updated_at, que reescribe updated_at en
-- CUALQUIER update. Como updated_at es hoy el único rastro de la fecha de pago
-- —y es justo de donde derivamos el periodo— hay que desactivarlo mientras
-- corre el backfill; si no, estos tres UPDATE le ponen la fecha de hoy a todos
-- los pedidos históricos y se pierde el dato original.
alter table public.orders disable trigger orders_set_updated_at;

-- ── 1. Periodo pagado ────────────────────────────────────────────────────────
-- Se deriva de updated_at, que es la misma base que ya usaba la fecha de
-- vencimiento de la tarjeta de Trello, así que las fechas no se mueven respecto
-- a lo que el equipo ha venido facturando.
update public.orders
set
  period_start = updated_at,
  period_end   = updated_at + (
    case when payload->>'billing' = 'annual'
      then interval '365 days'
      else interval '30 days'
    end
  )
where status = 'success'
  and period_end is null;

-- ── 2. Encadenar renovaciones históricas ─────────────────────────────────────
-- Un dominio con varios pedidos pagados ya se renovó por el checkout alguna
-- vez, pero esos pedidos no tienen renewal_of porque la columna no existía.
-- Sin esto, el barrido perseguiría TODOS los periodos de ese dominio, no sólo
-- el vigente. Cada pedido queda apuntando al inmediatamente anterior del mismo
-- dominio, que es justo lo que el barrido consulta para saltarse los ya
-- renovados.
with ordered as (
  select
    id,
    lag(id) over (
      partition by payload->'hosting'->>'domain'
      order by created_at
    ) as prev_id
  from public.orders
  where status = 'success'
    and payload->'hosting'->>'domain' is not null
)
update public.orders o
set renewal_of = ordered.prev_id
from ordered
where o.id = ordered.id
  and ordered.prev_id is not null
  and o.renewal_of is null;

-- ── 3. Silenciar avisos retroactivos ─────────────────────────────────────────
-- Todo lo que ya venció queda marcado como "ya avisado" para que el primer
-- barrido no le escriba a nadie por un periodo del pasado. El registro queda en
-- la base (period_end sí se llenó), sólo se suprime el envío.
--
-- Si quieres que el sistema SÍ persiga un servicio concreto que está vencido de
-- verdad, límpiale las llaves después:
--   update public.orders set renewal_notices = '{}'::jsonb where id = 'GR-XXXX';
update public.orders
set renewal_notices = coalesce(renewal_notices, '{}'::jsonb) || jsonb_build_object(
  'backfill', to_jsonb(now()),
  'd30',      to_jsonb(now()),
  'd15',      to_jsonb(now()),
  'd5',       to_jsonb(now()),
  'expired',  to_jsonb(now()),
  'suspend',  to_jsonb(now())
)
where status = 'success'
  and period_end is not null
  and period_end < now()
  and not (renewal_notices ? 'backfill');

alter table public.orders enable trigger orders_set_updated_at;
