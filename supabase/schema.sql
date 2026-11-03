create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cost_price numeric(10,2) not null check (cost_price >= 0),
  selling_price numeric(10,2) not null check (selling_price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  total_amount numeric(10,2) not null check (total_amount >= 0),
  unit_cost_price numeric(10,2),
  unit_selling_price numeric(10,2),
  transaction_type text not null default 'sale' check (transaction_type in ('sale', 'adjustment')),
  created_at timestamptz not null default now()
);

create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null,
  amount_invested numeric(10,2) not null check (amount_invested >= 0),
  created_at timestamptz not null default now()
);

alter table public.investments add column if not exists created_at timestamptz not null default now();
alter table public.sales add column if not exists unit_cost_price numeric(10,2);
alter table public.sales add column if not exists unit_selling_price numeric(10,2);
alter table public.sales add column if not exists transaction_type text not null default 'sale';

update public.sales as sales
set
  unit_cost_price = products.cost_price,
  unit_selling_price = products.selling_price
from public.products as products
where sales.product_id = products.id
  and (sales.unit_cost_price is null or sales.unit_selling_price is null);

alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.investments enable row level security;

create policy "Authenticated users can view products"
on public.products for select
to authenticated
using (true);

create policy "Authenticated users can insert products"
on public.products for insert
to authenticated
with check (true);

create policy "Authenticated users can update products"
on public.products for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete products"
on public.products for delete
to authenticated
using (true);

create policy "Authenticated users can view sales"
on public.sales for select
to authenticated
using (true);

create policy "Authenticated users can insert sales"
on public.sales for insert
to authenticated
with check (true);

create policy "Authenticated users can update sales"
on public.sales for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete sales"
on public.sales for delete
to authenticated
using (true);

create policy "Authenticated users can view investments"
on public.investments for select
to authenticated
using (true);

create policy "Authenticated users can insert investments"
on public.investments for insert
to authenticated
with check (true);

create policy "Authenticated users can update investments"
on public.investments for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete investments"
on public.investments for delete
to authenticated
using (true);
