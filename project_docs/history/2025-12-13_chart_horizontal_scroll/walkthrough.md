# Walkthrough - Chart Horizontal Scroll

I have updated the Dashboard charts to handle monthly data better. Instead of squeezing 30 days of bars into a small space, the charts will now become scrollable if the data is too dense.

## Changes
### `Dashboard.jsx`
- **Horizontal Scroll**: Wrapped both the "Évolution du Chiffre d'Affaire" (Sales) and "Évolution Volume Carburant" (Fuel) charts in a scrollable container.
- **Dynamic Width**: The inner chart width is now calculated dynamically (`Math.max(600, data.length * 60)`).
    - If you have only a few days, it fits the screen width (100%).
    - If you have 30 days, it expands to ensure each bar has at least **60 pixels** of space, activating the horizontal scrollbar.

## Verification
### Manual Verification
1. Go to **Tableau de bord**.
2. Select **Mois** (Month) filter.
3. If the month has many days (e.g., > 10-15 days), you should see a horizontal scrollbar appear at the bottom of the chart card.
4. Scroll right to see the rest of the month.
