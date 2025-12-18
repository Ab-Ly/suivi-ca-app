import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    Users, UserPlus, Search, Edit2, Trash2, Calendar, FileText,
    Stethoscope, Clock, Shield, Briefcase, ChevronRight, Plus,
    Save, X, CheckSquare, AlertCircle, ArrowLeft
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from './ui/Toast';

export default function PersonnelTracking() {
    const [employees, setEmployees] = useState([]);
    const [selectedEmp, setSelectedEmp] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [grouping, setGrouping] = useState('none'); // 'none' | 'interim_agency' | 'role'
    const { success, error: showError } = useToast();

    // Sub-data for selected employee
    const [absences, setAbsences] = useState([]);
    const [medicalEvents, setMedicalEvents] = useState([]);

    // Tabs: 'info', 'absences', 'medical'
    const [activeTab, setActiveTab] = useState('info');

    useEffect(() => {
        fetchEmployees();
    }, []);

    useEffect(() => {
        if (selectedEmp) {
            fetchEmployeeDetails(selectedEmp.id);
        }
    }, [selectedEmp]);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .order('name');
            if (error) throw error;
            setEmployees(data || []);
        } catch (err) {
            console.error('Error fetching employees:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployeeDetails = async (empId) => {
        try {
            // Fetch Absences
            const { data: absData } = await supabase
                .from('employee_absences')
                .select('*')
                .eq('employee_id', empId)
                .order('start_date', { ascending: false });
            setAbsences(absData || []);

            // Fetch Medical
            const { data: medData } = await supabase
                .from('medical_tracking')
                .select('*')
                .eq('employee_id', empId)
                .order('event_date', { ascending: false });
            setMedicalEvents(medData || []);
        } catch (err) {
            console.error('Error details:', err);
        }
    };

    const handleUpdateEmployee = async (updates) => {
        try {
            const { error } = await supabase
                .from('employees')
                .update(updates)
                .eq('id', selectedEmp.id);

            if (error) throw error;

            // Update local state
            const updated = { ...selectedEmp, ...updates };
            setSelectedEmp(updated);
            setEmployees(employees.map(e => e.id === updated.id ? updated : e));
            success('Modifications enregistrées');
        } catch (err) {
            showError('Erreur update: ' + err.message);
        }
    };

    const handleDeleteEmployee = async (id) => {
        if (!confirm('SUPPRIMER cet employé définitivement ?')) return;
        try {
            const { error } = await supabase.from('employees').delete().eq('id', id);
            if (error) throw error;
            setEmployees(employees.filter(e => e.id !== id));
            if (selectedEmp?.id === id) setSelectedEmp(null);
            success('Employé supprimé');
        } catch (err) {
            showError('Erreur suppression: ' + err.message);
        }
    };

    const filteredEmployees = employees.filter(e =>
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.role?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getGroupedEmployees = () => {
        if (grouping === 'none') return { 'Tous': filteredEmployees };

        const groups = {};
        filteredEmployees.forEach(emp => {
            const key = grouping === 'interim_agency'
                ? (emp.interim_agency || 'Aucune Agence')
                : (emp.role || 'Sans Rôle');

            if (!groups[key]) groups[key] = [];
            groups[key].push(emp);
        });
        return groups;
    };

    const groupedData = getGroupedEmployees();

    return (
        <div className="h-[calc(100dvh-8rem)] md:h-[calc(100vh-6rem)]">
            {!selectedEmp ? (
                // --- GRID VIEW ---
                <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Header Controls */}
                    <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
                        <div className="flex justify-between w-full xl:w-auto items-center">
                            <h2 className="font-bold text-gray-800 text-xl flex items-center gap-2">
                                <Users size={24} className="text-indigo-600" />
                                <span className="hidden xs:inline">Personnel</span>
                                <span className="xs:hidden">Equipe</span>
                                <span className="text-gray-400 text-sm font-normal">({filteredEmployees.length})</span>
                            </h2>
                            {/* Mobile Add Button shows here if needed, but we have one below */}
                        </div>

                        <div className="flex flex-col gap-3 w-full xl:w-auto">
                            <div className="flex gap-2 w-full">
                                {/* Search */}
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                        placeholder="Rechercher..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 active:scale-95 shrink-0"
                                >
                                    <UserPlus size={20} />
                                </button>
                            </div>

                            {/* Grouping Toggles - Scrollable on mobile */}
                            <div className="flex bg-gray-100 p-1 rounded-xl shrink-0 overflow-x-auto no-scrollbar">
                                <button
                                    onClick={() => setGrouping('none')}
                                    className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${grouping === 'none' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Grille
                                </button>
                                <button
                                    onClick={() => setGrouping('interim_agency')}
                                    className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${grouping === 'interim_agency' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Société
                                </button>
                                <button
                                    onClick={() => setGrouping('role')}
                                    className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${grouping === 'role' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Fonction
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Grid Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 custom-scrollbar">
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                <div className="animate-spin mr-3 h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                                Chargement...
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {Object.entries(groupedData).map(([groupTitle, emps]) => (
                                    <div key={groupTitle}>
                                        {grouping !== 'none' && (
                                            <h3 className="font-bold text-gray-500 uppercase tracking-wider text-sm mb-4 pl-1 border-l-4 border-indigo-500 ml-1">
                                                {groupTitle} <span className="text-gray-400 font-normal">({emps.length})</span>
                                            </h3>
                                        )}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {emps.map(emp => (
                                                <div
                                                    key={emp.id}
                                                    onClick={() => setSelectedEmp(emp)}
                                                    className="group bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden"
                                                >
                                                    <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <ChevronRight size={18} className="text-gray-300" />
                                                    </div>

                                                    <div className="flex items-start gap-4 mb-4">
                                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center text-indigo-600 font-bold text-lg border border-indigo-100 shrink-0">
                                                            {emp.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-gray-900 line-clamp-1">{emp.name}</div>
                                                            <div className="text-sm text-gray-500 line-clamp-1">{emp.role || 'Aucun rôle'}</div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2 text-xs">
                                                        {emp.assignment && (
                                                            <span className="px-2 py-1 bg-gray-50 text-gray-600 rounded-lg border border-gray-100 font-medium">
                                                                {emp.assignment}
                                                            </span>
                                                        )}
                                                        {emp.team && (
                                                            <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 font-medium">
                                                                {emp.team}
                                                            </span>
                                                        )}
                                                        {emp.interim_agency && (
                                                            <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded-lg border border-purple-100 font-medium">
                                                                {emp.interim_agency}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                // --- DETAIL VIEW ---
                <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-in slide-in-from-right duration-300">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between md:items-center gap-4 bg-white z-10">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setSelectedEmp(null)}
                                className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 rounded-xl transition-colors flex items-center gap-2"
                            >
                                <ArrowLeft size={20} />
                                <span className="font-medium hidden sm:inline">Retour</span>
                            </button>
                            <div className="h-8 w-px bg-gray-200 mx-2 hidden sm:block"></div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                                    {selectedEmp.name.charAt(0)}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 leading-none">{selectedEmp.name}</h2>
                                    <p className="text-sm text-gray-500 mt-1">{selectedEmp.role || 'Poste non défini'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 self-end md:self-auto">
                            <div className="bg-gray-100/80 p-1 rounded-xl flex items-center gap-1">
                                {[
                                    { id: 'info', label: 'Infos', icon: FileText },
                                    { id: 'absences', label: 'Absences', icon: Calendar },
                                    { id: 'medical', label: 'Médical', icon: Stethoscope },
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        <tab.icon size={16} />
                                        <span className="hidden sm:inline">{tab.label}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="h-8 w-px bg-gray-200 mx-1"></div>
                            <button
                                onClick={() => handleDeleteEmployee(selectedEmp.id)}
                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden bg-gray-50/30">
                        {activeTab === 'info' && (
                            <InfoTab employee={selectedEmp} onUpdate={handleUpdateEmployee} />
                        )}
                        {activeTab === 'absences' && (
                            <div className="h-full overflow-y-auto p-6 custom-scrollbar">
                                <AbsencesTab employee={selectedEmp} absences={absences} refresh={() => fetchEmployeeDetails(selectedEmp.id)} />
                            </div>
                        )}
                        {activeTab === 'medical' && (
                            <div className="h-full overflow-y-auto p-6 custom-scrollbar">
                                <MedicalTab employee={selectedEmp} events={medicalEvents} refresh={() => fetchEmployeeDetails(selectedEmp.id)} />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showAddModal && <AddEmployeeModal onClose={() => setShowAddModal(false)} onAdded={fetchEmployees} />}
        </div>
    );
}

// --- Sub Components ---

const TabButton = ({ id, label, icon: Icon, active, onClick }) => (
    <button
        onClick={() => onClick(id)}
        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${active === id
            ? 'border-indigo-600 text-indigo-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
    >
        <Icon size={18} />
        {label}
    </button>
);

const InfoTab = ({ employee, onUpdate }) => {
    const [formData, setFormData] = useState(employee || {});
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setFormData(employee || {});
        setIsDirty(false);
    }, [employee?.id]); // Reset when checking a different employee

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        await onUpdate(formData); // Ensure onUpdate returns a promise
        setIsSaving(false);
        setIsDirty(false);
    };

    return (
        <div className="h-full flex flex-col relative">
            <div className="flex-1 overflow-y-auto p-6 pb-24 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                    {/* Card 1: Contrat */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Briefcase size={18} className="text-blue-500" />
                            Contrat & Poste
                        </h3>
                        <div className="space-y-4">
                            <InputGroup label="Société Interim">
                                <input
                                    className="input-field"
                                    placeholder="Ex: Tectra, Manpower..."
                                    value={formData.interim_agency || ''}
                                    onChange={e => handleChange('interim_agency', e.target.value)}
                                />
                            </InputGroup>
                            <div className="grid grid-cols-2 gap-4">
                                <InputGroup label="Type Contrat">
                                    <select
                                        className="input-field"
                                        value={formData.contract_type || ''}
                                        onChange={e => handleChange('contract_type', e.target.value)}
                                    >
                                        <option value="">-</option>
                                        <option value="CDI">CDI</option>
                                        <option value="CDD">CDD</option>
                                        <option value="Interim">Interim</option>
                                        <option value="Anapec">Anapec</option>
                                    </select>
                                </InputGroup>
                                {formData.contract_type === 'Interim' ? (
                                    <>
                                        <InputGroup label="Renouvellement 1">
                                            <input
                                                type="date"
                                                className="input-field"
                                                value={formData.contract_renewal_date || ''}
                                                onChange={e => handleChange('contract_renewal_date', e.target.value)}
                                            />
                                        </InputGroup>
                                        {/* New row for 2nd date to maintain grid structure */}
                                        <div className="col-span-2 md:col-span-1 md:col-start-2">
                                            <InputGroup label="Renouvellement 2">
                                                <input
                                                    type="date"
                                                    className="input-field"
                                                    value={formData.contract_renewal_date_2 || ''}
                                                    onChange={e => handleChange('contract_renewal_date_2', e.target.value)}
                                                />
                                            </InputGroup>
                                        </div>
                                    </>
                                ) : formData.contract_type === 'CDI' ? (
                                    null
                                ) : (
                                    <InputGroup label="Renouvellement">
                                        <input
                                            type="date"
                                            className="input-field"
                                            value={formData.contract_renewal_date || ''}
                                            onChange={e => handleChange('contract_renewal_date', e.target.value)}
                                        />
                                    </InputGroup>
                                )}
                            </div>
                            <InputGroup label="Affectation / Poste">
                                <input
                                    className="input-field"
                                    value={formData.assignment || ''}
                                    onChange={e => handleChange('assignment', e.target.value)}
                                />
                            </InputGroup>
                        </div>
                    </div>

                    {/* Card 2: Personnel */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <UserPlus size={18} className="text-purple-500" />
                            Infos Personnelles
                        </h3>
                        <div className="space-y-4">
                            <InputGroup label="Situation Familiale">
                                <select
                                    className="input-field"
                                    value={formData.family_situation || ''}
                                    onChange={e => handleChange('family_situation', e.target.value)}
                                >
                                    <option value="">-</option>
                                    <option value="Célibataire">Célibataire</option>
                                    <option value="Marié(e)">Marié(e)</option>
                                    <option value="Divorcé(e)">Divorcé(e)</option>
                                </select>
                            </InputGroup>
                            <InputGroup label="Équipe Actuelle">
                                <select
                                    className="input-field"
                                    value={formData.team || ''}
                                    onChange={e => handleChange('team', e.target.value)}
                                >
                                    <option value="Equipe 1">Equipe 1</option>
                                    <option value="Equipe 2">Equipe 2</option>
                                    <option value="Stable">Stable</option>
                                </select>
                            </InputGroup>
                            {formData.team === 'Stable' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <InputGroup label="Repos Fixe">
                                        <select
                                            className="input-field"
                                            value={formData.stable_rest_day ?? ''}
                                            onChange={e => handleChange('stable_rest_day', e.target.value ? parseInt(e.target.value) : null)}
                                        >
                                            <option value="">Auto</option>
                                            <option value="0">Dim</option>
                                            <option value="1">Lun</option>
                                            <option value="2">Mar</option>
                                            <option value="3">Mer</option>
                                            <option value="4">Jeu</option>
                                            <option value="5">Ven</option>
                                            <option value="6">Sam</option>
                                        </select>
                                    </InputGroup>
                                    <InputGroup label="Shift Défaut">
                                        <select
                                            className="input-field"
                                            value={formData.default_shift || 'Jour'}
                                            onChange={e => handleChange('default_shift', e.target.value)}
                                        >
                                            <option value="Jour">Jour</option>
                                            <option value="Nuit">Nuit</option>
                                        </select>
                                    </InputGroup>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Save Bar */}
            {isDirty && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 flex justify-end gap-3 animate-slide-in-up">
                    <button
                        onClick={() => {
                            setFormData(employee || {}); // Reset
                            setIsDirty(false);
                        }}
                        className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                        disabled={isSaving}
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 hover:shadow-indigo-200 transition-all font-bold disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Enregistrement...</span>
                            </>
                        ) : (
                            <>
                                <Save size={20} />
                                <span>Enregistrer les modifications</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

const AbsencesTab = ({ employee, absences, refresh }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newAbs, setNewAbs] = useState({ type: 'Maladie', start: '', end: '', reason: '' });

    const handleAdd = async () => {
        if (!newAbs.start || !newAbs.end) return alert('Dates requises');
        try {
            await supabase.from('employee_absences').insert([{
                employee_id: employee.id,
                start_date: newAbs.start,
                end_date: newAbs.end,
                type: newAbs.type,
                reason: newAbs.reason
            }]);
            setIsAdding(false);
            setNewAbs({ type: 'Maladie', start: '', end: '', reason: '' });
            refresh();
        } catch (err) {
            // Error handling handled by parent or just logged if simple
            console.error(err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Historique des Absences</h3>
                <button onClick={() => setIsAdding(!isAdding)} className="btn-primary text-sm px-3 py-1.5 flex items-center gap-2">
                    <Plus size={16} /> Ajouter
                </button>
            </div>

            {isAdding && (
                <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <InputGroup label="Type">
                            <select className="input-field w-full" value={newAbs.type} onChange={e => setNewAbs({ ...newAbs, type: e.target.value })}>
                                <option value="Maladie">Maladie</option>
                                <option value="Congé Payé">Congé Payé</option>
                                <option value="Absence Injustifiée">Absence Injustifiée</option>
                                <option value="Délégation">Délégation</option>
                            </select>
                        </InputGroup>
                        <InputGroup label="Du">
                            <input type="date" className="input-field w-full" value={newAbs.start} onChange={e => setNewAbs({ ...newAbs, start: e.target.value })} />
                        </InputGroup>
                        <InputGroup label="Au">
                            <input type="date" className="input-field w-full" value={newAbs.end} onChange={e => setNewAbs({ ...newAbs, end: e.target.value })} />
                        </InputGroup>
                        <InputGroup label="Motif (Optionnel)">
                            <input className="input-field w-full" placeholder="..." value={newAbs.reason} onChange={e => setNewAbs({ ...newAbs, reason: e.target.value })} />
                        </InputGroup>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg">Annuler</button>
                        <button onClick={handleAdd} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Enregistrer</button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50 max-h-96 overflow-y-auto">
                {absences.length === 0 ? <div className="p-8 text-center text-gray-400">Aucune absence enregistrée</div> :
                    absences.map(abs => (
                        <div key={abs.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${abs.type === 'Maladie' ? 'bg-red-50 text-red-600' :
                                    abs.type === 'Congé Payé' ? 'bg-green-50 text-green-600' :
                                        'bg-orange-50 text-orange-600'
                                    }`}>
                                    <Calendar size={20} />
                                </div>
                                <div>
                                    <div className="font-medium text-gray-900">{abs.type}</div>
                                    <div className="text-sm text-gray-500">
                                        {format(parseISO(abs.start_date), 'dd MMM yyyy', { locale: fr })} - {format(parseISO(abs.end_date), 'dd MMM yyyy', { locale: fr })}
                                    </div>
                                </div>
                            </div>
                            {abs.reason && <div className="text-sm text-gray-500 italic max-w-xs truncate">"{abs.reason}"</div>}
                        </div>
                    ))}
            </div>
        </div>
    );
};

const MedicalTab = ({ employee, events, refresh }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newEvent, setNewEvent] = useState({ date: new Date().toISOString().split('T')[0], type: 'Envoi Dossier', ref: '', status: 'En cours', notes: '' });

    const handleAdd = async () => {
        try {
            await supabase.from('medical_tracking').insert([{
                employee_id: employee.id,
                event_date: newEvent.date,
                event_type: newEvent.type,
                tracking_number: newEvent.ref,
                status: newEvent.status,
                notes: newEvent.notes
            }]);
            setIsAdding(false);
            refresh();
        } catch (err) { console.error(err); }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Suivi Dossiers Maladie / Assurance</h3>
                <button onClick={() => setIsAdding(!isAdding)} className="btn-primary text-sm px-3 py-1.5 flex items-center gap-2">
                    <Plus size={16} /> Nouvel Événement
                </button>
            </div>

            {isAdding && (
                <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm animate-slide-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <InputGroup label="Date">
                            <input type="date" className="input-field w-full" value={newEvent.date} onChange={e => setNewEvent({ ...newEvent, date: e.target.value })} />
                        </InputGroup>
                        <InputGroup label="Type Action">
                            <select className="input-field w-full" value={newEvent.type} onChange={e => setNewEvent({ ...newEvent, type: e.target.value })}>
                                <option>Envoi Dossier</option>
                                <option>Réception Accusé</option>
                                <option>Remboursement</option>
                                <option>Rejet</option>
                                <option>Complément demandé</option>
                            </select>
                        </InputGroup>
                        <InputGroup label="Référence Dossier">
                            <input className="input-field w-full" value={newEvent.ref} onChange={e => setNewEvent({ ...newEvent, ref: e.target.value })} />
                        </InputGroup>
                        <InputGroup label="Statut">
                            <select className="input-field w-full" value={newEvent.status} onChange={e => setNewEvent({ ...newEvent, status: e.target.value })}>
                                <option>En cours</option>
                                <option>Terminé</option>
                                <option>Bloqué</option>
                            </select>
                        </InputGroup>
                        <div className="md:col-span-2">
                            <InputGroup label="Notes / Montant">
                                <textarea className="input-field w-full" rows="2" value={newEvent.notes} onChange={e => setNewEvent({ ...newEvent, notes: e.target.value })} />
                            </InputGroup>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg">Annuler</button>
                        <button onClick={handleAdd} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Ajouter</button>
                    </div>
                </div>
            )}

            <div className="relative border-l-2 border-gray-200 ml-4 space-y-8 py-4">
                {events.length === 0 && <div className="pl-6 text-gray-400">Aucun historique</div>}
                {events.map((evt, i) => (
                    <div key={evt.id} className="relative pl-6">
                        <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${evt.status === 'Terminé' ? 'bg-green-500' :
                            evt.status === 'Bloqué' ? 'bg-red-500' : 'bg-blue-500'
                            }`}></div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-gray-800">{evt.event_type}</h4>
                                <span className="text-xs text-gray-500">{format(parseISO(evt.event_date), 'dd MMM yyyy', { locale: fr })}</span>
                            </div>
                            <div className="text-sm text-gray-600 mb-2">
                                <span className="font-medium">Ref:</span> {evt.tracking_number || '-'} | <span className="font-medium">Statut:</span> {evt.status}
                            </div>
                            {evt.notes && <div className="text-sm bg-gray-50 p-2 rounded-lg text-gray-600">{evt.notes}</div>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AddEmployeeModal = ({ onClose, onAdded }) => {
    const [emp, setEmp] = useState({ name: '', role: '', team: 'Equipe 1' });
    const handleSave = async () => {
        if (!emp.name) return;
        await supabase.from('employees').insert([emp]);
        onAdded();
        onClose();
    };
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
                <h2 className="text-xl font-bold mb-4">Nouvel Employé</h2>
                <div className="space-y-4">
                    <input className="input-field w-full" placeholder="Nom Complet" value={emp.name} onChange={e => setEmp({ ...emp, name: e.target.value })} />
                    <input className="input-field w-full" placeholder="Rôle" value={emp.role} onChange={e => setEmp({ ...emp, role: e.target.value })} />
                    <select className="input-field w-full" value={emp.team} onChange={e => setEmp({ ...emp, team: e.target.value })}>
                        {['Equipe 1', 'Equipe 2', 'Stable'].map(t => <option key={t}>{t}</option>)}
                    </select>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-gray-500">Annuler</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Créer</button>
                </div>
            </div>
        </div>
    );
};

const InputGroup = ({ label, children }) => (
    <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 ml-1">{label}</label>
        {children}
    </div>
);
