import React, { useState, useEffect, useMemo } from 'react';
import { 
    Save, 
    Trash2, 
    RefreshCw, 
    FileSpreadsheet, 
    AlertTriangle, 
    Check, 
    Plus, 
    User, 
    Clock, 
    Calendar,
    ArrowDownRight,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Filter
} from 'lucide-react';
import { exportRevenueControlToExcel, exportRevenueControlHistoryToExcel } from '../utils/revenueControlExcelExport';

export const ATTENDANTS_LIST = [
    "BILAL ELBOUKHARY",
    "BOULAHIA AZIZ",
    "BOUMRIM ABDESLAM",
    "ECHARRADI HAMID",
    "ELAMMARI AYOUB",
    "ELMAZOURI MORAD",
    "LYOUSSEFI NAJI",
    "JOUHARI ABDELLAH",
    "MOUSSAID MOHAMMED",
    "ZRIOUL HICHAM",
    "EL JANATI ABDELFATTAH"
];

const DEFAULT_SHIFTS = [
    {
        id: 'shift_1',
        label: 'Shift 1 : Nuit',
        timeRange: '00h00 à 08h00',
        color: 'indigo',
        attendants: [
            { id: 's1_a1', attendantName: '', amount: 0 }
        ]
    },
    {
        id: 'shift_2',
        label: 'Shift 2 : Journée',
        timeRange: '08h00 à 18h00',
        color: 'amber',
        attendants: [
            { id: 's2_a1', attendantName: '', amount: 0 }
        ]
    },
    {
        id: 'shift_3',
        label: 'Shift 3 : Soirée',
        timeRange: '18h00 à 00h00',
        color: 'purple',
        attendants: [
            { id: 's3_a1', attendantName: '', amount: 0 }
        ]
    }
];

export default function RevenueControlSection({
    selectedDate,
    setSelectedDate,
    supabase,
    showSuccess,
    showError,
    formatNumber
}) {
    const [shifts, setShifts] = useState(DEFAULT_SHIFTS);
    const [annexes, setAnnexes] = useState({
        shop_cafe: 0,
        sce_bosch: 0,
        lubrifiant: 0
    });
    const [horsEspeces, setHorsEspeces] = useState({
        tpe: 0,
        petrom_card: 0,
        bon_ste: 0,
        bon_sntl: 0
    });
    const [comptageReel, setComptageReel] = useState(0);
    const [notes, setNotes] = useState('');

    const [loadingData, setLoadingData] = useState(false);
    const [savingData, setSavingData] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);
    const [syncingCounting, setSyncingCounting] = useState(false);
    const [historyList, setHistoryList] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [tableError, setTableError] = useState(false);
    const [focusedField, setFocusedField] = useState(null);

    // History Server-Side Pagination & Filtering
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPageSize, setHistoryPageSize] = useState(15);
    const [historyTotalCount, setHistoryTotalCount] = useState(0);
    const [selectedHistoryMonth, setSelectedHistoryMonth] = useState('ALL');
    const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');

    // Available months list for filtering (last 24 months)
    const availableMonths = useMemo(() => {
        const months = [];
        const current = new Date();
        for (let i = 0; i < 24; i++) {
            const d = new Date(current.getFullYear(), current.getMonth() - i, 1);
            const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            months.push({ val, label: label.charAt(0).toUpperCase() + label.slice(1) });
        }
        return months;
    }, []);

    // Helpers to encode / decode shifts in notes if database column is missing
    const parseShiftsFromNotes = (rawNotes) => {
        if (!rawNotes) return { cleanNotes: '', parsedShifts: null };
        const match = rawNotes.match(/<!--SHIFTS_DATA:(.*?)-->/s);
        if (match && match[1]) {
            try {
                const parsed = JSON.parse(match[1]);
                const cleanNotes = rawNotes.replace(/<!--SHIFTS_DATA:.*?-->/s, '').trim();
                return { cleanNotes, parsedShifts: parsed };
            } catch (e) {
                console.error("Failed to parse embedded shifts data:", e);
            }
        }
        return { cleanNotes: rawNotes, parsedShifts: null };
    };

    const encodeShiftsIntoNotes = (userNotes, currentShifts) => {
        const clean = (userNotes || '').replace(/<!--SHIFTS_DATA:.*?-->/s, '').trim();
        const json = JSON.stringify(currentShifts);
        return `${clean}\n\n<!--SHIFTS_DATA:${json}-->`.trim();
    };

    // Calculate totals
    const totalRendementPiste = useMemo(() => {
        return shifts.reduce((shiftSum, shift) => {
            const attSum = (shift.attendants || []).reduce((sum, att) => sum + (Number(att.amount) || 0), 0);
            return shiftSum + attSum;
        }, 0);
    }, [shifts]);

    const totalVentesAnnexes = useMemo(() => {
        return (Number(annexes.shop_cafe) || 0) + (Number(annexes.sce_bosch) || 0) + (Number(annexes.lubrifiant) || 0);
    }, [annexes]);

    const totalRecettesBrutes = useMemo(() => {
        return totalRendementPiste + totalVentesAnnexes;
    }, [totalRendementPiste, totalVentesAnnexes]);

    const totalHorsEspeces = useMemo(() => {
        return (Number(horsEspeces.tpe) || 0) + (Number(horsEspeces.petrom_card) || 0) + (Number(horsEspeces.bon_ste) || 0) + (Number(horsEspeces.bon_sntl) || 0);
    }, [horsEspeces]);

    const soldeTheoriqueEspeces = useMemo(() => {
        return totalRecettesBrutes - totalHorsEspeces;
    }, [totalRecettesBrutes, totalHorsEspeces]);

    const ecartFinal = useMemo(() => {
        return (Number(comptageReel) || 0) - soldeTheoriqueEspeces;
    }, [comptageReel, soldeTheoriqueEspeces]);

    // Save draft locally
    const saveLocalDraft = (stateToSave) => {
        try {
            localStorage.setItem(`draft_revenue_control_${selectedDate}`, JSON.stringify(stateToSave));
        } catch (e) {
            console.error("Error saving draft to local storage:", e);
        }
    };

    // Fetch data for selected date
    const fetchDataForDate = async (ignoreDraft = false) => {
        setLoadingData(true);
        try {
            // Check draft in localStorage first
            const draft = localStorage.getItem(`draft_revenue_control_${selectedDate}`);
            if (draft && !ignoreDraft) {
                try {
                    const parsed = JSON.parse(draft);
                    if (parsed.shifts) setShifts(parsed.shifts);
                    if (parsed.annexes) setAnnexes(parsed.annexes);
                    if (parsed.horsEspeces) setHorsEspeces(parsed.horsEspeces);
                    if (parsed.comptageReel !== undefined) setComptageReel(parsed.comptageReel);
                    if (parsed.notes !== undefined) setNotes(parsed.notes);
                    setLoadingData(false);
                    return;
                } catch (e) {
                    console.error("Error parsing local draft:", e);
                }
            }

            // Query database
            const { data: closing, error } = await supabase
                .from('daily_cash_closings')
                .select('*')
                .eq('date', selectedDate)
                .maybeSingle();

            if (error) {
                if (error.message?.includes('relation "public.daily_cash_closings" does not exist') || error.message?.includes('schema cache')) {
                    setTableError(true);
                }
                throw error;
            }

            setTableError(false);

            if (closing) {
                // Restore shifts
                let restoredShifts = null;
                if (closing.shifts_data && Array.isArray(closing.shifts_data) && closing.shifts_data.length > 0) {
                    restoredShifts = closing.shifts_data;
                } else {
                    const { parsedShifts, cleanNotes } = parseShiftsFromNotes(closing.notes);
                    if (parsedShifts && Array.isArray(parsedShifts)) {
                        restoredShifts = parsedShifts;
                    }
                    closing.notes = cleanNotes;
                }

                if (restoredShifts) {
                    setShifts(restoredShifts);
                } else {
                    // Fallback: allocate total to Shift 1 if exists
                    const legacyAmount = Number(closing.total_rendement_piste) || Number(closing.recette_8h_j) || 0;
                    setShifts([
                        {
                            ...DEFAULT_SHIFTS[0],
                            attendants: [{ id: 's1_a1', attendantName: '', amount: legacyAmount }]
                        },
                        DEFAULT_SHIFTS[1],
                        DEFAULT_SHIFTS[2]
                    ]);
                }

                setAnnexes({
                    shop_cafe: Number(closing.shop_cafe) || 0,
                    sce_bosch: Number(closing.sce_bosch) || 0,
                    lubrifiant: Number(closing.lubrifiant) || 0
                });

                setHorsEspeces({
                    tpe: Number(closing.tpe) || 0,
                    petrom_card: Number(closing.petrom_card) || 0,
                    bon_ste: Number(closing.bon_ste) || 0,
                    bon_sntl: Number(closing.bon_sntl) || 0
                });

                setComptageReel(Number(closing.comptage_espece_total) || 0);
                const { cleanNotes } = parseShiftsFromNotes(closing.notes);
                setNotes(cleanNotes || '');
            } else {
                // New day default
                setShifts(DEFAULT_SHIFTS);
                setAnnexes({ shop_cafe: 0, sce_bosch: 0, lubrifiant: 0 });
                setHorsEspeces({ tpe: 0, petrom_card: 0, bon_ste: 0, bon_sntl: 0 });
                setNotes('');

                // Try to auto-fetch cash counting for the day
                const startOfDay = `${selectedDate}T00:00:00`;
                const endOfDay = `${selectedDate}T23:59:59`;
                const { data: counting } = await supabase
                    .from('money_countings')
                    .select('total_calc')
                    .gte('created_at', startOfDay)
                    .lte('created_at', endOfDay)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (counting && counting.total_calc) {
                    setComptageReel(Number(counting.total_calc) || 0);
                } else {
                    setComptageReel(0);
                }
            }
        } catch (err) {
            console.error('Error fetching revenue control data:', err);
        } finally {
            setLoadingData(false);
        }
    };

    // Fetch history with server-side range pagination & month filter
    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            let query = supabase
                .from('daily_cash_closings')
                .select('*', { count: 'exact' });

            if (selectedHistoryMonth && selectedHistoryMonth !== 'ALL') {
                const [y, m] = selectedHistoryMonth.split('-').map(Number);
                const startDate = `${selectedHistoryMonth}-01`;
                const lastDay = new Date(y, m, 0).getDate();
                const endDate = `${selectedHistoryMonth}-${String(lastDay).padStart(2, '0')}`;
                query = query.gte('date', startDate).lte('date', endDate);
            }

            const from = (historyPage - 1) * historyPageSize;
            const to = from + historyPageSize - 1;

            const { data, count, error } = await query
                .order('date', { ascending: false })
                .range(from, to);

            if (!error && data) {
                setHistoryTotalCount(count || 0);
                // Parse embedded shifts in notes if needed
                const enriched = data.map(item => {
                    const { cleanNotes, parsedShifts } = parseShiftsFromNotes(item.notes);
                    return {
                        ...item,
                        notes: cleanNotes,
                        shifts_data: item.shifts_data && Array.isArray(item.shifts_data) ? item.shifts_data : parsedShifts
                    };
                });
                setHistoryList(enriched);
            }
        } catch (err) {
            console.error('Error fetching revenue control history:', err);
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        fetchDataForDate();
    }, [selectedDate]);

    useEffect(() => {
        fetchHistory();
    }, [historyPage, historyPageSize, selectedHistoryMonth]);

    // Handle shift attendant change
    const updateAttendantField = (shiftId, attendantRowId, field, value) => {
        setShifts(prevShifts => {
            const updated = prevShifts.map(s => {
                if (s.id !== shiftId) return s;
                return {
                    ...s,
                    attendants: (s.attendants || []).map(att => {
                        if (att.id !== attendantRowId) return att;
                        return {
                            ...att,
                            [field]: field === 'amount' ? (value === '' ? '' : Number(value)) : value
                        };
                    })
                };
            });
            saveLocalDraft({ shifts: updated, annexes, horsEspeces, comptageReel, notes });
            return updated;
        });
    };

    const addAttendantRow = (shiftId) => {
        setShifts(prevShifts => {
            const updated = prevShifts.map(s => {
                if (s.id !== shiftId) return s;
                const newRowId = `${shiftId}_a_${Date.now()}`;
                return {
                    ...s,
                    attendants: [...(s.attendants || []), { id: newRowId, attendantName: '', amount: 0 }]
                };
            });
            saveLocalDraft({ shifts: updated, annexes, horsEspeces, comptageReel, notes });
            return updated;
        });
    };

    const removeAttendantRow = (shiftId, attendantRowId) => {
        setShifts(prevShifts => {
            const updated = prevShifts.map(s => {
                if (s.id !== shiftId) return s;
                const filtered = (s.attendants || []).filter(att => att.id !== attendantRowId);
                return {
                    ...s,
                    attendants: filtered.length > 0 ? filtered : [{ id: `${shiftId}_a_${Date.now()}`, attendantName: '', amount: 0 }]
                };
            });
            saveLocalDraft({ shifts: updated, annexes, horsEspeces, comptageReel, notes });
            return updated;
        });
    };

    // Handle Annexes change
    const updateAnnexesField = (field, val) => {
        const numVal = val === '' ? '' : Number(val);
        setAnnexes(prev => {
            const updated = { ...prev, [field]: numVal };
            saveLocalDraft({ shifts, annexes: updated, horsEspeces, comptageReel, notes });
            return updated;
        });
    };

    // Handle Hors Especes change
    const updateHorsEspecesField = (field, val) => {
        const numVal = val === '' ? '' : Number(val);
        setHorsEspeces(prev => {
            const updated = { ...prev, [field]: numVal };
            saveLocalDraft({ shifts, annexes, horsEspeces: updated, comptageReel, notes });
            return updated;
        });
    };

    // Sync counting from money_countings
    const handleSyncCounting = async () => {
        setSyncingCounting(true);
        try {
            const startOfDay = `${selectedDate}T00:00:00`;
            const endOfDay = `${selectedDate}T23:59:59`;
            const { data: counting, error } = await supabase
                .from('money_countings')
                .select('total_calc')
                .gte('created_at', startOfDay)
                .lte('created_at', endOfDay)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            if (counting && counting.total_calc !== undefined) {
                const val = Number(counting.total_calc) || 0;
                setComptageReel(val);
                saveLocalDraft({ shifts, annexes, horsEspeces, comptageReel: val, notes });
                showSuccess(`Comptage synchronisé : ${val.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH`);
            } else {
                showError('Aucun comptage trouvé pour cette date dans l\'onglet Comptage.');
            }
        } catch (err) {
            console.error('Error syncing money counting:', err);
            showError('Erreur lors de la récupération du comptage.');
        } finally {
            setSyncingCounting(false);
        }
    };

    // Save closing to database
    const handleSaveControl = async (e) => {
        if (e) e.preventDefault();
        setSavingData(true);
        try {
            // Clean up shifts for JSON storage
            const sanitizedShifts = shifts.map(s => ({
                id: s.id,
                label: s.label,
                timeRange: s.timeRange,
                attendants: (s.attendants || []).map(a => ({
                    id: a.id,
                    attendantName: a.attendantName?.trim() || '',
                    amount: Number(a.amount) || 0
                }))
            }));

            const basePayload = {
                date: selectedDate,
                total_rendement_piste: totalRendementPiste,
                recette_8h_j: totalRendementPiste, // For legacy compatibility
                recette_8h_j_prev: 0,
                total_rendement_j_prev: 0,
                shop_cafe: Number(annexes.shop_cafe) || 0,
                sce_bosch: Number(annexes.sce_bosch) || 0,
                lubrifiant: Number(annexes.lubrifiant) || 0,
                tpe: Number(horsEspeces.tpe) || 0,
                petrom_card: Number(horsEspeces.petrom_card) || 0,
                bon_ste: Number(horsEspeces.bon_ste) || 0,
                bon_sntl: Number(horsEspeces.bon_sntl) || 0,
                comptage_espece_total: Number(comptageReel) || 0,
                notes: notes.trim()
            };

            // Try first with shifts_data JSONB column
            let savePayload = {
                ...basePayload,
                shifts_data: sanitizedShifts
            };

            const { error: upsertErr } = await supabase
                .from('daily_cash_closings')
                .upsert(savePayload, { onConflict: 'date' });

            if (upsertErr) {
                // If shifts_data or total_rendement_piste column doesn't exist, embed safely in notes
                if (upsertErr.message?.includes('shifts_data') || upsertErr.message?.includes('total_rendement_piste')) {
                    const fallbackPayload = {
                        date: selectedDate,
                        recette_8h_j: totalRendementPiste,
                        recette_8h_j_prev: 0,
                        total_rendement_j_prev: 0,
                        shop_cafe: Number(annexes.shop_cafe) || 0,
                        sce_bosch: Number(annexes.sce_bosch) || 0,
                        lubrifiant: Number(annexes.lubrifiant) || 0,
                        tpe: Number(horsEspeces.tpe) || 0,
                        petrom_card: Number(horsEspeces.petrom_card) || 0,
                        bon_ste: Number(horsEspeces.bon_ste) || 0,
                        bon_sntl: Number(horsEspeces.bon_sntl) || 0,
                        comptage_espece_total: Number(comptageReel) || 0,
                        notes: encodeShiftsIntoNotes(notes, sanitizedShifts)
                    };

                    const fallbackRes = await supabase
                        .from('daily_cash_closings')
                        .upsert(fallbackPayload, { onConflict: 'date' });

                    if (fallbackRes.error) throw fallbackRes.error;
                } else {
                    throw upsertErr;
                }
            }

            localStorage.removeItem(`draft_revenue_control_${selectedDate}`);
            showSuccess('Contrôle des recettes enregistré avec succès !');
            fetchDataForDate(true);
            fetchHistory();
        } catch (err) {
            console.error('Error saving revenue control:', err);
            showError('Erreur lors de l\'enregistrement du contrôle des recettes.');
        } finally {
            setSavingData(false);
        }
    };

    // Reset day
    const handleReset = () => {
        if (window.confirm("Êtes-vous sûr de vouloir réinitialiser la saisie de cette journée ? Les modifications non enregistrées seront perdues.")) {
            localStorage.removeItem(`draft_revenue_control_${selectedDate}`);
            fetchDataForDate(true);
            showSuccess('Données réinitialisées.');
        }
    };

    // Export current control to Excel
    const handleExportExcel = async () => {
        setExportingExcel(true);
        try {
            await exportRevenueControlToExcel({
                date: selectedDate,
                shifts,
                annexes,
                horsEspeces,
                comptageReel,
                totalRendement: totalRendementPiste,
                totalAnnexes: totalVentesAnnexes,
                totalRecettes: totalRecettesBrutes,
                totalHorsEspeces: totalHorsEspeces,
                soldeTheorique: soldeTheoriqueEspeces,
                ecart: ecartFinal,
                notes
            });
            showSuccess('Export Excel généré avec succès !');
        } catch (err) {
            console.error('Error exporting to Excel:', err);
            showError('Erreur lors de l\'export Excel.');
        } finally {
            setExportingExcel(false);
        }
    };

    // Export history to Excel (full month or current selection)
    const handleExportHistoryExcel = async () => {
        try {
            let query = supabase.from('daily_cash_closings').select('*');
            if (selectedHistoryMonth && selectedHistoryMonth !== 'ALL') {
                const [y, m] = selectedHistoryMonth.split('-').map(Number);
                const startDate = `${selectedHistoryMonth}-01`;
                const lastDay = new Date(y, m, 0).getDate();
                const endDate = `${selectedHistoryMonth}-${String(lastDay).padStart(2, '0')}`;
                query = query.gte('date', startDate).lte('date', endDate);
            } else {
                query = query.limit(200);
            }

            const { data, error } = await query.order('date', { ascending: false });
            if (error) throw error;

            const enriched = (data || []).map(item => {
                const { cleanNotes, parsedShifts } = parseShiftsFromNotes(item.notes);
                return {
                    ...item,
                    notes: cleanNotes,
                    shifts_data: item.shifts_data && Array.isArray(item.shifts_data) ? item.shifts_data : parsedShifts
                };
            });

            await exportRevenueControlHistoryToExcel(enriched);
            showSuccess('Historique exporté avec succès !');
        } catch (err) {
            console.error('Error exporting history to Excel:', err);
            showError('Erreur lors de l\'export de l\'historique.');
        }
    };

    // Filter displayed history by status
    const displayedHistoryList = useMemo(() => {
        if (historyStatusFilter === 'ALL') return historyList;
        return historyList.filter(hist => {
            let histRend = 0;
            if (hist.shifts_data && Array.isArray(hist.shifts_data)) {
                hist.shifts_data.forEach(s => (s.attendants || []).forEach(a => histRend += Number(a.amount) || 0));
            }
            if (histRend === 0 && hist.total_rendement_piste) {
                histRend = Number(hist.total_rendement_piste) || 0;
            }
            if (histRend === 0) {
                histRend = (Number(hist.total_rendement_j_prev) - Number(hist.recette_8h_j_prev)) + Number(hist.recette_8h_j);
            }
            const histAnnexes = (Number(hist.shop_cafe) || 0) + (Number(hist.sce_bosch) || 0) + (Number(hist.lubrifiant) || 0);
            const histHorsEsp = (Number(hist.tpe) || 0) + (Number(hist.petrom_card) || 0) + (Number(hist.bon_ste) || 0) + (Number(hist.bon_sntl) || 0);
            const histTheo = (histRend + histAnnexes) - histHorsEsp;
            const histReel = Number(hist.comptage_espece_total) || 0;
            const histEcart = histReel - histTheo;
            const histOk = Math.abs(histEcart) <= 0.50;

            if (historyStatusFilter === 'OK') return histOk;
            if (historyStatusFilter === 'DEFICIT') return !histOk && histEcart < 0;
            if (historyStatusFilter === 'EXCEDENT') return !histOk && histEcart > 0;
            return true;
        });
    }, [historyList, historyStatusFilter]);

    // Pagination metrics
    const totalPages = Math.max(1, Math.ceil(historyTotalCount / historyPageSize));
    const firstRecordIndex = historyTotalCount === 0 ? 0 : (historyPage - 1) * historyPageSize + 1;
    const lastRecordIndex = Math.min(historyTotalCount, historyPage * historyPageSize);

    // Helpers for input focus/blur numeric handling
    const getNumberInputProps = (value, onChangeHandler, fieldId) => {
        const isFocused = focusedField === fieldId;
        return {
            type: isFocused ? 'number' : 'text',
            value: isFocused 
                ? (value === '' ? '' : value) 
                : formatNumber(Number(value) || 0, 2),
            onChange: (e) => onChangeHandler(e.target.value),
            onFocus: () => {
                setFocusedField(fieldId);
                if (Number(value) === 0) {
                    onChangeHandler('');
                }
            },
            onBlur: () => {
                setFocusedField(null);
                if (value === '' || value === undefined || value === null) {
                    onChangeHandler(0);
                }
            }
        };
    };

    const isOk = Math.abs(ecartFinal) <= 0.50;

    return (
        <div className="space-y-8 animate-fade-in font-sans">
            {/* Database Error Banner if any */}
            {tableError && (
                <div className="p-6 bg-red-50 border border-red-200 rounded-2xl flex flex-col gap-3">
                    <div className="flex items-center gap-3 text-red-700">
                        <AlertTriangle className="shrink-0" size={24} />
                        <h3 className="font-bold text-lg">Configuration de la base de données requise</h3>
                    </div>
                    <p className="text-sm text-red-600 leading-relaxed">
                        La table <code>daily_cash_closings</code> n'existe pas encore dans Supabase.
                        Veuillez exécuter le script <code>supabase_setup_cash_closings.sql</code> dans votre console Supabase puis cliquer sur Réessayer.
                    </p>
                    <button
                        type="button"
                        onClick={() => fetchDataForDate()}
                        className="flex items-center gap-2 bg-red-600 text-white w-fit px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
                    >
                        <RefreshCw size={16} />
                        Réessayer la connexion
                    </button>
                </div>
            )}

            {!tableError && (
                <form onSubmit={handleSaveControl} className="space-y-8">
                    {/* TOP BAR / HEADER */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50/70 p-5 rounded-2xl border border-gray-100">
                        <div>
                            <div className="flex items-center gap-2.5">
                                <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-sm shadow-cyan-500/50"></div>
                                <h3 className="font-bold text-xl text-gray-800 tracking-tight">
                                    Contrôle des Recettes (Théorique vs Réel)
                                </h3>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                <Calendar size={13} className="text-gray-400" />
                                <span>Journée du {new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                            {/* Reset Button */}
                            <button
                                type="button"
                                onClick={handleReset}
                                disabled={loadingData || savingData}
                                className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-rose-200 text-rose-600 bg-rose-50/40 hover:bg-rose-50 transition-all cursor-pointer disabled:opacity-50"
                                title="Réinitialiser la saisie"
                            >
                                <Trash2 size={15} />
                                <span>RAZ</span>
                            </button>

                            {/* Export Excel Button */}
                            <button
                                type="button"
                                onClick={handleExportExcel}
                                disabled={loadingData || savingData || exportingExcel}
                                className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100/70 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                            >
                                {exportingExcel ? <Loader2 size={15} className="animate-spin text-emerald-600" /> : <FileSpreadsheet size={15} className="text-emerald-600" />}
                                <span>Exporter Excel</span>
                            </button>

                            {/* Save Button */}
                            <button
                                type="submit"
                                disabled={loadingData || savingData}
                                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
                            >
                                {savingData ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                <span>{savingData ? 'Enregistrement...' : 'Enregistrer le contrôle'}</span>
                            </button>
                        </div>
                    </div>

                    {loadingData ? (
                        <div className="flex flex-col items-center justify-center py-24 space-y-3">
                            <Loader2 size={36} className="animate-spin text-cyan-600" />
                            <p className="text-xs text-gray-400 font-medium">Chargement des données de contrôle...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* LEFT COLUMN : DATA ENTRY */}
                            <div className="lg:col-span-7 space-y-6">
                                
                                {/* SECTION 1 : RENDEMENT PISTE PAR SHIFT & POMPISTE */}
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-5">
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-100 pb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-2 h-4 bg-indigo-600 rounded"></div>
                                            <h4 className="font-bold text-sm text-indigo-700 uppercase tracking-wider">
                                                Section 1 : Rendements Piste par Période (Shifts)
                                            </h4>
                                        </div>
                                        <div className="text-xs font-bold font-mono text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                                            Total Piste : {totalRendementPiste.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                        </div>
                                    </div>

                                    {/* 3 SHIFTS */}
                                    <div className="space-y-4">
                                        {shifts.map((shift) => {
                                            const shiftSubtotal = (shift.attendants || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
                                            const isShiftActive = shiftSubtotal > 0;

                                            return (
                                                <div 
                                                    key={shift.id}
                                                    className={`p-4 rounded-xl border transition-all ${
                                                        shift.id === 'shift_1' 
                                                            ? 'border-indigo-100 bg-indigo-50/20' 
                                                            : shift.id === 'shift_2' 
                                                                ? 'border-amber-100 bg-amber-50/20' 
                                                                : 'border-purple-100 bg-purple-50/20'
                                                    }`}
                                                >
                                                    {/* Shift Header */}
                                                    <div className="flex justify-between items-center mb-3">
                                                        <div className="flex items-center gap-2">
                                                            <Clock size={14} className={shift.id === 'shift_1' ? 'text-indigo-600' : shift.id === 'shift_2' ? 'text-amber-600' : 'text-purple-600'} />
                                                            <span className="font-bold text-xs text-gray-800">{shift.label}</span>
                                                            <span className="text-[11px] font-medium text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                                                                {shift.timeRange}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs font-mono font-bold text-gray-700">
                                                            {shiftSubtotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                                        </span>
                                                    </div>

                                                    {/* Attendants rows */}
                                                    <div className="space-y-2.5">
                                                        {(shift.attendants || []).map((att) => (
                                                            <div key={att.id} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-100 shadow-2xs">
                                                                {/* Pompiste Select */}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="relative">
                                                                        <select
                                                                            value={att.attendantName}
                                                                            onChange={(e) => updateAttendantField(shift.id, att.id, 'attendantName', e.target.value)}
                                                                            className="w-full text-xs font-semibold py-2 pl-3 pr-7 bg-gray-50/60 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-800 cursor-pointer"
                                                                        >
                                                                            <option value="">Sélectionner un pompiste...</option>
                                                                            {ATTENDANTS_LIST.map((name) => (
                                                                                <option key={name} value={name}>{name}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                </div>

                                                                {/* Rendement input */}
                                                                <div className="w-36 sm:w-44">
                                                                    <div className="relative">
                                                                        <input
                                                                            step="0.01"
                                                                            placeholder="0.00"
                                                                            className="w-full pr-8 pl-3 py-1.5 text-xs font-mono font-bold text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                                                            {...getNumberInputProps(
                                                                                att.amount,
                                                                                (v) => updateAttendantField(shift.id, att.id, 'amount', v),
                                                                                `att_${att.id}`
                                                                            )}
                                                                        />
                                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">DH</span>
                                                                    </div>
                                                                </div>

                                                                {/* Delete row */}
                                                                {(shift.attendants || []).length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeAttendantRow(shift.id, att.id)}
                                                                        className="p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                                        title="Supprimer ce pompiste"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Add Attendant Button */}
                                                    <div className="mt-2.5 flex justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() => addAttendantRow(shift.id)}
                                                            className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-white/80 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                                                        >
                                                            <Plus size={12} />
                                                            <span>Ajouter un pompiste pour ce shift</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* SECTION 2 : VENTES HORS CARBURANT (ANNEXES) */}
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-4">
                                    <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-2 h-4 bg-emerald-600 rounded"></div>
                                            <h4 className="font-bold text-sm text-emerald-700 uppercase tracking-wider">
                                                Section 2 : Ventes Hors Carburant (Annexes)
                                            </h4>
                                        </div>
                                        <div className="text-xs font-bold font-mono text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                                            Total Annexes : {totalVentesAnnexes.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Shop & Café</label>
                                            <div className="relative">
                                                <input
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    className="w-full pr-8 pl-3 py-2 text-xs font-mono font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                                                    {...getNumberInputProps(
                                                        annexes.shop_cafe,
                                                        (v) => updateAnnexesField('shop_cafe', v),
                                                        'annexes_shop_cafe'
                                                    )}
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">DH</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Service Bosch</label>
                                            <div className="relative">
                                                <input
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    className="w-full pr-8 pl-3 py-2 text-xs font-mono font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                                                    {...getNumberInputProps(
                                                        annexes.sce_bosch,
                                                        (v) => updateAnnexesField('sce_bosch', v),
                                                        'annexes_sce_bosch'
                                                    )}
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">DH</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Lubrifiant</label>
                                            <div className="relative">
                                                <input
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    className="w-full pr-8 pl-3 py-2 text-xs font-mono font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                                                    {...getNumberInputProps(
                                                        annexes.lubrifiant,
                                                        (v) => updateAnnexesField('lubrifiant', v),
                                                        'annexes_lubrifiant'
                                                    )}
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">DH</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 3 : ENCAISSEMENTS HORS ESPÈCES (SAISIE GLOBALE) */}
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-4">
                                    <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-2 h-4 bg-amber-600 rounded"></div>
                                            <h4 className="font-bold text-sm text-amber-700 uppercase tracking-wider">
                                                Section 3 : Encaissements Hors Espèces (Global)
                                            </h4>
                                        </div>
                                        <div className="text-xs font-bold font-mono text-amber-700 bg-amber-50 px-3 py-1 rounded-lg border border-amber-100">
                                            Total Dématérialisé : {totalHorsEspeces.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">CMI (TPE)</label>
                                            <div className="relative">
                                                <input
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    className="w-full pr-8 pl-3 py-2 text-xs font-mono font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                                                    {...getNumberInputProps(
                                                        horsEspeces.tpe,
                                                        (v) => updateHorsEspecesField('tpe', v),
                                                        'he_tpe'
                                                    )}
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">DH</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Petrom Card</label>
                                            <div className="relative">
                                                <input
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    className="w-full pr-8 pl-3 py-2 text-xs font-mono font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                                                    {...getNumberInputProps(
                                                        horsEspeces.petrom_card,
                                                        (v) => updateHorsEspecesField('petrom_card', v),
                                                        'he_petrom_card'
                                                    )}
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">DH</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Bons Crédit Client</label>
                                            <div className="relative">
                                                <input
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    className="w-full pr-8 pl-3 py-2 text-xs font-mono font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                                                    {...getNumberInputProps(
                                                        horsEspeces.bon_ste,
                                                        (v) => updateHorsEspecesField('bon_ste', v),
                                                        'he_bon_ste'
                                                    )}
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">DH</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Bons à Crédit SNTL</label>
                                            <div className="relative">
                                                <input
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    className="w-full pr-8 pl-3 py-2 text-xs font-mono font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                                                    {...getNumberInputProps(
                                                        horsEspeces.bon_sntl,
                                                        (v) => updateHorsEspecesField('bon_sntl', v),
                                                        'he_bon_sntl'
                                                    )}
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">DH</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 4 : COMPTAGE RÉEL EN ESPÈCES */}
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-4">
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-100 pb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-2 h-4 bg-rose-600 rounded"></div>
                                            <h4 className="font-bold text-sm text-rose-700 uppercase tracking-wider">
                                                Section 4 : Comptage Réel en Espèces
                                            </h4>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleSyncCounting}
                                            disabled={syncingCounting}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 px-3 py-1.5 rounded-xl border border-rose-100 transition-all cursor-pointer disabled:opacity-50"
                                            title="Récupérer le montant depuis le dernier comptage de caisse de la journée"
                                        >
                                            {syncingCounting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                                            <span>Synchroniser depuis Comptage</span>
                                        </button>
                                    </div>

                                    <div className="max-w-sm">
                                        <label className="block text-xs font-bold text-gray-600 mb-1">
                                            Comptage Physique Espèces (Coffre / Tiroir)
                                        </label>
                                        <div className="relative">
                                            <input
                                                step="0.01"
                                                placeholder="0.00"
                                                className="w-full pl-3 pr-12 py-3 text-base font-mono font-black border border-rose-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-rose-800 bg-rose-50/20"
                                                {...getNumberInputProps(
                                                    comptageReel,
                                                    (v) => {
                                                        const numVal = v === '' ? '' : Number(v);
                                                        setComptageReel(numVal);
                                                        saveLocalDraft({ shifts, annexes, horsEspeces, comptageReel: numVal, notes });
                                                    },
                                                    'comptage_reel_total'
                                                )}
                                            />
                                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-black text-xs text-rose-500">DH</span>
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 5 : OBSERVATIONS ET NOTES */}
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-3">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                                        Observations / Justifications de Caisse
                                    </label>
                                    <textarea
                                        rows="3"
                                        placeholder="Saisir des remarques, justifications d'écarts ou consignes pour la journée..."
                                        className="w-full px-3.5 py-2.5 text-xs text-gray-800 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white resize-none"
                                        value={notes}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setNotes(val);
                                            saveLocalDraft({ shifts, annexes, horsEspeces, comptageReel, notes: val });
                                        }}
                                    />
                                </div>

                            </div>

                            {/* RIGHT COLUMN : CALCULATION SHEET & SUMMARY */}
                            <div className="lg:col-span-5 space-y-6">
                                
                                {/* DISCREPANCY RESULT CARD */}
                                <div className={`p-6 rounded-3xl border shadow-xl flex flex-col justify-between transition-all duration-300 ${
                                    isOk
                                        ? 'bg-emerald-50 border-emerald-100 text-emerald-900 shadow-emerald-500/5'
                                        : ecartFinal > 0 
                                            ? 'bg-blue-50 border-blue-100 text-blue-900 shadow-blue-500/5'
                                            : 'bg-rose-50 border-rose-100 text-rose-900 shadow-rose-500/5'
                                }`}>
                                    <div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[11px] font-bold uppercase tracking-widest opacity-80">
                                                RÉSULTAT DU CONTRÔLE
                                            </span>
                                            <span className="text-[10px] font-mono bg-white/70 px-2 py-0.5 rounded-full font-bold">
                                                {selectedDate}
                                            </span>
                                        </div>

                                        <div className="mt-3">
                                            <h3 className="text-4xl font-black font-mono tracking-tight">
                                                {ecartFinal >= 0 ? '+' : ''}{ecartFinal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                            </h3>
                                        </div>

                                        <p className="text-xs mt-2.5 opacity-90 leading-relaxed font-medium">
                                            {isOk 
                                                ? "Caisse parfaitement équilibrée. Le montant réel en espèces correspond au solde théorique attendu." 
                                                : ecartFinal > 0 
                                                    ? "Excédent de caisse. Le comptage réel en espèces est supérieur au solde théorique calculé."
                                                    : "Déficit de caisse. Le comptage réel en espèces est inférieur au solde théorique calculé."
                                            }
                                        </p>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-black/5 flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                            isOk 
                                                ? 'bg-emerald-100 text-emerald-700' 
                                                : ecartFinal > 0 
                                                    ? 'bg-blue-100 text-blue-700' 
                                                    : 'bg-rose-100 text-rose-700'
                                        }`}>
                                            {isOk ? <Check size={18} /> : <AlertTriangle size={18} />}
                                        </div>
                                        <span className="font-bold text-xs uppercase tracking-wider font-sans">
                                            {isOk ? "Caisse Équilibrée (OK)" : (ecartFinal > 0 ? "Excédent Détecté" : "Écart / Déficit Détecté")}
                                        </span>
                                    </div>
                                </div>

                                {/* LOGICAL CALCULATION SHEET */}
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-5">
                                    <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                                        <h4 className="font-bold text-sm text-gray-900 uppercase tracking-wider">
                                            Feuille de Calcul Logique
                                        </h4>
                                        <span className="text-[10px] text-gray-400 font-mono">Détail des flux</span>
                                    </div>

                                    <div className="space-y-3.5">
                                        {/* A: RENDEMENT PISTE */}
                                        <div className="p-3.5 bg-gray-50/80 rounded-xl space-y-1.5 border border-gray-100">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-bold text-gray-600 uppercase tracking-wider">A - Rendement Piste</span>
                                                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                                    {totalRendementPiste.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-gray-400 font-mono">
                                                Somme des 3 shifts de travail ({shifts.map(s => (s.attendants || []).length).reduce((a, b) => a + b, 0)} pompiste(s))
                                            </div>
                                        </div>

                                        {/* B: VENTES ANNEXES */}
                                        <div className="p-3.5 bg-gray-50/80 rounded-xl space-y-1.5 border border-gray-100">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-bold text-gray-600 uppercase tracking-wider">B - Ventes Annexes</span>
                                                <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                                    {totalVentesAnnexes.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-gray-400 font-mono">
                                                Shop ({formatNumber(annexes.shop_cafe)}) + Bosch ({formatNumber(annexes.sce_bosch)}) + Lubrifiants ({formatNumber(annexes.lubrifiant)})
                                            </div>
                                        </div>

                                        {/* TOTAL RECETTES BRUTES */}
                                        <div className="p-3.5 bg-blue-50/40 rounded-xl space-y-1 border border-blue-100">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-bold text-blue-900 uppercase tracking-wider">Total Recettes Brutes (A + B)</span>
                                                <span className="font-mono font-black text-blue-800">
                                                    {totalRecettesBrutes.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                                </span>
                                            </div>
                                        </div>

                                        {/* C: ENCAISSEMENTS HORS ESPÈCES */}
                                        <div className="p-3.5 bg-gray-50/80 rounded-xl space-y-1.5 border border-gray-100">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-bold text-gray-600 uppercase tracking-wider">C - Hors Espèces (Dématérialisé)</span>
                                                <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                                                    - {totalHorsEspeces.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-gray-400 font-mono">
                                                TPE ({formatNumber(horsEspeces.tpe)}) + Petrom Card ({formatNumber(horsEspeces.petrom_card)}) + Bons ({formatNumber((Number(horsEspeces.bon_ste) || 0) + (Number(horsEspeces.bon_sntl) || 0))})
                                            </div>
                                        </div>

                                        {/* D: SOLDE THÉORIQUE ATTENDU */}
                                        <div className="p-4 bg-indigo-50/50 rounded-xl space-y-1.5 border border-indigo-100">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-black text-indigo-900 uppercase tracking-wider">D - Solde Théorique Espèces</span>
                                                <span className="font-mono font-black text-indigo-700 text-sm">
                                                    {soldeTheoriqueEspeces.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-indigo-500 font-mono">
                                                Formule : (A + B) - C = ({formatNumber(totalRecettesBrutes)}) - {formatNumber(totalHorsEspeces)}
                                            </div>
                                        </div>

                                        {/* FINAL COMPARAISON */}
                                        <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-xs">
                                            <span className="font-bold text-gray-500 uppercase">Comptage Réel (Physique)</span>
                                            <span className="font-mono font-black text-gray-800 text-sm">
                                                {comptageReel.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                            </span>
                                        </div>

                                        <div className="pt-2 flex justify-between items-center text-sm">
                                            <span className="font-black text-gray-900">Écart Final (Réel - Théo)</span>
                                            <span className={`font-mono font-black text-base ${
                                                isOk 
                                                    ? 'text-emerald-600' 
                                                    : ecartFinal > 0 
                                                        ? 'text-blue-600' 
                                                        : 'text-rose-600'
                                            }`}>
                                                {ecartFinal >= 0 ? '+' : ''}{ecartFinal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </form>
            )}

            {/* SECTION HISTORIQUE JOURNALIER AVEC PAGINATION SERVEUR */}
            {!tableError && (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-4">
                    {/* Header & Controls Toolbar */}
                    <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 border-b border-gray-100 pb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="font-bold text-base text-gray-800">
                                    Historique des Contrôles de Recettes
                                </h4>
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-full font-bold">
                                    {historyTotalCount} journée(s)
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Consultation et réouverture des arrêtés passés avec pagination serveur & filtres
                            </p>
                        </div>

                        {/* Filters Toolbar */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Month Filter */}
                            <div className="relative">
                                <select
                                    value={selectedHistoryMonth}
                                    onChange={(e) => {
                                        setSelectedHistoryMonth(e.target.value);
                                        setHistoryPage(1);
                                    }}
                                    className="text-xs font-semibold py-1.5 pl-3 pr-7 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-700 cursor-pointer shadow-2xs"
                                >
                                    <option value="ALL">📅 Tous les mois</option>
                                    {availableMonths.map(m => (
                                        <option key={m.val} value={m.val}>{m.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Status Filter */}
                            <div className="relative">
                                <select
                                    value={historyStatusFilter}
                                    onChange={(e) => setHistoryStatusFilter(e.target.value)}
                                    className="text-xs font-semibold py-1.5 pl-3 pr-7 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-700 cursor-pointer shadow-2xs"
                                >
                                    <option value="ALL">🔍 Tous les statuts</option>
                                    <option value="OK">✅ Caisse OK</option>
                                    <option value="DEFICIT">🔴 Déficits</option>
                                    <option value="EXCEDENT">🔵 Excédents</option>
                                </select>
                            </div>

                            {/* Page size select */}
                            <div className="relative">
                                <select
                                    value={historyPageSize}
                                    onChange={(e) => {
                                        setHistoryPageSize(Number(e.target.value));
                                        setHistoryPage(1);
                                    }}
                                    className="text-xs font-semibold py-1.5 pl-3 pr-7 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-700 cursor-pointer shadow-2xs"
                                >
                                    <option value={15}>15 / page</option>
                                    <option value={30}>30 / page</option>
                                    <option value={50}>50 / page</option>
                                </select>
                            </div>

                            {/* Export History Excel */}
                            {historyTotalCount > 0 && (
                                <button
                                    type="button"
                                    onClick={handleExportHistoryExcel}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                                    title="Exporter l'historique complet en Excel"
                                >
                                    <FileSpreadsheet size={14} />
                                    <span>{selectedHistoryMonth !== 'ALL' ? 'Export Mois (Excel)' : 'Export Excel'}</span>
                                </button>
                            )}

                            {/* Refresh */}
                            <button
                                type="button"
                                onClick={() => fetchHistory()}
                                disabled={loadingHistory}
                                className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-indigo-600 cursor-pointer border border-gray-200"
                                title="Actualiser l'historique"
                            >
                                <RefreshCw size={14} className={loadingHistory ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {loadingHistory ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin text-indigo-600" size={24} />
                        </div>
                    ) : displayedHistoryList.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-xs">
                            Aucun contrôle enregistré pour les critères sélectionnés.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 uppercase tracking-wider font-bold">
                                        <th className="py-3 px-3">Date</th>
                                        <th className="py-3 px-3 text-right">Rendement Piste</th>
                                        <th className="py-3 px-3 text-right">Annexes</th>
                                        <th className="py-3 px-3 text-right">Hors Espèces</th>
                                        <th className="py-3 px-3 text-right">Solde Théo</th>
                                        <th className="py-3 px-3 text-right">Espèces Réelles</th>
                                        <th className="py-3 px-3 text-right">Écart</th>
                                        <th className="py-3 px-3">Statut</th>
                                        <th className="py-3 px-3">Notes</th>
                                        <th className="py-3 px-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedHistoryList.map((hist) => {
                                        let histRend = 0;
                                        if (hist.shifts_data && Array.isArray(hist.shifts_data)) {
                                            hist.shifts_data.forEach(s => (s.attendants || []).forEach(a => histRend += Number(a.amount) || 0));
                                        }
                                        if (histRend === 0 && hist.total_rendement_piste) {
                                            histRend = Number(hist.total_rendement_piste) || 0;
                                        }
                                        if (histRend === 0) {
                                            histRend = (Number(hist.total_rendement_j_prev) - Number(hist.recette_8h_j_prev)) + Number(hist.recette_8h_j);
                                        }

                                        const histAnnexes = (Number(hist.shop_cafe) || 0) + (Number(hist.sce_bosch) || 0) + (Number(hist.lubrifiant) || 0);
                                        const histHorsEsp = (Number(hist.tpe) || 0) + (Number(hist.petrom_card) || 0) + (Number(hist.bon_ste) || 0) + (Number(hist.bon_sntl) || 0);
                                        const histTheo = (histRend + histAnnexes) - histHorsEsp;
                                        const histReel = Number(hist.comptage_espece_total) || 0;
                                        const histEcart = histReel - histTheo;
                                        const histOk = Math.abs(histEcart) <= 0.50;

                                        return (
                                            <tr key={hist.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                                                <td className="py-3 px-3 font-bold text-gray-800">
                                                    {new Date(hist.date).toLocaleDateString('fr-FR')}
                                                </td>
                                                <td className="py-3 px-3 text-right text-indigo-600 font-mono font-medium">
                                                    {histRend.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                                </td>
                                                <td className="py-3 px-3 text-right text-emerald-600 font-mono font-medium">
                                                    {histAnnexes.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                                </td>
                                                <td className="py-3 px-3 text-right text-amber-600 font-mono font-medium">
                                                    {histHorsEsp.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                                </td>
                                                <td className="py-3 px-3 text-right text-blue-600 font-mono font-bold">
                                                    {histTheo.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                                </td>
                                                <td className="py-3 px-3 text-right text-rose-600 font-mono font-bold">
                                                    {histReel.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                                </td>
                                                <td className={`py-3 px-3 text-right font-mono font-black ${
                                                    histOk 
                                                        ? 'text-emerald-600' 
                                                        : histEcart > 0 
                                                            ? 'text-blue-700 bg-blue-50/50' 
                                                            : 'text-rose-700 bg-rose-50/50'
                                                }`}>
                                                    {histEcart >= 0 ? '+' : ''}{histEcart.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                                </td>
                                                <td className="py-3 px-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        histOk 
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                            : histEcart > 0 
                                                                ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                                                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                    }`}>
                                                        {histOk ? 'Équilibrée' : (histEcart > 0 ? 'Excédent' : 'Déficit')}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-gray-500 max-w-xs truncate" title={hist.notes}>
                                                    {hist.notes || '-'}
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedDate(hist.date)}
                                                        className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
                                                        title="Charger cette journée dans le formulaire"
                                                    >
                                                        Consulter
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination Navigation Footer */}
                    {!loadingHistory && historyTotalCount > 0 && (
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-gray-100 text-xs text-gray-500">
                            <div>
                                Affichage de <span className="font-bold text-gray-800">{firstRecordIndex}</span> à <span className="font-bold text-gray-800">{lastRecordIndex}</span> sur <span className="font-bold text-gray-800">{historyTotalCount}</span> journées
                                {selectedHistoryMonth !== 'ALL' && (
                                    <span className="ml-1 text-indigo-600 font-semibold">
                                        ({availableMonths.find(m => m.val === selectedHistoryMonth)?.label || selectedHistoryMonth})
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                    disabled={historyPage <= 1 || loadingHistory}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer shadow-2xs"
                                >
                                    <ChevronLeft size={14} />
                                    <span>Précédent</span>
                                </button>

                                <span className="px-2 font-mono font-bold text-gray-700 bg-gray-50 py-1 rounded-lg border border-gray-100">
                                    Page {historyPage} / {totalPages}
                                </span>

                                <button
                                    type="button"
                                    onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                                    disabled={historyPage >= totalPages || loadingHistory}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer shadow-2xs"
                                >
                                    <span>Suivant</span>
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
