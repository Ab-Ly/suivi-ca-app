-- Create a table for storing money counting drafts
create table if not exists money_counting_drafts (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    
    -- The JSON blob containing the count state
    draft_data jsonb not null default '{}'::jsonb,
    
    -- Metadata
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table money_counting_drafts enable row level security;

-- Policy: Users can see/edit only their own drafts
create policy "Users can manage their own money counting drafts"
    on money_counting_drafts
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Trigger to update updated_at
create trigger update_money_counting_drafts_updated_at
    before update on money_counting_drafts
    for each row
    execute function update_updated_at_column();
