-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Articles Table
create table if not exists public.articles (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  type text not null check (type in ('stockable', 'service')),
  category text not null, -- 'shop', 'cafe', 'bosch_service', 'lubricant_piste', 'lubricant_bosch'
  price decimal(10, 2) not null default 0,
  current_stock integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Sales Table
create table if not exists public.sales (
  id uuid default uuid_generate_v4() primary key,
  article_id uuid references public.articles(id) on delete set null,
  quantity integer not null,
  total_price decimal(10, 2) not null,
  sale_date timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Stock Movements Table
create table if not exists public.stock_movements (
  id uuid default uuid_generate_v4() primary key,
  article_id uuid references public.articles(id) on delete cascade,
  type text not null check (type in ('in', 'out')),
  quantity integer not null,
  movement_date timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes
create index if not exists idx_sales_date on public.sales(sale_date);
create index if not exists idx_stock_movements_date on public.stock_movements(movement_date);

-- Seed data from articles_cleaned.csv
INSERT INTO public.articles (name, type, category, price, current_stock) VALUES
('ATF bidon 1L', 'stockable', 'lubricant_piste', 65, 34),
('Xpro Ultra 5W-40 5L', 'stockable', 'lubricant_piste', 550, 42),
('Xpro Hyper 10W-40 1L', 'stockable', 'lubricant_piste', 68, 37),
('Xpro Hyper 10W-40 5L', 'stockable', 'lubricant_piste', 305, 40),
('Xpro Extra 20W-50 1L', 'stockable', 'lubricant_piste', 50, 117),
('Xpro Extra 20W-50 4L', 'stockable', 'lubricant_piste', 190, 49),
('Xpro Ultim 15W-40 1L', 'stockable', 'lubricant_piste', 56, 39),
('Xpro Ultim 15W-40 5L', 'stockable', 'lubricant_piste', 250, 48),
('Xpro Super 15W-40 1L', 'stockable', 'lubricant_piste', 52, 120),
('Xpro Super 15W-40 5L', 'stockable', 'lubricant_piste', 230, 30),
('Xpro plus 40 1L', 'stockable', 'lubricant_piste', 48, 46),
('Xpro plus 40 5L', 'stockable', 'lubricant_piste', 210, 32),
('Xpro Plus 50 1L', 'stockable', 'lubricant_piste', 48, 156),
('Xpro Plus 50 5L', 'stockable', 'lubricant_piste', 210, 32),
('Xpro Regular 50 25L', 'stockable', 'lubricant_piste', 780.12, 4),
('Xpro Regular 40 1L', 'stockable', 'lubricant_piste', 44, 37),
('Xpro Regular 40 5L', 'stockable', 'lubricant_piste', 192, 75),
('2T 1L', 'stockable', 'lubricant_piste', 42, 41),
('Xpro Hyper 10W-40 205L', 'stockable', 'lubricant_piste', 36.29, 994),
('Gear Oil GX 80W-90 1L', 'stockable', 'lubricant_piste', 55, 56),
('Gear Oil GX 80W-90 2L', 'stockable', 'lubricant_piste', 94, 46),
('Gear Oil GX 80W-90 25L', 'stockable', 'lubricant_piste', 976.8, 6),
('Gear OIL GX 85W-140 2L', 'stockable', 'lubricant_piste', 96, 58),
('Gear OIL GX 85W-140 25L', 'stockable', 'lubricant_piste', 976.8, 4),
('Xpro HD 10W 2L', 'stockable', 'lubricant_piste', 79, 72),
('Xpro Regular 50 2L', 'stockable', 'lubricant_piste', 89, 161),
('Xpro Regular 50 1L', 'stockable', 'lubricant_piste', 44, 59),
('Xpro Regular 50 5L', 'stockable', 'lubricant_piste', 192, 91),
('Eau de batterie bidon 1L', 'stockable', 'shop', 6, 18),
('Liquide de refroidissement bidon 1L', 'stockable', 'shop', 15, 34),
('Lave glace bidon 1L', 'stockable', 'shop', 17, 165),
('Xpro Ultra 5W-40 1L', 'stockable', 'lubricant_piste', 120, 74),
('Brake fluid DOT 4 500 ml', 'stockable', 'shop', 50, 49),
('AdBlue BASF en Tonnelet 10L', 'stockable', 'shop', 215, 90),
('Xpro Ultra Light 5W-30 1L', 'stockable', 'lubricant_piste', 130, 97),
('Xpro Ultra Light 5W-30 5L', 'stockable', 'lubricant_piste', 620, 77),
('GRAISSE MULTI-USAGE N°2 180 KG', 'stockable', 'shop', 47.22, 1),
('Liquide de refroidissement bidon 5L', 'stockable', 'shop', 65, 103),
('Lave glace bidon 5L', 'stockable', 'shop', 65, 76),
('Hydraulic 68 Tonnelet 20L', 'stockable', 'lubricant_piste', 572.61, 4),
('Xpro Super 15W-40Â Â Tonnelet 20L', 'stockable', 'lubricant_piste', 659.25, 6),
('Xpro Regular 50 Tonnelet 20L', 'stockable', 'lubricant_piste', 593.08, 8),
('Xpro Regular 40 Tonnelet 20L', 'stockable', 'lubricant_piste', 571.52, 12),
('GearOil GX 80W-90 Tonnelet 20L', 'stockable', 'lubricant_piste', 710.59, 5),
('GearOil GX 85W-140 Tonnelet 20L', 'stockable', 'lubricant_piste', 711.6, 6),
('Xpro HD 10W Tonnelet 20L', 'stockable', 'lubricant_piste', 591.22, 7),
('Extra essene treat cart 12x300ml', 'stockable', 'lubricant_piste', 65, 67),
('Extra diesel treat cart 12x300ml', 'stockable', 'lubricant_piste', 65, 33),
('Stop fuite cart 12x300ml', 'stockable', 'shop', 65, 48),
('Viscosity plus cart 12x300m', 'stockable', 'shop', 65, 35);
