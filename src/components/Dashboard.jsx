import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card } from './ui/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { DollarSign, Coffee, Wrench, Droplet, ShoppingBag, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
        lub_bosch: 0
    });
    const [chartData, setChartData] = useState([]);
    const [lubData, setLubData] = useState([]);

    useEffect(() => {
        fetchDashboardData();
    }, [period, refreshTrigger]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // Define date range based on period
            const now = new Date();
            let startDate = new Date();

            if (period === 'day') startDate.setDate(now.getDate() - 1);
            else if (period === 'week') startDate.setDate(now.getDate() - 7);
            else if (period === 'month') startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Start of current month
            else if (period === 'year') startDate = new Date(now.getFullYear(), 0, 1);

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
                .lte('sale_date', now.toISOString());

            if (error) throw error;

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
            const dailyMap = {};

            // Helper to initialize map entry
            const initMapEntry = (dateKey) => {
                if (!dailyMap[dateKey]) {
                    dailyMap[dateKey] = { name: dateKey, shop: 0, cafe: 0, bosch: 0, pneumatique: 0, lub_piste: 0, lub_bosch: 0 };
                }
            };

            // Process Real Sales
            sales.forEach(sale => {
                const amount = sale.total_price;
                const category = sale.articles?.category || 'Autre';
                // For year view, we might want to group by month if we are mixing with monthly historical data
                // But existing chart might be daily. Let's stick to daily for real sales, and add monthly historical to the 1st of month?
                // Or better: if period is year, chart should probably be monthly? 
                // The current implementation uses `dailyMap` with `date` as key.
                // If period is year, `date` from `toLocaleDateString` might be full date.
                // Let's check how `date` is formatted.
                // `new Date(sale.sale_date).toLocaleDateString('fr-FR', { weekday: 'short' })` -> This gives "lun.", "mar." etc.
                // This looks like it was designed for 'week' view mainly. For 'year', it would just overwrite days?
                // Wait, if period is 'year', grouping by 'weekday' (Mon, Tue...) is wrong. It aggregates all Mondays of the year together?
                // Let's fix the grouping logic first.

                let dateKey;
                if (period === 'year') {
                    dateKey = new Date(sale.sale_date).toLocaleDateString('fr-FR', { month: 'short' }); // Jan, Fév...
                } else {
                    dateKey = new Date(sale.sale_date).toLocaleDateString('fr-FR', { weekday: 'short' });
                }

                const location = sale.sales_location; // 'piste' or 'bosch'

                total += amount;

                // Category Stats
                if (category.toLowerCase().includes('shop')) shop += amount;
                else if (category.toLowerCase().includes('café') || category.toLowerCase().includes('cafe')) cafe += amount;
                else if (category.toLowerCase().includes('bosch service')) bosch += amount;
                else if (category.toLowerCase().includes('main d\'oeuvre')) bosch += amount;
                else if (category.toLowerCase().includes('pneumatique')) pneumatique += amount;
                else if (category.toLowerCase().includes('lubrifiant')) {
                    if (location === 'bosch') {
                        lub_bosch += amount;
                    } else {
                        lub_piste += amount; // Default to piste if null
                    }
                }

                // Chart Data
                initMapEntry(dateKey);

                if (category.toLowerCase().includes('shop')) dailyMap[dateKey].shop += amount;
                else if (category.toLowerCase().includes('café') || category.toLowerCase().includes('cafe')) dailyMap[dateKey].cafe += amount;
                else if (category.toLowerCase().includes('bosch service') || category.toLowerCase().includes('main d\'oeuvre')) dailyMap[dateKey].bosch += amount;
                else if (category.toLowerCase().includes('pneumatique')) dailyMap[dateKey].pneumatique += amount;
                else if (category.toLowerCase().includes('lubrifiant')) {
                    if (location === 'bosch') dailyMap[dateKey].lub_bosch += amount;
                    else dailyMap[dateKey].lub_piste += amount;
                }
            });

            // Process Historical Data (Manual Entries)
            const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

            historicalData.forEach(item => {
                const amount = item.amount;
                const category = item.category;
                // Map month number (1-12) to label (Jan, Fév...) to match the chart key if period is year
                const dateKey = MONTH_LABELS[item.month - 1];

                total += amount;

                // Category Stats
                if (category === 'Shop') shop += amount;
                else if (category === 'Café') cafe += amount;
                else if (category === 'Bosch Service') bosch += amount;
                else if (category === "Main d'oeuvre") bosch += amount; // Group with Bosch
                else if (category === 'Pneumatique') pneumatique += amount;
                else if (category === 'Lubrifiant Piste') lub_piste += amount;
                else if (category === 'Lubrifiant Bosch') lub_bosch += amount;

                // Chart Data
                if (period === 'year') {
                    initMapEntry(dateKey);

                    if (category === 'Shop') dailyMap[dateKey].shop += amount;
                    else if (category === 'Café') dailyMap[dateKey].cafe += amount;
                    else if (category === 'Bosch Service') dailyMap[dateKey].bosch += amount;
                    else if (category === "Main d'oeuvre") dailyMap[dateKey].bosch += amount;
                    else if (category === 'Pneumatique') dailyMap[dateKey].pneumatique += amount;
                    else if (category === 'Lubrifiant Piste') dailyMap[dateKey].lub_piste += amount;
                    else if (category === 'Lubrifiant Bosch') dailyMap[dateKey].lub_bosch += amount;
                }
            });

            // Sort chart data for year view to ensure months are in order
            let chartDataArray = Object.values(dailyMap);
            if (period === 'year') {
                chartDataArray.sort((a, b) => {
                    return MONTH_LABELS.indexOf(a.name) - MONTH_LABELS.indexOf(b.name);
                });
            }

            setStats({ total, shop, cafe, bosch, pneumatique, lub_piste, lub_bosch });
            setChartData(chartDataArray);
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-text-main">Tableau de bord</h2>
                    <p className="text-text-muted text-sm">Aperçu de vos performances</p>
                </div>
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

            {/* Gradient Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-purple rounded-2xl p-6 text-white shadow-lg shadow-purple-200 transform transition-transform hover:-translate-y-1">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <DollarSign size={24} />
                        </div>
                        <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded-full">Total</span>
                    </div>
                    <div className="text-3xl font-bold mb-1">{stats.total.toLocaleString()} MAD</div>
                    <div className="text-purple-100 text-sm">Chiffre d'affaire global</div>
                </div>

                <div className="bg-gradient-orange rounded-2xl p-6 text-white shadow-lg shadow-orange-200 transform transition-transform hover:-translate-y-1">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <ShoppingBag size={24} />
                        </div>
                        <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded-full">Shop</span>
                    </div>
                    <div className="text-3xl font-bold mb-1">{stats.shop.toLocaleString()} MAD</div>
                    <div className="text-orange-100 text-sm">Ventes boutique</div>
                </div>

                <div className="bg-gradient-blue rounded-2xl p-6 text-white shadow-lg shadow-blue-200 transform transition-transform hover:-translate-y-1">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <Wrench size={24} />
                        </div>
                        <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded-full">Services Auto</span>
                    </div>
                    <div className="text-3xl font-bold mb-1">{(stats.bosch + stats.pneumatique).toLocaleString()} MAD</div>
                    <div className="text-blue-100 text-sm">Bosch, Main d'oeuvre & Pneu</div>
                </div>

                <div className="bg-gradient-green rounded-2xl p-6 text-white shadow-lg shadow-green-200 transform transition-transform hover:-translate-y-1">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <Coffee size={24} />
                        </div>
                        <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded-full">Café</span>
                    </div>
                    <div className="text-3xl font-bold mb-1">{stats.cafe.toLocaleString()} MAD</div>
                    <div className="text-green-100 text-sm">Ventes café</div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 border-none shadow-lg shadow-gray-100/50 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-border">
                        <h3 className="font-bold text-lg text-text-main">Évolution du Chiffre d'Affaire</h3>
                        <p className="text-sm text-text-muted">Répartition par service sur la période</p>
                    </div>
                    <div className="h-80 p-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#718096', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#718096', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                    cursor={{ fill: '#F7FAFC' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="shop" stackId="a" fill="#FCCF31" name="Shop" radius={[0, 0, 4, 4]} barSize={32} />
                                <Bar dataKey="cafe" stackId="a" fill="#43E97B" name="Café" />
                                <Bar dataKey="bosch" stackId="a" fill="#4FACFE" name="Bosch Service" />
                                <Bar dataKey="pneumatique" stackId="a" fill="#00C9FF" name="Pneumatique" />
                                <Bar dataKey="lub_piste" stackId="a" fill="#667EEA" name="Lub. Piste" />
                                <Bar dataKey="lub_bosch" stackId="a" fill="#764BA2" name="Lub. Bosch" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="border-none shadow-lg shadow-gray-100/50 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-border">
                        <h3 className="font-bold text-lg text-text-main">Lubrifiants</h3>
                        <p className="text-sm text-text-muted">Répartition Piste vs Bosch</p>
                    </div>
                    <div className="h-64 p-6 relative">
                        <ResponsiveContainer width="100%" height="100%">
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
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Text */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center mt-4">
                                <div className="text-xs text-text-muted">Total</div>
                                <div className="font-bold text-text-main">{(stats.lub_piste + stats.lub_bosch).toLocaleString()}</div>
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
                                <span className="font-bold text-text-main">{entry.value.toLocaleString()} MAD</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}
