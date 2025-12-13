
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SHIFT_TYPES, TEAMS } from './rotationLogic';

// Start Row as defined by analysis (Row 9 is the first data row)
const START_ROW = 9;

// Map internal shift types to the specific Excel status strings required by the formulas
const getExcelStatus = (shiftType) => {
    switch (shiftType) {
        case SHIFT_TYPES.JOUR:
            return 'Travail'; // Standard Day
        case SHIFT_TYPES.NUIT:
            return 'Travail2'; // Night (Ends next day)
        case SHIFT_TYPES.TWENTY_FOUR:
            return 'Travail2'; // 24h (Ends next day)
        case SHIFT_TYPES.REPOS:
            return ''; // Empty for Repos
        case SHIFT_TYPES.CONGE:
            return 'Congé'; // Keep descriptive text, but it won't trigger formulas
        case SHIFT_TYPES.MALADIE:
            return 'Maladie';
        default:
            return '';
    }
};

const getTeamDescription = (teamName, shiftType) => {
    if (shiftType === SHIFT_TYPES.REPOS || shiftType === SHIFT_TYPES.CONGE || shiftType === SHIFT_TYPES.MALADIE) {
        return '';
    }
    // "Equipe 1" = Day Work (Jour/24h)
    // "Equipe 2" = Night Work (Nuit)
    if (shiftType === SHIFT_TYPES.NUIT) return 'Equipe 2';
    if (shiftType === SHIFT_TYPES.JOUR || shiftType === SHIFT_TYPES.TWENTY_FOUR) return 'Equipe 1';
    return '';
};

// Helper to copy a worksheet's content to another
const cloneSheet = (sourceSheet, targetSheet) => {
    if (sourceSheet.columns) {
        targetSheet.columns = sourceSheet.columns.map(col => ({
            key: col.key,
            width: col.width,
            style: col.style
        }));
    }

    sourceSheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const targetRow = targetSheet.getRow(rowNumber);
        targetRow.height = row.height;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const targetCell = targetRow.getCell(colNumber);
            targetCell.style = JSON.parse(JSON.stringify(cell.style));

            // Fix: Do NOT copy values for data rows (Row >= START_ROW).
            // This prevents copying "Shared Formula" definitions from the template which 
            // break when we overwrite the "master" cell with our own custom formulas.
            // We only copy headers (Row < 9).

            if (rowNumber < START_ROW) {
                targetCell.value = cell.value;
            } else {
                // For data rows, leave value empty (null).
                // We will fill specific data in the loop.
                targetCell.value = null;
            }
        });
        targetRow.commit();
    });

    if (sourceSheet.model.merges) {
        sourceSheet.model.merges.forEach(mergeRange => {
            targetSheet.mergeCells(mergeRange);
        });
    }
};

export const exportPlanningToExcel = async (startDate, endDate, shifts, employees) => {
    // 1. Load Template
    const response = await fetch(`/Classeur1.xlsx?t=${Date.now()}`);
    const templateBuffer = await response.arrayBuffer();

    const templateWorkbook = new ExcelJS.Workbook();
    await templateWorkbook.xlsx.load(templateBuffer);
    const masterSheet = templateWorkbook.worksheets[0];

    const outputWorkbook = new ExcelJS.Workbook();

    // Remove default sheet if any (ExcelJS sometimes starts with 'Sheet 1')
    outputWorkbook.removeWorksheet(outputWorkbook.worksheets[0]?.id);

    const days = [];
    let dt = new Date(startDate);
    while (dt <= endDate) {
        days.push(new Date(dt));
        dt.setDate(dt.getDate() + 1);
    }

    // 2. Generate Sheets Per Day
    for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const sheetName = format(day, 'dd-MM-yyyy');

        const sheet = outputWorkbook.addWorksheet(sheetName, {
            pageSetup: masterSheet.pageSetup,
            properties: masterSheet.properties,
            views: masterSheet.views
        });

        cloneSheet(masterSheet, sheet);

        // VITAL: Set the reference date in M21
        const m21Cell = sheet.getCell('M21');
        m21Cell.value = day;
        m21Cell.numFmt = 'dd/mm/yyyy';

        // Calculate Day-Specific Sorting
        const daySortedEmployees = [...employees].sort((a, b) => {
            const shiftA = shifts[`${a.id}-${dateStr}`] || SHIFT_TYPES.REPOS;
            const shiftB = shifts[`${b.id}-${dateStr}`] || SHIFT_TYPES.REPOS;

            const getRank = (shift) => {
                if (shift === SHIFT_TYPES.JOUR || shift === SHIFT_TYPES.TWENTY_FOUR) return 1;
                if (shift === SHIFT_TYPES.NUIT) return 2;
                return 3;
            };

            const rankA = getRank(shiftA);
            const rankB = getRank(shiftB);

            if (rankA !== rankB) return rankA - rankB;
            return a.name.localeCompare(b.name);
        });

        let currentRowIdx = START_ROW;

        // Iterate Sorted Employees
        daySortedEmployees.forEach(emp => {
            const shiftType = shifts[`${emp.id}-${dateStr}`] || SHIFT_TYPES.REPOS;
            const excelStatus = getExcelStatus(shiftType);

            const row = sheet.getRow(currentRowIdx);

            const dateFormatted = format(day, 'EEEE dd-MM-yyyy', { locale: fr });

            // B: Date ("Samedi 15-11-2025")
            row.getCell(2).value = dateFormatted;

            // C: Team Description
            row.getCell(3).value = getTeamDescription(emp.team, shiftType);

            // D: Name
            row.getCell(4).value = emp.name;

            // E: Qualification
            row.getCell(5).value = emp.role;

            // F: Status
            row.getCell(6).value = excelStatus;

            // INJECT FORMULAS if 'Travail' or 'Travail2'
            if (excelStatus === 'Travail' || excelStatus === 'Travail2') {
                const r = currentRowIdx;

                // G: Start
                row.getCell(7).value = { formula: `IF(OR(F${r}="Travail",F${r}="Travail2"),$M$21 + "08:00", "")` };
                row.getCell(7).numFmt = 'h:mm';

                // H: End
                row.getCell(8).value = { formula: `IF(F${r}="Travail2",$M$21+1 + "08:00",IF(F${r}="Travail", $M$21+ "18:00",""))` };
                row.getCell(8).numFmt = 'dd/mm/yyyy h:mm';

                // I: Pause
                row.getCell(9).value = { formula: `IF(F${r}="Travail2", "2:00"*1, IF(F${r}="Travail", "1:00"*1, ""))` };
                row.getCell(9).numFmt = '[h]:mm';

                // J: Total
                row.getCell(10).value = { formula: `IF(OR(F${r}="Travail", F${r}="Travail2"), (H${r}-I${r})-G${r}, "")` };
                row.getCell(10).numFmt = '[h]:mm';

            } else {
                row.getCell(7).value = null; // G
                row.getCell(8).value = null; // H
                row.getCell(9).value = null; // I
                row.getCell(10).value = null; // J
            }

            // Styling
            [2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(c => {
                const cell = row.getCell(c);
                if (!cell.alignment) {
                    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                }
            });

            currentRowIdx++;
        });
    }

    const buffer = await outputWorkbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const timestamp = format(new Date(), 'HH-mm-ss');
    const fileName = `Planning_Pepiniere_${format(startDate, 'dd-MM-yyyy')}_au_${format(endDate, 'dd-MM-yyyy')}_${timestamp}.xlsx`;
    saveAs(blob, fileName);
};
