import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card } from './ui/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { DollarSign, Coffee, Wrench, Droplet, ShoppingBag, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatPrice, formatNumber } from '../utils/formatters';

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
                .lte('sale_date', now.toISOString());

            if (error) throw error;

            // Fetch Fuel Sales
            let fuelSales = [];
            try {
                const { data, error: fuelError } = await supabase
                    .from('fuel_sales')
                    .select('*')
                    .gte('sale_date', startDate.toISOString())
                    .lte('sale_date', now.toISOString());

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
            const initMapEntry = (dateKey) => {
                if (!dailyMap[dateKey]) {
                    dailyMap[dateKey] = { name: dateKey, shop: 0, cafe: 0, bosch: 0, pneumatique: 0, lub_piste: 0, lub_bosch: 0 };
                }
                if (!fuelMap[dateKey]) {
                    fuelMap[dateKey] = { name: dateKey, gasoil: 0, ssp: 0 };
                }
            };

            // Process Real Sales
            sales.forEach(sale => {
                const amount = sale.total_price;
                const category = sale.articles?.category || 'Autre';

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

            // Process Fuel Sales
            fuelSales.forEach(sale => {
                const qty = Number(sale.quantity_liters);
                let dateKey;
                if (period === 'year') {
                    dateKey = new Date(sale.sale_date).toLocaleDateString('fr-FR', { month: 'short' });
                } else {
                    dateKey = new Date(sale.sale_date).toLocaleDateString('fr-FR', { weekday: 'short' });
                }

                initMapEntry(dateKey);

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
            const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

            historicalData.forEach(item => {
                const amount = item.amount;
                const category = item.category;
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
            let fuelChartArray = Object.values(fuelMap);

            if (period === 'year') {
                const sorter = (a, b) => MONTH_LABELS.indexOf(a.name) - MONTH_LABELS.indexOf(b.name);
                chartDataArray.sort(sorter);
                fuelChartArray.sort(sorter);
            }

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
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

                {/* Fuel Volume Card */}
                <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl p-6 text-white shadow-lg shadow-slate-200 transform transition-transform hover:-translate-y-1 relative group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <Droplet size={24} />
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
                    <div className="h-80 p-6">
                        <ResponsiveContainer width="100%" height="100%">
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
                    <div className="h-80 p-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={fuelChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                </Card>
            </div>
        </div>
    );
}
