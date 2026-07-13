import React, { useState, useEffect } from 'react';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, Cell } from 'recharts';
import { Loader2, TrendingUp, TrendingDown, ChevronDown, ChevronUp, ShoppingBag, Coffee, Wrench, Droplet, Disc, Hammer, Fuel, Scale } from 'lucide-react';
import { formatPrice, formatNumber } from '../../utils/formatters';
import { fetchComparisonStats } from '../../utils/statisticsUtils';
import { supabase } from '../../lib/supabase';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

const getCategoryIcon = (category) => {
    const catLower = category.toLowerCase();
    if (catLower.includes('shop')) return <ShoppingBag size={20} className="text-purple-600" />;
    if (catLower.includes('café') || catLower.includes('cafe')) return <Coffee size={20} className="text-amber-700" />;
    if (catLower.includes('bosch')) {
        if (catLower.includes('lubrifiant')) return <Droplet size={20} className="text-blue-600" />;
        return <Wrench size={20} className="text-red-600" />;
    }
    if (catLower.includes('main')) return <Hammer size={20} className="text-slate-600" />;
    if (catLower.includes('pneumatique')) return <Disc size={20} className="text-gray-700" />;
    if (catLower.includes('lubrifiant')) return <Droplet size={20} className="text-blue-600" />;
    return <div className="w-2 h-2 rounded-full bg-gray-400" />;
};

const computeFuelRevenue = (fuelData, fuelPrices, currentYear, period, selectedMonth, customStartMonth, customEndMonth) => {
    if (!fuelData || fuelData.length === 0 || !fuelPrices || fuelPrices.length === 0) {
        return { chartData: [], kpis: { gasoil: 0, ssp: 0, gasoilPrev: 0, sspPrev: 0, gasoilGrowth: 0, sspGrowth: 0 } };
    }

    const getActivePrice = (dateStr, type) => {
        let active = null;
        for (const p of fuelPrices) {
            if (p.fuel_type === type && p.date <= dateStr) {
                active = p;
            }
        }
        return active || { sale_price: 0, purchase_price: 0 };
    };

    let datesCurr = [];
    let datesPrev = [];

    if (period === 'year') {
        for (let i = 0; i < 12; i++) {
            const mStr = String(i + 1).padStart(2, '0');
            datesCurr.push(`${currentYear}-${mStr}-15`);
            datesPrev.push(`${currentYear - 1}-${mStr}-15`);
        }
    } else if (period === 'custom') {
        const rangeLen = customEndMonth - customStartMonth + 1;
        for (let i = 0; i < rangeLen; i++) {
            const mStr = String(customStartMonth + i + 1).padStart(2, '0');
            datesCurr.push(`${currentYear}-${mStr}-15`);
            datesPrev.push(`${currentYear - 1}-${mStr}-15`);
        }
    } else if (period === 'month') {
        const daysInMonth = fuelData.length;
        const mStr = String(selectedMonth + 1).padStart(2, '0');
        for (let i = 0; i < daysInMonth; i++) {
            const dStr = String(i + 1).padStart(2, '0');
            datesCurr.push(`${currentYear}-${mStr}-${dStr}`);
            datesPrev.push(`${currentYear - 1}-${mStr}-${dStr}`);
        }
    } else if (period === 'week') {
        const now = new Date();
        const currentMonday = new Date(now);
        const day = currentMonday.getDay() || 7;
        if (day !== 1) currentMonday.setDate(currentMonday.getDate() - (day - 1));
        
        for (let i = 0; i < 7; i++) {
            const dCurr = new Date(currentMonday);
            dCurr.setDate(currentMonday.getDate() + i);
            dCurr.setFullYear(currentYear);
            datesCurr.push(dCurr.toISOString().split('T')[0]);

            const dPrev = new Date(currentMonday);
            dPrev.setDate(currentMonday.getDate() + i);
            dPrev.setFullYear(currentYear - 1);
            datesPrev.push(dPrev.toISOString().split('T')[0]);
        }
    } else if (period === 'day') {
        const todayStr = new Date().toISOString().split('T')[0];
        const lastYearStr = new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];
        datesCurr.push(todayStr);
        datesPrev.push(lastYearStr);
    }

    let totalGasoil = 0, totalSSP = 0, totalGasoilPrev = 0, totalSSPPrev = 0;

    const chartData = fuelData.map((d, i) => {
        const dateCurr = datesCurr[i] || datesCurr[datesCurr.length - 1];
        const datePrev = datesPrev[i] || datesPrev[datesPrev.length - 1];

        const priceGasoilCurr = Number(getActivePrice(dateCurr, 'Gasoil').sale_price || 0);
        const priceGasoilPrev = Number(getActivePrice(datePrev, 'Gasoil').sale_price || 0);
        const priceSSPCurr = Number(getActivePrice(dateCurr, 'SSP').sale_price || 0);
        const priceSSPPrev = Number(getActivePrice(datePrev, 'SSP').sale_price || 0);

        const gasoilRev = d.gasoil * priceGasoilCurr;
        const gasoilPrevRev = d.gasoilPrev * priceGasoilPrev;
        const sspRev = d.ssp * priceSSPCurr;
        const sspPrevRev = d.sspPrev * priceSSPPrev;

        totalGasoil += gasoilRev;
        totalSSP += sspRev;
        totalGasoilPrev += gasoilPrevRev;
        totalSSPPrev += sspPrevRev;

        return {
            name: d.name,
            gasoil: gasoilRev,
            gasoilPrev: gasoilPrevRev,
            ssp: sspRev,
            sspPrev: sspPrevRev
        };
    });

    const gasoilGrowth = totalGasoilPrev > 0 ? ((totalGasoil - totalGasoilPrev) / totalGasoilPrev) * 100 : 0;
    const sspGrowth = totalSSPPrev > 0 ? ((totalSSP - totalSSPPrev) / totalSSPPrev) * 100 : 0;

    return {
        chartData,
        kpis: {
            gasoil: totalGasoil,
            ssp: totalSSP,
            gasoilPrev: totalGasoilPrev,
            sspPrev: totalSSPPrev,
            gasoilGrowth,
            sspGrowth
        }
    };
};


export default function ComparisonCharts() {
    const [year, setYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-11

    // Custom Period State
    const [customStartMonth, setCustomStartMonth] = useState(0); // 0 = Jan
    const [customEndMonth, setCustomEndMonth] = useState(new Date().getMonth());

    const [period, setPeriod] = useState('year'); // 'day', 'week', 'month', 'year', 'custom'
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [kpis, setKpis] = useState({ currentTotal: 0, previousTotal: 0, growth: 0 });
    const [categoryDetails, setCategoryDetails] = useState([]);


    // Fuel State
    const [fuelData, setFuelData] = useState([]);
    const [fuelKpis, setFuelKpis] = useState({ gasoil: 0, ssp: 0, gasoilPrev: 0, sspPrev: 0, gasoilGrowth: 0, sspGrowth: 0 });

    // Fuel Revenue State
    const [fuelRevenueData, setFuelRevenueData] = useState([]);
    const [fuelRevenueKpis, setFuelRevenueKpis] = useState({ gasoil: 0, ssp: 0, gasoilPrev: 0, sspPrev: 0, gasoilGrowth: 0, sspGrowth: 0 });

    // Lubricant State
    const [lubData, setLubData] = useState([]);
    const [lubMetricView, setLubMetricView] = useState('liters');
    const [lubKpis, setLubKpis] = useState({ 
        liters: 0, kg: 0, val: 0, 
        litersPrev: 0, kgPrev: 0, valPrev: 0, 
        litersGrowth: 0, kgGrowth: 0, valGrowth: 0 
    });

    useEffect(() => {
        fetchComparisonData();
    }, [year, period, selectedMonth, customStartMonth, customEndMonth]);



    const fetchComparisonData = async () => {
        setLoading(true);
        try {
            // Fetch comparison statistics
            const result = await fetchComparisonStats(period, year, selectedMonth, customStartMonth, customEndMonth);

            // Fetch fuel prices to convert volumes to revenues
            const { data: prices } = await supabase
                .from('fuel_prices')
                .select('*')
                .order('date', { ascending: true });

            setData(result.data);
            setKpis(result.kpis);
            setFuelData(result.fuelData);
            setFuelKpis(result.fuelKpis);
            setLubData(result.lubData || []);
            setLubKpis(result.lubKpis || { liters: 0, kg: 0, val: 0, litersPrev: 0, kgPrev: 0, valPrev: 0, litersGrowth: 0, kgGrowth: 0, valGrowth: 0 });
            setCategoryDetails(result.categoryDetails);

            // Compute fuel revenue statistics
            const revResult = computeFuelRevenue(result.fuelData, prices || [], year, period, selectedMonth, customStartMonth, customEndMonth);
            setFuelRevenueData(revResult.chartData);
            setFuelRevenueKpis(revResult.kpis);

        } catch (error) {
            console.error('Error fetching comparison data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Dynamic Title Logic
    const isFuelFallback = period === 'month' && fuelData.every(d => d.gasoil === 0 && d.ssp === 0 && d.gasoilPrev === 0 && d.sspPrev === 0);

    let chartTitle = '';
    let chartSubtitle = '';

    if (period === 'year') {
        chartTitle = 'Comparatif Mensuel des Volumes';
        chartSubtitle = `Comparaison des volumes vendus par mois (${year} vs ${year - 1})`;
    } else if (period === 'custom') {
        chartTitle = `Comparatif Personnalisé (${MONTHS[customStartMonth]} - ${MONTHS[customEndMonth]})`;
        chartSubtitle = `Comparaison ${year} vs ${year - 1} sur la période sélectionnée`;
    } else if (period === 'month') {
        if (isFuelFallback) {
            chartTitle = `Volume Global du Mois de ${MONTHS[selectedMonth]}`;
            chartSubtitle = `Total cumulé sur le mois (Comparaison ${year} vs ${year - 1})`;
        } else {
            chartTitle = `Suivi Journalier des Volumes - ${MONTHS[selectedMonth]} ${year}`;
            chartSubtitle = `Détail jour par jour sur le mois sélectionné`;
        }
    } else if (period === 'week') {
        chartTitle = 'Comparatif Hebdomadaire';
        chartSubtitle = 'Performance sur la semaine (Lun-Dim)';
    } else {
        chartTitle = 'Comparatif Horaire';
        chartSubtitle = 'Volume moyen par heure sur la période';
    }

    return (
        <div className="space-y-8">
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">Chiffre d'Affaire {period === 'year' || period === 'custom' ? year : 'Actuel'}</div>
                    <div className="text-2xl font-bold text-gray-900">{formatPrice(kpis.currentTotal)}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">Chiffre d'Affaire {period === 'year' || period === 'custom' ? year - 1 : 'Précédent'}</div>
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
                    {['day', 'week', 'month', 'year', 'custom'].map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-1.5 text-sm rounded-lg capitalize transition-all font-medium ${period === p ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                } `}
                        >
                            {p === 'day' ? 'Jour' : p === 'week' ? 'Semaine' : p === 'month' ? 'Mois' : p === 'year' ? 'Année' : 'Personnalisé'}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    {period === 'custom' && (
                        <>
                            <div className="relative">
                                <select
                                    value={customStartMonth}
                                    onChange={(e) => setCustomStartMonth(Number(e.target.value))}
                                    className="appearance-none bg-white border border-gray-200 text-gray-700 py-2 pl-4 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium shadow-sm text-sm"
                                >
                                    {MONTHS.map((m, i) => (
                                        <option key={i} value={i} disabled={i > customEndMonth}>{m}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                            </div>
                            <span className="text-gray-400">-</span>
                            <div className="relative">
                                <select
                                    value={customEndMonth}
                                    onChange={(e) => setCustomEndMonth(Number(e.target.value))}
                                    className="appearance-none bg-white border border-gray-200 text-gray-700 py-2 pl-4 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium shadow-sm text-sm"
                                >
                                    {MONTHS.map((m, i) => (
                                        <option key={i} value={i} disabled={i < customStartMonth}>{m}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                            </div>
                        </>
                    )}

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

                    {(period === 'year' || period === 'month' || period === 'custom') && (
                        <div className="relative">
                            <select
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                className="appearance-none bg-white border border-gray-200 text-gray-700 py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium shadow-sm"
                            >
                                {[new Date().getFullYear() - 2, new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => (
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
                                 <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barGap={3}>
                                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                     <XAxis
                                         dataKey="name"
                                         axisLine={false}
                                         tickLine={false}
                                         tick={{ fill: '#64748b', fontSize: 12 }}
                                         dy={10}
                                         minTickGap={15}
                                     />
                                     <YAxis
                                         axisLine={false}
                                         tickLine={false}
                                         tick={{ fill: '#64748b', fontSize: 12 }}
                                         tickFormatter={(value) => `${value / 1000} k`}
                                     />
                                     <Tooltip
                                         contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                         cursor={{ fill: '#F1F5F9', opacity: 0.4 }}
                                         formatter={(value) => formatPrice(value)}
                                     />
                                     <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                     <Bar
                                         dataKey="previous"
                                         name={period === 'year' ? (year - 1).toString() : "Période précédente"}
                                         fill="#94A3B8"
                                         radius={[4, 4, 0, 0]}
                                         maxBarSize={40}
                                     />
                                     <Bar
                                         dataKey="current"
                                         name={period === 'year' ? year.toString() : "Période actuelle"}
                                         fill="#4F46E5"
                                         radius={[4, 4, 0, 0]}
                                         maxBarSize={40}
                                     />
                                 </BarChart>
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
                            <thead className="text-gray-500 font-medium border-b border-gray-100 text-xs sm:text-sm">
                                <tr>
                                    <th className="py-3 pr-2 sm:pr-4">Catégorie</th>
                                    <th className="py-3 px-1 sm:px-4 text-right whitespace-nowrap">CA {year - 1}</th>
                                    <th className="py-3 px-1 sm:px-4 text-right whitespace-nowrap">CA {year}</th>
                                    <th className="py-3 pl-1 sm:pl-4 text-right">Évolution</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {categoryDetails.map((cat) => (
                                    <tr key={cat.name} className="hover:bg-gray-50/50 transition-colors text-xs sm:text-sm">
                                        <td className="py-4 pr-2 sm:pr-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-gray-50 rounded-xl shrink-0 border border-gray-100">
                                                    {getCategoryIcon(cat.name)}
                                                </div>
                                                <span className="font-medium text-gray-900 break-words">{cat.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-1 sm:px-4 text-right text-gray-600 font-mono whitespace-nowrap">{formatPrice(cat.previous)}</td>
                                        <td className="py-4 px-1 sm:px-4 text-right text-gray-900 font-medium font-mono whitespace-nowrap">{formatPrice(cat.current)}</td>
                                        <td className="py-4 pl-1 sm:pl-4 text-right">
                                            <div className={`flex items-center justify-end gap-1.5 ${cat.growth >= 0 ? 'text-green-600 bg-green-50 px-2 py-1 rounded-lg w-fit ml-auto' : 'text-red-600 bg-red-50 px-2 py-1 rounded-lg w-fit ml-auto'} `}>
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
                    {/* Gasoil Card */}
                    <div className="bg-gradient-to-br from-orange-50 to-white p-6 rounded-2xl shadow-sm border border-orange-100">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-4 items-center">
                                <div className="p-3 bg-orange-100/50 rounded-xl text-orange-600">
                                    <Fuel size={24} />
                                </div>
                                <div>
                                    <div className="text-sm text-orange-600 font-medium mb-1">Volume Gasoil {period === 'year' ? year : 'Actuel'}</div>
                                    <div className="text-3xl font-bold text-gray-900 mb-1">{formatNumber(fuelKpis.gasoil)} L</div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-500 font-medium">{period === 'year' ? year - 1 : 'Précédent'}:</span>
                                        <span className="text-gray-700 font-bold">{formatNumber(fuelKpis.gasoilPrev)} L</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <div className={`text-sm font-bold px-3 py-1.5 rounded-full flex items-center gap-1 ${fuelKpis.gasoilGrowth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} `}>
                                    {fuelKpis.gasoilGrowth >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                    {fuelKpis.gasoilGrowth >= 0 ? '+' : ''}{fuelKpis.gasoilGrowth.toFixed(1)}%
                                </div>
                                <div className={`text-xs font-bold px-2 py-1 rounded-md ${((fuelKpis.gasoil - fuelKpis.gasoilPrev) / 1000) >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'} `}>
                                    {((fuelKpis.gasoil - fuelKpis.gasoilPrev) / 1000) >= 0 ? '+' : ''}{((fuelKpis.gasoil - fuelKpis.gasoilPrev) / 1000).toFixed(2)} m³
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SSP Card */}
                    <div className="bg-gradient-to-br from-green-50 to-white p-6 rounded-2xl shadow-sm border border-green-100">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-4 items-center">
                                <div className="p-3 bg-green-100/50 rounded-xl text-green-600">
                                    <Fuel size={24} />
                                </div>
                                <div>
                                    <div className="text-sm text-green-600 font-medium mb-1">Volume SSP {period === 'year' ? year : 'Actuel'}</div>
                                    <div className="text-3xl font-bold text-gray-900 mb-1">{formatNumber(fuelKpis.ssp)} L</div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-500 font-medium">{period === 'year' ? year - 1 : 'Précédent'}:</span>
                                        <span className="text-gray-700 font-bold">{formatNumber(fuelKpis.sspPrev)} L</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <div className={`text-sm font-bold px-3 py-1.5 rounded-full flex items-center gap-1 ${fuelKpis.sspGrowth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} `}>
                                    {fuelKpis.sspGrowth >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                    {fuelKpis.sspGrowth >= 0 ? '+' : ''}{fuelKpis.sspGrowth.toFixed(1)}%
                                </div>
                                <div className={`text-xs font-bold px-2 py-1 rounded-md ${((fuelKpis.ssp - fuelKpis.sspPrev) / 1000) >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'} `}>
                                    {((fuelKpis.ssp - fuelKpis.sspPrev) / 1000) >= 0 ? '+' : ''}{((fuelKpis.ssp - fuelKpis.sspPrev) / 1000).toFixed(2)} m³
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Fuel Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="mb-6">
                        <h4 className="font-bold text-lg text-gray-900">{chartTitle}</h4>
                        <p className="text-sm text-gray-500 mt-1">{chartSubtitle}</p>
                    </div>
                    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
                        <div className="h-[400px] w-full min-w-[600px] sm:min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                                {isFuelFallback ? (
                                    // Fallback Chart (unchanged logic, just styling update)
                                    <BarChart
                                        data={[
                                            { name: 'Gasoil', amountPrev: fuelKpis.gasoilPrev, amount: fuelKpis.gasoil, type: 'Gasoil' },
                                            { name: 'SSP', amountPrev: fuelKpis.sspPrev, amount: fuelKpis.ssp, type: 'SSP' }
                                        ]}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                        barGap={0}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 13, fontWeight: 500 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                                        <Tooltip
                                            cursor={{ fill: '#F8FAFC' }}
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload;
                                                    const growth = data.amountPrev ? ((data.amount - data.amountPrev) / data.amountPrev * 100) : 0;
                                                    return (
                                                        <div className="bg-white p-4 shadow-xl rounded-2xl border border-gray-100 min-w-[200px]">
                                                            <p className="font-bold text-gray-900 mb-3 text-lg">{data.name}</p>
                                                            <div className="space-y-3">
                                                                <div className="flex justify-between items-center group">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`w-2 h-2 rounded-full ${data.type === 'Gasoil' ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                                                                        <span className="text-sm text-gray-500 font-medium">Actuel (N)</span>
                                                                    </div>
                                                                    <span className="text-base font-bold text-gray-900">{formatNumber(data.amount)} L</span>
                                                                </div>
                                                                <div className="flex justify-between items-center group">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`w-2 h-2 rounded-full ${data.type === 'Gasoil' ? 'bg-orange-200' : 'bg-green-200'}`}></div>
                                                                        <span className="text-sm text-gray-400 font-medium">Précédent (N-1)</span>
                                                                    </div>
                                                                    <span className="text-sm font-semibold text-gray-500">{formatNumber(data.amountPrev)} L</span>
                                                                </div>
                                                                <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                                                                    <span className="text-xs text-gray-500 font-medium">Évolution</span>
                                                                    <span className={`text-sm font-bold ${growth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                                        {growth > 0 ? '+' : ''}{growth.toFixed(1)}%
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="amountPrev" name="N-1" radius={[4, 4, 0, 0]} barSize={60}>
                                            {
                                                [
                                                    { fill: '#FED7AA' }, // Orange 200
                                                    { fill: '#BBF7D0' }, // Green 200
                                                ].map((entry, index) => (
                                                    <Cell key={`cell-prev-${index}`} fill={entry.fill} />
                                                ))
                                            }
                                        </Bar>
                                        <Bar dataKey="amount" name="N" radius={[4, 4, 0, 0]} barSize={60}>
                                            {
                                                [
                                                    { fill: '#F97316' }, // Orange 500
                                                    { fill: '#22C55E' }, // Green 500
                                                ].map((entry, index) => (
                                                    <Cell key={`cell-curr-${index}`} fill={entry.fill} />
                                                ))
                                            }
                                        </Bar>
                                    </BarChart>
                                ) : (
                                    // Standard Detailed Chart
                                    <BarChart data={fuelData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barGap={2}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                                            dy={10}
                                            interval={period === 'month' ? 3 : 0}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94A3B8', fontSize: 11 }}
                                            tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#F1F5F9', opacity: 0.6 }}
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="bg-white p-4 shadow-xl rounded-2xl border border-gray-100 min-w-[220px]">
                                                            <p className="font-bold text-gray-900 mb-3 border-b border-gray-50 pb-2 bg-gray-50 -mx-4 -mt-4 px-4 pt-4 rounded-t-2xl text-center">
                                                                {period === 'month' ? `${label} ${MONTHS[selectedMonth]}` : label}
                                                            </p>

                                                            {/* Gasoil Section */}
                                                            <div className="mb-4">
                                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Gasoil</p>
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                                                        <span className="text-xs text-gray-500">Actuel</span>
                                                                    </div>
                                                                    <span className="font-bold text-gray-900 text-sm">{formatNumber(payload.find(p => p.dataKey === 'gasoil')?.value || 0)} L</span>
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="w-2 h-2 rounded-full bg-orange-200"></div>
                                                                        <span className="text-xs text-gray-400">N-1</span>
                                                                    </div>
                                                                    <span className="font-semibold text-gray-500 text-sm">{formatNumber(payload.find(p => p.dataKey === 'gasoilPrev')?.value || 0)} L</span>
                                                                </div>
                                                            </div>

                                                            {/* SSP Section */}
                                                            <div>
                                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">SSP</p>
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                                        <span className="text-xs text-gray-500">Actuel</span>
                                                                    </div>
                                                                    <span className="font-bold text-gray-900 text-sm">{formatNumber(payload.find(p => p.dataKey === 'ssp')?.value || 0)} L</span>
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="w-2 h-2 rounded-full bg-green-200"></div>
                                                                        <span className="text-xs text-gray-400">N-1</span>
                                                                    </div>
                                                                    <span className="font-semibold text-gray-500 text-sm">{formatNumber(payload.find(p => p.dataKey === 'sspPrev')?.value || 0)} L</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Legend
                                            iconType="circle"
                                            iconSize={8}
                                            wrapperStyle={{ paddingTop: '24px', paddingBottom: '10px' }}
                                            formatter={(value) => <span className="text-sm font-medium text-gray-600 ml-1">{value}</span>}
                                        />
                                        <Bar dataKey="gasoilPrev" name="Gasoil (N-1)" fill="#FED7AA" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                        <Bar dataKey="gasoil" name="Gasoil (N)" fill="#F97316" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                        <Bar dataKey="sspPrev" name="SSP (N-1)" fill="#BBF7D0" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                        <Bar dataKey="ssp" name="SSP (N)" fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    </BarChart>
                                )}
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            {/* Fuel Revenue Statistics Section */}
            <div className="space-y-6 pt-6 border-t border-gray-150">
                <h3 className="font-bold text-xl text-gray-900">Statistiques Carburant (Chiffre d'affaire)</h3>

                {/* Fuel Revenue KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Gasoil Revenue Card */}
                    <div className="bg-gradient-to-br from-orange-50/50 to-white p-6 rounded-2xl shadow-sm border border-orange-100/70">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-4 items-center">
                                <div className="p-3 bg-orange-100/50 rounded-xl text-orange-600">
                                    <Fuel size={24} />
                                </div>
                                <div>
                                    <div className="text-sm text-orange-600 font-medium mb-1">CA Gasoil {period === 'year' ? year : 'Actuel'}</div>
                                    <div className="text-2xl font-black text-gray-900 mb-1">{formatPrice(fuelRevenueKpis.gasoil)}</div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-500 font-medium">{period === 'year' ? year - 1 : 'Précédent'}:</span>
                                        <span className="text-gray-700 font-bold">{formatPrice(fuelRevenueKpis.gasoilPrev)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <div className={`text-sm font-bold px-3 py-1.5 rounded-full flex items-center gap-1 ${fuelRevenueKpis.gasoilGrowth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} `}>
                                    {fuelRevenueKpis.gasoilGrowth >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                    {fuelRevenueKpis.gasoilGrowth >= 0 ? '+' : ''}{fuelRevenueKpis.gasoilGrowth.toFixed(1)}%
                                </div>
                                <div className={`text-xs font-bold px-2 py-1 rounded-md ${fuelRevenueKpis.gasoil - fuelRevenueKpis.gasoilPrev >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'} `}>
                                    {fuelRevenueKpis.gasoil - fuelRevenueKpis.gasoilPrev >= 0 ? '+' : ''}{formatPrice(fuelRevenueKpis.gasoil - fuelRevenueKpis.gasoilPrev)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SSP Revenue Card */}
                    <div className="bg-gradient-to-br from-green-50/50 to-white p-6 rounded-2xl shadow-sm border border-green-100/70">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-4 items-center">
                                <div className="p-3 bg-green-100/50 rounded-xl text-green-650">
                                    <Fuel size={24} />
                                </div>
                                <div>
                                    <div className="text-sm text-green-650 font-medium mb-1">CA SSP {period === 'year' ? year : 'Actuel'}</div>
                                    <div className="text-2xl font-black text-gray-900 mb-1">{formatPrice(fuelRevenueKpis.ssp)}</div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-500 font-medium">{period === 'year' ? year - 1 : 'Précédent'}:</span>
                                        <span className="text-gray-700 font-bold">{formatPrice(fuelRevenueKpis.sspPrev)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <div className={`text-sm font-bold px-3 py-1.5 rounded-full flex items-center gap-1 ${fuelRevenueKpis.sspGrowth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} `}>
                                    {fuelRevenueKpis.sspGrowth >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                    {fuelRevenueKpis.sspGrowth >= 0 ? '+' : ''}{fuelRevenueKpis.sspGrowth.toFixed(1)}%
                                </div>
                                <div className={`text-xs font-bold px-2 py-1 rounded-md ${fuelRevenueKpis.ssp - fuelRevenueKpis.sspPrev >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'} `}>
                                    {fuelRevenueKpis.ssp - fuelRevenueKpis.sspPrev >= 0 ? '+' : ''}{formatPrice(fuelRevenueKpis.ssp - fuelRevenueKpis.sspPrev)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Fuel Revenue Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="mb-6">
                        <h4 className="font-bold text-lg text-gray-900">
                            {period === 'year' ? "Comparatif Mensuel du Chiffre d'Affaires Carburant" :
                             period === 'custom' ? `Comparatif Revenus Personnalisé (${MONTHS[customStartMonth]} - ${MONTHS[customEndMonth]})` :
                             period === 'month' ? (isFuelFallback ? `CA Carburant Global du Mois de ${MONTHS[selectedMonth]}` : `Suivi Journalier du CA Carburant - ${MONTHS[selectedMonth]} ${year}`) :
                             period === 'week' ? "Comparatif Revenus Hebdomadaire" : "Comparatif Revenus Horaire"}
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                            {period === 'year' ? `Comparaison des revenus de vente de carburant par mois (${year} vs ${year - 1})` :
                             period === 'custom' ? `Revenus de vente de carburant ${year} vs ${year - 1}` :
                             period === 'month' ? (isFuelFallback ? `Revenus cumulés sur le mois (Comparaison ${year} vs ${year - 1})` : `Revenus carburant jour par jour sur le mois sélectionné`) :
                             period === 'week' ? "Performance des revenus sur la semaine (Lun-Dim)" : "Revenus moyens par heure sur la période"}
                        </p>
                    </div>
                    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
                        <div className="h-[400px] w-full min-w-[600px] sm:min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                                {isFuelFallback ? (
                                    <BarChart
                                        data={[
                                            { name: 'Gasoil', amountPrev: fuelRevenueKpis.gasoilPrev, amount: fuelRevenueKpis.gasoil, type: 'Gasoil' },
                                            { name: 'SSP', amountPrev: fuelRevenueKpis.sspPrev, amount: fuelRevenueKpis.ssp, type: 'SSP' }
                                        ]}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                        barGap={0}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 13, fontWeight: 500 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k DH`} />
                                        <Tooltip
                                            cursor={{ fill: '#F8FAFC' }}
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload;
                                                    const growth = data.amountPrev ? ((data.amount - data.amountPrev) / data.amountPrev * 100) : 0;
                                                    return (
                                                        <div className="bg-white p-4 shadow-xl rounded-2xl border border-gray-100 min-w-[220px]">
                                                            <p className="font-bold text-gray-900 mb-3 text-lg">{data.name}</p>
                                                            <div className="space-y-3">
                                                                <div className="flex justify-between items-center group">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`w-2 h-2 rounded-full ${data.type === 'Gasoil' ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                                                                        <span className="text-sm text-gray-500 font-medium">Actuel (N)</span>
                                                                    </div>
                                                                    <span className="text-base font-bold text-gray-900">{formatPrice(data.amount)}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center group">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`w-2 h-2 rounded-full ${data.type === 'Gasoil' ? 'bg-orange-200' : 'bg-green-200'}`}></div>
                                                                        <span className="text-sm text-gray-400 font-medium">Précédent (N-1)</span>
                                                                    </div>
                                                                    <span className="text-sm font-semibold text-gray-500">{formatPrice(data.amountPrev)}</span>
                                                                </div>
                                                                <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                                                                    <span className="text-xs text-gray-500 font-medium">Évolution</span>
                                                                    <span className={`text-sm font-bold ${growth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                                        {growth > 0 ? '+' : ''}{growth.toFixed(1)}%
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="amountPrev" name="N-1" radius={[4, 4, 0, 0]} barSize={60}>
                                            {
                                                [
                                                    { fill: '#FED7AA' }, // Orange 200
                                                    { fill: '#BBF7D0' }, // Green 200
                                                ].map((entry, index) => (
                                                    <Cell key={`cell-prev-rev-${index}`} fill={entry.fill} />
                                                ))
                                            }
                                        </Bar>
                                        <Bar dataKey="amount" name="N" radius={[4, 4, 0, 0]} barSize={60}>
                                            {
                                                [
                                                    { fill: '#F97316' }, // Orange 500
                                                    { fill: '#22C55E' }, // Green 500
                                                ].map((entry, index) => (
                                                    <Cell key={`cell-curr-rev-${index}`} fill={entry.fill} />
                                                ))
                                            }
                                        </Bar>
                                    </BarChart>
                                ) : (
                                    <BarChart data={fuelRevenueData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barGap={2}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                                            dy={10}
                                            interval={period === 'month' ? 3 : 0}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94A3B8', fontSize: 11 }}
                                            tickFormatter={(val) => `${(val / 1000).toFixed(0)}k DH`}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#F1F5F9', opacity: 0.6 }}
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="bg-white p-4 shadow-xl rounded-2xl border border-gray-100 min-w-[240px]">
                                                            <p className="font-bold text-gray-900 mb-3 border-b border-gray-50 pb-2 bg-gray-50 -mx-4 -mt-4 px-4 pt-4 rounded-t-2xl text-center">
                                                                {period === 'month' ? `${label} ${MONTHS[selectedMonth]}` : label}
                                                            </p>

                                                            {/* Gasoil Section */}
                                                            <div className="mb-4">
                                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Gasoil</p>
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                                                        <span className="text-xs text-gray-500">Actuel</span>
                                                                    </div>
                                                                    <span className="font-bold text-gray-900 text-sm">{formatPrice(payload.find(p => p.dataKey === 'gasoil')?.value || 0)}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="w-2 h-2 rounded-full bg-orange-200"></div>
                                                                        <span className="text-xs text-gray-400">N-1</span>
                                                                    </div>
                                                                    <span className="font-semibold text-gray-500 text-sm">{formatPrice(payload.find(p => p.dataKey === 'gasoilPrev')?.value || 0)}</span>
                                                                </div>
                                                            </div>

                                                            {/* SSP Section */}
                                                            <div>
                                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">SSP</p>
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                                        <span className="text-xs text-gray-500">Actuel</span>
                                                                    </div>
                                                                    <span className="font-bold text-gray-900 text-sm">{formatPrice(payload.find(p => p.dataKey === 'ssp')?.value || 0)}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="w-2 h-2 rounded-full bg-green-200"></div>
                                                                        <span className="text-xs text-gray-400">N-1</span>
                                                                    </div>
                                                                    <span className="font-semibold text-gray-500 text-sm">{formatPrice(payload.find(p => p.dataKey === 'sspPrev')?.value || 0)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Legend
                                            iconType="circle"
                                            iconSize={8}
                                            wrapperStyle={{ paddingTop: '24px', paddingBottom: '10px' }}
                                            formatter={(value) => <span className="text-sm font-medium text-gray-600 ml-1">{value}</span>}
                                        />
                                        <Bar dataKey="gasoilPrev" name="Gasoil (N-1)" fill="#FED7AA" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                        <Bar dataKey="gasoil" name="Gasoil (N)" fill="#F97316" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                        <Bar dataKey="sspPrev" name="SSP (N-1)" fill="#BBF7D0" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                        <Bar dataKey="ssp" name="SSP (N)" fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    </BarChart>
                                )}
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lubricant Statistics Section */}
            <div className="space-y-6 pt-6 border-t border-gray-150">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="font-bold text-xl text-gray-900">Statistiques Lubrifiants</h3>
                        <p className="text-sm text-gray-500">Comparaison des ventes en volume (L), en poids (kg) et en valeur (DH)</p>
                    </div>
                </div>

                {/* Lubricant KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Volume Liters Card */}
                    <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-2xl shadow-sm border border-blue-100 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 bg-blue-100/50 rounded-lg text-blue-600">
                                    <Droplet size={20} />
                                </div>
                                <span className="text-sm font-semibold text-blue-800">Volume Global (Litre)</span>
                            </div>
                            <div className="text-3xl font-extrabold text-gray-900 mb-1">{formatNumber(lubKpis.liters)} L</div>
                            <div className="text-sm text-gray-500 font-medium">Précédent : <span className="font-bold text-gray-700">{formatNumber(lubKpis.litersPrev)} L</span></div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-blue-100/30 flex justify-between items-center">
                            <span className="text-xs text-gray-400 font-medium">Évolution</span>
                            <span className={`text-sm font-bold px-2 py-1 rounded-md flex items-center gap-1 ${lubKpis.litersGrowth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {lubKpis.litersGrowth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {lubKpis.litersGrowth >= 0 ? '+' : ''}{lubKpis.litersGrowth.toFixed(1)}%
                            </span>
                        </div>
                    </div>

                    {/* Weight Kg Card */}
                    <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl shadow-sm border border-indigo-100 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 bg-indigo-100/50 rounded-lg text-indigo-600">
                                    <Scale size={20} />
                                </div>
                                <span className="text-sm font-semibold text-indigo-800">Masse Globale (kg)</span>
                            </div>
                            <div className="text-3xl font-extrabold text-gray-900 mb-1">{formatNumber(lubKpis.kg)} kg</div>
                            <div className="text-sm text-gray-500 font-medium">Précédent : <span className="font-bold text-gray-700">{formatNumber(lubKpis.kgPrev)} kg</span></div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-indigo-100/30 flex justify-between items-center">
                            <span className="text-xs text-gray-400 font-medium">Évolution</span>
                            <span className={`text-sm font-bold px-2 py-1 rounded-md flex items-center gap-1 ${lubKpis.kgGrowth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {lubKpis.kgGrowth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {lubKpis.kgGrowth >= 0 ? '+' : ''}{lubKpis.kgGrowth.toFixed(1)}%
                            </span>
                        </div>
                    </div>

                    {/* Value DH Card */}
                    <div className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 bg-emerald-100/50 rounded-lg text-emerald-600">
                                    <TrendingUp size={20} />
                                </div>
                                <span className="text-sm font-semibold text-emerald-800">Chiffre d'Affaires (DH)</span>
                            </div>
                            <div className="text-3xl font-extrabold text-gray-900 mb-1">{formatPrice(lubKpis.val)}</div>
                            <div className="text-sm text-gray-500 font-medium">Précédent : <span className="font-bold text-gray-700">{formatPrice(lubKpis.valPrev)}</span></div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-emerald-100/30 flex justify-between items-center">
                            <span className="text-xs text-gray-400 font-medium">Évolution</span>
                            <span className={`text-sm font-bold px-2 py-1 rounded-md flex items-center gap-1 ${lubKpis.valGrowth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {lubKpis.valGrowth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {lubKpis.valGrowth >= 0 ? '+' : ''}{lubKpis.valGrowth.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Lubricant Detailed Comparison Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
                        <div>
                            <h4 className="font-bold text-lg text-gray-900">Évolution Temporelle des Lubrifiants</h4>
                            <p className="text-sm text-gray-500">Comparaison de l'année en cours (N) par rapport à l'année précédente (N-1)</p>
                        </div>
                        {/* Selector for metric to display in chart */}
                        <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-200 w-fit self-end">
                            {['liters', 'kg', 'val'].map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setLubMetricView(m)}
                                    className={`px-3 py-1.5 text-xs rounded-md font-semibold transition-all ${
                                        lubMetricView === m ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                                    }`}
                                >
                                    {m === 'liters' ? 'Litres (L)' : m === 'kg' ? 'Poids (kg)' : 'Valeur (DH)'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
                        <div className="h-[350px] w-full min-w-[600px] sm:min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={lubData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barGap={3}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                                        dy={10}
                                        interval={period === 'month' ? 3 : 0}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94A3B8', fontSize: 11 }}
                                        tickFormatter={(val) => lubMetricView === 'val' ? `${(val / 1000).toFixed(0)}k DH` : `${val.toFixed(0)}`}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#F1F5F9', opacity: 0.6 }}
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const currentVal = payload.find(p => p.dataKey === lubMetricView)?.value || 0;
                                                const prevVal = payload.find(p => p.dataKey === `${lubMetricView}Prev`)?.value || 0;
                                                const diff = currentVal - prevVal;
                                                const growth = prevVal > 0 ? (diff / prevVal * 100) : 0;
                                                
                                                const unit = lubMetricView === 'liters' ? 'L' : lubMetricView === 'kg' ? 'kg' : 'DH';
                                                const formatFn = lubMetricView === 'val' ? formatPrice : (val) => `${formatNumber(val)} ${unit}`;
                                                
                                                return (
                                                    <div className="bg-white p-4 shadow-xl rounded-2xl border border-gray-100 min-w-[200px]">
                                                        <p className="font-bold text-gray-900 mb-3 border-b border-gray-50 pb-2 bg-gray-50 -mx-4 -mt-4 px-4 pt-4 rounded-t-2xl text-center">
                                                            {period === 'month' ? `${label} ${MONTHS[selectedMonth]}` : label}
                                                        </p>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-xs text-gray-500 font-medium">Actuel (N) :</span>
                                                                <span className="font-bold text-gray-900 text-sm">{formatFn(currentVal)}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-xs text-gray-400 font-medium">Précédent (N-1) :</span>
                                                                <span className="font-semibold text-gray-600 text-sm">{formatFn(prevVal)}</span>
                                                            </div>
                                                            <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs">
                                                                <span className="text-gray-500 font-medium">Évolution :</span>
                                                                <span className={`font-bold ${growth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                                    {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Legend
                                        iconType="circle"
                                        iconSize={8}
                                        wrapperStyle={{ paddingTop: '24px', paddingBottom: '10px' }}
                                        formatter={(value) => <span className="text-sm font-medium text-gray-600 ml-1">{value}</span>}
                                    />
                                    <Bar 
                                        dataKey={`${lubMetricView}Prev`} 
                                        name={lubMetricView === 'liters' ? "Volume N-1 (L)" : lubMetricView === 'kg' ? "Masse N-1 (kg)" : "Chiffre d'Affaires N-1 (DH)"} 
                                        fill="#C7D2FE" 
                                        radius={[4, 4, 0, 0]} 
                                        maxBarSize={40} 
                                    />
                                    <Bar 
                                        dataKey={lubMetricView} 
                                        name={lubMetricView === 'liters' ? "Volume N (L)" : lubMetricView === 'kg' ? "Masse N (kg)" : "Chiffre d'Affaires N (DH)"} 
                                        fill="#4F46E5" 
                                        radius={[4, 4, 0, 0]} 
                                        maxBarSize={40} 
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
