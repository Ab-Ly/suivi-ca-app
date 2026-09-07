import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const MONTHS_NAMES = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

/**
 * Format helper for periods
 */
const getPeriodLabel = (period, year, selectedMonth, customStartMonth, customEndMonth) => {
    if (period === 'year') {
        return `Année ${year} (vs ${year - 1})`;
    } else if (period === 'month') {
        return `Mois de ${MONTHS_NAMES[selectedMonth]} ${year} (vs ${year - 1})`;
    } else if (period === 'custom') {
        return `Période Personnalisée : ${MONTHS_NAMES[customStartMonth]} à ${MONTHS_NAMES[customEndMonth]} ${year} (vs ${year - 1})`;
    } else if (period === 'week') {
        return `Semaine en cours (vs S-1 ${year - 1})`;
    } else {
        return `Journée actuelle (vs N-1)`;
    }
};

export const exportStatisticsToExcel = async (statsData) => {
    const {
        period,
        year,
        selectedMonth,
        customStartMonth,
        customEndMonth,
        kpis,
        categoryDetails,
        data,
        fuelKpis,
        fuelData,
        fuelRevenueKpis,
        fuelRevenueData,
        lubKpis,
        lubData
    } = statsData;

    // Lazy load ExcelJS
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Petrom - Suivi CA';
    workbook.created = new Date();

    const periodLabel = getPeriodLabel(period, year, selectedMonth, customStartMonth, customEndMonth);

    // ==========================================
    // STYLES & THEME
    // ==========================================
    const fontMain = { name: 'Segoe UI', size: 10 };
    const fontBold = { name: 'Segoe UI', size: 10, bold: true };
    const fontTitle = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF1E293B' } };
    const fontSection = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF0F172A' } };
    const fontTableHeader = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };

    const borderThin = { style: 'thin', color: { argb: 'FFE2E8F0' } };
    const borderCardTop = (color) => ({ style: 'medium', color: { argb: color } });

    const cellBorder = {
        top: borderThin,
        bottom: borderThin,
        left: borderThin,
        right: borderThin
    };

    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    const zebraFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    const totalRowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

    const fmtCurrency = '#,##0.00 "DH"';
    const fmtVolume = '#,##0.00 "L"';
    const fmtWeight = '#,##0.00 "kg"';
    const fmtPercent = '+0.0%;-0.0%;0.0%';

    // Helper for applying card styles
    const renderCard = (sheet, startRow, startCol, endRow, endCol, title, value, valueFmt, prevLabel, prevVal, prevFmt, growth, accentColor, bgFillColor, extraText) => {
        sheet.mergeCells(startRow, startCol, endRow, endCol);

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const cell = sheet.getCell(r, c);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgFillColor || 'FFFFFFFF' } };
                cell.border = {
                    top: r === startRow ? { style: 'medium', color: { argb: accentColor } } : borderThin,
                    bottom: r === endRow ? borderThin : undefined,
                    left: c === startCol ? borderThin : undefined,
                    right: c === endCol ? borderThin : undefined
                };
            }
        }

        // Sub-rows within card area
        const titleCell = sheet.getCell(startRow, startCol);
        titleCell.value = title.toUpperCase();
        titleCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: accentColor || 'FF64748B' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

        const valCell = sheet.getCell(startRow + 1, startCol);
        valCell.value = value || 0;
        valCell.numFmt = valueFmt;
        valCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF0F172A' } };
        valCell.alignment = { horizontal: 'center', vertical: 'middle' };

        const prevCell = sheet.getCell(startRow + 2, startCol);
        prevCell.value = `${prevLabel}: ${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(prevVal || 0)} ${prevFmt}`;
        prevCell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF64748B' } };
        prevCell.alignment = { horizontal: 'center', vertical: 'middle' };

        const growthCell = sheet.getCell(startRow + 3, startCol);
        const growthVal = growth || 0;
        growthCell.value = `Évolution : ${growthVal >= 0 ? '+' : ''}${growthVal.toFixed(1)}% ${extraText ? `(${extraText})` : ''}`;
        growthCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: growthVal >= 0 ? 'FF16A34A' : 'FFDC2626' } };
        growthCell.alignment = { horizontal: 'center', vertical: 'middle' };
    };

    // =========================================================================
    // FEUILLE 1 : VUE D'ENSEMBLE (REPRODUCTION EXACTE DU DASHBOARD STATISTIQUES)
    // =========================================================================
    const dashSheet = workbook.addWorksheet("Vue d'ensemble", {
        views: [{ showGridLines: true }]
    });

    // Column widths
    dashSheet.columns = [
        { width: 4 },  // A margin
        { width: 26 }, // B
        { width: 22 }, // C
        { width: 22 }, // D
        { width: 20 }, // E
        { width: 20 }, // F
        { width: 20 }, // G
        { width: 4 }   // H margin
    ];

    let rowCursor = 2;

    // 1. HEADER
    dashSheet.mergeCells(rowCursor, 2, rowCursor, 7);
    const mainTitle = dashSheet.getCell(rowCursor, 2);
    mainTitle.value = "📊 SUIVI & STATISTIQUES DES PERFORMANCES";
    mainTitle.font = fontTitle;
    mainTitle.alignment = { vertical: 'middle' };
    dashSheet.getRow(rowCursor).height = 28;
    rowCursor++;

    dashSheet.mergeCells(rowCursor, 2, rowCursor, 7);
    const subTitle = dashSheet.getCell(rowCursor, 2);
    subTitle.value = `${periodLabel} | Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    subTitle.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
    dashSheet.getRow(rowCursor).height = 20;
    rowCursor += 2;

    // 2. KPIS GLOBAUX DU CHIFFRE D'AFFAIRES
    const currYearLabel = period === 'year' || period === 'custom' ? `Année ${year}` : 'Actuel';
    const prevYearLabel = period === 'year' || period === 'custom' ? `Année ${year - 1}` : 'Précédent';

    // Card 1 : CA Actuel (Cols B-C)
    dashSheet.mergeCells(rowCursor, 2, rowCursor + 2, 3);
    for (let r = rowCursor; r <= rowCursor + 2; r++) {
        for (let c = 2; c <= 3; c++) {
            dashSheet.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            dashSheet.getCell(r, c).border = cellBorder;
        }
    }
    dashSheet.getCell(rowCursor, 2).border = { ...cellBorder, top: { style: 'medium', color: { argb: 'FF4F46E5' } } };
    dashSheet.getCell(rowCursor, 2).value = `CHIFFRE D'AFFAIRES ${currYearLabel.toUpperCase()}`;
    dashSheet.getCell(rowCursor, 2).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF4F46E5' } };
    dashSheet.getCell(rowCursor, 2).alignment = { horizontal: 'center', vertical: 'middle' };
    const caValCell = dashSheet.getCell(rowCursor + 1, 2);
    caValCell.value = kpis.currentTotal || 0;
    caValCell.numFmt = fmtCurrency;
    caValCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF0F172A' } };
    caValCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Card 2 : CA Précédent (Cols D-E)
    dashSheet.mergeCells(rowCursor, 4, rowCursor + 2, 5);
    for (let r = rowCursor; r <= rowCursor + 2; r++) {
        for (let c = 4; c <= 5; c++) {
            dashSheet.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            dashSheet.getCell(r, c).border = cellBorder;
        }
    }
    dashSheet.getCell(rowCursor, 4).border = { ...cellBorder, top: { style: 'medium', color: { argb: 'FF64748B' } } };
    dashSheet.getCell(rowCursor, 4).value = `CHIFFRE D'AFFAIRES ${prevYearLabel.toUpperCase()}`;
    dashSheet.getCell(rowCursor, 4).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF64748B' } };
    dashSheet.getCell(rowCursor, 4).alignment = { horizontal: 'center', vertical: 'middle' };
    const caPrevCell = dashSheet.getCell(rowCursor + 1, 4);
    caPrevCell.value = kpis.previousTotal || 0;
    caPrevCell.numFmt = fmtCurrency;
    caPrevCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF334155' } };
    caPrevCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Card 3 : Évolution (Cols F-G)
    dashSheet.mergeCells(rowCursor, 6, rowCursor + 2, 7);
    const growthColor = kpis.growth >= 0 ? 'FF16A34A' : 'FFDC2626';
    const growthBg = kpis.growth >= 0 ? 'FFF0FDF4' : 'FFFEE2E2';
    for (let r = rowCursor; r <= rowCursor + 2; r++) {
        for (let c = 6; c <= 7; c++) {
            dashSheet.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: growthBg } };
            dashSheet.getCell(r, c).border = cellBorder;
        }
    }
    dashSheet.getCell(rowCursor, 6).border = { ...cellBorder, top: { style: 'medium', color: { argb: growthColor } } };
    dashSheet.getCell(rowCursor, 6).value = "ÉVOLUTION COMMERCIALE";
    dashSheet.getCell(rowCursor, 6).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: growthColor } };
    dashSheet.getCell(rowCursor, 6).alignment = { horizontal: 'center', vertical: 'middle' };
    const caGrowthCell = dashSheet.getCell(rowCursor + 1, 6);
    caGrowthCell.value = `${kpis.growth >= 0 ? '+' : ''}${(kpis.growth || 0).toFixed(1)}%`;
    caGrowthCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: growthColor } };
    caGrowthCell.alignment = { horizontal: 'center', vertical: 'middle' };

    dashSheet.getRow(rowCursor).height = 18;
    dashSheet.getRow(rowCursor + 1).height = 26;
    dashSheet.getRow(rowCursor + 2).height = 16;
    rowCursor += 4;

    // 3. TABLEAU : DÉTAILS PAR CATÉGORIE
    dashSheet.mergeCells(rowCursor, 2, rowCursor, 5);
    const catTitle = dashSheet.getCell(rowCursor, 2);
    catTitle.value = "📁 Détails par Catégorie";
    catTitle.font = fontSection;
    rowCursor++;

    // Table Header
    const catHeaders = ['Catégorie', `CA ${prevYearLabel}`, `CA ${currYearLabel}`, 'Évolution'];
    const catHeaderCols = [2, 3, 4, 5];
    const catHeaderRow = dashSheet.getRow(rowCursor);
    catHeaderRow.height = 24;
    catHeaders.forEach((h, i) => {
        const cell = catHeaderRow.getCell(catHeaderCols[i]);
        cell.value = h;
        cell.font = fontTableHeader;
        cell.fill = headerFill;
        cell.border = cellBorder;
        cell.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' };
    });
    rowCursor++;

    // Table Rows
    let catPrevTotal = 0, catCurrTotal = 0;
    categoryDetails?.forEach((cat, idx) => {
        const row = dashSheet.getRow(rowCursor);
        row.height = 20;
        const c1 = row.getCell(2);
        const c2 = row.getCell(3);
        const c3 = row.getCell(4);
        const c4 = row.getCell(5);

        c1.value = cat.name;
        c1.font = fontBold;
        c1.border = cellBorder;
        c1.alignment = { horizontal: 'left', vertical: 'middle' };

        c2.value = cat.previous || 0;
        c2.numFmt = fmtCurrency;
        c2.font = fontMain;
        c2.border = cellBorder;
        c2.alignment = { horizontal: 'right', vertical: 'middle' };

        c3.value = cat.current || 0;
        c3.numFmt = fmtCurrency;
        c3.font = fontBold;
        c3.border = cellBorder;
        c3.alignment = { horizontal: 'right', vertical: 'middle' };

        const growthVal = cat.growth || 0;
        c4.value = `${growthVal >= 0 ? '+' : ''}${growthVal.toFixed(1)}%`;
        c4.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: growthVal >= 0 ? 'FF16A34A' : 'FFDC2626' } };
        c4.border = cellBorder;
        c4.alignment = { horizontal: 'right', vertical: 'middle' };

        if (idx % 2 === 1) {
            c1.fill = zebraFill;
            c2.fill = zebraFill;
            c3.fill = zebraFill;
            c4.fill = zebraFill;
        }

        catPrevTotal += cat.previous || 0;
        catCurrTotal += cat.current || 0;
        rowCursor++;
    });

    // Total Row
    const catTotalRow = dashSheet.getRow(rowCursor);
    catTotalRow.height = 22;
    const ct1 = catTotalRow.getCell(2);
    const ct2 = catTotalRow.getCell(3);
    const ct3 = catTotalRow.getCell(4);
    const ct4 = catTotalRow.getCell(5);

    ct1.value = "TOTAL CATÉGORIES";
    ct1.font = fontBold;
    ct1.fill = totalRowFill;
    ct1.border = cellBorder;

    ct2.value = catPrevTotal;
    ct2.numFmt = fmtCurrency;
    ct2.font = fontBold;
    ct2.fill = totalRowFill;
    ct2.border = cellBorder;
    ct2.alignment = { horizontal: 'right' };

    ct3.value = catCurrTotal;
    ct3.numFmt = fmtCurrency;
    ct3.font = fontBold;
    ct3.fill = totalRowFill;
    ct3.border = cellBorder;
    ct3.alignment = { horizontal: 'right' };

    const totalCatGrowth = catPrevTotal > 0 ? ((catCurrTotal - catPrevTotal) / catPrevTotal) * 100 : 0;
    ct4.value = `${totalCatGrowth >= 0 ? '+' : ''}${totalCatGrowth.toFixed(1)}%`;
    ct4.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: totalCatGrowth >= 0 ? 'FF16A34A' : 'FFDC2626' } };
    ct4.fill = totalRowFill;
    ct4.border = cellBorder;
    ct4.alignment = { horizontal: 'right' };

    rowCursor += 3;

    // 4. STATISTIQUES CARBURANT (VOLUME)
    dashSheet.mergeCells(rowCursor, 2, rowCursor, 7);
    const fuelTitle = dashSheet.getCell(rowCursor, 2);
    fuelTitle.value = "⛽ Statistiques Carburant (Volume)";
    fuelTitle.font = fontSection;
    rowCursor++;

    // Fuel KPI Cards: Gasoil (Cols B-D) and SSP (Cols E-G)
    const gasoilDiffM3 = (fuelKpis.gasoil - fuelKpis.gasoilPrev) / 1000;
    const gasoilM3Str = `${gasoilDiffM3 >= 0 ? '+' : ''}${gasoilDiffM3.toFixed(2)} m³`;
    renderCard(
        dashSheet,
        rowCursor, 2, rowCursor + 3, 4,
        `Volume Gasoil ${period === 'year' ? year : 'Actuel'}`,
        fuelKpis.gasoil, fmtVolume,
        `${period === 'year' ? year - 1 : 'Précédent'}`, fuelKpis.gasoilPrev, 'L',
        fuelKpis.gasoilGrowth, 'FFF97316', 'FFFFF7ED', gasoilM3Str
    );

    const sspDiffM3 = (fuelKpis.ssp - fuelKpis.sspPrev) / 1000;
    const sspM3Str = `${sspDiffM3 >= 0 ? '+' : ''}${sspDiffM3.toFixed(2)} m³`;
    renderCard(
        dashSheet,
        rowCursor, 5, rowCursor + 3, 7,
        `Volume SSP ${period === 'year' ? year : 'Actuel'}`,
        fuelKpis.ssp, fmtVolume,
        `${period === 'year' ? year - 1 : 'Précédent'}`, fuelKpis.sspPrev, 'L',
        fuelKpis.sspGrowth, 'FF22C55E', 'FFF0FDF4', sspM3Str
    );

    dashSheet.getRow(rowCursor).height = 18;
    dashSheet.getRow(rowCursor + 1).height = 24;
    dashSheet.getRow(rowCursor + 2).height = 16;
    dashSheet.getRow(rowCursor + 3).height = 18;
    rowCursor += 5;

    // Fuel Detailed Table (Volume)
    dashSheet.mergeCells(rowCursor, 2, rowCursor, 7);
    dashSheet.getCell(rowCursor, 2).value = "Détail de l'évolution des Volumes Vendus :";
    dashSheet.getCell(rowCursor, 2).font = fontBold;
    rowCursor++;

    const fuelHeaders = ['Date / Période', `Gasoil ${prevYearLabel}`, `Gasoil ${currYearLabel}`, 'Évol. Gasoil', `SSP ${prevYearLabel}`, `SSP ${currYearLabel}`, 'Évol. SSP'];
    const fuelCols = [2, 3, 4, 5, 6, 7, 8];
    // Ensure column H has proper width
    dashSheet.getColumn(8).width = 18;

    const fuelHeaderRow = dashSheet.getRow(rowCursor);
    fuelHeaderRow.height = 24;
    fuelHeaders.forEach((h, i) => {
        const cell = fuelHeaderRow.getCell(fuelCols[i]);
        cell.value = h;
        cell.font = fontTableHeader;
        cell.fill = headerFill;
        cell.border = cellBorder;
        cell.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' };
    });
    rowCursor++;

    let sumGasoilPrev = 0, sumGasoilCurr = 0, sumSspPrev = 0, sumSspCurr = 0;
    fuelData?.forEach((d, idx) => {
        const row = dashSheet.getRow(rowCursor);
        row.height = 19;
        const gGrowth = d.gasoilPrev > 0 ? ((d.gasoil - d.gasoilPrev) / d.gasoilPrev) * 100 : 0;
        const sGrowth = d.sspPrev > 0 ? ((d.ssp - d.sspPrev) / d.sspPrev) * 100 : 0;

        const cells = [
            row.getCell(2), row.getCell(3), row.getCell(4),
            row.getCell(5), row.getCell(6), row.getCell(7), row.getCell(8)
        ];

        cells[0].value = d.name;
        cells[0].font = fontBold;

        cells[1].value = d.gasoilPrev || 0;
        cells[1].numFmt = fmtVolume;

        cells[2].value = d.gasoil || 0;
        cells[2].numFmt = fmtVolume;
        cells[2].font = fontBold;

        cells[3].value = `${gGrowth >= 0 ? '+' : ''}${gGrowth.toFixed(1)}%`;
        cells[3].font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: gGrowth >= 0 ? 'FF16A34A' : 'FFDC2626' } };

        cells[4].value = d.sspPrev || 0;
        cells[4].numFmt = fmtVolume;

        cells[5].value = d.ssp || 0;
        cells[5].numFmt = fmtVolume;
        cells[5].font = fontBold;

        cells[6].value = `${sGrowth >= 0 ? '+' : ''}${sGrowth.toFixed(1)}%`;
        cells[6].font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: sGrowth >= 0 ? 'FF16A34A' : 'FFDC2626' } };

        cells.forEach((c, i) => {
            c.border = cellBorder;
            c.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' };
            if (idx % 2 === 1) c.fill = zebraFill;
        });

        sumGasoilPrev += d.gasoilPrev || 0;
        sumGasoilCurr += d.gasoil || 0;
        sumSspPrev += d.sspPrev || 0;
        sumSspCurr += d.ssp || 0;
        rowCursor++;
    });

    // Total Fuel Volume Row
    const fuelTotRow = dashSheet.getRow(rowCursor);
    fuelTotRow.height = 22;
    const totGGrowth = sumGasoilPrev > 0 ? ((sumGasoilCurr - sumGasoilPrev) / sumGasoilPrev) * 100 : 0;
    const totSGrowth = sumSspPrev > 0 ? ((sumSspCurr - sumSspPrev) / sumSspPrev) * 100 : 0;

    const ftCells = [
        fuelTotRow.getCell(2), fuelTotRow.getCell(3), fuelTotRow.getCell(4),
        fuelTotRow.getCell(5), fuelTotRow.getCell(6), fuelTotRow.getCell(7), fuelTotRow.getCell(8)
    ];
    ftCells[0].value = "TOTAL VOLUMES";
    ftCells[1].value = sumGasoilPrev;
    ftCells[1].numFmt = fmtVolume;
    ftCells[2].value = sumGasoilCurr;
    ftCells[2].numFmt = fmtVolume;
    ftCells[3].value = `${totGGrowth >= 0 ? '+' : ''}${totGGrowth.toFixed(1)}%`;
    ftCells[4].value = sumSspPrev;
    ftCells[4].numFmt = fmtVolume;
    ftCells[5].value = sumSspCurr;
    ftCells[5].numFmt = fmtVolume;
    ftCells[6].value = `${totSGrowth >= 0 ? '+' : ''}${totSGrowth.toFixed(1)}%`;

    ftCells.forEach((c, i) => {
        c.font = fontBold;
        c.fill = totalRowFill;
        c.border = cellBorder;
        c.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' };
    });
    rowCursor += 3;

    // 5. STATISTIQUES CARBURANT (CHIFFRE D'AFFAIRES)
    dashSheet.mergeCells(rowCursor, 2, rowCursor, 7);
    const fuelRevTitle = dashSheet.getCell(rowCursor, 2);
    fuelRevTitle.value = "💰 Statistiques Carburant (Chiffre d'Affaires)";
    fuelRevTitle.font = fontSection;
    rowCursor++;

    // Fuel Revenue KPI Cards
    const gasoilRevDiff = fuelRevenueKpis.gasoil - fuelRevenueKpis.gasoilPrev;
    const gasoilDiffDHStr = `${gasoilRevDiff >= 0 ? '+' : ''}${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(gasoilRevDiff)} DH`;
    renderCard(
        dashSheet,
        rowCursor, 2, rowCursor + 3, 4,
        `CA Gasoil ${period === 'year' ? year : 'Actuel'}`,
        fuelRevenueKpis.gasoil, fmtCurrency,
        `${period === 'year' ? year - 1 : 'Précédent'}`, fuelRevenueKpis.gasoilPrev, 'DH',
        fuelRevenueKpis.gasoilGrowth, 'FFEA580C', 'FFFFF7ED', gasoilDiffDHStr
    );

    const sspRevDiff = fuelRevenueKpis.ssp - fuelRevenueKpis.sspPrev;
    const sspDiffDHStr = `${sspRevDiff >= 0 ? '+' : ''}${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(sspRevDiff)} DH`;
    renderCard(
        dashSheet,
        rowCursor, 5, rowCursor + 3, 7,
        `CA SSP ${period === 'year' ? year : 'Actuel'}`,
        fuelRevenueKpis.ssp, fmtCurrency,
        `${period === 'year' ? year - 1 : 'Précédent'}`, fuelRevenueKpis.sspPrev, 'DH',
        fuelRevenueKpis.sspGrowth, 'FF16A34A', 'FFF0FDF4', sspDiffDHStr
    );

    dashSheet.getRow(rowCursor).height = 18;
    dashSheet.getRow(rowCursor + 1).height = 24;
    dashSheet.getRow(rowCursor + 2).height = 16;
    dashSheet.getRow(rowCursor + 3).height = 18;
    rowCursor += 5;

    // Fuel Revenue Detailed Table
    dashSheet.mergeCells(rowCursor, 2, rowCursor, 7);
    dashSheet.getCell(rowCursor, 2).value = "Détail du Chiffre d'Affaires Carburant :";
    dashSheet.getCell(rowCursor, 2).font = fontBold;
    rowCursor++;

    const fuelRevHeaders = ['Date / Période', `CA Gasoil ${prevYearLabel}`, `CA Gasoil ${currYearLabel}`, 'Évol. Gasoil', `CA SSP ${prevYearLabel}`, `CA SSP ${currYearLabel}`, 'Évol. SSP'];
    const fuelRevHeaderRow = dashSheet.getRow(rowCursor);
    fuelRevHeaderRow.height = 24;
    fuelRevHeaders.forEach((h, i) => {
        const cell = fuelRevHeaderRow.getCell(fuelCols[i]);
        cell.value = h;
        cell.font = fontTableHeader;
        cell.fill = headerFill;
        cell.border = cellBorder;
        cell.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' };
    });
    rowCursor++;

    let sumGRevPrev = 0, sumGRevCurr = 0, sumSRevPrev = 0, sumSRevCurr = 0;
    fuelRevenueData?.forEach((d, idx) => {
        const row = dashSheet.getRow(rowCursor);
        row.height = 19;
        const gGrowth = d.gasoilPrev > 0 ? ((d.gasoil - d.gasoilPrev) / d.gasoilPrev) * 100 : 0;
        const sGrowth = d.sspPrev > 0 ? ((d.ssp - d.sspPrev) / d.sspPrev) * 100 : 0;

        const cells = [
            row.getCell(2), row.getCell(3), row.getCell(4),
            row.getCell(5), row.getCell(6), row.getCell(7), row.getCell(8)
        ];

        cells[0].value = d.name;
        cells[0].font = fontBold;

        cells[1].value = d.gasoilPrev || 0;
        cells[1].numFmt = fmtCurrency;

        cells[2].value = d.gasoil || 0;
        cells[2].numFmt = fmtCurrency;
        cells[2].font = fontBold;

        cells[3].value = `${gGrowth >= 0 ? '+' : ''}${gGrowth.toFixed(1)}%`;
        cells[3].font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: gGrowth >= 0 ? 'FF16A34A' : 'FFDC2626' } };

        cells[4].value = d.sspPrev || 0;
        cells[4].numFmt = fmtCurrency;

        cells[5].value = d.ssp || 0;
        cells[5].numFmt = fmtCurrency;
        cells[5].font = fontBold;

        cells[6].value = `${sGrowth >= 0 ? '+' : ''}${sGrowth.toFixed(1)}%`;
        cells[6].font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: sGrowth >= 0 ? 'FF16A34A' : 'FFDC2626' } };

        cells.forEach((c, i) => {
            c.border = cellBorder;
            c.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' };
            if (idx % 2 === 1) c.fill = zebraFill;
        });

        sumGRevPrev += d.gasoilPrev || 0;
        sumGRevCurr += d.gasoil || 0;
        sumSRevPrev += d.sspPrev || 0;
        sumSRevCurr += d.ssp || 0;
        rowCursor++;
    });

    // Total Fuel Revenue Row
    const fuelRevTotRow = dashSheet.getRow(rowCursor);
    fuelRevTotRow.height = 22;
    const totGRevGrowth = sumGRevPrev > 0 ? ((sumGRevCurr - sumGRevPrev) / sumGRevPrev) * 100 : 0;
    const totSRevGrowth = sumSRevPrev > 0 ? ((sumSRevCurr - sumSRevPrev) / sumSRevPrev) * 100 : 0;

    const frtCells = [
        fuelRevTotRow.getCell(2), fuelRevTotRow.getCell(3), fuelRevTotRow.getCell(4),
        fuelRevTotRow.getCell(5), fuelRevTotRow.getCell(6), fuelRevTotRow.getCell(7), fuelRevTotRow.getCell(8)
    ];
    frtCells[0].value = "TOTAL REVENUS CARBURANT";
    frtCells[1].value = sumGRevPrev;
    frtCells[1].numFmt = fmtCurrency;
    frtCells[2].value = sumGRevCurr;
    frtCells[2].numFmt = fmtCurrency;
    frtCells[3].value = `${totGRevGrowth >= 0 ? '+' : ''}${totGRevGrowth.toFixed(1)}%`;
    frtCells[4].value = sumSRevPrev;
    frtCells[4].numFmt = fmtCurrency;
    frtCells[5].value = sumSRevCurr;
    frtCells[5].numFmt = fmtCurrency;
    frtCells[6].value = `${totSRevGrowth >= 0 ? '+' : ''}${totSRevGrowth.toFixed(1)}%`;

    frtCells.forEach((c, i) => {
        c.font = fontBold;
        c.fill = totalRowFill;
        c.border = cellBorder;
        c.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' };
    });
    rowCursor += 3;

    // 6. STATISTIQUES LUBRIFIANTS
    dashSheet.mergeCells(rowCursor, 2, rowCursor, 7);
    const lubTitle = dashSheet.getCell(rowCursor, 2);
    lubTitle.value = "💧 Statistiques Lubrifiants (Volume, Masse, CA)";
    lubTitle.font = fontSection;
    rowCursor++;

    // 3 Cards: Litres (Cols B-C), kg (Cols D-E), Valeur DH (Cols F-G)
    renderCard(
        dashSheet,
        rowCursor, 2, rowCursor + 3, 3,
        "Volume Global (Litres)",
        lubKpis.liters, fmtVolume,
        "Précédent", lubKpis.litersPrev, "L",
        lubKpis.litersGrowth, "FF2563EB", "FFEFF6FF"
    );

    renderCard(
        dashSheet,
        rowCursor, 4, rowCursor + 3, 5,
        "Masse Globale (kg)",
        lubKpis.kg, fmtWeight,
        "Précédent", lubKpis.kgPrev, "kg",
        lubKpis.kgGrowth, "FF4F46E5", "FFEEF2FF"
    );

    renderCard(
        dashSheet,
        rowCursor, 6, rowCursor + 3, 7,
        "Chiffre d'Affaires (DH)",
        lubKpis.val, fmtCurrency,
        "Précédent", lubKpis.valPrev, "DH",
        lubKpis.valGrowth, "FF059669", "FFECFDF5"
    );

    dashSheet.getRow(rowCursor).height = 18;
    dashSheet.getRow(rowCursor + 1).height = 24;
    dashSheet.getRow(rowCursor + 2).height = 16;
    dashSheet.getRow(rowCursor + 3).height = 18;
    rowCursor += 5;

    // Lubricants Detailed Table
    dashSheet.mergeCells(rowCursor, 2, rowCursor, 7);
    dashSheet.getCell(rowCursor, 2).value = "Détail de l'évolution temporelle des Lubrifiants :";
    dashSheet.getCell(rowCursor, 2).font = fontBold;
    rowCursor++;

    const lubHeaders = ['Date / Période', `Litres ${prevYearLabel}`, `Litres ${currYearLabel}`, `Masse kg ${prevYearLabel}`, `Masse kg ${currYearLabel}`, `CA ${prevYearLabel}`, `CA ${currYearLabel}`];
    const lubHeaderRow = dashSheet.getRow(rowCursor);
    lubHeaderRow.height = 24;
    lubHeaders.forEach((h, i) => {
        const cell = lubHeaderRow.getCell(i + 2);
        cell.value = h;
        cell.font = fontTableHeader;
        cell.fill = headerFill;
        cell.border = cellBorder;
        cell.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' };
    });
    rowCursor++;

    let sumLubLPrev = 0, sumLubLCurr = 0, sumLubKgPrev = 0, sumLubKgCurr = 0, sumLubVPrev = 0, sumLubVCurr = 0;
    lubData?.forEach((d, idx) => {
        const row = dashSheet.getRow(rowCursor);
        row.height = 19;

        const cells = [
            row.getCell(2), row.getCell(3), row.getCell(4),
            row.getCell(5), row.getCell(6), row.getCell(7), row.getCell(8)
        ];

        cells[0].value = d.name;
        cells[0].font = fontBold;

        cells[1].value = d.litersPrev || 0;
        cells[1].numFmt = fmtVolume;

        cells[2].value = d.liters || 0;
        cells[2].numFmt = fmtVolume;
        cells[2].font = fontBold;

        cells[3].value = d.kgPrev || 0;
        cells[3].numFmt = fmtWeight;

        cells[4].value = d.kg || 0;
        cells[4].numFmt = fmtWeight;
        cells[4].font = fontBold;

        cells[5].value = d.valPrev || 0;
        cells[5].numFmt = fmtCurrency;

        cells[6].value = d.val || 0;
        cells[6].numFmt = fmtCurrency;
        cells[6].font = fontBold;

        cells.forEach((c, i) => {
            c.border = cellBorder;
            c.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' };
            if (idx % 2 === 1) c.fill = zebraFill;
        });

        sumLubLPrev += d.litersPrev || 0;
        sumLubLCurr += d.liters || 0;
        sumLubKgPrev += d.kgPrev || 0;
        sumLubKgCurr += d.kg || 0;
        sumLubVPrev += d.valPrev || 0;
        sumLubVCurr += d.val || 0;
        rowCursor++;
    });

    // Total Lubricants Row
    const lubTotRow = dashSheet.getRow(rowCursor);
    lubTotRow.height = 22;
    const ltCells = [
        lubTotRow.getCell(2), lubTotRow.getCell(3), lubTotRow.getCell(4),
        lubTotRow.getCell(5), lubTotRow.getCell(6), lubTotRow.getCell(7), lubTotRow.getCell(8)
    ];
    ltCells[0].value = "TOTAL LUBRIFIANTS";
    ltCells[1].value = sumLubLPrev;
    ltCells[1].numFmt = fmtVolume;
    ltCells[2].value = sumLubLCurr;
    ltCells[2].numFmt = fmtVolume;
    ltCells[3].value = sumLubKgPrev;
    ltCells[3].numFmt = fmtWeight;
    ltCells[4].value = sumLubKgCurr;
    ltCells[4].numFmt = fmtWeight;
    ltCells[5].value = sumLubVPrev;
    ltCells[5].numFmt = fmtCurrency;
    ltCells[6].value = sumLubVCurr;
    ltCells[6].numFmt = fmtCurrency;

    ltCells.forEach((c, i) => {
        c.font = fontBold;
        c.fill = totalRowFill;
        c.border = cellBorder;
        c.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' };
    });

    // =========================================================================
    // FEUILLE 2 : DÉTAILS PAR CATÉGORIE (TABLEAU DÉDIÉ)
    // =========================================================================
    const catSheet = workbook.addWorksheet("Détails Catégories", { views: [{ showGridLines: true }] });
    catSheet.columns = [
        { header: 'Catégorie', key: 'name', width: 28 },
        { header: `CA ${prevYearLabel}`, key: 'previous', width: 22 },
        { header: `CA ${currYearLabel}`, key: 'current', width: 22 },
        { header: 'Évolution (%)', key: 'growth', width: 18 }
    ];
    catSheet.getRow(1).height = 28;
    catSheet.getRow(1).eachCell((cell) => {
        cell.font = fontTableHeader;
        cell.fill = headerFill;
        cell.border = cellBorder;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    categoryDetails?.forEach((c, idx) => {
        const row = catSheet.addRow({
            name: c.name,
            previous: c.previous || 0,
            current: c.current || 0,
            growth: `${(c.growth || 0) >= 0 ? '+' : ''}${(c.growth || 0).toFixed(1)}%`
        });
        row.getCell(2).numFmt = fmtCurrency;
        row.getCell(3).numFmt = fmtCurrency;
        row.eachCell((cell, i) => {
            cell.font = i === 1 ? fontBold : fontMain;
            cell.border = cellBorder;
            cell.alignment = { horizontal: i === 1 ? 'left' : 'right', vertical: 'middle' };
            if (idx % 2 === 1) cell.fill = zebraFill;
        });
    });

    // =========================================================================
    // FEUILLE 3 : VOLUMES CARBURANTS (TABLEAU DÉDIÉ)
    // =========================================================================
    const fuelSheet = workbook.addWorksheet("Volumes Carburants", { views: [{ showGridLines: true }] });
    fuelSheet.columns = [
        { header: 'Date / Période', key: 'name', width: 24 },
        { header: `Gasoil ${prevYearLabel} (L)`, key: 'gasoilPrev', width: 22 },
        { header: `Gasoil ${currYearLabel} (L)`, key: 'gasoil', width: 22 },
        { header: 'Évol. Gasoil (%)', key: 'gGrowth', width: 18 },
        { header: `SSP ${prevYearLabel} (L)`, key: 'sspPrev', width: 22 },
        { header: `SSP ${currYearLabel} (L)`, key: 'ssp', width: 22 },
        { header: 'Évol. SSP (%)', key: 'sGrowth', width: 18 }
    ];
    fuelSheet.getRow(1).height = 28;
    fuelSheet.getRow(1).eachCell((cell) => {
        cell.font = fontTableHeader;
        cell.fill = headerFill;
        cell.border = cellBorder;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    fuelData?.forEach((d, idx) => {
        const gGrowth = d.gasoilPrev > 0 ? ((d.gasoil - d.gasoilPrev) / d.gasoilPrev) * 100 : 0;
        const sGrowth = d.sspPrev > 0 ? ((d.ssp - d.sspPrev) / d.sspPrev) * 100 : 0;
        const row = fuelSheet.addRow({
            name: d.name,
            gasoilPrev: d.gasoilPrev || 0,
            gasoil: d.gasoil || 0,
            gGrowth: `${gGrowth >= 0 ? '+' : ''}${gGrowth.toFixed(1)}%`,
            sspPrev: d.sspPrev || 0,
            ssp: d.ssp || 0,
            sGrowth: `${sGrowth >= 0 ? '+' : ''}${sGrowth.toFixed(1)}%`
        });
        row.getCell(2).numFmt = fmtVolume;
        row.getCell(3).numFmt = fmtVolume;
        row.getCell(5).numFmt = fmtVolume;
        row.getCell(6).numFmt = fmtVolume;
        row.eachCell((cell, i) => {
            cell.font = i === 1 ? fontBold : fontMain;
            cell.border = cellBorder;
            cell.alignment = { horizontal: i === 1 ? 'left' : 'right', vertical: 'middle' };
            if (idx % 2 === 1) cell.fill = zebraFill;
        });
    });

    // =========================================================================
    // FEUILLE 4 : CA CARBURANTS (TABLEAU DÉDIÉ)
    // =========================================================================
    const fuelRevSheet = workbook.addWorksheet("CA Carburants", { views: [{ showGridLines: true }] });
    fuelRevSheet.columns = [
        { header: 'Date / Période', key: 'name', width: 24 },
        { header: `CA Gasoil ${prevYearLabel}`, key: 'gasoilPrev', width: 22 },
        { header: `CA Gasoil ${currYearLabel}`, key: 'gasoil', width: 22 },
        { header: 'Évol. Gasoil (%)', key: 'gGrowth', width: 18 },
        { header: `CA SSP ${prevYearLabel}`, key: 'sspPrev', width: 22 },
        { header: `CA SSP ${currYearLabel}`, key: 'ssp', width: 22 },
        { header: 'Évol. SSP (%)', key: 'sGrowth', width: 18 }
    ];
    fuelRevSheet.getRow(1).height = 28;
    fuelRevSheet.getRow(1).eachCell((cell) => {
        cell.font = fontTableHeader;
        cell.fill = headerFill;
        cell.border = cellBorder;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    fuelRevenueData?.forEach((d, idx) => {
        const gGrowth = d.gasoilPrev > 0 ? ((d.gasoil - d.gasoilPrev) / d.gasoilPrev) * 100 : 0;
        const sGrowth = d.sspPrev > 0 ? ((d.ssp - d.sspPrev) / d.sspPrev) * 100 : 0;
        const row = fuelRevSheet.addRow({
            name: d.name,
            gasoilPrev: d.gasoilPrev || 0,
            gasoil: d.gasoil || 0,
            gGrowth: `${gGrowth >= 0 ? '+' : ''}${gGrowth.toFixed(1)}%`,
            sspPrev: d.sspPrev || 0,
            ssp: d.ssp || 0,
            sGrowth: `${sGrowth >= 0 ? '+' : ''}${sGrowth.toFixed(1)}%`
        });
        row.getCell(2).numFmt = fmtCurrency;
        row.getCell(3).numFmt = fmtCurrency;
        row.getCell(5).numFmt = fmtCurrency;
        row.getCell(6).numFmt = fmtCurrency;
        row.eachCell((cell, i) => {
            cell.font = i === 1 ? fontBold : fontMain;
            cell.border = cellBorder;
            cell.alignment = { horizontal: i === 1 ? 'left' : 'right', vertical: 'middle' };
            if (idx % 2 === 1) cell.fill = zebraFill;
        });
    });

    // =========================================================================
    // FEUILLE 5 : LUBRIFIANTS (TABLEAU DÉDIÉ)
    // =========================================================================
    const lubSheet = workbook.addWorksheet("Lubrifiants", { views: [{ showGridLines: true }] });
    lubSheet.columns = [
        { header: 'Date / Période', key: 'name', width: 24 },
        { header: `Litres ${prevYearLabel}`, key: 'litersPrev', width: 18 },
        { header: `Litres ${currYearLabel}`, key: 'liters', width: 18 },
        { header: `Masse kg ${prevYearLabel}`, key: 'kgPrev', width: 18 },
        { header: `Masse kg ${currYearLabel}`, key: 'kg', width: 18 },
        { header: `CA ${prevYearLabel}`, key: 'valPrev', width: 20 },
        { header: `CA ${currYearLabel}`, key: 'val', width: 20 }
    ];
    lubSheet.getRow(1).height = 28;
    lubSheet.getRow(1).eachCell((cell) => {
        cell.font = fontTableHeader;
        cell.fill = headerFill;
        cell.border = cellBorder;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    lubData?.forEach((d, idx) => {
        const row = lubSheet.addRow({
            name: d.name,
            litersPrev: d.litersPrev || 0,
            liters: d.liters || 0,
            kgPrev: d.kgPrev || 0,
            kg: d.kg || 0,
            valPrev: d.valPrev || 0,
            val: d.val || 0
        });
        row.getCell(2).numFmt = fmtVolume;
        row.getCell(3).numFmt = fmtVolume;
        row.getCell(4).numFmt = fmtWeight;
        row.getCell(5).numFmt = fmtWeight;
        row.getCell(6).numFmt = fmtCurrency;
        row.getCell(7).numFmt = fmtCurrency;
        row.eachCell((cell, i) => {
            cell.font = i === 1 ? fontBold : fontMain;
            cell.border = cellBorder;
            cell.alignment = { horizontal: i === 1 ? 'left' : 'right', vertical: 'middle' };
            if (idx % 2 === 1) cell.fill = zebraFill;
        });
    });

    // =========================================================================
    // EXPORT FILE HANDLING (WEB + MOBILE CAPACITOR)
    // =========================================================================
    const cleanPeriodStr = period === 'month'
        ? `${MONTHS_NAMES[selectedMonth]}_${year}`
        : period === 'year'
            ? `Annee_${year}`
            : period === 'custom'
                ? `${MONTHS_NAMES[customStartMonth]}_a_${MONTHS_NAMES[customEndMonth]}_${year}`
                : `${period}_${year}`;

    const fileName = `Statistiques_Petrom_${cleanPeriodStr}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();

    if (Capacitor.isNativePlatform()) {
        const base64Data = btoa(
            new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        const result = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Documents
        });
        await Share.share({
            title: fileName,
            url: result.uri,
            dialogTitle: 'Partager le fichier Excel'
        });
    } else {
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
    }
};
