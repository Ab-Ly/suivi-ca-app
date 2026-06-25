# Walkthrough - Sales Entry Input Improvements

I have refined the input fields in the "Nouvelle Vente" modal to improve usability.

## Changes

### 1. Stuck "0" Fix
- **Problem**: When clicking on "Prix U.", a default "0" was often present and hard to clear.
- **Solution**: The input now defaults to an empty string (placeholder "0" appears instead).
- **Behavior**: If you delete the value, it becomes empty rather than reverting to "0" immediately (except for Quantity on blur, which defaults to 1 for safety).

### 2. Decimal Separator (Comma vs Dot)
- **Problem**: Using the numpad comma often failed or was ignored.
- **Solution**: Inputs now automatically convert commas (`,`) to dots (`.`) as you type.
- **Fields Affected**:
  - Quantity (Articles)
  - Unit Price (Services)
  - Fuel Volume

## Verification
- Open "Nouvelle Vente".
- **Price**: Click "Prix U." -> Should be empty/easy to type in.
- **Decimals**: Type "12,5" -> Should appear as "12.5".
- **Fuel**: Try entering a volume with a comma -> Should convert correctly.
