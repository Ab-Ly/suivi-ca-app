import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Store, Coffee, Fuel, Wrench, UserCog, Disc, Droplet,
    ChevronLeft, ChevronRight, X, Settings, Calendar, TrendingUp
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import logoPetrom from '../assets/logo_petrom.png';
import { supabase } from '../lib/supabase';
import { fetchComparisonStats, getDateRange } from '../utils/statisticsUtils';
import { formatNumber, formatPrice, getArticleWeightInKg } from '../utils/formatters';

// Colors matching the design
const THEME = {
    bg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    accent: "#38bdf8",
    charts: {
        blue: "#38bdf8",
        pink: "#f472b6",
        orange: "#fb923c",
        purple: "#a78bfa",
        amber: "#fbbf24",
        emerald: "#34d399",
        red: "#f87171",
        indigo: "#818cf8"
    }
};

const CustomYAxisTick = ({ x, y, payload, unit }) => {
    let text = '';
    if (unit === 'm3') {
        text = `${payload.value} m3`;
    } else if (unit === 'L') {
        text = payload.value >= 1000 ? `${(payload.value / 1000).toFixed(0)}k L` : `${payload.value} L`;
    } else if (unit === 'kg') {
        text = payload.value >= 1000 ? `${(payload.value / 1000).toFixed(0)}k kg` : `${payload.value} kg`;
    } else if (unit === 'kDH') {
        text = `${payload.value.toFixed(0)} k`;
    } else {
        text = `${(payload.value / 1000).toFixed(0)} K`;
    }

    return (
        <g transform={`translate(${x},${y})`}>
            <text x={0} y={0} textAnchor="end" fill="#94a3b8" style={{ fontSize: '11px', fontWeight: 500 }}>
                <tspan x="0" dy="0.3em">{text}</tspan>
            </text>
        </g>
    );
};

// Settings Modal Component
const ComparisonSettingsModal = ({ isOpen, onClose, config, onUpdate }) => {
    if (!isOpen) return null;

    const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const YEARS = [2024, 2025, 2026];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#1e293b] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                    <X size={24} />
                </button>

                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Settings size={20} className="text-sky-400" />
                    Configuration de la Revue
                </h2>

                <div className="space-y-6">
                    {/* Period Type Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Type de Comparaison</label>
                        <div className="grid grid-cols-3 gap-2 bg-slate-900/50 p-1 rounded-xl">
                            {[
                                { id: 'year', label: 'Année' },
                                { id: 'month', label: 'Mois' },
                                { id: 'custom', label: 'Période' }
                            ].map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => onUpdate({ ...config, period: type.id })}
                                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${config.period === type.id
                                        ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Year Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Année de référence</label>
                        <div className="flex gap-2">
                            {YEARS.map(y => (
                                <button
                                    key={y}
                                    onClick={() => onUpdate({ ...config, year: y })}
                                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${config.year === y
                                        ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                                        : 'bg-slate-800 border-transparent text-slate-400 hover:border-slate-600'
                                        }`}
                                >
                                    {y}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Month Selection (if month mode) */}
                    {config.period === 'month' && (
                        <div className="space-y-2 animate-fade-in">
                            <label className="text-sm font-medium text-slate-300">Mois</label>
                            <div className="grid grid-cols-4 gap-2">
                                {MONTHS.map((m, i) => (
                                    <button
                                        key={m}
                                        onClick={() => onUpdate({ ...config, month: i })}
                                        className={`py-2 rounded-lg text-xs font-medium transition-all ${config.month === i
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                            }`}
                                    >
                                        {m.slice(0, 3)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Custom Range (if custom mode) */}
                    {config.period === 'custom' && (
                        <div className="space-y-2 animate-fade-in">
                            <label className="text-sm font-medium text-slate-300">Période personnalisée</label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-xs text-slate-500">De</span>
                                    <select
                                        value={config.startMonth}
                                        onChange={(e) => onUpdate({ ...config, startMonth: parseInt(e.target.value) })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                                    >
                                        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-slate-500">À</span>
                                    <select
                                        value={config.endMonth}
                                        onChange={(e) => onUpdate({ ...config, endMonth: parseInt(e.target.value) })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                                    >
                                        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-white rounded-xl font-bold shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98]"
                    >
                        Appliquer
                    </button>
                </div>
            </div>
        </div>
    );
};

const fetchMarginsForPeriod = async (start, end) => {
    // 1. Fetch fuel sales
    const { data: fuelSales } = await supabase
        .from('fuel_sales')
        .select('*')
        .gte('sale_date', start.toISOString())
        .lte('sale_date', end.toISOString());

    // 2. Fetch fuel prices
    const { data: fuelPrices } = await supabase
        .from('fuel_prices')
        .select('*')
        .order('date', { ascending: true });

    // 3. Fetch sales
    const { data: nonFuelSales } = await supabase
        .from('sales')
        .select('quantity, total_price, sale_date, articles(name, category, purchase_price)')
        .gte('sale_date', start.toISOString())
        .lte('sale_date', end.toISOString());

    // 4. Fetch monthly stock costs
    const { data: monthlyCogs } = await supabase
        .from('monthly_stock_costs')
        .select('*');

    // Helper to match sale date to closest price
    const getFuelPrice = (saleDateStr, fuelType) => {
        const saleDate = saleDateStr.split('T')[0];
        let activePrice = null;
        for (const p of fuelPrices || []) {
            if (p.fuel_type === fuelType && p.date <= saleDate) {
                activePrice = p;
            }
        }
        return activePrice || { purchase_price: 0, sale_price: 0 };
    };

    const monthlyCogsMap = {};
    (monthlyCogs || []).forEach(item => {
        monthlyCogsMap[item.month] = {
            shop: Number(item.shop_cogs || 0),
            cafe: Number(item.cafe_cogs || 0),
            bosch: Number(item.bosch_cogs || 0)
        };
    });

    // Aggregates
    let gasoilRev = 0, gasoilCost = 0, gasoilLiters = 0;
    let sspRev = 0, sspCost = 0, sspLiters = 0;

    (fuelSales || []).forEach(sale => {
        const priceInfo = getFuelPrice(sale.sale_date, sale.fuel_type);
        const qty = Number(sale.quantity_liters) || 0;
        const purchase = Number(priceInfo.purchase_price) || 0;
        const salePrice = Number(priceInfo.sale_price) || 0;
        
        const rev = qty * salePrice;
        const cost = qty * purchase;

        if (sale.fuel_type === 'Gasoil') {
            gasoilLiters += qty;
            gasoilRev += rev;
            gasoilCost += cost;
        } else if (sale.fuel_type === 'SSP') {
            sspLiters += qty;
            sspRev += rev;
            sspCost += cost;
        }
    });

    let lubRev = 0, lubCost = 0, lubQty = 0;
    let shopRev = 0, shopCost = 0;
    let cafeRev = 0, cafeCost = 0;
    let boschRev = 0, boschCost = 0;

    (nonFuelSales || []).forEach(sale => {
        const qty = Number(sale.quantity || 1);
        const rev = Number(sale.total_price || 0);
        const purchase = Number(sale.articles?.purchase_price || 0);
        const cat = (sale.articles?.category || '').toLowerCase();

        if (['lubricant_piste', 'lubricant_bosch', 'lubrifiants'].includes(cat) || cat.includes('lubrif')) {
            lubQty += qty;
            lubRev += rev;
            lubCost += qty * purchase;
        } else if (cat.includes('shop')) {
            shopRev += rev;
            const saleMonth = sale.sale_date.substring(0, 7);
            if (!monthlyCogsMap[saleMonth]) {
                shopCost += qty * purchase;
            }
        } else if (cat.includes('cafe') || cat.includes('café')) {
            cafeRev += rev;
            const saleMonth = sale.sale_date.substring(0, 7);
            if (!monthlyCogsMap[saleMonth]) {
                cafeCost += qty * purchase;
            }
        } else {
            boschRev += rev;
            const saleMonth = sale.sale_date.substring(0, 7);
            if (!monthlyCogsMap[saleMonth]) {
                boschCost += qty * purchase;
            }
        }
    });

    // Overlaps for monthly cogs
    const getMonthsInRange = (sDate, eDate) => {
        const months = [];
        let curr = new Date(sDate.getFullYear(), sDate.getMonth(), 1);
        while (curr <= eDate) {
            months.push(curr.toISOString().substring(0, 7));
            curr.setMonth(curr.getMonth() + 1);
        }
        return months;
    };

    const getMonthOverlapScale = (mStr, sDate, eDate) => {
        const mYear = parseInt(mStr.substring(0, 4));
        const mMonth = parseInt(mStr.substring(5, 7)) - 1;
        const mStart = new Date(mYear, mMonth, 1);
        const mEnd = new Date(mYear, mMonth + 1, 0, 23, 59, 59, 999);
        const overlapStart = sDate > mStart ? sDate : mStart;
        const overlapEnd = eDate < mEnd ? eDate : mEnd;
        if (overlapStart > overlapEnd) return 0;
        const overlapDays = (overlapEnd - overlapStart) / (1000 * 60 * 60 * 24) + 1;
        const monthDays = mEnd.getDate();
        return overlapDays / monthDays;
    };

    const uniqueMonths = getMonthsInRange(start, end);
    uniqueMonths.forEach(m => {
        const scale = getMonthOverlapScale(m, start, end);
        if (monthlyCogsMap[m]) {
            shopCost += monthlyCogsMap[m].shop * scale;
            cafeCost += monthlyCogsMap[m].cafe * scale;
            boschCost += monthlyCogsMap[m].bosch * scale;
        }
    });

    return {
        gasoil: { liters: gasoilLiters, revenue: gasoilRev, cost: gasoilCost, margin: gasoilRev - gasoilCost, percent: gasoilRev > 0 ? ((gasoilRev - gasoilCost) / gasoilRev) * 100 : 0 },
        ssp: { liters: sspLiters, revenue: sspRev, cost: sspCost, margin: sspRev - sspCost, percent: sspRev > 0 ? ((sspRev - sspCost) / sspRev) * 100 : 0 },
        lubricants: { quantity: lubQty, revenue: lubRev, cost: lubCost, margin: lubRev - lubCost, percent: lubRev > 0 ? ((lubRev - lubCost) / lubRev) * 100 : 0 },
        shop: { revenue: shopRev, cost: shopCost, margin: shopRev - shopCost, percent: shopRev > 0 ? ((shopRev - shopCost) / shopRev) * 100 : 0 },
        cafe: { revenue: cafeRev, cost: cafeCost, margin: cafeRev - cafeCost, percent: cafeRev > 0 ? ((cafeRev - cafeCost) / cafeRev) * 100 : 0 },
        bosch: { revenue: boschRev, cost: boschCost, margin: boschRev - boschCost, percent: boschRev > 0 ? ((boschRev - boschCost) / boschRev) * 100 : 0 },
        total: {
            revenue: gasoilRev + sspRev + lubRev + shopRev + cafeRev + boschRev,
            cost: gasoilCost + sspCost + lubCost + shopCost + cafeCost + boschCost,
            margin: (gasoilRev - gasoilCost) + (sspRev - sspCost) + (lubRev - lubCost) + (shopRev - shopCost) + (cafeRev - cafeCost) + (boschRev - boschCost),
            percent: (gasoilRev + sspRev + lubRev + shopRev + cafeRev + boschRev) > 0 ? (((gasoilRev - gasoilCost) + (sspRev - sspCost) + (lubRev - lubCost) + (shopRev - shopCost) + (cafeRev - cafeCost) + (boschRev - boschCost)) / (gasoilRev + sspRev + lubRev + shopRev + cafeRev + boschRev)) * 100 : 0
        }
    };
};

export default function PerformanceReview() {
    const navigate = useNavigate();
    const [currentSlide, setCurrentSlide] = useState(0);
    const [loading, setLoading] = useState(true);
    const [slides, setSlides] = useState([]);

    // Configuration State
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [config, setConfig] = useState({
        period: 'year', // 'year' | 'month' | 'custom'
        year: 2025,
        month: new Date().getMonth() - 1 < 0 ? 11 : new Date().getMonth() - 1, // Default to previous month
        startMonth: 0,
        endMonth: new Date().getMonth()
    });

    useEffect(() => {
        loadData();
    }, [config]); // Reload when config changes

    const loadData = async () => {
        setLoading(true);
        try {
            // Unpack config
            const { period, year, month, startMonth, endMonth } = config;

            // fetchComparisonStats
            const { data, kpis, fuelData, fuelKpis, categoryDetails, lubData, lubKpis } = await fetchComparisonStats(
                period,
                year,
                month,
                startMonth,
                endMonth
            );

            // Get Date Range for Expenses
            const { start, end, prevStart, prevEnd } = getDateRange(period, year, month, startMonth, endMonth);

            // Fetch current period expenses
            const { data: currentExpenses, error: expError } = await supabase
                .from('operating_expenses')
                .select('*')
                .gte('date', start.toISOString().split('T')[0])
                .lte('date', end.toISOString().split('T')[0]);

            if (expError) throw expError;

            // Fetch previous period expenses
            const { data: previousExpenses, error: prevExpError } = await supabase
                .from('operating_expenses')
                .select('*')
                .gte('date', prevStart.toISOString().split('T')[0])
                .lte('date', prevEnd.toISOString().split('T')[0]);

            if (prevExpError) throw prevExpError;

            // Aggregate expenses
            const aggregateExpenses = (expensesList) => {
                const categories = {};
                let total = 0;
                (expensesList || []).forEach(exp => {
                    const amount = Number(exp.amount) || 0;
                    const cat = exp.category || 'Autre';
                    categories[cat] = (categories[cat] || 0) + amount;
                    total += amount;
                });
                return { categories, total };
            };

            const currExpResult = aggregateExpenses(currentExpenses);
            const prevExpResult = aggregateExpenses(previousExpenses);

            // Fetch margins
            const currMargins = await fetchMarginsForPeriod(start, end);
            const prevMargins = await fetchMarginsForPeriod(prevStart, prevEnd);

            // Fetch lubricant location sales data to split Piste vs Bosch by Liters, kg, and CA
            const { data: currentSalesLub } = await supabase
                .from('sales')
                .select('quantity, total_price, sales_location, articles(name, category)')
                .gte('sale_date', start.toISOString())
                .lte('sale_date', end.toISOString());

            const { data: previousSalesLub } = await supabase
                .from('sales')
                .select('quantity, total_price, sales_location, articles(name, category)')
                .gte('sale_date', prevStart.toISOString())
                .lte('sale_date', prevEnd.toISOString());

            let lubVolPisteCurr = 0, lubVolPistePrev = 0;
            let lubVolBoschCurr = 0, lubVolBoschPrev = 0;
            let lubKgPisteCurr = 0, lubKgPistePrev = 0;
            let lubKgBoschCurr = 0, lubKgBoschPrev = 0;
            let lubValPisteCurr = 0, lubValPistePrev = 0;
            let lubValBoschCurr = 0, lubValBoschPrev = 0;

            const calculateLubLocationMetrics = (salesList, isCurrent) => {
                (salesList || []).forEach(sale => {
                    const qty = Number(sale.quantity || 1);
                    const rev = Number(sale.total_price || 0);
                    const name = sale.articles?.name || '';
                    const cat = sale.articles?.category || '';
                    const cleanCat = cat.toLowerCase();
                    const cleanName = name.toLowerCase();
                    const loc = sale.sales_location || '';

                    const isLubricant = cleanCat.includes('lubrif') || cleanName.includes('huile') || cleanName.includes('graisse');
                    if (isLubricant) {
                        const w = getArticleWeightInKg(name, cat, qty) || 0;
                        
                        // Parse liters
                        let liters = 0;
                        const isDrum205Or180 = cleanName.includes('205') || cleanName.includes('180');
                        const kgMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*kg/);
                        if (isDrum205Or180 && !kgMatch) {
                            liters = qty;
                        } else if (kgMatch) {
                            const capacity = parseFloat(kgMatch[1]);
                            liters = capacity * qty;
                        } else {
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

                        const isBosch = loc === 'bosch' || cleanCat.includes('bosch');
                        if (isBosch) {
                            if (isCurrent) {
                                lubVolBoschCurr += liters;
                                lubKgBoschCurr += w;
                                lubValBoschCurr += rev;
                            } else {
                                lubVolBoschPrev += liters;
                                lubKgBoschPrev += w;
                                lubValBoschPrev += rev;
                            }
                        } else {
                            if (isCurrent) {
                                lubVolPisteCurr += liters;
                                lubKgPisteCurr += w;
                                lubValPisteCurr += rev;
                            } else {
                                lubVolPistePrev += liters;
                                lubKgPistePrev += w;
                                lubValPistePrev += rev;
                            }
                        }
                    }
                });
            };

            calculateLubLocationMetrics(currentSalesLub, true);
            calculateLubLocationMetrics(previousSalesLub, false);

            // Fetch and apply historical fallback for N-1
            const findCatData = (name) => {
                const found = (categoryDetails || []).find(c => c.name === name);
                return found || { name, current: 0, previous: 0, growth: 0 };
            };
            const lubPiste = findCatData('Lubrifiant Piste');
            const lubBosch = findCatData('Lubrifiant Bosch');

            // Force alignment with categoryDetails totals in DH
            lubValPisteCurr = lubPiste.current;
            lubValPistePrev = lubPiste.previous;
            lubValBoschCurr = lubBosch.current;
            lubValBoschPrev = lubBosch.previous;

            // Calculate Dynamic Average Price for volume/weight estimation of N-1
            let totalRealLubLiters = 0;
            let totalRealLubVal = 0;
            (currentSalesLub || []).forEach(sale => {
                const qty = Number(sale.quantity || 1);
                const rev = Number(sale.total_price || 0);
                const name = sale.articles?.name || '';
                const cat = sale.articles?.category || '';
                const cleanCat = cat.toLowerCase();
                const cleanName = name.toLowerCase();

                const isLubricant = cleanCat.includes('lubrif') || cleanName.includes('huile') || cleanName.includes('graisse');
                if (isLubricant) {
                    let liters = 0;
                    const isDrum205Or180 = cleanName.includes('205') || cleanName.includes('180');
                    const kgMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*kg/);
                    if (isDrum205Or180 && !kgMatch) {
                        liters = qty;
                    } else if (kgMatch) {
                        const capacity = parseFloat(kgMatch[1]);
                        liters = capacity * qty;
                    } else {
                        let volumeLiters = null;
                        const mlMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*ml/);
                        if (mlMatch) {
                            volumeLiters = parseFloat(mlMatch[1]) / 1000;
                        } else {
                            const lMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*l/);
                            if (lMatch) volumeLiters = parseFloat(lMatch[1]);
                        }
                        if (volumeLiters === null) volumeLiters = 1.0;
                        liters = volumeLiters * qty;
                    }
                    totalRealLubLiters += liters;
                    totalRealLubVal += rev;
                }
            });
            const lubAvgPrice = totalRealLubLiters > 0 ? (totalRealLubVal / totalRealLubLiters) : 90.0;

            // Apply Fallbacks for Liter estimations
            if (lubVolPisteCurr === 0 && lubValPisteCurr > 0) lubVolPisteCurr = lubValPisteCurr / lubAvgPrice;
            if (lubVolBoschCurr === 0 && lubValBoschCurr > 0) lubVolBoschCurr = lubValBoschCurr / lubAvgPrice;
            if (lubVolPistePrev === 0 && lubValPistePrev > 0) lubVolPistePrev = lubValPistePrev / lubAvgPrice;
            if (lubVolBoschPrev === 0 && lubValBoschPrev > 0) lubVolBoschPrev = lubValBoschPrev / lubAvgPrice;

            // Apply Fallbacks for Weight estimations (kg)
            if (lubKgPisteCurr === 0 && lubVolPisteCurr > 0) lubKgPisteCurr = lubVolPisteCurr * 0.9;
            if (lubKgBoschCurr === 0 && lubVolBoschCurr > 0) lubKgBoschCurr = lubVolBoschCurr * 0.9;
            if (lubKgPistePrev === 0 && lubVolPistePrev > 0) lubKgPistePrev = lubVolPistePrev * 0.9;
            if (lubKgBoschPrev === 0 && lubVolBoschPrev > 0) lubKgBoschPrev = lubVolBoschPrev * 0.9;

            // Build Slides List
            const builtSlides = [
                { type: 'intro' }
            ];

            // 1. Carburant Focus Slide
            const fuelM3Data = fuelData.map(d => ({
                name: d.name,
                current: (d.gasoil + d.ssp) / 1000,
                previous: (d.gasoilPrev + d.sspPrev) / 1000
            }));
            const totalFuelCurrM3 = (fuelKpis.gasoil + fuelKpis.ssp) / 1000;
            const totalFuelPrevM3 = (fuelKpis.gasoilPrev + fuelKpis.sspPrev) / 1000;
            builtSlides.push({
                type: 'chart',
                title: "Focus CARBURANT (m³)",
                icon: Fuel,
                customData: fuelM3Data,
                color: THEME.charts.orange,
                unit: 'm3',
                totalCurr: totalFuelCurrM3,
                totalPrev: totalFuelPrevM3
            });

            // 2. Lubrifiants Recap Slide (Unified Vol, Poids & C.A. with 3 bars)
            const lubRecapChartData = (lubData || []).map(d => ({
                name: d.name,
                liters: d.liters || 0,
                kg: d.kg || 0,
                kdh: (d.val || 0) / 1000,
                litersPrev: d.litersPrev || 0,
                kgPrev: d.kgPrev || 0,
                kdhPrev: (d.valPrev || 0) / 1000
            }));
            builtSlides.push({
                type: 'lub_recap',
                title: "Focus LUBRIFIANTS (Vol, Poids & C.A.)",
                icon: Droplet,
                customData: lubRecapChartData,
                kpis: lubKpis,
                color: THEME.charts.indigo
            });

            // 3. Lubrifiants - Volume L Slide (comparatif)
            const lubVolumeTrend = (lubData || []).map(d => ({
                name: d.name,
                current: d.liters || 0,
                previous: d.litersPrev || 0
            }));
            builtSlides.push({
                type: 'chart',
                title: "Lubrifiants - Volume Global (L)",
                icon: Droplet,
                customData: lubVolumeTrend,
                color: THEME.charts.blue,
                unit: 'L',
                totalCurr: lubKpis.liters,
                totalPrev: lubKpis.litersPrev
            });

            // 4. Lubrifiants - Masse kg Slide (comparatif)
            const lubWeightTrend = (lubData || []).map(d => ({
                name: d.name,
                current: d.kg || 0,
                previous: d.kgPrev || 0
            }));
            builtSlides.push({
                type: 'chart',
                title: "Lubrifiants - Masse Globale (kg)",
                icon: Droplet,
                customData: lubWeightTrend,
                color: THEME.charts.emerald,
                unit: 'kg',
                totalCurr: lubKpis.kg,
                totalPrev: lubKpis.kgPrev
            });

            // 5. Lubrifiants - Chiffre d'Affaires kDH Slide (comparatif)
            const lubValTrend = (lubData || []).map(d => ({
                name: d.name,
                current: (d.val || 0) / 1000,
                previous: (d.valPrev || 0) / 1000
            }));
            builtSlides.push({
                type: 'chart',
                title: "Lubrifiants - Chiffre d'Affaires (kDH)",
                icon: Droplet,
                customData: lubValTrend,
                color: THEME.charts.indigo,
                unit: 'kDH',
                totalCurr: lubKpis.val / 1000,
                totalPrev: lubKpis.valPrev / 1000
            });

            // 6. Lubrifiants Emplacement - Volume L Slide (comparatif)
            const lubLocVolumeData = [
                { name: 'Piste', current: lubVolPisteCurr, previous: lubVolPistePrev },
                { name: 'Bosch Car Service', current: lubVolBoschCurr, previous: lubVolBoschPrev }
            ];
            builtSlides.push({
                type: 'chart',
                title: "Emplacement Lubrifiants - Volume (L)",
                icon: Droplet,
                customData: lubLocVolumeData,
                color: THEME.charts.blue,
                unit: 'L',
                totalCurr: lubVolPisteCurr + lubVolBoschCurr,
                totalPrev: lubVolPistePrev + lubVolBoschPrev
            });

            // 7. Lubrifiants Emplacement - Masse kg Slide (comparatif)
            const lubLocWeightData = [
                { name: 'Piste', current: lubKgPisteCurr, previous: lubKgPistePrev },
                { name: 'Bosch Car Service', current: lubKgBoschCurr, previous: lubKgBoschPrev }
            ];
            builtSlides.push({
                type: 'chart',
                title: "Emplacement Lubrifiants - Masse (kg)",
                icon: Droplet,
                customData: lubLocWeightData,
                color: THEME.charts.emerald,
                unit: 'kg',
                totalCurr: lubKgPisteCurr + lubKgBoschCurr,
                totalPrev: lubKgPistePrev + lubKgBoschPrev
            });

            // 8. Lubrifiants Emplacement - C.A. kDH Slide (comparatif)
            const lubLocValData = [
                { name: 'Piste', current: lubValPisteCurr / 1000, previous: lubValPistePrev / 1000 },
                { name: 'Bosch Car Service', current: lubValBoschCurr / 1000, previous: lubValBoschPrev / 1000 }
            ];
            builtSlides.push({
                type: 'chart',
                title: "Emplacement Lubrifiants - Chiffre d'Affaires (kDH)",
                icon: Droplet,
                customData: lubLocValData,
                color: THEME.charts.indigo,
                unit: 'kDH',
                totalCurr: (lubValPisteCurr + lubValBoschCurr) / 1000,
                totalPrev: (lubValPistePrev + lubValBoschPrev) / 1000
            });

            // 9. Services Presentation Pages

            const servicesToRender = [
                { name: 'Bosch Service', title: "Service - Bosch Car Service (kDH)", color: THEME.charts.blue },
                { name: 'Pneumatique', title: "Service - Pneumatique (kDH)", color: THEME.charts.pink },
                { name: "Main d'oeuvre", title: "Service - Main d'œuvre (kDH)", color: THEME.charts.amber },
                { name: 'Shop', title: "Service - Boutique / Shop (kDH)", color: THEME.charts.emerald },
                { name: 'Café', title: "Service - Café (kDH)", color: THEME.charts.indigo }
            ];

            servicesToRender.forEach(srv => {
                const srvData = findCatData(srv.name);
                const srvTrendData = (data || []).map(d => ({
                    name: d.name,
                    current: (d[srv.name] || 0) / 1000,
                    previous: (d[`${srv.name}_previous`] || 0) / 1000
                }));
                builtSlides.push({
                    type: 'chart',
                    title: srv.title,
                    icon: Store,
                    customData: srvTrendData,
                    color: srv.color,
                    unit: 'kDH',
                    totalCurr: srvData.current / 1000,
                    totalPrev: srvData.previous / 1000
                });
            });

            // 14. Details of Margin by Product (6 profit centers) Slide
            builtSlides.push({
                type: 'marge',
                title: "Détails de Marge par Produit (6 Centres de Profit)",
                icon: TrendingUp,
                currMargins,
                color: THEME.charts.emerald
            });

            // 15. Operating Expenses (Charges) Slide
            const expenseCategories = Array.from(new Set([
                ...Object.keys(currExpResult.categories),
                ...Object.keys(prevExpResult.categories)
            ]));

            const expenseChartData = expenseCategories.map(cat => ({
                name: cat,
                current: (currExpResult.categories[cat] || 0) / 1000,
                previous: (prevExpResult.categories[cat] || 0) / 1000
            })).sort((a, b) => b.current - a.current);

            builtSlides.push({
                type: 'expenses',
                title: "Charges d'Exploitation (kDH)",
                icon: UserCog,
                customData: expenseChartData,
                color: THEME.charts.red,
                unit: 'kDH',
                totalCurr: currExpResult.total / 1000,
                totalPrev: prevExpResult.total / 1000,
                hidePrevious: true
            });

            // 16. EBIT Result Slide
            builtSlides.push({
                type: 'resultat',
                title: "Résultat d'Exploitation (EBIT) en kDH",
                curr: { margin: currMargins.total.margin / 1000, expenses: currExpResult.total / 1000 },
                prev: { margin: prevMargins.total.margin / 1000, expenses: prevExpResult.total / 1000 },
                hidePrevious: true
            });

            setSlides(builtSlides);

        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };


    const nextSlide = () => setCurrentSlide(p => Math.min(p + 1, slides.length - 1));
    const prevSlide = () => setCurrentSlide(p => Math.max(p - 1, 0));

    // Keyboard nav
    useEffect(() => {
        const handleKd = (e) => {
            if (e.key === 'ArrowRight') nextSlide();
            if (e.key === 'ArrowLeft') prevSlide();
        };
        window.addEventListener('keydown', handleKd);
        return () => window.removeEventListener('keydown', handleKd);
    }, [slides.length]); // Dep dependency

    const formatVal = (val, unit = 'DH') => {
        if (!val && val !== 0) return '-';
        if (unit === 'm3') return val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' m3';
        if (unit === 'kDH') return val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + ' kDH';
        if (unit === 'L') return val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' L';
        if (unit === 'kg') return val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' kg';
        return val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/\s/g, ' ') + ' DH';
    };

    const formatBarLabel = (val, unit) => {
        if (!val) return '';
        if (unit === 'm3') return Math.round(val).toString();
        if (unit === 'L') return val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0);
        if (unit === 'kg') return val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0);
        if (unit === 'kDH') return val.toFixed(1) + ' k';
        return (val / 1000).toFixed(1) + ' k';
    };

    const renderSlideContent = (slide) => {
        if (!slide) return null;
        const { year } = config;
        if (slide.type === 'intro') {
            const getIntroText = () => {
                const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
                if (config.period === 'month') {
                    return {
                        title: `Focus Mensuel`,
                        subtitle: `${MONTHS[config.month]} ${config.year}`,
                        comparison: `${MONTHS[config.month]} ${config.year}`
                    };
                }
                if (config.period === 'custom') {
                    return {
                        title: `Focus Période`,
                        subtitle: `${MONTHS[config.startMonth]} - ${MONTHS[config.endMonth]} ${config.year}`,
                        comparison: `${MONTHS[config.startMonth]} - ${MONTHS[config.endMonth]} ${config.year}`
                    };
                }
                return {
                    title: `Comparatif Chiffre d'Affaires`,
                    subtitle: `Analyse Globale des Activités`,
                    comparison: `${config.year}`
                };
            };

            const txt = getIntroText();

            return (
                <div className="flex flex-col w-full max-w-6xl mx-auto h-full max-h-full p-2 md:p-4 animate-fade-in items-center justify-center">
                    <div className="flex flex-col items-center justify-center text-center p-8 md:p-12 bg-[#1e293b]/50 backdrop-blur-xl border border-white/5 rounded-[40px] shadow-2xl max-w-xl w-full mx-4">
                        <div className="bg-white p-6 md:p-8 rounded-3xl mb-8 shadow-lg">
                            <img src={logoPetrom} alt="Petrom" className="h-16 md:h-20 object-contain" />
                        </div>

                        <h1 className="flex flex-col gap-2 text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight leading-tight">
                            <span>Rapport de</span>
                            <span className="text-slate-200">Performance</span>
                        </h1>

                        <h2 className="text-sm md:text-base text-[#38bdf8] tracking-[0.25em] font-medium uppercase mb-8 opacity-90">
                            {txt.title}
                        </h2>

                        <div className="flex flex-col items-center">
                            <div className="text-7xl md:text-8xl font-black text-[#0ea5e9] drop-shadow-[0_0_15px_rgba(14,165,233,0.3)]"
                                style={{
                                    textShadow: '0 4px 10px rgba(0,0,0,0.5)',
                                    WebkitTextStroke: '1px rgba(255,255,255,0.1)'
                                }}>
                                {config.period === 'year' ? (
                                    <>
                                        {config.year} <span className="text-4xl md:text-5xl align-middle opacity-80">Vs</span> {config.year - 1}
                                    </>
                                ) : (
                                    <>
                                        <div className="flex flex-col gap-2">
                                            <span className="text-5xl md:text-6xl">{txt.comparison}</span>
                                            <span className="text-2xl md:text-3xl font-light text-slate-400">vs N-1</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <p className="text-slate-400 text-sm md:text-base mt-12 font-medium">{txt.subtitle}</p>
                    </div>
                </div>
            );
        }

        if (slide.type === 'resultat') {
            const { curr, prev } = slide;
            const ebitCurr = curr.margin - curr.expenses;
            const ebitPrev = prev.margin - prev.expenses;
            const ebitDiff = ebitCurr - ebitPrev;
            const ebitGrowth = ebitPrev > 0 ? (ebitDiff / ebitPrev) * 100 : (ebitDiff > 0 ? 100 : 0);

            const comparisonData = [
                { name: 'Marge Brute', current: curr.margin, previous: prev.margin },
                { name: 'Charges', current: curr.expenses, previous: prev.expenses },
                { name: 'EBIT', current: ebitCurr, previous: ebitPrev }
            ];

            return (
                <div className="flex flex-col w-full max-w-6xl mx-auto h-full max-h-full p-2 md:p-4 animate-fade-in font-sans">
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 md:p-6 shadow-2xl flex flex-col h-full overflow-hidden">
                        {/* Title */}
                        <div className="flex-none flex items-center gap-4 mb-4">
                            <div className="p-2 md:p-3 rounded-2xl bg-emerald-500/10 text-emerald-400">
                                <TrendingUp size={24} className="md:w-8 md:h-8" />
                            </div>
                            <h3 className="text-2xl md:text-3xl font-bold text-white">{slide.title}</h3>
                        </div>

                        {/* Chart & Table */}
                        <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[300px] w-full mb-4 items-stretch font-sans">
                            <div className="lg:col-span-2 relative min-h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={comparisonData} barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} dy={10} />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            width={50}
                                            tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                                            tick={{ fill: '#94a3b8' }}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                                        />
                                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ paddingTop: '0px' }} />
                                        {!slide.hidePrevious && (
                                            <Bar dataKey="previous" name={`${year - 1} (kDH)`} fill="#64748b" radius={[4, 4, 0, 0]}>
                                                <LabelList dataKey="previous" position="top" fill="#94a3b8" fontSize={10} formatter={(v) => v.toFixed(1) + ' k'} />
                                            </Bar>
                                        )}
                                        <Bar dataKey="current" name={`${year} (kDH)`} fill="#10b981" radius={[4, 4, 0, 0]}>
                                            <LabelList dataKey="current" position="top" fill="#fff" fontSize={10} formatter={(v) => v.toFixed(1) + ' k'} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Right Table */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-y-auto max-h-[350px] flex flex-col justify-start">
                                <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 text-center">
                                    Synthèse Financière (kDH)
                                </div>
                                <div className="w-full space-y-4 mt-2">
                                    <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                                        <span className="text-slate-400 font-bold">Marge Brute ({year})</span>
                                        <span className="text-white font-mono font-bold">{curr.margin.toFixed(1)} kDH</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                                        <span className="text-slate-400 font-bold">Charges d'Expl. ({year})</span>
                                        <span className="text-red-400 font-mono font-bold">-{curr.expenses.toFixed(1)} kDH</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                                        <span className="text-slate-400 font-bold">EBIT ({year})</span>
                                        <span className={`font-mono font-bold ${ebitCurr >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {ebitCurr.toFixed(1)} kDH
                                        </span>
                                    </div>
                                    {!slide.hidePrevious && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400 font-bold">Var. EBIT vs N-1</span>
                                            <span className={`font-mono font-bold ${ebitDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {ebitDiff >= 0 ? '+' : ''}{ebitDiff.toFixed(1)} kDH ({ebitGrowth >= 0 ? '+' : ''}{ebitGrowth.toFixed(1)}%)
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Bottom cards */}
                        {slide.hidePrevious ? (
                            <div className="flex-none flex justify-center w-full">
                                <div className="w-full max-w-md">
                                    <StatCard 
                                        label={`Résultat d'Exploitation (EBIT) ${year}`} 
                                        value={`${ebitCurr.toFixed(1)} kDH`} 
                                        highlight={ebitCurr >= 0 ? 'text-emerald-400' : 'text-red-400'}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex-none grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                                <StatCard 
                                    label={`EBIT ${year - 1}`} 
                                    value={`${ebitPrev.toFixed(1)} kDH`} 
                                />
                                <StatCard 
                                    label={`EBIT ${year}`} 
                                    value={`${ebitCurr.toFixed(1)} kDH`} 
                                    highlight={ebitCurr >= 0 ? 'text-emerald-400' : 'text-red-400'}
                                />
                                <StatCard 
                                    label="Variation EBIT" 
                                    value={
                                        <>
                                            <span>{ebitDiff >= 0 ? '+' : ''}{ebitDiff.toFixed(1)} k</span>
                                            <span className="ml-2 text-sm opacity-80">({ebitGrowth >= 0 ? '+' : ''}{ebitGrowth.toFixed(1)}%)</span>
                                        </>
                                    } 
                                    highlight={ebitDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}
                                />
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        if (slide.type === 'marge') {
            const { currMargins } = slide;
            const Icon = slide.icon;

            const tableRows = [
                { name: 'Gasoil', color: '#f97316', qty: currMargins.gasoil.liters ? `${formatNumber(currMargins.gasoil.liters)} L` : '--', rev: currMargins.gasoil.revenue, cost: currMargins.gasoil.cost, margin: currMargins.gasoil.margin, percent: currMargins.gasoil.percent },
                { name: 'Sans Plomb (SSP)', color: '#22c55e', qty: currMargins.ssp.liters ? `${formatNumber(currMargins.ssp.liters)} L` : '--', rev: currMargins.ssp.revenue, cost: currMargins.ssp.cost, margin: currMargins.ssp.margin, percent: currMargins.ssp.percent },
                { name: 'Lubrifiants', color: '#3b82f6', qty: currMargins.lubricants.quantity ? `${formatNumber(currMargins.lubricants.quantity)} U` : '--', rev: currMargins.lubricants.revenue, cost: currMargins.lubricants.cost, margin: currMargins.lubricants.margin, percent: currMargins.lubricants.percent },
                { name: 'Boutique (Shop)', color: '#06b6d4', qty: '--', rev: currMargins.shop.revenue, cost: currMargins.shop.cost, margin: currMargins.shop.margin, percent: currMargins.shop.percent },
                { name: 'Café / Restauration', color: '#ec4899', qty: '--', rev: currMargins.cafe.revenue, cost: currMargins.cafe.cost, margin: currMargins.cafe.margin, percent: currMargins.cafe.percent },
                { name: 'Bosch Car Service & Lavage', color: '#a855f7', qty: '--', rev: currMargins.bosch.revenue, cost: currMargins.bosch.cost, margin: currMargins.bosch.margin, percent: currMargins.bosch.percent }
            ];

            const pieData = tableRows.map(row => ({
                name: row.name,
                value: Math.max(0, row.margin),
                color: row.color
            })).filter(d => d.value > 0);

            // Sort contribution list by margin descending
            const contributionList = [...tableRows]
                .map(row => ({
                    ...row,
                    share: currMargins.total.margin > 0 ? (row.margin / currMargins.total.margin) * 100 : 0
                }))
                .sort((a, b) => b.margin - a.margin);

            return (
                <div className="flex flex-col w-full max-w-6xl mx-auto h-full max-h-full p-2 md:p-4 animate-fade-in font-sans text-slate-200">
                    <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-4 md:p-6 shadow-2xl flex flex-col h-full overflow-hidden">
                        {/* Header Title */}
                        <div className="flex-none flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <div className="p-2 md:p-3 rounded-2xl bg-emerald-500/10 text-emerald-400">
                                    <Icon size={24} className="md:w-8 md:h-8" />
                                </div>
                                <h3 className="text-xl md:text-2xl font-bold text-white">{slide.title}</h3>
                            </div>
                        </div>

                        {/* Top KPIs Grid */}
                        <div className="flex-none grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                            <div className="bg-white/5 border border-white/5 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Chiffre d'Affaires</span>
                                <span className="text-lg md:text-xl font-black text-white mt-1">{formatPrice(currMargins.total.revenue)}</span>
                            </div>
                            <div className="bg-white/5 border border-white/5 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Coût d'Achat Global</span>
                                <span className="text-lg md:text-xl font-black text-white mt-1">{formatPrice(currMargins.total.cost)}</span>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Marge Brute Globale</span>
                                <span className="text-lg md:text-xl font-black text-emerald-400 mt-1">{formatPrice(currMargins.total.margin)}</span>
                            </div>
                            <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                                <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Taux de Marge Moyen</span>
                                <span className="text-lg md:text-xl font-black text-purple-400 mt-1">{currMargins.total.percent.toFixed(2)} %</span>
                            </div>
                        </div>

                        {/* Mid Grid Content */}
                        <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 items-stretch overflow-hidden">
                            {/* Left Component (Table) - Spans 2 cols */}
                            <div className="lg:col-span-2 bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col justify-between overflow-y-auto max-h-[360px]">
                                <table className="w-full text-left border-collapse text-[11px] md:text-xs">
                                    <thead>
                                        <tr className="border-b border-white/10 text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                                            <th className="pb-2">Produit / Catégorie</th>
                                            <th className="pb-2 text-right">Quantité</th>
                                            <th className="pb-2 text-right">C.A. (DH)</th>
                                            <th className="pb-2 text-right">Coût (DH)</th>
                                            <th className="pb-2 text-right">Marge (DH)</th>
                                            <th className="pb-2 text-right">Marge %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {tableRows.map((row, index) => (
                                            <tr key={index} className="hover:bg-white/5 transition-colors font-medium">
                                                <td className="py-2 flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                                                    <span className="text-slate-200 font-bold">{row.name}</span>
                                                </td>
                                                <td className="py-2 text-right font-mono text-slate-300">{row.qty}</td>
                                                <td className="py-2 text-right font-mono">{formatPrice(row.rev).replace(' DH', '')}</td>
                                                <td className="py-2 text-right font-mono text-slate-400">{formatPrice(row.cost).replace(' DH', '')}</td>
                                                <td className="py-2 text-right font-mono text-emerald-400 font-bold">{formatPrice(row.margin).replace(' DH', '')}</td>
                                                <td className="py-2 text-right font-mono text-indigo-400 font-bold">{row.percent.toFixed(2)} %</td>
                                            </tr>
                                        ))}
                                        {/* Total Row */}
                                        <tr className="font-extrabold text-white border-t-2 border-white/10 bg-white/5">
                                            <td className="py-2.5 pl-2">TOTAL GÉNÉRAL</td>
                                            <td className="py-2.5 text-right font-mono">--</td>
                                            <td className="py-2.5 text-right font-mono">{formatPrice(currMargins.total.revenue).replace(' DH', '')}</td>
                                            <td className="py-2.5 text-right font-mono text-slate-300">{formatPrice(currMargins.total.cost).replace(' DH', '')}</td>
                                            <td className="py-2.5 text-right font-mono text-emerald-400">{formatPrice(currMargins.total.margin).replace(' DH', '')}</td>
                                            <td className="py-2.5 text-right font-mono text-purple-400">{currMargins.total.percent.toFixed(2)} %</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Right Component (Contribution & Donut) */}
                            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col justify-start overflow-y-auto max-h-[360px]">
                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-center block mb-2">
                                    Contribution à la Marge
                                </span>
                                
                                {/* Donut Chart Container */}
                                <div className="h-[130px] relative flex flex-col items-center justify-center mb-3">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={36}
                                                outerRadius={50}
                                                paddingAngle={3}
                                            >
                                                {pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(val) => formatPrice(val)} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-[8px] font-extrabold text-slate-400 uppercase">Marge brute</span>
                                        <span className="text-xs font-black text-emerald-400">{formatPrice(currMargins.total.margin).replace(' DH', '')}</span>
                                    </div>
                                </div>

                                {/* Contribution Bars List */}
                                <div className="space-y-2.5 flex-grow">
                                    {contributionList.map((item, index) => (
                                        <div key={index} className="space-y-0.5">
                                            <div className="flex justify-between items-center text-[10px]">
                                                <span className="font-bold text-slate-300 truncate max-w-[120px]">{item.name}</span>
                                                <span className="font-mono text-slate-400">
                                                    {formatPrice(item.margin).replace(' DH', '')} <span className="text-indigo-400 font-bold ml-1">({item.share.toFixed(1)}%)</span>
                                                </span>
                                            </div>
                                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full" style={{ width: `${item.share}%`, backgroundColor: item.color }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (slide.type === 'lub_recap') {
            const chartData = slide.customData;
            const Icon = slide.icon;

            return (
                <div className="flex flex-col w-full max-w-6xl mx-auto h-full max-h-full p-2 md:p-4 animate-fade-in">
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 md:p-6 shadow-2xl flex flex-col h-full overflow-hidden">
                        {/* Title */}
                        <div className="flex-none flex items-center gap-4 mb-4">
                            <div className="p-2 md:p-3 rounded-2xl bg-indigo-500/10 text-indigo-400">
                                <Icon size={24} className="md:w-8 md:h-8" />
                            </div>
                            <h3 className="text-2xl md:text-3xl font-bold text-white">{slide.title}</h3>
                        </div>

                        {/* Content Grid */}
                        <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[300px] w-full mb-4 items-stretch">
                            {/* Left Side: Chart with 3 bars */}
                            <div className="lg:col-span-2 relative min-h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} dy={10} />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            width={50}
                                            tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                                            tick={{ fill: '#94a3b8' }}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                                        />
                                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ paddingTop: '0px' }} />
                                        <Bar dataKey="liters" name="Volume (L)" fill="#38bdf8" radius={[4, 4, 0, 0]}>
                                            <LabelList dataKey="liters" position="top" fill="#94a3b8" fontSize={9} formatter={(v) => v > 0 ? Math.round(v) + ' L' : ''} />
                                        </Bar>
                                        <Bar dataKey="kg" name="Masse (kg)" fill="#34d399" radius={[4, 4, 0, 0]}>
                                            <LabelList dataKey="kg" position="top" fill="#94a3b8" fontSize={9} formatter={(v) => v > 0 ? Math.round(v) + ' kg' : ''} />
                                        </Bar>
                                        <Bar dataKey="kdh" name="C.A. (kDH)" fill="#818cf8" radius={[4, 4, 0, 0]}>
                                            <LabelList dataKey="kdh" position="top" fill="#fff" fontSize={9} formatter={(v) => v > 0 ? v.toFixed(1) + ' k' : ''} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Right Side: Detailed Table */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-y-auto max-h-[350px] flex flex-col justify-start">
                                <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 text-center">
                                    Détails de la Période Active
                                </div>
                                <div className="w-full space-y-2">
                                    <div className="grid grid-cols-4 gap-1 pb-1.5 border-b border-white/10 text-[9px] font-extrabold text-slate-400 uppercase">
                                        <span>Mois</span>
                                        <span className="text-right">Vol (L)</span>
                                        <span className="text-right">Masse (kg)</span>
                                        <span className="text-right">C.A.</span>
                                    </div>
                                    {chartData.map((item, index) => (
                                        <div key={index} className="grid grid-cols-4 gap-1 items-center text-xs py-1 border-b border-white/5 last:border-b-0 font-medium">
                                            <span className="text-slate-300 font-bold">{item.name}</span>
                                            <span className="text-right text-[#38bdf8] font-mono">{Math.round(item.liters)}</span>
                                            <span className="text-right text-[#34d399] font-mono">{Math.round(item.kg)}</span>
                                            <span className="text-right text-[#818cf8] font-bold font-mono">{item.kdh.toFixed(1)}k</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Summary StatCards */}
                        <div className="flex-none grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                            <StatCard 
                                label="Volume Global (L)" 
                                value={
                                    <div className="flex flex-col items-center">
                                        <span className="text-xl md:text-2xl font-black text-white">{formatNumber(slide.kpis?.liters || 0)} L</span>
                                        <span className="text-xs text-slate-400 font-semibold mt-0.5">N-1 : {formatNumber(slide.kpis?.litersPrev || 0)} L ({slide.kpis?.litersGrowth >= 0 ? '+' : ''}{(slide.kpis?.litersGrowth || 0).toFixed(1)}%)</span>
                                    </div>
                                } 
                            />
                            <StatCard 
                                label="Masse Globale (kg)" 
                                value={
                                    <div className="flex flex-col items-center">
                                        <span className="text-xl md:text-2xl font-black text-white">{formatNumber(slide.kpis?.kg || 0)} kg</span>
                                        <span className="text-xs text-slate-400 font-semibold mt-0.5">N-1 : {formatNumber(slide.kpis?.kgPrev || 0)} kg ({slide.kpis?.kgGrowth >= 0 ? '+' : ''}{(slide.kpis?.kgGrowth || 0).toFixed(1)}%)</span>
                                    </div>
                                } 
                            />
                            <StatCard 
                                label="Chiffre d'Affaires" 
                                value={
                                    <div className="flex flex-col items-center">
                                        <span className="text-xl md:text-2xl font-black text-sky-400">{formatVal((slide.kpis?.val || 0) / 1000, 'kDH')}</span>
                                        <span className="text-xs text-slate-400 font-semibold mt-0.5">N-1 : {formatVal((slide.kpis?.valPrev || 0) / 1000, 'kDH')} ({slide.kpis?.valGrowth >= 0 ? '+' : ''}{(slide.kpis?.valGrowth || 0).toFixed(1)}%)</span>
                                    </div>
                                } 
                            />
                        </div>
                    </div>
                </div>
            );
        }

        if (slide.type === 'expenses') {
            const chartData = slide.customData;
            const currentTotal = slide.totalCurr;
            const previousTotal = slide.totalPrev;
            const diff = currentTotal - previousTotal;
            const growth = previousTotal !== 0 ? (diff / previousTotal) * 100 : 0;
            const unit = 'kDH';

            const EXPENSE_CATEGORIES = [
                { value: 'Loyer', label: 'Loyer / Redevance foncière', hex: '#3B82F6' },
                { value: 'Electricite', label: 'Électricité', hex: '#EAB308' },
                { value: 'Eau', label: 'Eau & Assainissement', hex: '#06B6D4' },
                { value: 'Salaires', label: 'Salaires & CNSS (Fixe)', hex: '#A855F7' },
                { value: 'Interim', label: 'Personnel Intérimaire', hex: '#F43F5E' },
                { value: 'Taxes', label: 'Impôts & Taxes Locales', hex: '#EF4444' },
                { value: 'Assurances', label: 'Assurances', hex: '#10B981' },
                { value: 'Entretien', label: 'Entretien & Réparations', hex: '#F97316' },
                { value: 'Fournitures', label: 'Fournitures & Consommables', hex: '#EC4899' },
                { value: 'Commissions', label: 'Commissions TPE & Cartes', hex: '#D97706' },
                { value: 'Securite', label: 'Sécurité & Gardiennage', hex: '#4F46E5' },
                { value: 'Telecom', label: 'Télécoms & Internet', hex: '#0284C7' },
                { value: 'Comptabilite', label: 'Honoraires Comptables', hex: '#7C3AED' },
                { value: 'Marketing', label: 'Publicité & Marketing', hex: '#0D9488' },
                { value: 'Transport', label: 'Transport & Logistique', hex: '#65A30D' },
                { value: 'Nettoyage', label: 'Nettoyage & Assainissement', hex: '#059669' },
                { value: 'Autre', label: 'Autre / Divers', hex: '#6B7280' }
            ];

            const getCategoryHex = (catValue) => {
                const found = EXPENSE_CATEGORIES.find(c => c.value === catValue || c.label === catValue);
                return found ? found.hex : '#6B7280';
            };

            const pieData = chartData.map(d => ({
                name: d.name,
                value: Math.max(0, d.current),
                color: getCategoryHex(d.name)
            })).filter(d => d.value > 0);

            return (
                <div className="flex flex-col w-full max-w-6xl mx-auto h-full max-h-full p-2 md:p-4 animate-fade-in">
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 md:p-6 shadow-2xl flex flex-col h-full overflow-hidden">
                        {/* Title */}
                        <div className="flex-none flex items-center gap-4 mb-4">
                            <div className="p-2 md:p-3 rounded-2xl bg-purple-500/10 text-purple-500">
                                <UserCog size={24} className="md:w-8 md:h-8" />
                            </div>
                            <h3 className="text-2xl md:text-3xl font-bold text-white">{slide.title}</h3>
                        </div>

                        {/* Content Grid */}
                        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0 mb-6 items-center">
                            {/* Left Side: Pie Chart */}
                            <div className="h-full min-h-[200px] max-h-[300px] relative flex flex-col items-center justify-center">
                                <span className="text-[11px] font-extrabold text-purple-400 uppercase tracking-widest mb-3">Répartition des charges (N)</span>
                                <ResponsiveContainer width="100%" height="90%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={75}
                                            paddingAngle={3}
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => formatVal(value, 'kDH')} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Right Side: Detailed Progress bars */}
                            <div className="overflow-y-auto max-h-[300px] pr-2 space-y-3">
                                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2">Détails des Charges par Catégorie</span>
                                {chartData.length === 0 ? (
                                    <div className="text-center text-slate-400 py-10 font-medium">Aucune charge enregistrée.</div>
                                ) : (
                                    chartData.map((item, index) => {
                                        const hex = getCategoryHex(item.name);
                                        const pct = currentTotal > 0 ? (item.current / currentTotal) * 100 : 0;
                                        return (
                                            <div key={index} className="space-y-1">
                                                <div className="flex justify-between items-center text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hex }}></span>
                                                        <span className="font-bold text-slate-200">{item.name}</span>
                                                    </div>
                                                    <div className="font-mono text-slate-300 font-bold">
                                                        {formatVal(item.current, 'kDH')} <span className="text-slate-500 font-semibold text-[10px] ml-1">({pct.toFixed(1)}%)</span>
                                                    </div>
                                                </div>
                                                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: hex }}></div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Summary StatCards */}
                        {slide.hidePrevious ? (
                            <div className="flex-none flex justify-center w-full">
                                <div className="w-full max-w-md">
                                    <StatCard label={`Total Charges d'Exploitation ${year}`} value={formatVal(currentTotal, unit)} />
                                </div>
                            </div>
                        ) : (
                            <div className="flex-none grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                                <StatCard label={`Total Charges ${year - 1}`} value={formatVal(previousTotal, unit)} />
                                <StatCard label={`Total Charges ${year}`} value={formatVal(currentTotal, unit)} />
                                <StatCard
                                    label="Évolution"
                                    value={
                                        <>
                                            <span>{diff > 0 ? '+' : ''}{formatVal(diff, unit)}</span>
                                            <span className="ml-2 text-sm opacity-80">({growth > 0 ? '+' : ''}{growth.toFixed(1)}%)</span>
                                        </>
                                    }
                                    highlight={diff <= 0 ? 'text-emerald-400' : 'text-red-400'}
                                />
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        // Chart Slide
        const chartData = slide.customData;
        const currentTotal = slide.totalCurr !== undefined ? slide.totalCurr : (chartData.reduce((acc, d) => acc + d.current, 0));
        const previousTotal = slide.totalPrev !== undefined ? slide.totalPrev : (chartData.reduce((acc, d) => acc + d.previous, 0));
        const diff = currentTotal - previousTotal;
        const growth = previousTotal !== 0 ? (diff / previousTotal) * 100 : (diff > 0 ? 100 : 0);
        const unit = slide.unit || 'DH';

        const Icon = slide.icon;

        return (
            <div className="flex flex-col w-full max-w-6xl mx-auto h-full max-h-full p-2 md:p-4 animate-fade-in">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 md:p-6 shadow-2xl flex flex-col h-full">
                    <div className="flex-none flex items-center gap-4 mb-4">
                        <div className={`p-2 md:p-3 rounded-2xl bg-${slide.color}/10 text-[${slide.color}]`} style={{ backgroundColor: `${slide.color}20`, color: slide.color }}>
                            <Icon size={24} className="md:w-8 md:h-8" />
                        </div>
                        <h3 className="text-2xl md:text-3xl font-bold text-white">{slide.title}</h3>
                    </div>

                    <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[300px] w-full mb-4 items-stretch">
                        {/* Chart (Spans 2 columns on lg) */}
                        <div className="lg:col-span-2 relative min-h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} barGap={4}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} dy={10} />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        width={50}
                                        tick={<CustomYAxisTick unit={unit} />}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                                        formatter={(val) => formatVal(val, unit)}
                                    />
                                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ paddingTop: '0px' }} />
                                    {!slide.hidePrevious && (
                                        <Bar
                                            dataKey="previous"
                                            name={`${year - 1}${unit === 'm3' ? ' (m3)' : ''}`}
                                            fill={unit === 'm3' ? '#A16207' : '#64748b'}
                                            radius={[4, 4, 4, 4]}
                                        >
                                            <LabelList
                                                dataKey="previous"
                                                position="top"
                                                fill="#94a3b8"
                                                fontSize={10}
                                                formatter={(val) => formatBarLabel(val, unit)}
                                            />
                                        </Bar>
                                    )}
                                    <Bar
                                        dataKey="current"
                                        name={`${year}${unit === 'm3' ? ' (m3)' : ''}`}
                                        fill={unit === 'm3' ? '#EA580C' : slide.color}
                                        radius={[4, 4, 4, 4]}
                                    >
                                        <LabelList
                                            dataKey="current"
                                            position="top"
                                            fill="#fff"
                                            fontSize={10}
                                            formatter={(val) => formatBarLabel(val, unit)}
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Permanent Table Details */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-y-auto max-h-[350px] flex flex-col justify-start">
                            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 text-center">
                                Détails par Période ({unit})
                            </div>
                            <div className="w-full space-y-2">
                                <div className={`grid ${slide.hidePrevious ? 'grid-cols-2' : 'grid-cols-4'} gap-1 pb-1.5 border-b border-white/10 text-[9px] font-extrabold text-slate-400 uppercase`}>
                                    <span>Période</span>
                                    {!slide.hidePrevious && <span className="text-right">N-1</span>}
                                    <span className="text-right">N</span>
                                    {!slide.hidePrevious && <span className="text-right">Var %</span>}
                                </div>
                                {chartData.map((item, index) => {
                                    const diff = item.current - item.previous;
                                    const growth = item.previous > 0 ? (diff / item.previous) * 100 : (diff > 0 ? 100 : 0);
                                    return (
                                        <div key={index} className={`grid ${slide.hidePrevious ? 'grid-cols-2' : 'grid-cols-4'} gap-1 items-center text-xs py-1 border-b border-white/5 last:border-b-0 font-medium`}>
                                            <span className="text-slate-300 font-bold">{item.name}</span>
                                            {!slide.hidePrevious && <span className="text-right text-slate-400 font-mono">{formatVal(item.previous, unit).replace(` ${unit}`, '')}</span>}
                                            <span className="text-right text-white font-bold font-mono">{formatVal(item.current, unit).replace(` ${unit}`, '')}</span>
                                            {!slide.hidePrevious && (
                                                <span className={`text-right font-mono font-bold ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {growth > 0 ? '+' : ''}{growth.toFixed(0)}%
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="flex-none grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                        {slide.type === 'lub_recap' ? (
                            <>
                                <StatCard 
                                    label="Volume Global (L)" 
                                    value={
                                        <div className="flex flex-col items-center">
                                            <span className="text-xl md:text-2xl font-black text-white">{formatNumber(slide.kpis?.liters || 0)} L</span>
                                            <span className="text-xs text-slate-400 font-semibold mt-0.5">N-1 : {formatNumber(slide.kpis?.litersPrev || 0)} L ({slide.kpis?.litersGrowth >= 0 ? '+' : ''}{(slide.kpis?.litersGrowth || 0).toFixed(1)}%)</span>
                                        </div>
                                    } 
                                />
                                <StatCard 
                                    label="Masse Globale (kg)" 
                                    value={
                                        <div className="flex flex-col items-center">
                                            <span className="text-xl md:text-2xl font-black text-white">{formatNumber(slide.kpis?.kg || 0)} kg</span>
                                            <span className="text-xs text-slate-400 font-semibold mt-0.5">N-1 : {formatNumber(slide.kpis?.kgPrev || 0)} kg ({slide.kpis?.kgGrowth >= 0 ? '+' : ''}{(slide.kpis?.kgGrowth || 0).toFixed(1)}%)</span>
                                        </div>
                                    } 
                                />
                                <StatCard 
                                    label="Chiffre d'Affaires" 
                                    value={
                                        <div className="flex flex-col items-center">
                                            <span className="text-xl md:text-2xl font-black text-sky-400">{formatVal((slide.kpis?.val || 0) / 1000, 'kDH')}</span>
                                            <span className="text-xs text-slate-400 font-semibold mt-0.5">N-1 : {formatVal((slide.kpis?.valPrev || 0) / 1000, 'kDH')} ({slide.kpis?.valGrowth >= 0 ? '+' : ''}{(slide.kpis?.valGrowth || 0).toFixed(1)}%)</span>
                                        </div>
                                    } 
                                />
                            </>
                        ) : (
                            <>
                                {slide.hidePrevious ? (
                                    <div className="col-span-3 flex justify-center w-full">
                                        <div className="w-full max-w-md">
                                            <StatCard label={`Total ${year}`} value={formatVal(currentTotal, unit)} />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <StatCard label={`Total ${year - 1}`} value={formatVal(previousTotal, unit)} />
                                        <StatCard label={`Total ${year}`} value={formatVal(currentTotal, unit)} />
                                        <StatCard
                                            label="Ecart"
                                            value={
                                                <>
                                                    <span>{diff > 0 ? '+' : ''}{formatVal(diff, unit)}</span>
                                                    <span className="ml-2 text-sm opacity-80">({growth > 0 ? '+' : ''}{growth.toFixed(1)}%)</span>
                                                </>
                                            }
                                            highlight={diff >= 0 ? 'text-emerald-400' : 'text-red-400'}
                                        />
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div >
        );
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center text-white z-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-white/20 border-t-indigo-500 rounded-full animate-spin"></div>
                    <p className="text-xl font-light tracking-widest uppercase">Chargement des données...</p>
                </div>
                <ComparisonSettingsModal
                    isOpen={isConfigOpen}
                    onClose={() => setIsConfigOpen(false)}
                    config={config}
                    onUpdate={setConfig}
                />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans text-slate-100 flex flex-col"
            style={{ background: THEME.bg }}>

            {/* Header Controls */}
            <div className="absolute top-4 right-4 z-50 flex gap-2">
                <button
                    onClick={() => setIsConfigOpen(true)}
                    className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full shadow-lg transition-all active:scale-95 group"
                >
                    <Settings size={20} className="text-white group-hover:rotate-45 transition-transform" />
                </button>
                <button
                    onClick={() => navigate('/')}
                    className="p-3 bg-red-500/80 hover:bg-red-500 backdrop-blur-md rounded-full shadow-lg transition-all active:scale-95"
                >
                    <X size={20} className="text-white" />
                </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 w-full relative overflow-hidden flex flex-col items-center justify-center">
                <div className="w-full flex-1 flex flex-col items-center justify-center p-2 md:p-4 min-h-0">
                    {renderSlideContent(slides[currentSlide])}
                </div>

                {/* Controls - Static Footer */}
                <div className="w-full pb-4 pt-2 flex flex-col items-center gap-3 z-50 flex-shrink-0">
                    {/* Dots */}
                    <div className="flex gap-2">
                        {slides.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentSlide(i)}
                                className={`w-2 h-2 rounded-full transition-all duration-300 ${i === currentSlide
                                    ? 'bg-sky-400 scale-125'
                                    : 'bg-slate-600 hover:bg-slate-500'
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Arrows */}
                    <div className="hidden md:flex items-center gap-4">
                        <button
                            onClick={prevSlide}
                            disabled={currentSlide === 0}
                            className="p-2 rounded-full bg-slate-800/80 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 disabled:opacity-30 disabled:hover:bg-slate-800/80 transition-all backdrop-blur-md group"
                        >
                            <ChevronLeft size={20} className="text-slate-300 group-hover:text-white" />
                        </button>
                        <button
                            onClick={nextSlide}
                            disabled={currentSlide === slides.length - 1}
                            className="p-2 rounded-full bg-slate-800/80 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 disabled:opacity-30 disabled:hover:bg-slate-800/80 transition-all backdrop-blur-md group"
                        >
                            <ChevronRight size={20} className="text-slate-300 group-hover:text-white" />
                        </button>
                    </div>
                </div>
            </div>

            <ComparisonSettingsModal
                isOpen={isConfigOpen}
                onClose={() => setIsConfigOpen(false)}
                config={config}
                onUpdate={setConfig}
            />
        </div>
    );
}

const StatCard = ({ label, value, highlight }) => (
    <div className="bg-white/5 border border-white/5 hover:border-white/10 rounded-xl p-4 flex flex-col items-center justify-center transition-all hover:bg-white/[0.07]">
        <span className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">{label}</span>
        <div className={`text-2xl md:text-3xl font-extrabold tracking-tight ${highlight || 'text-white'}`}>
            {value}
        </div>
    </div>
);
