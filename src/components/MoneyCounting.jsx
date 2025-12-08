import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatPrice } from '../utils/formatters';
import { Save, History, Calculator, AlertCircle, CheckCircle2, FileEdit, RotateCcw, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Extracted component with Visual Cues
const DenominationCard = ({ value, label, isCoin, isCents, count, onCountChange }) => {
    let subtotal = 0;
    if (isCents) {
        subtotal = parseFloat(count) || 0;
    } else {
        subtotal = (Number(count) || 0) * Number(value);
    }

    // Color Mapping for Moroccan Currency
    const getStyles = (val, isCoin, isCents) => {
        if (isCents) return { color: 'bg-orange-600', text: 'text-orange-700', border: 'border-orange-200', bg: 'bg-orange-50' };
        if (!isCoin) {
            // Bills
            switch (String(val)) {
                case '200': return { color: 'bg-blue-600', text: 'text-blue-700', border: 'border-blue-200', bg: 'bg-blue-50' };
                case '100': return { color: 'bg-amber-700', text: 'text-amber-800', border: 'border-amber-200', bg: 'bg-amber-50' };
                case '50': return { color: 'bg-emerald-600', text: 'text-emerald-700', border: 'border-emerald-200', bg: 'bg-emerald-50' };
                case '20': return { color: 'bg-purple-600', text: 'text-purple-700', border: 'border-purple-200', bg: 'bg-purple-50' };
                default: return { color: 'bg-gray-600', text: 'text-gray-700', border: 'border-gray-200', bg: 'bg-gray-50' };
            }
        } else {
            // Coins
            switch (String(val)) {
                case '10': return { color: 'bg-yellow-500', text: 'text-yellow-700', border: 'border-yellow-200', bg: 'bg-yellow-50' };
                // 5, 2, 1, 0.5 are predominantly silver/gray
                case '5':
                case '2':
                case '1':
                case '0.5':
                    return { color: 'bg-gray-400', text: 'text-gray-600', border: 'border-gray-200', bg: 'bg-gray-50' };
                default: return { color: 'bg-yellow-600', text: 'text-yellow-800', border: 'border-yellow-200', bg: 'bg-yellow-50' };
            }
        }
    };

    const styles = getStyles(value, isCoin, isCents);

    // Image path
    const imagePath = isCents
        ? '/currency/cents.png'
        : `/currency/${value}dh.${isCoin ? 'png' : 'jpg'}`;

    return (
        <div className={`
            relative overflow-hidden rounded-2xl transition-all duration-300
            border hover:shadow-md
            ${isCoin ? styles.bg : 'bg-white'} 
            ${styles.border} ${isCents ? 'ring-4 ring-orange-100' : 'hover:border-opacity-100 border-opacity-60'}
            group
        `}>

            {/* Visual Section */}
            <div className={`
                relative w-full flex items-center justify-center overflow-hidden
                ${isCoin || isCents ? 'h-24' : 'h-28'}
                ${!isCoin && !isCents && styles.bg}
            `}>
                {/* Fallback pattern/color if image fails or loading */}
                <div className={`absolute inset-0 opacity-10 ${styles.color}`}></div>

                {/* Real Image (Now for ALL types including cents) */}
                <div className={`w-full h-full flex items-center justify-center p-2 transition-transform duration-500 group-hover:scale-105`}>
                    <img
                        src={imagePath}
                        alt={isCents ? "Centimes" : `${value} DH`}
                        className={`
                            max-h-full max-w-full 
                            ${(isCoin || isCents) ? 'object-contain drop-shadow-md mix-blend-multiply' : 'object-contain shadow-sm rounded-sm'}
                        `}
                        onError={(e) => {
                            e.target.style.display = 'none'; // Hide broken image
                            e.target.parentElement.nextSibling.style.display = 'flex'; // Show fallback
                        }}
                    />
                    {/* Fallback Icon Area (Originally hidden, shown if error) */}
                    <div className="hidden absolute inset-0 items-center justify-center">
                        <div className={`
                            flex items-center justify-center font-bold text-xl text-white shadow-sm
                            ${(isCoin || isCents) ? 'w-12 h-12 rounded-full border-2 border-white' : 'w-20 h-10 rounded-md'}
                            ${styles.color}
                        `}>
                            {isCents ? '¢' : value}
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls Section */}
            <div className={`p-3 relative ${isCoin ? 'bg-transparent' : 'bg-white'}`}>
                {/* Label Badge (Restored for ALL) */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full shadow-sm border border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex gap-1 whitespace-nowrap bg-white">
                    {isCents ? 'Montant' : (isCoin ? 'Pièce' : 'Billet')}
                    <span className={styles.text}>{isCents ? 'Vrac' : `${value} DH`}</span>
                </div>

                <div className="mt-2 flex items-end gap-2">
                    <div className="relative flex-1">
                        <input
                            type={isCents ? "number" : "text"}
                            inputMode={isCents ? "decimal" : "numeric"}
                            step={isCents ? "0.01" : "1"}
                            pattern={isCents ? undefined : "[0-9]*"}
                            value={count}
                            onChange={(e) => onCountChange(value, e.target.value)}
                            placeholder="0"
                            className={`
                                w-full border-b-2 border-gray-200 rounded-t-lg py-1 px-2 text-2xl font-bold text-center outline-none transition-colors
                                focus:bg-white focus:border-indigo-500 ${styles.text} placeholder-gray-200
                                ${isCoin ? 'bg-white/60' : 'bg-gray-50/50'}
                            `}
                        />
                        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-300 pointer-events-none pr-1">
                            {isCents ? 'DH' : 'QTÉ'}
                        </span>
                    </div>

                    {/* Subtotal Restored for BBM & PPM (Bills & Coins) */}
                    {!isCents && (
                        <div className={`
                            h-10 px-3 rounded-lg flex items-center justify-center font-mono font-bold text-sm border border-gray-100 min-w-[80px]
                            ${subtotal > 0 ? 'text-gray-900 border-indigo-100 bg-indigo-50/30' : 'text-gray-300'}
                            ${isCoin ? 'bg-white/60' : 'bg-gray-50'}
                        `}>
                            {formatPrice(subtotal)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Extracted History Item Component for expanded details
const HistoryItem = ({ item, onDelete }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Filter counts to only show those with values
    const details = Object.entries(item.counts).filter(([key, value]) => {
        if (key === 'cents') return parseFloat(value) > 0;
        return parseInt(value) > 0;
    });

    return (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden transition-all">
            <div
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {format(new Date(item.created_at), 'HH:mm')}
                    </span>
                    <div>
                        <div className="font-bold text-indigo-700">{formatPrice(item.total_calc)}</div>
                        <div className="text-xs text-gray-400">Vers: {formatPrice(item.expected_amount)}</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`font-mono font-bold ${item.gap === 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.gap > 0 ? '+' : ''}{formatPrice(item.gap)}
                    </span>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
            </div>

            {isExpanded && (
                <div className="bg-gray-50 p-3 border-t border-gray-100 text-sm space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                        {details.map(([key, value]) => (
                            <div key={key} className="flex justify-between items-center border-b border-gray-200 pb-1">
                                <span>{key === 'cents' ? 'Centimes' : `${key} DH`}</span>
                                <span className="font-mono font-bold">
                                    {key === 'cents' ? formatPrice(parseFloat(value)) : `x ${value}`}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end pt-2">
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

    // Draft State
    const [draftStatus, setDraftStatus] = useState('');

    // Date for filtering history
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Cleanup draft on mount or draft load
    useEffect(() => {
        const savedDraft = localStorage.getItem('moneyCounting_draft');
        if (savedDraft) {
            try {
                const { counts: savedCounts, expectedAmount: savedExpected } = JSON.parse(savedDraft);
                // Only restore if date matches today? Or always restore? 
                // Let's restore regardless but maybe warn. User usually wants to continue where they left off.
                // For safety, let's restore if the user hasn't typed anything yet or just overwrite.
                setCounts(savedCounts);
                if (savedExpected !== undefined) {
                    setManualExpectedAmount(savedExpected);
                }
                setDraftStatus('Brouillon restauré');
                setTimeout(() => setDraftStatus(''), 3000);
            } catch (e) {
                console.error("Failed to parse draft", e);
            }
        }
    }, []);

    // Save draft on change
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const hasData = Object.values(counts).some(v => v !== '') || manualExpectedAmount !== '';
            if (hasData) {
                localStorage.setItem('moneyCounting_draft', JSON.stringify({
                    counts,
                    expectedAmount: manualExpectedAmount,
                    date: new Date().toISOString()
                }));
                setDraftStatus('Brouillon enregistré');
                setTimeout(() => setDraftStatus(''), 2000);
            }
        }, 1000); // Debounce save

        return () => clearTimeout(timeoutId);
    }, [counts, manualExpectedAmount]);

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

    // Fetch History
    const fetchHistory = React.useCallback(async () => {
        setLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('money_countings')
                .select('*')
                .eq('date', selectedDate)
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

    const handleReset = () => {
        if (window.confirm('Voulez-vous réinitialiser le comptage ?')) {
            setCounts({
                200: '', 100: '', 50: '', 20: '',
                10: '', 5: '', 2: '', 1: '', 0.5: '',
                cents: ''
            });
            setManualExpectedAmount('');
            // Clear draft
            localStorage.removeItem('moneyCounting_draft');
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

            // Clear draft
            localStorage.removeItem('moneyCounting_draft');

            // Refresh history
            fetchHistory();
            alert('Comptage sauvegardé !');

            // Optional: Clear inputs after save? User request "sans quitter la place". 
            // Usually valid to clear after explicit save, but maybe they want to tweak. 
            // Let's keep data but maybe reset 'Vers-Esp' if logic dictates. 
            // For now, keep as is.
        } catch (error) {
            console.error('Error saving count:', error);
            alert('Erreur lors de la sauvegarde: ' + (error.message || error.details || JSON.stringify(error)));
            console.log('Payload:', {
                date: selectedDate,
                counts: counts,
                total_calc: total,
                expected_amount: expectedVal,
                gap: total - expectedVal
            });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveDraft = () => {
        localStorage.setItem('moneyCounting_draft', JSON.stringify({
            counts,
            expectedAmount: manualExpectedAmount,
            date: new Date().toISOString()
        }));
        setDraftStatus('Brouillon sauvegardé manuellement');
        setTimeout(() => setDraftStatus(''), 3000);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300 pb-20">

            {/* Header / Date */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 sticky top-4 z-10 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Calculator className="text-indigo-600" />
                        Comptage Monétaire
                    </h2>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="mt-1 text-sm text-gray-500 border-none bg-transparent p-0 focus:ring-0 cursor-pointer"
                    />
                    {draftStatus && (
                        <div className="text-xs text-orange-500 font-medium animate-pulse mt-1">
                            {draftStatus}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleReset}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        title="Réinitialiser"
                    >
                        <RotateCcw size={20} />
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
                        <DenominationCard value="200" counts={counts} count={counts['200']} onCountChange={handleCountChange} />
                        <DenominationCard value="100" counts={counts} count={counts['100']} onCountChange={handleCountChange} />
                        <DenominationCard value="50" counts={counts} count={counts['50']} onCountChange={handleCountChange} />
                        <DenominationCard value="20" counts={counts} count={counts['20']} onCountChange={handleCountChange} />
                    </div>
                </div>

                {/* PM Section */}
                <div className="flex-1 space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center justify-between border-b pb-2 sticky top-[80px] bg-[#f8fbfa] z-10 py-2 shadow-sm">
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-sm">P</span>
                            Pièces (PM)
                        </div>
                        <span className="text-orange-700 font-mono text-base">{formatPrice(pmTotal)}</span>
                    </h3>
                    <div className="flex flex-col gap-3">
                        <DenominationCard value="10" isCoin count={counts['10']} onCountChange={handleCountChange} />
                        <DenominationCard value="5" isCoin count={counts['5']} onCountChange={handleCountChange} />
                        <DenominationCard value="2" isCoin count={counts['2']} onCountChange={handleCountChange} />
                        <DenominationCard value="1" isCoin count={counts['1']} onCountChange={handleCountChange} />
                        <DenominationCard value="0.5" label="0.50" isCoin count={counts['0.5']} onCountChange={handleCountChange} />

                        {/* Centimes / Vrac */}
                        <div className="col-span-full pt-2 border-t border-dashed">
                            <DenominationCard value="cents" label="Centimes / Vrac" isCoin isCents count={counts['cents']} onCountChange={handleCountChange} />
                        </div>
                    </div>
                </div>
            </div>

            {/* History Section */}
            <div className="pt-8 border-t max-w-xl mx-auto">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <History className="text-gray-400" />
                    Historique du jour
                </h3>

                {loadingHistory ? (
                    <div className="text-center py-6 text-gray-400">Chargement...</div>
                ) : history.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm">
                        Aucun historique pour aujourd'hui
                    </div>
                ) : (
                    <div className="space-y-3">
                        {history.map((item) => (
                            <HistoryItem key={item.id} item={item} onDelete={handleDelete} />
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}
