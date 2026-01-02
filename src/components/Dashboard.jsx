import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card } from './ui/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { DollarSign, Coffee, Wrench, Droplet, ShoppingBag, Loader2, Fuel, LayoutDashboard, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatPrice, formatNumber } from '../utils/formatters';
import { getMappedCategory } from '../utils/statisticsUtils';

const COLORS = ['#FCCF31', '#43E97B', '#4FACFE', '#667EEA', '#764BA2'];

export default function Dashboard() {
    const { refreshTrigger } = useOutletContext() || {};
    const [period, setPeriod] = useState('month');
    const [loading, setLoading] = useState(true);

    const [stats, setStats] = useState({
        total: 0,
        shop: 0,
        cafe: 0,
        bosch: 0,
        pneumatique: 0,
        lub_piste: 0,
        lub_bosch: 0,
        fuel_gasoil: 0,
        fuel_ssp: 0
    });

    const [chartData, setChartData] = useState([]);
    const [lubData, setLubData] = useState([]);
    const [fuelChartData, setFuelChartData] = useState([]);
    const [fuelUnit, setFuelUnit] = useState('L'); // 'L' or 'm3'

    const [dateReference, setDateReference] = useState(new Date());

    useEffect(() => {
        fetchDashboardData();
    }, [period, dateReference, refreshTrigger]);

    const handlePrevious = () => {
        const newDate = new Date(dateReference);
        if (period === 'day') newDate.setDate(newDate.getDate() - 1);
        else if (period === 'week') newDate.setDate(newDate.getDate() - 7);
        else if (period === 'month') newDate.setMonth(newDate.getMonth() - 1);
        else if (period === 'year') newDate.setFullYear(newDate.getFullYear() - 1);
        setDateReference(newDate);
    };

    const handleNext = () => {
        const newDate = new Date(dateReference);
        if (period === 'day') newDate.setDate(newDate.getDate() + 1);
        else if (period === 'week') newDate.setDate(newDate.getDate() + 7);
        else if (period === 'month') newDate.setMonth(newDate.getMonth() + 1);
        else if (period === 'year') newDate.setFullYear(newDate.getFullYear() + 1);
        setDateReference(newDate);
    };

    const isCurrentPeriod = () => {
        const now = new Date();
        if (period === 'day') return dateReference.toDateString() === now.toDateString();
        if (period === 'month') return dateReference.getMonth() === now.getMonth() && dateReference.getFullYear() === now.getFullYear();
        if (period === 'year') return dateReference.getFullYear() === now.getFullYear();
        return false;
    };

    const getPeriodLabel = () => {
        if (period === 'day') return dateReference.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        if (period === 'month') return dateReference.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        if (period === 'year') return dateReference.getFullYear().toString();
        return 'Semaine du ' + dateReference.toLocaleDateString('fr-FR');
    };

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // Define date range based on period
            const now = new Date(dateReference); // Use reference date
            let startDate = new Date(now);
            let endDate = new Date(now);

            if (period === 'day') {
                startDate.setHours(0, 0, 0, 0); // Start of selected day
                endDate.setHours(23, 59, 59, 999); // End of selected day
                // Previously logic used startDate = now - 1 day. 
                // Standard logic: Day View = Selected Day.
                // If user wants yesterday, they click "Previous".
            }
            else if (period === 'week') {
                const day = startDate.getDay() || 7; // Get current day number, converting Sun (0) to 7
                if (day !== 1) startDate.setHours(-24 * (day - 1)); // Set to Monday
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 6);
                endDate.setHours(23, 59, 59, 999);
            }
            else if (period === 'month') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                endDate.setHours(23, 59, 59, 999);
            }
            else if (period === 'year') {
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear(), 11, 31);
                endDate.setHours(23, 59, 59, 999);
            }

            // Fetch Sales
            const { data: sales, error } = await supabase
                .from('sales')
                .select(`
                        *,
                        articles (
                            name,
                            category
                        )
                    `)
                .gte('sale_date', startDate.toISOString())
                .lte('sale_date', endDate.toISOString());

            if (error) throw error;

            // Fetch Fuel Sales
            let fuelSales = [];
            try {
                const { data, error: fuelError } = await supabase
                    .from('fuel_sales')
                    .select('*')
                    .gte('sale_date', startDate.toISOString())
                    .lte('sale_date', endDate.toISOString());

                if (fuelError) {
                    console.warn('Error fetching fuel sales (table might be missing):', fuelError);
                } else {
                    fuelSales = data || [];
                }
            } catch (err) {
                console.warn('Exception fetching fuel sales:', err);
            }

            // Fetch Historical Data (Manual Entries) if period is 'year'
            let historicalData = [];
            if (period === 'year') {
                const { data: history, error: historyError } = await supabase
                    .from('historical_sales')
                    .select('*')
                    .eq('year', now.getFullYear());

                if (!historyError && history) {
                    historicalData = history;
                }
            }

            // Process Data
            let total = 0;
            let shop = 0, cafe = 0, bosch = 0, pneumatique = 0, lub_piste = 0, lub_bosch = 0;
            let fuel_gasoil = 0, fuel_ssp = 0;
            const dailyMap = {};
            const fuelMap = {};

            // Helper to initialize map entry
            const initMapEntry = (dateKey, sortKey) => {
                if (!dailyMap[dateKey]) {
                    dailyMap[dateKey] = { name: dateKey, sortKey: sortKey, shop: 0, cafe: 0, bosch: 0, pneumatique: 0, lub_piste: 0, lub_bosch: 0 };
                }
                if (!fuelMap[dateKey]) {
                    fuelMap[dateKey] = { name: dateKey, sortKey: sortKey, gasoil: 0, ssp: 0 };
                }
            };

            // Helper to get consistent keys and sort values
            const getDateKeys = (dateStr) => {
                const d = new Date(dateStr);
                let dateKey, sortKey;

                if (period === 'year') {
                    dateKey = d.toLocaleDateString('fr-FR', { month: 'short' });
                    sortKey = d.getMonth(); // 0-11 for sorting
                } else if (period === 'month' || period === 'week') {
                    // Use actual date DD/MM for timeline
                    dateKey = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                    sortKey = d.getTime(); // timestamp for sorting
                } else {
                    // Day view (fallback or specific) - usually groups by Hour? 
                    // Current code grouped by weekday for everything else. 
                    // Let's stick to DD/MM even for 'day' to be safe, or if 'day' view is actually hour-based, we'd need that.
                    // But usually dashboard is 'Day' period = "Yesterday" or "Today".
                    // If period is 'day', usually we want hourly breakdown?
                    // The fetch logic for 'day' fetches -1 day range.
                    // Existing logic used `weekday: short` which was "lun."
                    // Let's use HH:00 for 'day' view if we want hourly, or just DD/MM if it's a summary.
                    // Given the request is about "values Lundi sont cumulés", implying a multi-day view.
                    // For 'day' view (single day), `weekday` results in just ONE bar "lun.".
                    // Let's assume standard behavior:
                    // Only Year uses Month names.
                    // All others use DD/MM.
                    dateKey = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                    sortKey = d.getTime();
                }
                return { dateKey, sortKey };
            };

            // Process Real Sales
            sales.forEach(sale => {
                const saleDate = new Date(sale.sale_date);

                // Flexible Period Filtering to avoid Timezone loss
                if (period === 'month') {
                    if (saleDate.getMonth() !== now.getMonth() || saleDate.getFullYear() !== now.getFullYear()) return;
                } else if (period === 'year') {
                    if (saleDate.getFullYear() !== now.getFullYear()) return;
                } else if (period === 'day') {
                    // For day, strict range is usually fine, or check strict date equality
                    if (saleDate < startDate || saleDate > endDate) return;
                } else {
                    // Week / Custom
                    if (saleDate < startDate || saleDate > endDate) return;
                }

                const amount = sale.total_price;
                const category = sale.articles?.category || 'Autre';
                const location = sale.sales_location;

                const { dateKey, sortKey } = getDateKeys(sale.sale_date);

                total += amount;

                // Category Stats
                const mappedCategory = getMappedCategory(category, location, sale.articles?.name);

                if (mappedCategory === 'Shop') shop += amount;
                else if (mappedCategory === 'Café') cafe += amount;
                else if (mappedCategory === 'Bosch Service' || mappedCategory === "Main d'oeuvre") bosch += amount;
                else if (mappedCategory === 'Pneumatique') pneumatique += amount;
                else if (mappedCategory === 'Lubrifiant Bosch') lub_bosch += amount;
                else if (mappedCategory === 'Lubrifiant Piste') lub_piste += amount;

                // Chart Data
                initMapEntry(dateKey, sortKey);

                if (mappedCategory === 'Shop') dailyMap[dateKey].shop += amount;
                else if (mappedCategory === 'Café') dailyMap[dateKey].cafe += amount;
                else if (mappedCategory === 'Bosch Service' || mappedCategory === "Main d'oeuvre") dailyMap[dateKey].bosch += amount;
                else if (mappedCategory === 'Pneumatique') dailyMap[dateKey].pneumatique += amount;
                else if (mappedCategory === 'Lubrifiant Bosch') dailyMap[dateKey].lub_bosch += amount;
                else if (mappedCategory === 'Lubrifiant Piste') dailyMap[dateKey].lub_piste += amount;
            });

            // Process Fuel Sales
            fuelSales.forEach(sale => {
                const saleDate = new Date(sale.sale_date);

                // Flexible Period Filtering
                if (period === 'month') {
                    if (saleDate.getMonth() !== now.getMonth() || saleDate.getFullYear() !== now.getFullYear()) return;
                } else if (period === 'year') {
                    if (saleDate.getFullYear() !== now.getFullYear()) return;
                } else if (period === 'day') {
                    if (saleDate < startDate || saleDate > endDate) return;
                } else {
                    if (saleDate < startDate || saleDate > endDate) return;
                }

                const qty = Number(sale.quantity_liters);
                const { dateKey, sortKey } = getDateKeys(sale.sale_date);

                initMapEntry(dateKey, sortKey);

                if (sale.fuel_type === 'Gasoil') {
                    fuel_gasoil += qty;
                    fuelMap[dateKey].gasoil += qty;
                }
                else if (sale.fuel_type === 'SSP') {
                    fuel_ssp += qty;
                    fuelMap[dateKey].ssp += qty;
                }
            });

            // Process Historical Data (Manual Entries)
            // Note: Historical data is strictly aggregated by Month/Year in the DB 'historical_sales' table usually (month columns).
            // If period === 'year', we use it. If period === 'month', we might have granular data or not?
            // Usually historical_sales has 'month' column (int 1-12).
            // So historical data ONLY applies effectively to 'year' view where we group by month.
            // If the user selects 'month' view, we can't really map 'historical_sales' (monthly aggregate) to specific daily ticks.
            // So we only process historical data if period === 'year'.

            if (period === 'year') {
                const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

                historicalData.forEach(item => {
                    const amount = item.amount;
                    const category = item.category;

                    // Historical data has 'month' (1-12)
                    const monthIndex = item.month - 1;
                    const dateKey = MONTH_LABELS[monthIndex];
                    const sortKey = monthIndex; // Consistent with year view sort logic

                    // Only add to Total if NOT Fuel Volume
                    const catLower = (category || '').toLowerCase();
                    const isFuel = catLower.includes('gasoil') || catLower.includes('ssp') || catLower.includes('sans plomb');

                    if (!isFuel) {
                        total += amount;
                    }

                    const mappedCategory = getMappedCategory(category, '', '');

                    if (mappedCategory === 'Shop') shop += amount;
                    else if (mappedCategory === 'Café') cafe += amount;
                    else if (mappedCategory === 'Bosch Service' || mappedCategory === "Main d'oeuvre") bosch += amount;
                    else if (mappedCategory === 'Pneumatique') pneumatique += amount;
                    else if (mappedCategory === 'Lubrifiant Piste') lub_piste += amount;
                    else if (mappedCategory === 'Lubrifiant Bosch') lub_bosch += amount;

                    // Chart Data
                    initMapEntry(dateKey, sortKey);

                    if (mappedCategory === 'Shop') dailyMap[dateKey].shop += amount;
                    else if (mappedCategory === 'Café') dailyMap[dateKey].cafe += amount;
                    else if (mappedCategory === 'Bosch Service' || mappedCategory === "Main d'oeuvre") dailyMap[dateKey].bosch += amount;
                    else if (mappedCategory === 'Pneumatique') dailyMap[dateKey].pneumatique += amount;
                    else if (mappedCategory === 'Lubrifiant Piste') dailyMap[dateKey].lub_piste += amount;
                    else if (mappedCategory === 'Lubrifiant Bosch') dailyMap[dateKey].lub_bosch += amount;

                    // Fuel Historical Data
                    const numAmount = Number(amount) || 0;
                    if (catLower.includes('gasoil')) {
                        fuel_gasoil += numAmount;
                        initMapEntry(dateKey, sortKey);
                        fuelMap[dateKey].gasoil += numAmount;
                    }
                    else if (catLower.includes('ssp') || catLower.includes('sans plomb')) {
                        fuel_ssp += numAmount;
                        initMapEntry(dateKey, sortKey);
                        fuelMap[dateKey].ssp += numAmount;
                    }
                });
            }

            // Sort chart data
            let chartDataArray = Object.values(dailyMap);
            let fuelChartArray = Object.values(fuelMap);

            // Sort by the sortKey we created
            const sorter = (a, b) => a.sortKey - b.sortKey;

            chartDataArray.sort(sorter);
            fuelChartArray.sort(sorter);

            setStats({ total, shop, cafe, bosch, pneumatique, lub_piste, lub_bosch, fuel_gasoil, fuel_ssp });
            setChartData(chartDataArray);
            setFuelChartData(fuelChartArray);
            setLubData([
                { name: 'Lub. Piste', value: lub_piste },
                { name: 'Lub. Bosch', value: lub_bosch }
            ].filter(d => d.value > 0));

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatFuel = (liters) => {
        if (fuelUnit === 'm3') return formatNumber(liters / 1000, 3);
        return formatNumber(liters, 0);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-text-main flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                            <LayoutDashboard size={24} />
                        </div>
                        Tableau de bord
                    </h2>
                    <p className="text-text-muted text-sm pl-[52px]">Aperçu de vos performances</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-center">
                    {/* Date Navigation */}
                    <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-border">
                        <button onClick={handlePrevious} className="p-1.5 hover:bg-gray-50 rounded-lg text-text-muted hover:text-text-main transition-colors">
                            <ChevronDown className="rotate-90" size={20} />
                        </button>
                        <span className="px-2 text-sm font-bold text-text-main min-w-[120px] text-center capitalize">
                            {getPeriodLabel()}
                        </span>
                        <button onClick={handleNext} disabled={isCurrentPeriod()} className={`p-1.5 rounded-lg transition-colors ${isCurrentPeriod() ? 'text-gray-300 cursor-not-allowed' : 'text-text-muted hover:text-text-main hover:bg-gray-50'}`}>
                            <ChevronDown className="-rotate-90" size={20} />
                        </button>
                    </div>

                    {/* Period Selector */}
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-border">
                        {['day', 'week', 'month', 'year'].map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-4 py-1.5 text-sm rounded-lg capitalize transition-all font-medium ${period === p ? 'bg-gradient-dark text-white shadow-md' : 'text-text-muted hover:text-text-main hover:bg-gray-50'
                                    }`}
                            >
                                {p === 'day' ? 'Jour' : p === 'week' ? 'Semaine' : p === 'month' ? 'Mois' : 'Année'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Gradient Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gradient-purple rounded-2xl p-6 text-white shadow-lg shadow-purple-200 transform transition-transform hover:-translate-y-1">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <DollarSign size={24} />
                        </div>
                        <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded-full">Total</span>
                    </div>
                    <div className="text-3xl font-bold mb-1">{formatPrice(stats.total)}</div>
                    <div className="text-purple-100 text-sm">Chiffre d'affaire global</div>
                </div>

                <div className="bg-gradient-orange rounded-2xl p-6 text-white shadow-lg shadow-orange-200 transform transition-transform hover:-translate-y-1">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <ShoppingBag size={24} />
                        </div>
                        <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded-full">Shop</span>
                    </div>
                    <div className="text-3xl font-bold mb-1">{formatPrice(stats.shop)}</div>
                    <div className="text-orange-100 text-sm">Ventes boutique</div>
                </div>

                <div className="bg-gradient-blue rounded-2xl p-6 text-white shadow-lg shadow-blue-200 transform transition-transform hover:-translate-y-1">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <Wrench size={24} />
                        </div>
                        <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded-full">Services Auto</span>
                    </div>
                    <div className="text-3xl font-bold mb-1">{formatPrice(stats.bosch + stats.pneumatique)}</div>
                    <div className="text-blue-100 text-sm">Bosch, Main d'oeuvre & Pneu</div>
                </div>

                <div className="bg-gradient-green rounded-2xl p-6 text-white shadow-lg shadow-green-200 transform transition-transform hover:-translate-y-1">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <Coffee size={24} />
                        </div>
                        <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded-full">Café</span>
                    </div>
                    <div className="text-3xl font-bold mb-1">{formatPrice(stats.cafe)}</div>
                    <div className="text-green-100 text-sm">Ventes café</div>
                </div>

                {/* Lubricants Card (New) */}
                <div className="bg-gradient-pink rounded-2xl p-6 text-white shadow-lg shadow-pink-200 transform transition-transform hover:-translate-y-1">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <Droplet size={24} />
                        </div>
                        <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded-full">Lubrifiants</span>
                    </div>
                    <div className="text-3xl font-bold mb-1">{formatPrice(stats.lub_piste + stats.lub_bosch)}</div>
                    <div className="text-pink-100 text-sm">Piste & Bosch</div>
                </div>

                {/* Fuel Volume Card */}
                <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl p-6 text-white shadow-lg shadow-slate-200 transform transition-transform hover:-translate-y-1 relative group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <Fuel size={24} />
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); setFuelUnit(prev => prev === 'L' ? 'm3' : 'L'); }}
                            className="text-xs font-bold bg-white/20 px-2 py-1 rounded-full hover:bg-white/30 transition-colors cursor-pointer"
                        >
                            {fuelUnit}
                        </button>
                    </div>
                    <div className="text-2xl font-bold mb-1">{formatFuel(stats.fuel_gasoil + stats.fuel_ssp)} <span className="text-sm font-normal opacity-70">{fuelUnit}</span></div>
                    <div className="text-slate-300 text-xs flex flex-col gap-0.5 mt-2">
                        <div className="flex justify-between">
                            <span>Gasoil:</span>
                            <span className="font-medium text-white">{formatFuel(stats.fuel_gasoil)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>SSP:</span>
                            <span className="font-medium text-white">{formatFuel(stats.fuel_ssp)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 border-none shadow-lg shadow-gray-100/50 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-border">
                        <h3 className="font-bold text-lg text-text-main">Évolution du Chiffre d'Affaire</h3>
                        <p className="text-sm text-text-muted">Répartition par service sur la période</p>
                    </div>
                    <div className="h-80 p-6 overflow-x-auto custom-scrollbar">
                        <div style={{ width: '100%', minWidth: Math.max(600, chartData.length * 60) }} className="h-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#718096', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#718096', fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontSize: '12px', padding: '8px' }}
                                        cursor={{ fill: '#F7FAFC' }}
                                        formatter={(value) => formatPrice(value)}
                                        itemStyle={{ padding: 0 }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                                    <Bar dataKey="shop" stackId="a" fill="#FCCF31" name="Shop" radius={[0, 0, 4, 4]} barSize={32} />
                                    <Bar dataKey="cafe" stackId="a" fill="#43E97B" name="Café" />
                                    <Bar dataKey="bosch" stackId="a" fill="#4FACFE" name="Bosch" />
                                    <Bar dataKey="pneumatique" stackId="a" fill="#00C9FF" name="Pneu" />
                                    <Bar dataKey="lub_piste" stackId="a" fill="#667EEA" name="Lub. Piste" />
                                    <Bar dataKey="lub_bosch" stackId="a" fill="#764BA2" name="Lub. Bosch" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </Card>

                <Card className="border-none shadow-lg shadow-gray-100/50 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-border">
                        <h3 className="font-bold text-lg text-text-main">Lubrifiants</h3>
                        <p className="text-sm text-text-muted">Répartition Piste vs Bosch</p>
                    </div>
                    <div className="h-64 p-6 relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <PieChart>
                                <Pie
                                    data={lubData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {lubData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#667EEA' : '#764BA2'} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                    formatter={(value) => formatPrice(value)}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Text */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center mt-4">
                                <div className="text-xs text-text-muted">Total</div>
                                <div className="font-bold text-text-main">{formatNumber(stats.lub_piste + stats.lub_bosch)}</div>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 pb-6 space-y-3">
                        {lubData.map((entry, index) => (
                            <div key={index} className="flex justify-between items-center text-sm p-3 bg-gray-50 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-primary' : 'bg-secondary'}`}></div>
                                    <span className="text-text-main font-medium">{entry.name}</span>
                                </div>
                                <span className="font-bold text-text-main">{formatPrice(entry.value)}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Fuel Evolution Chart */}
                <Card className="lg:col-span-3 border-none shadow-lg shadow-gray-100/50 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-border">
                        <h3 className="font-bold text-lg text-text-main">Évolution Volume Carburant</h3>
                        <p className="text-sm text-text-muted">Gasoil vs Sans Plomb (Litres)</p>
                    </div>
                    <div className="h-80 p-2 sm:p-6 overflow-x-auto custom-scrollbar">
                        <div style={{ width: '100%', minWidth: Math.max(600, fuelChartData.length * 60) }} className="h-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <AreaChart data={fuelChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorGasoil" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#F6AD55" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#F6AD55" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorSSP" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#48BB78" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#48BB78" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#718096', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#718096', fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                        cursor={{ fill: '#F7FAFC' }}
                                        formatter={(value) => formatNumber(value) + ' L'}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Area type="monotone" dataKey="gasoil" stroke="#DD6B20" fillOpacity={1} fill="url(#colorGasoil)" name="Gasoil" strokeWidth={2} />
                                    <Area type="monotone" dataKey="ssp" stroke="#38A169" fillOpacity={1} fill="url(#colorSSP)" name="SSP" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
