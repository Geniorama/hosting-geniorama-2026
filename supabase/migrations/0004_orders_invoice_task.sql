-- Stores the Trello card (or future invoicing provider) created for accounting.
alter table orders
  add column if not exists invoice_task jsonb;
