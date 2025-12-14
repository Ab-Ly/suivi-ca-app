-- Add new columns to employees table
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS contract_type text, -- CDI, CDD, Interim, Anapec
ADD COLUMN IF NOT EXISTS contract_renewal_date date,
ADD COLUMN IF NOT EXISTS contract_renewal_date_2 date,
ADD COLUMN IF NOT EXISTS interim_agency text, -- Manpower, Tectra, etc.
ADD COLUMN IF NOT EXISTS assignment text, -- Affectation
ADD COLUMN IF NOT EXISTS family_situation text; -- Marié, Célibataire, Enfants...

-- Create Employee Absences table
CREATE TABLE IF NOT EXISTS employee_absences (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date NOT NULL,
    type text NOT NULL, -- Maladie, Congé, Absence Injustifiée
    reason text,
    created_at timestamptz DEFAULT now()
);

-- Create Medical Tracking table
CREATE TABLE IF NOT EXISTS medical_tracking (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
    event_date date NOT NULL DEFAULT CURRENT_DATE,
    event_type text NOT NULL, -- Envoi Dossier, Depot, Remboursement
    status text, -- En cours, Traité, Rejeté
    tracking_number text, -- Num Reference dossier
    amount numeric, -- Montant remboursement (optional)
    notes text,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS (if not already enabled globally, usually good practice)
ALTER TABLE employee_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_tracking ENABLE ROW LEVEL SECURITY;

-- Create policies (assuming public access or simple auth for this app context)
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON employee_absences;
CREATE POLICY "Enable all access for authenticated users" ON employee_absences FOR ALL USING (true);

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON medical_tracking;
CREATE POLICY "Enable all access for authenticated users" ON medical_tracking FOR ALL USING (true);
