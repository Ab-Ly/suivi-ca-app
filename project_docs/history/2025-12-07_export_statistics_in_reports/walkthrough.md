# Walkthrough - Export Statistics in Reports

I have implemented a new feature in the **Reports** section to export the "Sales & Volume Evolution" data (N vs N-1), mimicking the logic from the Statistics section.

## Changes

### 1. New "Rapport Comparatif" Section in Reports
- Added a dedicated card at the top of the **Rapports & Exports** page.
- **Selectors**:
    - **Year**: Select the reference year (e.g., 2025).
    - **Month Range**: Select Start and End months (e.g., Jan - Mar).
- **Action**: "Exporter Comparatif" button downloads an Excel file.

### 2. Standardized Logic (`statisticsUtils.js`)
- Extracted the complex N vs N-1 calculation logic from `ComparisonCharts.jsx` into a reusable utility `fetchComparisonStats`.
- This ensures that the **numbers in the Excel export matches EXACTLY the numbers in the Statistics Charts**.

### 3. Excel Report Content
The exported Excel file (`Rapport_Evolution_YYYY_Month-Month.xlsx`) contains 4 sheets:
1.  **KPIs Globaux**: Total Sales, Fuel Volumes, and Evolution %.
2.  **Détail Mensuel**: Sales broken down by month (Current vs Previous + Evolution).
3.  **Par Catégorie**: Sales broken down by category (Shop, Café, etc.).
4.  **Carburant**: Fuel volumes (Gasoil/SSP) broken down by period.

## Verification

### How to Verify
1.  **Navigate to Reports**: Go to the "Rapports" page.
2.  **Locate the New Section**: Look for the purple-tinted card "Rapport Comparatif d'Évolution".
3.  **Select Period**: Choose Year 2025 (or relevant) and Range Jan-Mar.
4.  **Click Export**: Click the "Exporter Comparatif" button.
5.  **Check File**: Open the downloaded Excel file and compare the numbers with the Statistics page for the same period. They should be identical.
