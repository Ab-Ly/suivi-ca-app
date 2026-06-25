# Walkthrough - Statistics and Comparison Feature

I have implemented the new "Statistiques" tab, allowing you to enter historical data and view year-over-year comparisons.

## Changes

### Database Migration
#### [supabase/migrations/20251204_create_historical_sales.sql](file:///Users/ly/Desktop/antigravity%20project/suivi-ca-app/supabase/migrations/20251204_create_historical_sales.sql)
> [!IMPORTANT]
> You must run the SQL in this file in your Supabase Dashboard (SQL Editor) to create the `historical_sales` table. Without this, the feature will not work.

### Components

#### [NEW] [src/components/Statistics.jsx](file:///Users/ly/Desktop/antigravity%20project/suivi-ca-app/src/components/Statistics.jsx)
The main container for the statistics view, featuring tabs for "Vue d'ensemble" and "Saisie Historique".

#### [NEW] [src/components/stats/HistoricalEntry.jsx](file:///Users/ly/Desktop/antigravity%20project/suivi-ca-app/src/components/stats/HistoricalEntry.jsx)
A form to manually enter turnover data for previous years, broken down by month and category.

#### [NEW] [src/components/stats/ComparisonCharts.jsx](file:///Users/ly/Desktop/antigravity%20project/suivi-ca-app/src/components/stats/ComparisonCharts.jsx)
Visualizes the comparison between the current year and the previous year using bar charts and KPI cards.

### Navigation
- Added "Statistiques" link to the sidebar in `Layout.jsx`.
- Added `/statistics` route in `App.jsx`.

## Verification Results

### Manual Verification
1.  **Run the SQL Migration**: Copy the content of `supabase/migrations/20251204_create_historical_sales.sql` and execute it in Supabase.
2.  **Navigate to Statistics**: Click on the new "Statistiques" link in the sidebar.
3.  **Enter Data**: Go to "Saisie Historique", select "2024", and enter some data. Click "Enregistrer".
4.  **View Comparison**: Switch to "Vue d'ensemble" and verify that the 2024 data appears on the chart alongside 2025 data.
