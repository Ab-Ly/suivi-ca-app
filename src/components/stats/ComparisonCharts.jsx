import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, Cell } from 'recharts';
import { Loader2, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { formatPrice, formatNumber } from '../../utils/formatters';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const CATEGORIES = ['Shop', 'Café', 'Bosch Service', "Main d'oeuvre", 'Pneumatique', 'Lubrifiant Piste', 'Lubrifiant Bosch'];

export default function ComparisonCharts() {
    const [year, setYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-11
    const [period, setPeriod] = useState('year'); // 'day', 'week', 'month', 'year'
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [kpis, setKpis] = useState({ currentTotal: 0, previousTotal: 0, growth: 0 });
    const [categoryDetails, setCategoryDetails] = useState([]);


    // Fuel State
    const [fuelData, setFuelData] = useState([]);
    const [fuelKpis, setFuelKpis] = useState({ gasoil: 0, ssp: 0, gasoilGrowth: 0, sspGrowth: 0 });

    useEffect(() => {
        fetchComparisonData();
    }, [year, period, selectedMonth]);

    const getDateRange = () => {
        const now = new Date();
        // If user selects 'day', 'week', 'month', it's relative to TODAY (like Dashboard).
        // If they select 'year', it uses the selected `year` state.

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
            // Use selectedMonth and year
            start = new Date(year, selectedMonth, 1);
            end = new Date(year, selectedMonth + 1, 0, 23, 59, 59, 999);

            prevStart = new Date(year - 1, selectedMonth, 1);
            prevEnd = new Date(year - 1, selectedMonth + 1, 0, 23, 59, 59, 999);
        } else {
            // Year view
            start = new Date(year, 0, 1);
            end = new Date(year, 11, 31, 23, 59, 59);
            prevStart = new Date(year - 1, 0, 1);
            prevEnd = new Date(year - 1, 11, 31, 23, 59, 59);
        }
        return { start, end, prevStart, prevEnd };
    };

    const fetchComparisonData = async () => {
        setLoading(true);
        try {
            const { start, end, prevStart, prevEnd } = getDateRange();

            // Parallelize all data fetching for better performance
            const [
                { data: currentSales, error: currentError },
                { data: previousSales, error: prevSalesError },
                { data: historyPrevData, error: historyErrorPrev },
                { data: historyCurrData, error: historyErrorCurr },
                { data: currentFuelData, error: fuelErrorCurrent },
                { data: prevFuelData, error: fuelErrorPrevious }
            ] = await Promise.all([
                // 1. Current Sales
                supabase
                    .from('sales')
                    .select('total_price, sale_date, sales_location, articles(category)')
                    .gte('sale_date', start.toISOString())
                    .lte('sale_date', end.toISOString()),

                // 2. Previous Sales
                supabase
                    .from('sales')
                    .select('total_price, sale_date, sales_location, articles(category)')
                    .gte('sale_date', prevStart.toISOString())
                    .lte('sale_date', prevEnd.toISOString()),

                // 3. Historical Data Previous
                supabase
                    .from('historical_sales')
                    .select('*')
                    .eq('year', year - 1),

                // 4. Historical Data Current
                supabase
                    .from('historical_sales')
                    .select('*')
                    .eq('year', year),

                // 5. Fuel Current
                supabase
                    .from('fuel_sales')
                    .select('*')
                    .gte('sale_date', start.toISOString())
                    .lte('sale_date', end.toISOString()),

                // 6. Fuel Previous
                supabase
                    .from('fuel_sales')
                    .select('*')
                    .gte('sale_date', prevStart.toISOString())
                    .lte('sale_date', prevEnd.toISOString())
            ]);

            // Error Handling (Log but don't crash)
            if (currentError) console.error('Error fetching current sales:', currentError);
            if (prevSalesError) console.error('Error fetching previous sales:', prevSalesError);
            if (historyErrorPrev) console.warn('Error fetching historical previous year:', historyErrorPrev);
            if (historyErrorCurr) console.warn('Error fetching historical current year:', historyErrorCurr);
            if (fuelErrorCurrent) console.warn('Error fetching current fuel sales:', fuelErrorCurrent);
            if (fuelErrorPrevious) console.warn('Error fetching previous fuel sales:', fuelErrorPrevious);

            // Assign Data
            let historyPrevious = historyPrevData || [];
            let historyCurrent = historyCurrData || [];
            let fuelSalesCurrent = currentFuelData || [];
            let fuelSalesPrevious = prevFuelData || [];

            // Process Data
            let processedData = [];
            let currentTotal = 0;
            let previousTotal = 0;
            let categoryStats = {};

            // Initialize Data Structure based on Period
            if (period === 'year') {
                processedData = Array.from({ length: 12 }, (_, i) => ({
                    name: MONTHS[i],
                    current: 0,
                    previous: 0,
                    month: i + 1
                }));
            } else if (period === 'month') {
                const daysInMonth = end.getDate();
                processedData = Array.from({ length: daysInMonth }, (_, i) => ({
                    name: (i + 1).toString(),
                    current: 0,
                    previous: 0,
                    day: i + 1
                }));
            } else if (period === 'week') {
                const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
                processedData = days.map(d => ({ name: d, current: 0, previous: 0 }));
            } else if (period === 'day') {
                processedData = Array.from({ length: 24 }, (_, i) => ({
                    name: `${i}h`,
                    current: 0,
                    previous: 0,
                    hour: i
                }));
            }

            // Helper to add to processedData
            const addToData = (dateStr, amount, isCurrent) => {
                const date = new Date(dateStr);
                let index = -1;

                if (period === 'year') index = date.getMonth();
                else if (period === 'month') index = date.getDate() - 1;
                else if (period === 'week') {
                    const day = date.getDay(); // 0 is Sun
                    index = day === 0 ? 6 : day - 1; // Mon=0, Sun=6
                }
                else if (period === 'day') index = date.getHours();

                if (index >= 0 && index < processedData.length) {
                    if (isCurrent) processedData[index].current += amount;
                    else processedData[index].previous += amount;
                }
            };

            // Helper to map category
            const getMappedCategory = (category, location) => {
                if (category.toLowerCase().includes('shop')) return 'Shop';
                else if (category.toLowerCase().includes('café') || category.toLowerCase().includes('cafe')) return 'Café';
                else if (category.toLowerCase().includes('bosch service')) return 'Bosch Service';
                else if (category.toLowerCase().includes('main d\'oeuvre')) return "Main d'oeuvre";
                else if (category.toLowerCase().includes('pneumatique')) return 'Pneumatique';
                else if (category.toLowerCase().includes('lubrifiant')) {
                    if (location === 'bosch') return 'Lubrifiant Bosch';
                    else return 'Lubrifiant Piste';
                }
                return 'Autre'; // Default if no match
            };

            // Initialize categoryStats for all CATEGORIES
            CATEGORIES.forEach(cat => {
                categoryStats[cat] = { name: cat, current: 0, previous: 0 };
            });

            // Aggregate Current Sales (Real)
            currentSales?.forEach(sale => {
                const amount = sale.total_price;
                currentTotal += amount;
                addToData(sale.sale_date, amount, true);

                // Category Stats
                const mappedCategory = getMappedCategory(sale.articles?.category || 'Autre', sale.sales_location);
                if (categoryStats[mappedCategory]) {
                    categoryStats[mappedCategory].current += amount;
                }
            });

            // Aggregate Previous Sales (Real)
            previousSales?.forEach(sale => {
                const amount = sale.total_price;
                previousTotal += amount;
                addToData(sale.sale_date, amount, false);

                const mappedCategory = getMappedCategory(sale.articles?.category || 'Autre', sale.sales_location);
                if (categoryStats[mappedCategory]) {
                    categoryStats[mappedCategory].previous += amount;
                }
            });

            // Aggregate Historical Sales (Manual Entries) - Only for 'year' period
            if (period === 'year') {
                // Current Year Manual Entries
                historyCurrent?.forEach(item => {
                    if (item.month >= 1 && item.month <= 12 && !item.category.includes('Volume')) {
                        processedData[item.month - 1].current += item.amount;
                        currentTotal += item.amount;
                        if (categoryStats[item.category]) {
                            categoryStats[item.category].current += item.amount;
                        }
                    }
                });

                // Previous Year Manual Entries
                historyPrevious?.forEach(item => {
                    if (item.month >= 1 && item.month <= 12 && !item.category.includes('Volume')) {
                        processedData[item.month - 1].previous += item.amount;
                        previousTotal += item.amount;
                        if (categoryStats[item.category]) {
                            categoryStats[item.category].previous += item.amount;
                        }
                    }
                });
            }

            setData(processedData);

            // Calculate Growth
            const growth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;
            // setKpis moved to end of function to include all calculations


            // Fuel Sales Logic (Already fetched in parallel above)
            // Removed redundant fetch block

            // Process Fuel Data for Chart
            const monthlyFuelData = MONTHS.map((label, index) => ({
                name: label,
                gasoil: 0,
                ssp: 0,
                gasoilPrev: 0,
                sspPrev: 0
            }));

            let totalGasoil = 0, totalSSP = 0, totalGasoilPrev = 0, totalSSPPrev = 0;

            fuelSalesCurrent.forEach(sale => {
                const monthIndex = new Date(sale.sale_date).getMonth();
                const qty = Number(sale.quantity_liters);
                if (sale.fuel_type === 'Gasoil') {
                    monthlyFuelData[monthIndex].gasoil += qty;
                    totalGasoil += qty;
                } else if (sale.fuel_type === 'SSP') {
                    monthlyFuelData[monthIndex].ssp += qty;
                    totalSSP += qty;
                }
            });

            fuelSalesPrevious.forEach(sale => {
                const monthIndex = new Date(sale.sale_date).getMonth();
                const qty = Number(sale.quantity_liters);
                if (sale.fuel_type === 'Gasoil') {
                    monthlyFuelData[monthIndex].gasoilPrev += qty;
                    totalGasoilPrev += qty;
                } else if (sale.fuel_type === 'SSP') {
                    monthlyFuelData[monthIndex].sspPrev += qty;
                    totalSSPPrev += qty;
                }
            });

            // Aggregate Manual Fuel Entries for Current Year (if period is 'year' OR 'month')
            if (period === 'year') {
                historyCurrent?.forEach(item => {
                    if (item.month >= 1 && item.month <= 12) {
                        if (item.category === 'Gasoil Volume') {
                            monthlyFuelData[item.month - 1].gasoil += item.amount;
                            totalGasoil += item.amount;
                        }
                        else if (item.category === 'SSP Volume') {
                            monthlyFuelData[item.month - 1].ssp += item.amount;
                            totalSSP += item.amount;
                        }
                    }
                });

                // Aggregate Manual Fuel Entries for Previous Year (if period is 'year')
                historyPrevious?.forEach(item => {
                    if (item.month >= 1 && item.month <= 12) {
                        if (item.category === 'Gasoil Volume') {
                            monthlyFuelData[item.month - 1].gasoilPrev += item.amount;
                            totalGasoilPrev += item.amount;
                        }
                        else if (item.category === 'SSP Volume') {
                            monthlyFuelData[item.month - 1].sspPrev += item.amount;
                            totalSSPPrev += item.amount;
                        }
                    }
                });
            } else if (period === 'month') {
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
                            // Add to category stats for breakdown
                            if (categoryStats[item.category]) categoryStats[item.category].current += item.amount;
                            else categoryStats[item.category] = { name: item.category, current: item.amount, previous: 0 };
                        }
                        // Fuel
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
                        // Fuel
                        if (item.category === 'Gasoil Volume' && useFuelHistoricalPrevious) totalGasoilPrev += item.amount;
                        if (item.category === 'SSP Volume' && useFuelHistoricalPrevious) totalSSPPrev += item.amount;
                    });
                }
            }

            const gasoilGrowth = totalGasoilPrev > 0 ? ((totalGasoil - totalGasoilPrev) / totalGasoilPrev) * 100 : 0;
            const sspGrowth = totalSSPPrev > 0 ? ((totalSSP - totalSSPPrev) / totalSSPPrev) * 100 : 0;

            setFuelData(monthlyFuelData);

            setFuelKpis({ gasoil: totalGasoil, ssp: totalSSP, gasoilGrowth, sspGrowth });

            // Recalculate growth with final totals
            const finalGrowth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;
            setKpis({ currentTotal, previousTotal, growth: finalGrowth });

            // Process Category Details (Moved to end to include historical data)
            const details = CATEGORIES.map(cat => {
                const curr = categoryStats[cat]?.current || 0;
                const prev = categoryStats[cat]?.previous || 0;
                const growth = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
                return { name: cat, current: curr, previous: prev, growth };
            }).sort((a, b) => b.current - a.current);

            setCategoryDetails(details);

        } catch (error) {
            console.error('Error fetching comparison data:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">Chiffre d'Affaire {period === 'year' ? year : 'Actuel'}</div>
                    <div className="text-2xl font-bold text-gray-900">{formatPrice(kpis.currentTotal)}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">Chiffre d'Affaire {period === 'year' ? year - 1 : 'Précédent'}</div>
                    <div className="text-2xl font-bold text-gray-900">{formatPrice(kpis.previousTotal)}</div>
                </div>
                <div className={`p-6 rounded-2xl shadow-sm border ${kpis.growth >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'} `}>
                    <div className="text-sm text-gray-500 mb-1">Évolution</div>
                    <div className={`text-2xl font-bold flex items-center gap-2 ${kpis.growth >= 0 ? 'text-green-700' : 'text-red-700'} `}>
                        {kpis.growth >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                        {Math.abs(kpis.growth).toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* Header / Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200">
                    {['day', 'week', 'month', 'year'].map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-1.5 text-sm rounded-lg capitalize transition-all font-medium ${period === p ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                } `}
                        >
                            {p === 'day' ? 'Jour' : p === 'week' ? 'Semaine' : p === 'month' ? 'Mois' : 'Année'}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2">
                    {period === 'month' && (
                        <div className="relative">
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                className="appearance-none bg-white border border-gray-200 text-gray-700 py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium shadow-sm capitalize"
                            >
                                {MONTHS.map((m, i) => (
                                    <option key={i} value={i}>{m}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                        </div>
                    )}

                    {(period === 'year' || period === 'month') && (
                        <div className="relative">
                            <select
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                className="appearance-none bg-white border border-gray-200 text-gray-700 py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium shadow-sm"
                            >
                                {[new Date().getFullYear(), new Date().getFullYear() + 1].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                        </div>
                    )}
                </div>
            </div>

            {/* Main Chart Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="font-bold text-lg text-gray-900">Comparatif {period === 'year' ? 'Mensuel' : period === 'month' ? 'Journalier' : period === 'week' ? 'Hebdomadaire' : 'Horaire'}</h3>
                        <p className="text-sm text-gray-500">
                            {period === 'year' ? `Année ${year} vs ${year - 1} ` :
                                period === 'month' ? `${MONTHS[selectedMonth]} ${year} vs ${year - 1} ` :
                                    'Période actuelle vs Période précédente'}
                        </p>
                    </div>
                </div>
                {loading ? (
                    <div className="h-80 flex items-center justify-center">
                        <Loader2 className="animate-spin text-gray-400" size={32} />
                    </div>
                ) : (
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            {period === 'month' && data.every(d => d.current === 0 && d.previous === 0) ? (
                                // Fallback Chart for Monthly View with no daily data
                                <BarChart
                                    data={[
                                        { name: `${MONTHS[selectedMonth]} ${year - 1} `, amount: kpis.previousTotal, fill: '#94a3b8' },
                                        { name: `${MONTHS[selectedMonth]} ${year} `, amount: kpis.currentTotal, fill: '#4f46e5' }
                                    ]}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `${value / 1000} k`} />
                                    <Tooltip
                                        cursor={{ fill: '#F1F5F9' }}
                                        contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                        formatter={(value) => [formatPrice(value), 'Chiffre d\'Affaire']}
                                    />
                                    <Bar dataKey="amount" radius={[6, 6, 0, 0]} barSize={60}>
                                        {
                                            [
                                                { name: `${MONTHS[selectedMonth]} ${year - 1} `, amount: kpis.previousTotal, fill: '#94a3b8' },
                                                { name: `${MONTHS[selectedMonth]} ${year} `, amount: kpis.currentTotal, fill: '#4f46e5' }
                                            ].map((entry, index) => (
                                                <Cell key={`cell - ${index} `} fill={entry.fill} />
                                            ))
                                        }
                                    </Bar>
                                </BarChart>
                            ) : (
                                // Standard Chart
                                <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorPrevious" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#94A3B8" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 12 }}
                                        dy={10}
                                        interval={period === 'month' ? 2 : 0}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 12 }}
                                        tickFormatter={(value) => `${value / 1000} k`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                        cursor={{ stroke: '#CBD5E1', strokeWidth: 1, strokeDasharray: '4 4' }}
                                        formatter={(value) => formatPrice(value)}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Area
                                        type="monotone"
                                        dataKey="previous"
                                        name={period === 'year' ? (year - 1).toString() : "Période précédente"}
                                        stroke="#94A3B8"
                                        fillOpacity={1}
                                        fill="url(#colorPrevious)"
                                        strokeWidth={2}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="current"
                                        name={period === 'year' ? year.toString() : "Période actuelle"}
                                        stroke="#4F46E5"
                                        fillOpacity={1}
                                        fill="url(#colorCurrent)"
                                        strokeWidth={2}
                                    />
                                </AreaChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Detailed Breakdown */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-bold text-lg text-gray-900">Détails par Catégorie</h3>
                </div>

                <div className="p-6">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-gray-500 font-medium border-b border-gray-100">
                                <tr>
                                    <th className="py-3 pr-4">Catégorie</th>
                                    <th className="py-3 px-4 text-right">CA {year - 1}</th>
                                    <th className="py-3 px-4 text-right">CA {year}</th>
                                    <th className="py-3 pl-4 text-right">Évolution</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {categoryDetails.map((cat) => (
                                    <tr key={cat.name} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-4 pr-4 font-medium text-gray-900">{cat.name}</td>
                                        <td className="py-4 px-4 text-right text-gray-600 font-mono">{formatPrice(cat.previous)}</td>
                                        <td className="py-4 px-4 text-right text-gray-900 font-medium font-mono">{formatPrice(cat.current)}</td>
                                        <td className="py-4 pl-4 text-right">
                                            <div className={`flex items - center justify - end gap - 1.5 ${cat.growth >= 0 ? 'text-green-600 bg-green-50 px-2 py-1 rounded-lg w-fit ml-auto' : 'text-red-600 bg-red-50 px-2 py-1 rounded-lg w-fit ml-auto'} `}>
                                                {cat.growth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                                <span className="font-bold text-xs">{Math.abs(cat.growth).toFixed(1)}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Fuel Statistics Section */}
            <div className="space-y-6">
                <h3 className="font-bold text-xl text-gray-900">Statistiques Carburant (Volume)</h3>

                {/* Fuel KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-orange-50 to-white p-6 rounded-2xl shadow-sm border border-orange-100">
                        <div className="flex justify-between items-start mb-2">
                            <div className="text-sm text-orange-600 font-medium">Volume Gasoil {year}</div>
                            <div className={`text - xs font - bold px - 2 py - 1 rounded - full ${fuelKpis.gasoilGrowth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} `}>
                                {fuelKpis.gasoilGrowth >= 0 ? '+' : ''}{fuelKpis.gasoilGrowth.toFixed(1)}%
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{formatNumber(fuelKpis.gasoil)} L</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-white p-6 rounded-2xl shadow-sm border border-green-100">
                        <div className="flex justify-between items-start mb-2">
                            <div className="text-sm text-green-600 font-medium">Volume SSP {year}</div>
                            <div className={`text - xs font - bold px - 2 py - 1 rounded - full ${fuelKpis.sspGrowth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} `}>
                                {fuelKpis.sspGrowth >= 0 ? '+' : ''}{fuelKpis.sspGrowth.toFixed(1)}%
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{formatNumber(fuelKpis.ssp)} L</div>
                    </div>
                </div>

                {/* Fuel Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h4 className="font-bold text-lg text-gray-900 mb-6">Évolution Mensuelle des Volumes</h4>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={fuelData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#718096', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#718096', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                    cursor={{ fill: '#F7FAFC' }}
                                    formatter={(value) => formatNumber(value) + ' L'}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="gasoil" name="Gasoil" fill="#F6AD55" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="ssp" name="SSP" fill="#48BB78" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
