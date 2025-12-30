import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from './ui/Card';
import { DateInput } from './ui/DateInput';
import { Loader2, Calendar, Package, DollarSign, Droplet, Trash2, Plus, RotateCcw, Edit2, ChevronDown, ChevronRight } from 'lucide-react';
import { formatPrice, formatNumber } from '../utils/formatters';
import BulkFuelEntryModal from './BulkFuelEntryModal';
import PasswordConfirmationModal from './ui/PasswordConfirmationModal';
import EditSaleModal from './EditSaleModal';

export default function Sales() {
    const [activeTab, setActiveTab] = useState('sales'); // 'sales' | 'fuel'
    const [sales, setSales] = useState([]);
    const [fuelSales, setFuelSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showBulkEntryModal, setShowBulkEntryModal] = useState(false);

    // Edit Sale State
    const [editingSale, setEditingSale] = useState(null);
    const [expandedMonths, setExpandedMonths] = useState({});

    // Delete Confirmation State
    const [deleteConfig, setDeleteConfig] = useState({ isOpen: false, id: null });

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [category, setCategory] = useState('');

    const toggleMonth = (month) => {
        setExpandedMonths(prev => {
            // If it's already defined, toggle it.
            // If undefined, it means we need to check the default (current month).
            // But since we want to toggle, we should calculate the current state first, then flip it.

            const currentMonthKey = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            const isCurrentlyExpanded = prev[month] !== undefined ? prev[month] : month === currentMonthKey;

            return {
                ...prev,
                [month]: !isCurrentlyExpanded
            };
        });
    };

    useEffect(() => {
        if (activeTab === 'sales') {
            fetchSales();
        } else {
            fetchFuelSales();
        }
    }, [startDate, endDate, searchTerm, category, activeTab]);

    const fetchSales = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('sales')
                .select(`
                    *,
                    articles!inner (
                        name,
                        category
                    )
                `)
                .order('sale_date', { ascending: false });

            if (startDate) {
                query = query.gte('sale_date', startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query = query.lte('sale_date', end.toISOString());
            }
            if (category) {
                query = query.eq('articles.category', category);
            }
            if (searchTerm) {
                query = query.ilike('articles.name', `%${searchTerm}%`);
            }

            const { data, error } = await query;

            if (error) throw error;
            setSales(data || []);
        } catch (error) {
            console.error('Error fetching sales:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchFuelSales = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('fuel_sales')
                .select('*')
                .order('sale_date', { ascending: false });

            if (startDate) {
                query = query.gte('sale_date', startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query = query.lte('sale_date', end.toISOString());
            }

            const { data, error } = await query;

            if (error) throw error;
            setFuelSales(data || []);
        } catch (error) {
            console.error('Error fetching fuel sales:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteFuelSale = (id) => {
        setDeleteConfig({ isOpen: true, id });
    };

    const confirmDeleteFuelSale = async () => {
        const id = deleteConfig.id;
        if (!id) return;

        try {
            const { error } = await supabase
                .from('fuel_sales')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchFuelSales();
        } catch (error) {
            console.error('Error deleting fuel sale:', error);
            alert('Erreur lors de la suppression');
        } finally {
            setDeleteConfig({ isOpen: false, id: null });
        }
    };

    const resetFilters = () => {
        setStartDate('');
        setEndDate('');
        setSearchTerm('');
        setCategory('');
    };

    // Helper to group sales by Month Year
    const groupSalesByMonth = (salesData) => {
        const groups = {};
        salesData.forEach(sale => {
            const date = new Date(sale.sale_date);
            const key = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(sale);
        });
        return groups;
    };

    const salesByMonth = groupSalesByMonth(sales);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-text-main">Historique des Ventes</h2>
                <button
                    onClick={resetFilters}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 shadow-sm rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-all"
                >
                    <RotateCcw size={16} />
                    Réinitialiser les filtres
                </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-border w-fit">
                <button
                    onClick={() => setActiveTab('sales')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium transition-all ${activeTab === 'sales'
                        ? 'bg-gradient-dark text-white shadow-md'
                        : 'text-text-muted hover:text-text-main hover:bg-gray-50'
                        }`}
                >
                    <Package size={16} />
                    Boutique & Services
                </button>
                <button
                    onClick={() => setActiveTab('fuel')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium transition-all ${activeTab === 'fuel'
                        ? 'bg-gradient-dark text-white shadow-md'
                        : 'text-text-muted hover:text-text-main hover:bg-gray-50'
                        }`}
                >
                    <Droplet size={16} />
                    Carburant (Volume)
                </button>
            </div>

            {activeTab === 'fuel' && (
                <div className="flex justify-end">
                    <button
                        onClick={() => setShowBulkEntryModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 text-sm font-medium"
                    >
                        <Plus size={16} />
                        Saisie Historique
                    </button>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    {activeTab === 'sales' && (
                        <>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Rechercher</label>
                                <input
                                    type="text"
                                    placeholder="Nom de l'article..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-300"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Catégorie</label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all appearance-none"
                                >
                                    <option value="">Toutes</option>
                                    <option value="Shop">Shop</option>
                                    <option value="Café">Café</option>
                                    <option value="Bosch Service">Bosch Service</option>
                                    <option value="Pneumatique">Pneumatique</option>
                                    <option value="Lubrifiants">Lubrifiants</option>
                                </select>
                            </div>
                        </>
                    )}
                    <div>
                        <DateInput
                            label="Date début"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <DateInput
                            label="Date fin"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Sales List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                        <Loader2 className="animate-spin text-gray-300 mx-auto" size={24} />
                    </div>
                ) : activeTab === 'sales' ? (
                    sales.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-gray-400 font-medium">
                            Aucune vente trouvée
                        </div>
                    ) : (
                        Object.entries(salesByMonth).map(([month, monthSales]) => {
                            const currentMonthKey = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                            const isExpanded = expandedMonths[month] !== undefined
                                ? expandedMonths[month]
                                : month === currentMonthKey;

                            return (
                                <div key={month} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                    {/* Month Header */}
                                    <div
                                        className="bg-gray-50 border-b border-gray-100 p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors select-none"
                                        onClick={() => toggleMonth(month)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`transition-transform duration-200 text-gray-400 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}>
                                                <div className="bg-white p-1 rounded-full border border-gray-200 shadow-sm text-gray-500">
                                                    <ChevronRight size={14} />
                                                </div>
                                            </div>
                                            <span className="font-bold text-xs uppercase tracking-wider text-gray-700">
                                                {month}
                                            </span>
                                        </div>
                                        <span className="text-xs font-semibold text-gray-400 bg-white px-2.5 py-1 rounded-full border border-gray-100">
                                            {monthSales.length} ventes
                                        </span>
                                    </div>

                                    {/* Month Table */}
                                    {isExpanded && (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-white text-gray-400 font-bold text-[10px] uppercase tracking-wider border-b border-gray-100">
                                                        <th className="py-3 px-6">Date</th>
                                                        <th className="py-3 px-6">Article</th>
                                                        <th className="py-3 px-6">Catégorie</th>
                                                        <th className="py-3 px-6 text-center">Quantité</th>
                                                        <th className="py-3 px-6 text-right">Total</th>
                                                        <th className="py-3 px-6 text-center">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {monthSales.map((sale) => (
                                                        <tr key={sale.id} className="group hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0">
                                                            <td className="py-4 px-6 text-xs font-bold text-gray-400 font-mono whitespace-nowrap">
                                                                {new Date(sale.sale_date).toLocaleString('fr-FR')}
                                                            </td>
                                                            <td className="py-4 px-6">
                                                                <span className="text-sm font-bold text-gray-800 block">
                                                                    {sale.articles?.name || 'Article inconnu'}
                                                                </span>
                                                            </td>
                                                            <td className="py-4 px-6">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-medium text-gray-500">{sale.articles?.category}</span>
                                                                    {sale.sales_location && (
                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${sale.sales_location === 'piste' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                                            {sale.sales_location === 'piste' ? 'Piste' : 'Bosch'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="py-4 px-6 text-center font-bold text-gray-900 text-sm">
                                                                {sale.quantity}
                                                            </td>
                                                            <td className="py-4 px-6 text-right">
                                                                <span className="font-mono font-bold text-gray-900 text-sm">
                                                                    {formatPrice(sale.total_price)}
                                                                </span>
                                                            </td>
                                                            <td className="py-4 px-6 text-center">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingSale(sale);
                                                                    }}
                                                                    className="text-gray-400 hover:text-indigo-600 transition-colors"
                                                                    title="Modifier"
                                                                >
                                                                    <Edit2 size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )
                ) : (
                    fuelSales.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-gray-400 font-medium">
                            Aucune vente carburant trouvée
                        </div>
                    ) : (
                        Object.entries(groupSalesByMonth(fuelSales)).map(([month, monthSales]) => {
                            const currentMonthKey = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                            const isExpanded = expandedMonths[month] !== undefined
                                ? expandedMonths[month]
                                : month === currentMonthKey;

                            return (
                                <div key={month} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                    {/* Month Header */}
                                    <div
                                        className="bg-gray-50 border-b border-gray-100 p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors select-none"
                                        onClick={() => toggleMonth(month)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`transition-transform duration-200 text-gray-400 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}>
                                                <div className="bg-white p-1 rounded-full border border-gray-200 shadow-sm text-gray-500">
                                                    <ChevronRight size={14} />
                                                </div>
                                            </div>
                                            <span className="font-bold text-xs uppercase tracking-wider text-gray-700">
                                                {month}
                                            </span>
                                        </div>
                                        <span className="text-xs font-semibold text-gray-400 bg-white px-2.5 py-1 rounded-full border border-gray-100">
                                            {monthSales.length} entrées
                                        </span>
                                    </div>

                                    {/* Month Table */}
                                    {isExpanded && (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-white text-gray-400 font-bold text-[10px] uppercase tracking-wider border-b border-gray-50">
                                                        <th className="py-3 px-6">Date</th>
                                                        <th className="py-3 px-6">Type Carburant</th>
                                                        <th className="py-3 px-6 text-right">Volume (L)</th>
                                                        <th className="py-3 px-6 text-right">Volume (m³)</th>
                                                        <th className="py-3 px-6 text-center">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {monthSales.map((sale) => (
                                                        <tr key={sale.id} className="group hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0">
                                                            <td className="py-4 px-6 text-xs font-bold text-gray-400 font-mono">
                                                                {new Date(sale.sale_date).toLocaleDateString('fr-FR')}
                                                            </td>
                                                            <td className="py-4 px-6 font-medium">
                                                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${sale.fuel_type === 'Gasoil' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                                                    {sale.fuel_type}
                                                                </span>
                                                            </td>
                                                            <td className="py-4 px-6 text-right font-mono text-sm font-bold text-gray-700">
                                                                {formatNumber(Number(sale.quantity_liters))} L
                                                            </td>
                                                            <td className="py-4 px-6 text-right font-mono text-sm text-gray-500">
                                                                {formatNumber(Number(sale.quantity_liters) / 1000, 3)} m³
                                                            </td>
                                                            <td className="py-4 px-6 text-center">
                                                                <button
                                                                    onClick={() => handleDeleteFuelSale(sale.id)}
                                                                    className="text-gray-300 hover:text-red-500 transition-colors"
                                                                    title="Supprimer"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )
                )}
            </div>

            <BulkFuelEntryModal
                isOpen={showBulkEntryModal}
                onClose={() => setShowBulkEntryModal(false)}
                onSuccess={fetchFuelSales}
            />

            <EditSaleModal
                isOpen={!!editingSale}
                onClose={() => setEditingSale(null)}
                sale={editingSale}
                onSuccess={fetchSales}
            />

            <PasswordConfirmationModal
                isOpen={deleteConfig.isOpen}
                onClose={() => setDeleteConfig({ isOpen: false, id: null })}
                onConfirm={confirmDeleteFuelSale}
                title="Supprimer la vente carburant ?"
                message="Êtes-vous sûr de vouloir supprimer cette vente ? Cette action est irréversible."
            />
        </div>
    );
}
