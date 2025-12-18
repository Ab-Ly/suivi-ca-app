import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatPrice } from '../utils/formatters';

export default function EditSaleModal({ isOpen, onClose, sale, onSuccess }) {
    const [quantity, setQuantity] = useState('');
    const [saleDate, setSaleDate] = useState('');
    const [salesLocation, setSalesLocation] = useState('piste');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (sale) {
            setQuantity(sale.quantity.toString());
            // Extract YYYY-MM-DD from the timestamp
            const date = new Date(sale.sale_date);
            setSaleDate(date.toISOString().split('T')[0]);
            setSalesLocation(sale.sales_location || 'piste');
        }
    }, [sale]);

    const handleSave = async () => {
        if (!sale || !quantity || !saleDate) return;

        const newQuantity = parseFloat(quantity);
        if (isNaN(newQuantity)) {
            alert("Veuillez entrer une quantité valide.");
            return;
        }

        setSubmitting(true);
        try {
            // 1. Calculate the difference in quantity
            const oldQuantity = sale.quantity;
            const quantityDiff = newQuantity - oldQuantity;

            // 2. Update stock if it's a tracked article (not service)
            const isService = ['Shop', 'Café', 'Bosch Car Service', "Main d'oeuvre", 'Pneumatique'].includes(sale.articles?.category); // Simplified check, ideally check article.type too if available

            if (!isService && quantityDiff !== 0) {
                // If diff is positive (increased quantity), stock should decrease.
                // If diff is negative (decreased quantity), stock should increase.
                const stockChange = -quantityDiff;

                const { error: stockError } = await supabase.rpc('increment_stock', {
                    item_id: sale.article_id,
                    qty: stockChange
                });

                if (stockError) {
                    // Fallback to manual update if RPC fails
                    const { data: current } = await supabase.from('articles').select('current_stock').eq('id', sale.article_id).single();
                    if (current) {
                        await supabase.from('articles').update({
                            current_stock: current.current_stock + stockChange
                        }).eq('id', sale.article_id);
                    }
                }

                // Log movement
                await supabase.from('stock_movements').insert({
                    article_id: sale.article_id,
                    type: stockChange < 0 ? 'out' : 'in', // If stock decreases, it's 'out' (correction for more sales). If increases, 'in' (correction for less sales).
                    quantity: Math.abs(stockChange),
                    movement_date: new Date().toISOString(),
                    notes: `Modification vente #${sale.id}`
                });
            }

            // 3. Update the sale record
            // Recalculate total price based on unit price (implied from original total / original quantity, or ideally we fetched unit price)
            // Since we might not have unit price easily, let's look at `sale.articles.price` if we joined it,
            // OR derive it: unitPrice = sale.total_price / sale.quantity
            const unitPrice = sale.total_price / sale.quantity; // Note: if quantity was 0 this might be issue, but quantity shouldn't be 0
            const newTotalPrice = unitPrice * newQuantity;

            const updatePayload = {
                quantity: newQuantity,
                total_price: newTotalPrice,
                sale_date: new Date(saleDate).toISOString()
            };

            // Only update location if it's a lubricant (or if it was originally set)
            if (sale.articles?.category === 'Lubrifiants') {
                updatePayload.sales_location = salesLocation;
            }

            const { error: updateError } = await supabase
                .from('sales')
                .update(updatePayload)
                .eq('id', sale.id);

            if (updateError) throw updateError;

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error updating sale:', error);
            alert("Erreur lors de la modification de la vente.");
        } finally {
            setSubmitting(false);
        }
    };

    if (!sale) return null;

    const unitPrice = sale.total_price / sale.quantity;
    const newTotal = parseFloat(quantity || 0) * unitPrice;
    const isLubricant = sale.articles?.category === 'Lubrifiants';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Modifier la vente">
            <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">Article</div>
                    <div className="font-bold text-gray-900">{sale.articles?.name}</div>
                    <div className="text-xs text-indigo-600 mt-1">{sale.articles?.category}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Quantité</label>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="w-full px-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Prix Unitaire</label>
                        <div className="w-full px-4 py-2 bg-gray-100 border border-transparent rounded-xl text-gray-600">
                            {formatPrice(unitPrice)}
                        </div>
                    </div>
                </div>

                {isLubricant && (
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Lieu de vente</label>
                        <div className="flex bg-gray-100 p-1 rounded-xl">
                            <button
                                onClick={() => setSalesLocation('piste')}
                                className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-medium transition-all ${salesLocation === 'piste' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Piste
                            </button>
                            <button
                                onClick={() => setSalesLocation('bosch')}
                                className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-medium transition-all ${salesLocation === 'bosch' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Bosch
                            </button>
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Date de vente</label>
                    <input
                        type="date"
                        value={saleDate}
                        onChange={(e) => setSaleDate(e.target.value)}
                        className="w-full px-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                    <div>
                        <div className="text-xs text-gray-500">Nouveau Total</div>
                        <div className="font-bold text-lg text-indigo-600">{formatPrice(newTotal)}</div>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={submitting}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {submitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Enregistrer
                    </button>
                </div>
            </div>
        </Modal>
    );
}
