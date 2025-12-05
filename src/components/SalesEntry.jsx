import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './ui/Modal';
import { Search, Plus, Trash2, Loader2, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatPrice, formatNumber } from '../utils/formatters';

export default function SalesEntry({ isOpen, onClose, ...props }) {
    // Entry Type State
    const [entryType, setEntryType] = useState('articles'); // 'articles' | 'fuel'

    // Common State
    const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
    const [submitting, setSubmitting] = useState(false);

    // Article Form State
    const [newItem, setNewItem] = useState({ article: null, quantity: 1, price: 0, sales_location: 'piste' });
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef(null);

    // Fuel Form State
    const [fuelForm, setFuelForm] = useState({
        type: 'Gasoil', // 'Gasoil' | 'SSP'
        quantity: '',
        unit: 'L' // 'L' | 'm3'
    });

    // Search Articles
    useEffect(() => {
        const searchArticles = async () => {
            setLoading(true);
            let query = supabase
                .from('articles')
                .select('*')
                .limit(50);

            if (searchTerm.trim()) {
                query = query.ilike('name', `%${searchTerm}%`);
            } else {
                query = query.order('name');
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error searching articles:', error);
            } else {
                setSearchResults(data || []);
            }
            setLoading(false);
        };

        const timeoutId = setTimeout(searchArticles, 300);
        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectArticle = (article) => {
        setNewItem({
            ...newItem,
            article,
            price: article.price,
            sales_location: 'piste'
        });
        setSearchTerm(article.name);
        setIsDropdownOpen(false);
    };

    const handleAddItem = () => {
        if (!newItem.article) return;
        if (newItem.quantity <= 0) return;

        setSelectedItems(prev => {
            const existing = prev.find(item => item.id === newItem.article.id && item.sales_location === newItem.sales_location && item.price === newItem.price);

            if (existing) {
                return prev.map(item =>
                    (item.id === newItem.article.id && item.sales_location === newItem.sales_location && item.price === newItem.price)
                        ? { ...item, quantity: item.quantity + newItem.quantity }
                        : item
                );
            }
            return [...prev, {
                id: newItem.article.id,
                name: newItem.article.name,
                price: newItem.price,
                quantity: newItem.quantity,
                type: newItem.article.type,
                category: newItem.article.category,
                sales_location: newItem.sales_location
            }];
        });

        setNewItem({ article: null, quantity: 1, price: 0, sales_location: 'piste' });
        setSearchTerm('');
    };

    const removeItem = (index) => {
        setSelectedItems(prev => prev.filter((_, i) => i !== index));
    };

    const total = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const handleArticleSubmit = async () => {
        if (selectedItems.length === 0) return;
        setSubmitting(true);

        try {
            const salesData = selectedItems.map(item => ({
                article_id: item.id,
                quantity: item.quantity,
                total_price: item.price * item.quantity,
                sale_date: new Date(saleDate).toISOString(),
                sales_location: item.category === 'Lubrifiants' ? item.sales_location : null
            }));

            const { error: salesError } = await supabase.from('sales').insert(salesData);
            if (salesError) throw salesError;

            for (const item of selectedItems) {
                const isService = ['Shop', 'Café', 'Bosch Car Service', "Main d'oeuvre", 'Pneumatique'].includes(item.category) || item.type === 'service';

                if (!isService) {
                    let { error: updateError } = await supabase.rpc('decrement_stock', {
                        item_id: item.id,
                        qty: item.quantity
                    });

                    if (updateError) {
                        const { data: current } = await supabase.from('articles').select('current_stock').eq('id', item.id).single();
                        if (current) {
                            await supabase.from('articles').update({ current_stock: current.current_stock - item.quantity }).eq('id', item.id);
                        }
                    }

                    await supabase.from('stock_movements').insert({
                        article_id: item.id,
                        type: 'out',
                        quantity: item.quantity,
                        movement_date: new Date(saleDate).toISOString()
                    });
                }
            }

            onClose();
            if (props.onSuccess) props.onSuccess();
            setSelectedItems([]);
            setSaleDate(new Date().toISOString().split('T')[0]);
        } catch (error) {
            console.error('Error submitting sale:', error);
            alert(`Erreur lors de la vente: ${error.message || 'Une erreur est survenue'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleFuelSubmit = async () => {
        if (!fuelForm.quantity || parseFloat(fuelForm.quantity) <= 0) return;
        setSubmitting(true);

        try {
            // Convert to Liters if unit is m3
            const quantityLiters = fuelForm.unit === 'm3'
                ? parseFloat(fuelForm.quantity) * 1000
                : parseFloat(fuelForm.quantity);

            const { error } = await supabase.from('fuel_sales').insert({
                sale_date: new Date(saleDate).toISOString(),
                fuel_type: fuelForm.type,
                quantity_liters: quantityLiters
            });

            if (error) throw error;

            onClose();
            if (props.onSuccess) props.onSuccess();
            setFuelForm({ type: 'Gasoil', quantity: '', unit: 'L' });
            setSaleDate(new Date().toISOString().split('T')[0]);
        } catch (error) {
            console.error('Error submitting fuel sale:', error);
            alert(`Erreur lors de la vente carburant: ${error.message || 'Une erreur est survenue'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const isLubricant = newItem.article?.category === 'Lubrifiants';
    const isService = newItem.article?.type === 'service';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nouvelle Vente" className="max-w-4xl h-[85vh]">
            <div className="flex flex-col h-full space-y-6">

                {/* Type Toggle */}
                <div className="flex justify-center">
                    <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
                        <button
                            onClick={() => setEntryType('articles')}
                            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${entryType === 'articles' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Articles & Services
                        </button>
                        <button
                            onClick={() => setEntryType('fuel')}
                            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${entryType === 'fuel' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Carburant (Volume)
                        </button>
                    </div>
                </div>

                {entryType === 'articles' ? (
                    <>
                        {/* Entry Form Row */}
                        <div className="bg-notion-sidebar p-4 rounded-lg border border-notion-border shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                {/* Article Search */}
                                <div className="md:col-span-4 relative" ref={dropdownRef}>
                                    <label className="block text-xs font-medium text-notion-gray mb-1">Article</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Rechercher..."
                                            className="w-full pl-9 pr-4 py-2 text-sm border border-notion-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setIsDropdownOpen(true);
                                                if (!e.target.value) setNewItem(prev => ({ ...prev, article: null, price: 0 }));
                                            }}
                                            onFocus={() => setIsDropdownOpen(true)}
                                        />
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-notion-gray" size={14} />
                                    </div>

                                    {/* Dropdown */}
                                    {isDropdownOpen && (
                                        <div className="absolute z-20 w-full mt-1 bg-white border border-notion-border rounded-md shadow-lg max-h-60 overflow-auto">
                                            {loading ? (
                                                <div className="p-2 text-center text-notion-gray text-xs">Chargement...</div>
                                            ) : searchResults.length > 0 ? (
                                                searchResults.map(article => (
                                                    <button
                                                        key={article.id}
                                                        className="w-full text-left px-3 py-2 hover:bg-notion-sidebar flex justify-between items-center text-sm border-b border-notion-border last:border-0"
                                                        onClick={() => selectArticle(article)}
                                                    >
                                                        <span className="font-medium truncate">{article.name}</span>
                                                        <span className="text-xs text-notion-gray bg-gray-100 px-1.5 py-0.5 rounded">{formatPrice(article.price)}</span>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="p-2 text-center text-notion-gray text-xs">Aucun résultat</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Quantity */}
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-notion-gray mb-1">Quantité</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full px-3 py-2 text-sm border border-notion-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                        value={newItem.quantity}
                                        onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                                    />
                                </div>

                                {/* Price (Editable for Services) */}
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-notion-gray mb-1">Prix U.</label>
                                    <input
                                        type="number"
                                        min="0"
                                        readOnly={!isService}
                                        className={`w-full px-3 py-2 text-sm border border-notion-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${!isService ? 'bg-gray-50 text-notion-gray' : 'bg-white'}`}
                                        value={newItem.price}
                                        onChange={(e) => isService && setNewItem({ ...newItem, price: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>

                                {/* Sales Location (Visible for Lubricants) */}
                                <div className="md:col-span-3">
                                    {isLubricant ? (
                                        <div>
                                            <label className="block text-xs font-medium text-notion-gray mb-1">Lieu de vente</label>
                                            <div className="flex gap-2">
                                                <label className={`flex-1 flex items-center justify-center px-2 py-2 text-xs border rounded cursor-pointer transition-colors ${newItem.sales_location === 'piste' ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'bg-white border-notion-border text-notion-gray'}`}>
                                                    <input
                                                        type="radio"
                                                        name="location"
                                                        value="piste"
                                                        className="hidden"
                                                        checked={newItem.sales_location === 'piste'}
                                                        onChange={() => setNewItem({ ...newItem, sales_location: 'piste' })}
                                                    />
                                                    Piste
                                                </label>
                                                <label className={`flex-1 flex items-center justify-center px-2 py-2 text-xs border rounded cursor-pointer transition-colors ${newItem.sales_location === 'bosch' ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'bg-white border-notion-border text-notion-gray'}`}>
                                                    <input
                                                        type="radio"
                                                        name="location"
                                                        value="bosch"
                                                        className="hidden"
                                                        checked={newItem.sales_location === 'bosch'}
                                                        onChange={() => setNewItem({ ...newItem, sales_location: 'bosch' })}
                                                    />
                                                    Bosch
                                                </label>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-full"></div>
                                    )}
                                </div>

                                {/* Add Button */}
                                <div className="md:col-span-1">
                                    <button
                                        onClick={handleAddItem}
                                        disabled={!newItem.article || newItem.quantity <= 0}
                                        className="w-full h-[38px] flex items-center justify-center bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="flex-1 overflow-auto border border-notion-border rounded-lg bg-white">
                            <table className="w-full text-left text-sm min-w-[600px] md:min-w-0">
                                <thead className="bg-notion-sidebar sticky top-0 z-10">
                                    <tr>
                                        <th className="py-3 px-4 font-medium text-notion-gray border-b border-notion-border">Article</th>
                                        <th className="py-3 px-4 font-medium text-notion-gray border-b border-notion-border">Détails</th>
                                        <th className="py-3 px-4 font-medium text-notion-gray border-b border-notion-border text-right">Prix U.</th>
                                        <th className="py-3 px-4 font-medium text-notion-gray border-b border-notion-border text-center">Qté</th>
                                        <th className="py-3 px-4 font-medium text-notion-gray border-b border-notion-border text-right">Total</th>
                                        <th className="py-3 px-4 font-medium text-notion-gray border-b border-notion-border text-center w-16">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-notion-border">
                                    {selectedItems.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="py-12 text-center text-notion-gray">
                                                Aucun article ajouté. Utilisez le formulaire ci-dessus.
                                            </td>
                                        </tr>
                                    ) : (
                                        selectedItems.map((item, index) => (
                                            <tr key={index} className="hover:bg-gray-50">
                                                <td className="py-3 px-4 font-medium">{item.name}</td>
                                                <td className="py-3 px-4 text-xs text-notion-gray">
                                                    {item.category === 'Lubrifiants' && (
                                                        <span className={`px-1.5 py-0.5 rounded border ${item.sales_location === 'piste' ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-purple-50 border-purple-100 text-purple-600'}`}>
                                                            {item.sales_location === 'piste' ? 'Piste' : 'Bosch'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right">{item.price}</td>
                                                <td className="py-3 px-4 text-center">{item.quantity}</td>
                                                <td className="py-3 px-4 text-right font-medium">{formatPrice(item.price * item.quantity)}</td>
                                                <td className="py-3 px-4 text-center">
                                                    <button
                                                        onClick={() => removeItem(index)}
                                                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div className="flex flex-col md:flex-row items-center justify-between pt-4 border-t border-notion-border gap-4">
                            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                                <div className="text-sm text-notion-gray">
                                    {selectedItems.length} article{selectedItems.length > 1 ? 's' : ''}
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <input
                                        type="date"
                                        value={saleDate}
                                        onChange={(e) => setSaleDate(e.target.value)}
                                        className="w-full sm:w-40 px-3 py-2 border border-notion-border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                                <div className="text-right w-full sm:w-auto flex justify-between sm:block items-center">
                                    <div className="text-xs text-notion-gray uppercase font-medium">Total à payer</div>
                                    <div className="text-2xl font-bold text-notion-text">{formatPrice(total)}</div>
                                </div>
                                <button
                                    onClick={handleArticleSubmit}
                                    disabled={selectedItems.length === 0 || submitting}
                                    className="w-full sm:w-auto bg-gradient-purple text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-purple-200 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                                    {submitting ? 'Validation...' : 'Valider la vente'}
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <div className="w-full max-w-md space-y-6 bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-gray-100">
                            <div className="text-center mb-6">
                                <h3 className="text-lg font-bold text-gray-900">Saisie Volume Carburant</h3>
                                <p className="text-sm text-gray-500">Ces ventes ne sont pas comptabilisées dans le CA financier.</p>
                            </div>

                            <div className="space-y-4">
                                {/* Fuel Type */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Type de Carburant</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setFuelForm({ ...fuelForm, type: 'Gasoil' })}
                                            className={`py-3 px-4 rounded-xl border-2 transition-all font-medium ${fuelForm.type === 'Gasoil' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-100 hover:border-gray-200 text-gray-600'}`}
                                        >
                                            Gasoil
                                        </button>
                                        <button
                                            onClick={() => setFuelForm({ ...fuelForm, type: 'SSP' })}
                                            className={`py-3 px-4 rounded-xl border-2 transition-all font-medium ${fuelForm.type === 'SSP' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 hover:border-gray-200 text-gray-600'}`}
                                        >
                                            Sans Plomb
                                        </button>
                                    </div>
                                </div>

                                {/* Quantity & Unit */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Quantité Vendue</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={fuelForm.quantity}
                                            onChange={(e) => setFuelForm({ ...fuelForm, quantity: e.target.value })}
                                            placeholder="0.00"
                                            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-medium"
                                        />
                                        <div className="flex bg-gray-100 p-1 rounded-xl">
                                            <button
                                                onClick={() => setFuelForm({ ...fuelForm, unit: 'L' })}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${fuelForm.unit === 'L' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
                                            >
                                                L
                                            </button>
                                            <button
                                                onClick={() => setFuelForm({ ...fuelForm, unit: 'm3' })}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${fuelForm.unit === 'm3' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
                                            >
                                                m³
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-xs text-gray-500 text-right">
                                        {fuelForm.quantity && fuelForm.unit === 'm3' && (
                                            <span>Soit <strong>{formatNumber(parseFloat(fuelForm.quantity) * 1000)}</strong> Litres</span>
                                        )}
                                    </div>
                                </div>

                                {/* Date */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Date de vente</label>
                                    <input
                                        type="date"
                                        value={saleDate}
                                        onChange={(e) => setSaleDate(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleFuelSubmit}
                                disabled={!fuelForm.quantity || submitting}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                                {submitting ? 'Enregistrement...' : 'Enregistrer le Volume'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
