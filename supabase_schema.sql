-- Create Employees Table
create table if not exists employees (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  role text,
  team text check (team in ('Equipe 1', 'Equipe 2', 'Stable', 'Autre')),
  stable_rest_day integer, -- 0=Sun, 1=Mon, ..., 6=Sat
  default_shift text default 'Jour', -- 'Jour', 'Nuit'
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ensure column exists if table already existed without it
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'stable_rest_day') then
        alter table employees add column stable_rest_day integer;
    end if;
     if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'default_shift') then
        alter table employees add column default_shift text default 'Jour';
    end if;
end $$;

-- Create Planning Shifts Table
create table if not exists planning_shifts (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid references employees(id) on delete cascade,
  date date not null,
  shift_type text not null, -- 'Jour', 'Nuit', '24h', 'Repos', 'Congé', 'Maladie'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(employee_id, date) -- One shift per employee per day
);

-- Enable RLS
alter table employees enable row level security;
alter table planning_shifts enable row level security;

-- Policies (Drop first to avoid errors on re-run)
drop policy if exists "Enable all access for all users" on employees;
create policy "Enable all access for all users" on employees for all using (true) with check (true);

drop policy if exists "Enable all access for all users" on planning_shifts;
create policy "Enable all access for all users" on planning_shifts for all using (true) with check (true);

-- Initial Staff Data Seed (Only insert if empty to avoid duplicates)
insert into employees (name, role, team)
select * from (values
  ('ABDELALI LYOUSSEFI', 'Gerant', 'Stable'),
  ('ABDELLAH JOUHADI', 'Pompiste', 'Equipe 1'),
  ('ADDADI ISMAIL', 'Agent Adm Bosch', 'Equipe 1'),
  ('ANOUAR MAJDA', 'Femme de Menage', 'Stable'),
  ('AZIZ BELMKADEM', 'Caissier', 'Equipe 1'),
  ('BELFKIH MOHAMMED', 'Caissier', 'Equipe 1'),
  ('EL HARRACHI JAMAL', 'Jardinier', 'Stable'),
  ('AMINE ES-SAYAD', 'Pompiste', 'Stable'),
  ('ECHARRADI HAMID', 'Pompiste', 'Equipe 2'),
  ('ERRAMZI TAOUFIQ', 'Caissier', 'Equipe 2'),
  ('AMINE ES-SAYED', 'Pompiste', 'Equipe 1'),
  ('ANAS EL GHOMRI', 'Caissier', 'Equipe 2'),
  ('AZIZ BOULHIA', 'Pompiste', 'Equipe 2'),
  ('BILAL EL BOUKHARY', 'Pompiste', 'Equipe 1'),
  ('BOUMRIM ABDESSLAM', 'Pompiste', 'Equipe 1'),
  ('EL AMMARI AYOUB', 'Pompiste', 'Equipe 2'),
  ('EL MAZOURI MOURAD', 'Pompiste', 'Equipe 1'),
  ('ES-SABAN ACHRAF', 'Caissier', 'Equipe 1'),
  ('MOUSSAID MOHAMMED', 'Pompiste', 'Equipe 1'),
  ('ZRIOUL HICHAM', 'Pompiste', 'Equipe 2')
) as v(name, role, team)
where not exists (select 1 from employees where name = v.name);
