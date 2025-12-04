import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Save, AlertCircle } from 'lucide-react';

const CATEGORIES = ['Shop', 'Café', 'Bosch Service', 'Pneumatique', 'Lubrifiants'];
const MONTHS = [
    { value: 1, label: 'Janvier' },
    { value: 2, label: 'Février' },
    { value: 3, label: 'Mars' },
    { value: 4, label: 'Avril' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' },
    { value: 8, label: 'Août' },
    { value: 9, label: 'Septembre' },
    { value: 10, label: 'Octobre' },
    { value: 11, label: 'Novembre' },
    { value: 12, label: 'Décembre' }
];

export default function HistoricalEntry() {
    const [year, setYear] = useState(new Date().getFullYear() - 1);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState({});
    const [message, setMessage] = useState(null);

    useEffect(() => {
        fetchHistoricalData();
    }, [year]);

    const fetchHistoricalData = async () => {
        setLoading(true);
        try {
            const { data: history, error } = await supabase
                .from('historical_sales')
                .select('*')
                .eq('year', year);

            if (error) throw error;

            // Transform to map: { month_category: amount }
            const map = {};
            history?.forEach(item => {
                map[`${item.month}_${item.category}`] = item.amount;
            });
            setData(map);
        } catch (error) {
            console.error('Error fetching history:', error);
            setMessage({ type: 'error', text: 'Erreur lors du chargement des données.' });
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (month, category, value) => {
        setData(prev => ({
            ...prev,
            [`${month}_${category}`]: value
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const upsertData = [];

            MONTHS.forEach(m => {
                CATEGORIES.forEach(cat => {
                    const key = `${m.value}_${cat}`;
                    const amount = parseFloat(data[key]) || 0;

                    if (amount > 0 || data[key] !== undefined) {
                        upsertData.push({
                            year,
                            month: m.value,
                            category: cat,
                            amount: amount
                        });
                    }
                });
            });

            if (upsertData.length === 0) return;

            const { error } = await supabase
                .from('historical_sales')
                .upsert(upsertData, { onConflict: 'month,year,category' });

            if (error) throw error;

            setMessage({ type: 'success', text: 'Données sauvegardées avec succès !' });
        } catch (error) {
            console.error('Error saving history:', error);
            setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700">Année de référence :</label>
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                        {[2023, 2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Enregistrer
                </button>
            </div>

            {message && (
                <div className={`p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    <AlertCircle size={20} />
                    {message.text}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="animate-spin text-gray-400" size={32} />
                </div>
            ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-medium">
                            <tr>
                                <th className="px-4 py-3 border-b">Mois</th>
                                {CATEGORIES.map(cat => (
                                    <th key={cat} className="px-4 py-3 border-b text-right min-w-[120px]">{cat}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {MONTHS.map(month => (
                                <tr key={month.value} className="hover:bg-gray-50/50">
                                    <td className="px-4 py-3 font-medium text-gray-900">{month.label}</td>
                                    {CATEGORIES.map(cat => (
                                        <td key={cat} className="px-2 py-2">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="w-full px-3 py-1.5 border border-gray-200 rounded focus:ring-2 focus:ring-primary/20 focus:border-primary text-right transition-all"
                                                placeholder="0.00"
                                                value={data[`${month.value}_${cat}`] || ''}
                                                onChange={(e) => handleChange(month.value, cat, e.target.value)}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
