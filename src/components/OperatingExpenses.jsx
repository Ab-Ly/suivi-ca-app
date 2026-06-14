import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { CreditCard, Plus, Trash2, Calendar, FileText, CheckCircle, AlertTriangle, X, ShieldAlert, Sparkles, Receipt, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatPrice } from '../utils/formatters';

const CATEGORIES = [
    { value: 'Loyer', label: 'Loyer', color: 'bg-blue-50 text-blue-700 border-blue-100' },
    { value: 'Electricite', label: 'Électricité', color: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
    { value: 'Eau', label: 'Eau', color: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
    { value: 'Salaires', label: 'Salaires', color: 'bg-purple-50 text-purple-700 border-purple-100' },
    { value: 'Taxes', label: 'Taxes et Impôts', color: 'bg-red-50 text-red-700 border-red-100' },
    { value: 'Assurances', label: 'Assurances', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { value: 'Entretien', label: 'Entretien & Réparations', color: 'bg-orange-50 text-orange-700 border-orange-100' },
    { value: 'Fournitures', label: 'Fournitures', color: 'bg-pink-50 text-pink-700 border-pink-100' },
    { value: 'Autre', label: 'Autre', color: 'bg-gray-50 text-gray-700 border-gray-100' }
];

const PAYMENT_METHODS = [
    { value: 'VIREMENT', label: 'Virement' },
    { value: 'PRELEVEMENT', label: 'Prélèvement' },
    { value: 'ESPECES', label: 'Espèces' },
    { value: 'CHEQUE', label: 'Chèque' }
];

export default function OperatingExpenses() {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isTableMissing, setIsTableMissing] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    
    // Filters
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
    const [selectedMonthFilter, setSelectedMonthFilter] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        category: 'Loyer',
        amount: '',
        description: '',
        payment_method: 'VIREMENT'
    });

    const fetchExpenses = async () => {
        setLoading(true);
        setIsTableMissing(false);
        try {
            const { data, error } = await supabase
                .from('operating_expenses')
                .select('*')
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === '42P01') {
                    setIsTableMissing(true);
                    return;
                }
                throw error;
            }

            setExpenses(data || []);
        } catch (error) {
            console.error('Error fetching expenses:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExpenses();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.amount || Number(formData.amount) <= 0) {
            alert('Veuillez entrer un montant valide');
            return;
        }

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('operating_expenses')
                .insert({
                    date: formData.date,
                    category: formData.category,
                    amount: Number(formData.amount),
                    description: formData.description,
                    payment_method: formData.payment_method
                });

            if (error) throw error;

            setFormData({
                date: new Date().toISOString().split('T')[0],
                category: 'Loyer',
                amount: '',
                description: '',
                payment_method: 'VIREMENT'
            });
            setShowAddModal(false);
            fetchExpenses();
        } catch (error) {
            console.error('Error adding expense:', error);
            alert("Erreur lors de l'enregistrement de la charge");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteExpense = async (id) => {
        if (!window.confirm('Voulez-vous vraiment supprimer cette charge ?')) return;

        try {
            const { error } = await supabase
                .from('operating_expenses')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchExpenses();
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert('Erreur lors de la suppression');
        }
    };

    // Filter logic
    const filteredExpenses = expenses.filter(exp => {
        const matchesCategory = selectedCategoryFilter ? exp.category === selectedCategoryFilter : true;
        const matchesMonth = selectedMonthFilter ? exp.date.startsWith(selectedMonthFilter) : true;
        return matchesCategory && matchesMonth;
    });

    // Unique list of months from expenses for filter dropdown
    const availableMonths = Array.from(
        new Set(expenses.map(exp => exp.date.substring(0, 7)))
    ).sort((a, b) => b.localeCompare(a));

    // Stats calculations (filtered or overall?)
    // Let's compute based on currently filtered expenses
    const totalAmount = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    
    // Grouped stats by category
    const categoryTotals = filteredExpenses.reduce((acc, exp) => {
        acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount);
        return acc;
    }, {});

    const getCategoryDetails = (catValue) => {
        return CATEGORIES.find(c => c.value === catValue) || { label: catValue, color: 'bg-gray-100' };
    };

    // SQL Code for missing table setup instructions
    const migrationSQL = `-- Exécutez ce script dans le SQL Editor de Supabase
CREATE TABLE IF NOT EXISTS public.operating_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Loyer', 'Electricite', 'Eau', 'Salaires', 'Taxes', 'Assurances', 'Entretien', 'Fournitures', 'Autre')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('VIREMENT', 'PRELEVEMENT', 'ESPECES', 'CHEQUE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.operating_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users on operating_expenses" ON public.operating_expenses;

CREATE POLICY "Enable all access for authenticated users on operating_expenses" ON public.operating_expenses
    FOR ALL USING (true) WITH CHECK (true);`;

    if (isTableMissing) {
        return (
            <div className="max-w-4xl mx-auto py-10 px-4">
                <div className="bg-orange-50 border border-orange-200 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col items-center text-center space-y-6">
                    <div className="p-4 bg-orange-100 text-orange-600 rounded-full">
                        <ShieldAlert size={36} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Table "operating_expenses" manquante</h2>
                        <p className="text-gray-600 text-sm mt-2 max-w-lg">
                            Pour utiliser cette fonctionnalité en version **BETA**, vous devez initialiser la table dans votre base de données Supabase.
                        </p>
                    </div>

                    <div className="w-full text-left bg-gray-900 rounded-2xl p-5 overflow-x-auto border border-gray-800 relative group">
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(migrationSQL);
                                alert('Code SQL copié ! Collez-le dans le SQL Editor de Supabase.');
                            }}
                            className="absolute top-3 right-3 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold px-3 py-1.5 rounded-lg transition-colors border border-gray-700"
                        >
                            Copier le SQL
                        </button>
                        <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">{migrationSQL}</pre>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={fetchExpenses}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm font-semibold"
                        >
                            <RefreshCw size={18} />
                            Vérifier de nouveau
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <CreditCard className="text-purple-600" size={28} />
                            Charges d'Exploitation
                        </h1>
                        <span className="text-[10px] font-extrabold uppercase bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                            <Sparkles size={10} /> Beta
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">Suivi des coûts fixes, variables et charges générales de la station</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                    <Plus size={18} />
                    Saisir une Charge
                </button>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total filter-scoped expense */}
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Receipt size={64} className="text-indigo-600" />
                    </div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Total Charges Filtré</div>
                    <div className="text-3xl font-black text-gray-900">
                        {formatPrice(totalAmount)}
                    </div>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-500"></div>
                </div>

                {/* Categories Count */}
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Calendar size={64} className="text-purple-600" />
                    </div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Nombre d'enregistrements</div>
                    <div className="text-3xl font-black text-gray-900">
                        {filteredExpenses.length} <span className="text-sm font-semibold text-gray-400">charges</span>
                    </div>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-purple-500"></div>
                </div>

                {/* Major Spending category */}
                {(() => {
                    const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
                    const topCat = sortedCats[0];
                    return (
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Sparkles size={64} className="text-orange-600" />
                            </div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Poste le plus important</div>
                            <div className="text-2xl font-black text-gray-900 truncate">
                                {topCat ? `${getCategoryDetails(topCat[0]).label} (${formatPrice(topCat[1])})` : 'Aucun'}
                            </div>
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-500"></div>
                        </div>
                    );
                })()}
            </div>

            {/* Filter controls */}
            <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Filtrer par :</label>
                </div>
                
                {/* Category selector */}
                <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl p-2.5 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                >
                    <option value="">Toutes les catégories</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>

                {/* Month selector */}
                <select
                    value={selectedMonthFilter}
                    onChange={(e) => setSelectedMonthFilter(e.target.value)}
                    className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl p-2.5 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                >
                    <option value="">Tous les mois</option>
                    {availableMonths.map(m => {
                        const date = new Date(m + '-02'); // Add dummy day to avoid timezone wrap
                        return (
                            <option key={m} value={m}>
                                {format(date, 'MMMM yyyy', { locale: fr })}
                            </option>
                        );
                    })}
                </select>

                {(selectedCategoryFilter || selectedMonthFilter) && (
                    <button
                        onClick={() => {
                            setSelectedCategoryFilter('');
                            setSelectedMonthFilter('');
                        }}
                        className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors ml-auto"
                    >
                        Réinitialiser les filtres
                    </button>
                )}
            </div>

            {/* Expenses List */}
            <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/70 border-b border-gray-100 text-gray-400 uppercase text-[10px] font-bold tracking-wider">
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Catégorie</th>
                                <th className="px-6 py-4">Libellé / Description</th>
                                <th className="px-6 py-4">Mode de Règlement</th>
                                <th className="px-6 py-4 text-right">Montant (MAD)</th>
                                <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-10">
                                        <div className="flex justify-center items-center gap-2 text-gray-400">
                                            <RefreshCw className="animate-spin text-indigo-500" size={20} />
                                            <span>Chargement...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-16 text-gray-400">
                                        <Receipt size={40} className="mx-auto mb-3 opacity-30" />
                                        <p className="text-sm">Aucune charge enregistrée correspondant aux critères.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredExpenses.map(exp => {
                                    const catInfo = getCategoryDetails(exp.category);
                                    const pMethod = PAYMENT_METHODS.find(p => p.value === exp.payment_method) || { label: exp.payment_method };
                                    
                                    return (
                                        <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-mono text-sm font-bold text-gray-700">
                                                {format(new Date(exp.date), 'dd/MM/yyyy')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${catInfo.color}`}>
                                                    {catInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-800">
                                                {exp.description || '—'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                                                {pMethod.label}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-base font-black text-gray-900">
                                                {formatPrice(Number(exp.amount))}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => handleDeleteExpense(exp.id)}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Saisie modal */}
            {showAddModal && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Receipt className="text-purple-600" size={20} />
                                Enregistrer une Charge
                            </h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Date de Paiement</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-3 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Montant (MAD)</label>
                                    <input
                                        type="number"
                                        required
                                        placeholder="0.00"
                                        step="0.01"
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-3 outline-none font-bold focus:ring-2 focus:ring-indigo-100"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Catégorie</label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-3 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Mode de Règlement</label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-3 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                                        value={formData.payment_method}
                                        onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                                    >
                                        {PAYMENT_METHODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Libellé / Description</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Factures Lydec Mai 2026, Loyer Station..."
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-3 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {submitting ? 'Enregistrement...' : 'Enregistrer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
