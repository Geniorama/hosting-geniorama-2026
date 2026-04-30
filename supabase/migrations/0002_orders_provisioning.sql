-- Stores cPanel/WHM provisioning result so we don't re-provision on webhook retries.
alter table orders
  add column if not exists provisioning jsonb;
