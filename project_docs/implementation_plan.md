# Implementation Plan - SUIVI CH AFFAIRE

## Goal Description
Create a modern, mobile-responsive web application for tracking sales and stock for a car service business. The app will handle stockable items (lubricants) and non-stockable services, with a focus on "Notion-like" aesthetics.

## User Review Required
> [!IMPORTANT]
> **Supabase Credentials**: I will need your Supabase URL and Anon Key to connect the application.
> **Data Import**: Please upload the file containing Articles/Quantity/Price so I can create the import script.

## Proposed Changes

### Tech Stack
- **Frontend**: React (Vite), Tailwind CSS
- **Database**: Supabase
- **Deployment**: Netlify
- **Icons**: Lucide React
- **Charts**: Recharts (for turnover visualization)

### Database Schema
#### [NEW] [schema.sql](file:///d:/SUIVI%20CA%20APP/supabase/schema.sql)
- `articles`: id, name, type (stockable/service), category (shop, cafe, bosch_service, etc.), price, current_stock
- `sales`: id, article_id, quantity, total_price, date, created_at
- `stock_movements`: id, article_id, type (in/out), quantity, date

### Component Structure
#### [NEW] [src/components](file:///d:/SUIVI%20CA%20APP/src/components)
- `Layout.jsx`: Main shell with mobile-friendly navigation.
- `Dashboard.jsx`: Turnover stats and charts.
- `SalesEntry.jsx`: Popup modal for entering sales with autocomplete.
- `StockStatus.jsx`: Dedicated tab for stock levels and value.
- `ArticleManager.jsx`: Add/Edit articles.

### Service Integration
- **Migration**: Update all existing articles to `category='Lubrifiants'`.
- **New Services**: Insert "Shop", "Cafe", "Main d'oeuvre", "Bosch Car Service" as `type='service'`.
- **Sales Entry**: Allow price editing for `type='service'` items.
- **Lubricant Split**:
    - Add `sales_location` column to `sales` table (values: 'piste', 'bosch').
    - In `SalesEntry`, show radio buttons for "Piste" vs "Bosch" when a Lubricant is selected.
    - Update `Dashboard` to group lubricant sales by this new column.
- **Custom Date**: Add a date picker in `SalesEntry` to allow backdating sales.
- **Sales History Filters**: Add filters to `Sales.jsx`:
    - Date Range (Start/End)
    - Article Name Search
    - Category Filter

## UI Redesign Plan
Refactor the UI to match the "Super Finti" aesthetic (Modern, Colorful, Gradients).
1.  **Global Styles**:
    -   Import a modern font (e.g., 'Poppins' or 'Inter').
    -   Define gradient utility classes for cards (Green, Orange, Blue, Purple).
    -   Set background to a soft light gray.
2.  **Layout**:
    -   Sidebar: White background, clean icons, no heavy borders.
    -   Header: Purple gradient background or clean white with search bar.
3.  **Dashboard**:
    -   **Stat Cards**: Replace simple cards with colorful gradient cards.
    -   **Charts**: Update Recharts styling to be softer/rounded.
    -   **Recent Transactions**: Style the list with icons and better spacing.

## Verification Plan
### Automated Tests
- Run `npm run dev` to verify build.
- Check console for errors.

### Manual Verification
- Verify "Notion-like" styling (cards, typography).
- Test Sales Entry flow (search article -> enter qty -> save).
- Verify Stock deduction logic.
- Test Export functionality.
