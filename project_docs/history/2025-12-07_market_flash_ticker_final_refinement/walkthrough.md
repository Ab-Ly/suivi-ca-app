# Market Flash Ticker (Final Refinement)

I have inverted the hierarchy of the performance ticker to prioritize "Macro" trends over "Micro" daily fluctuations.

## Features

### 1. Monthly Trend (Principal Focus)
**Location**: Main Cards (Revenue, Gasoil, SSP).
**Logic**: Compares **Last Month (M-1)** vs **Same Month Last Year (N-1)**.
- **Why**: The user wants to see the structural health of the business first.
- **Label**: "N-1: [Value]" under the main figure.

### 2. Daily Performance (Footer)
**Location**: Bottom bar.
**Logic**: Compares **Yesterday** vs **Day Before Yesterday (J-2)**.
- **Content**: Revenue Growth only.
- **Why**: A quick check on immediate sales performance without distracting from the main trend.

### Data Verification
- **Logs**: Added `console.log` entries to verify the Parallel Fetch logic is correctly separating:
    - Daily (Yesterday)
    - Monthly (M-1)
    - Prev Year Monthly (M-1 @ Year-1)
