-- Stores the result of syncing the order to the tickets app (user/company/service/plan IDs).
alter table orders
  add column if not exists tickets_sync jsonb;
