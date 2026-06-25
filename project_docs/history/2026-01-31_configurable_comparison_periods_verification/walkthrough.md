# Configurable Comparison Periods Verification

I have implemented the ability to configure the comparison periods for the Performance Review. Here is how to verify the new features:

## 1. Accessing Configuration
- Locate the new **Settings (Gear) Icon** in the top-right corner of the overview screen, next to the close button.
- Click it to open the "Configuration de la Revue" modal.

## 2. Testing Comparison Modes
Try switching between the different comparison types:

### A. Full Year (Année)
- Select **"Année"**.
- Choose a reference year (e.g., 2025).
- **Verify:**
  - The Intro slide should say "Comparatif Chiffre d'Affaires" and "2025 Vs 2024".
  - Charts should show data for the full year 2025 vs 2024.

### B. Specific Month (Mois)
- Select **"Mois"**.
- Choose a year (e.g., 2025) and a specific month (e.g., "Mars").
- **Verify:**
  - The Intro slide should say "Focus Mensuel" and show "Mars 2025".
  - Charts should compare Mars 2025 vs Mars 2024.

### C. Custom Period (Période)
- Select **"Période"**.
- Choose a year.
- Select a Start Month and End Month (e.g., Janvier to Mars).
- **Verify:**
  - The Intro slide should say "Focus Période" and show "Jan - Mars 2025".
  - Charts should sum up the data for that specific range.

## 3. Data Integrity
- Check the **"Focus CARBURANT"** slide.
  - Ensure values are still displayed in **m3**.
  - Verify the Y-axis labels still show values with the 'm3' unit on a notification line.
- Check other slides to ensure categories (Shop, Café, etc.) are loading correctly.
