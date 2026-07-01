import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './ui/Modal';
import { DateInput } from './ui/DateInput';
import { Search, Plus, Trash2, Loader2, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatPrice, formatNumber } from '../utils/formatters';

export default function SalesEntry({ isOpen, onClose, ...props }) {
    // Common State
    const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
    const [submitting, setSubmitting] = useState(false);

    // Fuel State (Unified)
    const [gasoilQty, setGasoilQty] = useState('');
    const [gasoilUnit, setGasoilUnit] = useState('L'); // 'L' | 'm3'
    const [sspQty, setSspQty] = useState('');
    const [sspUnit, setSspUnit] = useState('L'); // 'L' | 'm3'

    // Article Form State
    const [newItem, setNewItem] = useState({ article: null, quantity: '1', price: '', sales_location: 'piste' });
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef(null);

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
            price: article.price?.toString() || '',
            sales_location: 'piste'
        });
        setSearchTerm(article.name);
        setIsDropdownOpen(false);
    };

    const handleAddItem = () => {
        if (!newItem.article) return;
        const qty = parseFloat(newItem.quantity);
        const prc = parseFloat(newItem.price);

        if (isNaN(qty) || qty <= 0) return;

        setSelectedItems(prev => {
            const existing = prev.find(item => item.id === newItem.article.id && item.sales_location === newItem.sales_location && item.price === prc);

            if (existing) {
                return prev.map(item =>
                    (item.id === newItem.article.id && item.sales_location === newItem.sales_location && item.price === prc)
                        ? { ...item, quantity: item.quantity + qty }
                        : item
                );
            }
            return [...prev, {
                id: newItem.article.id,
                name: newItem.article.name,
                price: prc || 0,
                quantity: qty,
                type: newItem.article.type,
                category: newItem.article.category,
                sales_location: newItem.sales_location
            }];
        });

        setNewItem({ article: null, quantity: '1', price: '', sales_location: 'piste' });
        setSearchTerm('');
    };

    const removeItem = (index) => {
        setSelectedItems(prev => prev.filter((_, i) => i !== index));
    };

    const total = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const handleGlobalSubmit = async () => {
        const hasFuel = (gasoilQty && parseFloat(gasoilQty) > 0) || (sspQty && parseFloat(sspQty) > 0);
        const hasArticles = selectedItems.length > 0;

        if (!hasFuel && !hasArticles) {
            alert('Veuillez saisir au moins une vente (carburant ou article).');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Submit Fuel Sales if entered
            if (gasoilQty && parseFloat(gasoilQty) > 0) {
                const qtyGasoil = gasoilUnit === 'm3' ? parseFloat(gasoilQty) * 1000 : parseFloat(gasoilQty);
                const { error: errorGasoil } = await supabase.from('fuel_sales').insert({
                    sale_date: new Date(saleDate).toISOString(),
                    fuel_type: 'Gasoil',
                    quantity_liters: qtyGasoil
                });
                if (errorGasoil) throw errorGasoil;
            }

            if (sspQty && parseFloat(sspQty) > 0) {
                const qtySsp = sspUnit === 'm3' ? parseFloat(sspQty) * 1000 : parseFloat(sspQty);
                const { error: errorSsp } = await supabase.from('fuel_sales').insert({
                    sale_date: new Date(saleDate).toISOString(),
                    fuel_type: 'SSP',
                    quantity_liters: qtySsp
                });
                if (errorSsp) throw errorSsp;
            }

            // 2. Submit Article Sales if entered
            if (hasArticles) {
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
            }

            onClose();
            if (props.onSuccess) props.onSuccess();
            setSelectedItems([]);
            setGasoilQty('');
            setSspQty('');
            setSaleDate(new Date().toISOString().split('T')[0]);
        } catch (error) {
            console.error('Error submitting global sale:', error);
            alert(`Erreur lors de la validation : ${error.message || 'Une erreur est survenue'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const isLubricant = newItem.article?.category === 'Lubrifiants';
    const isService = newItem.article?.type === 'service';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nouvelle Déclaration de Vente" className="max-w-4xl max-h-[90vh]">
            <div className="flex flex-col h-full space-y-5">

                {/* Date selection banner */}
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <div className="text-center sm:text-left">
                        <h3 className="text-sm font-bold text-gray-900">Date de la Déclaration</h3>
                        <p className="text-xs text-gray-400">Enregistrez toutes vos ventes (carburants, lubrifiants et services) pour ce jour</p>
                    </div>
                    <DateInput
                        value={saleDate}
                        onChange={(e) => setSaleDate(e.target.value)}
                        className="w-full sm:w-48"
                    />
                </div>

                {/* Fuel sales section */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4 shrink-0">
                    <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">1. Ventes Carburant (Volumes)</h3>
                        <p className="text-[11px] text-gray-400">Volumes vendus pour la journée (laissés vides si aucun)</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Gasoil */}
                        <div className="p-4 rounded-xl bg-orange-50/20 border border-orange-100/50 space-y-3">
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-100">Gasoil</span>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={gasoilQty}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(',', '.');
                                            if (val === '' || /^\d*\.?\d*$/.test(val)) setGasoilQty(val);
                                        }}
                                        placeholder="0.00"
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-mono font-bold text-gray-700 shadow-sm"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">Vol.</span>
                                </div>
                                <div className="flex bg-gray-100 p-0.5 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setGasoilUnit('L')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${gasoilUnit === 'L' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500'}`}
                                    >
                                        L
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setGasoilUnit('m3')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${gasoilUnit === 'm3' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500'}`}
                                    >
                                        m³
                                    </button>
                                </div>
                            </div>
                            {gasoilQty && gasoilUnit === 'm3' && (
                                <div className="text-[10px] text-gray-500 text-right font-medium">
                                    Soit <strong>{formatNumber(parseFloat(gasoilQty) * 1000)}</strong> Litres
                                </div>
                            )}
                        </div>

                        {/* SSP */}
                        <div className="p-4 rounded-xl bg-emerald-50/20 border border-emerald-100/50 space-y-3">
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">Sans Plomb (SSP)</span>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={sspQty}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(',', '.');
                                            if (val === '' || /^\d*\.?\d*$/.test(val)) setSspQty(val);
                                        }}
                                        placeholder="0.00"
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-mono font-bold text-gray-700 shadow-sm"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">Vol.</span>
                                </div>
                                <div className="flex bg-gray-100 p-0.5 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setSspUnit('L')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sspUnit === 'L' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500'}`}
                                    >
                                        L
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSspUnit('m3')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sspUnit === 'm3' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500'}`}
                                    >
                                        m³
                                    </button>
                                </div>
                            </div>
                            {sspQty && sspUnit === 'm3' && (
                                <div className="text-[10px] text-gray-500 text-right font-medium">
                                    Soit <strong>{formatNumber(parseFloat(sspQty) * 1000)}</strong> Litres
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Articles & Services section */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4 overflow-hidden min-h-[300px]">
                    <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">2. Articles & Services</h3>
                        <p className="text-[11px] text-gray-400">Recherchez et ajoutez les articles vendus (lubrifiants, boutique, café...)</p>
                    </div>

                    {/* Entry Form Row */}
                    <div className="bg-gray-50/70 p-5 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            {/* Article Search */}
                            <div className={`${isLubricant ? 'md:col-span-4' : 'md:col-span-6'} relative`} ref={dropdownRef}>
                                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Article</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Rechercher un article..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all duration-200 ease-in-out placeholder:text-gray-400 font-medium text-gray-700 shadow-sm hover:border-gray-300"
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setIsDropdownOpen(true);
                                            if (!e.target.value) setNewItem(prev => ({ ...prev, article: null, price: 0 }));
                                        }}
                                        onFocus={() => setIsDropdownOpen(true)}
                                    />
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                </div>

                                {/* Dropdown */}
                                {isDropdownOpen && (
                                    <div className="absolute z-20 w-full mt-1.5 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-auto">
                                        {loading ? (
                                            <div className="p-3 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
                                                <Loader2 className="animate-spin text-indigo-500" size={14} />
                                                Chargement...
                                            </div>
                                        ) : searchResults.length > 0 ? (
                                            searchResults.map(article => (
                                                <button
                                                    key={article.id}
                                                    className="w-full text-left px-4 py-3 hover:bg-indigo-50/50 flex justify-between items-center text-sm border-b border-gray-50 last:border-0 transition-colors"
                                                    onClick={() => selectArticle(article)}
                                                >
                                                    <span className="font-semibold text-gray-700 truncate">{article.name}</span>
                                                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">{formatPrice(article.price)}</span>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-3 text-center text-gray-400 text-xs">Aucun résultat</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Sales Location (Visible for Lubricants) */}
                            {isLubricant && (
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Lieu de vente</label>
                                    <div className="flex gap-2">
                                        <label className={`flex-1 flex items-center justify-center px-3 py-2.5 text-xs font-semibold border rounded-xl cursor-pointer transition-all ${newItem.sales_location === 'piste' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
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
                                        <label className={`flex-1 flex items-center justify-center px-3 py-2.5 text-xs font-semibold border rounded-xl cursor-pointer transition-all ${newItem.sales_location === 'bosch' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
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
                            )}

                            {/* Price (Editable for Services) */}
                            <div className={isLubricant ? 'md:col-span-2' : 'md:col-span-3'}>
                                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Prix U.</label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    readOnly={!isService}
                                    className={`w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all duration-200 ease-in-out font-mono font-bold text-gray-700 shadow-sm ${!isService ? 'bg-gray-100/70 text-gray-400 cursor-not-allowed' : 'bg-white hover:border-gray-300'}`}
                                    value={newItem.price}
                                    onChange={(e) => {
                                        if (isService) {
                                            const val = e.target.value.replace(',', '.');
                                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                setNewItem({ ...newItem, price: val });
                                            }
                                        }
                                    }}
                                    placeholder="0"
                                />
                            </div>

                            {/* Quantity */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Quantité</label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all duration-200 ease-in-out font-mono font-bold text-gray-700 shadow-sm hover:border-gray-300"
                                    value={newItem.quantity}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(',', '.');
                                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                            setNewItem({ ...newItem, quantity: val });
                                        }
                                    }}
                                    onBlur={() => {
                                        if (newItem.quantity === '' || isNaN(parseFloat(newItem.quantity))) setNewItem({ ...newItem, quantity: '1' });
                                    }}
                                />
                            </div>

                            {/* Add Button */}
                            <div className="md:col-span-1">
                                <button
                                    onClick={handleAddItem}
                                    disabled={!newItem.article || newItem.quantity <= 0}
                                    className="w-full h-[45px] flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                >
                                    <Plus size={22} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="flex-1 overflow-auto border border-gray-100 rounded-xl bg-white shadow-sm min-h-[150px]">
                        <table className="w-full text-left text-sm min-w-[600px] md:min-w-0">
                            <thead className="bg-gray-50/70 border-b border-gray-100 sticky top-0 z-10">
                                <tr>
                                    <th className="py-3 px-4 font-bold text-gray-400 uppercase text-[10px] tracking-wider">Article</th>
                                    <th className="py-3 px-4 font-bold text-gray-400 uppercase text-[10px] tracking-wider">Détails</th>
                                    <th className="py-3 px-4 font-bold text-gray-400 uppercase text-[10px] tracking-wider text-right">Prix U.</th>
                                    <th className="py-3 px-4 font-bold text-gray-400 uppercase text-[10px] tracking-wider text-center">Qté</th>
                                    <th className="py-3 px-4 font-bold text-gray-400 uppercase text-[10px] tracking-wider text-right">Total</th>
                                    <th className="py-3 px-4 font-bold text-gray-400 uppercase text-[10px] tracking-wider text-center w-16">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {selectedItems.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="py-12 text-center text-gray-400 text-xs font-medium">
                                            Aucun article ajouté. Utilisez le formulaire ci-dessus.
                                        </td>
                                    </tr>
                                ) : (
                                    selectedItems.map((item, index) => (
                                        <tr key={index} className="hover:bg-gray-50 font-medium">
                                            <td className="py-3.5 px-4 font-bold text-gray-900">{item.name}</td>
                                            <td className="py-3.5 px-4 text-xs">
                                                {item.category === 'Lubrifiants' && (
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.sales_location === 'piste' ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-purple-50 border-purple-100 text-purple-600'}`}>
                                                        {item.sales_location === 'piste' ? 'Piste' : 'Bosch'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-mono text-gray-500">{formatNumber(item.price, 2)}</td>
                                            <td className="py-3.5 px-4 text-center font-mono font-bold text-gray-700">{item.quantity}</td>
                                            <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">{formatPrice(item.price * item.quantity)}</td>
                                            <td className="py-3.5 px-4 text-center">
                                                <button
                                                    onClick={() => removeItem(index)}
                                                    className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
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
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-gray-100 gap-4 shrink-0">
                    <div className="text-sm font-medium text-gray-500">
                        {selectedItems.length} article{selectedItems.length > 1 ? 's' : ''} ajouté{selectedItems.length > 1 ? 's' : ''}
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                        <div className="text-right w-full sm:w-auto flex justify-between sm:block items-center">
                            <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Total Articles à Payer</div>
                            <div className="text-2xl font-black text-gray-900">{formatPrice(total)}</div>
                        </div>
                        <button
                            onClick={handleGlobalSubmit}
                            disabled={submitting}
                            className="w-full sm:w-auto bg-gradient-purple text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-purple-200 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                        >
                            {submitting ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                            {submitting ? 'Validation...' : 'Valider la déclaration globale'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
