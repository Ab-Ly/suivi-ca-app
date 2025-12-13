import { addDays, format, getDay, isSameDay, parseISO } from 'date-fns';

// Constants
export const SHIFT_TYPES = {
    JOUR: 'Jour',
    NUIT: 'Nuit',
    TWENTY_FOUR: '24h',
    REPOS: 'Repos',
    CONGE: 'Congé',
    MALADIE: 'Maladie'
};

export const TEAMS = {
    EQUIPE_1: 'Equipe 1',
    EQUIPE_2: 'Equipe 2',
    STABLE: 'Stable'
};

// Colors for UI
export const SHIFT_COLORS = {
    [SHIFT_TYPES.JOUR]: 'bg-amber-100 text-amber-800 border-amber-200',
    [SHIFT_TYPES.NUIT]: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    [SHIFT_TYPES.TWENTY_FOUR]: 'bg-purple-100 text-purple-800 border-purple-200',
    [SHIFT_TYPES.REPOS]: 'bg-gray-50 text-gray-400 border-gray-100',
    [SHIFT_TYPES.CONGE]: 'bg-green-100 text-green-800 border-green-200',
    [SHIFT_TYPES.MALADIE]: 'bg-red-100 text-red-800 border-red-200',
};

/**
 * Determines the shift for a given date based on the previous week's state.
 * 
 * Rules:
 * - Cycle A (Day Week): Mon-Sat = Jour, Sun = 24h. Next Mon -> Cycle B.
 * - Cycle B (Night Week): Mon-Sat = Nuit, Sun = Repos (technically ending Sat night). Next Mon -> Cycle A.
 * 
 * Logic:
 * We need a reference point (Seed).
 * If we know the state of *any* Sunday, we can project the rest.
 * 
 * Target: 16-11-2025 to 15-12-2025.
 * 16-11-2025 is a Sunday.
 * 
 * User Input likely sets: 
 * - Team 1 on 16/11 (Sun) = 24h. -> Means Team 1 was on Day Cycle preceding it. Next week (17/11+) is Night.
 * - Team 2 on 16/11 (Sun) = Nuit (finish) / Repos. -> Means Team 2 was on Night Cycle preceding it. Next week (17/11+) is Day.
 */

export const calculateProjectedSchedule = (startDate, endDate, employees, seedShifts) => {
    // seedShifts: { 'employeeId-YYYY-MM-DD': 'ShiftType' }
    // We expect the USER to define the FIRST DAY (or first week).
    // The user prompt says "générer automatiquement le planing des jours qui suivent la première saisie".
    // Let's assume the first day of the range (startDate) is the "Pivot".

    const schedule = { ...seedShifts };
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Sort employees by team to process effectively? Not strictly needed.

    // For each employee
    // For each employee
    employees.forEach(emp => {
        let curr = new Date(start);

        // --- Stable Team Logic ---
        if (emp.team === TEAMS.STABLE) {
            while (curr <= end) {
                const dateKey = format(curr, 'yyyy-MM-dd');
                const empKey = `${emp.id}-${dateKey}`;
                if (!schedule[empKey]) {
                    const dayOfWeek = getDay(curr);
                    // 1. Check strict rest day
                    if (emp.stable_rest_day !== undefined && emp.stable_rest_day !== null && emp.stable_rest_day === dayOfWeek) {
                        schedule[empKey] = SHIFT_TYPES.REPOS;
                    } else {
                        // 2. Default shift
                        schedule[empKey] = emp.default_shift || SHIFT_TYPES.JOUR;
                    }
                }
                curr = addDays(curr, 1);
            }
            return;
        }

        // --- Rotating Teams Logic ---
        // We need to determine the "Cycle State" at the start date.
        // Look for a seed on the Start Date.
        const startKey = `${emp.id}-${format(start, 'yyyy-MM-dd')}`;
        let startShift = schedule[startKey];

        // If no start shift, try to infer from Team Default?
        if (!startShift) {
            if (getDay(start) === 0) { // Sunday
                if (emp.team === TEAMS.EQUIPE_1) startShift = SHIFT_TYPES.TWENTY_FOUR;
                if (emp.team === TEAMS.EQUIPE_2) startShift = SHIFT_TYPES.REPOS;
            } else {
                if (emp.team === TEAMS.EQUIPE_1) startShift = SHIFT_TYPES.JOUR;
                if (emp.team === TEAMS.EQUIPE_2) startShift = SHIFT_TYPES.NUIT;
            }
            // APPLY INFERRED SHIFT TO SCHEDULE
            schedule[startKey] = startShift;
        }

        let currentCycle = null; // 'DAY_WEEK' or 'NIGHT_WEEK'

        if (startShift === SHIFT_TYPES.TWENTY_FOUR) currentCycle = 'NIGHT_WEEK';
        else if (startShift === SHIFT_TYPES.REPOS || startShift === SHIFT_TYPES.NUIT) currentCycle = 'DAY_WEEK';
        else if (startShift === SHIFT_TYPES.JOUR) currentCycle = 'DAY_WEEK';

        // Start generating from day 2 (or day 1 if not seeded, but logic typically uses seed for T0)
        // If T0 is seeded, we loop T1..End. 
        // Logic below assumes curr starts at start+1?
        // Wait, in previous logic: `let curr = addDays(start, 1);`
        // We must ensure T0 is handled if not present? 
        // Actually, if T0 is inferred above, we should set it in schedule if missing?
        // Let's stick to the existing flow: Infer state from T0, then generate T1+.

        curr = addDays(start, 1);
        while (curr <= end) {
            const dateKey = format(curr, 'yyyy-MM-dd');
            const empKey = `${emp.id}-${dateKey}`;
            const dayOfWeek = getDay(curr);

            if (!schedule[empKey]) {
                // *** PRIORITY CHECK: UNIVERSAL STABLE REST DAY ***
                if (emp.stable_rest_day !== undefined && emp.stable_rest_day !== null && emp.stable_rest_day === dayOfWeek) {
                    schedule[empKey] = SHIFT_TYPES.REPOS;
                } else {
                    // Normal Rotation Logic
                    let nextShift = '';
                    if (dayOfWeek === 1) { // Monday
                        if (currentCycle === 'DAY_WEEK') nextShift = SHIFT_TYPES.JOUR;
                        else nextShift = SHIFT_TYPES.NUIT;
                    } else if (dayOfWeek === 0) { // Sunday
                        if (currentCycle === 'DAY_WEEK') {
                            nextShift = SHIFT_TYPES.TWENTY_FOUR;
                            currentCycle = 'NIGHT_WEEK';
                        } else {
                            nextShift = SHIFT_TYPES.REPOS;
                            currentCycle = 'DAY_WEEK';
                        }
                    } else { // Tue-Sat
                        if (currentCycle === 'DAY_WEEK') nextShift = SHIFT_TYPES.JOUR;
                        else nextShift = SHIFT_TYPES.NUIT;
                    }
                    schedule[empKey] = nextShift;
                }
            } else {
                // Existing manual shift found
                // We must update our cycle state based on it to keep sync?
                // Or just ignore? Simpler to ignore for now, but potentially "Congé" breaks cycle tracking?
                // For now, let's assume manual overrides don't break the underlying cycle logic for simple cases.
                // But wait, if someone puts "Nuit" on a Day week manually? 
                // Realistically, we should probably update `currentCycle` based on what we *would* have done 
                // to keep the rhythm for next week.

                // Let's just shadow-run the logic to update `currentCycle` even if validation skipped?
                // Sunday logic specifically updates `currentCycle`.
                if (dayOfWeek === 0) {
                    if (currentCycle === 'DAY_WEEK') currentCycle = 'NIGHT_WEEK';
                    else currentCycle = 'DAY_WEEK';
                }
            }
            curr = addDays(curr, 1);
        }
    });

    return schedule;
};
