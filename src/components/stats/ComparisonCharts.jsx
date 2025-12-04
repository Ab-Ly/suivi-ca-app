import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export default function ComparisonCharts() {
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [kpis, setKpis] = useState({ currentTotal: 0, previousTotal: 0, growth: 0 });

    useEffect(() => {
        fetchComparisonData();
    }, [year]);

    const fetchComparisonData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Current Year Sales (Real Sales)
            const startDate = new Date(year, 0, 1).toISOString();
            const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();

            const { data: currentSales, error: currentError } = await supabase
                .from('sales')
                .select('sale_date, total_price')
                .gte('sale_date', startDate)
                .lte('sale_date', endDate);

            if (currentError) throw currentError;

            // 2. Fetch Previous Year Sales (Historical Data)
            const { data: history, error: historyError } = await supabase
                .from('historical_sales')
                .select('*')
                .eq('year', year - 1);

            if (historyError) throw historyError;

            // Process Data
            const monthlyData = MONTHS.map((label, index) => ({
                name: label,
                current: 0,
                previous: 0,
                index: index + 1
            }));

            // Aggregate Current Sales
            currentSales.forEach(sale => {
                const monthIndex = new Date(sale.sale_date).getMonth();
                monthlyData[monthIndex].current += sale.total_price;
            });

            // Aggregate Historical Sales
            history.forEach(item => {
                if (item.month >= 1 && item.month <= 12) {
                    monthlyData[item.month - 1].previous += item.amount;
                }
            });

            // Calculate KPIs
            const currentTotal = monthlyData.reduce((sum, item) => sum + item.current, 0);
            const previousTotal = monthlyData.reduce((sum, item) => sum + item.previous, 0);
            const growth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

            setData(monthlyData);
            setKpis({ currentTotal, previousTotal, growth });

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
                    <div className="text-sm text-gray-500 mb-1">Chiffre d'Affaire {year}</div>
                    <div className="text-2xl font-bold text-gray-900">{kpis.currentTotal.toLocaleString()} MAD</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">Chiffre d'Affaire {year - 1}</div>
                    <div className="text-2xl font-bold text-gray-900">{kpis.previousTotal.toLocaleString()} MAD</div>
                </div>
                <div className={`p-6 rounded-2xl shadow-sm border ${kpis.growth >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="text-sm text-gray-500 mb-1">Évolution</div>
                    <div className={`text-2xl font-bold flex items-center gap-2 ${kpis.growth >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {kpis.growth >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                        {Math.abs(kpis.growth).toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg text-gray-900">Comparatif Mensuel</h3>
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="text-sm border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                        {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <div className="h-80 flex items-center justify-center">
                        <Loader2 className="animate-spin text-gray-400" size={32} />
                    </div>
                ) : (
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#718096', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#718096', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                    cursor={{ fill: '#F7FAFC' }}
                                    formatter={(value) => value.toLocaleString() + ' MAD'}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="previous" name={`Année ${year - 1}`} fill="#CBD5E0" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="current" name={`Année ${year}`} fill="#667EEA" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
