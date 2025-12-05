import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from './ui/Card';
import { DateInput } from './ui/DateInput';
import { Loader2, Calendar, Package, DollarSign, Droplet, Trash2, Plus } from 'lucide-react';
import { formatPrice, formatNumber } from '../utils/formatters';
import BulkFuelEntryModal from './BulkFuelEntryModal';

export default function Sales() {
    const [activeTab, setActiveTab] = useState('sales'); // 'sales' | 'fuel'
    const [sales, setSales] = useState([]);
    const [fuelSales, setFuelSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showBulkEntryModal, setShowBulkEntryModal] = useState(false);

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [category, setCategory] = useState('');

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
            // Search term and category don't apply directly to fuel sales the same way, 
            // but we could filter by fuel_type if we wanted. For now, ignore category filter for fuel.

            const { data, error } = await query;

            if (error) throw error;
            setFuelSales(data || []);
        } catch (error) {
            console.error('Error fetching fuel sales:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteFuelSale = async (id) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette vente carburant ?')) return;

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
        }
    };

    const resetFilters = () => {
        setStartDate('');
        setEndDate('');
        setSearchTerm('');
        setCategory('');
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-text-main">Historique des Ventes</h2>
                <button
                    onClick={resetFilters}
                    className="text-sm text-primary hover:text-primary/80 underline font-medium"
                >
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
            <Card className="p-6 border-none shadow-lg shadow-gray-100/50 rounded-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {activeTab === 'sales' && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-text-muted mb-1.5">Rechercher</label>
                                <input
                                    type="text"
                                    placeholder="Nom de l'article..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-muted mb-1.5">Catégorie</label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full px-4 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-all duration-200"
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
            </Card>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-notion-border text-notion-gray text-sm">
                                <th className="py-3 px-4 font-medium">Date</th>
                                {activeTab === 'sales' ? (
                                    <>
                                        <th className="py-3 px-4 font-medium">Article</th>
                                        <th className="py-3 px-4 font-medium">Catégorie</th>
                                        <th className="py-3 px-4 font-medium text-right">Quantité</th>
                                        <th className="py-3 px-4 font-medium text-right">Total</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="py-3 px-4 font-medium">Type Carburant</th>
                                        <th className="py-3 px-4 font-medium text-right">Volume (L)</th>
                                        <th className="py-3 px-4 font-medium text-right">Volume (m³)</th>
                                        <th className="py-3 px-4 font-medium text-center">Action</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-notion-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={activeTab === 'sales' ? 5 : 4} className="py-8 text-center">
                                        <div className="flex justify-center">
                                            <Loader2 className="animate-spin text-notion-gray" size={24} />
                                        </div>
                                    </td>
                                </tr>
                            ) : (activeTab === 'sales' ? sales : fuelSales).length === 0 ? (
                                <tr>
                                    <td colSpan={activeTab === 'sales' ? 5 : 4} className="py-8 text-center text-notion-gray">
                                        Aucune vente trouvée
                                    </td>
                                </tr>
                            ) : (
                                activeTab === 'sales' ? (
                                    sales.map((sale) => (
                                        <tr key={sale.id} className="hover:bg-notion-sidebar transition-colors">
                                            <td className="py-3 px-4 text-sm">
                                                {new Date(sale.sale_date).toLocaleString('fr-FR')}
                                            </td>
                                            <td className="py-3 px-4 font-medium">
                                                {sale.articles?.name || 'Article inconnu'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-notion-gray">
                                                {sale.articles?.category}
                                                {sale.sales_location && (
                                                    <span className="ml-2 text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                                                        {sale.sales_location === 'piste' ? 'Piste' : 'Bosch'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono text-sm">
                                                {sale.quantity}
                                            </td>
                                            <td className="py-3 px-4 text-right font-medium">
                                                {formatPrice(sale.total_price)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    fuelSales.map((sale) => (
                                        <tr key={sale.id} className="hover:bg-notion-sidebar transition-colors">
                                            <td className="py-3 px-4 text-sm">
                                                {new Date(sale.sale_date).toLocaleDateString('fr-FR')}
                                            </td>
                                            <td className="py-3 px-4 font-medium">
                                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${sale.fuel_type === 'Gasoil' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                                    {sale.fuel_type}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono text-sm font-medium">
                                                {formatNumber(Number(sale.quantity_liters))} L
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono text-sm text-gray-500">
                                                {formatNumber(Number(sale.quantity_liters) / 1000, 3)} m³
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <button
                                                    onClick={() => handleDeleteFuelSale(sale.id)}
                                                    className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <BulkFuelEntryModal
                isOpen={showBulkEntryModal}
                onClose={() => setShowBulkEntryModal(false)}
                onSuccess={fetchFuelSales}
            />
        </div>
    );
}
