import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    PieChart, Store, Coffee, Fuel, Wrench, UserCog, Disc, Droplet,
    ChevronLeft, ChevronRight, X, Settings, Calendar
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';
import logoPetrom from '../assets/logo_petrom.png';
import { fetchComparisonStats } from '../utils/statisticsUtils';

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

const CustomYAxisTick = ({ x, y, payload, unit }) => (
    <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} textAnchor="end" fill="#94a3b8" style={{ fontSize: '11px', fontWeight: 500 }}>
            {unit === 'm3' ? (
                <>
                    <tspan x="0" dy="-0.4em">{payload.value}</tspan>
                    <tspan x="0" dy="1.2em" style={{ fontSize: '10px', opacity: 0.7 }}>m3</tspan>
                </>
            ) : (
                <tspan x="0" dy="0.3em">{(payload.value / 1000).toFixed(0)} K</tspan>
            )}
        </text>
    </g>
);

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

            // fetchComparisonStats signature: (period, year, selectedMonth, customStartMonth, customEndMonth)
            const { data, kpis, fuelData, fuelKpis } = await fetchComparisonStats(
                period,
                year,
                month,
                startMonth,
                endMonth
            );

            // Mapper helpers
            const mapCategoryData = (catKey, prevKeyOverride) => {
                return data.map(d => ({
                    name: d.name,
                    current: d[catKey] || 0,
                    previous: d[prevKeyOverride || `${catKey}_previous`] || 0
                }));
            };

            const mapFuelData = () => {
                // Return in m3 (divide liters by 1000)
                return fuelData.map(d => ({
                    name: d.name,
                    current: (d.gasoil + d.ssp) / 1000,
                    previous: (d.gasoilPrev + d.sspPrev) / 1000
                }));
            };

            const builtSlides = [
                { type: 'intro' },
            ];

            // Specific Order Requested:
            // 1 - Carburant, 2 - Lub Piste, 3 - Lub Bosch, 4 - Shop, 5 - Cafe, 6 - Bosch, 7 - MO, 8 - Pneu
            const CATEGORY_ORDER = [
                { key: 'fuel', title: "Focus CARBURANT (m3)", icon: Fuel, color: THEME.charts.orange, isBar: true, unit: 'm3' },
                { key: 'Lubrifiant Piste', title: "Focus LUBRIFIANT PISTE", icon: Droplet, color: THEME.charts.red },
                { key: 'Lubrifiant Bosch', title: "Focus LUBRIFIANT BOSCH", icon: Droplet, color: THEME.charts.indigo },
                { key: 'Shop', title: "Focus SHOP", icon: Store, color: THEME.charts.blue },
                { key: 'Café', title: "Focus CAFÉ", icon: Coffee, color: THEME.charts.pink },
                { key: 'Bosch Service', title: "Focus BOSCH SERVICE", icon: Wrench, color: THEME.charts.purple },
                { key: "Main d'oeuvre", title: "Focus MAIN D'OEUVRE", icon: UserCog, color: THEME.charts.amber },
                { key: 'Pneumatique', title: "Focus PNEUMATIQUE", icon: Disc, color: THEME.charts.emerald },
            ];

            CATEGORY_ORDER.forEach(cat => {
                if (cat.key === 'fuel') {
                    // Special handling for Fuel
                    const fuelM3Data = mapFuelData();
                    const totalFuelCurrM3 = (fuelKpis.gasoil + fuelKpis.ssp) / 1000;
                    const totalFuelPrevM3 = (fuelKpis.gasoilPrev + fuelKpis.sspPrev) / 1000;
                    builtSlides.push({
                        type: 'chart',
                        title: cat.title,
                        icon: cat.icon,
                        customData: fuelM3Data,
                        color: cat.color,
                        isBar: true,
                        unit: 'm3',
                        totalCurr: totalFuelCurrM3,
                        totalPrev: totalFuelPrevM3
                    });
                } else {
                    // Standard Category
                    const catData = mapCategoryData(cat.key);
                    builtSlides.push({
                        type: 'chart',
                        title: cat.title,
                        icon: cat.icon,
                        customData: catData,
                        color: cat.color
                    });
                }
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
        return val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/\s/g, ' ') + ' DH';
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

                    <div className="flex-1 min-h-0 w-full mb-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} barGap={4}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} dy={10} />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    width={45}
                                    tick={<CustomYAxisTick unit={unit} />}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                                    formatter={(val) => formatVal(val, unit)}
                                />
                                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ paddingTop: '0px' }} />
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
                                        formatter={(val) => val > 0 ? (unit === 'm3' ? Math.round(val) : (val / 1000).toFixed(1) + ' k') : ''}
                                    />
                                </Bar>
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
                                        formatter={(val) => val > 0 ? (unit === 'm3' ? Math.round(val) : (val / 1000).toFixed(1) + ' k') : ''}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="flex-none grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
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
