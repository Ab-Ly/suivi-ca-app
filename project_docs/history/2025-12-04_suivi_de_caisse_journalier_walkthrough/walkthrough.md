# Suivi de Caisse Journalier - Walkthrough

I have implemented the "Suivi de Caisse Journalier" feature, which allows tracking of daily cash operations, entity balances, and expense funds.

## Changes Implemented

### Database
- Created migration `supabase/migrations/20251204_create_daily_cash.sql` which adds:
    - `daily_cash_entities`: Table for storing entities (Sociétés).
    - `daily_cash_operations`: Table for storing daily transactions (IN/OUT).

### Daily Cash Tracking (New Features)
- **Tableau Journalier (Spreadsheet View):**
    - **Standard Accounting Layout:** Left Column = **DÉBIT (RECETTES)**, Right Column = **CRÉDIT (DÉPENSES)**.
    - **Automatic Carry-Over:** "Report à Nouveau" (J-1) is automatically calculated.
    - **Balance-Only View:** The table lists Closing Balances, "Recette à 8H", and "RESTE J-1".
    - **No Report Header:** The "Report à Nouveau" header row has been removed. "RESTE J-1" is now a specific line item in the Debit column.
    - **Logic:** Positive Balances + Recette 8H + Reste J-1 -> **DÉBIT (Left)**, Negative Balances -> **CRÉDIT (Right)**.
    - **Ecart:** Instead of a Total General, the table displays the **ÉCART** (Difference) between Debit and Credit totals.
- **Entity Tracking:**
    - Cards now show Opening Balance (Report J-1), Daily Movement, and Closing Balance.
- **Expense Fund:**
    - Now tracks Opening and Closing balances automatically.

### Frontend
- **New Page**: `DailyCashTracking` component with 4 tabs:
    1.  **Suivi Entités**: View balances and daily movements for each entity.
    2.  **Caisse Dépense**: View expense fund balance.
    3.  **Opérations Journalières**: List of all transactions for the selected date.
    4.  **Rapprochement**: Summary of Total Debit vs Total Credit and daily balance.
- **Navigation**: Added "Suivi Caisse" link in the sidebar (`Layout.jsx`).
- **Routing**: Added `/daily-cash` route in `App.jsx`.

## Verification Steps

### 1. Apply Database Migration
> [!IMPORTANT]
> The database migration could not be applied automatically because the Supabase project is not linked locally.
> Please run the following command in your terminal or copy the SQL content to your Supabase Dashboard SQL Editor:

**Option A: SQL Editor (Recommended)**
Copy the content of `supabase/migrations/20251204_create_daily_cash.sql` and run it in the Supabase SQL Editor.

**Option B: Terminal**
If you have Supabase CLI configured:
```bash
npx supabase db push
```

### 2. Verify the Feature
1.  Open the app and navigate to **Suivi Caisse**.
2.  **Add a Transaction**:
    - Click "Nouvelle Opération".
    - Select "Opération Société", choose "STE OTRADI", select "Recette" (IN), enter Amount (e.g., 1000).
    - Click "Enregistrer".
3.  **Check Tabs**:
    - **Suivi Entités**: Verify "STE OTRADI" shows the movement.
    - **Opérations Journalières**: Verify the transaction appears in the list.
    - **Rapprochement**: Verify "Total Recettes" includes the amount.

### 3. Test Reconciliation
1.  Add a "Dépense" (OUT) operation (e.g., 200).
2.  Go to **Rapprochement** tab.
3.  Verify:
    - Total Recettes = 1000
    - Total Dépenses = 200
    - Solde Journalier = 800
