import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Format currency helper
 */
const formatDH = (val) => {
    const num = Number(val) || 0;
    return `${num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH`;
};

/**
 * Export a single daily Revenue Control sheet to Excel
 */
export const exportRevenueControlToExcel = async (controlData) => {
    const {
        date,
        shifts = [],
        annexes = {},
        horsEspeces = {},
        comptageReel = 0,
        totalRendement = 0,
        totalAnnexes = 0,
        totalRecettes = 0,
        totalHorsEspeces = 0,
        soldeTheorique = 0,
        ecart = 0,
        notes = '',
        systemRendementPrev = 0,
        totalReconstitueJPrev = 0,
        ecartSystemeJPrev = null,
        prevDateStr = ''
    } = controlData;

    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Petrom - Contrôle Recettes';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Contrôle Recettes', {
        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
        views: [{ showGridLines: true }]
    });

    // Color definitions
    const PRIMARY_COLOR = '1E3A8A'; // Blue 900
    const ACCENT_COLOR = '0284C7'; // Sky 600
    const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    const SECTION_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    const SUCCESS_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
    const DANGER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
    const BORDER_THIN = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    // Columns config
    sheet.columns = [
        { width: 30 },
        { width: 25 },
        { width: 22 },
        { width: 22 },
        { width: 22 }
    ];

    let rowIndex = 1;

    // Title Banner
    sheet.mergeCells(`A${rowIndex}:E${rowIndex}`);
    const titleCell = sheet.getCell(`A${rowIndex}`);
    titleCell.value = 'PETROM — FICHE DE CONTRÔLE DES RECETTES & ARRÊTÉ DE CAISSE';
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${PRIMARY_COLOR}` } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(rowIndex).height = 36;
    rowIndex += 2;

    // Date & Statut row
    sheet.getCell(`A${rowIndex}`).value = `Date de contrôle : ${new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
    sheet.getCell(`A${rowIndex}`).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    
    sheet.mergeCells(`D${rowIndex}:E${rowIndex}`);
    const statusCell = sheet.getCell(`D${rowIndex}`);
    const isOk = Math.abs(ecart) <= 0.50;
    statusCell.value = isOk ? 'STATUT : CAISSE ÉQUILIBRÉE' : (ecart > 0 ? 'STATUT : EXCÉDENT D\'ESPÈCES' : 'STATUT : DÉFICIT D\'ESPÈCES');
    statusCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: isOk ? 'FF166534' : (ecart > 0 ? 'FF1D4ED8' : 'FF991B1B') } };
    statusCell.fill = isOk ? SUCCESS_FILL : DANGER_FILL;
    statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(rowIndex).height = 24;
    rowIndex += 2;

    // SECTION 1 : RENDEMENT PAR SHIFT & POMPISTES
    sheet.mergeCells(`A${rowIndex}:E${rowIndex}`);
    const sec1 = sheet.getCell(`A${rowIndex}`);
    sec1.value = 'SECTION 1 : RENDEMENTS PISTE PAR PÉRIODE DE TRAVAIL (SHIFTS)';
    sec1.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    sec1.fill = HEADER_FILL;
    sec1.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    sheet.getRow(rowIndex).height = 24;
    rowIndex++;

    // Shift subheaders
    const sHeaders = ['Période (Shift)', 'Pompiste en poste', 'Rendement Saisi (DH)', '', ''];
    sheet.getRow(rowIndex).values = sHeaders;
    sheet.getRow(rowIndex).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF475569' } };
    sheet.getRow(rowIndex).fill = SECTION_FILL;
    rowIndex++;

    shifts.forEach(shift => {
        const attendants = shift.attendants && shift.attendants.length > 0
            ? shift.attendants
            : [{ attendantName: '(Non assigné)', amount: 0 }];

        attendants.forEach((att, idx) => {
            const row = sheet.getRow(rowIndex);
            row.values = [
                idx === 0 ? `${shift.label} (${shift.timeRange})` : '',
                att.attendantName || '-',
                Number(att.amount) || 0
            ];
            row.getCell(3).numFmt = '#,##0.00 "DH"';
            row.font = { name: 'Segoe UI', size: 10 };
            row.getCell(1).border = BORDER_THIN;
            row.getCell(2).border = BORDER_THIN;
            row.getCell(3).border = BORDER_THIN;
            rowIndex++;
        });
    });

    // Total Rendement Row
    const rowTotRend = sheet.getRow(rowIndex);
    rowTotRend.values = ['TOTAL RENDEMENT PISTE', '', totalRendement];
    rowTotRend.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E3A8A' } };
    rowTotRend.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
    rowTotRend.getCell(3).numFmt = '#,##0.00 "DH"';
    sheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
    
    if (Number(systemRendementPrev) > 0) {
        rowIndex++;
        const rowSys = sheet.getRow(rowIndex);
        const isSysOk = ecartSystemeJPrev !== null && Math.abs(ecartSystemeJPrev) <= 0.05;
        rowSys.values = [
            `CONTRÔLE SYSTÈME (J-1: ${prevDateStr || ''})`,
            `Reconstitué: ${Number(totalReconstitueJPrev).toFixed(2)} DH | Istiraha: ${Number(systemRendementPrev).toFixed(2)} DH`,
            ecartSystemeJPrev,
            isSysOk ? 'CONFORME' : 'ÉCART'
        ];
        rowSys.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: isSysOk ? 'FF065F46' : 'FF991B1B' } };
        rowSys.fill = isSysOk ? SUCCESS_FILL : DANGER_FILL;
        rowSys.getCell(3).numFmt = '#,##0.00 "DH"';
    }

    rowIndex += 2;

    // SECTION 2 : VENTES HORS CARBURANT (ANNEXES)
    sheet.mergeCells(`A${rowIndex}:E${rowIndex}`);
    const sec2 = sheet.getCell(`A${rowIndex}`);
    sec2.value = 'SECTION 2 : VENTES HORS CARBURANT (ACTIVITÉS ANNEXES)';
    sec2.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    sec2.fill = HEADER_FILL;
    sec2.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    sheet.getRow(rowIndex).height = 24;
    rowIndex++;

    const annexesItems = [
        { label: 'Shop & Café', val: Number(annexes.shop_cafe) || 0 },
        { label: 'Service Bosch (Entretien / Diagnostic)', val: Number(annexes.sce_bosch) || 0 },
        { label: 'Lubrifiants', val: Number(annexes.lubrifiant) || 0 }
    ];

    annexesItems.forEach(item => {
        const row = sheet.getRow(rowIndex);
        row.values = [item.label, '', item.val];
        row.getCell(3).numFmt = '#,##0.00 "DH"';
        row.font = { name: 'Segoe UI', size: 10 };
        sheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
        row.getCell(1).border = BORDER_THIN;
        row.getCell(3).border = BORDER_THIN;
        rowIndex++;
    });

    // Total Annexes Row
    const rowTotAnn = sheet.getRow(rowIndex);
    rowTotAnn.values = ['TOTAL VENTES ANNEXES', '', totalAnnexes];
    rowTotAnn.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF065F46' } };
    rowTotAnn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
    rowTotAnn.getCell(3).numFmt = '#,##0.00 "DH"';
    sheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
    rowIndex += 2;

    // SECTION 3 : ENCAISSEMENTS HORS ESPÈCES
    sheet.mergeCells(`A${rowIndex}:E${rowIndex}`);
    const sec3 = sheet.getCell(`A${rowIndex}`);
    sec3.value = 'SECTION 3 : ENCAISSEMENTS HORS ESPÈCES (DÉMATÉRIALISÉS / CRÉDITS)';
    sec3.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    sec3.fill = HEADER_FILL;
    sec3.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    sheet.getRow(rowIndex).height = 24;
    rowIndex++;

    const horsEspItems = [
        { label: 'CMI (Cartes Bancaires TPE)', val: Number(horsEspeces.tpe) || 0 },
        { label: 'Petrom Card', val: Number(horsEspeces.petrom_card) || 0 },
        { label: 'Bons à Crédit Client (Bons Sté)', val: Number(horsEspeces.bon_ste) || 0 },
        { label: 'Bons à Crédit SNTL', val: Number(horsEspeces.bon_sntl) || 0 }
    ];

    horsEspItems.forEach(item => {
        const row = sheet.getRow(rowIndex);
        row.values = [item.label, '', item.val];
        row.getCell(3).numFmt = '#,##0.00 "DH"';
        row.font = { name: 'Segoe UI', size: 10 };
        sheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
        row.getCell(1).border = BORDER_THIN;
        row.getCell(3).border = BORDER_THIN;
        rowIndex++;
    });

    // Total Hors Especes Row
    const rowTotHE = sheet.getRow(rowIndex);
    rowTotHE.values = ['TOTAL ENCAISSEMENTS HORS ESPÈCES', '', totalHorsEspeces];
    rowTotHE.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF92400E' } };
    rowTotHE.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
    rowTotHE.getCell(3).numFmt = '#,##0.00 "DH"';
    sheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
    rowIndex += 2;

    // SECTION 4 : SYNTHÈSE & RÉCONCILIATION THÉORIQUE VS RÉEL
    sheet.mergeCells(`A${rowIndex}:E${rowIndex}`);
    const sec4 = sheet.getCell(`A${rowIndex}`);
    sec4.value = 'SECTION 4 : SYNTHÈSE & CONTRÔLE DE CAISSE (RÉCONCILIATION)';
    sec4.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    sec4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
    sec4.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    sheet.getRow(rowIndex).height = 24;
    rowIndex++;

    const synthRows = [
        { label: 'Total Recettes Brutes (Rendement + Annexes)', val: totalRecettes, color: 'FF1E293B' },
        { label: '(-) Moins Encaissements Hors Espèces', val: totalHorsEspeces, color: 'FF92400E' },
        { label: '(=) Solde Théorique Espèces Attendu', val: soldeTheorique, bold: true, color: 'FF0369A1' },
        { label: 'Comptage Réel en Espèces (Coffre / Caisse)', val: comptageReel, bold: true, color: 'FF475569' },
        { label: 'ÉCART FINAL (Comptage Réel - Solde Théorique)', val: ecart, bold: true, color: isOk ? 'FF166534' : 'FF991B1B', highlight: true }
    ];

    synthRows.forEach(item => {
        const row = sheet.getRow(rowIndex);
        row.values = [item.label, '', item.val];
        row.getCell(3).numFmt = '#,##0.00 "DH"';
        row.font = { name: 'Segoe UI', size: 10, bold: !!item.bold, color: { argb: item.color } };
        sheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
        if (item.highlight) {
            row.fill = isOk ? SUCCESS_FILL : DANGER_FILL;
        }
        row.getCell(1).border = BORDER_THIN;
        row.getCell(3).border = BORDER_THIN;
        rowIndex++;
    });
    rowIndex++;

    // NOTES SECTION
    if (notes && notes.trim().length > 0) {
        sheet.mergeCells(`A${rowIndex}:E${rowIndex}`);
        const nHeader = sheet.getCell(`A${rowIndex}`);
        nHeader.value = 'OBSERVATIONS & JUSTIFICATIONS';
        nHeader.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF334155' } };
        nHeader.fill = SECTION_FILL;
        rowIndex++;

        sheet.mergeCells(`A${rowIndex}:E${rowIndex + 1}`);
        const nContent = sheet.getCell(`A${rowIndex}`);
        nContent.value = notes;
        nContent.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF475569' } };
        nContent.alignment = { wrapText: true, vertical: 'top' };
        rowIndex += 2;
    }

    // Write file & trigger download / share
    const fileName = `Controle_Recettes_${date}.xlsx`;
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

/**
 * Export full 30-day History table to Excel
 */
export const exportRevenueControlHistoryToExcel = async (historyList = []) => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Petrom - Contrôle Recettes';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Historique Contrôle Recettes', {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
        views: [{ showGridLines: true }]
    });

    const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    const SUCCESS_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
    const DANGER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
    const BORDER_THIN = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    sheet.columns = [
        { width: 14 }, // Date
        { width: 22 }, // Total Rendement Piste
        { width: 20 }, // Ventes Annexes
        { width: 22 }, // Total Recettes Brutes
        { width: 24 }, // Encaissements Hors Espèces
        { width: 22 }, // Solde Théorique Espèces
        { width: 22 }, // Comptage Réel Espèces
        { width: 20 }, // Écart
        { width: 18 }, // Statut
        { width: 32 }  // Notes
    ];

    // Title
    sheet.mergeCells('A1:J1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'PETROM — HISTORIQUE DU CONTRÔLE DES RECETTES DE CAISSE';
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 34;

    // Headers
    const headers = [
        'Date',
        'Rendement Piste',
        'Ventes Annexes',
        'Total Recettes',
        'Hors Espèces (C)',
        'Solde Théo Espèces',
        'Comptage Réel',
        'Écart (Réel - Théo)',
        'Statut',
        'Notes'
    ];
    sheet.getRow(3).values = headers;
    sheet.getRow(3).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(3).fill = HEADER_FILL;
    sheet.getRow(3).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(3).height = 26;

    historyList.forEach((row, i) => {
        const rIndex = 4 + i;
        const curRow = sheet.getRow(rIndex);

        let rendTotal = 0;
        if (row.shifts_data && Array.isArray(row.shifts_data)) {
            row.shifts_data.forEach(s => (s.attendants || []).forEach(a => rendTotal += Number(a.amount) || 0));
        }
        if (rendTotal === 0 && row.total_rendement_piste) {
            rendTotal = Number(row.total_rendement_piste) || 0;
        }
        if (rendTotal === 0) {
            rendTotal = (Number(row.total_rendement_j_prev) - Number(row.recette_8h_j_prev)) + Number(row.recette_8h_j);
        }

        const annexesTotal = (Number(row.shop_cafe) || 0) + (Number(row.sce_bosch) || 0) + (Number(row.lubrifiant) || 0);
        const totalRecettes = rendTotal + annexesTotal;
        const horsEspecesTotal = (Number(row.tpe) || 0) + (Number(row.petrom_card) || 0) + (Number(row.bon_ste) || 0) + (Number(row.bon_sntl) || 0);
        const theoEspeces = totalRecettes - horsEspecesTotal;
        const reelEspeces = Number(row.comptage_espece_total) || 0;
        const ecart = reelEspeces - theoEspeces;
        const isOk = Math.abs(ecart) <= 0.50;

        curRow.values = [
            new Date(row.date).toLocaleDateString('fr-FR'),
            rendTotal,
            annexesTotal,
            totalRecettes,
            horsEspecesTotal,
            theoEspeces,
            reelEspeces,
            ecart,
            isOk ? 'OK' : (ecart > 0 ? 'Excédent' : 'Déficit'),
            row.notes || ''
        ];

        [2, 3, 4, 5, 6, 7, 8].forEach(col => {
            curRow.getCell(col).numFmt = '#,##0.00 "DH"';
        });

        curRow.font = { name: 'Segoe UI', size: 9 };
        curRow.getCell(8).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: isOk ? 'FF166534' : 'FF991B1B' } };
        curRow.getCell(8).fill = isOk ? SUCCESS_FILL : DANGER_FILL;
        curRow.getCell(9).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: isOk ? 'FF166534' : (ecart > 0 ? 'FF1D4ED8' : 'FF991B1B') } };

        for (let col = 1; col <= 10; col++) {
            curRow.getCell(col).border = BORDER_THIN;
        }
    });

    const fileName = `Historique_Controle_Recettes_${new Date().toISOString().split('T')[0]}.xlsx`;
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
