import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatPrice } from '../utils/formatters';
import { Save, History, Calculator, AlertCircle, CheckCircle2, FileEdit, RotateCcw, Trash2, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

// Internal Toast Component
const Toast = ({ message, type = 'success', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`
            fixed top-6 left-1/2 -translate-x-1/2 z-[110] 
            flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border 
            animate-in slide-in-from-top-4 fade-in duration-300
            ${type === 'success' ? 'bg-white border-green-100 text-green-700' : 'bg-white border-red-100 text-red-700'}
        `}>
            {type === 'success' ? <CheckCircle2 size={20} className="text-green-500" /> : <AlertCircle size={20} className="text-red-500" />}
            <span className="font-medium text-sm">{message}</span>
        </div>
    );
};

// Extracted component with Visual Cues - COMPACT ROW DESIGN
const DenominationCard = ({ value, label, isCoin, isCents, count, onCountChange, onBlur }) => {
    let subtotal = 0;
    if (isCents) {
        subtotal = parseFloat(count) || 0;
    } else {
        subtotal = (Number(count) || 0) * Number(value);
    }

    // Color Mapping - Simplified for accent lines/bg
    const getStyles = (val, isCoin, isCents) => {
        if (isCents) return { border: 'border-orange-200', bg: 'bg-orange-50', accent: 'bg-orange-500', text: 'text-orange-700' };
        if (!isCoin) {
            switch (String(val)) {
                case '200': return { border: 'border-blue-200', bg: 'bg-blue-50', accent: 'bg-blue-600', text: 'text-blue-700' };
                case '100': return { border: 'border-amber-200', bg: 'bg-amber-50', accent: 'bg-amber-600', text: 'text-amber-800' };
                case '50': return { border: 'border-emerald-200', bg: 'bg-emerald-50', accent: 'bg-emerald-600', text: 'text-emerald-700' };
                case '20': return { border: 'border-purple-200', bg: 'bg-purple-50', accent: 'bg-purple-600', text: 'text-purple-700' };
                default: return { border: 'border-gray-200', bg: 'bg-gray-50', accent: 'bg-gray-500', text: 'text-gray-700' };
            }
        } else {
            // Coins
            switch (String(val)) {
                case '10': return { border: 'border-yellow-200', bg: 'bg-yellow-50', accent: 'bg-yellow-500', text: 'text-yellow-700' };
                default: return { border: 'border-gray-200', bg: 'bg-gray-50', accent: 'bg-gray-400', text: 'text-gray-700' };
            }
        }
    };

    const styles = getStyles(value, isCoin, isCents);
    const imagePath = isCents
        ? '/currency/cents.png'
        : `/currency/${value}dh.${isCoin ? 'png' : 'jpg'}`;

    return (
        <div className={`
            flex items-center gap-3 p-2 rounded-xl border border-transparent 
            hover:border-gray-200 hover:bg-white hover:shadow-sm transition-all duration-200
            ${isCoin ? 'bg-gray-50/50' : 'bg-white'} 
            group relative overflow-hidden
        `}>
            {/* Visual Cue - Left Accent Bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${styles.accent} opacity-0 group-hover:opacity-100 transition-opacity`} />

            {/* Image Container - Fixed Width */}
            <div className="w-16 h-12 flex-shrink-0 flex items-center justify-center bg-white rounded-lg border border-gray-100 shadow-sm relative overflow-hidden">
                <img
                    src={imagePath}
                    alt={`${value} DH`}
                    className={`max-h-full max-w-full object-contain ${isCoin || isCents ? 'mix-blend-multiply drop-shadow-sm p-1' : 'p-0.5'}`}
                    onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.nextSibling.style.display = 'flex'; }}
                />
                {/* Fallback */}
                <div className="hidden absolute inset-0 items-center justify-center font-bold text-gray-400 text-xs">
                    {isCents ? '¢' : value}
                </div>
            </div>

            {/* Explicit Label */}
            {!isCents && (
                <div className="hidden sm:flex w-16 font-bold text-gray-400 text-sm justify-end pr-2 text-right">
                    {value} <span className="text-[10px] ml-0.5 translate-y-[2px]">DH</span>
                </div>
            )}
            {isCents && (
                <div className="hidden sm:flex w-16 font-bold text-gray-400 text-xs justify-end pr-2 text-right uppercase">
                    Vrac
                </div>
            )}

            {/* Input Area - Expands */}
            <div className="flex-1 flex flex-col justify-center">
                <div className="flex items-center gap-2 relative">
                    <span className={`text-[10px] font-bold text-gray-400 uppercase tracking-wider w-8 transition-opacity ${count ? 'opacity-50' : 'opacity-100'}`}>
                        {isCents ? 'VAL' : 'QTÉ'}
                    </span>
                    <input
                        type={isCents ? "number" : "text"}
                        inputMode={isCents ? "decimal" : "numeric"}
                        value={count}
                        onChange={(e) => onCountChange(value, e.target.value)}
                        onBlur={onBlur}
                        placeholder="0"
                        className={`
                            w-full bg-transparent text-xl font-bold text-gray-900 placeholder-gray-200 outline-none
                            border-b border-gray-100 focus:border-indigo-500 transition-all py-0.5
                            ${count ? 'text-center text-indigo-900 scale-110 origin-center' : 'text-left'}
                        `}
                    />
                </div>
            </div>

            {/* Subtotal - Fixed Width & Aligned */}
            {!isCents && (
                <div className={`
                    w-36 flex items-center justify-end font-mono font-bold text-sm
                    ${subtotal > 0 ? styles.text : 'text-gray-300'}
                `}>
                    {formatPrice(subtotal)}
                </div>
            )}

            {/* Cents Label instead of subtotal for clarity */}
            {isCents && (
                <div className="w-36 flex items-center justify-end text-xs font-medium text-gray-400">
                    Calculé
                </div>
            )}
        </div>
    );
};

// Extracted History Item Component for expanded details
// NOW CONTROLLED COMPONENT
const HistoryItem = ({ item, onDelete, isExpanded, onToggle }) => {
    // Filter counts to only show those with values and sort them
    const sortOrder = ['200', '100', '50', '20', '10', '5', '2', '1', '0.5', 'cents'];
    const details = Object.entries(item.counts)
        .filter(([key, value]) => {
            if (key === 'cents') return parseFloat(value) > 0;
            return parseInt(value) > 0;
        })
        .sort(([keyA], [keyB]) => {
            return sortOrder.indexOf(keyA) - sortOrder.indexOf(keyB);
        });

    return (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden transition-all">
            <div
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={onToggle}
            >
                <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded text-xs">
                        {format(new Date(item.created_at), 'HH:mm')}
                    </span>
                    <div>
                        <div className="font-bold text-indigo-700">{formatPrice(item.total_calc)}</div>
                        <div className="text-xs text-gray-400">Vers: {formatPrice(item.expected_amount)}</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`font-mono font-bold text-sm ${item.gap === 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.gap > 0 ? '+' : ''}{formatPrice(item.gap)}
                    </span>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
            </div>

            {isExpanded && (
                <div className="bg-gray-50 p-3 border-t border-gray-100 text-sm space-y-4 animate-in slide-in-from-top-1 duration-200">
                    {/* Billets Section */}
                    {details.filter(([key]) => ['200', '100', '50', '20'].includes(key)).length > 0 && (
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-gray-700 text-xs uppercase tracking-wider">Billets (BBM)</span>
                                <span className="font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs">
                                    {formatPrice(details
                                        .filter(([key]) => ['200', '100', '50', '20'].includes(key))
                                        .reduce((acc, [key, val]) => acc + (Number(val) * Number(key)), 0)
                                    )}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 gap-2 text-xs text-gray-600 pl-2 border-l-2 border-gray-200">
                                {details
                                    .filter(([key]) => ['200', '100', '50', '20'].includes(key))
                                    .map(([key, value]) => (
                                        <div key={key} className="flex justify-between items-center bg-white p-1 rounded border border-gray-50">
                                            <span className="font-medium text-gray-500 w-16">{key} DH</span>
                                            <span className="font-mono font-bold text-gray-800">x {value}</span>
                                            <span className="font-mono font-bold text-indigo-600">
                                                {formatPrice(Number(value) * Number(key))}
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {/* Pièces Section */}
                    {details.filter(([key]) => !['200', '100', '50', '20'].includes(key)).length > 0 && (
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-gray-700 text-xs uppercase tracking-wider">Pièces (PPM)</span>
                                <span className="font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded text-xs">
                                    {formatPrice(details
                                        .filter(([key]) => !['200', '100', '50', '20'].includes(key))
                                        .reduce((acc, [key, val]) => {
                                            if (key === 'cents') return acc + parseFloat(val);
                                            return acc + (Number(val) * Number(key));
                                        }, 0)
                                    )}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 gap-2 text-xs text-gray-600 pl-2 border-l-2 border-gray-200">
                                {details
                                    .filter(([key]) => !['200', '100', '50', '20'].includes(key))
                                    .map(([key, value]) => (
                                        <div key={key} className="flex justify-between items-center bg-white p-1 rounded border border-gray-50">
                                            <span className="font-medium text-gray-500 w-16">{key === 'cents' ? 'Cents' : `${key} DH`}</span>
                                            <span className="font-mono font-bold text-gray-800">
                                                {key === 'cents' ? 'VAL' : `x ${value}`}
                                            </span>
                                            <span className="font-mono font-bold text-indigo-600">
                                                {key === 'cents' ? formatPrice(parseFloat(value)) : formatPrice(Number(value) * Number(key))}
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-2 border-t border-gray-200 mt-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('Voulez-vous vraiment supprimer cet enregistrement ?')) onDelete(item.id);
                            }}
                            className="flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1 rounded-md hover:bg-red-50 transition-colors"
                        >
                            <Trash2 size={14} />
                            Supprimer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default function MoneyCounting() {
    // Counts state
    const [counts, setCounts] = useState({
        200: '', 100: '', 50: '', 20: '',
        10: '', 5: '', 2: '', 1: '', 0.5: '',
        cents: '' // For arbitrary small amounts (0.34 etc)
    });

    // Editable Expected Amount (Starting Empty/Zero)
    const [manualExpectedAmount, setManualExpectedAmount] = useState('');

    // Calculated total
    const [total, setTotal] = useState(0);

    // History state
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [saving, setSaving] = useState(false);

    // Accordion State
    const [expandedId, setExpandedId] = useState(null);

    // Draft State
    const [draftStatus, setDraftStatus] = useState('');
    const [draftId, setDraftId] = useState(null);
    const [showToast, setShowToast] = useState(false); // Controls Toast visibility

    // Date for filtering history
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Fetch Draft on Mount
    const fetchDraft = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Robust fetch: order by updated_at desc, limit 1 to avoid .single() crashes if duplicates exist
            const { data, error } = await supabase
                .from('money_counting_drafts')
                .select('*')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            if (data && data.draft_data) {
                const { counts: savedCounts, expectedAmount: savedExpected } = data.draft_data;
                setDraftId(data.id);
                if (savedCounts) setCounts(savedCounts);
                if (savedExpected !== undefined) setManualExpectedAmount(savedExpected);

                setDraftStatus('Brouillon restauré');
                setShowToast(true); // Notify restoration
            }
        } catch (error) {
            console.error("Error fetching draft:", error);
        }
    };

    useEffect(() => {
        fetchDraft();
    }, []);

    // Helper: Save Draft to DB
    const saveDraftToDb = async (manual = false) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                if (manual) alert("Connectez-vous pour sauvegarder un brouillon.");
                return;
            }

            const draftData = {
                counts,
                expectedAmount: manualExpectedAmount,
                date: new Date().toISOString()
            };

            const query = supabase.from('money_counting_drafts');
            let error;
            let newId = draftId;

            if (draftId) {
                // Update specific known draft
                const res = await query.update({ draft_data: draftData, updated_at: new Date() }).eq('id', draftId);
                error = res.error;
            } else {
                // Check existence robustly before inserting
                const { data: existing } = await supabase
                    .from('money_counting_drafts')
                    .select('id')
                    .eq('user_id', user.id)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (existing) {
                    const res = await query.update({ draft_data: draftData, updated_at: new Date() }).eq('id', existing.id);
                    error = res.error;
                    newId = existing.id;
                } else {
                    const res = await query.insert({ user_id: user.id, draft_data: draftData }).select().single();
                    error = res.error;
                    if (res.data) newId = res.data.id;
                }
            }

            if (error) throw error;
            if (newId) setDraftId(newId);

            if (manual) {
                setDraftStatus('Brouillon sauvegardé !');
                setShowToast(true);
            } else {
                setDraftStatus('Enregistrement...');
                // Don't show toast for auto-saves unless requested (user asked for onBlur which is manual-like)
                // Actually user said "quand j'ajoute une valeur et je quite [...] le brouillon sauvgarde automatiquement, et ajouter une notification ui"
                // So onBlur should trigger toast.
            }

        } catch (err) {
            console.error("Draft Save Error:", err);
            setDraftStatus('Erreur sauvegarde');
        }
    };

    // Auto-save draft on change (Debounced) - Silent background save
    useEffect(() => {
        if (saving) return; // Don't auto-save if we are currently committing

        const timeoutId = setTimeout(() => {
            const hasData = Object.values(counts).some(v => v !== '' && v !== '0') || (manualExpectedAmount !== '' && manualExpectedAmount !== '0');
            if (hasData) {
                saveDraftToDb(false);
            }
        }, 2000); // 2s debounce for less server hits

        return () => clearTimeout(timeoutId);
    }, [counts, manualExpectedAmount, saving]);

    // Update total when counts change
    useEffect(() => {
        let newTotal = 0;
        Object.entries(counts).forEach(([value, count]) => {
            if (value === 'cents') {
                newTotal += parseFloat(count) || 0;
            } else {
                newTotal += (Number(count) || 0) * Number(value);
            }
        });
        setTotal(newTotal);
    }, [counts]);

    // Calculate Subtotals
    const bbmTotal = ['200', '100', '50', '20'].reduce((acc, val) => acc + (Number(counts[val]) || 0) * Number(val), 0);
    const pmTotal = ['10', '5', '2', '1', '0.5'].reduce((acc, val) => acc + (Number(counts[val]) || 0) * Number(val), 0) + (parseFloat(counts['cents']) || 0);

    // Fetch History (Last 30 Days)
    const fetchHistory = React.useCallback(async () => {
        setLoadingHistory(true);
        try {
            // Calculate date range: 30 days ago to Selected Date (or today if selected is recent)
            // But usually history is just "Recent". Selected Date acts as "Focus" or "Max Date".
            // Let's assume we want to show history UP TO the selected date (or just all recent history?)
            // The prompt says "integre ici l'historique de un mois".
            // Let's fetch from (selectedDate - 30 days) to (selectedDate).

            const endDate = selectedDate;
            const startDate = format(subDays(parseISO(selectedDate), 30), 'yyyy-MM-dd');

            const { data, error } = await supabase
                .from('money_countings')
                .select('*')
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;
            setHistory(data || []);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoadingHistory(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const handleCountChange = (value, count) => {
        // Validation: allow decimals for cents, integers for others
        const regex = value === 'cents' ? /^\d*\.?\d*$/ : /^\d+$/;

        if (count === '' || regex.test(count)) {
            setCounts(prev => ({ ...prev, [value]: count }));
        }
    };

    // Trigger explicit save on blur
    const handleBlur = () => {
        saveDraftToDb(true); // 'true' enables the toast notification
    };

    const handleReset = () => {
        if (window.confirm('Voulez-vous réinitialiser le comptage ?')) {
            setCounts({
                200: '', 100: '', 50: '', 20: '',
                10: '', 5: '', 2: '', 1: '', 0.5: '',
                cents: ''
            });
            setManualExpectedAmount('');
            // Clear draft
            if (draftId) {
                supabase.from('money_counting_drafts').delete().eq('id', draftId).then(() => setDraftId(null));
            }
        }
    };

    const handleDelete = async (id) => {
        try {
            const { error } = await supabase
                .from('money_countings')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchHistory(); // Refresh
        } catch (error) {
            console.error('Error deleting:', error);
            alert('Erreur lors de la suppression');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        const expectedVal = parseFloat(manualExpectedAmount) || 0;
        try {
            const { error } = await supabase
                .from('money_countings')
                .insert([{
                    date: selectedDate,
                    counts: counts,
                    total_calc: total,
                    expected_amount: expectedVal,
                    gap: total - expectedVal
                }]);

            if (error) throw error;

            // Clear ALL drafts for this user to prevent zombie drafts
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('money_counting_drafts').delete().eq('user_id', user.id);
            }
            setDraftId(null);

            // Reset Form (Clear counts and expected amount)
            setCounts({
                200: '', 100: '', 50: '', 20: '',
                10: '', 5: '', 2: '', 1: '', 0.5: '',
                cents: ''
            });
            setManualExpectedAmount('');

            // Refresh history
            fetchHistory();

            // Show success message
            setDraftStatus('Comptage sauvegardé !');
            setShowToast(true);
        } catch (error) {
            console.error('Error saving count:', error);
            alert('Erreur lors de la sauvegarde: ' + (error.message || error.details || JSON.stringify(error)));
        } finally {
            setSaving(false);
        }
    };

    const handleSaveDraft = () => {
        saveDraftToDb(true);
    };

    const handleToggleExpand = (id) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    // Group history by Date
    const groupedHistory = history.reduce((acc, item) => {
        const dateKey = item.date;
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(item);
        return acc;
    }, {});

    return (
        <>
            {showToast && <Toast message={draftStatus} onClose={() => setShowToast(false)} />}
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300 pb-20">
                {/* Header / Date */}

                {/* Header / Date */}
                {/* Header / Date */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sticky top-4 z-10 flex items-center justify-between">
                    <div className="space-y-1">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Calculator className="text-indigo-600" size={22} />
                            Comptage Monétaire
                        </h2>
                        <div className="flex items-center gap-2 relative pl-0.5 group cursor-pointer w-fit">
                            <span className="text-sm font-medium text-gray-400 group-hover:text-gray-600 transition-colors">
                                {format(new Date(selectedDate), 'dd/MM/yyyy')}
                            </span>
                            <Calendar size={14} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                        </div>
                    </div>
                    <div className="flex items-center">
                        <button
                            onClick={handleReset}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all active:rotate-180 duration-500"
                            title="Réinitialiser"
                        >
                            <RotateCcw size={18} />
                        </button>
                    </div>
                </div>

                {/* Summary Card (Moved to Top) */}
                <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-lg border-2 border-indigo-100 p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Total Compté - Small */}
                        <div className="flex flex-col">
                            <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Total Comptage</div>
                            <div className="text-xl font-bold text-indigo-900 font-mono tracking-tight">
                                {formatPrice(total)}
                            </div>
                        </div>

                        {/* Vers-Esp (Editable) */}
                        <div className="flex flex-col">
                            <div className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                                Vers-Esp
                                <span className="bg-orange-100 text-[10px] px-1.5 rounded-full">Edit</span>
                            </div>
                            <div className="relative border-b-2 border-orange-200 focus-within:border-orange-500 transition-colors flex items-center gap-1">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0"
                                    value={manualExpectedAmount ? manualExpectedAmount.toString().split('.').map((part, i) => i === 0 ? part.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : part).join('.') : ''}
                                    onChange={(e) => {
                                        // Remove spaces and validate
                                        const rawValue = e.target.value.replace(/\s/g, '');
                                        if (rawValue === '' || /^\d*\.?\d*$/.test(rawValue)) {
                                            setManualExpectedAmount(rawValue);
                                        }
                                    }}
                                    onBlur={handleBlur} // Auto-save trigger
                                    className="w-full bg-transparent border-none p-0 text-xl font-bold text-orange-900 font-mono tracking-tight focus:ring-0 placeholder-orange-200"
                                />
                                <span className="text-xl font-bold text-orange-900 font-mono tracking-tight">MAD</span>
                            </div>
                        </div>

                        {/* Ecart */}
                        <div className="flex flex-col">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-2">Ecart</div>
                            <div className={`text-xl font-bold font-mono tracking-tight flex items-center gap-2 ${total - (parseFloat(manualExpectedAmount) || 0) === 0
                                ? 'text-emerald-600'
                                : total - (parseFloat(manualExpectedAmount) || 0) > 0
                                    ? 'text-blue-600'
                                    : 'text-red-600'
                                }`}>
                                {total - (parseFloat(manualExpectedAmount) || 0) > 0 ? '+' : ''}
                                {formatPrice(total - (parseFloat(manualExpectedAmount) || 0))}
                                {total - (parseFloat(manualExpectedAmount) || 0) !== 0 && <AlertCircle size={16} />}
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100 flex flex-col gap-3">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : <Save size={24} />}
                            <span>Sauvegarder le Comptage</span>
                        </button>

                        <button
                            onClick={handleSaveDraft}
                            className="w-full flex items-center justify-center gap-2 bg-white text-gray-600 px-4 py-3 rounded-xl font-bold border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all text-sm"
                        >
                            <FileEdit size={16} />
                            <span>Sauvegarder Brouillon</span>
                        </button>

                        {total - (parseFloat(manualExpectedAmount) || 0) !== 0 && (
                            <p className="text-center text-red-500 text-xs mt-1 font-medium flex items-center justify-center gap-1">
                                <AlertCircle size={12} />
                                Attention : Il y a un écart de caisse
                            </p>
                        )}
                    </div>
                </div>

                {/* Input Grid - Side by Side Layout */}
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-8 relative">
                    {/* Vertical Separator (Desktop) */}
                    <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 -ml-px"></div>

                    {/* BBM Section */}
                    <div className="flex-1 space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center justify-between border-b pb-2 sticky top-[80px] bg-[#f8fbfa] z-10 py-2 shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm">B</span>
                                Billets (BBM)
                            </div>
                            <span className="text-green-700 font-mono text-base">{formatPrice(bbmTotal)}</span>
                        </h3>
                        <div className="flex flex-col gap-3">
                            <DenominationCard value="200" counts={counts} count={counts['200']} onCountChange={handleCountChange} onBlur={handleBlur} />
                            <DenominationCard value="100" counts={counts} count={counts['100']} onCountChange={handleCountChange} onBlur={handleBlur} />
                            <DenominationCard value="50" counts={counts} count={counts['50']} onCountChange={handleCountChange} onBlur={handleBlur} />
                            <DenominationCard value="20" counts={counts} count={counts['20']} onCountChange={handleCountChange} onBlur={handleBlur} />
                        </div>
                    </div>

                    {/* PM Section */}
                    <div className="flex-1 space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center justify-between border-b pb-2 sticky top-[80px] bg-[#f8fbfa] z-10 py-2 shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-sm">P</span>
                                Pièces (PPM)
                            </div>
                            <span className="text-orange-700 font-mono text-base">{formatPrice(pmTotal)}</span>
                        </h3>
                        <div className="flex flex-col gap-3">
                            <DenominationCard value="10" isCoin count={counts['10']} onCountChange={handleCountChange} onBlur={handleBlur} />
                            <DenominationCard value="5" isCoin count={counts['5']} onCountChange={handleCountChange} onBlur={handleBlur} />
                            <DenominationCard value="2" isCoin count={counts['2']} onCountChange={handleCountChange} onBlur={handleBlur} />
                            <DenominationCard value="1" isCoin count={counts['1']} onCountChange={handleCountChange} onBlur={handleBlur} />
                            <DenominationCard value="0.5" label="0.50" isCoin count={counts['0.5']} onCountChange={handleCountChange} onBlur={handleBlur} />

                            {/* Centimes / Vrac */}
                            <div className="col-span-full pt-2 border-t border-dashed">
                                <DenominationCard value="cents" label="Centimes / Vrac" isCoin isCents count={counts['cents']} onCountChange={handleCountChange} onBlur={handleBlur} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* History Section */}
                <div className="pt-8 border-t max-w-xl mx-auto">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <History className="text-gray-400" />
                        Historique (30 derniers jours)
                    </h3>

                    {loadingHistory ? (
                        <div className="text-center py-6 text-gray-400">Chargement...</div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm">
                            Aucun historique récent
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(groupedHistory).map(([dateStr, items]) => (
                                <div key={dateStr} className="space-y-2">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">
                                        {format(parseISO(dateStr), "EEEE d MMMM", { locale: fr })}
                                    </h4>
                                    <div className="space-y-3">
                                        {items.map((item) => (
                                            <HistoryItem
                                                key={item.id}
                                                item={item}
                                                isExpanded={expandedId === item.id}
                                                onToggle={() => handleToggleExpand(item.id)}
                                                onDelete={handleDelete}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </>
    );
}
