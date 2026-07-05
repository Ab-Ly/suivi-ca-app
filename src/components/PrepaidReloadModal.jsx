import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { DateInput } from './ui/DateInput';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export default function PrepaidReloadModal({ isOpen, onClose, reload, entities = [], onSuccess }) {
    const [formData, setFormData] = useState({
        reload_date: new Date().toISOString().split('T')[0],
        amount: '',
        company: '',
        payment_status: false,
        payment_date: '',
        payment_method: 'Virement',
        notes: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (reload) {
                setFormData({
                    reload_date: reload.reload_date || '',
                    amount: reload.amount?.toString() || '',
                    company: reload.company || '',
                    payment_status: reload.payment_status || false,
                    payment_date: reload.payment_date || '',
                    payment_method: reload.payment_method || 'Virement',
                    notes: reload.notes || ''
                });
            } else {
                setFormData({
                    reload_date: new Date().toISOString().split('T')[0],
                    amount: '',
                    company: '',
                    payment_status: false,
                    payment_date: '',
                    payment_method: 'Virement',
                    notes: ''
                });
            }
        }
    }, [isOpen, reload]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => {
            const next = {
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            };
            // Automatically set payment_date to reload_date if payment_status becomes true and payment_date is empty
            if (name === 'payment_status' && checked && !prev.payment_date) {
                next.payment_date = prev.reload_date || new Date().toISOString().split('T')[0];
            }
            // Clear payment details if payment_status becomes false
            if (name === 'payment_status' && !checked) {
                next.payment_date = '';
            }
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const dataToSave = {
            reload_date: formData.reload_date,
            amount: parseFloat(formData.amount),
            company: formData.company.trim(),
            payment_status: formData.payment_status,
            payment_date: formData.payment_status ? formData.payment_date : null,
            payment_method: formData.payment_status ? formData.payment_method : null,
            notes: formData.notes.trim() || null
        };

        try {
            let error;
            if (reload) {
                // Update
                const { error: updateError } = await supabase
                    .from('prepaid_card_reloads')
                    .update(dataToSave)
                    .eq('id', reload.id);
                error = updateError;
            } else {
                // Insert
                const { error: insertError } = await supabase
                    .from('prepaid_card_reloads')
                    .insert([dataToSave]);
                error = insertError;
            }

            if (error) throw error;

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving prepaid card reload:', error);
            alert('Erreur lors de l\'enregistrement de la recharge.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={reload ? "Modifier la Recharge" : "Nouvelle Recharge"}>
            <form onSubmit={handleSubmit} className="space-y-4 font-sans">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DateInput
                        label="Date de la recharge"
                        value={formData.reload_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, reload_date: e.target.value }))}
                        required
                    />

                    <div>
                        <label className="block text-xs font-medium text-text-muted mb-1.5">Montant (DH)</label>
                        <input
                            type="number"
                            name="amount"
                            required
                            min="0.01"
                            step="0.01"
                            placeholder="Montant en DH"
                            className="block w-full px-3 py-2.5 text-sm bg-white border border-border rounded-xl shadow-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-text-main"
                            value={formData.amount}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">Société (Ste)</label>
                    <input
                        type="text"
                        name="company"
                        list="companies-datalist"
                        required
                        placeholder="Rechercher ou saisir la société"
                        className="block w-full px-3 py-2.5 text-sm bg-white border border-border rounded-xl shadow-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-text-main"
                        value={formData.company}
                        onChange={handleChange}
                    />
                    <datalist id="companies-datalist">
                        {entities.map((name, idx) => (
                            <option key={idx} value={name} />
                        ))}
                    </datalist>
                </div>

                <div className="flex items-center gap-2 py-2">
                    <input
                        type="checkbox"
                        id="payment_status"
                        name="payment_status"
                        className="w-4 h-4 text-primary border-border rounded focus:ring-primary/20"
                        checked={formData.payment_status}
                        onChange={handleChange}
                    />
                    <label htmlFor="payment_status" className="text-sm font-medium text-text-main cursor-pointer select-none">
                        Versement effectué sur le compte banque
                    </label>
                </div>

                {formData.payment_status && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl border border-border animate-fade-in">
                        <DateInput
                            label="Date du versement"
                            value={formData.payment_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
                            required={formData.payment_status}
                        />

                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1.5">Nature du versement</label>
                            <select
                                name="payment_method"
                                className="block w-full px-3 py-2.5 text-sm bg-white border border-border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-text-main"
                                value={formData.payment_method}
                                onChange={handleChange}
                                required={formData.payment_status}
                            >
                                <option value="Virement">Virement</option>
                                <option value="Chèque">Chèque</option>
                                <option value="Espèces">Espèces</option>
                                <option value="Effet">Effet</option>
                                <option value="Versement direct">Versement direct</option>
                                <option value="Autre">Autre</option>
                            </select>
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">Observations / Notes (Optionnel)</label>
                    <textarea
                        name="notes"
                        rows="2"
                        placeholder="Notes complémentaires..."
                        className="block w-full px-3 py-2.5 text-sm bg-white border border-border rounded-xl shadow-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-text-main resize-none"
                        value={formData.notes}
                        onChange={handleChange}
                    />
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-purple hover:opacity-95 text-white py-3 rounded-xl font-medium shadow-md shadow-purple-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading && <Loader2 className="animate-spin" size={18} />}
                        {loading ? 'Enregistrement...' : (reload ? 'Enregistrer les modifications' : 'Ajouter la recharge')}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
