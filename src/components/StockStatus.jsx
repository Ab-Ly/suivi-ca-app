import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from './ui/Card';
import { Search, Filter, CirclePlus, CircleMinus, PackagePlus, Loader2, History, LayoutGrid, Calendar, Truck, Edit2, Trash2, ChevronDown, ChevronUp, DollarSign, Droplet, Scale, FileSpreadsheet } from 'lucide-react';
import ArticleManager from './ArticleManager';
import EditArticleModal from './EditArticleModal';
import LubricantDeliveryModal from './LubricantDeliveryModal';
import { supabase } from '../lib/supabase';
import { Modal } from './ui/Modal';
import { DateInput } from './ui/DateInput';
import PasswordConfirmationModal from './ui/PasswordConfirmationModal';
import { getArticleWeightInKg } from '../utils/formatters';

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
    const [exporting, setExporting] = useState(false);

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
    const totalLubricantWeight = stockData.reduce((sum, item) => {
        const cleanCat = (item.category || '').toLowerCase();
        const cleanName = (item.name || '').toLowerCase();
        if (cleanCat.includes('lubrif') || cleanName.includes('huile')) {
            const w = getArticleWeightInKg(item.name, item.category, item.current_stock || 0);
            return sum + (w || 0);
        }
        return sum;
    }, 0);
    const totalLubricantVolume = stockData.reduce((sum, item) => {
        const cleanCat = (item.category || '').toLowerCase();
        const cleanName = (item.name || '').toLowerCase();
        const isLubricant = cleanCat.includes('lubrif') || cleanName.includes('huile') || cleanName.includes('graisse');
        if (isLubricant) {
            const qty = Number(item.current_stock) || 0;
            let liters = 0;
            const isDrum205Or180 = cleanName.includes('205') || cleanName.includes('180');
            const kgMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*kg/);
            
            if (isDrum205Or180 && !kgMatch) {
                liters = qty;
            } else if (kgMatch) {
                const capacity = parseFloat(kgMatch[1]);
                liters = capacity * qty;
            } else {
                let volumeLiters = null;
                const mlMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*ml/);
                if (mlMatch) {
                    volumeLiters = parseFloat(mlMatch[1]) / 1000;
                } else {
                    const lMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*l/);
                    if (lMatch) volumeLiters = parseFloat(lMatch[1]);
                }
                if (volumeLiters === null) {
                    volumeLiters = 1.0;
                }
                liters = volumeLiters * qty;
            }
            return sum + liters;
        }
        return sum;
    }, 0);

    const exportStockToExcel = async () => {
        setExporting(true);
        try {
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Suivi CA App';
            workbook.created = new Date();

            const sheet = workbook.addWorksheet('État de Stock', { views: [{ showGridLines: true }] });

            // --- STYLING CONSTANTS ---
            const fontMain = { name: 'Segoe UI', size: 10 };
            const fontBold = { name: 'Segoe UI', size: 10, bold: true };
            const borderThin = { style: 'thin', color: { argb: 'FFE5E7EB' } }; // Gray-200
            
            const cellBorder = {
                top: borderThin,
                left: borderThin,
                bottom: borderThin,
                right: borderThin
            };

            // Title
            sheet.mergeCells('A2:G2');
            const titleCell = sheet.getCell('A2');
            titleCell.value = `État de Stock Réel - Le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
            titleCell.style = {
                font: { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF1F2937' } },
                alignment: { horizontal: 'left', vertical: 'middle' }
            };
            sheet.getRow(2).height = 25;

            // Helper to style all cells of a merged card
            const styleCard = (startCell, endCell, label, valueText, colorFill) => {
                sheet.mergeCells(`${startCell}:${endCell}`);
                const cell = sheet.getCell(startCell);
                cell.value = {
                    richText: [
                        { text: `${label}\n`, font: { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF9CA3AF' } } },
                        { text: valueText, font: { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF111827' } } }
                    ]
                };
                cell.style = {
                    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }
                };

                // Apply borders & background color to all merged cells in range
                const startRow = parseInt(startCell.match(/\d+/)[0]);
                const startCol = startCell.charCodeAt(0) - 64;
                const endRow = parseInt(endCell.match(/\d+/)[0]);
                const endCol = endCell.charCodeAt(0) - 64;

                for (let r = startRow; r <= endRow; r++) {
                    for (let c = startCol; c <= endCol; c++) {
                        const targetCell = sheet.getCell(r, c);
                        targetCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorFill } };
                        targetCell.border = cellBorder;
                    }
                }
            };

            // Add the 3 Summary KPI Cards aligned across 7 columns
            styleCard('A4', 'B5', 'VALEUR TOTALE DU STOCK', `${totalValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH`, 'FFF0FDF4');
            styleCard('C4', 'D5', 'POIDS TOTAL LUBRIFIANTS', `${totalLubricantWeight.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg`, 'FFF5F3FF');
            styleCard('E4', 'G5', 'VOLUME TOTAL LUBRIFIANTS', `${totalLubricantVolume.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} L`, 'FFF0FDFA');

            // Add blank space
            sheet.getRow(6).height = 15;

            // Table Headers
            const headers = [
                'Article',
                'Catégorie',
                'Statut Stock',
                'Quantité en Stock',
                'Poids (kg)',
                'Prix Unitaire',
                'Valeur Stock'
            ];

            const headerRowNumber = 7;
            const headerRow = sheet.getRow(headerRowNumber);
            headerRow.height = 25;
            
            headers.forEach((h, colIdx) => {
                const cell = headerRow.getCell(colIdx + 1);
                cell.value = h;
                cell.style = {
                    font: { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
                    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }, // Gray 900
                    alignment: { 
                        horizontal: colIdx >= 3 && colIdx !== 4 && colIdx !== 2 ? 'right' : colIdx === 2 ? 'center' : 'left',
                        vertical: 'middle' 
                    },
                    border: cellBorder
                };
            });

            // Populate rows
            let currentOffset = 8;
            filteredStock.forEach((item, index) => {
                const row = sheet.getRow(currentOffset);
                row.height = 22;

                const stock = item.current_stock || 0;
                let label = 'Ok';
                let statusFill = 'D1FAE5'; // Emerald 100
                let statusText = '065F46'; // Emerald 800

                if (stock === 0 || stock <= 5) {
                    label = stock === 0 ? 'Rupture' : 'Critique';
                    statusFill = 'FEE2E2'; // Red 100
                    statusText = '991B1B'; // Red 800
                } else if (stock <= 15) {
                    label = 'Bas';
                    statusFill = 'FEF3C7'; // Amber 100
                    statusText = '92400E'; // Amber 800
                }

                const weight = getArticleWeightInKg(item.name, item.category, stock);

                // Values
                row.getCell(1).value = item.name;
                row.getCell(2).value = item.category || '-';
                row.getCell(3).value = label.toUpperCase();
                row.getCell(4).value = stock;
                row.getCell(5).value = weight !== null ? weight : '-';
                row.getCell(6).value = item.price;
                row.getCell(7).value = stock * item.price;

                // Fonts and alignments
                row.getCell(1).font = fontBold;
                row.getCell(2).font = fontMain;
                row.getCell(3).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: statusText } };
                row.getCell(4).font = fontBold;
                row.getCell(5).font = fontMain;
                row.getCell(6).font = fontMain;
                row.getCell(7).font = fontBold;

                // Alignment
                row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
                row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
                row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
                row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
                row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
                row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };

                // Borders
                for (let i = 1; i <= 7; i++) {
                    row.getCell(i).border = cellBorder;
                }

                // Zebra background or status background
                const rowBg = index % 2 === 0 ? 'FFFBFBFC' : 'FFFFFFFF';
                for (let i = 1; i <= 7; i++) {
                    if (i === 3) {
                        row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusFill } };
                    } else {
                        row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
                    }
                }

                // Number formatting
                row.getCell(4).numFmt = '#,##0';
                row.getCell(5).numFmt = weight !== null ? '#,##0.0' : '@';
                row.getCell(6).numFmt = '#,##0.00" DH"';
                row.getCell(7).numFmt = '#,##0.00" DH"';

                currentOffset++;
            });

            // Adjust Column Widths
            const colWidths = [35, 20, 15, 18, 15, 18, 18];
            colWidths.forEach((w, i) => {
                sheet.getColumn(i + 1).width = w;
            });

            // Generate blob & download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Stock_SuiviCaisse_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error exporting stock to Excel:', error);
        } finally {
            setExporting(false);
        }
    };

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
                    {/* Stat Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                        {/* Valeur Totale */}
                        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between group">
                            <div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Valeur Totale du Stock</span>
                                <span className="font-extrabold text-2xl text-gray-900 font-mono">{totalValue.toLocaleString()} <span className="text-xs font-medium text-gray-400">DH</span></span>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
                                <DollarSign size={22} />
                            </div>
                        </div>

                        {/* Poids Lubrifiants */}
                        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between group">
                            <div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Poids Total Lubrifiants</span>
                                <span className="font-extrabold text-2xl text-indigo-600 font-mono">{totalLubricantWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs font-medium text-gray-400">kg</span></span>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
                                <Scale size={22} />
                            </div>
                        </div>

                        {/* Volume Lubrifiants */}
                        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between group">
                            <div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Volume Total Lubrifiants</span>
                                <span className="font-extrabold text-2xl text-teal-600 font-mono">{totalLubricantVolume.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs font-medium text-gray-400">L</span></span>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
                                <Droplet size={22} />
                            </div>
                        </div>
                    </div>

                    {/* Actions & Filters Row */}
                    <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-6">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Rechercher un article..."
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all duration-200 hover:border-gray-300 font-medium"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={exportStockToExcel}
                                disabled={exporting}
                                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl shadow-sm hover:-translate-y-0.5 active:scale-95 transition-all duration-200 font-semibold text-sm"
                            >
                                {exporting ? <Loader2 className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
                                <span>Export Excel</span>
                            </button>
                            <button
                                onClick={() => setIsLubricantDeliveryOpen(true)}
                                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl shadow-sm hover:-translate-y-0.5 active:scale-95 transition-all duration-200 font-semibold text-sm"
                            >
                                <Truck size={18} />
                                <span>Livraison Lubrifiant</span>
                            </button>
                            <button
                                onClick={() => setIsArticleManagerOpen(true)}
                                className="flex items-center justify-center gap-2 bg-gradient-purple hover:opacity-95 text-white px-4 py-2.5 rounded-xl shadow-sm hover:-translate-y-0.5 active:scale-95 transition-all duration-200 font-semibold text-sm"
                            >
                                <PackagePlus size={18} />
                                <span>Nouvel Article</span>
                            </button>
                            <button
                                onClick={() => setDeleteConfig({ isOpen: true })}
                                className="flex items-center justify-center gap-2 bg-orange-50 hover:bg-orange-100 text-orange-600 px-4 py-2.5 rounded-xl border border-orange-200 active:scale-95 transition-all duration-200 font-semibold text-sm"
                                title="Fusionner les doublons"
                            >
                                <Filter size={18} />
                                <span>Nettoyer</span>
                            </button>
                        </div>
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
                                                                <div className="text-right">
                                                                     <div className="font-mono font-bold text-gray-900 text-sm whitespace-nowrap">
                                                                         {stock}
                                                                     </div>
                                                                     {(() => {
                                                                         const weight = getArticleWeightInKg(item.name, item.category, stock);
                                                                         if (weight !== null) {
                                                                             return (
                                                                                 <div className="text-[10px] text-gray-400 font-semibold mt-0.5 whitespace-nowrap">
                                                                                     {weight.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
                                                                                 </div>
                                                                             );
                                                                         }
                                                                         return null;
                                                                     })()}
                                                                 </div>
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
