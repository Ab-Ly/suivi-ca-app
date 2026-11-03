-- ==============================================================================
-- Migration : Table des Arrêtés de Compte / Pointage des Sociétés
-- Cette table permet d'enregistrer les points de repère (snapshots / arrêtés)
-- SANS JAMAIS modifier ni supprimer aucune ligne d'historique de daily_cash_operations.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.daily_cash_entity_closings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    entity_id UUID NOT NULL REFERENCES public.daily_cash_entities(id) ON DELETE CASCADE,
    closing_date DATE NOT NULL,
    closing_balance NUMERIC NOT NULL,
    total_in NUMERIC DEFAULT 0,
    total_out NUMERIC DEFAULT 0,
    notes TEXT,
    closed_by TEXT DEFAULT 'Gestionnaire',
    CONSTRAINT unique_entity_closing_date UNIQUE (entity_id, closing_date)
);

-- Index pour recherche rapide du dernier arrêté par société
CREATE INDEX IF NOT EXISTS idx_entity_closings_lookup 
ON public.daily_cash_entity_closings (entity_id, closing_date DESC);

-- Activation de Row Level Security (RLS)
ALTER TABLE public.daily_cash_entity_closings ENABLE ROW LEVEL SECURITY;

-- Politique d'accès totale pour les utilisateurs de l'application
DROP POLICY IF EXISTS "Enable all access for all users" ON public.daily_cash_entity_closings;
CREATE POLICY "Enable all access for all users" ON public.daily_cash_entity_closings
    FOR ALL USING (true) WITH CHECK (true);

