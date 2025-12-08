-- Create a table for storing fuel delivery drafts
create table if not exists fuel_delivery_drafts (
    id uuid default gen_random_uuid() primary key,
    -- We can link to auth.users if auth is enabled, but for now we'll keep it simple or nullable
    -- If using Supabase Auth:
    user_id uuid references auth.users(id) on delete cascade,
    
    -- The JSON blob containing the form state
    draft_data jsonb not null default '{}'::jsonb,
    
    -- Metadata
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies (adjust based on actual auth setup)
alter table fuel_delivery_drafts enable row level security;

-- Policy: Users can see/edit only their own drafts
create policy "Users can manage their own drafts"
    on fuel_delivery_drafts
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Trigger to update updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_fuel_delivery_drafts_updated_at
    before update on fuel_delivery_drafts
    for each row
    execute function update_updated_at_column();
