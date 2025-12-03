import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from './ui/Card';
import { Search, Filter, CirclePlus, CircleMinus, PackagePlus, Loader2, History, LayoutGrid, Calendar } from 'lucide-react';
import ArticleManager from './ArticleManager';
import { supabase } from '../lib/supabase';
import { Modal } from './ui/Modal';
import { DateInput } from './ui/DateInput';

export default function StockStatus() {
    const [activeTab, setActiveTab] = useState('status'); // 'status' or 'movements'
    const [searchTerm, setSearchTerm] = useState('');
    const [isArticleManagerOpen, setIsArticleManagerOpen] = useState(false);
    const [stockData, setStockData] = useState([]);
    const [loading, setLoading] = useState(true);

    // Movement History State
    const [movements, setMovements] = useState([]);
    const [loadingMovements, setLoadingMovements] = useState(false);
    const [movementDateFilter, setMovementDateFilter] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], // Last 30 days
        end: new Date().toISOString().split('T')[0]
    });

    // Movement Modal State
    const [movementModalOpen, setMovementModalOpen] = useState(false);
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [movementType, setMovementType] = useState('in'); // 'in' or 'out'
    const [movementQty, setMovementQty] = useState(1);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (activeTab === 'status') {
            fetchStock();
        } else {
            fetchMovements();
        }
    }, [activeTab, movementDateFilter]);

    const fetchStock = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('articles')
                .select('*')
                .order('name');

            if (error) throw error;
            setStockData(data);
        } catch (error) {
            console.error('Error fetching stock:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMovements = async () => {
        setLoadingMovements(true);
        try {
            let query = supabase
                .from('stock_movements')
                .select(`
                    *,
                    articles (name, category)
                `)
                .gte('movement_date', `${movementDateFilter.start}T00:00:00`)
                .lte('movement_date', `${movementDateFilter.end}T23:59:59`)
                .order('movement_date', { ascending: false });

            const { data, error } = await query;

            if (error) throw error;
            setMovements(data || []);
        } catch (error) {
            console.error('Error fetching movements:', error);
        } finally {
            setLoadingMovements(false);
        }
    };

    const openMovementModal = (article, type) => {
        setSelectedArticle(article);
        setMovementType(type);
        setMovementQty(1);
        setMovementModalOpen(true);
    };

    const handleStockMovement = async () => {
        if (!selectedArticle || movementQty <= 0) return;
        setProcessing(true);

        try {
            const newStock = movementType === 'in'
                ? selectedArticle.current_stock + movementQty
                : selectedArticle.current_stock - movementQty;

            // 1. Update Article Stock
            const { error: updateError } = await supabase
                .from('articles')
                .update({ current_stock: newStock })
                .eq('id', selectedArticle.id);

            if (updateError) throw updateError;

            // 2. Record Movement
            const { error: moveError } = await supabase
                .from('stock_movements')
                .insert({
                    article_id: selectedArticle.id,
                    type: movementType,
                    quantity: movementQty,
                    movement_date: new Date().toISOString()
                });

            if (moveError) throw moveError;

            // Refresh local state
            setStockData(prev => prev.map(item =>
                item.id === selectedArticle.id ? { ...item, current_stock: newStock } : item
            ));

            setMovementModalOpen(false);
            // If user switches to history tab, it will auto-fetch
        } catch (error) {
            console.error('Error updating stock:', error);
            alert('Erreur lors de la mise à jour du stock');
        } finally {
            setProcessing(false);
        }
    };

    const filteredStock = stockData.filter(item => {
        // Exclude services from stock view
        const isService = ['Shop', 'Café', 'Bosch Car Service', "Main d'oeuvre"].includes(item.category);
        if (isService) return false;

        return item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()));
    });

    const totalValue = stockData.reduce((sum, item) => sum + (item.current_stock * item.price), 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-3xl font-bold text-text-main">Gestion de Stock</h2>

                {/* Tabs */}
                <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                    <button
                        onClick={() => setActiveTab('status')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'status'
                                ? 'bg-white text-primary shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <LayoutGrid size={16} />
                        État de Stock
                    </button>
                    <button
                        onClick={() => setActiveTab('movements')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'movements'
                                ? 'bg-white text-primary shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <History size={16} />
                        Mouvements
                    </button>
                </div>
            </div>

            {activeTab === 'status' ? (
                <>
                    <div className="flex justify-end items-center gap-4">
                        <div className="bg-white px-4 py-2.5 border border-border rounded-xl shadow-sm flex items-center gap-2">
                            <span className="text-sm text-text-muted">Valeur Totale:</span>
                            <span className="font-bold text-lg text-primary">{totalValue.toLocaleString()} MAD</span>
                        </div>
                        <button
                            onClick={() => setIsArticleManagerOpen(true)}
                            className="flex items-center gap-2 bg-gradient-purple text-white px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                        >
                            <PackagePlus size={20} />
                            <span className="hidden sm:inline font-medium">Nouveau Article</span>
                        </button>
                        <button
                            onClick={async () => {
                                if (!confirm('Voulez-vous vraiment fusionner les articles en double ? Cette action est irréversible.')) return;
                                setLoading(true);
                                try {
                                    const { data: allArticles } = await supabase.from('articles').select('*');
                                    const groups = {};

                                    // Group by name
                                    allArticles.forEach(a => {
                                        const name = a.name.trim();
                                        if (!groups[name]) groups[name] = [];
                                        groups[name].push(a);
                                    });

                                    let deletedCount = 0;

                                    for (const name in groups) {
                                        const group = groups[name];
                                        if (group.length > 1) {
                                            // Keep the first one (master)
                                            const master = group[0];
                                            const duplicates = group.slice(1);

                                            for (const dup of duplicates) {
                                                // Update sales
                                                await supabase.from('sales').update({ article_id: master.id }).eq('article_id', dup.id);
                                                // Update movements
                                                await supabase.from('stock_movements').update({ article_id: master.id }).eq('article_id', dup.id);
                                                // Delete duplicate
                                                await supabase.from('articles').delete().eq('id', dup.id);
                                                deletedCount++;
                                            }
                                        }
                                    }

                                    alert(`${deletedCount} doublons ont été fusionnés et supprimés.`);
                                    fetchStock();
                                } catch (error) {
                                    console.error('Error deduplicating:', error);
                                    alert('Erreur lors de la fusion des doublons');
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            className="flex items-center gap-2 bg-orange-50 text-orange-600 px-3 py-2.5 rounded-xl hover:bg-orange-100 transition-colors border border-orange-200"
                            title="Fusionner les doublons"
                        >
                            <Filter size={18} />
                            <span className="hidden sm:inline font-medium">Nettoyer</span>
                        </button>
                    </div>

                    <ArticleManager isOpen={isArticleManagerOpen} onClose={() => { setIsArticleManagerOpen(false); fetchStock(); }} />

                    {/* Movement Modal */}
                    <Modal isOpen={movementModalOpen} onClose={() => setMovementModalOpen(false)} title={movementType === 'in' ? "Entrée de Stock" : "Sortie de Stock"}>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-notion-gray mb-1">Article</label>
                                <div className="p-2 bg-gray-50 rounded border border-notion-border">{selectedArticle?.name}</div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-notion-gray mb-1">Quantité</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={movementQty}
                                    onChange={(e) => setMovementQty(parseInt(e.target.value) || 0)}
                                    className="w-full p-2 border border-notion-border rounded focus:outline-none focus:ring-2 focus:ring-notion-gray/20"
                                />
                            </div>
                            <button
                                onClick={handleStockMovement}
                                disabled={processing}
                                className={`w-full py-2 text-white rounded font-medium flex justify-center items-center gap-2 ${movementType === 'in' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                                {processing && <Loader2 className="animate-spin" size={18} />}
                                Confirmer
                            </button>
                        </div>
                    </Modal>

                    <Card>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-notion-gray" size={18} />
                                <input
                                    type="text"
                                    placeholder="Rechercher un article..."
                                    className="w-full pl-10 pr-4 py-2 border border-notion-border rounded-md focus:outline-none focus:ring-1 focus:ring-notion-gray"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="animate-spin text-notion-gray" size={24} />
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-notion-border text-notion-gray text-sm">
                                            <th className="py-3 px-4 font-medium">Article</th>
                                            <th className="py-3 px-4 font-medium">Catégorie</th>
                                            <th className="py-3 px-4 font-medium text-right">Quantité</th>
                                            <th className="py-3 px-4 font-medium text-right">Prix Unitaire</th>
                                            <th className="py-3 px-4 font-medium text-right">Valeur Stock</th>
                                            <th className="py-3 px-4 font-medium text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStock.map((item) => (
                                            <tr key={item.id} className="border-b border-notion-border last:border-0 hover:bg-notion-sidebar/50 transition-colors">
                                                <td className="py-3 px-4 font-medium">{item.name}</td>
                                                <td className="py-3 px-4">
                                                    <span className="px-2 py-1 bg-notion-sidebar rounded text-xs text-notion-gray border border-notion-border">
                                                        {item.category || '-'}
                                                    </span>
                                                </td>
                                                <td className={`py-3 px-4 text-right font-mono ${item.current_stock <= 5 ? 'text-red-600 font-bold' : ''}`}>
                                                    {item.current_stock}
                                                </td>
                                                <td className="py-3 px-4 text-right text-notion-gray">{item.price.toLocaleString()} MAD</td>
                                                <td className="py-3 px-4 text-right font-medium">{(item.current_stock * item.price).toLocaleString()} MAD</td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => openMovementModal(item, 'in')}
                                                            className="p-1 hover:bg-green-100 text-green-600 rounded"
                                                            title="Entrée Stock"
                                                        >
                                                            <CirclePlus size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => openMovementModal(item, 'out')}
                                                            className="p-1 hover:bg-red-100 text-red-600 rounded"
                                                            title="Sortie Stock"
                                                        >
                                                            <CircleMinus size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </Card>
                </>
            ) : (
                <Card>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                        <h3 className="text-lg font-semibold text-text-main">Historique des Mouvements</h3>
                        <div className="flex items-center gap-2">
                            <DateInput
                                value={movementDateFilter.start}
                                onChange={(e) => setMovementDateFilter(prev => ({ ...prev, start: e.target.value }))}
                                className="w-36"
                            />
                            <span className="text-gray-400">-</span>
                            <DateInput
                                value={movementDateFilter.end}
                                onChange={(e) => setMovementDateFilter(prev => ({ ...prev, end: e.target.value }))}
                                className="w-36"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        {loadingMovements ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="animate-spin text-notion-gray" size={24} />
                            </div>
                        ) : movements.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                Aucun mouvement trouvé pour cette période.
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-notion-border text-notion-gray text-sm">
                                        <th className="py-3 px-4 font-medium">Date</th>
                                        <th className="py-3 px-4 font-medium">Article</th>
                                        <th className="py-3 px-4 font-medium">Type</th>
                                        <th className="py-3 px-4 font-medium text-right">Quantité</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movements.map((move) => (
                                        <tr key={move.id} className="border-b border-notion-border last:border-0 hover:bg-notion-sidebar/50 transition-colors">
                                            <td className="py-3 px-4 text-sm text-gray-600">
                                                {new Date(move.movement_date).toLocaleString('fr-FR')}
                                            </td>
                                            <td className="py-3 px-4 font-medium">
                                                {move.articles?.name || 'Article supprimé'}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-1 rounded text-xs font-medium border ${move.type === 'in'
                                                        ? 'bg-green-50 text-green-700 border-green-200'
                                                        : 'bg-red-50 text-red-700 border-red-200'
                                                    }`}>
                                                    {move.type === 'in' ? 'Entrée' : 'Sortie'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono font-medium">
                                                {move.type === 'in' ? '+' : '-'}{move.quantity}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
}
