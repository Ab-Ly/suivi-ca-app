import React, { useState, useEffect } from 'react';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, Cell } from 'recharts';
import { Loader2, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { formatPrice, formatNumber } from '../../utils/formatters';
import { fetchComparisonStats } from '../../utils/statisticsUtils';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];


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

    useEffect(() => {
        fetchComparisonData();
    }, [year, period, selectedMonth, customStartMonth, customEndMonth]);



    const fetchComparisonData = async () => {
        setLoading(true);
        try {
            const result = await fetchComparisonStats(period, year, selectedMonth, customStartMonth, customEndMonth);

            setData(result.data);
            setKpis(result.kpis);
            setFuelData(result.fuelData);
            setFuelKpis(result.fuelKpis);
            setCategoryDetails(result.categoryDetails);

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
                                        <td className="py-4 pr-2 sm:pr-4 font-medium text-gray-900 break-words max-w-[100px] sm:max-w-none">{cat.name}</td>
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
                            <div>
                                <div className="text-sm text-orange-600 font-medium mb-1">Volume Gasoil {period === 'year' ? year : 'Actuel'}</div>
                                <div className="text-3xl font-bold text-gray-900 mb-1">{formatNumber(fuelKpis.gasoil)} L</div>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-gray-500 font-medium">{period === 'year' ? year - 1 : 'Précédent'}:</span>
                                    <span className="text-gray-700 font-bold">{formatNumber(fuelKpis.gasoilPrev)} L</span>
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
                            <div>
                                <div className="text-sm text-green-600 font-medium mb-1">Volume SSP {period === 'year' ? year : 'Actuel'}</div>
                                <div className="text-3xl font-bold text-gray-900 mb-1">{formatNumber(fuelKpis.ssp)} L</div>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-gray-500 font-medium">{period === 'year' ? year - 1 : 'Précédent'}:</span>
                                    <span className="text-gray-700 font-bold">{formatNumber(fuelKpis.sspPrev)} L</span>
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
        </div>
    );
}
