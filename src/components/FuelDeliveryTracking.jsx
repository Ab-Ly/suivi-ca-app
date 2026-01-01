import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Droplet, Save, History, AlertCircle, CheckCircle, Truck, FileDown, Plus, Trash2, ChevronDown, ChevronUp, RefreshCw, Loader2, ChevronRight } from 'lucide-react';
import { formatNumber } from '../utils/formatters';
import PasswordConfirmationModal from './ui/PasswordConfirmationModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TANKS = [
    { id: 1, name: 'Citerne 1', product: 'Gasoil 50', capacity: 20493, color: 'from-orange-400 to-orange-600', text: 'text-orange-600', bg: 'bg-orange-100' },
    { id: 2, name: 'Citerne 2', product: 'Gasoil 50', capacity: 20606, color: 'from-orange-400 to-orange-600', text: 'text-orange-600', bg: 'bg-orange-100' },
    { id: 3, name: 'Citerne 3', product: 'Gasoil 50', capacity: 20542, color: 'from-orange-400 to-orange-600', text: 'text-orange-600', bg: 'bg-orange-100' },
    { id: 4, name: 'Citerne 4', product: 'SSP', capacity: 20542, color: 'from-emerald-400 to-emerald-600', text: 'text-emerald-600', bg: 'bg-emerald-100' },
];

/* --- VISUAL COMPONENT: REALISTIC TANK --- */
const TankVisual = ({ tank, levelBefore, levelAfter }) => {
    // Current display level (for animation purposes, we basically show After if set, else Before)
    const displayLevel = levelAfter && levelAfter > 0 ? levelAfter : (levelBefore || 0);
    const percent = Math.min(100, Math.max(0, (displayLevel / tank.capacity) * 100));
    const percentBefore = Math.min(100, Math.max(0, (levelBefore / tank.capacity) * 100));

    return (
        <div className="flex flex-col items-center gap-2 w-full">
            {/* The Tank Container */}
            <div className="relative w-24 h-40 bg-gray-100 rounded-3xl border-4 border-gray-300 overflow-hidden shadow-inner backdrop-blur-sm">

                {/* Background Grid Lines */}
                <div className="absolute inset-0 opacity-20 pointer-events-none flex flex-col justify-between py-4">
                    <div className="w-full h-px bg-gray-400"></div>
                    <div className="w-full h-px bg-gray-400"></div>
                    <div className="w-full h-px bg-gray-400"></div>
                </div>

                {/* The Liquid */}
                {/* The Liquid */}
                <div
                    className={`absolute bottom-0 w-full transition-all duration-1000 ease-out bg-gradient-to-t ${tank.color}`}
                    style={{ height: `${percent}%`, minHeight: '10px' }}
                >
                    {/* SVG Wave Effect - Sitting on top */}
                    {/* translate-y-1 ensures overlap preventing sub-pixel gaps */}
                    <div className="absolute bottom-[95%] left-0 w-[200%] h-6 flex translate-y-[1px] pointer-events-none">
                        {/* Wave 1 (Front - Fast) */}
                        <svg className={`w-1/2 h-full animate-wave-move ${tank.text}`} viewBox="0 0 1000 100" preserveAspectRatio="none">
                            <path d="M0,50 C150,100 350,0 500,50 C650,100 850,0 1000,50 V100 H0 Z" fill="currentColor" />
                        </svg>
                        <svg className={`w-1/2 h-full animate-wave-move ${tank.text}`} viewBox="0 0 1000 100" preserveAspectRatio="none">
                            <path d="M0,50 C150,100 350,0 500,50 C650,100 850,0 1000,50 V100 H0 Z" fill="currentColor" />
                        </svg>
                    </div>

                    <div className="absolute bottom-[95%] left-0 w-[200%] h-6 flex translate-y-[1px] opacity-50 z-[-1] pointer-events-none">
                        {/* Wave 2 (Back - Slow) */}
                        <svg className={`w-1/2 h-full animate-wave-move-slow ${tank.text}`} viewBox="0 0 1000 100" preserveAspectRatio="none">
                            {/* Reversed phase for variety: M0,50 C150,0 350,100 ... */}
                            <path d="M0,50 C150,0 350,100 500,50 C650,0 850,100 1000,50 V100 H0 Z" fill="currentColor" />
                        </svg>
                        <svg className={`w-1/2 h-full animate-wave-move-slow ${tank.text}`} viewBox="0 0 1000 100" preserveAspectRatio="none">
                            <path d="M0,50 C150,0 350,100 500,50 C650,0 850,100 1000,50 V100 H0 Z" fill="currentColor" />
                        </svg>
                    </div>
                </div>

                {/* Ghost Level (Before) Indicator */}
                {levelAfter > 0 && levelAfter !== levelBefore && (
                    <div
                        className="absolute bottom-0 w-full border-t-2 border-dashed border-white/50 z-10"
                        style={{ height: `${percentBefore}%` }}
                        title="Niveau Avant"
                    ></div>
                )}

                {/* Percentage Text */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xs font-bold text-white drop-shadow-md">{Math.round(percent)}%</span>
                </div>
            </div>

            {/* Labels */}
            <div className="text-center">
                <div className="text-xs font-bold text-gray-700">{tank.name}</div>
                <div className={`text-[10px] font-bold uppercase ${tank.text}`}>{tank.product}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{formatNumber(displayLevel)} / {formatNumber(tank.capacity)} L</div>
            </div>
        </div>
    );
};

export default function FuelDeliveryTracking() {
    const [receptions, setReceptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [notification, setNotification] = useState({ show: false, message: '', type: 'success' }); // 'success' | 'error'
    const [expandedMonths, setExpandedMonths] = useState(new Set());

    // Delete Confirmation State
    const [deleteConfig, setDeleteConfig] = useState({ isOpen: false, id: null });

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        invoiceNumber: '',
        blNumber: '',
        quantityBilled: '',
        observations: ''
    });

    const [items, setItems] = useState([
        { id: Date.now(), tankId: 1, levelBefore: '', levelAfter: '' }
    ]);

    // Computed Values
    const totalBilled = parseFloat(formData.quantityBilled) || 0;

    const computedItems = items.map(item => {
        const lvlBefore = parseFloat(item.levelBefore) || 0;
        const lvlAfter = parseFloat(item.levelAfter) || 0;
        // Allow negative values to highlight input errors (e.g. Before 70000 > After 19000)
        const qtyObserved = lvlAfter - lvlBefore;
        const tank = TANKS.find(t => t.id === Number(item.tankId));
        return { ...item, lvlBefore, lvlAfter, qtyObserved, tank };
    });

    const totalObserved = computedItems.reduce((sum, item) => sum + item.qtyObserved, 0);
    const globalDifference = totalObserved - totalBilled;

    // Draft State
    const [draftId, setDraftId] = useState(null);
    const [draftLoading, setDraftLoading] = useState(false);

    useEffect(() => {
        fetchReceptions();
        fetchDraft();
        // Expand current month by default
        const currentMonthKey = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        setExpandedMonths(new Set([currentMonthKey]));
    }, []);

    const fetchDraft = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('fuel_delivery_drafts')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) throw error;

            if (data && data.draft_data) {
                const parsed = data.draft_data;
                setDraftId(data.id);

                if (parsed.items && Array.isArray(parsed.items)) {
                    setItems(parsed.items);
                    if (parsed.formData) {
                        setFormData(prev => ({ ...prev, ...parsed.formData }));
                    }
                    showNotification("Brouillon restauré depuis le serveur", "success");
                }
            }
        } catch (error) {
            console.error("Error fetching draft:", error);
        }
    };

    const saveDraft = async () => {
        setDraftLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Vous devez être connecté pour sauvegarder un brouillon.");

            const draftData = {
                items: items,
                formData: formData
            };

            const { data, error } = await supabase
                .from('fuel_delivery_drafts')
                .upsert({
                    id: draftId || undefined, // Use existing ID if we have one, else undefined to create new (actually better to limit 1 per user)
                    user_id: user.id,
                    draft_data: draftData,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' }) // Assuming one draft per user logic might be better, or just rely on ID. Let's rely on ID or Insert.
            // Wait, if we want multiple drafts we need a list. But for now, let's assume one active draft per user like localStorage often does.
            // Actually, the schema doesn't enforce 1 per user. Let's try to query by user_id first (done in fetch).
            // If we found a draft, we update it. If not, we insert.
            // Upsert requires a primary key or unique constraint. 
            // Let's modify the upsert strategy: 
            // If we have draftId, update. Else insert.

            // Refined Strategy: Delete old drafts for this user to keep it clean (Single Draft Policy)
            // Or better: Use upsert if we guarantee a unique constraint on user_id, but we didn't add it.
            // So:

            let query = supabase.from('fuel_delivery_drafts');

            if (draftId) {
                const { error } = await query.update({ draft_data: draftData, updated_at: new Date() }).eq('id', draftId);
                if (error) throw error;
            } else {
                // Check if one exists to avoid duplicates if user reloads
                const { data: existing } = await supabase.from('fuel_delivery_drafts').select('id').eq('user_id', user.id).single();

                if (existing) {
                    const { error } = await query.update({ draft_data: draftData, updated_at: new Date() }).eq('id', existing.id);
                    if (error) throw error;
                    setDraftId(existing.id);
                } else {
                    const { data: newDraft, error } = await query.insert({ user_id: user.id, draft_data: draftData }).select().single();
                    if (error) throw error;
                    setDraftId(newDraft.id);
                }
            }

            showNotification("Brouillon sauvegardé sur le serveur");
        } catch (error) {
            console.error("Error saving draft:", error);
            showNotification("Erreur sauvegarde brouillon: " + error.message, "error");
        } finally {
            setDraftLoading(false);
        }
    };

    const showNotification = (message, type = 'success') => {
        setNotification({ show: true, message, type });
        setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
    };

    const fetchReceptions = async () => {
        try {
            const { data: parents, error: parentError } = await supabase
                .from('fuel_receptions')
                .select('*')
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });

            if (parentError) throw parentError;

            if (parents && parents.length > 0) {
                const parentIds = parents.map(p => p.id);
                const { data: children, error: childError } = await supabase
                    .from('fuel_reception_items')
                    .select('*')
                    .in('reception_id', parentIds);

                if (childError) throw childError;

                const fullData = parents.map(p => ({
                    ...p,
                    items: children.filter(c => c.reception_id === p.id)
                }));
                setReceptions(fullData);
            } else {
                setReceptions([]);
            }
        } catch (error) {
            console.error('Error fetching receptions:', error);
            showNotification('Erreur de chargement', 'error');
        } finally {
            setLoading(false);
        }
    };

    const deleteReception = (id) => {
        setDeleteConfig({ isOpen: true, id });
    };

    const confirmDeleteReception = async () => {
        const id = deleteConfig.id;
        if (!id) return;

        try {
            const { error } = await supabase.from('fuel_receptions').delete().eq('id', id);
            if (error) throw error;

            showNotification("Réception supprimée avec succès");
            fetchReceptions();
        } catch (error) {
            console.error("Error deleting:", error);
            showNotification("Erreur lors de la suppression", "error");
        } finally {
            setDeleteConfig({ isOpen: false, id: null });
        }
    };

    const toggleRow = (id) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedRows(newSet);
    };

    const addItem = () => {
        setItems([...items, { id: Date.now(), tankId: items.length < 4 ? items.length + 1 : 1, levelBefore: '', levelAfter: '' }]);
    };

    const removeItem = (id) => {
        if (items.length > 1) {
            setItems(items.filter(i => i.id !== id));
        }
    };

    const updateItem = (id, field, value) => {
        setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const generatePDF = (reception) => {
        const doc = new jsPDF();

        doc.setFillColor(243, 244, 246);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setFontSize(22);
        doc.setTextColor(31, 41, 55);
        doc.text("BON DE RÉCEPTION GLOBAL", 105, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        doc.text("STATION PETROM - ISTIRAHA PEPEINIERE", 105, 30, { align: 'center' });

        const startY = 50;
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(`Date: ${new Date(reception.date).toLocaleDateString('fr-FR')}`, 15, startY);
        doc.text(`Heure: ${new Date(reception.created_at).toLocaleTimeString('fr-FR')}`, 15, startY + 7);
        doc.text(`N° Facture: ${reception.invoice_number || '-'}`, 120, startY);
        doc.text(`N° BL: ${reception.bl_number || '-'}`, 120, startY + 7);

        const tableBody = reception.items.map(item => [
            `${item.tank_name} (${item.product_type})`,
            `${formatNumber(item.level_before)} L`,
            `${formatNumber(item.level_after)} L`,
            { content: `${formatNumber(item.quantity_observed)} L`, styles: { fontStyle: 'bold' } }
        ]);

        autoTable(doc, {
            startY: startY + 20,
            head: [['Citerne / Produit', 'Niveau Avant', 'Niveau Après', 'Qté Observée']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [238, 242, 255], textColor: [79, 70, 229] },
            styles: { fontSize: 10, cellPadding: 3 },
        });

        const summaryY = doc.lastAutoTable.finalY + 15;
        const summaryBody = [
            ["Quantité Totale Facturée (BL)", `${formatNumber(reception.total_quantity_billed)} L`],
            [{ content: "Quantité Totale Reçue (Observée)", styles: { fontStyle: 'bold' } }, { content: `${formatNumber(reception.total_quantity_observed)} L`, styles: { fontStyle: 'bold' } }],
            [{ content: "Ecart Global", styles: { fontStyle: 'bold', textColor: reception.global_difference < 0 ? [220, 38, 38] : [5, 150, 105] } }, { content: `${reception.global_difference > 0 ? '+' : ''}${formatNumber(reception.global_difference)} L`, styles: { fontStyle: 'bold', textColor: reception.global_difference < 0 ? [220, 38, 38] : [5, 150, 105] } }],
        ];

        autoTable(doc, {
            startY: summaryY,
            head: [['Récapitulatif Global', 'Valeur']],
            body: summaryBody,
            theme: 'grid',
            headStyles: { fillColor: [31, 41, 55], textColor: 255 },
            styles: { fontSize: 11, cellPadding: 4 },
            columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 60, halign: 'right' } }
        });

        const finalY = doc.lastAutoTable.finalY + 30;
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text("Signature Gérant", 30, finalY);
        doc.text("Signature Livreur", 140, finalY);
        doc.line(30, finalY + 25, 90, finalY + 25);
        doc.line(140, finalY + 25, 200, finalY + 25);

        doc.save(`Reception_${reception.date}_${reception.bl_number || 'Global'}.pdf`);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!totalBilled || computedItems.some(i => !i.lvlAfter)) {
            showNotification("Veuillez remplir correctement la quantité facturée et les niveaux.", "error");
            return;
        }

        setSubmitting(true);

        try {
            const { data: parent, error: parentError } = await supabase
                .from('fuel_receptions')
                .insert({
                    date: formData.date,
                    invoice_number: formData.invoiceNumber,
                    bl_number: formData.blNumber,
                    total_quantity_billed: totalBilled,
                    total_quantity_observed: totalObserved,
                    global_difference: globalDifference,
                    observations: formData.observations
                })
                .select()
                .single();

            if (parentError) throw parentError;

            const childrenData = computedItems.map(item => ({
                reception_id: parent.id,
                tank_id: item.tank.id,
                tank_name: item.tank.name,
                product_type: item.tank.product,
                level_before: item.lvlBefore,
                level_after: item.lvlAfter,
                quantity_observed: item.qtyObserved
            }));

            const { error: childrenError } = await supabase
                .from('fuel_reception_items')
                .insert(childrenData);

            if (childrenError) throw childrenError;

            // Success
            showNotification("Réception enregistrée avec succès !");
            setFormData({ ...formData, invoiceNumber: '', blNumber: '', quantityBilled: '', observations: '' });
            setItems([{ id: Date.now(), tankId: 1, levelBefore: '', levelAfter: '' }]);
            setFormData({ ...formData, invoiceNumber: '', blNumber: '', quantityBilled: '', observations: '' });
            setItems([{ id: Date.now(), tankId: 1, levelBefore: '', levelAfter: '' }]);

            // Delete draft from DB if exists
            if (draftId) {
                await supabase.from('fuel_delivery_drafts').delete().eq('id', draftId);
                setDraftId(null);
            }

            fetchReceptions();

        } catch (error) {
            console.error("Error submitting:", error);
            showNotification(error.message, "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 pb-20 animate-fade-in w-full max-w-7xl mx-auto relative">

            {/* Custom Notification Toast */}
            {notification.show && (
                <div className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[100] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-300 ${notification.type === 'error' ? 'bg-rose-500 text-white' : 'bg-gray-900 text-white'}`}>
                    {notification.type === 'error' ? <AlertCircle size={24} /> : <CheckCircle size={24} className="text-emerald-400" />}
                    <div>
                        <h4 className="font-bold text-sm">{notification.type === 'error' ? 'Erreur' : 'Succès'}</h4>
                        <p className="text-xs opacity-90">{notification.message}</p>
                    </div>
                </div>
            )}

            <PasswordConfirmationModal
                isOpen={deleteConfig.isOpen}
                onClose={() => setDeleteConfig({ isOpen: false, id: null })}
                onConfirm={confirmDeleteReception}
                title="Supprimer la Réception ?"
                message="Cette action est irréversible. Toutes les données associées à cette réception seront définitivement effacées."
            />

            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <Truck className="text-indigo-600" size={28} />
                        Réception Carburant
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Saisie BL centralisée & dispatching multi-citernes</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* LEFT COLUMN: FORM (lg:col-span-5) */}
                <div className="lg:col-span-12 xl:col-span-5 space-y-6 order-2 lg:order-1">
                    <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl shadow-indigo-100/50 border border-gray-100 p-6 space-y-6 relative overflow-hidden">

                        {/* Decorative BG Blob */}
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

                        {/* 1. Global Infos (Redesigned) */}
                        <div className="space-y-5 relative z-10">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                                Informations BL
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Date Réception</label>
                                    <input type="date" required className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-3 font-medium outline-none transition-shadow" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-indigo-600 uppercase">Total Facturé (L)</label>
                                    <div className="relative">
                                        <input type="number" required placeholder="0" inputMode="decimal" className="w-full bg-indigo-50/50 border border-indigo-100 text-indigo-900 text-lg font-black rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-3 pr-10 outline-none transition-shadow" value={formData.quantityBilled} onChange={e => setFormData({ ...formData, quantityBilled: e.target.value })} step="0.01" />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-300 font-bold text-xs">L</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100/80 space-y-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Numéro Facture</label>
                                    <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Ex: 9251043708" className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5 outline-none" value={formData.invoiceNumber} onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })} />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Numéro BL</label>
                                    <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Ex: 80316982" className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5 outline-none" value={formData.blNumber} onChange={e => setFormData({ ...formData, blNumber: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className="w-full h-px bg-gray-100 my-2"></div>

                        {/* 2. Dispatching */}
                        <div className="space-y-4 relative z-10">
                            <div className="flex justify-between items-end">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                    Dispatching
                                </h3>
                                <div className="flex gap-2">
                                    <button type="button" onClick={addItem} className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                                        <Plus size={14} /> Ajouter Citerne
                                    </button>
                                    <button type="button" onClick={saveDraft} disabled={draftLoading} className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50">
                                        {draftLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Brouillon
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {items.map((item, index) => (
                                    <div key={item.id} className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200/60 relative group animate-slide-in">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase bg-white px-2 py-1 rounded border border-gray-100">Ligne {index + 1}</span>
                                            {items.length > 1 && (
                                                <button type="button" onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            <select
                                                className="w-full text-sm font-bold text-gray-800 bg-white border border-gray-200 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-100 outline-none"
                                                value={item.tankId}
                                                onChange={e => updateItem(item.id, 'tankId', e.target.value)}
                                            >
                                                {TANKS.map(t => <option key={t.id} value={t.id}>{t.name} - {t.product}</option>)}
                                            </select>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="relative">
                                                    <label className="absolute -top-2 left-2 px-1 bg-white text-[10px] font-bold text-gray-400">AVANT</label>
                                                    <input type="number" placeholder="0" inputMode="decimal" className="w-full pt-3 pb-2 px-3 text-sm font-mono font-medium border border-gray-200 rounded-xl bg-white focus:border-indigo-500 outline-none" value={item.levelBefore} onChange={e => updateItem(item.id, 'levelBefore', e.target.value)} />
                                                </div>
                                                <div className="relative">
                                                    <label className="absolute -top-2 left-2 px-1 bg-white text-[10px] font-bold text-gray-400">APRÈS</label>
                                                    <input type="number" placeholder="0" inputMode="decimal" className="w-full pt-3 pb-2 px-3 text-sm font-bold font-mono text-indigo-900 border border-indigo-200 rounded-xl bg-indigo-50/30 focus:border-indigo-500 outline-none transition-all" value={item.levelAfter} onChange={e => updateItem(item.id, 'levelAfter', e.target.value)} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 3. Summary & Submit */}
                        <div className="pt-2">
                            <div className={`p-5 rounded-2xl border-2 mb-4 transition-colors ${globalDifference >= 0 ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium text-gray-600">Total Validé (Observé)</span>
                                    <span className="font-black font-mono text-xl text-gray-800">{formatNumber(totalObserved)} L</span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-t border-gray-200/50 pt-2 mt-2">
                                    <span className={globalDifference >= 0 ? 'text-emerald-700 font-bold flex items-center gap-1' : 'text-rose-700 font-bold flex items-center gap-1'}>
                                        {globalDifference >= 0 ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                        Ecart Global
                                    </span>
                                    <span className={`font-black font-mono text-lg ${globalDifference >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {globalDifference > 0 ? '+' : ''}{formatNumber(globalDifference)} L
                                    </span>
                                </div>
                            </div>

                            <button type="submit" disabled={submitting} className="w-full btn-primary py-4 rounded-2xl text-lg shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transform active:scale-95 transition-all">
                                {submitting ? <RefreshCw className="animate-spin" /> : <Save size={20} />}
                                {submitting ? 'Validation...' : 'Valider la Réception'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* RIGHT COLUMN: VISUALS + HISTORY (lg:col-span-7) */}
                <div className="lg:col-span-12 xl:col-span-7 space-y-6 order-1 lg:order-2">

                    {/* LIVE VISUALIZATION */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 text-center">État des Citernes en cours</h3>

                        {/* Mobile: Horizontal scroll, Desktop: Grid */}
                        <div className="flex overflow-x-auto gap-4 pb-4 md:grid md:grid-cols-4 md:overflow-visible justify-items-center">
                            {computedItems.map((item, index) => (
                                <div key={item.id} className="min-w-[100px] flex-shrink-0 animate-scale-in">
                                    <TankVisual
                                        tank={item.tank}
                                        levelBefore={item.lvlBefore}
                                        levelAfter={item.lvlAfter}
                                    />
                                    {/* Diff Indicator for this tank */}
                                    <div className="mt-2 text-center">
                                        <span className="text-[10px] font-medium text-gray-400 uppercase block">Reçu</span>
                                        <span className={`text-xs font-black font-mono ${item.qtyObserved >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                            {item.qtyObserved > 0 ? '+' : ''}{formatNumber(item.qtyObserved)} L
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {/* Show inactive tanks too? Or just active ones? Let's show active row items basically. */}
                            {/* Actually, user might want to see ALL tanks. But we only edit specific ones. Let's stick to showing the ones in the form for focus. */}
                        </div>
                    </div>

                    {/* HISTORY LIST */}
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[500px]">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h2 className="font-bold text-gray-900 flex items-center gap-2">
                                <History size={20} className="text-gray-400" /> Historique
                            </h2>
                            <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs font-bold">{receptions.length}</span>
                        </div>

                        <div className="flex-1 overflow-auto p-4 space-y-3">
                            {loading ? <p className="text-center text-gray-400 py-10">Chargement...</p> : receptions.length === 0 ? <p className="text-center text-gray-400 py-10">Aucune réception.</p> : (
                                (() => {
                                    // Group receptions by month
                                    const groupedReceptions = receptions.reduce((acc, reception) => {
                                        const monthKey = new Date(reception.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                                        if (!acc[monthKey]) acc[monthKey] = [];
                                        acc[monthKey].push(reception);
                                        return acc;
                                    }, {});

                                    return Object.entries(groupedReceptions).map(([month, monthReceptions]) => {
                                        const isExpanded = expandedMonths.has(month);

                                        return (
                                            <div key={month} className="mb-4">
                                                {/* Month Header */}
                                                <div
                                                    className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors select-none mb-3"
                                                    onClick={() => {
                                                        const newSet = new Set(expandedMonths);
                                                        if (newSet.has(month)) newSet.delete(month);
                                                        else newSet.add(month);
                                                        setExpandedMonths(newSet);
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}>
                                                            <div className="bg-white p-1 rounded-full border border-gray-200 shadow-sm text-gray-500">
                                                                <ChevronRight size={14} />
                                                            </div>
                                                        </div>
                                                        <span className="font-bold text-xs uppercase tracking-wider text-gray-700">
                                                            {month}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-semibold text-gray-400 bg-white px-2 py-1 rounded-full border border-gray-100">
                                                        {monthReceptions.length} BL
                                                    </span>
                                                </div>

                                                {/* Content - Cards List */}
                                                {isExpanded && (
                                                    <div className="space-y-3 px-2 pb-2">
                                                        {monthReceptions.map(reception => (
                                                            <div key={reception.id} className="border border-gray-200 rounded-2xl overflow-hidden hover:border-indigo-300 transition-all bg-white group shadow-sm hover:shadow-md">
                                                                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => toggleRow(reception.id)}>
                                                                    <div className="flex items-center gap-3 md:gap-4">
                                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${reception.global_difference < 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                                            <Truck size={20} />
                                                                        </div>
                                                                        <div>
                                                                            <div className="font-bold text-gray-900 text-sm md:text-base flex items-center gap-2">
                                                                                {new Date(reception.date).toLocaleDateString('fr-FR')}
                                                                                <span className="hidden md:inline text-xs font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">BL: {reception.bl_number || '-'}</span>
                                                                            </div>
                                                                            <div className="mt-2 grid grid-cols-2 gap-4 border-t border-gray-50 pt-2 w-full max-w-[200px] md:max-w-none">
                                                                                <div>
                                                                                    <span className="text-[10px] text-gray-400 uppercase block leading-none mb-0.5">Facturé</span>
                                                                                    <span className="font-bold text-gray-600 text-sm block leading-tight">{formatNumber(reception.total_quantity_billed)}</span>
                                                                                </div>
                                                                                <div className="relative pl-3 border-l border-gray-100">
                                                                                    <span className="text-[10px] text-gray-400 uppercase block leading-none mb-0.5">Reçu</span>
                                                                                    <span className="font-bold text-gray-900 text-sm block leading-tight">{formatNumber(reception.total_quantity_observed)}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`text-right hidden md:block ${reception.global_difference < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                                            <div className="font-mono font-bold text-sm">
                                                                                {reception.global_difference > 0 ? '+' : ''}{formatNumber(reception.global_difference)} L
                                                                            </div>
                                                                            <div className="text-[10px] font-bold uppercase opacity-75">Ecart</div>
                                                                        </div>

                                                                        <div className="flex gap-1">
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); deleteReception(reception.id); }}
                                                                                className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                                                title="Supprimer"
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); generatePDF(reception); }}
                                                                                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                                                                                title="Télécharger PDF"
                                                                            >
                                                                                <FileDown size={18} />
                                                                            </button>
                                                                            <button className="w-8 h-8 flex items-center justify-center text-gray-300 group-hover:text-gray-600 transition-colors">
                                                                                {expandedRows.has(reception.id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* EXPANDED DETAILS */}
                                                                {expandedRows.has(reception.id) && (
                                                                    <div className="bg-gray-50 border-t border-gray-100 p-4 space-y-2 animate-fade-in">
                                                                        <div className="md:hidden text-xs text-gray-500 mb-2 font-mono">
                                                                            N° BL: {reception.bl_number || 'N/A'} <br />
                                                                            Ecart: {reception.global_difference} L
                                                                        </div>
                                                                        {reception.items.map(item => (
                                                                            <div key={item.id} className="flex justify-between items-center text-sm bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className={`w-2 h-8 rounded-full ${item.product_type.includes('Gasoil') ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                                                                                    <div>
                                                                                        <div className="font-bold text-gray-700">{item.tank_name}</div>
                                                                                        <div className="text-[10px] text-gray-400 uppercase">{item.product_type}</div>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex gap-4 text-gray-600 text-xs">
                                                                                    <div className="text-right">
                                                                                        <span className="block text-[10px] text-gray-400 uppercase">Avant</span>
                                                                                        <span className="font-mono">{formatNumber(item.level_before)}</span>
                                                                                    </div>
                                                                                    <div className="text-right">
                                                                                        <span className="block text-[10px] text-gray-400 uppercase">Après</span>
                                                                                        <span className="font-mono">{formatNumber(item.level_after)}</span>
                                                                                    </div>
                                                                                    <div className="text-right">
                                                                                        <span className="block text-[10px] text-gray-400 uppercase">Reçu</span>
                                                                                        <span className="font-mono font-bold text-indigo-600">{formatNumber(item.quantity_observed)} L</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    });
                                })()
                            )}
                        </div>
                    </div>
                </div>
            </div >
        </div >
    );
}
