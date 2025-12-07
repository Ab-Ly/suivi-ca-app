import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, ArrowUpRight, ArrowDownLeft, Wallet, Building2, Calendar, Table, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { formatPrice, formatNumber } from '../utils/formatters';

export default function DailyCashTracking() {
    const [activeTab, setActiveTab] = useState('entities'); // entities, expense, operations, reconciliation
    const [entities, setEntities] = useState([]);
    const [operations, setOperations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Form states
    const [showAddModal, setShowAddModal] = useState(false);
    const [transactionType, setTransactionType] = useState('IN'); // IN, OUT
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [selectedEntity, setSelectedEntity] = useState('');
    const [category, setCategory] = useState('ENTITY_TRANSACTION'); // ENTITY_TRANSACTION, EXPENSE_FUND, OTHER

    // State for Entity History Modal
    const [selectedEntityHistory, setSelectedEntityHistory] = useState(null);
    const [historyOperations, setHistoryOperations] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const handleViewEntityHistory = async (entity) => {
        setSelectedEntityHistory(entity);
        setLoadingHistory(true);
        try {
            let query = supabase
                .from('daily_cash_operations')
                .select('*')
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });

            if (entity.isExpense) {
                query = query.eq('category', 'EXPENSE_FUND');
            } else {
                query = query.eq('entity_id', entity.id);
            }

            const { data, error } = await query;
            if (error) throw error;
            setHistoryOperations(data || []);
        } catch (error) {
            console.error('Error fetching entity history:', error);
            alert("Erreur lors du chargement de l'historique");
        } finally {
            setLoadingHistory(false);
        }
    };

    const [entityOpeningBalances, setEntityOpeningBalances] = useState({});
    const [entityClosingBalances, setEntityClosingBalances] = useState({});
    const [expenseOpeningBalance, setExpenseOpeningBalance] = useState(0);
    const [expenseClosingBalance, setExpenseClosingBalance] = useState(0);
    const [previousBalance, setPreviousBalance] = useState(0);

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            // Fetch entities
            const { data: entitiesData, error: entitiesError } = await supabase
                .from('daily_cash_entities')
                .select('*')
                .order('name');

            if (entitiesError) throw entitiesError;
            setEntities(entitiesData || []);

            // Fetch operations for the selected date (for the list view)
            const { data: opsData, error: opsError } = await supabase
                .from('daily_cash_operations')
                .select('*, daily_cash_entities(name)')
                .eq('date', selectedDate)
                .order('created_at', { ascending: false });

            if (opsError) throw opsError;
            setOperations(opsData || []);

            // Fetch ALL operations to calculate current balances
            // In a production app with many records, this should be replaced by a database view or RPC
            const { data: allOps, error: allOpsError } = await supabase
                .from('daily_cash_operations')
                .select('type, amount, category, entity_id, date');

            if (allOpsError) throw allOpsError;

            // Calculate balances
            const newEntityOpeningBalances = {}; // Balance before selected date
            const newEntityClosingBalances = {}; // Balance at end of selected date

            let newExpenseOpeningBalance = 0;
            let newExpenseClosingBalance = 0;

            let prevBal = 0;

            // Initialize entity balances
            (entitiesData || []).forEach(e => {
                newEntityOpeningBalances[e.id] = 0;
                newEntityClosingBalances[e.id] = 0;
            });

            allOps.forEach(op => {
                const amount = Number(op.amount);
                const isCredit = op.type === 'IN';
                const val = isCredit ? amount : -amount;
                const opDate = op.date;

                // Entity Balances
                if (op.category === 'ENTITY_TRANSACTION' && op.entity_id) {
                    // Opening Balance (Strictly before selected date)
                    if (opDate < selectedDate) {
                        newEntityOpeningBalances[op.entity_id] = (newEntityOpeningBalances[op.entity_id] || 0) + val;
                    }

                    // Closing Balance (Up to and including selected date)
                    if (opDate <= selectedDate) {
                        newEntityClosingBalances[op.entity_id] = (newEntityClosingBalances[op.entity_id] || 0) + val;
                    }
                } else if (op.category === 'EXPENSE_FUND') {
                    if (opDate < selectedDate) {
                        newExpenseOpeningBalance += val;
                    }
                    if (opDate <= selectedDate) {
                        newExpenseClosingBalance += val;
                    }
                }

                // Previous Balance Calculation (Strictly < selectedDate) for Global Spreadsheet
                if (opDate < selectedDate) {
                    prevBal += val;
                }
            });

            setEntityOpeningBalances(newEntityOpeningBalances);
            setEntityClosingBalances(newEntityClosingBalances);

            setExpenseOpeningBalance(newExpenseOpeningBalance);
            setExpenseClosingBalance(newExpenseClosingBalance);

            setPreviousBalance(prevBal);

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);



    const handleDeleteOperation = async (id) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette opération ?')) return;

        try {
            const { error } = await supabase
                .from('daily_cash_operations')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchData();
        } catch (error) {
            console.error('Error deleting operation:', error);
            alert('Erreur lors de la suppression');
        }
    };

    const handleAddTransaction = async (e) => {
        e.preventDefault();
        try {
            const newOp = {
                date: selectedDate,
                type: transactionType,
                amount: parseFloat(amount),
                description,
                category,
                entity_id: category === 'ENTITY_TRANSACTION' ? selectedEntity : null
            };

            const { error } = await supabase
                .from('daily_cash_operations')
                .insert([newOp]);

            if (error) throw error;

            // Reset form and refresh
            setShowAddModal(false);
            setAmount('');
            setDescription('');
            fetchData();
        } catch (error) {
            console.error('Error adding transaction:', error);
            alert('Erreur lors de l\'ajout de la transaction');
        }
    };



    // Helper to get daily movement for an entity
    const getDailyEntityMovement = (entityId) => {
        const entityOps = operations.filter(op => op.entity_id === entityId);
        const inAmount = entityOps.filter(op => op.type === 'IN').reduce((sum, op) => sum + Number(op.amount), 0);
        const outAmount = entityOps.filter(op => op.type === 'OUT').reduce((sum, op) => sum + Number(op.amount), 0);
        return { in: inAmount, out: outAmount };
    };

    const [isAddEntityModalOpen, setIsAddEntityModalOpen] = useState(false);
    const [newEntityName, setNewEntityName] = useState('');

    const handleAddEntity = async () => {
        if (!newEntityName.trim()) return;

        try {
            const { error } = await supabase
                .from('daily_cash_entities')
                .insert([{ name: newEntityName.trim() }]);

            if (error) throw error;

            setNewEntityName('');
            setIsAddEntityModalOpen(false);
            fetchData();
        } catch (error) {
            console.error('Error adding entity:', error);
            alert('Erreur lors de la création de la société');
        }
    };

    const handleDeleteEntity = async (e, entityId) => {
        e.stopPropagation(); // Prevent opening history modal
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette société ? Cette action est irréversible.')) return;

        try {
            // Check for existing operations
            const { count, error: countError } = await supabase
                .from('daily_cash_operations')
                .select('*', { count: 'exact', head: true })
                .eq('entity_id', entityId);

            if (countError) throw countError;

            if (count > 0) {
                if (!window.confirm(`Cette société a ${count} opérations enregistrées. Voulez-vous TOUT supprimer (Société + Opérations) ?`)) return;

                // Delete operations first
                const { error: opsError } = await supabase
                    .from('daily_cash_operations')
                    .delete()
                    .eq('entity_id', entityId);

                if (opsError) throw opsError;
            }

            const { error } = await supabase
                .from('daily_cash_entities')
                .delete()
                .eq('id', entityId);

            if (error) throw error;
            fetchData();
        } catch (error) {
            console.error('Error deleting entity:', error);
            alert('Erreur lors de la suppression de la société');
        }
    };

    const handleResetData = async () => {
        if (!window.confirm('ATTENTION : Cette action va supprimer TOUTES les opérations et remettre tous les soldes à zéro. Êtes-vous sûr ?')) return;
        if (!window.confirm('Vraiment sûr ? Cette action est irréversible.')) return;

        try {
            const { error } = await supabase
                .from('daily_cash_operations')
                .delete()
                .not('id', 'is', null); // Delete all rows (UUID safe)

            if (error) throw error;

            alert('Toutes les données ont été réinitialisées.');
            fetchData();
        } catch (error) {
            console.error('Error resetting data:', error);
            alert(`Erreur lors de la réinitialisation: ${error.message || 'Erreur inconnue'}`);
        }
    };

    const dailyTotalDebit = operations
        .filter(op => op.type === 'OUT')
        .reduce((sum, op) => sum + Number(op.amount), 0);

    const dailyTotalCredit = operations
        .filter(op => op.type === 'IN')
        .reduce((sum, op) => sum + Number(op.amount), 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Suivi de Caisse Journalier</h1>
                    <p className="text-gray-500">Gestion des entités et opérations de caisse</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    <button
                        onClick={() => setIsAddEntityModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                        <Building2 size={18} />
                        <span className="hidden sm:inline font-medium">Ajouter Société</span>
                        <span className="sm:hidden">Société</span>
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                        <Plus size={20} />
                        <span className="hidden sm:inline font-medium">Nouvelle Opération</span>
                        <span className="sm:hidden">Ajouter</span>
                    </button>
                    <button
                        onClick={handleResetData}
                        className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-all shadow-sm hover:shadow-md"
                        title="Réinitialiser toutes les données"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b overflow-x-auto pb-1">
                {[
                    { id: 'entities', label: 'Suivi Entités', icon: Building2 },
                    { id: 'expense', label: 'Caisse Dépense', icon: Wallet },
                    { id: 'operations', label: 'Opérations Journalières', icon: Calendar },
                    { id: 'spreadsheet', label: 'CashFlow', icon: Table },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                            ? 'border-indigo-600 text-indigo-600 font-medium'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : (
                    <>
                        {activeTab === 'entities' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-xl text-gray-800">Solde des Sociétés</h3>
                                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                        {entities.length} Sociétés actives
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {entities.map(entity => {
                                        const movement = getDailyEntityMovement(entity.id);
                                        const openingBalance = entityOpeningBalances[entity.id] || 0;
                                        const closingBalance = entityClosingBalances[entity.id] || 0;

                                        return (
                                            <div key={entity.id} onClick={() => handleViewEntityHistory(entity)} className="group p-5 border border-gray-100 rounded-2xl hover:shadow-lg transition-all bg-gradient-to-br from-white to-gray-50 cursor-pointer relative overflow-hidden">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="font-bold text-gray-800 text-lg max-w-[70%] truncate" title={entity.name}>{entity.name}</div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={(e) => handleDeleteEntity(e, entity.id)}
                                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Supprimer la société"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                        <div className="p-2 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                                                            <Building2 size={20} className="text-indigo-500" />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center text-sm pb-2 border-b border-gray-100">
                                                        <span className="text-gray-500">Solde J-1</span>
                                                        <span className={`font-mono font-medium ${openingBalance >= 0 ? 'text-gray-700' : 'text-red-600'}`}>
                                                            {formatPrice(openingBalance)}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-gray-500">Entrées</span>
                                                        <span className="font-mono font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">
                                                            +{formatPrice(movement.in)}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-gray-500">Sorties</span>
                                                        <span className="font-mono font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">
                                                            -{formatPrice(movement.out)}
                                                        </span>
                                                    </div>
                                                    <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                                                        <span className="font-medium text-gray-700">Solde Actuel</span>
                                                        <span className={`font-mono font-bold text-lg ${closingBalance >= 0 ? 'text-indigo-600' : 'text-orange-600'}`}>
                                                            {formatPrice(closingBalance)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {activeTab === 'expense' && (
                            <div className="space-y-8 animate-in fade-in duration-500">
                                {/* Header Section */}
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-2xl text-gray-800 flex items-center gap-2">
                                        <Wallet className="text-purple-600" />
                                        Caisse Dépense
                                    </h3>
                                    <div className="text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">
                                        {format(new Date(selectedDate), 'dd MMMM yyyy')}
                                    </div>
                                </div>

                                {/* Summary Cards - Modern Design */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Report J-1 */}
                                    <div className="relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm border border-gray-100 group hover:shadow-md transition-all duration-300">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <ArrowDownLeft size={64} className="text-orange-500" />
                                        </div>
                                        <div className="relative z-10">
                                            <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Report (J-1)</div>
                                            <div className={`text-3xl font-bold ${expenseOpeningBalance < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                                                {formatPrice(expenseOpeningBalance)} <span className="text-sm font-medium text-gray-400">MAD</span>
                                            </div>
                                        </div>
                                        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-orange-100"></div>
                                    </div>

                                    {/* Mouvement du Jour */}
                                    <div className="relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm border border-gray-100 group hover:shadow-md transition-all duration-300">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Wallet size={64} className="text-purple-500" />
                                        </div>
                                        <div className="relative z-10">
                                            <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Dépenses du Jour</div>
                                            <div className="text-3xl font-bold text-gray-900">
                                                {formatPrice(expenseClosingBalance - expenseOpeningBalance)} <span className="text-sm font-medium text-gray-400">MAD</span>
                                            </div>
                                        </div>
                                        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-purple-200"></div>
                                    </div>

                                    {/* Solde Fin Journée */}
                                    <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-2xl shadow-lg text-white group transform hover:-translate-y-1 transition-all duration-300">
                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                            <Building2 size={64} className="text-white" />
                                        </div>
                                        <div className="relative z-10">
                                            <div className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">Solde Fin Journée</div>
                                            <div className={`text-3xl font-bold ${expenseClosingBalance < 0 ? 'text-red-400' : 'text-white'}`}>
                                                {formatPrice(expenseClosingBalance)} <span className="text-sm font-medium text-gray-400">MAD</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Detailed Operations Table */}
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                        <h4 className="font-bold text-gray-800 text-lg">Détail des Opérations</h4>
                                        <span className="text-xs font-medium px-2 py-1 bg-gray-200 text-gray-600 rounded-md">
                                            {operations.filter(op => op.category === 'EXPENSE_FUND').length} opérations
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-gray-50 text-gray-500 font-semibold text-xs uppercase tracking-wider">
                                                <tr>
                                                    <th className="p-4">Heure</th>
                                                    <th className="p-4">Description</th>
                                                    <th className="p-4 text-right">Montant</th>
                                                    <th className="p-4 text-center">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {operations.filter(op => op.category === 'EXPENSE_FUND').length === 0 ? (
                                                    <tr>
                                                        <td colSpan="4" className="p-12 text-center">
                                                            <div className="flex flex-col items-center justify-center text-gray-400">
                                                                <Wallet size={48} className="mb-4 opacity-20" />
                                                                <p className="font-medium">Aucune dépense enregistrée pour ce jour</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    operations
                                                        .filter(op => op.category === 'EXPENSE_FUND')
                                                        .map(op => (
                                                            <tr key={op.id} className="hover:bg-gray-50 transition-colors group">
                                                                <td className="p-4 text-gray-500 font-mono text-sm">
                                                                    {format(new Date(op.created_at), 'HH:mm')}
                                                                </td>
                                                                <td className="p-4 font-medium text-gray-800">
                                                                    {op.description || 'Dépense diverse'}
                                                                </td>
                                                                <td className="p-4 text-right font-bold text-red-600 font-mono">
                                                                    -{formatPrice(Math.abs(op.amount))}
                                                                </td>
                                                                <td className="p-4 text-center">
                                                                    <button
                                                                        onClick={() => handleDeleteOperation(op.id)}
                                                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                                        title="Supprimer"
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                )}
                                            </tbody>
                                            {operations.filter(op => op.category === 'EXPENSE_FUND').length > 0 && (
                                                <tfoot className="bg-gray-50 font-bold text-gray-800">
                                                    <tr>
                                                        <td colSpan="2" className="p-4 text-right uppercase text-xs tracking-wider text-gray-500">Total Dépenses</td>
                                                        <td className="p-4 text-right text-red-600 font-mono text-lg">
                                                            -{formatPrice(operations
                                                                .filter(op => op.category === 'EXPENSE_FUND')
                                                                .reduce((sum, op) => sum + Number(op.amount), 0))}
                                                        </td>
                                                        <td></td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'operations' && (
                            <div>
                                <h3 className="font-semibold text-lg mb-4">Journal des Opérations ({format(new Date(selectedDate), 'dd/MM/yyyy')})</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                                            <tr>
                                                <th className="p-3">Heure</th>
                                                <th className="p-3">Description</th>
                                                <th className="p-3">Catégorie</th>
                                                <th className="p-3">Type</th>
                                                <th className="p-3 text-right">Montant</th>
                                                <th className="p-3 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {operations.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="p-8 text-center text-gray-500">Aucune opération pour cette date</td>
                                                </tr>
                                            ) : (
                                                operations.map(op => (
                                                    <tr key={op.id} className="hover:bg-gray-50">
                                                        <td className="p-3 text-gray-500">
                                                            {format(new Date(op.created_at), 'HH:mm')}
                                                        </td>
                                                        <td className="p-3 font-medium">
                                                            {op.description || '-'}
                                                            {op.daily_cash_entities && (
                                                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                                    {op.daily_cash_entities.name}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-gray-500">
                                                            {op.category === 'ENTITY_TRANSACTION' && 'Société'}
                                                            {op.category === 'EXPENSE_FUND' && 'Caisse Dépense'}
                                                            {op.category === 'OTHER' && 'Autre'}
                                                        </td>
                                                        <td className="p-3">
                                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${op.type === 'IN' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                                }`}>
                                                                {op.type === 'IN' ? 'Recette' : 'Dépense'}
                                                            </span>
                                                        </td>
                                                        <td className={`p-3 text-right font-bold ${op.type === 'IN' ? 'text-green-600' : 'text-red-600'
                                                            }`}>
                                                            {op.type === 'IN' ? '+' : '-'}{formatPrice(Number(op.amount))}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <button
                                                                onClick={() => handleDeleteOperation(op.id)}
                                                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                                title="Supprimer"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'spreadsheet' && (
                            <div className="space-y-8">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-2xl text-gray-800">CashFlow Journalier</h3>
                                    <div className="px-4 py-1.5 bg-gray-100 rounded-full text-sm font-medium text-gray-600">
                                        {format(new Date(selectedDate), 'dd MMMM yyyy')}
                                    </div>
                                </div>

                                {(() => {
                                    // Refactored Data Logic
                                    const debitItems = [];
                                    const creditItems = [];
                                    let totalDebit = 0;
                                    let totalCredit = 0;
                                    let ecart = 0;

                                    // 1. Prepare Special Operations
                                    const recette8hOps = operations.filter(op => {
                                        const desc = op.description?.toLowerCase() || '';
                                        return desc.includes('recette a 8h') || desc.includes('recette à 8h');
                                    }).map(op => ({ name: 'RECETTE A 8H', amount: Number(op.amount), isOp: true }));

                                    const comptageMatinOps = operations.filter(op => {
                                        const desc = op.description?.toLowerCase() || '';
                                        return desc.includes('comptage matin');
                                    }).map(op => ({ name: 'COMPTAGE MATIN', amount: Number(op.amount), isOp: true }));

                                    const resteJ1Ops = operations.filter(op => {
                                        const desc = op.description?.toLowerCase() || '';
                                        return desc.includes('reste j-1');
                                    }).map(op => ({ name: 'RESTE J-1', amount: Number(op.amount), isReste: true }));

                                    const otherInOps = operations.filter(op => {
                                        const desc = op.description?.toLowerCase() || '';
                                        const isSpecial = desc.includes('recette a 8h') || desc.includes('recette à 8h') || desc.includes('comptage matin') || desc.includes('reste j-1');
                                        return op.type === 'IN' && op.category === 'OTHER' && !isSpecial;
                                    }).map(op => ({ name: op.description || 'Autre Entrée', amount: Number(op.amount), isOp: true }));

                                    const otherOutOps = operations.filter(op => {
                                        const desc = op.description?.toLowerCase() || '';
                                        const isSpecial = desc.includes('recette a 8h') || desc.includes('recette à 8h') || desc.includes('comptage matin') || desc.includes('reste j-1');
                                        return op.type === 'OUT' && op.category === 'OTHER' && !isSpecial;
                                    }).map(op => ({ name: op.description || 'Autre Sortie', amount: Number(op.amount), isOp: true }));

                                    // Build Debit List
                                    debitItems.push(...resteJ1Ops, ...recette8hOps, ...otherInOps);

                                    const positiveBalances = [];
                                    if (expenseClosingBalance > 0) positiveBalances.push({ name: 'SOLDE CAISSE DÉPENSE', amount: expenseClosingBalance, isBalance: true, isExpense: true });
                                    Object.entries(entityClosingBalances).forEach(([entityId, val]) => {
                                        if (val > 0) positiveBalances.push({ name: `SOLDE ${entities.find(e => e.id === entityId)?.name || 'Inconnu'}`, amount: val, isBalance: true, entityId });
                                    });
                                    debitItems.push(...positiveBalances);

                                    // Build Credit List
                                    creditItems.push(...comptageMatinOps, ...otherOutOps);

                                    const negativeBalances = [];
                                    if (expenseClosingBalance < 0) negativeBalances.push({ name: 'SOLDE CAISSE DÉPENSE', amount: expenseClosingBalance, isBalance: true, isExpense: true });
                                    Object.entries(entityClosingBalances).forEach(([entityId, val]) => {
                                        if (val < 0) negativeBalances.push({ name: `SOLDE ${entities.find(e => e.id === entityId)?.name || 'Inconnu'}`, amount: val, isBalance: true, entityId });
                                    });
                                    creditItems.push(...negativeBalances);

                                    const maxRows = Math.max(debitItems.length, creditItems.length, 1);
                                    totalDebit = debitItems.reduce((sum, item) => sum + (item.amount || 0), 0);
                                    totalCredit = creditItems.reduce((sum, item) => sum + Math.abs(item.amount || 0), 0);
                                    ecart = totalDebit - totalCredit;

                                    return (
                                        <>
                                            {/* MOBILE VIEW (Stacked) */}
                                            <div className="md:hidden space-y-6">
                                                {/* ENTRÉES Card */}
                                                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl overflow-hidden">
                                                    <div className="bg-emerald-100/50 px-4 py-3 flex items-center justify-between">
                                                        <h4 className="font-bold text-emerald-800 flex items-center gap-2">
                                                            <ArrowDownLeft size={18} /> ENTRÉE (DÉBIT)
                                                        </h4>
                                                        <span className="font-mono font-bold text-emerald-700">{formatPrice(totalDebit)}</span>
                                                    </div>
                                                    <div className="divide-y divide-emerald-100/50">
                                                        {debitItems.length === 0 ? (
                                                            <div className="p-4 text-center text-sm text-gray-500 italic">Aucune entrée</div>
                                                        ) : (
                                                            debitItems.map((item, i) => (
                                                                <div key={i} className="px-4 py-3 flex justify-between items-center text-sm"
                                                                    onClick={() => {
                                                                        if (item?.isBalance) {
                                                                            if (item.isExpense) handleViewEntityHistory({ name: 'Caisse Dépense', isExpense: true });
                                                                            else if (item.entityId) {
                                                                                const entity = entities.find(e => e.id === item.entityId);
                                                                                if (entity) handleViewEntityHistory(entity);
                                                                            }
                                                                        }
                                                                    }}
                                                                >
                                                                    <span className={`font-medium ${item.isBalance ? 'underline decoration-dotted decoration-emerald-300' : ''}`}>{item.name}</span>
                                                                    <span className="font-mono font-bold text-emerald-700">{formatPrice(Math.abs(item.amount))}</span>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>

                                                {/* SORTIES Card */}
                                                <div className="bg-rose-50/50 border border-rose-100 rounded-xl overflow-hidden">
                                                    <div className="bg-rose-100/50 px-4 py-3 flex items-center justify-between">
                                                        <h4 className="font-bold text-rose-800 flex items-center gap-2">
                                                            <ArrowUpRight size={18} /> SORTIE (CRÉDIT)
                                                        </h4>
                                                        <span className="font-mono font-bold text-rose-700">{formatPrice(totalCredit)}</span>
                                                    </div>
                                                    <div className="divide-y divide-rose-100/50">
                                                        {creditItems.length === 0 ? (
                                                            <div className="p-4 text-center text-sm text-gray-500 italic">Aucune sortie</div>
                                                        ) : (
                                                            creditItems.map((item, i) => (
                                                                <div key={i} className="px-4 py-3 flex justify-between items-center text-sm"
                                                                    onClick={() => {
                                                                        if (item?.isBalance) {
                                                                            if (item.isExpense) handleViewEntityHistory({ name: 'Caisse Dépense', isExpense: true });
                                                                            else if (item.entityId) {
                                                                                const entity = entities.find(e => e.id === item.entityId);
                                                                                if (entity) handleViewEntityHistory(entity);
                                                                            }
                                                                        }
                                                                    }}
                                                                >
                                                                    <span className={`font-medium ${item.isBalance ? 'underline decoration-dotted decoration-rose-300' : ''}`}>{item.name}</span>
                                                                    <span className="font-mono font-bold text-rose-700">{formatPrice(Math.abs(item.amount))}</span>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>

                                                {/* ECART Card */}
                                                <div className={`p-4 rounded-xl border-2 text-center ${ecart === 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
                                                    <div className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">Écart Journalier</div>
                                                    <div className="text-3xl font-black">{formatPrice(ecart)} <span className="text-sm">MAD</span></div>
                                                </div>
                                            </div>

                                            {/* DESKTOP VIEW (Table) */}
                                            <div className="hidden md:block overflow-hidden border border-gray-200 rounded-2xl shadow-lg bg-white">
                                                <table className="w-full border-collapse">
                                                    <thead>
                                                        <tr>
                                                            <th colSpan="2" className="bg-gradient-to-r from-emerald-50 to-emerald-100/50 border-b-2 border-emerald-100 py-4 px-6 text-emerald-800 font-bold uppercase tracking-wider w-1/2">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <ArrowDownLeft size={20} />
                                                                    ENTRÉE (DÉBIT)
                                                                </div>
                                                            </th>
                                                            <th colSpan="2" className="bg-gradient-to-r from-rose-50 to-rose-100/50 border-b-2 border-rose-100 py-4 px-6 text-rose-800 font-bold uppercase tracking-wider w-1/2">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <ArrowUpRight size={20} />
                                                                    SORTIE (CRÉDIT)
                                                                </div>
                                                            </th>
                                                        </tr>
                                                        <tr className="text-xs font-bold text-gray-500 bg-gray-50/80 border-b border-gray-200">
                                                            <th className="py-3 px-4 text-left w-1/3 uppercase tracking-wide">Désignation</th>
                                                            <th className="py-3 px-4 text-right w-1/6 border-r border-gray-200 uppercase tracking-wide">Montant</th>
                                                            <th className="py-3 px-4 text-right w-1/6 uppercase tracking-wide">Montant</th>
                                                            <th className="py-3 px-4 text-left w-1/3 uppercase tracking-wide">Désignation</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="text-sm divide-y divide-gray-100">
                                                        {Array.from({ length: maxRows }).map((_, i) => {
                                                            const debitItem = debitItems[i];
                                                            const creditItem = creditItems[i];

                                                            return (
                                                                <tr key={i} className="group hover:bg-gray-50 transition-colors">
                                                                    {/* ENTRÉE (DÉBIT) */}
                                                                    <td
                                                                        className={`py-3 px-4 border-r border-gray-100 truncate max-w-[200px] ${debitItem?.isBalance ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`}
                                                                        title={debitItem?.name}
                                                                        onClick={() => {
                                                                            if (debitItem?.isBalance) {
                                                                                if (debitItem.isExpense) {
                                                                                    handleViewEntityHistory({ name: 'Caisse Dépense', isExpense: true });
                                                                                } else if (debitItem.entityId) {
                                                                                    const entity = entities.find(e => e.id === debitItem.entityId);
                                                                                    if (entity) handleViewEntityHistory(entity);
                                                                                }
                                                                            }
                                                                        }}
                                                                    >
                                                                        {debitItem && (
                                                                            <div className="flex items-center gap-2">
                                                                                {debitItem.isBalance && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>}
                                                                                <span className={`font-medium ${debitItem.isReste ? 'text-indigo-700 font-bold' :
                                                                                    debitItem.isBalance ? 'text-gray-900 underline decoration-dotted decoration-gray-400 underline-offset-4' :
                                                                                        'text-gray-600'
                                                                                    }`}>
                                                                                    {debitItem.name}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className={`py-3 px-4 border-r border-gray-200 text-right font-mono text-sm ${debitItem?.isReste ? 'text-indigo-700 font-bold bg-indigo-50/30' :
                                                                        debitItem ? 'text-emerald-700 font-medium' : ''
                                                                        }`}>
                                                                        {debitItem ? formatPrice(Math.abs(debitItem.amount)) : ''}
                                                                    </td>

                                                                    {/* SORTIE (CRÉDIT) */}
                                                                    <td className="py-3 px-4 text-right font-mono text-sm text-rose-700 font-medium">
                                                                        {creditItem ? formatPrice(Math.abs(creditItem.amount)) : ''}
                                                                    </td>
                                                                    <td
                                                                        className={`py-3 px-4 border-l border-gray-100 truncate max-w-[200px] ${creditItem?.isBalance ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`}
                                                                        title={creditItem?.name}
                                                                        onClick={() => {
                                                                            if (creditItem?.isBalance) {
                                                                                if (creditItem.isExpense) {
                                                                                    handleViewEntityHistory({ name: 'Caisse Dépense', isExpense: true });
                                                                                } else if (creditItem.entityId) {
                                                                                    const entity = entities.find(e => e.id === creditItem.entityId);
                                                                                    if (entity) handleViewEntityHistory(entity);
                                                                                }
                                                                            }
                                                                        }}
                                                                    >
                                                                        {creditItem && (
                                                                            <div className="flex items-center gap-2">
                                                                                {creditItem.isBalance && <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>}
                                                                                <span className={`font-medium ${creditItem.isBalance ? 'text-gray-900 underline decoration-dotted decoration-gray-400 underline-offset-4' : 'text-gray-600'}`}>
                                                                                    {creditItem.name}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}

                                                        {/* TOTAL Row */}
                                                        <tr className="bg-gray-50 border-t-2 border-gray-200">
                                                            <td className="py-4 px-4 text-right font-black tracking-wider text-gray-600 border-r border-gray-200">TOTAL</td>
                                                            <td className="py-4 px-4 text-right font-mono font-black text-emerald-600 text-lg border-r border-gray-200 bg-emerald-50/30">
                                                                {formatPrice(totalDebit)}
                                                            </td>
                                                            <td className="py-4 px-4 text-right font-mono font-black text-rose-600 text-lg border-r border-gray-200 bg-rose-50/30">
                                                                {formatPrice(totalCredit)}
                                                            </td>
                                                            <td className="py-4 px-4 text-left font-black tracking-wider text-gray-600">TOTAL</td>
                                                        </tr>

                                                        {/* ECART Row */}
                                                        <tr className="bg-white border-t border-gray-100">
                                                            <td className="py-6 px-4 text-right font-bold text-gray-400 tracking-wider border-r border-gray-100">ÉCART</td>
                                                            <td colSpan="2" className="py-6 px-4 text-center">
                                                                <div className={`inline-flex items-center px-6 py-2 rounded-xl border-2 ${ecart === 0
                                                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                                                    : 'bg-amber-50 border-amber-100 text-amber-700'
                                                                    }`}>
                                                                    <span className="font-mono font-black text-2xl tracking-tight">
                                                                        {formatPrice(ecart)}
                                                                    </span>
                                                                    <span className="ml-2 text-xs font-bold uppercase opacity-70">MAD</span>
                                                                </div>
                                                            </td>
                                                            <td className="py-6 px-4 text-left font-bold text-gray-400 tracking-wider border-l border-gray-100">ÉCART</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </>
                                    );
                                })()}

                                <div className="flex justify-end">
                                    <div className="bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 min-w-[320px] transform hover:scale-105 transition-all duration-300 relative overflow-hidden group">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-gray-50 rounded-full group-hover:bg-gray-100 transition-colors z-0"></div>

                                        <div className="relative z-10">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="p-2.5 bg-gray-50 rounded-xl group-hover:bg-white group-hover:shadow-sm transition-all border border-gray-100">
                                                    <Wallet size={22} className="text-gray-700" />
                                                </div>
                                                <span className="text-sm font-bold uppercase tracking-widest text-gray-500">Solde Journalier</span>
                                            </div>

                                            <div className="flex items-baseline gap-2">
                                                <div className="text-4xl font-black tracking-tight text-gray-900">
                                                    {formatPrice(dailyTotalCredit - dailyTotalDebit)}
                                                </div>
                                                <span className="text-lg font-bold text-gray-400">MAD</span>
                                            </div>

                                            <div className="mt-4 flex items-center gap-2">
                                                <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${(dailyTotalCredit - dailyTotalDebit) >= 0
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                    : 'bg-rose-50 text-rose-700 border-rose-100'
                                                    }`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${(dailyTotalCredit - dailyTotalDebit) >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
                                                        }`}></div>
                                                    {(dailyTotalCredit - dailyTotalDebit) >= 0 ? 'Solde Positif' : 'Solde Négatif'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'reconciliation' && (
                            <div>
                                <h3 className="font-semibold text-lg mb-4">Rapprochement Journalier</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="p-6 bg-green-50 rounded-xl border border-green-100">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-green-100 rounded-lg text-green-600">
                                                <ArrowDownLeft size={24} />
                                            </div>
                                            <div className="text-green-800 font-medium">Total Recettes (Crédit)</div>
                                        </div>
                                        <div className="text-3xl font-bold text-green-900">
                                            {formatPrice(dailyTotalCredit)}
                                        </div>
                                    </div>

                                    <div className="p-6 bg-red-50 rounded-xl border border-red-100">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-red-100 rounded-lg text-red-600">
                                                <ArrowUpRight size={24} />
                                            </div>
                                            <div className="text-red-800 font-medium">Total Dépenses (Débit)</div>
                                        </div>
                                        <div className="text-3xl font-bold text-red-900">
                                            {formatPrice(dailyTotalDebit)}
                                        </div>
                                    </div>

                                    <div className="p-6 bg-blue-50 rounded-xl border border-blue-100">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                                <Wallet size={24} />
                                            </div>
                                            <div className="text-blue-800 font-medium">Solde Journalier</div>
                                        </div>
                                        <div className={`text-3xl font-bold ${(dailyTotalCredit - dailyTotalDebit) >= 0 ? 'text-blue-900' : 'text-red-900'
                                            }`}>
                                            {formatPrice(dailyTotalCredit - dailyTotalDebit)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Add Transaction Modal */}
            {
                showAddModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity">
                        <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl transform transition-all scale-100">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-gray-900">Nouvelle Opération</h3>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <X size={20} className="text-gray-500" />
                                </button>
                            </div>

                            <form onSubmit={handleAddTransaction} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                                    <div className="relative">
                                        <select
                                            value={
                                                // Determine the selected value based on current state
                                                category === 'ENTITY_TRANSACTION' ? 'ENTITY_TRANSACTION' :
                                                    category === 'EXPENSE_FUND' ? 'EXPENSE_FUND' :
                                                        description === 'Comptage Matin' ? 'Comptage Matin' :
                                                            description === 'Reste J-1' ? 'Reste J-1' :
                                                                description === 'Recette à 8H' ? 'Recette à 8H' :
                                                                    description === 'Autre Entrée' && transactionType === 'IN' ? 'Autre Entrée' :
                                                                        description === 'Autre Sortie' && transactionType === 'OUT' ? 'Autre Sortie' :
                                                                            '' // Default or if no specific match
                                            }
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                // Reset states
                                                setSelectedEntity('');
                                                setDescription(''); // Clear description for new selection

                                                if (val === 'ENTITY_TRANSACTION') {
                                                    setCategory('ENTITY_TRANSACTION');
                                                    setTransactionType('IN'); // Default, user can change
                                                } else if (val === 'EXPENSE_FUND') {
                                                    setCategory('EXPENSE_FUND');
                                                    setTransactionType('OUT'); // Default
                                                } else if (val === 'Comptage Matin') {
                                                    setCategory('OTHER');
                                                    setDescription('Comptage Matin');
                                                    setTransactionType('OUT');
                                                } else if (val === 'Reste J-1') {
                                                    setCategory('OTHER');
                                                    setDescription('Reste J-1');
                                                    setTransactionType('IN');
                                                } else if (val === 'Recette à 8H') {
                                                    setCategory('OTHER');
                                                    setDescription('Recette à 8H');
                                                    setTransactionType('IN');
                                                } else if (val === 'Autre Entrée') {
                                                    setCategory('OTHER');
                                                    setDescription('Autre Entrée');
                                                    setTransactionType('IN');
                                                } else if (val === 'Autre Sortie') {
                                                    setCategory('OTHER');
                                                    setDescription('Autre Sortie');
                                                    setTransactionType('OUT');
                                                } else { // Fallback for direct category selection if not special description
                                                    setCategory(val);
                                                }
                                            }}
                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-black outline-none appearance-none bg-gray-50"
                                        >
                                            <option value="" disabled>Sélectionner le type</option>
                                            <optgroup label="Opérations Courantes">
                                                <option value="Comptage Matin">Comptage Matin</option>
                                                <option value="Reste J-1">Reste J-1</option>
                                                <option value="Recette à 8H">Recette à 8H</option>
                                            </optgroup>
                                            <optgroup label="Autres">
                                                <option value="Autre Entrée">Autre Entrée</option>
                                                <option value="Autre Sortie">Autre Sortie</option>
                                            </optgroup>
                                            <optgroup label="Spécifique">
                                                <option value="ENTITY_TRANSACTION">Opération Société</option>
                                                <option value="EXPENSE_FUND">Caisse Dépense</option>
                                            </optgroup>
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                            <ArrowDownLeft size={16} />
                                        </div>
                                    </div>
                                </div>

                                {/* Dynamic Fields based on selection */}

                                {category === 'ENTITY_TRANSACTION' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Société</label>
                                        <select
                                            value={selectedEntity}
                                            onChange={(e) => setSelectedEntity(e.target.value)}
                                            required
                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black outline-none bg-gray-50"
                                        >
                                            <option value="">Sélectionner une société</option>
                                            {entities.map(e => (
                                                <option key={e.id} value={e.id}>{e.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Show Type toggle only for Entity or Expense Fund (optional, or if user wants to override) */}
                                {(category === 'ENTITY_TRANSACTION' || category === 'EXPENSE_FUND') && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                                            <button
                                                type="button"
                                                onClick={() => setTransactionType('IN')}
                                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${transactionType === 'IN'
                                                    ? 'bg-white text-green-700 shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-700'
                                                    }`}
                                            >
                                                Recette
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setTransactionType('OUT')}
                                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${transactionType === 'OUT'
                                                    ? 'bg-white text-red-700 shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-700'
                                                    }`}
                                            >
                                                Dépense
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Montant</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="w-full p-3 pl-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black outline-none font-mono text-lg"
                                            placeholder="0.00"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">MAD</div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <input
                                        type="text"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black outline-none"
                                        placeholder="Libellé de l'opération"
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="flex-1 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition-colors font-medium"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors font-medium shadow-lg shadow-gray-200"
                                    >
                                        Ajouter l'opération
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Add Entity Modal */}
            {isAddEntityModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity">
                    <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl transform transition-all scale-100">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-900">Nouvelle Société</h3>
                                <p className="text-gray-500 text-sm mt-1">Ajouter une nouvelle entité au suivi</p>
                            </div>
                            <button
                                onClick={() => setIsAddEntityModalOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X size={24} className="text-gray-400 hover:text-gray-600" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Nom de la société</label>
                                <div className="relative">
                                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input
                                        type="text"
                                        value={newEntityName}
                                        onChange={(e) => setNewEntityName(e.target.value)}
                                        className="w-full p-4 pl-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-lg"
                                        placeholder="Ex: STE EXAMPLE"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={() => setIsAddEntityModalOpen(false)}
                                    className="flex-1 py-3.5 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleAddEntity}
                                    disabled={!newEntityName.trim()}
                                    className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                >
                                    Créer la société
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Entity History Modal */}
            {selectedEntityHistory && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity">
                    <div className="bg-white rounded-2xl w-full max-w-2xl p-0 shadow-2xl transform transition-all scale-100 overflow-hidden flex flex-col max-h-[80vh]">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{selectedEntityHistory.name}</h3>
                                <p className="text-gray-500 text-sm mt-1">
                                    Historique complet des opérations
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedEntityHistory(null)}
                                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                            >
                                <X size={24} className="text-gray-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="overflow-y-auto p-6">
                            {(() => {
                                if (loadingHistory) {
                                    return (
                                        <div className="flex justify-center items-center py-20">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                        </div>
                                    )
                                }

                                const entityOps = historyOperations;
                                let movement = { in: 0, out: 0 };

                                // Recalculate global movement from ALL history
                                const inAmount = entityOps.filter(op => op.type === 'IN').reduce((sum, op) => sum + Number(op.amount), 0);
                                const outAmount = entityOps.filter(op => op.type === 'OUT').reduce((sum, op) => sum + Number(op.amount), 0);
                                movement = { in: inAmount, out: outAmount };

                                return (<div className="space-y-6">
                                    {/* Summary Cards (Global) */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                                            <div className="text-sm text-green-800 font-medium mb-1">Total Historique Entrées</div>
                                            <div className="text-xl font-bold text-green-900">+{formatPrice(movement.in)}</div>
                                        </div>
                                        <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                                            <div className="text-sm text-red-800 font-medium mb-1">Total Historique Sorties</div>
                                            <div className="text-xl font-bold text-red-900">-{formatPrice(movement.out)}</div>
                                        </div>
                                        <div className={`p-4 rounded-xl border ${movement.in - movement.out >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-orange-50 border-orange-100'}`}>
                                            <div className={`text-sm font-medium mb-1 ${movement.in - movement.out >= 0 ? 'text-indigo-800' : 'text-orange-800'}`}>Solde Global</div>
                                            <div className={`text-xl font-bold ${movement.in - movement.out >= 0 ? 'text-indigo-900' : 'text-orange-900'}`}>
                                                {formatPrice(movement.in - movement.out)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Operations List */}
                                    <div>
                                        <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                            <Table size={18} className="text-gray-400" />
                                            Historique complet ({entityOps.length})
                                        </h4>

                                        {entityOps.length === 0 ? (
                                            <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                <div className="p-3 bg-white rounded-full inline-block mb-3 shadow-sm">
                                                    <Calendar size={24} className="text-gray-400" />
                                                </div>
                                                <p className="text-gray-500">Aucune opération enregistrée.</p>
                                            </div>
                                        ) : (
                                            <div className="border rounded-xl overflow-hidden shadow-sm">
                                                <div className="max-h-[400px] overflow-y-auto">
                                                    <table className="w-full text-left border-collapse relative">
                                                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold sticky top-0 z-10 shadow-sm">
                                                            <tr>
                                                                <th className="p-4 border-b bg-gray-50">Date</th>
                                                                <th className="p-4 border-b bg-gray-50">Description</th>
                                                                <th className="p-4 border-b text-right bg-gray-50">Montant</th>
                                                                <th className="p-4 border-b text-center bg-gray-50">Type</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {entityOps.map(op => (
                                                                <tr key={op.id} className="hover:bg-gray-50 transition-colors">
                                                                    <td className="p-4 text-gray-500 font-mono text-sm whitespace-nowrap">
                                                                        <div className="font-bold text-gray-700">{format(new Date(op.date), 'dd/MM/yyyy')}</div>
                                                                        <div className="text-xs text-gray-400">{format(new Date(op.created_at), 'HH:mm')}</div>
                                                                    </td>
                                                                    <td className="p-4 font-medium text-gray-900">
                                                                        {op.description}
                                                                    </td>
                                                                    <td className={`p-4 text-right font-bold font-mono ${op.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                                                                        {op.type === 'IN' ? '+' : '-'}{formatPrice(Number(op.amount))}
                                                                    </td>
                                                                    <td className="p-4 text-center">
                                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${op.type === 'IN'
                                                                            ? 'bg-green-100 text-green-700'
                                                                            : 'bg-red-100 text-red-700'
                                                                            }`}>
                                                                            {op.type === 'IN' ? 'Recette' : 'Dépense'}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                );
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setSelectedEntityHistory(null)}
                                className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors shadow-sm"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

