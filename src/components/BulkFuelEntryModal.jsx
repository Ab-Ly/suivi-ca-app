import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Plus, Trash2, Save, Loader2, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatNumber } from '../utils/formatters';

export default function BulkFuelEntryModal({ isOpen, onClose, onSuccess }) {
    const [rows, setRows] = useState([
        { date: new Date().toISOString().split('T')[0], gasoil: '', ssp: '' }
    ]);
    const [submitting, setSubmitting] = useState(false);

    const handleAddRow = () => {
        const lastDate = new Date(rows[rows.length - 1].date);
        const nextDate = new Date(lastDate);
        nextDate.setDate(lastDate.getDate() - 1); // Default to previous day for history

        setRows([...rows, {
            date: nextDate.toISOString().split('T')[0],
            gasoil: '',
            ssp: ''
        }]);
    };

    const handleRemoveRow = (index) => {
        if (rows.length > 1) {
            setRows(rows.filter((_, i) => i !== index));
        }
    };

    const handleChange = (index, field, value) => {
        const newRows = [...rows];
        newRows[index][field] = value;
        setRows(newRows);
    };

    const handleSubmit = async () => {
        // Validate
        const validRows = rows.filter(r => r.date && (r.gasoil || r.ssp));
        if (validRows.length === 0) return;

        setSubmitting(true);
        try {
            const inserts = [];

            validRows.forEach(row => {
                if (row.gasoil && parseFloat(row.gasoil) > 0) {
                    inserts.push({
                        sale_date: new Date(row.date).toISOString(),
                        fuel_type: 'Gasoil',
                        quantity_liters: parseFloat(row.gasoil)
                    });
                }
                if (row.ssp && parseFloat(row.ssp) > 0) {
                    inserts.push({
                        sale_date: new Date(row.date).toISOString(),
                        fuel_type: 'SSP',
                        quantity_liters: parseFloat(row.ssp)
                    });
                }
            });

            if (inserts.length === 0) {
                alert("Aucune donnée valide à enregistrer.");
                setSubmitting(false);
                return;
            }

            const { error } = await supabase.from('fuel_sales').insert(inserts);

            if (error) throw error;

            onSuccess();
            onClose();
            // Reset form
            setRows([{ date: new Date().toISOString().split('T')[0], gasoil: '', ssp: '' }]);

        } catch (error) {
            console.error('Error bulk inserting fuel sales:', error);
            alert(`Erreur lors de l'enregistrement: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    // Calculate totals for preview
    const totalGasoil = rows.reduce((sum, row) => sum + (parseFloat(row.gasoil) || 0), 0);
    const totalSSP = rows.reduce((sum, row) => sum + (parseFloat(row.ssp) || 0), 0);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Saisie Historique Carburant" className="max-w-4xl">
            <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800">
                    Saisissez les volumes vendus (en Litres) pour chaque date. Les lignes vides seront ignorées.
                </div>

                <div className="overflow-hidden border border-gray-200 rounded-xl shadow-sm">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-600 font-medium text-sm">
                            <tr>
                                <th className="p-3 border-b border-gray-200 w-48">Date</th>
                                <th className="p-3 border-b border-gray-200">Gasoil (L)</th>
                                <th className="p-3 border-b border-gray-200">Sans Plomb (L)</th>
                                <th className="p-3 border-b border-gray-200 w-16 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rows.map((row, index) => (
                                <tr key={index} className="group hover:bg-gray-50 transition-colors">
                                    <td className="p-2">
                                        <div className="relative">
                                            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="date"
                                                value={row.date}
                                                onChange={(e) => handleChange(index, 'date', e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                            />
                                        </div>
                                    </td>
                                    <td className="p-2">
                                        <input
                                            type="number"
                                            value={row.gasoil}
                                            onChange={(e) => handleChange(index, 'gasoil', e.target.value)}
                                            placeholder="0"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm font-mono"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input
                                            type="number"
                                            value={row.ssp}
                                            onChange={(e) => handleChange(index, 'ssp', e.target.value)}
                                            placeholder="0"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm font-mono"
                                        />
                                    </td>
                                    <td className="p-2 text-center">
                                        {rows.length > 1 && (
                                            <button
                                                onClick={() => handleRemoveRow(index)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                tabIndex={-1}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold text-gray-700 text-sm">
                            <tr>
                                <td className="p-3 text-right">TOTAUX :</td>
                                <td className="p-3 font-mono text-orange-700">{formatNumber(totalGasoil)} L</td>
                                <td className="p-3 font-mono text-green-700">{formatNumber(totalSSP)} L</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="flex justify-between items-center pt-2">
                    <button
                        onClick={handleAddRow}
                        className="flex items-center gap-2 px-4 py-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors font-medium text-sm"
                    >
                        <Plus size={18} />
                        Ajouter une ligne
                    </button>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || (totalGasoil === 0 && totalSSP === 0)}
                            className="flex items-center gap-2 px-8 py-2.5 bg-black text-white rounded-xl hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            {submitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                            {submitting ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
