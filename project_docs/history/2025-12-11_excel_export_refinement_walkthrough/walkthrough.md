# Excel Export Refinement Walkthrough

I have finalized the Excel export logic to meet all user requirements.

## Changes Implemented

### [excelExport.js](file:///Users/ly/Desktop/antigravity%20project/suivi-ca-app/src/utils/excelExport.js)

- **Dynamic Sorting**: Rows are now sorted **per day based on the shift worked**.
    - If an employee works Day/24h, they appear in the top block ("Equipe 1").
    - If they work Night, they appear below ("Equipe 2").
    - This eliminates the mixing of teams seen in previous versions.
- **Team Column**:
    - **Equipe 1**: For all Day / 24h work shifts.
    - **Equipe 2**: For all Night shifts.
    - **Empty**: For Rest/Absence.
- **Time Logic**:
    - Fixed Start times to **8:00AM** and **6:00PM** (18:00).
    - Fixed Timezone shift issues using UTC.
- **Formula**:
    - Column J calculates working hours correctly `=(End-Pause)-Start`.

## Verification

The export `Planning_Istiraha_...xlsx` should now reflect:
1. **Sorted Blocks**: All "Equipe 1" rows first, then all "Equipe 2" rows.
2. **Correct Labels**: Only "Equipe 1" or "Equipe 2".
3. **Accurate Times**: 8:00AM / 6:00PM start.
