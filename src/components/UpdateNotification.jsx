import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Activity, DollarSign, Droplet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatNumber } from '../utils/formatters';
import { fetchComparisonStats } from '../utils/statisticsUtils';

export default function UpdateNotification() {
    const [isVisible, setIsVisible] = useState(false);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        revenue: { current: 0, previous: 0, change: 0 },
        gasoil: { current: 0, previous: 0, change: 0 },
        ssp: { current: 0, previous: 0, change: 0 },
        dailyTrend: null,
        monthName: ''
    });

    const timerRef = React.useRef(null);

    useEffect(() => {
        checkPerformance();
    }, []);

    // Auto-close logic: Close after 5s if mouse is not over it
    useEffect(() => {
        if (isVisible) {
            timerRef.current = setTimeout(() => setIsVisible(false), 5000);
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [isVisible]);

    const handleMouseEnter = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    };

    const handleMouseLeave = () => {
        timerRef.current = setTimeout(() => setIsVisible(false), 5000);
    };

    const checkPerformance = async () => {
        try {
            // Check if we already showed this today
            const lastShownDate = localStorage.getItem('market_flash_date');
            const todayStr = new Date().toISOString().split('T')[0];

            // Uncomment to limit to once per day
            // if (lastShownDate === todayStr) return; 

            const today = new Date();

            // 1. Daily: Yesterday (J-1) vs Day Before (J-2)
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const dayBefore = new Date(yesterday);
            dayBefore.setDate(dayBefore.getDate() - 1);

            const getDayRange = (d) => {
                const start = new Date(d); start.setHours(0, 0, 0, 0);
                const end = new Date(d); end.setHours(23, 59, 59, 999);
                return { start: start.toISOString(), end: end.toISOString() };
            };

            const yRange = getDayRange(yesterday);
            const dbRange = getDayRange(dayBefore);

            // 2. Monthly: Last Month (M-1) vs Same Month Last Year (N-1) using Shared Util
            let targetYear = today.getFullYear();
            let targetMonth = today.getMonth() - 1;
            if (targetMonth < 0) {
                targetMonth = 11;
                targetYear -= 1;
            }

            // Parallel Fetch
            const [
                { data: daySales },
                { data: prevDaySales },
                monthlyStats
            ] = await Promise.all([
                // Daily (Manual fetch to ensure Yesterday vs J-2 specific logic)
                supabase.from('sales').select('total_price').gte('sale_date', yRange.start).lte('sale_date', yRange.end),
                supabase.from('sales').select('total_price').gte('sale_date', dbRange.start).lte('sale_date', dbRange.end),
                // Monthly (Shared logic with historical fallback)
                fetchComparisonStats('month', targetYear, targetMonth)
            ]);

            // --- Daily Trend ---
            const dailyRevCurrent = daySales?.reduce((sum, s) => sum + (s.total_price || 0), 0) || 0;
            const dailyRevPrev = prevDaySales?.reduce((sum, s) => sum + (s.total_price || 0), 0) || 0;
            const dailyGrowth = dailyRevPrev > 0 ? ((dailyRevCurrent - dailyRevPrev) / dailyRevPrev) * 100 : 0;

            // --- Monthly Metrics ---
            const { kpis, fuelKpis } = monthlyStats;

            // Debug
            // console.log('--- MARKET FLASH DATA ---');
            // console.log('Daily:', dailyRevCurrent, dailyRevPrev);
            // console.log('Monthly:', kpis, fuelKpis);

            setStats({
                revenue: {
                    current: kpis.currentTotal,
                    previous: kpis.previousTotal,
                    change: kpis.growth
                },
                gasoil: {
                    current: fuelKpis.gasoil,
                    previous: fuelKpis.gasoilPrev,
                    change: fuelKpis.gasoilGrowth
                },
                ssp: {
                    current: fuelKpis.ssp,
                    previous: fuelKpis.sspPrev,
                    change: fuelKpis.sspGrowth
                },
                dailyTrend: {
                    value: dailyRevCurrent,
                    growth: dailyGrowth
                },
                monthName: new Date(targetYear, targetMonth, 1).toLocaleString('fr-FR', { month: 'long' })
            });

            setLoading(false);
            setTimeout(() => setIsVisible(true), 2000);

        } catch (error) {
            console.error("Error fetching market flash:", error);
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        const todayStr = new Date().toISOString().split('T')[0];
        localStorage.setItem('market_flash_date', todayStr);
    };

    if (!isVisible) return null;

    const MetricCard = ({ label, value, previous, change, format = 'number', icon: Icon, colorClass }) => {
        const isPositive = change >= 0;
        const formattedValue = format === 'currency' ? `${formatNumber(value)} MAD` : `${formatNumber(value)} L`;

        return (
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex flex-col gap-1 transition-all hover:shadow-md hover:border-gray-200">
                <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                        {Icon && <Icon size={12} />} {label}
                    </span>
                    <div className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {Math.abs(change).toFixed(1)}%
                    </div>
                </div>
                <div className={`text-lg font-black font-mono tracking-tight ${colorClass}`}>
                    {formattedValue}
                </div>
                <div className="text-[10px] text-gray-400">
                    N-1: {formatNumber(previous)}
                </div>
            </div>
        );
    };

    return (
        <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[100] max-w-sm w-full animate-in fade-in zoom-in duration-300 font-sans px-4 md:px-0 max-h-[90vh] overflow-y-auto no-scrollbar"
        >
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden relative">

                {/* Decorative Top Line */}
                <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-rose-500"></div>

                {/* Header */}
                <div className="p-4 flex items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-600 text-white p-1.5 rounded-lg shadow-lg shadow-indigo-200">
                            <Activity size={16} />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-900 text-sm uppercase tracking-wide">ISTIRAH PEPINIERE @ PETROM</h3>
                            <p className="text-[10px] text-gray-400 font-medium">Tendance {stats.monthName} (vs N-1)</p>
                        </div>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="text-gray-400 hover:text-gray-900 hover:bg-gray-100 p-1.5 rounded-full transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Content Grid */}
                <div className="p-4 pt-0 grid grid-cols-2 gap-3">
                    {/* Revenue - Full Width */}
                    <div className="col-span-2">
                        <MetricCard
                            label="Chiffre d'Affaires"
                            value={stats.revenue.current}
                            previous={stats.revenue.previous}
                            change={stats.revenue.change}
                            format="currency"
                            icon={DollarSign}
                            colorClass="text-indigo-900"
                        />
                    </div>

                    {/* Volumes */}
                    <MetricCard
                        label="Gasoil (Vol)"
                        value={stats.gasoil.current}
                        previous={stats.gasoil.previous}
                        change={stats.gasoil.change}
                        icon={Droplet}
                        colorClass="text-orange-600"
                    />

                    <MetricCard
                        label="SSP (Vol)"
                        value={stats.ssp.current}
                        previous={stats.ssp.previous}
                        change={stats.ssp.change}
                        icon={Droplet}
                        colorClass="text-emerald-600"
                    />
                </div>

                {/* Footer / Daily Trend */}
                {stats.dailyTrend && (
                    <div className="bg-gray-50 px-4 py-2 border-t border-gray-100 flex justify-between items-center text-[10px] font-medium">
                        <span className="text-gray-500">
                            Perf. Journalière (Hier vs J-2)
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-900 font-bold">{formatNumber(stats.dailyTrend.value)} <span className="text-[9px] font-normal text-gray-400">MAD</span></span>
                            <span className={`px-2 py-0.5 rounded-full font-bold ${stats.dailyTrend.growth >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {stats.dailyTrend.growth > 0 ? '+' : ''}{stats.dailyTrend.growth.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

