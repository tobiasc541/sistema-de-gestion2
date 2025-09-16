-- Esquema básico para el Sistema de Facturación
-- Ejecutar en el SQL editor de tu proyecto Supabase

create table if not exists meta (
  key text primary key,
  value jsonb not null
);

create table if not exists vendors (
  id text primary key,
  name text not null,
  key text not null
);

create table if not exists clients (
  id text primary key,
  number integer not null,
  name text not null,
  debt numeric default 0
);

create table if not exists products (
  id text primary key,
  name text not null,
  section text,
  list_label text,
  price1 numeric,
  price2 numeric,
  cost numeric
);

create table if not exists invoices (
  id text primary key,
  number integer not null,
  date_iso text not null,
  client_id text,
  client_name text,
  vendor_id text,
  vendor_name text,
  items jsonb not null,
  total numeric not null,
  cost numeric default 0,
  payments jsonb,
  status text,
  type text
);

create table if not exists budgets (
  id text primary key,
  number integer not null,
  date_iso text not null,
  client_id text,
  client_name text,
  vendor_id text,
  vendor_name text,
  items jsonb not null,
  total numeric not null,
  status text
);

-- Habilitar RLS
alter table meta enable row level security;
alter table vendors enable row level security;
alter table clients enable row level security;
alter table products enable row level security;
alter table invoices enable row level security;
alter table budgets enable row level security;

-- Políticas (DEMO): lectura/escritura total para rol 'anon'
-- IMPORTANTE: Endurecer en producción.
create policy "anon read meta" on meta for select using (true);
create policy "anon upsert meta" on meta for insert with check (true);
create policy "anon update meta" on meta for update using (true) with check (true);

create policy "anon read vendors" on vendors for select using (true);
create policy "anon write vendors" on vendors for insert with check (true);
create policy "anon update vendors" on vendors for update using (true) with check (true);

create policy "anon read clients" on clients for select using (true);
create policy "anon write clients" on clients for insert with check (true);
create policy "anon update clients" on clients for update using (true) with check (true);

create policy "anon read products" on products for select using (true);
create policy "anon write products" on products for insert with check (true);
create policy "anon update products" on products for update using (true) with check (true);

create policy "anon read invoices" on invoices for select using (true);
create policy "anon write invoices" on invoices for insert with check (true);
create policy "anon update invoices" on invoices for update using (true) with check (true);

create policy "anon read budgets" on budgets for select using (true);
create policy "anon write budgets" on budgets for insert with check (true);
create policy "anon update budgets" on budgets for update using (true) with check (true);
