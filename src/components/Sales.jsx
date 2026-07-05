import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from './ui/Card';
import { DateInput } from './ui/DateInput';
import { Loader2, Calendar, Package, DollarSign, Droplet, Trash2, Plus, RotateCcw, Edit2, ChevronDown, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { formatPrice, formatNumber, getArticleWeightInKg } from '../utils/formatters';
import BulkFuelEntryModal from './BulkFuelEntryModal';
import PasswordConfirmationModal from './ui/PasswordConfirmationModal';
import EditSaleModal from './EditSaleModal';

export default function Sales() {
    const [activeTab, setActiveTab] = useState('sales'); // 'sales' | 'fuel'
    const [sales, setSales] = useState([]);
    const [fuelSales, setFuelSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showBulkEntryModal, setShowBulkEntryModal] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Edit Sale State
    const [editingSale, setEditingSale] = useState(null);
    const [expandedMonths, setExpandedMonths] = useState({});
    const [visibleSalesPerMonth, setVisibleSalesPerMonth] = useState({});

    // Delete Confirmation State
    const [deleteConfig, setDeleteConfig] = useState({ isOpen: false, id: null });

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [category, setCategory] = useState('');

    const toggleMonth = (month) => {
        setExpandedMonths(prev => {
            // If it's already defined, toggle it.
            // If undefined, it means we need to check the default (current month).
            // But since we want to toggle, we should calculate the current state first, then flip it.

            const currentMonthKey = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            const isCurrentlyExpanded = prev[month] !== undefined ? prev[month] : month === currentMonthKey;

            return {
                ...prev,
                [month]: !isCurrentlyExpanded
            };
        });
    };

    useEffect(() => {
        if (activeTab === 'sales') {
            fetchSales();
        } else {
            fetchFuelSales();
        }
    }, [startDate, endDate, searchTerm, category, activeTab]);

    const fetchSales = async () => {
        setLoading(true);
        try {
            let allData = [];
            let page = 0;
            const pageSize = 1000;
            while (true) {
                let query = supabase
                    .from('sales')
                    .select(`
                        *,
                        articles!inner (
                            name,
                            category
                        )
                    `)
                    .order('sale_date', { ascending: false });

                if (startDate) {
                    query = query.gte('sale_date', startDate);
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    query = query.lte('sale_date', end.toISOString());
                }
                if (category) {
                    query = query.eq('articles.category', category);
                }
                if (searchTerm) {
                    query = query.ilike('articles.name', `%${searchTerm}%`);
                }

                query = query.range(page * pageSize, (page + 1) * pageSize - 1);

                const { data, error } = await query;

                if (error) throw error;
                if (!data || data.length === 0) break;
                allData.push(...data);
                if (data.length < pageSize) break;
                page++;
            }
            setSales(allData);
        } catch (error) {
            console.error('Error fetching sales:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchFuelSales = async () => {
        setLoading(true);
        try {
            let allData = [];
            let page = 0;
            const pageSize = 1000;
            while (true) {
                let query = supabase
                    .from('fuel_sales')
                    .select('*')
                    .order('sale_date', { ascending: false });

                if (startDate) {
                    query = query.gte('sale_date', startDate);
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    query = query.lte('sale_date', end.toISOString());
                }

                query = query.range(page * pageSize, (page + 1) * pageSize - 1);

                const { data, error } = await query;

                if (error) throw error;
                if (!data || data.length === 0) break;
                allData.push(...data);
                if (data.length < pageSize) break;
                page++;
            }
            setFuelSales(allData);
        } catch (error) {
            console.error('Error fetching fuel sales:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteFuelSale = (id) => {
        setDeleteConfig({ isOpen: true, id });
    };

    const confirmDeleteFuelSale = async () => {
        const id = deleteConfig.id;
        if (!id) return;

        try {
            const { error } = await supabase
                .from('fuel_sales')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchFuelSales();
        } catch (error) {
            console.error('Error deleting fuel sale:', error);
            alert('Erreur lors de la suppression');
        } finally {
            setDeleteConfig({ isOpen: false, id: null });
        }
    };

    const resetFilters = () => {
        setStartDate('');
        setEndDate('');
        setSearchTerm('');
        setCategory('');
    };

    // Helper to group sales by Month Year
    const groupSalesByMonth = (salesData) => {
        const groups = {};
        salesData.forEach(sale => {
            const date = new Date(sale.sale_date);
            const key = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(sale);
        });
        return groups;
    };

    const salesByMonth = groupSalesByMonth(sales);

    const exportSalesToExcel = async () => {
        setExporting(true);
        try {
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Suivi CA App';
            workbook.created = new Date();

            const sheet = workbook.addWorksheet('Ventes Boutique & Services', { views: [{ showGridLines: true }] });

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

            // Calculate summaries for current selection
            let totalSalesVal = 0;
            let totalSalesLubWeight = 0;
            let totalSalesLubVolume = 0;

            sales.forEach(sale => {
                totalSalesVal += (sale.total_price || 0);

                const cleanCat = (sale.articles?.category || '').toLowerCase();
                const cleanName = (sale.articles?.name || '').toLowerCase();
                const isLubricant = cleanCat.includes('lubrif') || cleanName.includes('huile') || cleanName.includes('graisse');

                if (isLubricant) {
                    const w = getArticleWeightInKg(sale.articles?.name, sale.articles?.category, sale.quantity || 0);
                    if (w !== null) {
                        totalSalesLubWeight += w;
                    }

                    // Volume
                    const qty = Number(sale.quantity) || 0;
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
                    totalSalesLubVolume += liters;
                }
            });

            // Title
            sheet.mergeCells('A2:H2');
            const titleCell = sheet.getCell('A2');
            const periodStr = startDate && endDate 
                ? `du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}` 
                : 'toutes périodes';
            titleCell.value = `Détails des Ventes Lubrifiants, Boutique & Services - Période : ${periodStr}`;
            titleCell.style = {
                font: { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1F2937' } },
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

            // Add the 3 Summary KPI Cards aligned across 8 columns
            styleCard('A4', 'C5', "CHIFFRE D'AFFAIRES TOTAL", `${totalSalesVal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH`, 'FFF0FDF4');
            styleCard('D4', 'E5', 'POIDS LUBRIFIANTS VENDUS', `${totalSalesLubWeight.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg`, 'FFF5F3FF');
            styleCard('F4', 'H5', 'VOLUME LUBRIFIANTS VENDUS', `${totalSalesLubVolume.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} L`, 'FFF0FDFA');

            // Add blank space
            sheet.getRow(6).height = 15;

            // Table Headers
            const headers = [
                'Date & Heure',
                'Article',
                'Catégorie',
                'Emplacement',
                'Quantité',
                'Poids (kg)',
                'Prix Unitaire',
                'Total Vente'
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
                        horizontal: colIdx >= 4 && colIdx !== 5 ? 'right' : colIdx === 3 ? 'center' : 'left',
                        vertical: 'middle' 
                    },
                    border: cellBorder
                };
            });

            // Populate rows
            let currentOffset = 8;
            sales.forEach((sale, index) => {
                const row = sheet.getRow(currentOffset);
                row.height = 22;

                const qty = sale.quantity || 0;
                const weight = getArticleWeightInKg(sale.articles?.name, sale.articles?.category, qty);
                const unitPrice = qty > 0 ? (sale.total_price / qty) : 0;

                // Values
                row.getCell(1).value = new Date(sale.sale_date).toLocaleString('fr-FR');
                row.getCell(2).value = sale.articles?.name || 'Article inconnu';
                row.getCell(3).value = sale.articles?.category || '-';
                row.getCell(4).value = sale.sales_location ? (sale.sales_location === 'piste' ? 'PISTE' : 'BOSCH') : '-';
                row.getCell(5).value = qty;
                row.getCell(6).value = weight !== null ? weight : '-';
                row.getCell(7).value = unitPrice;
                row.getCell(8).value = sale.total_price || 0;

                // Fonts and alignments
                row.getCell(1).font = fontMain;
                row.getCell(2).font = fontBold;
                row.getCell(3).font = fontMain;
                row.getCell(4).font = fontMain;
                row.getCell(5).font = fontBold;
                row.getCell(6).font = fontMain;
                row.getCell(7).font = fontMain;
                row.getCell(8).font = fontBold;

                // Alignment
                row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
                row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
                row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
                row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
                row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
                row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
                row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };

                // Borders
                for (let i = 1; i <= 8; i++) {
                    row.getCell(i).border = cellBorder;
                }

                // Zebra background
                const rowBg = index % 2 === 0 ? 'FFFBFBFC' : 'FFFFFFFF';
                for (let i = 1; i <= 8; i++) {
                    row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
                }

                // Number formatting
                row.getCell(5).numFmt = '#,##0';
                row.getCell(6).numFmt = weight !== null ? '#,##0.0' : '@';
                row.getCell(7).numFmt = '#,##0.00" DH"';
                row.getCell(8).numFmt = '#,##0.00" DH"';

                currentOffset++;
            });

            // Adjust Column Widths
            const colWidths = [22, 35, 20, 15, 12, 15, 18, 18];
            colWidths.forEach((w, i) => {
                sheet.getColumn(i + 1).width = w;
            });

            // --- SHEET 2: RÉCAPITULATIF PAR PRODUIT ---
            const recapSheet = workbook.addWorksheet('Récapitulatif par Produit', { views: [{ showGridLines: true }] });

            // Title for Sheet 2
            recapSheet.mergeCells('A2:H2');
            const recapTitleCell = recapSheet.getCell('A2');
            recapTitleCell.value = `Récapitulatif des Ventes par Produit - Période : ${periodStr}`;
            recapTitleCell.style = {
                font: { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1F2937' } },
                alignment: { horizontal: 'left', vertical: 'middle' }
            };
            recapSheet.getRow(2).height = 25;

            // Helper to style all cells of a merged card on recap sheet
            const styleRecapCard = (startCell, endCell, label, valueText, colorFill) => {
                recapSheet.mergeCells(`${startCell}:${endCell}`);
                const cell = recapSheet.getCell(startCell);
                cell.value = {
                    richText: [
                        { text: `${label}\n`, font: { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF9CA3AF' } } },
                        { text: valueText, font: { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF111827' } } }
                    ]
                };
                cell.style = {
                    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }
                };

                const startRow = parseInt(startCell.match(/\d+/)[0]);
                const startCol = startCell.charCodeAt(0) - 64;
                const endRow = parseInt(endCell.match(/\d+/)[0]);
                const endCol = endCell.charCodeAt(0) - 64;

                for (let r = startRow; r <= endRow; r++) {
                    for (let c = startCol; c <= endCol; c++) {
                        const targetCell = recapSheet.getCell(r, c);
                        targetCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorFill } };
                        targetCell.border = cellBorder;
                    }
                }
            };

            // Add KPI cards to Sheet 2
            styleRecapCard('A4', 'C5', "CHIFFRE D'AFFAIRES TOTAL", `${totalSalesVal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH`, 'FFF0FDF4');
            styleRecapCard('D4', 'E5', 'POIDS LUBRIFIANTS VENDUS', `${totalSalesLubWeight.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg`, 'FFF5F3FF');
            styleRecapCard('F4', 'H5', 'VOLUME LUBRIFIANTS VENDUS', `${totalSalesLubVolume.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} L`, 'FFF0FDFA');

            recapSheet.getRow(6).height = 15;

            // Sheet 2 Headers
            const recapHeaders = [
                'Rang',
                'Article',
                'Catégorie',
                'Quantité Vendue',
                'Poids Total (kg)',
                'Volume Total (L)',
                'Chiffre d\'Affaires',
                'Part du C.A. (%)'
            ];

            const recapHeaderRow = recapSheet.getRow(7);
            recapHeaderRow.height = 25;
            
            recapHeaders.forEach((h, colIdx) => {
                const cell = recapHeaderRow.getCell(colIdx + 1);
                cell.value = h;
                cell.style = {
                    font: { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
                    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }, // Gray 900
                    alignment: { 
                        horizontal: colIdx >= 3 ? 'right' : colIdx === 0 ? 'center' : 'left',
                        vertical: 'middle' 
                    },
                    border: cellBorder
                };
            });

            // Group sales by product name
            const productRecapMap = {};
            sales.forEach(sale => {
                const name = sale.articles?.name || 'Article inconnu';
                const cat = sale.articles?.category || '-';
                
                if (!productRecapMap[name]) {
                    productRecapMap[name] = {
                        name,
                        category: cat,
                        quantity: 0,
                        totalPrice: 0,
                        weight: 0,
                        volume: 0
                    };
                }
                
                const qty = sale.quantity || 0;
                productRecapMap[name].quantity += qty;
                productRecapMap[name].totalPrice += (sale.total_price || 0);

                const cleanCat = cat.toLowerCase();
                const cleanName = name.toLowerCase();
                const isLubricant = cleanCat.includes('lubrif') || cleanName.includes('huile') || cleanName.includes('graisse');

                if (isLubricant) {
                    const w = getArticleWeightInKg(name, cat, qty);
                    if (w !== null) {
                        productRecapMap[name].weight += w;
                    }

                    // Volume
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
                    productRecapMap[name].volume += liters;
                }
            });

            const productRecapList = Object.values(productRecapMap).sort((a, b) => b.totalPrice - a.totalPrice);

            // Populate Sheet 2 Rows
            let recapOffset = 8;
            productRecapList.forEach((item, index) => {
                const row = recapSheet.getRow(recapOffset);
                row.height = 22;

                const hasWeight = item.weight > 0;
                const hasVolume = item.volume > 0;
                const caShare = totalSalesVal > 0 ? (item.totalPrice / totalSalesVal) : 0;

                row.getCell(1).value = index + 1;
                row.getCell(2).value = item.name;
                row.getCell(3).value = item.category;
                row.getCell(4).value = item.quantity;
                row.getCell(5).value = hasWeight ? item.weight : '-';
                row.getCell(6).value = hasVolume ? item.volume : '-';
                row.getCell(7).value = item.totalPrice;
                row.getCell(8).value = caShare;

                // Font & styling
                row.getCell(1).font = fontMain;
                row.getCell(2).font = fontBold;
                row.getCell(3).font = fontMain;
                row.getCell(4).font = fontBold;
                row.getCell(5).font = fontMain;
                row.getCell(6).font = fontMain;
                row.getCell(7).font = fontBold;
                row.getCell(8).font = fontMain;

                // Alignments
                row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
                row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
                row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
                row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
                row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
                row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
                row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };

                // Borders
                for (let i = 1; i <= 8; i++) {
                    row.getCell(i).border = cellBorder;
                }

                // Zebra Striping
                const rowBg = index % 2 === 0 ? 'FFFBFBFC' : 'FFFFFFFF';
                for (let i = 1; i <= 8; i++) {
                    row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
                }

                // Number Formatting
                row.getCell(1).numFmt = '#,##0';
                row.getCell(4).numFmt = '#,##0';
                row.getCell(5).numFmt = hasWeight ? '#,##0.0' : '@';
                row.getCell(6).numFmt = hasVolume ? '#,##0.0' : '@';
                row.getCell(7).numFmt = '#,##0.00" DH"';
                row.getCell(8).numFmt = '0.0%';

                recapOffset++;
            });

            // Adjust Column Widths for Sheet 2
            const recapColWidths = [8, 35, 20, 18, 18, 18, 20, 15];
            recapColWidths.forEach((w, i) => {
                recapSheet.getColumn(i + 1).width = w;
            });

            // Generate blob & download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `detaille_des_ventes_lubrifiants_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error exporting sales to Excel:', error);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-text-main">Historique des Ventes</h2>
                <div className="flex items-center gap-2">
                    {activeTab === 'sales' && (
                        <button
                            onClick={exportSalesToExcel}
                            disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium shadow-sm hover:-translate-y-0.5 active:scale-95 transition-all"
                        >
                            {exporting ? <Loader2 className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />}
                            <span>Export Excel</span>
                        </button>
                    )}
                    <button
                        onClick={resetFilters}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 shadow-sm rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-all"
                    >
                        <RotateCcw size={16} />
                        Réinitialiser les filtres
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-border w-fit">
                <button
                    onClick={() => setActiveTab('sales')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium transition-all ${activeTab === 'sales'
                        ? 'bg-gradient-dark text-white shadow-md'
                        : 'text-text-muted hover:text-text-main hover:bg-gray-50'
                        }`}
                >
                    <Package size={16} />
                    Boutique & Services
                </button>
                <button
                    onClick={() => setActiveTab('fuel')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium transition-all ${activeTab === 'fuel'
                        ? 'bg-gradient-dark text-white shadow-md'
                        : 'text-text-muted hover:text-text-main hover:bg-gray-50'
                        }`}
                >
                    <Droplet size={16} />
                    Carburant (Volume)
                </button>
            </div>

            {activeTab === 'fuel' && (
                <div className="flex justify-end">
                    <button
                        onClick={() => setShowBulkEntryModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 text-sm font-medium"
                    >
                        <Plus size={16} />
                        Saisie Historique
                    </button>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    {activeTab === 'sales' && (
                        <>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Rechercher</label>
                                <input
                                    type="text"
                                    placeholder="Nom de l'article..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-300"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Catégorie</label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all appearance-none"
                                >
                                    <option value="">Toutes</option>
                                    <option value="Shop">Shop</option>
                                    <option value="Café">Café</option>
                                    <option value="Bosch Service">Bosch Service</option>
                                    <option value="Pneumatique">Pneumatique</option>
                                    <option value="Lubrifiants">Lubrifiants</option>
                                </select>
                            </div>
                        </>
                    )}
                    <div>
                        <DateInput
                            label="Date début"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <DateInput
                            label="Date fin"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Sales List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                        <Loader2 className="animate-spin text-gray-300 mx-auto" size={24} />
                    </div>
                ) : activeTab === 'sales' ? (
                    sales.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-gray-400 font-medium">
                            Aucune vente trouvée
                        </div>
                    ) : (
                        Object.entries(salesByMonth).map(([month, monthSales]) => {
                            const currentMonthKey = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                            const isExpanded = expandedMonths[month] !== undefined
                                ? expandedMonths[month]
                                : month === currentMonthKey;

                            return (
                                <div key={month} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                    {/* Month Header */}
                                    <div
                                        className="bg-gray-50 border-b border-gray-100 p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors select-none"
                                        onClick={() => toggleMonth(month)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`transition-transform duration-200 text-gray-400 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}>
                                                <div className="bg-white p-1 rounded-full border border-gray-200 shadow-sm text-gray-500">
                                                    <ChevronRight size={14} />
                                                </div>
                                            </div>
                                            <span className="font-bold text-xs uppercase tracking-wider text-gray-700">
                                                {month}
                                            </span>
                                        </div>
                                        <span className="text-xs font-semibold text-gray-400 bg-white px-2.5 py-1 rounded-full border border-gray-100">
                                            {monthSales.length} ventes
                                        </span>
                                    </div>

                                    {/* Month Table */}
                                    {isExpanded && (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-white text-gray-400 font-bold text-[10px] uppercase tracking-wider border-b border-gray-100">
                                                        <th className="py-3 px-6">Date</th>
                                                        <th className="py-3 px-6">Article</th>
                                                        <th className="py-3 px-6">Catégorie</th>
                                                        <th className="py-3 px-6 text-center">Quantité</th>
                                                        <th className="py-3 px-6 text-right">Total</th>
                                                        <th className="py-3 px-6 text-center">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {monthSales.slice(0, visibleSalesPerMonth[month] || 30).map((sale) => (
                                                        <tr key={sale.id} className="group hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0">
                                                            <td className="py-4 px-6 text-xs font-bold text-gray-400 font-mono whitespace-nowrap">
                                                                {new Date(sale.sale_date).toLocaleString('fr-FR')}
                                                            </td>
                                                            <td className="py-4 px-6">
                                                                <span className="text-sm font-bold text-gray-800 block">
                                                                    {sale.articles?.name || 'Article inconnu'}
                                                                </span>
                                                            </td>
                                                            <td className="py-4 px-6">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-medium text-gray-500">{sale.articles?.category}</span>
                                                                    {sale.sales_location && (
                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${sale.sales_location === 'piste' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                                            {sale.sales_location === 'piste' ? 'Piste' : 'Bosch'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                             <td className="py-4 px-6 text-center">
                                                                 <div className="font-bold text-gray-900 text-sm">
                                                                     {sale.quantity}
                                                                 </div>
                                                                 {(() => {
                                                                     const w = getArticleWeightInKg(sale.articles?.name, sale.articles?.category, sale.quantity);
                                                                     if (w !== null) {
                                                                         return (
                                                                             <div className="text-[10px] text-gray-400 font-semibold mt-0.5 whitespace-nowrap">
                                                                                 {w.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
                                                                             </div>
                                                                         );
                                                                     }
                                                                     return null;
                                                                 })()}
                                                             </td>
                                                            <td className="py-4 px-6 text-right">
                                                                <span className="font-mono font-bold text-gray-900 text-sm">
                                                                    {formatPrice(sale.total_price)}
                                                                </span>
                                                            </td>
                                                            <td className="py-4 px-6 text-center">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingSale(sale);
                                                                    }}
                                                                    className="text-gray-400 hover:text-indigo-600 transition-colors"
                                                                    title="Modifier"
                                                                >
                                                                    <Edit2 size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {monthSales.length > (visibleSalesPerMonth[month] || 30) && (
                                                        <tr>
                                                            <td colSpan="6" className="py-3 text-center bg-slate-50/40">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setVisibleSalesPerMonth(prev => ({
                                                                            ...prev,
                                                                            [month]: (prev[month] || 30) + 50
                                                                        }));
                                                                    }}
                                                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 focus:outline-none"
                                                                >
                                                                    Afficher les ventes plus anciennes (+50)
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )
                ) : (
                    fuelSales.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-gray-400 font-medium">
                            Aucune vente carburant trouvée
                        </div>
                    ) : (
                        Object.entries(groupSalesByMonth(fuelSales)).map(([month, monthSales]) => {
                            const currentMonthKey = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                            const isExpanded = expandedMonths[month] !== undefined
                                ? expandedMonths[month]
                                : month === currentMonthKey;

                            return (
                                <div key={month} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                    {/* Month Header */}
                                    <div
                                        className="bg-gray-50 border-b border-gray-100 p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors select-none"
                                        onClick={() => toggleMonth(month)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`transition-transform duration-200 text-gray-400 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}>
                                                <div className="bg-white p-1 rounded-full border border-gray-200 shadow-sm text-gray-500">
                                                    <ChevronRight size={14} />
                                                </div>
                                            </div>
                                            <span className="font-bold text-xs uppercase tracking-wider text-gray-700">
                                                {month}
                                            </span>
                                        </div>
                                        <span className="text-xs font-semibold text-gray-400 bg-white px-2.5 py-1 rounded-full border border-gray-100">
                                            {monthSales.length} entrées
                                        </span>
                                    </div>

                                    {/* Month Table */}
                                    {isExpanded && (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-white text-gray-400 font-bold text-[10px] uppercase tracking-wider border-b border-gray-50">
                                                        <th className="py-3 px-6">Date</th>
                                                        <th className="py-3 px-6">Type Carburant</th>
                                                        <th className="py-3 px-6 text-right">Volume (L)</th>
                                                        <th className="py-3 px-6 text-right">Volume (m³)</th>
                                                        <th className="py-3 px-6 text-center">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {monthSales.slice(0, visibleSalesPerMonth[month] || 30).map((sale) => (
                                                        <tr key={sale.id} className="group hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0">
                                                            <td className="py-4 px-6 text-xs font-bold text-gray-400 font-mono">
                                                                {new Date(sale.sale_date).toLocaleDateString('fr-FR')}
                                                            </td>
                                                            <td className="py-4 px-6 font-medium">
                                                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${sale.fuel_type === 'Gasoil' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                                                    {sale.fuel_type}
                                                                </span>
                                                            </td>
                                                            <td className="py-4 px-6 text-right font-mono text-sm font-bold text-gray-700">
                                                                {formatNumber(Number(sale.quantity_liters))} L
                                                            </td>
                                                            <td className="py-4 px-6 text-right font-mono text-sm text-gray-500">
                                                                {formatNumber(Number(sale.quantity_liters) / 1000, 3)} m³
                                                            </td>
                                                            <td className="py-4 px-6 text-center">
                                                                <button
                                                                    onClick={() => handleDeleteFuelSale(sale.id)}
                                                                    className="text-gray-300 hover:text-red-500 transition-colors"
                                                                    title="Supprimer"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {monthSales.length > (visibleSalesPerMonth[month] || 30) && (
                                                        <tr>
                                                            <td colSpan="5" className="py-3 text-center bg-slate-50/40">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setVisibleSalesPerMonth(prev => ({
                                                                            ...prev,
                                                                            [month]: (prev[month] || 30) + 50
                                                                        }));
                                                                    }}
                                                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 focus:outline-none"
                                                                >
                                                                    Afficher les ventes plus anciennes (+50)
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )
                )}
            </div>

            <BulkFuelEntryModal
                isOpen={showBulkEntryModal}
                onClose={() => setShowBulkEntryModal(false)}
                onSuccess={fetchFuelSales}
            />

            <EditSaleModal
                isOpen={!!editingSale}
                onClose={() => setEditingSale(null)}
                sale={editingSale}
                onSuccess={fetchSales}
            />

            <PasswordConfirmationModal
                isOpen={deleteConfig.isOpen}
                onClose={() => setDeleteConfig({ isOpen: false, id: null })}
                onConfirm={confirmDeleteFuelSale}
                title="Supprimer la vente carburant ?"
                message="Êtes-vous sûr de vouloir supprimer cette vente ? Cette action est irréversible."
            />
        </div>
    );
}
