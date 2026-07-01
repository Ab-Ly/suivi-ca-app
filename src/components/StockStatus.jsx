import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from './ui/Card';
import { Search, Filter, CirclePlus, CircleMinus, PackagePlus, Loader2, History, LayoutGrid, Calendar, Truck, Edit2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import ArticleManager from './ArticleManager';
import EditArticleModal from './EditArticleModal';
import LubricantDeliveryModal from './LubricantDeliveryModal';
import { supabase } from '../lib/supabase';
import { Modal } from './ui/Modal';
import { DateInput } from './ui/DateInput';
import PasswordConfirmationModal from './ui/PasswordConfirmationModal';

export default function StockStatus() {
    const [activeTab, setActiveTab] = useState('status'); // 'status' or 'movements'
    const [searchTerm, setSearchTerm] = useState('');
    const [isArticleManagerOpen, setIsArticleManagerOpen] = useState(false);
    const [isLubricantDeliveryOpen, setIsLubricantDeliveryOpen] = useState(false);
    const [stockData, setStockData] = useState([]);
    const [loading, setLoading] = useState(true);

    // Movement History State
    const [movements, setMovements] = useState([]);
    const [loadingMovements, setLoadingMovements] = useState(false);
    const [movementDateFilter, setMovementDateFilter] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], // Last 30 days
        end: new Date().toISOString().split('T')[0],
        modalDate: new Date().toISOString().split('T')[0]
    });

    // Movement Modal State
    const [movementModalOpen, setMovementModalOpen] = useState(false);
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [movementType, setMovementType] = useState('in'); // 'in' or 'out'
    const [movementQty, setMovementQty] = useState(1);
    const [processing, setProcessing] = useState(false);

    // Delete Confirmation State (for Deduplication)
    const [deleteConfig, setDeleteConfig] = useState({ isOpen: false });

    // Edit Article State
    const [isEditArticleOpen, setIsEditArticleOpen] = useState(false);
    const [editingArticle, setEditingArticle] = useState(null);

    // Lubricant Deliveries History State
    const [lubricantDeliveries, setLubricantDeliveries] = useState([]);
    const [loadingLubricantDeliveries, setLoadingLubricantDeliveries] = useState(false);
    const [expandedDeliveries, setExpandedDeliveries] = useState(new Set());
    const [selectedArticleFilter, setSelectedArticleFilter] = useState(''); // '' means all articles

    useEffect(() => {
        // Ensure stockData (list of articles) is loaded for the selector
        if (stockData.length === 0) {
            fetchStock();
        }

        if (activeTab === 'status') {
            fetchStock();
        } else if (activeTab === 'movements') {
            fetchMovements();
        } else if (activeTab === 'lubricant_deliveries') {
            fetchLubricantDeliveries();
        }
    }, [activeTab, movementDateFilter, selectedArticleFilter]);

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

            if (selectedArticleFilter) {
                query = query.eq('article_id', selectedArticleFilter);
            }

            const { data, error } = await query;

            if (error) throw error;
            setMovements(data || []);
        } catch (error) {
            console.error('Error fetching movements:', error);
        } finally {
            setLoadingMovements(false);
        }
    };

    const fetchLubricantDeliveries = async () => {
        setLoadingLubricantDeliveries(true);
        try {
            const { data, error } = await supabase
                .from('stock_movements')
                .select(`
                    id,
                    article_id,
                    type,
                    quantity,
                    movement_date,
                    notes,
                    articles (id, name, category, price)
                `)
                .ilike('notes', 'Livraison Lubrifiant%')
                .gte('movement_date', `${movementDateFilter.start}T00:00:00`)
                .lte('movement_date', `${movementDateFilter.end}T23:59:59`)
                .order('movement_date', { ascending: false });

            if (error) throw error;

            // Group by notes and date
            const grouped = [];
            (data || []).forEach(move => {
                const notes = move.notes || '';
                let blNumber = '';
                let supplier = '';
                const cleanNotes = notes.replace('Livraison Lubrifiant BL:', '').trim();
                if (cleanNotes.endsWith(')')) {
                    const lastOpenParen = cleanNotes.lastIndexOf('(');
                    if (lastOpenParen !== -1) {
                        blNumber = cleanNotes.substring(0, lastOpenParen).trim();
                        supplier = cleanNotes.substring(lastOpenParen + 1, cleanNotes.length - 1).trim();
                    } else {
                        blNumber = cleanNotes;
                    }
                } else {
                    blNumber = cleanNotes;
                }

                const dateStr = move.movement_date ? move.movement_date.split('T')[0] : '';
                const key = `${dateStr}_${notes}`;
                let delivery = grouped.find(d => d.key === key);
                if (!delivery) {
                    delivery = {
                        key,
                        date: move.movement_date,
                        blNumber: blNumber || 'N/A',
                        supplier: supplier || '-',
                        notes: notes,
                        items: []
                    };
                    grouped.push(delivery);
                }
                delivery.items.push({
                    movementId: move.id,
                    articleId: move.article_id,
                    articleName: move.articles?.name || 'Article inconnu',
                    quantity: move.quantity,
                    price: move.articles?.price || 0
                });
            });

            setLubricantDeliveries(grouped);
        } catch (error) {
            console.error('Error fetching lubricant deliveries:', error);
        } finally {
            setLoadingLubricantDeliveries(false);
        }
    };

    const handleDeleteDelivery = async (delivery) => {
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer la livraison BL: ${delivery.blNumber} ?`)) {
            return;
        }

        setLoadingLubricantDeliveries(true);
        try {
            for (const item of delivery.items) {
                const qtyChange = -item.quantity;
                const { error: stockError } = await supabase.rpc('increment_stock', {
                    item_id: item.articleId,
                    qty: qtyChange
                });

                if (stockError) {
                    const { data: current } = await supabase
                        .from('articles')
                        .select('current_stock')
                        .eq('id', item.articleId)
                        .single();
                    if (current) {
                        await supabase
                            .from('articles')
                            .update({ current_stock: current.current_stock + qtyChange })
                            .eq('id', item.articleId);
                    }
                }

                await supabase
                    .from('stock_movements')
                    .delete()
                    .eq('id', item.movementId);
            }

            alert("Livraison supprimée avec succès !");
            fetchLubricantDeliveries();
            fetchStock();
        } catch (error) {
            console.error("Error deleting delivery:", error);
            alert("Erreur lors de la suppression de la livraison.");
        } finally {
            setLoadingLubricantDeliveries(false);
        }
    };

    const getMovementTypeLabel = (move) => {
        const notes = move.notes || '';
        if (notes.startsWith('Livraison Lubrifiant')) {
            return 'Livraison';
        }
        if (notes.startsWith('Modification vente') || (move.type === 'out' && !notes)) {
            return 'Vente';
        }
        if (notes.startsWith('Ajustement') || notes === 'Ajustement manuel') {
            return 'Ajustement';
        }
        return move.type === 'in' ? 'Entrée' : 'Sortie';
    };

    const getMovementTypeStyle = (move, typeLabel) => {
        if (typeLabel === 'Livraison') {
            return 'bg-green-50 text-green-700 border-green-200';
        }
        if (typeLabel === 'Vente') {
            return 'bg-amber-50 text-amber-700 border-amber-200';
        }
        if (typeLabel === 'Ajustement') {
            return 'bg-blue-50 text-blue-700 border-blue-200';
        }
        return move.type === 'in'
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-red-50 text-red-700 border-red-200';
    };

    const getMovementDetails = (move, typeLabel) => {
        if (move.notes) {
            return move.notes;
        }
        if (typeLabel === 'Vente') {
            return 'Vente directe';
        }
        if (typeLabel === 'Ajustement') {
            return 'Ajustement de stock';
        }
        return '-';
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
                    movement_date: new Date(movementDateFilter.modalDate || new Date()).toISOString(),
                    notes: `Ajustement manuel (${movementType === 'in' ? 'Entrée' : 'Sortie'})`
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
                    <button
                        onClick={() => setActiveTab('lubricant_deliveries')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'lubricant_deliveries'
                            ? 'bg-white text-primary shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Truck size={16} />
                        Livraisons Lubrifiants
                    </button>
                </div>
            </div>

            {activeTab === 'status' && (
                <>
                    <div className="flex justify-end items-center gap-4">
                        <div className="bg-white px-4 py-2.5 border border-border rounded-xl shadow-sm flex items-center gap-2">
                            <span className="text-sm text-text-muted">Valeur Totale:</span>
                            <span className="font-bold text-lg text-primary">{totalValue.toLocaleString()} DH</span>
                        </div>
                        <button
                            onClick={() => setIsLubricantDeliveryOpen(true)}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-md hover:bg-indigo-700 hover:-translate-y-0.5 transition-all duration-200"
                        >
                            <Truck size={20} />
                            <span className="hidden sm:inline font-medium">Livraison Lubrifiant</span>
                        </button>
                        <button
                            onClick={() => setIsArticleManagerOpen(true)}
                            className="flex items-center gap-2 bg-gradient-purple text-white px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                        >
                            <PackagePlus size={20} />
                            <span className="hidden sm:inline font-medium">Nouveau Article</span>
                        </button>
                        <button
                            onClick={() => setDeleteConfig({ isOpen: true })}
                            className="flex items-center gap-2 bg-orange-50 text-orange-600 px-3 py-2.5 rounded-xl hover:bg-orange-100 transition-colors border border-orange-200"
                            title="Fusionner les doublons"
                        >
                            <Filter size={18} />
                            <span className="hidden sm:inline font-medium">Nettoyer</span>
                        </button>
                    </div>

                    <LubricantDeliveryModal
                        isOpen={isLubricantDeliveryOpen}
                        onClose={() => setIsLubricantDeliveryOpen(false)}
                        onSuccess={() => fetchStock()}
                    />

                    <PasswordConfirmationModal
                        isOpen={deleteConfig.isOpen}
                        onClose={() => setDeleteConfig({ isOpen: false })}
                        onConfirm={async () => {
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
                        title="Fusionner et Supprimer les doublons ?"
                        message="Cette action va fusionner tous les articles avec le même nom et supprimer les doublons. Cette action est irréversible."
                    />

                    <ArticleManager isOpen={isArticleManagerOpen} onClose={() => { setIsArticleManagerOpen(false); fetchStock(); }} />

                    <EditArticleModal
                        isOpen={isEditArticleOpen}
                        onClose={() => { setIsEditArticleOpen(false); setEditingArticle(null); }}
                        article={editingArticle}
                        onSuccess={() => fetchStock()}
                    />

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
                                            <tr key={item.id} className="border-b border-notion-border last:border-0 hover:bg-notion-sidebar/60 transition-all duration-200 hover:translate-x-0.5">
                                                <td className="py-3 px-4 font-medium">{item.name}</td>
                                                <td className="py-3 px-4">
                                                    <span className="px-2 py-1 bg-notion-sidebar rounded text-xs text-notion-gray border border-notion-border whitespace-nowrap">
                                                        {item.category || '-'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {(() => {
                                                        const stock = item.current_stock || 0;
                                                        const percent = Math.min(100, (stock / 50) * 100);
                                                        let barColor = 'bg-emerald-500';
                                                        let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                                                        let label = 'Ok';

                                                        if (stock === 0) {
                                                            barColor = 'bg-rose-500';
                                                            badgeColor = 'bg-rose-50 text-rose-700 border-rose-100';
                                                            label = 'Rupture';
                                                        } else if (stock <= 5) {
                                                            barColor = 'bg-rose-500';
                                                            badgeColor = 'bg-rose-50 text-rose-700 border-rose-100';
                                                            label = 'Critique';
                                                        } else if (stock <= 15) {
                                                            barColor = 'bg-amber-500';
                                                            badgeColor = 'bg-amber-50 text-amber-700 border-amber-100';
                                                            label = 'Bas';
                                                        }

                                                        return (
                                                            <div className="flex items-center justify-end gap-3">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${badgeColor} whitespace-nowrap`}>
                                                                    {label}
                                                                </span>
                                                                <div className="flex-1 min-w-[50px] max-w-[80px] h-1.5 bg-gray-100 rounded-full overflow-hidden hidden lg:block">
                                                                    <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${percent}%` }}></div>
                                                                </div>
                                                                <span className="font-mono font-bold text-gray-900 text-sm whitespace-nowrap">
                                                                    {stock}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="py-3 px-4 text-right text-notion-gray">{item.price.toLocaleString()} DH</td>
                                                <td className="py-3 px-4 text-right font-medium">{(item.current_stock * item.price).toLocaleString()} DH</td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingArticle(item);
                                                                setIsEditArticleOpen(true);
                                                            }}
                                                            className="p-1 hover:bg-blue-100 text-blue-600 rounded"
                                                            title="Modifier Article"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
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
            )}
            {activeTab === 'movements' && (
                <Card>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <h3 className="text-lg font-semibold text-text-main">Historique des Mouvements</h3>
                        <div className="flex flex-wrap items-center gap-4">
                            {/* Article Selector */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-500 uppercase">Article:</span>
                                <select
                                    value={selectedArticleFilter}
                                    onChange={(e) => setSelectedArticleFilter(e.target.value)}
                                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                                >
                                    <option value="">Tous les articles</option>
                                    {stockData.map(art => (
                                        <option key={art.id} value={art.id}>
                                            {art.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Date Filter */}
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
                                        {!selectedArticleFilter && <th className="py-3 px-4 font-medium">Article</th>}
                                        <th className="py-3 px-4 font-medium">Type d'opération</th>
                                        <th className="py-3 px-4 font-medium">Détails / Notes</th>
                                        <th className="py-3 px-4 font-medium text-right">Quantité</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movements.map((move) => {
                                        const typeLabel = getMovementTypeLabel(move);
                                        const typeStyle = getMovementTypeStyle(move, typeLabel);
                                        const details = getMovementDetails(move, typeLabel);

                                        return (
                                            <tr key={move.id} className="border-b border-notion-border last:border-0 hover:bg-notion-sidebar/50 transition-colors">
                                                <td className="py-3 px-4 text-sm text-gray-600">
                                                    {new Date(move.movement_date).toLocaleString('fr-FR')}
                                                </td>
                                                {!selectedArticleFilter && (
                                                    <td className="py-3 px-4 font-medium">
                                                        {move.articles?.name || 'Article supprimé'}
                                                    </td>
                                                )}
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold border ${typeStyle}`}>
                                                        {typeLabel}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500 font-medium">
                                                    {details}
                                                </td>
                                                <td className={`py-3 px-4 text-right font-mono font-bold ${
                                                    move.type === 'in' ? 'text-green-600' : 'text-rose-600'
                                                }`}>
                                                    {move.type === 'in' ? '+' : '-'}{move.quantity}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </Card>
            )}

            {activeTab === 'lubricant_deliveries' && (
                <Card>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                        <h3 className="text-lg font-semibold text-text-main">Historique des Livraisons Lubrifiants</h3>
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

                    <div className="space-y-4">
                        {loadingLubricantDeliveries ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="animate-spin text-notion-gray" size={24} />
                            </div>
                        ) : lubricantDeliveries.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                Aucune livraison trouvée pour cette période.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {lubricantDeliveries.map((delivery) => {
                                    const isExpanded = expandedDeliveries.has(delivery.key);
                                    const totalQty = delivery.items.reduce((sum, item) => sum + item.quantity, 0);

                                    const toggleExpand = () => {
                                        const next = new Set(expandedDeliveries);
                                        if (next.has(delivery.key)) {
                                            next.delete(delivery.key);
                                        } else {
                                            next.add(delivery.key);
                                        }
                                        setExpandedDeliveries(next);
                                    };

                                    return (
                                        <div key={delivery.key} className="border border-border rounded-2xl overflow-hidden hover:border-indigo-300 transition-all bg-white group shadow-sm hover:shadow-md">
                                            <div 
                                                className="p-4 flex items-center justify-between cursor-pointer"
                                                onClick={toggleExpand}
                                            >
                                                <div className="flex items-center gap-3 md:gap-4">
                                                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-600">
                                                        <Truck size={20} />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-900 text-sm md:text-base flex flex-wrap items-center gap-2">
                                                            <span>{new Date(delivery.date).toLocaleDateString('fr-FR')}</span>
                                                            <span className="text-xs font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">BL: {delivery.blNumber}</span>
                                                            {delivery.supplier && delivery.supplier !== '-' && (
                                                                <span className="text-xs font-normal text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Fournisseur: {delivery.supplier}</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-text-muted mt-1">
                                                            {delivery.items.length} article{delivery.items.length > 1 ? 's' : ''} • Quantité totale: {totalQty}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                handleDeleteDelivery(delivery); 
                                                            }}
                                                            className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                            title="Supprimer la livraison"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                        <button className="w-8 h-8 flex items-center justify-center text-gray-300 group-hover:text-gray-600 transition-colors">
                                                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* EXPANDED DETAILS */}
                                            {isExpanded && (
                                                <div className="bg-gray-50 border-t border-border p-4 space-y-2 animate-fade-in">
                                                    <table className="w-full text-left border-collapse bg-white rounded-xl border border-border overflow-hidden">
                                                        <thead>
                                                            <tr className="border-b border-border bg-gray-50/50 text-notion-gray text-xs">
                                                                <th className="py-2.5 px-4 font-semibold">Article</th>
                                                                <th className="py-2.5 px-4 font-semibold text-right">Quantité Reçue</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {delivery.items.map((item, idx) => (
                                                                <tr key={idx} className="border-b border-border last:border-0 hover:bg-notion-sidebar/50 transition-colors text-sm">
                                                                    <td className="py-2.5 px-4 font-medium text-gray-700">{item.articleName}</td>
                                                                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-gray-900">{item.quantity}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </Card>
            )}
        </div >
    );
}
