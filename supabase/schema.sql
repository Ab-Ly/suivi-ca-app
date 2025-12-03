-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Articles Table
create table public.articles (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  type text not null check (type in ('stockable', 'service')),
  category text not null, -- 'shop', 'cafe', 'bosch_service', 'lubricant_piste', 'lubricant_bosch'
  price decimal(10, 2) not null default 0,
  current_stock integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Sales Table
create table public.sales (
  id uuid default uuid_generate_v4() primary key,
  article_id uuid references public.articles(id) on delete set null,
  quantity integer not null,
  total_price decimal(10, 2) not null,
  sale_date timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Stock Movements Table
create table public.stock_movements (
  id uuid default uuid_generate_v4() primary key,
  article_id uuid references public.articles(id) on delete cascade,
  type text not null check (type in ('in', 'out')),
  quantity integer not null,
  movement_date timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes
create index idx_sales_date on public.sales(sale_date);
create index idx_stock_movements_date on public.stock_movements(movement_date);
