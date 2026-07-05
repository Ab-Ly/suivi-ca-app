import { supabase } from '../lib/supabase';
import { getArticleWeightInKg } from './formatters';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const CATEGORIES = ['Shop', 'Café', 'Bosch Service', "Main d'oeuvre", 'Pneumatique', 'Lubrifiant Piste', 'Lubrifiant Bosch'];

const getLubricantMetrics = (saleName = '', saleCategory = '', quantity = 1, totalPrice = 0) => {
    const cleanName = saleName.toLowerCase();
    const cleanCat = (saleCategory || '').toLowerCase();
    const qty = Number(quantity) || 0;

    // Check if it's a lubricant
    const isLubricant = cleanCat.includes('lubrif') || 
                        cleanName.includes('huile') || 
                        cleanName.includes('lubrif') ||
                        cleanName.includes('graisse');

    if (!isLubricant) {
        return null;
    }

    // Weight
    const kg = getArticleWeightInKg(saleName, saleCategory, qty) || 0;

    // Volume in Liters
    let liters = 0;
    // Check if it is a drum (205 or 180) stored in Liters
    const isDrum205Or180 = cleanName.includes('205') || cleanName.includes('180');
    // Check if it's a KG product
    const kgMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*kg/);
    
    if (isDrum205Or180 && !kgMatch) {
        liters = qty; // For drums stored in liters, the quantity is the liters
    } else if (kgMatch) {
        const capacity = parseFloat(kgMatch[1]);
        liters = capacity * qty;
    } else {
        // Standard item: parse volume
        let volumeLiters = null;
        const mlMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*ml/);
        if (mlMatch) {
            volumeLiters = parseFloat(mlMatch[1]) / 1000;
        } else {
            const lMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*l/);
            if (lMatch) volumeLiters = parseFloat(lMatch[1]);
        }
        if (volumeLiters === null) {
            volumeLiters = 1.0;
        }
        liters = volumeLiters * qty;
    }

    return {
        liters,
        kg,
        val: Number(totalPrice) || 0
    };
};

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
            supabase.from('sales').select('quantity, total_price, sale_date, sales_location, articles(name, category)').gte('sale_date', start.toISOString()).lte('sale_date', end.toISOString()),
            supabase.from('sales').select('quantity, total_price, sale_date, sales_location, articles(name, category)').gte('sale_date', prevStart.toISOString()).lte('sale_date', prevEnd.toISOString()),
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

        const addToData = (dateStr, amount, isCurrent, category = null) => {
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
                if (isCurrent) {
                    processedData[index].current += amount;
                    if (category) {
                        processedData[index][category] = (processedData[index][category] || 0) + amount;
                    }
                }
                else {
                    processedData[index].previous += amount;
                    if (category) {
                        const prevKey = `${category}_previous`;
                        processedData[index][prevKey] = (processedData[index][prevKey] || 0) + amount;
                    }
                }
            }
        };

        // Initialize Lubricant Data Structure
        let lubProcessedData = [];
        if (period === 'year') {
            lubProcessedData = MONTHS.map(label => ({ name: label, liters: 0, kg: 0, val: 0, litersPrev: 0, kgPrev: 0, valPrev: 0 }));
        } else if (period === 'custom') {
            const rangeLen = customEndMonth - customStartMonth + 1;
            lubProcessedData = Array.from({ length: rangeLen }, (_, i) => ({ name: MONTHS[customStartMonth + i], liters: 0, kg: 0, val: 0, litersPrev: 0, kgPrev: 0, valPrev: 0 }));
        } else if (period === 'month') {
            const daysInMonth = end.getDate();
            lubProcessedData = Array.from({ length: daysInMonth }, (_, i) => ({ name: (i + 1).toString(), liters: 0, kg: 0, val: 0, litersPrev: 0, kgPrev: 0, valPrev: 0 }));
        } else if (period === 'week') {
            const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
            lubProcessedData = days.map(d => ({ name: d, liters: 0, kg: 0, val: 0, litersPrev: 0, kgPrev: 0, valPrev: 0 }));
        } else if (period === 'day') {
            lubProcessedData = Array.from({ length: 24 }, (_, i) => ({ name: `${i}h`, liters: 0, kg: 0, val: 0, litersPrev: 0, kgPrev: 0, valPrev: 0 }));
        }

        const addToLubData = (dateStr, metrics, isCurrent) => {
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

            if (index >= 0 && index < lubProcessedData.length) {
                if (isCurrent) {
                    lubProcessedData[index].liters += metrics.liters;
                    lubProcessedData[index].kg += metrics.kg;
                    lubProcessedData[index].val += metrics.val;
                } else {
                    lubProcessedData[index].litersPrev += metrics.liters;
                    lubProcessedData[index].kgPrev += metrics.kg;
                    lubProcessedData[index].valPrev += metrics.val;
                }
            }
        };

        // Scan current real sales to compute dynamic average price for lubricants
        let totalRealLubLiters = 0;
        let totalRealLubVal = 0;
        currentSales?.forEach(sale => {
            const metrics = getLubricantMetrics(sale.articles?.name || '', sale.articles?.category || '', sale.quantity || 1, sale.total_price || 0);
            if (metrics) {
                totalRealLubLiters += metrics.liters;
                totalRealLubVal += metrics.val;
            }
        });
        const lubAvgPrice = totalRealLubLiters > 0 ? (totalRealLubVal / totalRealLubLiters) : 90.0;

        const getLubricantHistoricalMetrics = (amount) => {
            const val = Number(amount) || 0;
            const liters = val / lubAvgPrice;
            const kg = liters * 0.9;
            return { liters, kg, val };
        };

        CATEGORIES.forEach(cat => categoryStats[cat] = { name: cat, current: 0, previous: 0 });

        let totalLubLiters = 0, totalLubKg = 0, totalLubVal = 0;
        let totalLubLitersPrev = 0, totalLubKgPrev = 0, totalLubValPrev = 0;

        currentSales?.forEach(sale => {
            const resultDate = new Date(sale.sale_date);
            if (resultDate < start || resultDate > end) return;

            const mappedCategory = getMappedCategory(sale.articles?.category || 'Autre', sale.sales_location, sale.articles?.name);
            // Granular Check: Only skip if THIS category has history for THIS month
            if ((period === 'year' || period === 'custom') && historyKeysCurrent.has(`${new Date(sale.sale_date).getMonth()}-${mappedCategory}`)) return;

            const amount = sale.total_price;
            currentTotal += amount;
            addToData(sale.sale_date, amount, true, mappedCategory);
            if (categoryStats[mappedCategory]) categoryStats[mappedCategory].current += amount;

            // Lubricant metrics
            const lubMetrics = getLubricantMetrics(sale.articles?.name || '', sale.articles?.category || '', sale.quantity || 1, sale.total_price || 0);
            if (lubMetrics) {
                addToLubData(sale.sale_date, lubMetrics, true);
                totalLubLiters += lubMetrics.liters;
                totalLubKg += lubMetrics.kg;
                totalLubVal += lubMetrics.val;
            }
        });

        previousSales?.forEach(sale => {
            const resultDate = new Date(sale.sale_date);
            if (resultDate < prevStart || resultDate > prevEnd) return;

            const mappedCategory = getMappedCategory(sale.articles?.category || 'Autre', sale.sales_location, sale.articles?.name);
            // Granular Check
            if ((period === 'year' || period === 'custom') && historyKeysPrevious.has(`${new Date(sale.sale_date).getMonth()}-${mappedCategory}`)) return;

            const amount = sale.total_price;
            previousTotal += amount;
            addToData(sale.sale_date, amount, false, mappedCategory);
            if (categoryStats[mappedCategory]) categoryStats[mappedCategory].previous += amount;

            // Lubricant metrics
            const lubMetrics = getLubricantMetrics(sale.articles?.name || '', sale.articles?.category || '', sale.quantity || 1, sale.total_price || 0);
            if (lubMetrics) {
                addToLubData(sale.sale_date, lubMetrics, false);
                totalLubLitersPrev += lubMetrics.liters;
                totalLubKgPrev += lubMetrics.kg;
                totalLubValPrev += lubMetrics.val;
            }
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
                        if (processedData[idx]) {
                            processedData[idx].current += item.amount;
                            const mappedCat = getMappedCategory(item.category, '', '');
                            processedData[idx][mappedCat] = (processedData[idx][mappedCat] || 0) + item.amount;
                        }
                        currentTotal += item.amount;
                        if (categoryStats[item.category]) categoryStats[item.category].current += item.amount;

                        // Lubricant historical metrics
                        if (item.category === 'Lubrifiant Piste' || item.category === 'Lubrifiant Bosch') {
                            const metrics = getLubricantHistoricalMetrics(item.amount);
                            if (lubProcessedData[idx]) {
                                lubProcessedData[idx].liters += metrics.liters;
                                lubProcessedData[idx].kg += metrics.kg;
                                lubProcessedData[idx].val += metrics.val;
                            }
                            totalLubLiters += metrics.liters;
                            totalLubKg += metrics.kg;
                            totalLubVal += metrics.val;
                        }
                    }
                }
            });

            historyPrevious?.forEach(item => {
                if (item.month >= 1 && item.month <= 12 && !item.category.includes('Volume')) {
                    if (isMonthInRange(item.month)) {
                        const idx = getIndex(item.month);
                        if (processedData[idx]) {
                            processedData[idx].previous += item.amount;
                            const mappedCat = getMappedCategory(item.category, '', '');
                            const prevKey = `${mappedCat}_previous`;
                            processedData[idx][prevKey] = (processedData[idx][prevKey] || 0) + item.amount;
                        }
                        previousTotal += item.amount;
                        if (categoryStats[item.category]) categoryStats[item.category].previous += item.amount;

                        // Lubricant historical metrics
                        if (item.category === 'Lubrifiant Piste' || item.category === 'Lubrifiant Bosch') {
                            const metrics = getLubricantHistoricalMetrics(item.amount);
                            if (lubProcessedData[idx]) {
                                lubProcessedData[idx].litersPrev += metrics.liters;
                                lubProcessedData[idx].kgPrev += metrics.kg;
                                lubProcessedData[idx].valPrev += metrics.val;
                            }
                            totalLubLitersPrev += metrics.liters;
                            totalLubKgPrev += metrics.kg;
                            totalLubValPrev += metrics.val;
                        }
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
                const daysInMonth = processedData.length;
                histCurrMonth?.forEach(item => {
                    if (!item.category.includes('Volume')) {
                        currentTotal += item.amount;
                        if (categoryStats[item.category]) categoryStats[item.category].current += item.amount;
                        else categoryStats[item.category] = { name: item.category, current: item.amount, previous: 0 };
                        
                        // Distribute across processedData days
                        const mappedCat = getMappedCategory(item.category, '', '');
                        const dailyAmount = daysInMonth > 0 ? item.amount / daysInMonth : 0;
                        processedData.forEach(d => {
                            d.current += dailyAmount;
                            d[mappedCat] = (d[mappedCat] || 0) + dailyAmount;
                        });

                        // Lubricant historical metrics distribution
                        if (item.category === 'Lubrifiant Piste' || item.category === 'Lubrifiant Bosch') {
                            const metrics = getLubricantHistoricalMetrics(item.amount);
                            const dailyLiters = daysInMonth > 0 ? metrics.liters / daysInMonth : 0;
                            const dailyKg = daysInMonth > 0 ? metrics.kg / daysInMonth : 0;
                            const dailyVal = daysInMonth > 0 ? metrics.val / daysInMonth : 0;
                            lubProcessedData.forEach(ld => {
                                ld.liters += dailyLiters;
                                ld.kg += dailyKg;
                                ld.val += dailyVal;
                            });
                            totalLubLiters += metrics.liters;
                            totalLubKg += metrics.kg;
                            totalLubVal += metrics.val;
                        }
                    }
                    if (item.category === 'Gasoil Volume' && useFuelHistoricalCurrent) totalGasoil += item.amount;
                    if (item.category === 'SSP Volume' && useFuelHistoricalCurrent) totalSSP += item.amount;
                });
            }

            if (useHistoricalPrevious) {
                const histPrevMonth = historyPrevious?.filter(h => h.month === selectedMonth + 1);
                const daysInMonth = processedData.length;
                histPrevMonth?.forEach(item => {
                    if (!item.category.includes('Volume')) {
                        previousTotal += item.amount;
                        if (categoryStats[item.category]) categoryStats[item.category].previous += item.amount;
                        else if (!categoryStats[item.category]) categoryStats[item.category] = { name: item.category, current: 0, previous: item.amount };
                        else categoryStats[item.category].previous += item.amount;

                        // Distribute across processedData days
                        const mappedCat = getMappedCategory(item.category, '', '');
                        const prevKey = `${mappedCat}_previous`;
                        const dailyAmount = daysInMonth > 0 ? item.amount / daysInMonth : 0;
                        processedData.forEach(d => {
                            d.previous += dailyAmount;
                            d[prevKey] = (d[prevKey] || 0) + dailyAmount;
                        });

                        // Lubricant historical metrics distribution
                        if (item.category === 'Lubrifiant Piste' || item.category === 'Lubrifiant Bosch') {
                            const metrics = getLubricantHistoricalMetrics(item.amount);
                            const dailyLiters = daysInMonth > 0 ? metrics.liters / daysInMonth : 0;
                            const dailyKg = daysInMonth > 0 ? metrics.kg / daysInMonth : 0;
                            const dailyVal = daysInMonth > 0 ? metrics.val / daysInMonth : 0;
                            lubProcessedData.forEach(ld => {
                                ld.litersPrev += dailyLiters;
                                ld.kgPrev += dailyKg;
                                ld.valPrev += dailyVal;
                            });
                            totalLubLitersPrev += metrics.liters;
                            totalLubKgPrev += metrics.kg;
                            totalLubValPrev += metrics.val;
                        }
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
                const dayIndex = (today.getDay() + 6) % 7;
                totalGasoilPrev = fuelProcessedData.slice(0, dayIndex + 1).reduce((acc, d) => acc + d.gasoilPrev, 0);
                totalSSPPrev = fuelProcessedData.slice(0, dayIndex + 1).reduce((acc, d) => acc + d.sspPrev, 0);
            }
        }

        if (period === 'month') {
            const daysInMonth = fuelProcessedData.length;
            const avgGasoilPrev = daysInMonth > 0 ? totalGasoilPrev / daysInMonth : 0;
            const avgSSPPrev = daysInMonth > 0 ? totalSSPPrev / daysInMonth : 0;

            // Flatten the Previous Curve to the Average
            fuelProcessedData.forEach(d => {
                d.gasoilPrev = avgGasoilPrev;
                d.sspPrev = avgSSPPrev;
            });

            // Flatten lubricant previous averages for month
            const lubDaysInMonth = lubProcessedData.length;
            const avgLitersPrev = lubDaysInMonth > 0 ? totalLubLitersPrev / lubDaysInMonth : 0;
            const avgKgPrev = lubDaysInMonth > 0 ? totalLubKgPrev / lubDaysInMonth : 0;
            const avgValPrev = lubDaysInMonth > 0 ? totalLubValPrev / lubDaysInMonth : 0;

            lubProcessedData.forEach(d => {
                d.litersPrev = avgLitersPrev;
                d.kgPrev = avgKgPrev;
                d.valPrev = avgValPrev;
            });

            // ADJUST KPI TOTALS FOR FAIR COMPARISON (Current Month Only)
            const today = new Date();
            const isCurrentMonth = today.getFullYear() === year && today.getMonth() === selectedMonth;

            if (isCurrentMonth) {
                const currentDay = today.getDate();

                // Find the last day that has ACTUAL data entered
                let lastDayWithData = 0;

                fuelProcessedData.forEach((d, i) => {
                    if (i + 1 <= currentDay && (d.gasoil > 0 || d.ssp > 0)) {
                        lastDayWithData = i + 1;
                    }
                });

                const multiplier = lastDayWithData;

                totalGasoilPrev = avgGasoilPrev * multiplier;
                totalSSPPrev = avgSSPPrev * multiplier;

                // Update lubricant previous totals to match effective days
                let lubLastDayWithData = 0;
                lubProcessedData.forEach((d, i) => {
                    if (i + 1 <= currentDay && (d.liters > 0 || d.val > 0)) {
                        lubLastDayWithData = i + 1;
                    }
                });
                const lubMultiplier = lubLastDayWithData || currentDay;
                totalLubLitersPrev = avgLitersPrev * lubMultiplier;
                totalLubKgPrev = avgKgPrev * lubMultiplier;
                totalLubValPrev = avgValPrev * lubMultiplier;
            }
        }


        // FILTER FUTURE MONTHS
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        if (year === currentYear) {
            if (period === 'year') {
                processedData.forEach((d, i) => {
                    if (i > currentMonth) {
                        currentTotal -= d.current;
                        d.current = 0;
                    }
                });

                fuelProcessedData.forEach((d, i) => {
                    if (i > currentMonth) {
                        totalGasoil -= d.gasoil;
                        totalSSP -= d.ssp;
                        totalGasoilPrev -= d.gasoilPrev;
                        totalSSPPrev -= d.sspPrev;

                        d.gasoil = 0;
                        d.ssp = 0;
                        d.gasoilPrev = 0;
                        d.sspPrev = 0;
                    } else if (i === currentMonth) {
                        const daysInMonth = new Date(year, currentMonth + 1, 0).getDate();
                        const currentDay = today.getDate();
                        const ratio = currentDay / daysInMonth;

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

                lubProcessedData.forEach((d, i) => {
                    if (i > currentMonth) {
                        totalLubLiters -= d.liters;
                        totalLubKg -= d.kg;
                        totalLubVal -= d.val;
                        totalLubLitersPrev -= d.litersPrev;
                        totalLubKgPrev -= d.kgPrev;
                        totalLubValPrev -= d.valPrev;

                        d.liters = 0;
                        d.kg = 0;
                        d.val = 0;
                        d.litersPrev = 0;
                        d.kgPrev = 0;
                        d.valPrev = 0;
                    } else if (i === currentMonth) {
                        const daysInMonth = new Date(year, currentMonth + 1, 0).getDate();
                        const currentDay = today.getDate();
                        const ratio = currentDay / daysInMonth;

                        const originalPrevLiters = d.litersPrev;
                        const originalPrevKg = d.kgPrev;
                        const originalPrevVal = d.valPrev;

                        const newPrevLiters = originalPrevLiters * ratio;
                        const newPrevKg = originalPrevKg * ratio;
                        const newPrevVal = originalPrevVal * ratio;

                        totalLubLitersPrev -= (originalPrevLiters - newPrevLiters);
                        totalLubKgPrev -= (originalPrevKg - newPrevKg);
                        totalLubValPrev -= (originalPrevVal - newPrevVal);

                        d.litersPrev = newPrevLiters;
                        d.kgPrev = newPrevKg;
                        d.valPrev = newPrevVal;
                    }
                });
            } else if (period === 'custom') {
                processedData.forEach((d, i) => {
                    if (d.month - 1 > currentMonth) {
                        currentTotal -= d.current;
                        d.current = 0;
                    }
                });
                fuelProcessedData.forEach((d, i) => {
                    const monthIndex = customStartMonth + i;
                    if (monthIndex > currentMonth) {
                        totalGasoil -= d.gasoil;
                        totalSSP -= d.ssp;
                        d.gasoil = 0;
                        d.ssp = 0;
                    }
                });
                lubProcessedData.forEach((d, i) => {
                    const monthIndex = customStartMonth + i;
                    if (monthIndex > currentMonth) {
                        totalLubLiters -= d.liters;
                        totalLubKg -= d.kg;
                        totalLubVal -= d.val;
                        d.liters = 0;
                        d.kg = 0;
                        d.val = 0;
                    }
                });
            } else if (period === 'month' && selectedMonth === currentMonth) {
                const currentDay = today.getDate();

                processedData.forEach((d) => {
                    if (d.day > currentDay) {
                        currentTotal -= d.current;
                        d.current = 0;
                    }
                });

                fuelProcessedData.forEach((d, i) => {
                    if (i + 1 > currentDay) {
                        totalGasoil -= d.gasoil;
                        totalSSP -= d.ssp;
                        d.gasoil = 0;
                        d.ssp = 0;
                    }
                });

                lubProcessedData.forEach((d, i) => {
                    if (i + 1 > currentDay) {
                        totalLubLiters -= d.liters;
                        totalLubKg -= d.kg;
                        totalLubVal -= d.val;
                        d.liters = 0;
                        d.kg = 0;
                        d.val = 0;
                    }
                });
            }
        }

        // Re-calculate Growth after filtering
        const growth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;
        const gasoilGrowth = totalGasoilPrev > 0 ? ((totalGasoil - totalGasoilPrev) / totalGasoilPrev) * 100 : 0;
        const sspGrowth = totalSSPPrev > 0 ? ((totalSSP - totalSSPPrev) / totalSSPPrev) * 100 : 0;

        const lubLitersGrowth = totalLubLitersPrev > 0 ? ((totalLubLiters - totalLubLitersPrev) / totalLubLitersPrev) * 100 : 0;
        const lubKgGrowth = totalLubKgPrev > 0 ? ((totalLubKg - totalLubKgPrev) / totalLubKgPrev) * 100 : 0;
        const lubValGrowth = totalLubValPrev > 0 ? ((totalLubVal - totalLubValPrev) / totalLubValPrev) * 100 : 0;

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
            lubData: lubProcessedData,
            lubKpis: { 
                liters: totalLubLiters, 
                kg: totalLubKg, 
                val: totalLubVal, 
                litersPrev: totalLubLitersPrev, 
                kgPrev: totalLubKgPrev, 
                valPrev: totalLubValPrev, 
                litersGrowth: lubLitersGrowth, 
                kgGrowth: lubKgGrowth, 
                valGrowth: lubValGrowth 
            },
            categoryDetails
        };
    } catch (error) {
        console.error('Error in fetchComparisonStats:', error);
        throw error;
    }
};
