import { supabase } from '../lib/supabase';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const CATEGORIES = ['Shop', 'Café', 'Bosch Service', "Main d'oeuvre", 'Pneumatique', 'Lubrifiant Piste', 'Lubrifiant Bosch'];

export const getMappedCategory = (category, location, articleName = '') => {
    if (articleName && articleName.toLowerCase().includes("main d'oeuvre")) return "Main d'oeuvre";
    if (category.toLowerCase().includes('shop')) return 'Shop';
    if (category.toLowerCase().includes('café') || category.toLowerCase().includes('cafe')) return 'Café';
    if (category.toLowerCase().includes('bosch service')) return 'Bosch Service';
    if (category.toLowerCase().includes("main d'oeuvre")) return "Main d'oeuvre";
    if (category.toLowerCase().includes('pneumatique')) return 'Pneumatique';
    if (category.toLowerCase().includes('lubrifiant')) {
        if (location === 'bosch' || category.toLowerCase().includes('bosch')) return 'Lubrifiant Bosch';
        return 'Lubrifiant Piste';
    }
    return 'Autre';
};

export const getDateRange = (period, year, selectedMonth, customStartMonth, customEndMonth) => {
    let start = new Date();
    let end = new Date();
    let prevStart = new Date();
    let prevEnd = new Date();

    if (period === 'day') {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        prevStart = new Date(start); prevStart.setFullYear(start.getFullYear() - 1);
        prevEnd = new Date(end); prevEnd.setFullYear(end.getFullYear() - 1);
    } else if (period === 'week') {
        const day = start.getDay() || 7; // 1 (Mon) to 7 (Sun)
        if (day !== 1) start.setHours(-24 * (day - 1));
        start.setHours(0, 0, 0, 0);
        end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);

        prevStart = new Date(start); prevStart.setFullYear(start.getFullYear() - 1);
        prevEnd = new Date(end); prevEnd.setFullYear(end.getFullYear() - 1);
    } else if (period === 'month') {
        start = new Date(year, selectedMonth, 1);
        end = new Date(year, selectedMonth + 1, 0, 23, 59, 59, 999);

        prevStart = new Date(year - 1, selectedMonth, 1);
        prevEnd = new Date(year - 1, selectedMonth + 1, 0, 23, 59, 59, 999);
    } else if (period === 'custom') {
        start = new Date(year, customStartMonth, 1);
        end = new Date(year, customEndMonth + 1, 0, 23, 59, 59, 999);

        prevStart = new Date(year - 1, customStartMonth, 1);
        prevEnd = new Date(year - 1, customEndMonth + 1, 0, 23, 59, 59, 999);
    } else {
        // Year view
        start = new Date(year, 0, 1);
        end = new Date(year, 11, 31, 23, 59, 59);
        prevStart = new Date(year - 1, 0, 1);
        prevEnd = new Date(year - 1, 11, 31, 23, 59, 59);
    }
    return { start, end, prevStart, prevEnd };
};

export const fetchComparisonStats = async (period, year, selectedMonth, customStartMonth, customEndMonth) => {
    try {
        const { start, end, prevStart, prevEnd } = getDateRange(period, year, selectedMonth, customStartMonth, customEndMonth);

        // Parallelize all data fetching
        const [
            { data: currentSales },
            { data: previousSales },
            { data: historyPrevData },
            { data: historyCurrData },
            { data: currentFuelData },
            { data: prevFuelData }
        ] = await Promise.all([
            supabase.from('sales').select('total_price, sale_date, sales_location, articles(name, category)').gte('sale_date', start.toISOString()).lte('sale_date', end.toISOString()),
            supabase.from('sales').select('total_price, sale_date, sales_location, articles(name, category)').gte('sale_date', prevStart.toISOString()).lte('sale_date', prevEnd.toISOString()),
            supabase.from('historical_sales').select('*').eq('year', year - 1),
            supabase.from('historical_sales').select('*').eq('year', year),
            supabase.from('fuel_sales').select('*').gte('sale_date', start.toISOString()).lte('sale_date', end.toISOString()),
            supabase.from('fuel_sales').select('*').gte('sale_date', prevStart.toISOString()).lte('sale_date', prevEnd.toISOString())
        ]);

        let historyPrevious = historyPrevData || [];
        let historyCurrent = historyCurrData || [];
        let fuelSalesCurrent = currentFuelData || [];
        let fuelSalesPrevious = prevFuelData || [];

        let processedData = [];
        let currentTotal = 0;
        let previousTotal = 0;
        let categoryStats = {};

        const historyKeysCurrent = new Set();
        const historyKeysPrevious = new Set();

        if (period === 'year' || period === 'custom') {
            historyCurrent?.forEach(h => historyKeysCurrent.add(`${h.month - 1}-${h.category}`));
            historyPrevious?.forEach(h => historyKeysPrevious.add(`${h.month - 1}-${h.category}`));
        }

        // Initialize Data Structure
        if (period === 'year') {
            processedData = Array.from({ length: 12 }, (_, i) => ({ name: MONTHS[i], current: 0, previous: 0, month: i + 1 }));
        } else if (period === 'custom') {
            const rangeLen = customEndMonth - customStartMonth + 1;
            processedData = Array.from({ length: rangeLen }, (_, i) => ({
                name: MONTHS[customStartMonth + i],
                current: 0,
                previous: 0,
                month: customStartMonth + i + 1
            }));
        } else if (period === 'month') {
            const daysInMonth = end.getDate();
            processedData = Array.from({ length: daysInMonth }, (_, i) => ({ name: (i + 1).toString(), current: 0, previous: 0, day: i + 1 }));
        } else if (period === 'week') {
            const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
            processedData = days.map(d => ({ name: d, current: 0, previous: 0 }));
        } else if (period === 'day') {
            processedData = Array.from({ length: 24 }, (_, i) => ({ name: `${i}h`, current: 0, previous: 0, hour: i }));
        }

        const addToData = (dateStr, amount, isCurrent) => {
            const date = new Date(dateStr);
            let index = -1;

            if (period === 'year') index = date.getMonth();
            else if (period === 'custom') {
                const m = date.getMonth();
                if (m >= customStartMonth && m <= customEndMonth) index = m - customStartMonth;
            }
            else if (period === 'month') index = date.getDate() - 1;
            else if (period === 'week') {
                const day = date.getDay();
                index = day === 0 ? 6 : day - 1;
            }
            else if (period === 'day') index = date.getHours();

            if (index >= 0 && index < processedData.length) {
                if (isCurrent) processedData[index].current += amount;
                else processedData[index].previous += amount;
            }
        };



        CATEGORIES.forEach(cat => categoryStats[cat] = { name: cat, current: 0, previous: 0 });

        currentSales?.forEach(sale => {
            const resultDate = new Date(sale.sale_date);
            if (resultDate < start || resultDate > end) return;

            const mappedCategory = getMappedCategory(sale.articles?.category || 'Autre', sale.sales_location, sale.articles?.name);
            // Granular Check: Only skip if THIS category has history for THIS month
            if ((period === 'year' || period === 'custom') && historyKeysCurrent.has(`${new Date(sale.sale_date).getMonth()}-${mappedCategory}`)) return;

            const amount = sale.total_price;
            currentTotal += amount;
            addToData(sale.sale_date, amount, true);
            if (categoryStats[mappedCategory]) categoryStats[mappedCategory].current += amount;
        });

        previousSales?.forEach(sale => {
            const resultDate = new Date(sale.sale_date);
            if (resultDate < prevStart || resultDate > prevEnd) return;

            const mappedCategory = getMappedCategory(sale.articles?.category || 'Autre', sale.sales_location, sale.articles?.name);
            // Granular Check
            if ((period === 'year' || period === 'custom') && historyKeysPrevious.has(`${new Date(sale.sale_date).getMonth()}-${mappedCategory}`)) return;

            const amount = sale.total_price;
            previousTotal += amount;
            addToData(sale.sale_date, amount, false);
            if (categoryStats[mappedCategory]) categoryStats[mappedCategory].previous += amount;
        });

        // Historical Data (Year or Custom)
        if (period === 'year' || period === 'custom') {
            const isMonthInRange = (m) => {
                if (period === 'year') return true;
                return (m - 1) >= customStartMonth && (m - 1) <= customEndMonth;
            };
            const getIndex = (m) => period === 'year' ? m - 1 : (m - 1) - customStartMonth;

            historyCurrent?.forEach(item => {
                if (item.month >= 1 && item.month <= 12 && !item.category.includes('Volume')) {
                    if (isMonthInRange(item.month)) {
                        const idx = getIndex(item.month);
                        if (processedData[idx]) processedData[idx].current += item.amount;
                        currentTotal += item.amount;
                        if (categoryStats[item.category]) categoryStats[item.category].current += item.amount;
                    }
                }
            });

            historyPrevious?.forEach(item => {
                if (item.month >= 1 && item.month <= 12 && !item.category.includes('Volume')) {
                    if (isMonthInRange(item.month)) {
                        const idx = getIndex(item.month);
                        if (processedData[idx]) processedData[idx].previous += item.amount;
                        previousTotal += item.amount;
                        if (categoryStats[item.category]) categoryStats[item.category].previous += item.amount;
                    }
                }
            });
        }

        // Fuel Data
        let fuelProcessedData = [];
        // Initialize based on period (similar to processedData)
        if (period === 'year') {
            fuelProcessedData = MONTHS.map(label => ({ name: label, gasoil: 0, ssp: 0, gasoilPrev: 0, sspPrev: 0 }));
        } else if (period === 'custom') {
            const rangeLen = customEndMonth - customStartMonth + 1;
            fuelProcessedData = Array.from({ length: rangeLen }, (_, i) => ({ name: MONTHS[customStartMonth + i], gasoil: 0, ssp: 0, gasoilPrev: 0, sspPrev: 0 }));
        } else if (period === 'month') {
            const daysInMonth = end.getDate();
            fuelProcessedData = Array.from({ length: daysInMonth }, (_, i) => ({ name: (i + 1).toString(), gasoil: 0, ssp: 0, gasoilPrev: 0, sspPrev: 0 }));
        } else if (period === 'week') {
            const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
            fuelProcessedData = days.map(d => ({ name: d, gasoil: 0, ssp: 0, gasoilPrev: 0, sspPrev: 0 }));
        } else if (period === 'day') {
            fuelProcessedData = Array.from({ length: 24 }, (_, i) => ({ name: `${i}h`, gasoil: 0, ssp: 0, gasoilPrev: 0, sspPrev: 0 }));
        }

        const addToFuelData = (dateStr, qty, type, isCurrent) => {
            const date = new Date(dateStr);
            let index = -1;
            if (period === 'year') index = date.getMonth();
            else if (period === 'custom') {
                const m = date.getMonth();
                if (m >= customStartMonth && m <= customEndMonth) index = m - customStartMonth;
            } else if (period === 'month') index = date.getDate() - 1;
            else if (period === 'week') {
                const day = date.getDay();
                index = day === 0 ? 6 : day - 1;
            } else if (period === 'day') index = date.getHours();

            if (index >= 0 && index < fuelProcessedData.length) {
                if (isCurrent) {
                    if (type === 'Gasoil') fuelProcessedData[index].gasoil += qty;
                    else if (type === 'SSP') fuelProcessedData[index].ssp += qty;
                } else {
                    if (type === 'Gasoil') fuelProcessedData[index].gasoilPrev += qty;
                    else if (type === 'SSP') fuelProcessedData[index].sspPrev += qty;
                }
            }
        };

        let totalGasoil = 0, totalSSP = 0, totalGasoilPrev = 0, totalSSPPrev = 0;

        fuelSalesCurrent.forEach(sale => {
            const resultDate = new Date(sale.sale_date);
            if (resultDate < start || resultDate > end) return;

            const histCategory = sale.fuel_type === 'Gasoil' ? 'Gasoil Volume' : (sale.fuel_type === 'SSP' ? 'SSP Volume' : '');
            // Granular Check
            if ((period === 'year' || period === 'custom') && histCategory && historyKeysCurrent.has(`${new Date(sale.sale_date).getMonth()}-${histCategory}`)) return;

            const qty = Number(sale.quantity_liters);
            addToFuelData(sale.sale_date, qty, sale.fuel_type, true);
            if (sale.fuel_type === 'Gasoil') totalGasoil += qty;
            else if (sale.fuel_type === 'SSP') totalSSP += qty;
        });

        fuelSalesPrevious.forEach(sale => {
            const resultDate = new Date(sale.sale_date);
            if (resultDate < prevStart || resultDate > prevEnd) return;

            const histCategory = sale.fuel_type === 'Gasoil' ? 'Gasoil Volume' : (sale.fuel_type === 'SSP' ? 'SSP Volume' : '');
            // Granular Check
            if ((period === 'year' || period === 'custom') && histCategory && historyKeysPrevious.has(`${new Date(sale.sale_date).getMonth()}-${histCategory}`)) return;

            const qty = Number(sale.quantity_liters);
            addToFuelData(sale.sale_date, qty, sale.fuel_type, false);
            if (sale.fuel_type === 'Gasoil') totalGasoilPrev += qty;
            else if (sale.fuel_type === 'SSP') totalSSPPrev += qty;
        });

        if (period === 'year' || period === 'custom') {
            const isMonthInRange = (m) => {
                if (period === 'year') return true;
                return (m - 1) >= customStartMonth && (m - 1) <= customEndMonth;
            };
            const getIndex = (m) => period === 'year' ? m - 1 : (m - 1) - customStartMonth;

            historyCurrent?.forEach(item => {
                const amount = Number(item.amount) || 0;
                if (item.month >= 1 && item.month <= 12 && amount > 0 && isMonthInRange(item.month)) {
                    const idx = getIndex(item.month);
                    const cat = (item.category || '').toLowerCase();
                    if (cat.includes('gasoil')) { if (fuelProcessedData[idx]) fuelProcessedData[idx].gasoil += amount; totalGasoil += amount; }
                    else if (cat.includes('ssp') || cat.includes('sans plomb')) { if (fuelProcessedData[idx]) fuelProcessedData[idx].ssp += amount; totalSSP += amount; }
                }
            });
            historyPrevious?.forEach(item => {
                const amount = Number(item.amount) || 0;
                if (item.month >= 1 && item.month <= 12 && amount > 0 && isMonthInRange(item.month)) {
                    const idx = getIndex(item.month);
                    const cat = (item.category || '').toLowerCase();
                    if (cat.includes('gasoil')) { if (fuelProcessedData[idx]) fuelProcessedData[idx].gasoilPrev += amount; totalGasoilPrev += amount; }
                    else if (cat.includes('ssp') || cat.includes('sans plomb')) { if (fuelProcessedData[idx]) fuelProcessedData[idx].sspPrev += amount; totalSSPPrev += amount; }
                }
            });
        }
        else if (period === 'month') {
            // 1. Calculate totals from REAL daily sales first
            let realCurrentTotal = 0;
            let realPreviousTotal = 0;

            currentSales?.forEach(s => realCurrentTotal += s.total_price);
            previousSales?.forEach(s => realPreviousTotal += s.total_price);

            // 2. Determine if we need to use historical data
            // Use historical if real sales are 0 (or very close to 0)
            const useHistoricalCurrent = realCurrentTotal === 0;
            const useHistoricalPrevious = realPreviousTotal === 0;

            // Fuel check
            const realGasoil = fuelSalesCurrent.reduce((acc, s) => acc + (s.fuel_type === 'Gasoil' ? Number(s.quantity_liters) : 0), 0);
            const realSSP = fuelSalesCurrent.reduce((acc, s) => acc + (s.fuel_type === 'SSP' ? Number(s.quantity_liters) : 0), 0);
            const useFuelHistoricalCurrent = realGasoil === 0 && realSSP === 0;

            const realGasoilPrev = fuelSalesPrevious.reduce((acc, s) => acc + (s.fuel_type === 'Gasoil' ? Number(s.quantity_liters) : 0), 0);
            const realSSPPrev = fuelSalesPrevious.reduce((acc, s) => acc + (s.fuel_type === 'SSP' ? Number(s.quantity_liters) : 0), 0);
            const useFuelHistoricalPrevious = realGasoilPrev === 0 && realSSPPrev === 0;

            // 3. Apply Historical Data if needed
            if (useHistoricalCurrent) {
                const histCurrMonth = historyCurrent?.filter(h => h.month === selectedMonth + 1);
                histCurrMonth?.forEach(item => {
                    if (!item.category.includes('Volume')) {
                        currentTotal += item.amount;
                        if (categoryStats[item.category]) categoryStats[item.category].current += item.amount;
                        else categoryStats[item.category] = { name: item.category, current: item.amount, previous: 0 };
                    }
                    if (item.category === 'Gasoil Volume' && useFuelHistoricalCurrent) totalGasoil += item.amount;
                    if (item.category === 'SSP Volume' && useFuelHistoricalCurrent) totalSSP += item.amount;
                });
            }

            if (useHistoricalPrevious) {
                const histPrevMonth = historyPrevious?.filter(h => h.month === selectedMonth + 1);
                histPrevMonth?.forEach(item => {
                    if (!item.category.includes('Volume')) {
                        previousTotal += item.amount;
                        if (categoryStats[item.category]) categoryStats[item.category].previous += item.amount;
                        else if (!categoryStats[item.category]) categoryStats[item.category] = { name: item.category, current: 0, previous: item.amount };
                        else categoryStats[item.category].previous += item.amount;
                    }
                    if (item.category === 'Gasoil Volume' && useFuelHistoricalPrevious) totalGasoilPrev += item.amount;
                    if (item.category === 'SSP Volume' && useFuelHistoricalPrevious) totalSSPPrev += item.amount;
                });
            }
        }
        if (period === 'week') {
            const realGasoilPrev = fuelSalesPrevious.reduce((acc, s) => acc + (s.fuel_type === 'Gasoil' ? Number(s.quantity_liters) : 0), 0);
            const realSSPPrev = fuelSalesPrevious.reduce((acc, s) => acc + (s.fuel_type === 'SSP' ? Number(s.quantity_liters) : 0), 0);

            if (realGasoilPrev === 0 && realSSPPrev === 0) {
                // FALLBACK: Use Historical Monthly Average for Week View
                totalGasoilPrev = 0;
                totalSSPPrev = 0;

                for (let i = 0; i < 7; i++) {
                    const dDate = new Date(prevStart);
                    dDate.setDate(prevStart.getDate() + i);
                    const monthInfo = dDate.getMonth() + 1;
                    const daysInMonth = new Date(year - 1, monthInfo, 0).getDate();

                    const histMonth = historyPrevious?.filter(h => h.month === monthInfo);
                    let gasoilAvg = 0;
                    let sspAvg = 0;

                    histMonth?.forEach(item => {
                        const amount = item.amount || 0;
                        const daily = daysInMonth > 0 ? amount / daysInMonth : 0;
                        if (item.category === 'Gasoil Volume') gasoilAvg += daily;
                        if (item.category === 'SSP Volume') sspAvg += daily;
                    });

                    if (fuelProcessedData[i]) {
                        fuelProcessedData[i].gasoilPrev = gasoilAvg;
                        fuelProcessedData[i].sspPrev = sspAvg;
                        totalGasoilPrev += gasoilAvg;
                        totalSSPPrev += sspAvg;
                    }
                }
            }

            // ADJUST KPI FOR FAIR COMPARISON (Current Week)
            const today = new Date();
            const currentWeekStart = new Date(today);
            const day = currentWeekStart.getDay() || 7;
            if (day !== 1) currentWeekStart.setHours(-24 * (day - 1));
            currentWeekStart.setHours(0, 0, 0, 0);

            const isCurrentWeek = start.getTime() === currentWeekStart.getTime();

            if (isCurrentWeek) {
                const dayIndex = (today.getDay() + 6) % 7; // 0 (Mon) to 6 (Sun)
                // Re-calculate Total to ONLY include up to today
                totalGasoilPrev = fuelProcessedData.slice(0, dayIndex + 1).reduce((acc, d) => acc + d.gasoilPrev, 0);
                totalSSPPrev = fuelProcessedData.slice(0, dayIndex + 1).reduce((acc, d) => acc + d.sspPrev, 0);
            }
        }

        if (period === 'month') {
            // SPECIAL LOGIC: User Requested Average Daily Volume for N-1
            // Formula: Total N-1 / Days in Month (Average per Day)
            const daysInMonth = fuelProcessedData.length;
            const avgGasoilPrev = daysInMonth > 0 ? totalGasoilPrev / daysInMonth : 0;
            const avgSSPPrev = daysInMonth > 0 ? totalSSPPrev / daysInMonth : 0;

            // Flatten the Previous Curve to the Average
            fuelProcessedData.forEach(d => {
                d.gasoilPrev = avgGasoilPrev;
                d.sspPrev = avgSSPPrev;
            });

            // ADJUST KPI TOTALS FOR FAIR COMPARISON (Current Month Only)
            const today = new Date();
            const isCurrentMonth = today.getFullYear() === year && today.getMonth() === selectedMonth;

            if (isCurrentMonth) {
                const currentDay = today.getDate();

                // Find the last day that has ACTUAL data entered (Gasoil or SSP > 0)
                let lastDayWithData = 0;

                fuelProcessedData.forEach((d, i) => {
                    if (i + 1 <= currentDay && (d.gasoil > 0 || d.ssp > 0)) {
                        lastDayWithData = i + 1;
                    }
                });

                const multiplier = lastDayWithData;

                // Update the "Previous Total" to be the Target for the effective days (Avg * Multiplier)
                totalGasoilPrev = avgGasoilPrev * multiplier;
                totalSSPPrev = avgSSPPrev * multiplier;
            }
        }


        // FILTER FUTURE MONTHS (To prevent erroneous data in future months)
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        if (year === currentYear) {
            if (period === 'year') {
                processedData.forEach((d, i) => {
                    if (i > currentMonth) {
                        currentTotal -= d.current; // Deduct from total
                        d.current = 0;

                        // Also adjust category stats if possible (Harder since we aggregated already)
                        // Best effort: We just cleaned the chart data and totals. 
                        // Cleaning categoryStats would require re-aggregating excluding future.
                    }
                });

                fuelProcessedData.forEach((d, i) => {
                    if (i > currentMonth) {
                        // FUTURE MONTHS: Remove BOTH Current and Previous to avoid mismatch
                        totalGasoil -= d.gasoil;
                        totalSSP -= d.ssp;

                        // Also remove Previous from Total
                        totalGasoilPrev -= d.gasoilPrev;
                        totalSSPPrev -= d.sspPrev;

                        d.gasoil = 0;
                        d.ssp = 0;
                        d.gasoilPrev = 0;
                        d.sspPrev = 0;
                    } else if (i === currentMonth) {
                        // CURRENT MONTH: Prorate Previous to match the elapsed days of Current
                        const daysInMonth = new Date(year, currentMonth + 1, 0).getDate();
                        const currentDay = today.getDate();

                        // Ratio of month elapsed
                        // Better: Use the same "Last Day With Data" logic if possible, 
                        // but here we might not have daily details. 
                        // Falback to simple day ratio:
                        const ratio = currentDay / daysInMonth;

                        // Update Total Prev
                        const originalPrevGasoil = d.gasoilPrev;
                        const originalPrevSSP = d.sspPrev;

                        const newPrevGasoil = originalPrevGasoil * ratio;
                        const newPrevSSP = originalPrevSSP * ratio;

                        totalGasoilPrev -= (originalPrevGasoil - newPrevGasoil);
                        totalSSPPrev -= (originalPrevSSP - newPrevSSP);

                        d.gasoilPrev = newPrevGasoil;
                        d.sspPrev = newPrevSSP;
                    }
                });
            } else if (period === 'custom') {
                // Logic for custom period if it spans into future
                processedData.forEach((d, i) => {
                    // d.month is 1-based index of the month
                    if (d.month - 1 > currentMonth) {
                        currentTotal -= d.current;
                        d.current = 0;
                    }
                });
                fuelProcessedData.forEach((d, i) => {
                    // fuelProcessedData indices align with months in custom view if we constructed it that way?
                    // Wait, fuelProcessedData in custom view is: 
                    // name: MONTHS[customStartMonth + i]
                    const monthIndex = customStartMonth + i;
                    if (monthIndex > currentMonth) {
                        totalGasoil -= d.gasoil;
                        totalSSP -= d.ssp;
                        d.gasoil = 0;
                        d.ssp = 0;
                    }
                });
            } else if (period === 'month' && selectedMonth === currentMonth) {
                const currentDay = today.getDate(); // 1-31

                processedData.forEach((d) => {
                    // d.day is 1-based day number
                    if (d.day > currentDay) {
                        currentTotal -= d.current;
                        d.current = 0;
                    }
                });

                fuelProcessedData.forEach((d, i) => {
                    // i is 0-indexed, so day is i + 1
                    if (i + 1 > currentDay) {
                        totalGasoil -= d.gasoil;
                        totalSSP -= d.ssp;
                        d.gasoil = 0;
                        d.ssp = 0;
                    }
                });
            }
        }

        // Re-calculate Growth after filtering
        const growth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;
        const gasoilGrowth = totalGasoilPrev > 0 ? ((totalGasoil - totalGasoilPrev) / totalGasoilPrev) * 100 : 0;
        const sspGrowth = totalSSPPrev > 0 ? ((totalSSP - totalSSPPrev) / totalSSPPrev) * 100 : 0;

        const categoryDetails = CATEGORIES.map(cat => {
            const curr = categoryStats[cat]?.current || 0;
            const prev = categoryStats[cat]?.previous || 0;
            const growth = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
            return { name: cat, current: curr, previous: prev, growth };
        }).sort((a, b) => b.current - a.current);

        return {
            data: processedData,
            kpis: { currentTotal, previousTotal, growth },
            fuelData: fuelProcessedData,
            fuelKpis: { gasoil: totalGasoil, ssp: totalSSP, gasoilPrev: totalGasoilPrev, sspPrev: totalSSPPrev, gasoilGrowth, sspGrowth },
            categoryDetails
        };
    } catch (error) {
        console.error('Error in fetchComparisonStats:', error);
        throw error;
    }
};
