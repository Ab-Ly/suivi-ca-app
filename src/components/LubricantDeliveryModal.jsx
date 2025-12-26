import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { supabase } from '../lib/supabase';
import { Loader2, Plus, Trash2, Save, FileText, Truck, Calendar } from 'lucide-react';

export default function LubricantDeliveryModal({ isOpen, onClose, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [articles, setArticles] = useState([]);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        blNumber: '',
        supplier: ''
    });

    const [items, setItems] = useState([
        { id: Date.now(), articleId: '', quantity: '' }
    ]);

    useEffect(() => {
        if (isOpen) {
            fetchLubricants();
        }
    }, [isOpen]);

    const fetchLubricants = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('articles')
                .select('*')
                // Filter for likely lubricant categories. Adjust if needed based on exact DB values
                .in('category', ['lubricant_piste', 'lubricant_bosch', 'Lubrifiants'])
                .order('name');

            if (error) throw error;
            setArticles(data || []);
        } catch (error) {
            console.error('Error fetching lubricants:', error);
        } finally {
            setLoading(false);
        }
    };

    const addItem = () => {
        setItems([...items, { id: Date.now(), articleId: '', quantity: '' }]);
    };

    const removeItem = (id) => {
        if (items.length > 1) {
            setItems(items.filter(i => i.id !== id));
        }
    };

    const updateItem = (id, field, value) => {
        setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!formData.blNumber) {
            alert("Veuillez entrer le numéro de BL.");
            return;
        }

        const validItems = items.filter(i => i.articleId && i.quantity > 0);
        if (validItems.length === 0) {
            alert("Veuillez ajouter au moins un article avec une quantité valide.");
            return;
        }

        setSubmitting(true);
        try {
            // Process each item
            for (const item of validItems) {
                const article = articles.find(a => a.id === item.articleId);
                if (!article) continue;

                const qty = parseInt(item.quantity);

                // 1. Update Stock
                const { error: updateError } = await supabase.rpc('increment_stock', {
                    item_id: article.id,
                    qty: qty
                });

                if (updateError) {
                    console.error("RPC Error, falling back to manual:", updateError);
                    // Fallback
                    const { data: current } = await supabase.from('articles').select('current_stock').eq('id', article.id).single();
                    if (current) {
                        await supabase
                            .from('articles')
                            .update({ current_stock: current.current_stock + qty })
                            .eq('id', article.id);
                    }
                }

                // 2. Log Movement
                await supabase.from('stock_movements').insert({
                    article_id: article.id,
                    type: 'in',
                    quantity: qty,
                    movement_date: new Date(formData.date).toISOString(),
                    notes: `Livraison Lubrifiant BL: ${formData.blNumber} ${formData.supplier ? `(${formData.supplier})` : ''}`
                });
            }

            alert("Livraison enregistrée avec succès !");
            setFormData({
                date: new Date().toISOString().split('T')[0],
                blNumber: '',
                supplier: ''
            });
            setItems([{ id: Date.now(), articleId: '', quantity: '' }]);
            if (onSuccess) onSuccess();
            onClose();

        } catch (error) {
            console.error("Error saving delivery:", error);
            alert("Erreur lors de l'enregistrement de la livraison.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nouvelle Livraison Lubrifiant">
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Header Info */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                            <Calendar size={12} /> Date Réception
                        </label>
                        <input
                            type="date"
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                            <FileText size={12} /> N° BL / Facture
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Ex: BL-12345"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
                            value={formData.blNumber}
                            onChange={(e) => setFormData({ ...formData, blNumber: e.target.value })}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                            <Truck size={12} /> Fournisseur (Optionnel)
                        </label>
                        <input
                            type="text"
                            placeholder="Nom du fournisseur"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
                            value={formData.supplier}
                            onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                        />
                    </div>
                </div>

                {/* Items List */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-gray-700">Articles Reçus</h3>
                        <button
                            type="button"
                            onClick={addItem}
                            className="text-xs flex items-center gap-1 bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 transition-colors font-medium"
                        >
                            <Plus size={14} /> Ajouter une ligne
                        </button>
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {items.map((item, index) => (
                            <div key={item.id} className="flex gap-2 items-start bg-white p-2 rounded-lg border border-gray-200 shadow-sm animate-fade-in">
                                <div className="flex-1">
                                    <label className="text-[10px] text-gray-400 font-bold uppercase mb-0.5 block">Article</label>
                                    <select
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                        value={item.articleId}
                                        onChange={(e) => updateItem(item.id, 'articleId', e.target.value)}
                                        required
                                    >
                                        <option value="">Sélectionner...</option>
                                        {articles.map(art => (
                                            <option key={art.id} value={art.id}>
                                                {art.name} ({art.current_stock} en stock)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-24">
                                    <label className="text-[10px] text-gray-400 font-bold uppercase mb-0.5 block">Qté Reçue</label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 outline-none font-mono"
                                        value={item.quantity}
                                        onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                                    />
                                </div>
                                <div className="pt-5">
                                    <button
                                        type="button"
                                        onClick={() => removeItem(item.id)}
                                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                        disabled={items.length === 1}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                    >
                        {submitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        {submitting ? 'Validation...' : 'Valider la Livraison'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
