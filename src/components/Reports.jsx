import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from './ui/Card';
import { FileDown, FileJson, FileSpreadsheet, FileText, Loader2, RefreshCw, ChevronDown, BarChart3, FilterX } from 'lucide-react';
import { DateInput } from './ui/DateInput';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { fetchComparisonStats } from '../utils/statisticsUtils';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export default function Reports() {
    const [salesData, setSalesData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    // Filters for General Sales Report (Data Preview & Simple Exports)
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [category, setCategory] = useState('');

    // Filters for Comparison Report
    const [cmpYear, setCmpYear] = useState(new Date().getFullYear());
    const [cmpStartMonth, setCmpStartMonth] = useState(0); // Jan
    const [cmpEndMonth, setCmpEndMonth] = useState(new Date().getMonth()); // Current Month

    useEffect(() => {
        fetchSalesData();
    }, [startDate, endDate, searchTerm, category]);

    const fetchSalesData = async () => {
        setLoading(true);
        try {
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
                // Set to end of day
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query = query.lte('sale_date', end.toISOString());
            }
            if (category) {
                if (category === 'Lubrifiants Piste') {
                    query = query.eq('articles.category', 'Lubrifiants').eq('sales_location', 'piste');
                } else if (category === 'Lubrifiants Bosch') {
                    query = query.eq('articles.category', 'Lubrifiants').eq('sales_location', 'bosch');
                } else {
                    query = query.eq('articles.category', category);
                }
            }
            if (searchTerm) {
                query = query.ilike('articles.name', `%${searchTerm}%`);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Calculate daily totals
            const dailyTotals = data.reduce((acc, sale) => {
                const date = new Date(sale.sale_date).toLocaleDateString('fr-FR');
                acc[date] = (acc[date] || 0) + sale.total_price;
                return acc;
            }, {});

            const formattedData = data.map(sale => {
                const date = new Date(sale.sale_date).toLocaleDateString('fr-FR');
                return {
                    date: date,
                    article: sale.articles?.name || 'Article inconnu',
                    category: sale.articles?.category || '-',
                    location: sale.sales_location === 'piste' ? 'Piste' : (sale.sales_location === 'bosch' ? 'Bosch' : '-'),
                    quantity: sale.quantity,
                    total: sale.total_price,
                    dailyTotal: dailyTotals[date]
                };
            });

            setSalesData(formattedData);
        } catch (error) {
            console.error('Error fetching sales for reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveAndShareFile = async (fileName, base64Data, mimeType) => {
        try {
            const savedFile = await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Cache,
            });

            await Share.share({
                title: 'Export Suivi CA',
                text: `Voici le fichier ${fileName}`,
                url: savedFile.uri,
                dialogTitle: 'Partager le rapport',
            });
        } catch (error) {
            console.error('Error sharing file:', error);
            alert(`Erreur lors du partage: ${error.message}`);
        }
    };

    const exportComparisonReport = async () => {
        setExporting(true);
        try {
            // Lazy load ExcelJS to avoid bundle impact if not used
            const ExcelJS = (await import('exceljs')).default;
            const result = await fetchComparisonStats('custom', cmpYear, 0, cmpStartMonth, cmpEndMonth);

            // Helper functions for formatting (if needed for comparison text)
            const formatNumber = (num) => new Intl.NumberFormat('fr-FR').format(num);
            const formatPrice = (num) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD' }).format(num);

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Suivi CA App';
            workbook.created = new Date();

            // --- STYLING CONSTANTS (Modern UI) ---
            const modernFont = { name: 'Segoe UI', size: 11 };
            const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }; // Gray-900
            const headerFont = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
            const borderStyle = { style: 'thin', color: { argb: 'FFE5E7EB' } }; // Gray-200

            const baseCellStyle = {
                font: modernFont,
                border: { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle },
                alignment: { vertical: 'middle' }
            };

            const currencyFormat = '#,##0.00 "MAD"';
            const numberFormat = '#,##0.00 "L"';

            const applyHeaderStyle = (sheet) => {
                sheet.getRow(1).height = 30;
                sheet.getRow(1).eachCell((cell) => {
                    cell.style = { ...baseCellStyle, font: headerFont, fill: headerFill, alignment: { horizontal: 'center', vertical: 'middle' } };
                });
            };

            const applyZebraStriping = (sheet, row, index) => {
                if (index % 2 === 0) {
                    row.eachCell((cell) => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }; // Gray-50
                    });
                }
            };

            // --- SHEET 1: TABLEAU DE BORD (SUMMARY) ---
            const summarySheet = workbook.addWorksheet('Tableau de Bord', { views: [{ showGridLines: false }] });

            // Title
            summarySheet.mergeCells('B2:E2');
            const titleCell = summarySheet.getCell('B2');
            titleCell.value = `Rapport d'Activité : ${MONTHS[cmpStartMonth]} - ${MONTHS[cmpEndMonth]} ${cmpYear}`;
            titleCell.style = { font: { name: 'Segoe UI', size: 18, bold: true, color: { argb: 'FF1F2937' } }, alignment: { horizontal: 'center' } };

            // KPI Cards Layout
            const createCard = (startCell, label, valueN, valueN1, growth, color) => {
                const r = summarySheet.getCell(startCell).row;
                const c = summarySheet.getCell(startCell).col;

                // Merge for Card Box
                summarySheet.mergeCells(r, c, r + 4, c + 2);

                // Set Background & Border
                for (let i = 0; i < 5; i++) {
                    for (let j = 0; j < 3; j++) {
                        const cell = summarySheet.getCell(r + i, c + j);
                        // We need to set style individually to avoid reference sharing issues
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // White
                        if (i === 0) cell.border = { top: { style: 'medium', color: { argb: color } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
                        else if (i === 4) cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
                        else cell.border = { left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
                    }
                }

                // Label
                const labelCell = summarySheet.getCell(r, c);
                labelCell.value = label;
                labelCell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF6B7280' }, bold: true };
                labelCell.alignment = { horizontal: 'center', vertical: 'bottom' };

                // Value N
                const valCell = summarySheet.getCell(r + 1, c);
                valCell.value = valueN;
                valCell.numFmt = label.includes('Volume') ? '#,##0 "L"' : '#,##0 "MAD"';
                valCell.font = { name: 'Segoe UI', size: 18, bold: true, color: { argb: 'FF111827' } };
                valCell.alignment = { horizontal: 'center', vertical: 'middle' };

                // Growth
                const growthCell = summarySheet.getCell(r + 2, c);
                growthCell.value = `${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`;
                growthCell.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: growth >= 0 ? 'FF16A34A' : 'FFDC2626' } };
                growthCell.alignment = { horizontal: 'center', vertical: 'middle' };

                // Comparison Text
                const compCell = summarySheet.getCell(r + 3, c);
                compCell.value = `vs ${label.includes('Volume') ? formatNumber(valueN1) + ' L' : formatPrice(valueN1)}`;
                compCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF9CA3AF' } };
                compCell.alignment = { horizontal: 'center', vertical: 'top' };
            };

            createCard('B4', "Chiffre d'Affaires", result.kpis.currentTotal, result.kpis.previousTotal, result.kpis.growth, 'FF4F46E5'); // Indigo
            createCard('F4', "Volume Gasoil", result.fuelKpis.gasoil, result.fuelKpis.gasoilPrev, result.fuelKpis.gasoilGrowth, 'FFF97316'); // Orange
            createCard('J4', "Volume SSP", result.fuelKpis.ssp, result.fuelKpis.sspPrev, result.fuelKpis.sspGrowth, 'FF22C55E'); // Green


            // --- SHEET 2: DÉTAILS MENSUELS (DATA) ---
            const monthSheet = workbook.addWorksheet('Détails Mensuels');
            monthSheet.columns = [
                { header: 'Période', key: 'name', width: 20 },
                { header: `CA ${cmpYear}`, key: 'curr', width: 24 },
                { header: `CA ${cmpYear - 1}`, key: 'prev', width: 24 },
                { header: 'Évolution', key: 'evol', width: 16 },
                { header: 'Écart', key: 'diff', width: 20 }
            ];
            applyHeaderStyle(monthSheet);

            result.data.forEach((item, index) => {
                const growth = item.previous > 0 ? ((item.current - item.previous) / item.previous) : 0;
                const row = monthSheet.addRow({
                    name: item.name,
                    curr: item.current,
                    prev: item.previous,
                    evol: growth,
                    diff: item.current - item.previous
                });
                row.height = 24;

                // Apply Styles CELL BY CELL to avoid reference sharing
                row.eachCell((cell, colNumber) => {
                    cell.style = JSON.parse(JSON.stringify(baseCellStyle)); // Deep copy style

                    if (colNumber === 2 || colNumber === 3 || colNumber === 5) cell.numFmt = currencyFormat;
                    if (colNumber === 4) {
                        cell.numFmt = '0.00%';
                        cell.font = { ...modernFont, color: { argb: cell.value >= 0 ? 'FF16A34A' : 'FFDC2626' }, bold: true };
                    }
                });
                applyZebraStriping(monthSheet, row, index);
            });


            // --- SHEET 3: CATÉGORIES (CHART READY) ---
            const catSheet = workbook.addWorksheet('Par Catégorie');
            catSheet.columns = [
                { header: 'Catégorie', key: 'cat', width: 28 },
                { header: `CA ${cmpYear}`, key: 'curr', width: 24 },
                { header: `CA ${cmpYear - 1}`, key: 'prev', width: 24 },
                { header: 'Croissance', key: 'growth', width: 16 }
            ];
            applyHeaderStyle(catSheet);

            result.categoryDetails.forEach((item, index) => {
                const row = catSheet.addRow({
                    cat: item.name,
                    curr: item.current,
                    prev: item.previous,
                    growth: item.growth / 100
                });
                row.height = 24;

                row.eachCell((cell, colNumber) => {
                    cell.style = JSON.parse(JSON.stringify(baseCellStyle));

                    if (colNumber === 2 || colNumber === 3) cell.numFmt = currencyFormat;
                    if (colNumber === 4) {
                        cell.numFmt = '0.00%';
                        cell.font = { ...modernFont, color: { argb: cell.value >= 0 ? 'FF16A34A' : 'FFDC2626' }, bold: true };
                    }
                });
                applyZebraStriping(catSheet, row, index);
            });

            // --- SHEET 4: CARBURANT (DATA) ---
            const fuelSheet = workbook.addWorksheet('Carburant');
            fuelSheet.columns = [
                { header: 'Période', key: 'name', width: 20 },
                { header: `Gasoil ${cmpYear}`, key: 'g_curr', width: 22 },
                { header: `Gasoil ${cmpYear - 1}`, key: 'g_prev', width: 22 },
                { header: 'Evol. Gasoil', key: 'g_evol', width: 16 },
                { header: `SSP ${cmpYear}`, key: 's_curr', width: 22 },
                { header: `SSP ${cmpYear - 1}`, key: 's_prev', width: 22 },
                { header: 'Evol. SSP', key: 's_evol', width: 16 },
            ];
            applyHeaderStyle(fuelSheet);

            result.fuelData.forEach((item, index) => {
                const gEvol = item.gasoilPrev > 0 ? ((item.gasoil - item.gasoilPrev) / item.gasoilPrev) : 0;
                const sEvol = item.sspPrev > 0 ? ((item.ssp - item.sspPrev) / item.sspPrev) : 0;

                const row = fuelSheet.addRow({
                    name: item.name,
                    g_curr: item.gasoil,
                    g_prev: item.gasoilPrev,
                    g_evol: gEvol,
                    s_curr: item.ssp,
                    s_prev: item.sspPrev,
                    s_evol: sEvol
                });
                row.height = 24;

                row.eachCell((cell, colNumber) => {
                    cell.style = JSON.parse(JSON.stringify(baseCellStyle));

                    if ([2, 3, 5, 6].includes(colNumber)) cell.numFmt = numberFormat;
                    if ([4, 7].includes(colNumber)) {
                        cell.numFmt = '0.00%';
                        cell.font = { ...modernFont, color: { argb: cell.value >= 0 ? 'FF16A34A' : 'FFDC2626' }, bold: true };
                    }
                });
                applyZebraStriping(fuelSheet, row, index);
            });

            // Generate Buffer
            const buffer = await workbook.xlsx.writeBuffer();
            const fileName = `Rapport_Evolution_${cmpYear}_${MONTHS[cmpStartMonth]}-${MONTHS[cmpEndMonth]}.xlsx`;

            // Base64 conversion for Capacitor
            const base64Data = btoa(
                new Uint8Array(buffer)
                    .reduce((data, byte) => data + String.fromCharCode(byte), '')
            );

            if (Capacitor.isNativePlatform()) {
                await saveAndShareFile(fileName, base64Data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            } else {
                // Web Download (Blob)
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                window.URL.revokeObjectURL(url);
            }

        } catch (error) {
            console.error("Export Comparison failed", error);
            alert("Erreur lors de l'export du rapport comparatif");
        } finally {
            setExporting(false);
        }
    };

    const exportToExcel = async () => {
        if (salesData.length === 0) {
            alert("Aucune donnée à exporter.");
            return;
        }
        setExporting(true);
        try {
            const excelData = salesData.map(item => ({
                "Date": item.date,
                "Article": item.article,
                "Catégorie": item.category,
                "Emplacement": item.location,
                "Quantité": item.quantity,
                "Total (MAD)": item.total,
                "Total Journée (MAD)": item.dailyTotal
            }));

            const ws = XLSX.utils.json_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Ventes");

            if (Capacitor.isNativePlatform()) {
                const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
                await saveAndShareFile("rapport_ventes.xlsx", wbout, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            } else {
                XLSX.writeFile(wb, "rapport_ventes_complet.xlsx");
            }
        } catch (error) {
            console.error("Export Excel failed", error);
            alert("Erreur lors de l'export Excel");
        } finally {
            setExporting(false);
        }
    };

    const exportToPDF = async () => {
        if (salesData.length === 0) {
            alert("Aucune donnée à exporter.");
            return;
        }
        setExporting(true);
        try {
            const doc = new jsPDF();
            doc.text("Rapport Détaillé des Ventes", 14, 15);
            doc.setFontSize(10);
            doc.text(`Généré le: ${new Date().toLocaleString('fr-FR')}`, 14, 22);

            const tableColumn = ["Date", "Article", "Catégorie", "Lieu", "Qté", "Total", "Total Jour"];
            const tableRows = salesData.map(item => [
                item.date,
                item.article,
                item.category,
                item.location,
                item.quantity,
                item.total,
                item.dailyTotal
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 30,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [66, 66, 66] }
            });

            if (Capacitor.isNativePlatform()) {
                const pdfBase64 = doc.output('datauristring').split(',')[1];
                await saveAndShareFile("rapport_ventes.pdf", pdfBase64, 'application/pdf');
            } else {
                doc.save("rapport_ventes_complet.pdf");
            }
        } catch (error) {
            console.error("Export PDF failed", error);
            alert(`Erreur lors de l'export PDF: ${error.message}`);
        } finally {
            setExporting(false);
        }
    };

    const exportToJSON = async () => {
        if (salesData.length === 0) {
            alert("Aucune donnée à exporter.");
            return;
        }
        setExporting(true);
        try {
            const jsonString = JSON.stringify(salesData, null, 2);

            if (Capacitor.isNativePlatform()) {
                const base64Json = btoa(unescape(encodeURIComponent(jsonString)));
                await saveAndShareFile("rapport_ventes.json", base64Json, 'application/json');
            } else {
                const dataUri = `data:text/json;chatset=utf-8,${encodeURIComponent(jsonString)}`;
                const link = document.createElement("a");
                link.href = dataUri;
                link.download = "rapport_ventes_complet.json";
                link.click();
            }
        } catch (error) {
            console.error("Export JSON failed", error);
            alert("Erreur lors de l'export JSON");
        } finally {
            setExporting(false);
        }
    };

    const resetFilters = () => {
        setStartDate('');
        setEndDate('');
        setSearchTerm('');
        setCategory('');
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-text-main">Rapports & Exports</h2>
                    <p className="text-text-muted text-sm">Générez et téléchargez vos rapports d'activité</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={resetFilters}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-border rounded-xl shadow-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all duration-200 group"
                    >
                        <FilterX size={18} className="group-hover:scale-110 transition-transform duration-200" />
                        <span className="font-medium">Réinitialiser Filtres</span>
                    </button>
                    <button
                        onClick={fetchSalesData}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-border rounded-xl shadow-sm hover:bg-gray-50 hover:text-primary hover:border-primary/30 transition-all duration-200 group"
                    >
                        <RefreshCw size={18} className={`transition-transform duration-500 ${loading ? 'animate-spin' : 'group-hover:rotate-180'}`} />
                        <span className="font-medium">Actualiser</span>
                    </button>
                </div>
            </div>

            {/* New Comparison Report Section */}
            <Card className="border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white shadow-sm hover:shadow-md transition-all duration-300">
                <div className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                                <BarChart3 size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Rapport Comparatif d'Évolution</h3>
                                <p className="text-sm text-gray-500 mt-1">Exportez l'analyse détaillée N vs N-1 du Chiffre d'Affaires et des Volumes.</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 w-full md:w-auto">
                            {/* Year Selector */}
                            <div className="relative w-full sm:w-32">
                                <select
                                    value={cmpYear}
                                    onChange={(e) => setCmpYear(Number(e.target.value))}
                                    className="w-full appearance-none pl-4 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:border-indigo-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                                >
                                    {[2024, 2025, 2026].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                            </div>

                            {/* Range Selector */}
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <div className="relative w-full sm:w-32">
                                    <select
                                        value={cmpStartMonth}
                                        onChange={(e) => setCmpStartMonth(Number(e.target.value))}
                                        className="w-full appearance-none pl-4 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:border-indigo-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                                    >
                                        {MONTHS.map((m, i) => (
                                            <option key={i} value={i}>{m}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                </div>
                                <span className="text-gray-400">-</span>
                                <div className="relative w-full sm:w-32">
                                    <select
                                        value={cmpEndMonth}
                                        onChange={(e) => setCmpEndMonth(Number(e.target.value))}
                                        className="w-full appearance-none pl-4 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:border-indigo-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                                    >
                                        {MONTHS.map((m, i) => (
                                            <option key={i} value={i}>{m}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                </div>
                            </div>

                            <button
                                onClick={exportComparisonReport}
                                disabled={exporting}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                                {exporting ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
                                <span className="font-medium">Exporter Comparatif</span>
                            </button>
                        </div>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div
                    onClick={exportToExcel}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-border hover:shadow-md hover:border-green-200 transition-all cursor-pointer group"
                >
                    <div className="flex flex-col items-center justify-center gap-4">
                        <div className="p-4 bg-green-50 rounded-full text-green-600 group-hover:scale-110 transition-transform duration-300">
                            {exporting ? <Loader2 className="animate-spin" size={32} /> : <FileSpreadsheet size={32} />}
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-lg text-text-main group-hover:text-green-700 transition-colors">Excel (.xlsx)</h3>
                            <p className="text-sm text-text-muted">Rapport Ventes (Liste)</p>
                        </div>
                    </div>
                </div>

                <div
                    onClick={exportToPDF}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-border hover:shadow-md hover:border-red-200 transition-all cursor-pointer group"
                >
                    <div className="flex flex-col items-center justify-center gap-4">
                        <div className="p-4 bg-red-50 rounded-full text-red-600 group-hover:scale-110 transition-transform duration-300">
                            {exporting ? <Loader2 className="animate-spin" size={32} /> : <FileText size={32} />}
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-lg text-text-main group-hover:text-red-700 transition-colors">PDF (.pdf)</h3>
                            <p className="text-sm text-text-muted">Rapport Ventes (Liste)</p>
                        </div>
                    </div>
                </div>

                <div
                    onClick={exportToJSON}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-border hover:shadow-md hover:border-yellow-200 transition-all cursor-pointer group"
                >
                    <div className="flex flex-col items-center justify-center gap-4">
                        <div className="p-4 bg-yellow-50 rounded-full text-yellow-600 group-hover:scale-110 transition-transform duration-300">
                            {exporting ? <Loader2 className="animate-spin" size={32} /> : <FileJson size={32} />}
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-lg text-text-main group-hover:text-yellow-700 transition-colors">JSON (.json)</h3>
                            <p className="text-sm text-text-muted">Données brutes</p>
                        </div>
                    </div>
                </div>
            </div>

            <Card className="border-none shadow-lg shadow-gray-100/50 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-border">
                    <h3 className="font-bold text-lg text-text-main mb-4">Aperçu des données (Ventes)</h3>

                    {/* Filters Section */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1.5">Rechercher</label>
                            <input
                                type="text"
                                placeholder="Nom de l'article..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1.5">Catégorie</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-4 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-all duration-200"
                            >
                                <option value="">Toutes</option>
                                <option value="Shop">Shop</option>
                                <option value="Café">Café</option>
                                <option value="Bosch Service">Bosch Service</option>
                                <option value="Lubrifiants">Lubrifiants (Tout)</option>
                                <option value="Lubrifiants Piste">Lubrifiants Piste</option>
                                <option value="Lubrifiants Bosch">Lubrifiants Bosch</option>
                            </select>
                        </div>
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

                <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin text-primary" size={32} />
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse relative">
                            <thead className="sticky top-0 z-10">
                                <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider bg-gray-50 shadow-sm">
                                    <th className="py-4 px-6 font-semibold bg-gray-50">Date</th>
                                    <th className="py-4 px-6 font-semibold bg-gray-50">Article</th>
                                    <th className="py-4 px-6 font-semibold text-right bg-gray-50">Quantité</th>
                                    <th className="py-4 px-6 font-semibold text-right bg-gray-50">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {salesData.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="py-8 text-center text-text-muted">Aucune donnée disponible</td>
                                    </tr>
                                ) : (
                                    salesData.map((row, i) => (
                                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-4 px-6 text-text-main font-medium">{row.date}</td>
                                            <td className="py-4 px-6 text-text-main">{row.article}</td>
                                            <td className="py-4 px-6 text-right text-text-main">{row.quantity}</td>
                                            <td className="py-4 px-6 text-right font-bold text-primary">{row.total} MAD</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>
        </div>
    );
}
