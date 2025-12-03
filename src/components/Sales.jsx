import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from './ui/Card';
import { DateInput } from './ui/DateInput';
import { Loader2, Calendar, Package, DollarSign } from 'lucide-react';

export default function Sales() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [category, setCategory] = useState('');

    useEffect(() => {
        fetchSales();
    }, [startDate, endDate, searchTerm, category]);

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
                // Set to end of day
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

            {/* Filters */}
            <Card className="p-6 border-none shadow-lg shadow-gray-100/50 rounded-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
                            <option value="Lubrifiants">Lubrifiants</option>
                        </select>
                    </div>
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
                                <th className="py-3 px-4 font-medium">Article</th>
                                <th className="py-3 px-4 font-medium">Catégorie</th>
                                <th className="py-3 px-4 font-medium text-right">Quantité</th>
                                <th className="py-3 px-4 font-medium text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-notion-border">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="py-8 text-center">
                                        <div className="flex justify-center">
                                            <Loader2 className="animate-spin text-notion-gray" size={24} />
                                        </div>
                                    </td>
                                </tr>
                            ) : sales.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="py-8 text-center text-notion-gray">
                                        Aucune vente trouvée
                                    </td>
                                </tr>
                            ) : (
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
                                            {sale.total_price.toLocaleString()} MAD
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
