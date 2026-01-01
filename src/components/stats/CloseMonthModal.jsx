import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import { Loader2, Calculator } from 'lucide-react';

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

export default function CloseMonthModal({ isOpen, onClose, onClosed }) {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);

    const calculateData = async () => {
        setLoading(true);
        try {
            const startDate = new Date(year, month - 1, 1).toISOString();
            const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

            // 1. Fetch Sales (Turnover)
            const { data: sales, error: salesError } = await supabase
                .from('sales')
                .select(`
                    total_price,
                    sales_location,
                    articles (
                        name,
                        category
                    )
                `)
                .gte('sale_date', startDate)
                .lte('sale_date', endDate);

            if (salesError) throw salesError;

            // 2. Fetch Fuel Sales (Volume)
            const { data: fuelSales, error: fuelError } = await supabase
                .from('fuel_sales')
                .select('fuel_type, quantity_liters')
                .gte('sale_date', startDate)
                .lte('sale_date', endDate);

            if (fuelError) throw fuelError;

            // 3. Aggregate Data
            const aggregates = {
                // Turnover
                'Shop': 0,
                'Café': 0,
                'Bosch Service': 0,
                "Main d'oeuvre": 0,
                'Pneumatique': 0,
                'Lubrifiant Piste': 0,
                'Lubrifiant Bosch': 0,
                // Fuel Volume
                'Gasoil Volume': 0,
                'SSP Volume': 0
            };

            sales.forEach(sale => {
                const amount = sale.total_price || 0;
                const category = sale.articles?.category;
                const location = sale.sales_location; // 'piste' or 'bosch'

                if (!category) return;

                // Normalize Category Matching
                const catLower = category.toLowerCase().trim();
                const articleName = sale.articles?.name || '';
                const nameLower = articleName.toLowerCase();

                if (nameLower.includes("main d'oeuvre")) aggregates["Main d'oeuvre"] += amount;
                else if (catLower === 'shop') aggregates['Shop'] += amount;
                else if (catLower === 'cafe' || catLower === 'café') aggregates['Café'] += amount;
                else if (catLower.includes('bosch service') || catLower === 'bosch_service') aggregates['Bosch Service'] += amount;
                else if (catLower.includes("main d'oeuvre")) aggregates["Main d'oeuvre"] += amount;
                else if (catLower.includes('pneumatique')) aggregates['Pneumatique'] += amount;

                // Lubricants Logic
                else if (catLower === 'lubrifiants' || catLower.includes('lubrifiant')) {
                    // Check Location or Specific Category
                    if (catLower === 'lubricant_piste' || location === 'piste') {
                        aggregates['Lubrifiant Piste'] += amount;
                    } else if (catLower === 'lubricant_bosch' || location === 'bosch') {
                        aggregates['Lubrifiant Bosch'] += amount;
                    } else {
                        // Default fallback if no location set? (Maybe Piste is safer default or leave as is)
                        // If it's just "Lubrifiants" without location, we might have an issue. 
                        // But EditSaleModal forces location for 'Lubrifiants'. 
                        // Assuming 'piste' as default if null.
                        aggregates['Lubrifiant Piste'] += amount;
                    }
                }
            });

            fuelSales.forEach(fuel => {
                const qty = fuel.quantity_liters || 0;
                if (fuel.fuel_type === 'Gasoil') aggregates['Gasoil Volume'] += qty;
                else if (fuel.fuel_type === 'SSP' || fuel.fuel_type === 'Sans Plomb') aggregates['SSP Volume'] += qty;
            });

            setResults(aggregates);

        } catch (error) {
            console.error("Error calculating month closing:", error);
            alert("Erreur lors du calcul: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const confirmClosing = async () => {
        if (!results) return;
        setLoading(true);

        try {
            const upsertData = [];

            // Transform results to DB format
            Object.entries(results).forEach(([key, value]) => {
                // If it's a value > 0, we save it.
                if (value > 0) {
                    upsertData.push({
                        year,
                        month,
                        category: key,
                        amount: value
                    });
                }
            });

            if (upsertData.length > 0) {
                const { error } = await supabase
                    .from('historical_sales')
                    .upsert(upsertData, { onConflict: 'month,year,category' });

                if (error) throw error;
            }

            if (onClosed) onClosed();
            onClose();
            // Reset results
            setResults(null);

        } catch (error) {
            console.error("Error saving closing:", error);
            alert("Erreur lors de la sauvegarde: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Clôture du Mois">
            <div className="space-y-6">
                {!results ? (
                    <>
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                            <Calculator className="text-blue-600 mt-1" size={24} />
                            <div>
                                <h4 className="font-bold text-blue-900 text-sm">Calcul Automatique</h4>
                                <p className="text-xs text-blue-700 mt-1">
                                    Cette action va calculer le chiffre d'affaires et les volumes vendus pour le mois sélectionné en se basant sur les saisies quotidiennes.
                                    Les données seront ensuite insérées dans le tableau "Saisie Historique".
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mois</label>
                                <select
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    value={month}
                                    onChange={e => setMonth(parseInt(e.target.value))}
                                >
                                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Année</label>
                                <select
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    value={year}
                                    onChange={e => setYear(parseInt(e.target.value))}
                                >
                                    {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={calculateData}
                            disabled={loading}
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Calculator size={18} />}
                            Lancer le Calcul
                        </button>
                    </>
                ) : (
                    <div className="animate-fade-in space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-gray-900">Résultats du Calcul</h3>
                            <button onClick={() => setResults(null)} className="text-sm text-gray-500 hover:text-gray-900 underline">Retour</button>
                        </div>

                        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden max-h-[300px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100 text-gray-600 font-medium text-xs uppercase">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Catégorie</th>
                                        <th className="px-4 py-2 text-right">Montant / Vol</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {Object.entries(results).map(([key, val]) => (
                                        <tr key={key} className="hover:bg-white">
                                            <td className="px-4 py-2 font-medium text-gray-700">{key}</td>
                                            <td className="px-4 py-2 text-right font-mono">
                                                {key.includes('Volume') ? val.toLocaleString() + ' L' : val.toLocaleString() + ' MAD'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="pt-2">
                            <button
                                onClick={confirmClosing}
                                disabled={loading}
                                className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-100"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : null}
                                Confirmer et Enregistrer
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
