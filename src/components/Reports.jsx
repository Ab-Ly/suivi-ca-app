import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from './ui/Card';
import { FileDown, FileJson, FileSpreadsheet, FileText, Loader2, RefreshCw, ChevronDown, BarChart3, FilterX, Package, Receipt } from 'lucide-react';
import { DateInput } from './ui/DateInput';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { fetchComparisonStats } from '../utils/statisticsUtils';
import { getArticleWeightInKg } from '../utils/formatters';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

const getMonthsInRange = (startStr, endStr) => {
    if (!startStr || !endStr) return [];
    const start = new Date(startStr);
    const end = new Date(endStr);
    const months = [];
    
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
        const yStr = current.getFullYear();
        const mStr = String(current.getMonth() + 1).padStart(2, '0');
        months.push(`${yStr}-${mStr}`);
        current.setMonth(current.getMonth() + 1);
    }
    return months;
};

const getMonthOverlapScale = (monthStr, startDateStr, endDateStr) => {
    if (!monthStr || !startDateStr || !endDateStr) return 0.0;
    
    const [year, month] = monthStr.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0); // last day of month
    
    const queryStart = new Date(startDateStr + 'T00:00:00');
    const queryEnd = new Date(endDateStr + 'T00:00:00');
    
    const intersectStart = new Date(Math.max(monthStart.getTime(), queryStart.getTime()));
    const intersectEnd = new Date(Math.min(monthEnd.getTime(), queryEnd.getTime()));
    
    if (intersectStart > intersectEnd) return 0.0;
    
    const totalDaysInMonth = monthEnd.getDate();
    const intersectDays = Math.round((intersectEnd.getTime() - intersectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    return Math.min(1.0, Math.max(0.0, intersectDays / totalDaysInMonth));
};

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
                    weight: getArticleWeightInKg(sale.articles?.name, sale.articles?.category, sale.quantity),
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
            const formatPrice = (num) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num) + ' DH';

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

            const currencyFormat = '#,##0.00 "DH"';
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
                valCell.numFmt = label.includes('Volume') ? '#,##0 "L"' : '#,##0 "DH"';
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

    const exportREXReport = async () => {
        setExporting(true);
        try {
            const ExcelJS = (await import('exceljs')).default;
            const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
            const end = endDate || new Date().toISOString().split('T')[0];

            // 1. Fetch fuel sales in date range
            let fuelSalesData = [];
            let fuelPage = 0;
            const pageSize = 1000;
            while (true) {
                let fuelQuery = supabase
                    .from('fuel_sales')
                    .select('*')
                    .gte('sale_date', start);
                const endOfEndDay = new Date(end);
                endOfEndDay.setHours(23, 59, 59, 999);
                fuelQuery = fuelQuery.lte('sale_date', endOfEndDay.toISOString());
                fuelQuery = fuelQuery.range(fuelPage * pageSize, (fuelPage + 1) * pageSize - 1);
                const { data, error } = await fuelQuery;
                if (error) throw error;
                if (!data || data.length === 0) break;
                fuelSalesData.push(...data);
                if (data.length < pageSize) break;
                fuelPage++;
            }

            // 2. Fetch fuel prices
            let fuelPricesData = [];
            let pricesPage = 0;
            while (true) {
                const { data, error } = await supabase
                    .from('fuel_prices')
                    .select('*')
                    .order('date', { ascending: true })
                    .range(pricesPage * pageSize, (pricesPage + 1) * pageSize - 1);
                if (error) throw error;
                if (!data || data.length === 0) break;
                fuelPricesData.push(...data);
                if (data.length < pageSize) break;
                pricesPage++;
            }

            // 3. Fetch non-fuel sales in date range
            let nonFuelSales = [];
            let salesPage = 0;
            while (true) {
                let salesQuery = supabase
                    .from('sales')
                    .select('*, articles!inner(*)')
                    .gte('sale_date', start);
                const endOfEndDay = new Date(end);
                endOfEndDay.setHours(23, 59, 59, 999);
                salesQuery = salesQuery.lte('sale_date', endOfEndDay.toISOString());
                salesQuery = salesQuery.range(salesPage * pageSize, (salesPage + 1) * pageSize - 1);
                const { data, error } = await salesQuery;
                if (error) throw error;
                if (!data || data.length === 0) break;
                nonFuelSales.push(...data);
                if (data.length < pageSize) break;
                salesPage++;
            }

            // 4. Fetch monthly stock costs
            const { data: monthlyCogsData, error: monthlyCogsError } = await supabase
                .from('monthly_stock_costs')
                .select('*');
            if (monthlyCogsError) throw monthlyCogsError;

            // 5. Fetch operating expenses in range
            let expensesData = [];
            let expensesPage = 0;
            while (true) {
                let expensesQuery = supabase
                    .from('operating_expenses')
                    .select('*')
                    .gte('date', start)
                    .lte('date', end)
                    .order('date', { ascending: true });
                expensesQuery = expensesQuery.range(expensesPage * pageSize, (expensesPage + 1) * pageSize - 1);
                const { data, error } = await expensesQuery;
                if (error) throw error;
                if (!data || data.length === 0) break;
                expensesData.push(...data);
                if (data.length < pageSize) break;
                expensesPage++;
            }

            // Math computations
            const expensesTotal = expensesData.reduce((sum, exp) => sum + Number(exp.amount), 0);
            const expensesByCategory = {};
            expensesData.forEach(exp => {
                expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + Number(exp.amount);
            });

            const monthlyCogsMap = {};
            (monthlyCogsData || []).forEach(item => {
                monthlyCogsMap[item.month] = {
                    shop: Number(item.shop_cogs || 0),
                    cafe: Number(item.cafe_cogs || 0),
                    bosch: Number(item.bosch_cogs || 0)
                };
            });

            const getFuelPrice = (saleDateStr, fuelType) => {
                const saleDate = saleDateStr.split('T')[0];
                let activePrice = null;
                for (const p of fuelPricesData) {
                    if (p.fuel_type === fuelType && p.date <= saleDate) {
                        activePrice = p;
                    }
                }
                return activePrice || { purchase_price: 0, sale_price: 0 };
            };

            let gasoilRevenue = 0, gasoilCost = 0, gasoilLiters = 0;
            let sspRevenue = 0, sspCost = 0, sspLiters = 0;
            fuelSalesData.forEach(sale => {
                const priceInfo = getFuelPrice(sale.sale_date, sale.fuel_type);
                const qty = Number(sale.quantity_liters);
                const purchasePrice = Number(priceInfo.purchase_price);
                const salePrice = Number(priceInfo.sale_price);

                if (sale.fuel_type === 'Gasoil') {
                    gasoilLiters += qty;
                    gasoilRevenue += qty * salePrice;
                    gasoilCost += qty * purchasePrice;
                } else if (sale.fuel_type === 'SSP') {
                    sspLiters += qty;
                    sspRevenue += qty * salePrice;
                    sspCost += qty * purchasePrice;
                }
            });

            let lubRevenue = 0, lubCost = 0, lubQty = 0;
            let shopRevenue = 0, shopCost = 0;
            let cafeRevenue = 0, cafeCost = 0;
            let boschRevenue = 0, boschCost = 0;

            nonFuelSales.forEach(sale => {
                const qty = Number(sale.quantity || 1);
                const revenue = Number(sale.total_price || 0);
                const purchasePrice = Number(sale.articles?.purchase_price || 0);
                const category = (sale.articles?.category || '').toLowerCase();

                if (['lubricant_piste', 'lubricant_bosch', 'lubrifiants'].includes(category)) {
                    lubQty += qty;
                    lubRevenue += revenue;
                    lubCost += qty * purchasePrice;
                } else if (category.includes('shop')) {
                    shopRevenue += revenue;
                    const saleMonth = sale.sale_date.substring(0, 7);
                    if (!monthlyCogsMap[saleMonth]) {
                        shopCost += qty * purchasePrice;
                    }
                } else if (category.includes('cafe') || category.includes('café')) {
                    cafeRevenue += revenue;
                    const saleMonth = sale.sale_date.substring(0, 7);
                    if (!monthlyCogsMap[saleMonth]) {
                        cafeCost += qty * purchasePrice;
                    }
                } else {
                    boschRevenue += revenue;
                    const saleMonth = sale.sale_date.substring(0, 7);
                    if (!monthlyCogsMap[saleMonth]) {
                        boschCost += qty * purchasePrice;
                    }
                }
            });

            const uniqueMonths = getMonthsInRange(start, end);
            uniqueMonths.forEach(m => {
                const scale = getMonthOverlapScale(m, start, end);
                if (monthlyCogsMap[m]) {
                    shopCost += monthlyCogsMap[m].shop * scale;
                    cafeCost += monthlyCogsMap[m].cafe * scale;
                    boschCost += monthlyCogsMap[m].bosch * scale;
                }
            });

            const totalRevenue = gasoilRevenue + sspRevenue + lubRevenue + shopRevenue + cafeRevenue + boschRevenue;
            const totalCost = gasoilCost + sspCost + lubCost + shopCost + cafeCost + boschCost;
            const totalMargin = totalRevenue - totalCost;
            const ebitVal = totalMargin - expensesTotal;

            // Start Building Excel Workbook
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Suivi CA App';
            workbook.created = new Date();

            // Sheet 1: Compte de REX
            const rexSheet = workbook.addWorksheet("Compte de REX", { views: [{ showGridLines: true }] });
            rexSheet.getColumn(1).width = 50;
            rexSheet.getColumn(2).width = 25;
            rexSheet.getColumn(3).width = 25;

            // Styles
            const fontTitle = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF1F2937' } };
            const fontSubtitle = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF6B7280' } };
            const fontHeader = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
            const fontSection = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF1F2937' } };
            const fontSubitem = { name: 'Segoe UI', size: 10, color: { argb: 'FF4B5563' } };
            const fontTotal = { name: 'Segoe UI', size: 11, bold: true };
            
            const fillHeader = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
            const fillMargin = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } };
            const fillCost = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE8E6' } };
            const fillEbit = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };

            const borderThin = {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
            };

            const formatCurrency = '#,##0.00 "DH"';
            const formatPct = '0.0 "%"';

            // Title
            rexSheet.mergeCells('A2:C2');
            const tCell = rexSheet.getCell('A2');
            tCell.value = "COMPTE DE RÉSULTAT D'EXPLOITATION (REX)";
            tCell.font = fontTitle;
            tCell.alignment = { horizontal: 'center', vertical: 'middle' };
            rexSheet.getRow(2).height = 30;

            rexSheet.mergeCells('A3:C3');
            const subCell = rexSheet.getCell('A3');
            subCell.value = `Période du ${new Date(start).toLocaleDateString('fr-FR')} au ${new Date(end).toLocaleDateString('fr-FR')}`;
            subCell.font = fontSubtitle;
            subCell.alignment = { horizontal: 'center', vertical: 'middle' };
            rexSheet.getRow(3).height = 20;

            // Headers
            const headerRow = rexSheet.addRow(["Poste", "Montant (DH)", "% du Chiffre d'Affaires"]);
            headerRow.height = 28;
            headerRow.eachCell((cell, colNum) => {
                cell.font = fontHeader;
                cell.fill = fillHeader;
                cell.alignment = { horizontal: colNum === 1 ? 'left' : 'right', vertical: 'middle' };
                cell.border = borderThin;
            });

            // Rows array helper
            const addRexRow = (label, amount, pctOfCA, type) => {
                const row = rexSheet.addRow([label, amount, pctOfCA]);
                row.height = 22;
                
                let rowFont = fontSubitem;
                let rowFill = null;

                if (type === 'section') {
                    rowFont = fontSection;
                } else if (type === 'margin') {
                    rowFont = { ...fontTotal, color: { argb: 'FF137333' } };
                    rowFill = fillMargin;
                } else if (type === 'cost') {
                    rowFont = { ...fontSubitem, color: { argb: 'FFC5221F' } };
                    rowFill = fillCost;
                } else if (type === 'ebit') {
                    rowFont = { ...fontTotal, color: { argb: 'FF1A73E8' } };
                    rowFill = fillEbit;
                }

                row.eachCell((cell, colNum) => {
                    cell.font = rowFont;
                    if (rowFill) cell.fill = rowFill;
                    cell.border = borderThin;
                    
                    if (colNum === 1) {
                        cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    } else if (colNum === 2) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        cell.numFmt = formatCurrency;
                    } else if (colNum === 3) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        cell.numFmt = formatPct;
                    }
                });
                return row;
            };

            // CA row
            addRexRow("Chiffre d'Affaires (Ventes de Carburant, Lubs & Services)", totalRevenue, 1.0, 'section');

            // Stock Costs header
            addRexRow("Coûts de stock / Achat carburants & marchandises (-)", -totalCost, totalRevenue > 0 ? -totalCost / totalRevenue : 0, 'section');

            // Stock details
            const stockDetails = [
                { label: "  • Gasoil", cost: gasoilCost },
                { label: "  • Super Sans Plomb (SSP)", cost: sspCost },
                { label: "  • Lubrifiants", cost: lubCost },
                { label: "  • Boutique / Shop", cost: shopCost },
                { label: "  • Café", cost: cafeCost },
                { label: "  • Service Bosch", cost: boschCost }
            ].filter(item => item.cost > 0);

            stockDetails.forEach(item => {
                addRexRow(item.label, -item.cost, totalRevenue > 0 ? -item.cost / totalRevenue : 0, 'cost');
            });

            // Marge brute
            addRexRow("Marge Brute Globale", totalMargin, totalRevenue > 0 ? totalMargin / totalRevenue : 0, 'margin');

            // General Expenses Header
            addRexRow("Charges Générales d'Exploitation (Charges) (-)", -expensesTotal, totalRevenue > 0 ? -expensesTotal / totalRevenue : 0, 'section');

            // General Expenses details
            const expenseDetailsList = [
                { key: 'Loyer', label: "  • Loyer / Redevance foncière" },
                { key: 'Electricite', label: "  • Électricité" },
                { key: 'Eau', label: "  • Eau & Assainissement" },
                { key: 'Salaires', label: "  • Salaires & CNSS (Fixe)" },
                { key: 'Interim', label: "  • Personnel Intérimaire (Flexible)" },
                { key: 'Taxes', label: "  • Impôts & Taxes Locales" },
                { key: 'Assurances', label: "  • Assurances" },
                { key: 'Entretien', label: "  • Entretien & Réparations" },
                { key: 'Fournitures', label: "  • Fournitures & Consommables" },
                { key: 'Commissions', label: "  • Commissions TPE & Cartes" },
                { key: 'Securite', label: "  • Sécurité & Gardiennage" },
                { key: 'Telecom', label: "  • Télécoms & Internet" },
                { key: 'Comptabilite', label: "  • Honoraires Comptables & Juridiques" },
                { key: 'Marketing', label: "  • Publicité & Marketing" },
                { key: 'Transport', label: "  • Transport & Logistique" },
                { key: 'Nettoyage', label: "  • Nettoyage & Assainissement" },
                { key: 'Autre', label: "  • Autre / Divers" }
            ];

            expenseDetailsList.forEach(item => {
                const amount = expensesByCategory[item.key] || 0;
                if (amount > 0) {
                    addRexRow(item.label, -amount, totalRevenue > 0 ? -amount / totalRevenue : 0, 'cost');
                }
            });

            // EBIT
            addRexRow("RÉSULTAT D'EXPLOITATION (REX)", ebitVal, totalRevenue > 0 ? ebitVal / totalRevenue : 0, 'ebit');


            // Sheet 2: Détail des Charges
            const expensesSheet = workbook.addWorksheet("Détail des Charges");
            expensesSheet.columns = [
                { header: 'Date', key: 'date', width: 16 },
                { header: 'Catégorie', key: 'category', width: 25 },
                { header: 'Description / Note', key: 'description', width: 35 },
                { header: 'Mode de Paiement', key: 'payment_method', width: 18 },
                { header: 'Montant (DH)', key: 'amount', width: 20 }
            ];
            
            // Format Headers for Sheet 2
            expensesSheet.getRow(1).height = 26;
            expensesSheet.getRow(1).eachCell((cell) => {
                cell.font = fontHeader;
                cell.fill = fillHeader;
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = borderThin;
            });

            // Fill Data
            const CATEGORY_LABELS = {};
            const EXPENSE_CATEGORIES_LOCAL = [
                { value: 'Loyer', label: 'Loyer / Redevance foncière' },
                { value: 'Electricite', label: 'Électricité' },
                { value: 'Eau', label: 'Eau & Assainissement' },
                { value: 'Salaires', label: 'Salaires & CNSS (Fixe)' },
                { value: 'Interim', label: 'Personnel Intérimaire (Flexible)' },
                { value: 'Taxes', label: 'Impôts & Taxes Locales' },
                { value: 'Assurances', label: 'Assurances' },
                { value: 'Entretien', label: 'Entretien & Réparations' },
                { value: 'Fournitures', label: 'Fournitures & Consommables' },
                { value: 'Commissions', label: 'Commissions TPE & Cartes' },
                { value: 'Securite', label: 'Sécurité & Gardiennage' },
                { value: 'Telecom', label: 'Télécoms & Internet' },
                { value: 'Comptabilite', label: 'Honoraires Comptables & Juridiques' },
                { value: 'Marketing', label: 'Publicité & Marketing' },
                { value: 'Transport', label: 'Transport & Logistique' },
                { value: 'Nettoyage', label: 'Nettoyage & Assainissement' },
                { value: 'Autre', label: 'Autre / Divers' }
            ];
            EXPENSE_CATEGORIES_LOCAL.forEach(c => {
                CATEGORY_LABELS[c.value] = c.label;
            });

            expensesData.forEach((exp, index) => {
                const row = expensesSheet.addRow({
                    date: new Date(exp.date).toLocaleDateString('fr-FR'),
                    category: CATEGORY_LABELS[exp.category] || exp.category,
                    description: exp.description || '—',
                    payment_method: exp.payment_method || '—',
                    amount: Number(exp.amount)
                });
                row.height = 22;

                row.eachCell((cell, colNum) => {
                    cell.font = fontSubitem;
                    cell.border = borderThin;
                    
                    if (colNum === 1 || colNum === 4) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    } else if (colNum === 5) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        cell.numFmt = formatCurrency;
                    } else {
                        cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    }

                    // Zebra striping
                    if (index % 2 === 0) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                    }
                });
            });

            // Write and Share Workbook
            const buffer = await workbook.xlsx.writeBuffer();
            const fileName = `Rapport_REX_Charges_${start}_au_${end}.xlsx`;

            const base64Data = btoa(
                new Uint8Array(buffer)
                    .reduce((data, byte) => data + String.fromCharCode(byte), '')
            );

            if (Capacitor.isNativePlatform()) {
                await saveAndShareFile(fileName, base64Data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            } else {
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                window.URL.revokeObjectURL(url);
            }

        } catch (error) {
            console.error("Export REX failed", error);
            alert("Erreur lors de l'export du rapport de gestion REX : " + error.message);
        } finally {
            setExporting(false);
        }
    };

    const exportStockReport = async () => {
        setExporting(true);
        try {
            const ExcelJS = (await import('exceljs')).default;

            // Fetch all articles
            const { data: articlesData, error: articlesError } = await supabase
                .from('articles')
                .select('*')
                .order('name', { ascending: true });
            if (articlesError) throw articlesError;

            // Start Building Excel Workbook
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Suivi CA App';
            workbook.created = new Date();

            const sheet = workbook.addWorksheet("État des Stocks", { views: [{ showGridLines: true }] });
            sheet.columns = [
                { header: "Nom de l'Article", key: 'name', width: 35 },
                { header: 'Type', key: 'type', width: 16 },
                { header: 'Catégorie', key: 'category', width: 22 },
                { header: 'Prix de Vente (DH)', key: 'price', width: 20 },
                { header: "Prix d'Achat (DH)", key: 'purchase_price', width: 20 },
                { header: 'Stock Actuel', key: 'current_stock', width: 16 },
                { header: 'Valeur Stock (DH)', key: 'value', width: 20 }
            ];

            const fontHeader = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
            const fontItem = { name: 'Segoe UI', size: 10, color: { argb: 'FF1F2937' } };
            const fontTotal = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF111827' } };
            const fillHeader = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
            const fillTotal = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
            const borderThin = {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
            };

            const formatCurrency = '#,##0.00 "DH"';
            const formatQty = '#,##0';

            // Style Headers
            sheet.getRow(1).height = 28;
            sheet.getRow(1).eachCell((cell) => {
                cell.font = fontHeader;
                cell.fill = fillHeader;
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = borderThin;
            });

            let totalQty = 0;
            let totalValue = 0;

            const categoryLabels = {
                'shop': 'Boutique / Shop',
                'cafe': 'Café / Restauration',
                'bosch_service': 'Bosch Car Service',
                'lubricant_piste': 'Lubrifiants Piste',
                'lubricant_bosch': 'Lubrifiants Bosch',
                'lubrifiants': 'Lubrifiants'
            };

            articlesData.forEach((art, index) => {
                const qty = Number(art.current_stock || 0);
                const purchasePrice = Number(art.purchase_price || 0);
                const val = qty * purchasePrice;

                totalQty += qty;
                totalValue += val;

                const row = sheet.addRow({
                    name: art.name,
                    type: art.type === 'stockable' ? 'Stockable' : 'Service (Non stocké)',
                    category: categoryLabels[art.category] || art.category,
                    price: Number(art.price || 0),
                    purchase_price: purchasePrice,
                    current_stock: qty,
                    value: val
                });
                row.height = 22;

                row.eachCell((cell, colNum) => {
                    cell.font = fontItem;
                    cell.border = borderThin;

                    if ([1, 2, 3].includes(colNum)) {
                        cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    } else if ([4, 5, 7].includes(colNum)) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        cell.numFmt = formatCurrency;
                    } else if (colNum === 6) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        cell.numFmt = formatQty;
                    }

                    // Zebra striping
                    if (index % 2 === 0) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                    }
                });
            });

            // Add Total Row
            const totalRow = sheet.addRow([
                "TOTAL GÉNÉRAL",
                "",
                "",
                "",
                "",
                totalQty,
                totalValue
            ]);
            totalRow.height = 24;
            totalRow.eachCell((cell, colNum) => {
                cell.font = fontTotal;
                cell.fill = fillTotal;
                cell.border = borderThin;

                if (colNum === 1) {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                } else if (colNum === 6) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.numFmt = formatQty;
                } else if (colNum === 7) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.numFmt = formatCurrency;
                } else {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                }
            });

            // Write and Share
            const buffer = await workbook.xlsx.writeBuffer();
            const fileName = `Rapport_Etat_Stocks_${new Date().toISOString().split('T')[0]}.xlsx`;

            const base64Data = btoa(
                new Uint8Array(buffer)
                    .reduce((data, byte) => data + String.fromCharCode(byte), '')
            );

            if (Capacitor.isNativePlatform()) {
                await saveAndShareFile(fileName, base64Data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            } else {
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                window.URL.revokeObjectURL(url);
            }

        } catch (error) {
            console.error("Export Stock failed", error);
            alert("Erreur lors de l'export de l'état des stocks : " + error.message);
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
                "Poids (kg)": item.weight !== null ? Number(item.weight.toFixed(2)) : "",
                "Total (DH)": item.total,
                "Total Journée (DH)": item.dailyTotal
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

            const tableColumn = ["Date", "Article", "Catégorie", "Lieu", "Qté", "Poids", "Total", "Total Jour"];
            const tableRows = salesData.map(item => [
                item.date,
                item.article,
                item.category,
                item.location,
                item.quantity,
                item.weight !== null ? `${item.weight.toFixed(1)} kg` : "-",
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
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Rapports & Exports</h2>
                    <p className="text-gray-500 text-sm">Générez et téléchargez vos rapports d'activité</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={resetFilters}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-rose-50 hover:text-rose-650 hover:border-rose-200 transition-all duration-200 group text-sm font-semibold text-gray-700"
                    >
                        <FilterX size={18} className="group-hover:scale-110 transition-transform duration-200 text-gray-500" />
                        <span>Réinitialiser Filtres</span>
                    </button>
                    <button
                        onClick={fetchSalesData}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 hover:text-indigo-650 hover:border-indigo-200 transition-all duration-200 group text-sm font-semibold text-gray-700"
                    >
                        <RefreshCw size={18} className={`transition-transform duration-500 text-gray-500 ${loading ? 'animate-spin' : 'group-hover:rotate-180'}`} />
                        <span>Actualiser</span>
                    </button>
                </div>
            </div>

            {/* General Filters Section */}
            <Card className="border border-gray-100 bg-white p-5 shadow-sm rounded-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="lg:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Recherche Article (Aperçu)</label>
                        <input
                            type="text"
                            placeholder="Entrez le nom d'un article..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-150 text-gray-800 text-sm rounded-xl outline-none font-medium focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Catégorie</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-150 text-gray-800 text-sm rounded-xl outline-none font-medium focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all cursor-pointer"
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
                            label="Date Début"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <DateInput
                            label="Date Fin"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>
            </Card>

            {/* Reports Grid */}
            <div className="space-y-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Rapports d'activité & Analyses</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Report 1: Comparative */}
                    <Card className="border border-indigo-100 bg-gradient-to-br from-indigo-50/30 to-white shadow-sm hover:shadow-md transition-all duration-300 rounded-3xl overflow-hidden flex flex-col justify-between p-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3.5">
                                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl shadow-sm">
                                    <BarChart3 size={22} />
                                </div>
                                <div>
                                    <h4 className="text-base font-bold text-gray-900">Rapport Comparatif d'Évolution (N vs N-1)</h4>
                                    <p className="text-xs text-gray-500">Comparez les performances d'une année sur l'autre.</p>
                                </div>
                            </div>
                            <p className="text-xs leading-relaxed text-gray-500">
                                Génère un fichier Excel complet contenant le tableau de bord des KPI clés, le détail mensuel des ventes, l'évolution par catégorie d'articles et l'analyse détaillée des volumes de carburant vendus comparé à l'année précédente.
                            </p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                                {/* Year Selector */}
                                <div className="relative">
                                    <select
                                        value={cmpYear}
                                        onChange={(e) => setCmpYear(Number(e.target.value))}
                                        className="w-full appearance-none pl-3.5 pr-8 py-2 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold text-gray-700 hover:border-indigo-300 focus:border-indigo-500 transition-all cursor-pointer"
                                    >
                                        {(() => {
                                            const currentYear = new Date().getFullYear();
                                            return [currentYear - 2, currentYear - 1, currentYear].map(y => (
                                                <option key={y} value={y}>{y}</option>
                                            ));
                                        })()}
                                    </select>
                                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                                </div>

                                {/* Start Month Selector */}
                                <div className="relative">
                                    <select
                                        value={cmpStartMonth}
                                        onChange={(e) => setCmpStartMonth(Number(e.target.value))}
                                        className="w-full appearance-none pl-3.5 pr-8 py-2 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold text-gray-700 hover:border-indigo-300 focus:border-indigo-500 transition-all cursor-pointer"
                                    >
                                        {MONTHS.map((m, i) => (
                                            <option key={i} value={i}>{m}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                                </div>

                                {/* End Month Selector */}
                                <div className="relative">
                                    <select
                                        value={cmpEndMonth}
                                        onChange={(e) => setCmpEndMonth(Number(e.target.value))}
                                        className="w-full appearance-none pl-3.5 pr-8 py-2 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold text-gray-700 hover:border-indigo-300 focus:border-indigo-500 transition-all cursor-pointer"
                                    >
                                        {MONTHS.map((m, i) => (
                                            <option key={i} value={i}>{m}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                                </div>
                            </div>
                        </div>

                        <div className="pt-5 border-t border-gray-100 mt-5 flex justify-end">
                            <button
                                onClick={exportComparisonReport}
                                disabled={exporting}
                                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-100 hover:shadow-lg transition-all text-xs font-bold disabled:opacity-50"
                            >
                                {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                                <span>Exporter Comparatif</span>
                            </button>
                        </div>
                    </Card>

                    {/* Report 2: REX & Operating Statement */}
                    <Card className="border border-emerald-100 bg-gradient-to-br from-emerald-50/30 to-white shadow-sm hover:shadow-md transition-all duration-300 rounded-3xl overflow-hidden flex flex-col justify-between p-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3.5">
                                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl shadow-sm">
                                    <Receipt size={22} />
                                </div>
                                <div>
                                    <h4 className="text-base font-bold text-gray-900">Rapport Financier & REX</h4>
                                    <p className="text-xs text-gray-500">Analysez le Compte de Résultat d'Exploitation.</p>
                                </div>
                            </div>
                            <p className="text-xs leading-relaxed text-gray-500">
                                Génère un rapport financier structuré basé sur la période sélectionnée. Comprend l'analyse des marges brutes globales et par produit (Gasoil, SSP, lubrifiants, boutique, café, Bosch) ainsi que la liste détaillée chronologique de toutes les charges d'exploitation enregistrées.
                            </p>
                            
                            <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100 text-[11px] font-semibold text-emerald-800 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                <span>Période active : {startDate ? new Date(startDate).toLocaleDateString('fr-FR') : 'Début'} au {endDate ? new Date(endDate).toLocaleDateString('fr-FR') : 'Fin'}</span>
                            </div>
                        </div>

                        <div className="pt-5 border-t border-gray-100 mt-5 flex justify-end">
                            <button
                                onClick={exportREXReport}
                                disabled={exporting}
                                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-100 hover:shadow-lg transition-all text-xs font-bold disabled:opacity-50"
                            >
                                {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                                <span>Exporter REX & Charges</span>
                            </button>
                        </div>
                    </Card>

                    {/* Report 3: Stock Status & Valuation */}
                    <Card className="border border-amber-100 bg-gradient-to-br from-amber-50/30 to-white shadow-sm hover:shadow-md transition-all duration-300 rounded-3xl overflow-hidden flex flex-col justify-between p-6 lg:col-span-2">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3.5">
                                <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl shadow-sm">
                                    <Package size={22} />
                                </div>
                                <div>
                                    <h4 className="text-base font-bold text-gray-900">Rapport de Valorisation des Stocks</h4>
                                    <p className="text-xs text-gray-500">Valorisation instantanée de l'inventaire physique.</p>
                                </div>
                            </div>
                            <p className="text-xs leading-relaxed text-gray-500">
                                Génère l'état instantané de l'ensemble des articles stockables (Boutique, Café, Lubrifiants). Ce rapport liste les quantités actuelles en stock physique, les prix d'achat, les prix de vente conseillés, et calcule la valeur nette globale immobilisée en stock au prix d'achat.
                            </p>
                        </div>

                        <div className="pt-5 border-t border-gray-100 mt-5 flex justify-end">
                            <button
                                onClick={exportStockReport}
                                disabled={exporting}
                                className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-md shadow-amber-100 hover:shadow-lg transition-all text-xs font-bold disabled:opacity-50"
                            >
                                {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                                <span>Exporter l'Inventaire & Stock</span>
                            </button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* List Exports */}
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Autres exports (Liste des ventes)</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div
                        onClick={exportToExcel}
                        className="bg-white p-5 rounded-2xl shadow-sm border border-gray-150 hover:shadow-md hover:border-green-200 transition-all cursor-pointer group flex items-center gap-4"
                    >
                        <div className="p-3 bg-green-50 rounded-xl text-green-600 group-hover:scale-110 transition-transform duration-300">
                            {exporting ? <Loader2 className="animate-spin" size={20} /> : <FileSpreadsheet size={20} />}
                        </div>
                        <div>
                            <h4 className="font-bold text-xs text-gray-800 group-hover:text-green-700 transition-colors">Format Excel (.xlsx)</h4>
                            <p className="text-[10px] text-gray-400 mt-0.5">Télécharger la liste brute filtrée</p>
                        </div>
                    </div>

                    <div
                        onClick={exportToPDF}
                        className="bg-white p-5 rounded-2xl shadow-sm border border-gray-150 hover:shadow-md hover:border-rose-200 transition-all cursor-pointer group flex items-center gap-4"
                    >
                        <div className="p-3 bg-rose-50 rounded-xl text-rose-600 group-hover:scale-110 transition-transform duration-300">
                            {exporting ? <Loader2 className="animate-spin" size={20} /> : <FileText size={20} />}
                        </div>
                        <div>
                            <h4 className="font-bold text-xs text-gray-800 group-hover:text-rose-700 transition-colors">Format PDF (.pdf)</h4>
                            <p className="text-[10px] text-gray-400 mt-0.5">Générer un tableau imprimable</p>
                        </div>
                    </div>

                    <div
                        onClick={exportToJSON}
                        className="bg-white p-5 rounded-2xl shadow-sm border border-gray-150 hover:shadow-md hover:border-amber-200 transition-all cursor-pointer group flex items-center gap-4"
                    >
                        <div className="p-3 bg-amber-50 rounded-xl text-amber-600 group-hover:scale-110 transition-transform duration-300">
                            {exporting ? <Loader2 className="animate-spin" size={20} /> : <FileJson size={20} />}
                        </div>
                        <div>
                            <h4 className="font-bold text-xs text-gray-800 group-hover:text-amber-700 transition-colors">Format JSON (.json)</h4>
                            <p className="text-[10px] text-gray-400 mt-0.5">Données structurées pour intégrations</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Preview Table Card */}
            <Card className="border-none shadow-lg shadow-gray-100/50 rounded-2xl overflow-hidden bg-white">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-bold text-base text-gray-900">Aperçu des ventes de la période</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Aperçu interactif des {salesData.length} dernières écritures de vente.</p>
                </div>

                <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin text-indigo-600" size={32} />
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse relative">
                            <thead className="sticky top-0 z-10">
                                <tr className="border-b border-gray-100 text-gray-400 text-[10px] font-bold uppercase tracking-wider bg-gray-50/90 backdrop-blur-sm shadow-sm">
                                    <th className="py-3.5 px-6 bg-gray-50">Date</th>
                                    <th className="py-3.5 px-6 bg-gray-50">Article</th>
                                    <th className="py-3.5 px-6 text-right bg-gray-50 font-bold">Quantité</th>
                                    <th className="py-3.5 px-6 text-right bg-gray-50 font-bold">Montant Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 font-medium text-xs text-gray-800">
                                {salesData.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="py-12 text-center text-gray-400 font-semibold">Aucune vente disponible sur cette période</td>
                                    </tr>
                                ) : (
                                    salesData.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-3.5 px-6 text-gray-500 font-mono font-bold">{row.date}</td>
                                            <td className="py-3.5 px-6 text-gray-900 font-semibold">{row.article}</td>
                                            <td className="py-3.5 px-6 text-right text-gray-800">
                                                <div className="font-bold font-mono">{row.quantity}</div>
                                                {row.weight !== null && (
                                                    <div className="text-[9px] text-gray-450 font-bold mt-0.5 whitespace-nowrap">
                                                        {row.weight.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-6 text-right font-black text-indigo-650 font-mono">{row.total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH</td>
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
