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
    Filter,
    CheckCircle2,
    Copy,
    Sparkles,
    Pencil,
    Printer,
    ShieldCheck,
    Info
} from 'lucide-react';
import { DateInput } from './ui/DateInput';
import { Modal } from './ui/Modal';
import { exportRevenueControlToExcel, exportRevenueControlHistoryToExcel } from '../utils/revenueControlExcelExport';
import { printRevenueControlSheet } from '../utils/revenueControlPrint';

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

    // Contrôle Rendement Total Système (00h00 à 23h59 de J-1)
    const [systemRendementPrev, setSystemRendementPrev] = useState(0);
    const [prevShift1Data, setPrevShift1Data] = useState({
        amount: 0,
        attendants: [],
        loading: false,
        loaded: false,
        date: ''
    });
    const [showPrevShiftDetails, setShowPrevShiftDetails] = useState(false);

    const [isDaySaved, setIsDaySaved] = useState(false);
    const [copyingPrevious, setCopyingPrevious] = useState(false);

    // Edit Date & Delete in History States
    const [isEditDateModalOpen, setIsEditDateModalOpen] = useState(false);
    const [histToEditDate, setHistToEditDate] = useState(null);
    const [newDateTarget, setNewDateTarget] = useState('');
    const [savingNewDate, setSavingNewDate] = useState(false);
    const [deletingHistoryId, setDeletingHistoryId] = useState(null);

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

    // Date Navigation Helpers
    const handlePrevDay = () => {
        const [y, m, d] = selectedDate.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        dateObj.setDate(dateObj.getDate() - 1);
        const newDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        setSelectedDate(newDateStr);
    };

    const handleNextDay = () => {
        const [y, m, d] = selectedDate.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        dateObj.setDate(dateObj.getDate() + 1);
        const newDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        setSelectedDate(newDateStr);
    };

    const handleToday = () => {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        setSelectedDate(todayStr);
    };

    const formatDisplayDate = (dateStr) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const formatted = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    };

    // Date précédente (J-1)
    const getPreviousDayDateStr = (dateStr) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        dateObj.setDate(dateObj.getDate() - 1);
        return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    };

    // Récupérer le shift 1 (00h00 à 08h00) de la veille pour le contrôle des 24h
    const fetchPrevDayShift1 = async (targetDate) => {
        if (!targetDate) return;
        const prevDateStr = getPreviousDayDateStr(targetDate);
        setPrevShift1Data(prev => ({ ...prev, loading: true, date: prevDateStr }));
        try {
            const { data: prevClosing, error } = await supabase
                .from('daily_cash_closings')
                .select('shifts_data, notes, recette_8h_j, total_rendement_piste')
                .eq('date', prevDateStr)
                .maybeSingle();

            if (error) {
                console.warn('Could not fetch prev day closing:', error);
                setPrevShift1Data({
                    amount: 0,
                    attendants: [],
                    loading: false,
                    loaded: true,
                    date: prevDateStr
                });
                return;
            }

            let sData = null;
            if (prevClosing?.shifts_data && Array.isArray(prevClosing.shifts_data)) {
                sData = prevClosing.shifts_data;
            } else if (prevClosing?.notes) {
                const { parsedShifts } = parseShiftsFromNotes(prevClosing.notes);
                if (parsedShifts) sData = parsedShifts;
            }

            let s1Amount = 0;
            let s1Attendants = [];
            if (sData && sData.length > 0) {
                const s1 = sData.find(s => s.id === 'shift_1') || sData[0];
                if (s1 && Array.isArray(s1.attendants)) {
                    s1Attendants = s1.attendants;
                    s1Amount = s1Attendants.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
                }
            } else if (prevClosing?.recette_8h_j) {
                s1Amount = Number(prevClosing.recette_8h_j) || 0;
            }

            setPrevShift1Data({
                amount: s1Amount,
                attendants: s1Attendants,
                loading: false,
                loaded: true,
                date: prevDateStr
            });
        } catch (err) {
            console.error('Error fetching prev day shift 1:', err);
            setPrevShift1Data(prev => ({ ...prev, loading: false }));
        }
    };

    // Copy attendants list from previous day with amounts set to 0
    const handleCopyPreviousDayAttendants = async () => {
        setCopyingPrevious(true);
        try {
            const [y, m, d] = selectedDate.split('-').map(Number);
            const prevDate = new Date(y, m - 1, d);
            prevDate.setDate(prevDate.getDate() - 1);
            const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;

            const { data: prevClosing, error } = await supabase
                .from('daily_cash_closings')
                .select('*')
                .eq('date', prevDateStr)
                .maybeSingle();

            if (error) throw error;

            if (!prevClosing) {
                showError(`Aucun contrôle trouvé pour la veille (${prevDateStr}).`);
                return;
            }

            let sourceShifts = null;
            if (prevClosing.shifts_data && Array.isArray(prevClosing.shifts_data) && prevClosing.shifts_data.length > 0) {
                sourceShifts = prevClosing.shifts_data;
            } else {
                const { parsedShifts } = parseShiftsFromNotes(prevClosing.notes);
                if (parsedShifts && Array.isArray(parsedShifts)) {
                    sourceShifts = parsedShifts;
                }
            }

            if (!sourceShifts || sourceShifts.length === 0) {
                showError(`Aucune liste de pompistes trouvée pour le ${prevDateStr}.`);
                return;
            }

            const copiedShifts = sourceShifts.map((s, sIdx) => ({
                id: s.id || `shift_${sIdx + 1}`,
                label: s.label || DEFAULT_SHIFTS[sIdx]?.label || `Shift ${sIdx + 1}`,
                timeRange: s.timeRange || DEFAULT_SHIFTS[sIdx]?.timeRange || '',
                color: s.color || DEFAULT_SHIFTS[sIdx]?.color || 'indigo',
                attendants: (s.attendants && s.attendants.length > 0)
                    ? s.attendants.map((att, aIdx) => ({
                        id: `${s.id || `shift_${sIdx + 1}`}_a_${Date.now()}_${aIdx}`,
                        attendantName: att.attendantName || '',
                        amount: 0
                    }))
                    : [{ id: `${s.id || `shift_${sIdx + 1}`}_a_${Date.now()}`, attendantName: '', amount: 0 }]
            }));

            setShifts(copiedShifts);
            saveLocalDraft({ shifts: copiedShifts, annexes, horsEspeces, comptageReel, notes });
            showSuccess(`Équipe des pompistes du ${prevDateStr} reprise (montants à 0 DH) !`);
        } catch (err) {
            console.error('Erreur lors de la reprise des pompistes de la veille:', err);
            showError('Erreur lors de la récupération des données de la veille.');
        } finally {
            setCopyingPrevious(false);
        }
    };

    // Open edit date modal
    const handleOpenEditDateModal = async (hist) => {
        let item = hist;
        if (!item?.id && item?.date) {
            const found = historyList.find(h => h.date === item.date);
            if (found) {
                item = found;
            } else {
                const { data } = await supabase
                    .from('daily_cash_closings')
                    .select('*')
                    .eq('date', item.date)
                    .maybeSingle();
                if (data) item = data;
            }
        }
        setHistToEditDate(item);
        setNewDateTarget(item?.date || selectedDate);
        setIsEditDateModalOpen(true);
    };

    // Save modified date
    const handleSaveModifiedDate = async (e) => {
        if (e) e.preventDefault();
        if (!histToEditDate || !histToEditDate.id) {
            showError("Impossible de modifier la date : enregistrement introuvable.");
            return;
        }
        if (!newDateTarget || newDateTarget.trim() === '') {
            showError("Veuillez sélectionner une nouvelle date.");
            return;
        }
        const oldDate = histToEditDate.date;
        if (newDateTarget === oldDate) {
            setIsEditDateModalOpen(false);
            return;
        }

        setSavingNewDate(true);
        try {
            // Check if another record already exists for the new date
            const { data: existingTarget, error: checkError } = await supabase
                .from('daily_cash_closings')
                .select('id, date')
                .eq('date', newDateTarget)
                .maybeSingle();

            if (checkError) throw checkError;

            if (existingTarget && existingTarget.id !== histToEditDate.id) {
                const confirmOverwrite = window.confirm(
                    `Un contrôle de recette existe déjà pour le ${newDateTarget}.\n\nVoulez-vous le remplacer par celui du ${oldDate} ?`
                );
                if (!confirmOverwrite) {
                    setSavingNewDate(false);
                    return;
                }
                // Delete conflicting entry
                await supabase
                    .from('daily_cash_closings')
                    .delete()
                    .eq('id', existingTarget.id);
            }

            // Update date in database
            const { error: updateError } = await supabase
                .from('daily_cash_closings')
                .update({ date: newDateTarget })
                .eq('id', histToEditDate.id);

            if (updateError) throw updateError;

            // Migrate localStorage draft if present
            const oldDraft = localStorage.getItem(`draft_revenue_control_${oldDate}`);
            if (oldDraft) {
                localStorage.setItem(`draft_revenue_control_${newDateTarget}`, oldDraft);
                localStorage.removeItem(`draft_revenue_control_${oldDate}`);
            }

            showSuccess(`Date modifiée avec succès : ${oldDate} ➔ ${newDateTarget}`);
            setIsEditDateModalOpen(false);

            // If current selected date was the old date, switch to new date
            if (selectedDate === oldDate) {
                setSelectedDate(newDateTarget);
            } else {
                fetchHistory();
            }
        } catch (err) {
            console.error("Erreur lors de la modification de la date:", err);
            showError(`Erreur lors de la modification de la date: ${err.message || 'Erreur inconnue'}`);
        } finally {
            setSavingNewDate(false);
        }
    };

    // Delete a history day
    const handleDeleteHistoryDay = async (hist) => {
        if (!hist) return;
        const dateLabel = formatDisplayDate(hist.date) || hist.date;
        const confirmDelete = window.confirm(
            `Êtes-vous sûr de vouloir supprimer définitivement le contrôle de recette du ${dateLabel} (${hist.date}) ?\n\nCette action est irréversible.`
        );
        if (!confirmDelete) return;

        setDeletingHistoryId(hist.id);
        try {
            const { error } = await supabase
                .from('daily_cash_closings')
                .delete()
                .eq('id', hist.id);

            if (error) throw error;

            localStorage.removeItem(`draft_revenue_control_${hist.date}`);
            showSuccess(`Contrôle de recette du ${hist.date} supprimé avec succès.`);

            if (selectedDate === hist.date) {
                fetchDataForDate(true);
            }
            fetchHistory();
        } catch (err) {
            console.error("Erreur lors de la suppression:", err);
            showError(`Erreur lors de la suppression: ${err.message || 'Erreur inconnue'}`);
        } finally {
            setDeletingHistoryId(null);
        }
    };

    // Delete current loaded day
    const handleDeleteCurrentDay = async () => {
        let item = historyList.find(h => h.date === selectedDate);
        if (!item) {
            const { data } = await supabase
                .from('daily_cash_closings')
                .select('*')
                .eq('date', selectedDate)
                .maybeSingle();
            if (data) item = data;
        }
        if (item) {
            await handleDeleteHistoryDay(item);
        } else {
            showError("Aucune donnée enregistrée à supprimer pour cette date.");
        }
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

    // --- CONTRÔLE RENDEMENT TOTAL SYSTÈME (JOURNÉE J-1 : 00h00 à 23h59) ---
    // Date de la veille J-1
    const prevDateStr = useMemo(() => {
        return getPreviousDayDateStr(selectedDate);
    }, [selectedDate]);

    // Shift 2 amount (Journée 08h-18h) sur la fiche en cours
    const shift2Amount = useMemo(() => {
        const s2 = shifts.find(s => s.id === 'shift_2');
        return (s2?.attendants || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    }, [shifts]);

    // Shift 3 amount (Soirée 18h-00h) sur la fiche en cours
    const shift3Amount = useMemo(() => {
        const s3 = shifts.find(s => s.id === 'shift_3');
        return (s3?.attendants || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    }, [shifts]);

    // Total Reconstitué Piste de la veille J-1 (00h00 à 23h59) :
    // = Shift 1 Nuit Veille (00h-08h) + Shift 2 Journée (08h-18h) + Shift 3 Soirée (18h-00h)
    const totalReconstitueJPrev = useMemo(() => {
        return (Number(prevShift1Data.amount) || 0) + shift2Amount + shift3Amount;
    }, [prevShift1Data.amount, shift2Amount, shift3Amount]);

    // Écart Contrôle Système Istiraha vs Piste Reconstituée
    const ecartSystemeJPrev = useMemo(() => {
        const sysVal = Number(systemRendementPrev) || 0;
        if (sysVal === 0) return null;
        return sysVal - totalReconstitueJPrev;
    }, [systemRendementPrev, totalReconstitueJPrev]);

    const isSystemJPrevOk = useMemo(() => {
        return ecartSystemeJPrev !== null && Math.abs(ecartSystemeJPrev) <= 0.05;
    }, [ecartSystemeJPrev]);

    // Save draft locally
    const saveLocalDraft = (stateToSave) => {
        try {
            const dataWithSystem = {
                ...stateToSave,
                systemRendementPrev: Number(systemRendementPrev) || 0,
                prevShift1Amount: Number(prevShift1Data.amount) || 0
            };
            localStorage.setItem(`draft_revenue_control_${selectedDate}`, JSON.stringify(dataWithSystem));
        } catch (e) {
            console.error("Error saving draft to local storage:", e);
        }
    };

    // Fetch data for selected date
    const fetchDataForDate = async (ignoreDraft = false) => {
        setLoadingData(true);
        try {
            // Toujours récupérer le Shift 1 (00h-08h) de la veille J-1 pour le contrôle
            await fetchPrevDayShift1(selectedDate);

            // Query database first to know if the day is already recorded
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
                setIsDaySaved(true);
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
                setSystemRendementPrev(Number(closing.total_rendement_j_prev) || 0);

                // Si recette_8h_j_prev est déjà sauvegardé en base pour ce jour, on peut l'utiliser
                if (closing.recette_8h_j_prev && Number(closing.recette_8h_j_prev) > 0) {
                    setPrevShift1Data(prev => ({ ...prev, amount: Number(closing.recette_8h_j_prev) }));
                }

                const { cleanNotes } = parseShiftsFromNotes(closing.notes);
                setNotes(cleanNotes || '');
            } else {
                // New day: clean fresh default
                setIsDaySaved(false);
                setShifts(DEFAULT_SHIFTS);
                setAnnexes({ shop_cafe: 0, sce_bosch: 0, lubrifiant: 0 });
                setHorsEspeces({ tpe: 0, petrom_card: 0, bon_ste: 0, bon_sntl: 0 });
                setSystemRendementPrev(0);
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

            // Check draft in localStorage to overlay unsaved work if present
            const draft = localStorage.getItem(`draft_revenue_control_${selectedDate}`);
            if (draft && !ignoreDraft) {
                try {
                    const parsed = JSON.parse(draft);
                    if (parsed.shifts) setShifts(parsed.shifts);
                    if (parsed.annexes) setAnnexes(parsed.annexes);
                    if (parsed.horsEspeces) setHorsEspeces(parsed.horsEspeces);
                    if (parsed.comptageReel !== undefined) setComptageReel(parsed.comptageReel);
                    if (parsed.systemRendementPrev !== undefined) setSystemRendementPrev(parsed.systemRendementPrev);
                    if (parsed.prevShift1Amount !== undefined && Number(parsed.prevShift1Amount) > 0) {
                        setPrevShift1Data(prev => ({ ...prev, amount: Number(parsed.prevShift1Amount) }));
                    }
                    if (parsed.notes !== undefined) setNotes(parsed.notes);
                } catch (e) {
                    console.error("Error parsing local draft:", e);
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
                recette_8h_j_prev: Number(prevShift1Data.amount) || 0,
                total_rendement_j_prev: Number(systemRendementPrev) || 0,
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
                        recette_8h_j_prev: Number(prevShift1Data.amount) || 0,
                        total_rendement_j_prev: Number(systemRendementPrev) || 0,
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
                notes,
                systemRendementPrev: Number(systemRendementPrev) || 0,
                totalReconstitueJPrev,
                ecartSystemeJPrev,
                prevDateStr
            });
            showSuccess('Export Excel généré avec succès !');
        } catch (err) {
            console.error('Error exporting to Excel:', err);
            showError('Erreur lors de l\'export Excel.');
        } finally {
            setExportingExcel(false);
        }
    };

    // Imprimer la fiche de contrôle de la journée en cours
    const handlePrintCurrentDay = () => {
        printRevenueControlSheet({
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
            notes,
            systemRendementPrev: Number(systemRendementPrev) || 0,
            totalReconstitueJPrev,
            ecartSystemeJPrev,
            prevDateStr
        });
    };

    // Imprimer la fiche de contrôle d'une journée de l'historique
    const handlePrintHistoryDay = (hist) => {
        if (!hist) return;
        let histRend = 0;
        let histShifts = hist.shifts_data && Array.isArray(hist.shifts_data) ? hist.shifts_data : [];
        if (histShifts.length > 0) {
            histShifts.forEach(s => (s.attendants || []).forEach(a => histRend += Number(a.amount) || 0));
        } else {
            histRend = Number(hist.total_rendement_piste) || 0;
            if (histRend === 0) {
                histRend = (Number(hist.total_rendement_j_prev) - Number(hist.recette_8h_j_prev)) + Number(hist.recette_8h_j);
            }
            histShifts = [
                {
                    id: 'shift_1',
                    label: 'Shift 1 : Nuit',
                    timeRange: '00h00 à 08h00',
                    attendants: [{ id: 's1', attendantName: 'Équipe de piste', amount: histRend }]
                }
            ];
        }

        const histAnnexes = {
            shop_cafe: Number(hist.shop_cafe) || 0,
            sce_bosch: Number(hist.sce_bosch) || 0,
            lubrifiant: Number(hist.lubrifiant) || 0
        };
        const histHorsEsp = {
            tpe: Number(hist.tpe) || 0,
            petrom_card: Number(hist.petrom_card) || 0,
            bon_ste: Number(hist.bon_ste) || 0,
            bon_sntl: Number(hist.bon_sntl) || 0
        };

        const totAnnexes = histAnnexes.shop_cafe + histAnnexes.sce_bosch + histAnnexes.lubrifiant;
        const totRecettes = histRend + totAnnexes;
        const totHorsEsp = histHorsEsp.tpe + histHorsEsp.petrom_card + histHorsEsp.bon_ste + histHorsEsp.bon_sntl;
        const soldeTheo = totRecettes - totHorsEsp;
        const comptage = Number(hist.comptage_espece_total) || 0;
        const ec = comptage - soldeTheo;

        printRevenueControlSheet({
            date: hist.date,
            shifts: histShifts,
            annexes: histAnnexes,
            horsEspeces: histHorsEsp,
            comptageReel: comptage,
            totalRendement: histRend,
            totalAnnexes: totAnnexes,
            totalRecettes: totRecettes,
            totalHorsEspeces: totHorsEsp,
            soldeTheorique: soldeTheo,
            ecart: ec,
            notes: hist.notes || ''
        });
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
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-4">
                        {/* Title & Status Badge row */}
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-3.5 h-3.5 rounded-full bg-cyan-500 shadow-sm shadow-cyan-500/50"></div>
                                <div>
                                    <h3 className="font-bold text-lg sm:text-xl text-gray-800 tracking-tight">
                                        Contrôle des Recettes
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {formatDisplayDate(selectedDate)}
                                    </p>
                                </div>
                            </div>

                            {/* Status Badge */}
                            <div className="flex items-center gap-2">
                                {isDaySaved ? (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                                            <CheckCircle2 size={14} className="text-emerald-600" />
                                            <span>Journée enregistrée</span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEditDateModal({ date: selectedDate })}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-all cursor-pointer shadow-2xs"
                                            title="Modifier la date de ce contrôle"
                                        >
                                            <Pencil size={12} />
                                            <span className="hidden sm:inline">Changer la date</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDeleteCurrentDay}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer shadow-2xs"
                                            title="Supprimer ce contrôle définitivement"
                                        >
                                            <Trash2 size={12} />
                                            <span className="hidden sm:inline">Supprimer</span>
                                        </button>
                                    </div>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs animate-pulse">
                                        <Sparkles size={14} className="text-amber-600" />
                                        <span>Nouvelle journée vierge à calculer</span>
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Date Navigation Bar & Action Buttons */}
                        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 pt-3 border-t border-gray-100">
                            {/* Date Picker + Quick Navigation buttons */}
                            <div className="flex flex-wrap items-center gap-1.5 bg-gray-50/80 p-1.5 rounded-2xl border border-gray-200/80">
                                <button
                                    type="button"
                                    onClick={handlePrevDay}
                                    className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100/80 rounded-xl border border-gray-200 transition-all cursor-pointer shadow-2xs active:scale-95"
                                    title="Aller au jour précédent (J-1)"
                                >
                                    <ChevronLeft size={14} />
                                    <span>J-1</span>
                                </button>

                                <div className="w-36 sm:w-40">
                                    <DateInput
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="w-full"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={handleNextDay}
                                    className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100/80 rounded-xl border border-gray-200 transition-all cursor-pointer shadow-2xs active:scale-95"
                                    title="Aller au jour suivant (J+1)"
                                >
                                    <span>J+1</span>
                                    <ChevronRight size={14} />
                                </button>

                                <button
                                    type="button"
                                    onClick={handleToday}
                                    className="px-2.5 py-2 text-xs font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100/80 rounded-xl border border-cyan-200 transition-all cursor-pointer shadow-2xs"
                                    title="Revenir à aujourd'hui"
                                >
                                    Aujourd'hui
                                </button>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                                {/* Option: Reprendre les pompistes de la veille (J-1) */}
                                <button
                                    type="button"
                                    onClick={handleCopyPreviousDayAttendants}
                                    disabled={copyingPrevious || loadingData}
                                    className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-indigo-200 text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/80 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                                    title="Reprendre les mêmes pompistes que la veille avec montants à 0 DH"
                                >
                                    {copyingPrevious ? <Loader2 size={14} className="animate-spin text-indigo-600" /> : <Copy size={14} className="text-indigo-600" />}
                                    <span>{copyingPrevious ? 'Copie...' : 'Équipe de la veille'}</span>
                                </button>

                                {/* Reset Button */}
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    disabled={loadingData || savingData}
                                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-rose-200 text-rose-600 bg-rose-50/40 hover:bg-rose-50 transition-all cursor-pointer disabled:opacity-50"
                                    title="Réinitialiser la saisie"
                                >
                                    <Trash2 size={14} />
                                    <span>RAZ</span>
                                </button>

                                {/* Export Excel Button */}
                                <button
                                    type="button"
                                    onClick={handleExportExcel}
                                    disabled={loadingData || savingData || exportingExcel}
                                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100/70 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                                >
                                    {exportingExcel ? <Loader2 size={14} className="animate-spin text-emerald-600" /> : <FileSpreadsheet size={14} className="text-emerald-600" />}
                                    <span>Excel</span>
                                </button>

                                {/* Print Button */}
                                <button
                                    type="button"
                                    onClick={handlePrintCurrentDay}
                                    disabled={loadingData}
                                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-sky-200 text-sky-700 bg-sky-50/80 hover:bg-sky-100/70 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                                    title="Imprimer la fiche de contrôle du jour avec mise en page professionnelle"
                                >
                                    <Printer size={14} className="text-sky-600" />
                                    <span>Imprimer</span>
                                </button>

                                {/* Save Button */}
                                <button
                                    type="submit"
                                    disabled={loadingData || savingData}
                                    className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-xl text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {savingData ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                    <span>{savingData ? 'Enregistrement...' : (isDaySaved ? `Mettre à jour (${selectedDate})` : `Enregistrer (${selectedDate})`)}</span>
                                </button>
                            </div>
                        </div>

                        {/* Safety notice banner */}
                        {isDaySaved ? (
                            <div className="px-3.5 py-2 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-[11px] text-emerald-800 flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 font-medium">
                                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                                    Cette journée du <b>{selectedDate}</b> est enregistrée en base. Pour calculer le <b>jour suivant</b> (ex: week-end), cliquez sur <b>J+1 ▶</b> ou choisissez la date dans le calendrier ci-dessus.
                                </span>
                            </div>
                        ) : (
                            <div className="px-3.5 py-2 bg-blue-50/70 border border-blue-200/80 rounded-xl text-[11px] text-blue-800 flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 font-medium">
                                    <Sparkles size={13} className="text-blue-600 shrink-0" />
                                    Vous saisissez une nouvelle journée pour le <b>{selectedDate}</b>. Vos données des autres dates restent intactes et protégées.
                                </span>
                            </div>
                        )}
                    </div>

                    {/* MOBILE QUICK RESULT BANNER (Visible on mobile/tablet, hidden on desktop lg) */}
                    <div className={`lg:hidden p-4 rounded-2xl border shadow-sm flex items-center justify-between gap-3 transition-all ${
                        isOk
                            ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                            : ecartFinal > 0
                                ? 'bg-blue-50/90 border-blue-200 text-blue-900'
                                : 'bg-rose-50/90 border-rose-200 text-rose-900'
                    }`}>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">Écart de caisse</span>
                            <div className="text-2xl font-black font-mono">
                                {ecartFinal >= 0 ? '+' : ''}{ecartFinal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                            </div>
                            <span className="text-[11px] font-semibold">
                                {isOk ? '✅ Caisse Équilibrée' : (ecartFinal > 0 ? '🔵 Excédent détecté' : '🔴 Déficit détecté')}
                            </span>
                        </div>
                        <div className="text-right text-xs space-y-0.5 font-mono">
                            <div className="text-gray-500 text-[10px]">Théo : <span className="font-bold text-gray-800">{soldeTheoriqueEspeces.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DH</span></div>
                            <div className="text-gray-500 text-[10px]">Réel : <span className="font-bold text-gray-800">{Number(comptageReel || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DH</span></div>
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
                                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-5">
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-100 pb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-2 h-4 bg-indigo-600 rounded"></div>
                                            <h4 className="font-bold text-sm text-indigo-700 uppercase tracking-wider">
                                                Section 1 : Rendements Piste (Shifts)
                                            </h4>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!isDaySaved && (
                                                <button
                                                    type="button"
                                                    onClick={handleCopyPreviousDayAttendants}
                                                    disabled={copyingPrevious || loadingData}
                                                    className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/80 px-2.5 py-1 rounded-lg border border-indigo-200 transition-all cursor-pointer disabled:opacity-50"
                                                    title="Reprendre les mêmes pompistes que la veille (montants à 0 DH)"
                                                >
                                                    <Copy size={12} />
                                                    <span>Copier équipe J-1</span>
                                                </button>
                                            )}
                                            <div className="text-xs font-bold font-mono text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                                                Total Piste : {totalRendementPiste.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                            </div>
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
                                                    className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
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

                                                    {/* Attendants rows (mobile responsive) */}
                                                    <div className="space-y-2.5">
                                                        {(shift.attendants || []).map((att) => (
                                                            <div key={att.id} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white p-2.5 rounded-xl border border-gray-100 shadow-2xs">
                                                                {/* Pompiste Select */}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="relative">
                                                                        <select
                                                                            value={att.attendantName}
                                                                            onChange={(e) => updateAttendantField(shift.id, att.id, 'attendantName', e.target.value)}
                                                                            className="w-full text-xs font-semibold py-2.5 sm:py-2 pl-3 pr-7 bg-gray-50/60 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-800 cursor-pointer"
                                                                        >
                                                                            <option value="">Sélectionner un pompiste...</option>
                                                                            {ATTENDANTS_LIST.map((name) => (
                                                                                <option key={name} value={name}>{name}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                </div>

                                                                {/* Rendement input & delete */}
                                                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                                                    <div className="relative flex-1 sm:w-44">
                                                                        <input
                                                                            step="0.01"
                                                                            placeholder="0.00"
                                                                            className="w-full pr-8 pl-3 py-2 text-xs font-mono font-bold text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                                                            {...getNumberInputProps(
                                                                                att.amount,
                                                                                (v) => updateAttendantField(shift.id, att.id, 'amount', v),
                                                                                `att_${att.id}`
                                                                            )}
                                                                        />
                                                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">DH</span>
                                                                    </div>

                                                                    {(shift.attendants || []).length > 1 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeAttendantRow(shift.id, att.id)}
                                                                            className="p-2 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                                                                            title="Supprimer ce pompiste"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    )}
                                                                </div>
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

                                {/* BLOC CONTRÔLE DU RENDEMENT TOTAL SYSTÈME (00h00 à 23h59 — JOURNÉE J-1) */}
                                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-indigo-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-4 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-purple-600"></div>

                                    {/* En-tête */}
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-100 pb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                                                <ShieldCheck size={18} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                                    Contrôle Rendement Total Système (00h00 à 23h59)
                                                </h4>
                                                <p className="text-[11px] text-gray-500">
                                                    Rapprochement de la journée complète de la veille (J-1 : <span className="font-semibold text-gray-700">{formatDisplayDate(prevDateStr)}</span>)
                                                </p>
                                            </div>
                                        </div>

                                        {/* Actions & Badge */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => fetchPrevDayShift1(selectedDate)}
                                                disabled={prevShift1Data.loading}
                                                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/80 px-2.5 py-1 rounded-lg border border-indigo-200 transition-all cursor-pointer disabled:opacity-50"
                                                title="Actualiser le Shift 1 de la veille"
                                            >
                                                <RefreshCw size={12} className={prevShift1Data.loading ? 'animate-spin' : ''} />
                                                <span>Actualiser J-1</span>
                                            </button>
                                            <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                                                Piste Reconstituée : {totalReconstitueJPrev.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                            </span>
                                        </div>
                                    </div>

                                    {/* Formule explicative */}
                                    <div className="text-[11px] text-indigo-900 bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 flex items-start gap-2">
                                        <Info size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="font-bold">Règle de reconstitution des 24h (00h00 à 23h59) :</span>{' '}
                                            Shift Nuit (00h00 à 08h00 relevé à J-1) + Shift Journée (08h00 à 18h00) + Shift Soirée (18h00 à 00h00).
                                        </div>
                                    </div>

                                    {/* Les 3 Blocs de Shifts composant les 24h de J-1 */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {/* Shift 1 Nuit Veille */}
                                        <div className="p-3 bg-indigo-50/30 rounded-xl border border-indigo-100 space-y-1.5">
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="font-bold text-indigo-900">Shift 1 : Nuit (Veille J-1)</span>
                                                <span className="text-[10px] text-indigo-600 font-mono bg-white px-1.5 py-0.5 rounded border border-indigo-100">00h00 - 08h00</span>
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <span className="font-mono font-bold text-sm text-indigo-700">
                                                    {formatNumber(prevShift1Data.amount)} DH
                                                </span>
                                                {prevShift1Data.attendants && prevShift1Data.attendants.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPrevShiftDetails(!showPrevShiftDetails)}
                                                        className="text-[10px] text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                                                    >
                                                        {showPrevShiftDetails ? 'Masquer' : `${prevShift1Data.attendants.length} pompiste(s)`}
                                                    </button>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-gray-500 truncate">
                                                {prevShift1Data.loading ? 'Chargement...' : `Date : ${prevDateStr}`}
                                            </div>
                                        </div>

                                        {/* Shift 2 Journée */}
                                        <div className="p-3 bg-amber-50/30 rounded-xl border border-amber-100 space-y-1.5">
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="font-bold text-amber-900">Shift 2 : Journée</span>
                                                <span className="text-[10px] text-amber-600 font-mono bg-white px-1.5 py-0.5 rounded border border-amber-100">08h00 - 18h00</span>
                                            </div>
                                            <div className="font-mono font-bold text-sm text-amber-700">
                                                {formatNumber(shift2Amount)} DH
                                            </div>
                                            <div className="text-[10px] text-gray-500">
                                                Fiche en cours
                                            </div>
                                        </div>

                                        {/* Shift 3 Soirée */}
                                        <div className="p-3 bg-purple-50/30 rounded-xl border border-purple-100 space-y-1.5">
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="font-bold text-purple-900">Shift 3 : Soirée</span>
                                                <span className="text-[10px] text-purple-600 font-mono bg-white px-1.5 py-0.5 rounded border border-purple-100">18h00 - 00h00</span>
                                            </div>
                                            <div className="font-mono font-bold text-sm text-purple-700">
                                                {formatNumber(shift3Amount)} DH
                                            </div>
                                            <div className="text-[10px] text-gray-500">
                                                Fiche en cours
                                            </div>
                                        </div>
                                    </div>

                                    {/* Détail déroulant des pompistes du Shift 1 de la veille */}
                                    {showPrevShiftDetails && prevShift1Data.attendants && prevShift1Data.attendants.length > 0 && (
                                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1.5">
                                            <div className="font-bold text-gray-700 text-[11px] uppercase tracking-wider mb-1">
                                                Pompistes du Shift Nuit ({prevDateStr}) :
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                {prevShift1Data.attendants.map((att, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-white p-1.5 px-2.5 rounded border border-gray-100">
                                                        <span className="font-medium text-gray-800">{att.attendantName || 'Pompiste'}</span>
                                                        <span className="font-mono font-bold text-gray-900">{formatNumber(att.amount)} DH</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Saisie Rapport Système Istiraha et Comparaison */}
                                    <div className="p-4 bg-gray-50/80 rounded-xl border border-gray-200 space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                                                    Rapport Rendement Système Istiraha (00h00 - 23h59)
                                                </label>
                                                <span className="text-[10px] text-gray-500">
                                                    Montant total prévu sur le rapport Istiraha pour la journée du {formatDisplayDate(prevDateStr)}
                                                </span>
                                            </div>
                                            
                                            <div className="relative w-full sm:w-56">
                                                <input
                                                    step="0.01"
                                                    placeholder="ex: 341 230.18"
                                                    className="w-full pr-9 pl-3 py-2 text-sm font-mono font-bold text-right border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-2xs"
                                                    {...getNumberInputProps(
                                                        systemRendementPrev,
                                                        (v) => setSystemRendementPrev(v),
                                                        'systemRendementPrev'
                                                    )}
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">DH</span>
                                            </div>
                                        </div>

                                        {/* Résultat du contrôle & Écart */}
                                        {Number(systemRendementPrev) > 0 ? (
                                            <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                                isSystemJPrevOk
                                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                                    : 'bg-rose-50 border-rose-200 text-rose-900'
                                            }`}>
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 size={18} className={isSystemJPrevOk ? 'text-emerald-600' : 'text-rose-600'} />
                                                    <div>
                                                        <div className="font-bold text-xs uppercase tracking-wider">
                                                            {isSystemJPrevOk ? 'Contrôle Validé — 100% Conforme' : 'Écart Détecté'}
                                                        </div>
                                                        <div className="text-[11px] opacity-90">
                                                            {isSystemJPrevOk
                                                                ? 'Le total des 3 shifts (Piste) correspond exactement au montant prévu du rapport Istiraha.'
                                                                : ecartSystemeJPrev > 0
                                                                    ? `Le rapport système est supérieur à la piste de +${formatNumber(ecartSystemeJPrev)} DH.`
                                                                    : `Le total piste est supérieur au système de ${formatNumber(ecartSystemeJPrev)} DH.`
                                                            }
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-right sm:shrink-0">
                                                    <span className="text-[10px] uppercase font-bold block opacity-75">Écart Système / Piste</span>
                                                    <span className="font-mono font-black text-sm">
                                                        {ecartSystemeJPrev >= 0 ? '+' : ''}{formatNumber(ecartSystemeJPrev)} DH
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-[11px] text-gray-500 italic bg-white p-2.5 rounded-lg border border-gray-200 flex items-center gap-2">
                                                <Info size={14} className="text-gray-400 shrink-0" />
                                                <span>
                                                    Saisissez le montant total du rapport Istiraha ci-dessus (ex: 341 230,18 DH) pour valider l'écart avec les 3 shifts.
                                                </span>
                                            </div>
                                        )}
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
                        <>
                            {/* MOBILE VIEW : ADAPTIVE CARDS (Visible on mobile screens) */}
                            <div className="md:hidden space-y-3">
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
                                        <div key={hist.id} className="p-4 rounded-2xl border border-gray-100 bg-white shadow-2xs space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-bold text-sm text-gray-800">
                                                        {new Date(hist.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </div>
                                                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        histOk 
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                            : histEcart > 0 
                                                                ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                                                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                    }`}>
                                                        {histOk ? 'Équilibrée' : (histEcart > 0 ? 'Excédent' : 'Déficit')}
                                                    </span>
                                                </div>

                                                <div className="text-right">
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Écart</span>
                                                    <span className={`text-base font-black font-mono ${
                                                        histOk ? 'text-emerald-600' : (histEcart > 0 ? 'text-blue-600' : 'text-rose-600')
                                                    }`}>
                                                        {histEcart >= 0 ? '+' : ''}{histEcart.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
                                                    </span>
                                                </div>
                                            </div>

                                            {/* 2x2 Breakdown Grid */}
                                            <div className="grid grid-cols-2 gap-2 p-2.5 bg-gray-50/80 rounded-xl text-xs font-mono">
                                                <div>
                                                    <span className="text-[10px] text-gray-400 block font-sans">Rendement Piste</span>
                                                    <span className="font-bold text-indigo-700">{histRend.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-gray-400 block font-sans">Ventes Annexes</span>
                                                    <span className="font-bold text-emerald-700">{histAnnexes.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-gray-400 block font-sans">Hors Espèces</span>
                                                    <span className="font-bold text-amber-700">{histHorsEsp.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-gray-400 block font-sans">Espèces Réelles</span>
                                                    <span className="font-bold text-rose-700">{histReel.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH</span>
                                                </div>
                                            </div>

                                            {hist.notes && (
                                                <p className="text-[11px] text-gray-500 italic bg-amber-50/40 p-2 rounded-lg border border-amber-100">
                                                    {hist.notes}
                                                </p>
                                            )}

                                            <div className="flex items-center gap-2 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedDate(hist.date);
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    className="flex-1 py-2 text-xs font-bold text-indigo-600 bg-indigo-50/80 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer text-center"
                                                >
                                                    Consulter
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePrintHistoryDay(hist)}
                                                    className="p-2 text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 rounded-xl transition-colors cursor-pointer shrink-0"
                                                    title="Imprimer cette fiche de contrôle"
                                                >
                                                    <Printer size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEditDateModal(hist)}
                                                    className="p-2 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-xl transition-colors cursor-pointer shrink-0"
                                                    title="Changer la date de cette journée"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteHistoryDay(hist)}
                                                    disabled={deletingHistoryId === hist.id}
                                                    className="p-2 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-xl transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                                                    title="Supprimer ce contrôle"
                                                >
                                                    {deletingHistoryId === hist.id ? <Loader2 size={14} className="animate-spin text-rose-600" /> : <Trash2 size={14} />}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* DESKTOP VIEW : FULL TABULAR TABLE */}
                            <div className="hidden md:block overflow-x-auto">
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
                                                    <td className="py-3 px-3 text-center whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedDate(hist.date);
                                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                                }}
                                                                className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                                                                title="Charger cette journée dans le formulaire"
                                                            >
                                                                Consulter
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePrintHistoryDay(hist)}
                                                                className="p-1 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                                                                title="Imprimer cette fiche de contrôle"
                                                            >
                                                                <Printer size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenEditDateModal(hist)}
                                                                className="p-1 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                                                title="Changer la date de cette journée"
                                                            >
                                                                <Pencil size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteHistoryDay(hist)}
                                                                disabled={deletingHistoryId === hist.id}
                                                                className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                                                title="Supprimer définitivement ce contrôle"
                                                            >
                                                                {deletingHistoryId === hist.id ? <Loader2 size={13} className="animate-spin text-rose-600" /> : <Trash2 size={13} />}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
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

            {/* MODAL MODIFIER LA DATE */}
            <Modal
                isOpen={isEditDateModalOpen}
                onClose={() => !savingNewDate && setIsEditDateModalOpen(false)}
                title="Modifier la date du contrôle"
                className="max-w-md"
            >
                <form onSubmit={handleSaveModifiedDate} className="space-y-4">
                    <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-800 space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-amber-900">
                            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                            <span>Déplacement de la date du contrôle</span>
                        </div>
                        <p className="leading-relaxed">
                            Date actuelle enregistrée : <span className="font-bold font-mono text-gray-900">{histToEditDate?.date}</span> ({formatDisplayDate(histToEditDate?.date)}).
                            <br />
                            Toutes les données associées (shifts, pompistes, montants, hors-espèces, comptage) seront transférées vers la nouvelle date.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-700">
                            Sélectionner la nouvelle date :
                        </label>
                        <DateInput
                            value={newDateTarget}
                            onChange={(e) => setNewDateTarget(e.target.value)}
                            className="w-full"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => setIsEditDateModalOpen(false)}
                            disabled={savingNewDate}
                            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={savingNewDate || !newDateTarget || newDateTarget === histToEditDate?.date}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                        >
                            {savingNewDate ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            <span>{savingNewDate ? 'Modification...' : 'Confirmer le changement'}</span>
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
