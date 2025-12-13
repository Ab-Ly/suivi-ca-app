
import React, { useState, useEffect } from 'react';
import { format, addDays, startOfMonth, endOfMonth, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, Users, Wand2, Save, Download, ChevronLeft, ChevronRight, Settings, CheckSquare, Square, Stethoscope } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SHIFT_TYPES, SHIFT_COLORS, calculateProjectedSchedule, TEAMS } from '../utils/rotationLogic';
import StaffManager from './StaffManager';
import AbsenceModal from './AbsenceModal';

export default function Planning() {
    const [currentDate, setCurrentDate] = useState(new Date(2025, 10, 16)); // Start 16 Nov
    const [viewDays, setViewDays] = useState(30);
    const [employees, setEmployees] = useState([]);
    const [shifts, setShifts] = useState({}); // { 'empId-yyyy-mm-dd': 'Type' }

    // Multi-Selection State
    const [selectedEmpIds, setSelectedEmpIds] = useState(new Set()); // Set of Employee IDs
    const [selectedDates, setSelectedDates] = useState(new Set()); // Set of Date Strings (yyyy-mm-dd)

    const [showStaffManager, setShowStaffManager] = useState(false);
    const [showAbsenceModal, setShowAbsenceModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Toast State
    const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Employees
            const { data: empData, error: empError } = await supabase
                .from('employees')
                .select('*')
                .order('team')
                .order('name');

            if (empError) throw empError;
            setEmployees(empData || []);

            // Fetch Shifts for Range
            const startStr = format(currentDate, 'yyyy-MM-dd');
            const endStr = format(addDays(currentDate, viewDays), 'yyyy-MM-dd');

            const { data: shiftData, error: shiftError } = await supabase
                .from('planning_shifts')
                .select('*')
                .gte('date', startStr)
                .lte('date', endStr);

            if (shiftError) {
                console.warn(shiftError);
            } else {
                const shiftMap = {};
                shiftData.forEach(s => {
                    shiftMap[`${s.employee_id}-${s.date}`] = s.shift_type;
                });
                setShifts(shiftMap);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Selection Handlers
    const toggleEmployeeSelection = (empId) => {
        const newSet = new Set(selectedEmpIds);
        if (newSet.has(empId)) newSet.delete(empId);
        else newSet.add(empId);
        setSelectedEmpIds(newSet);
    };

    const toggleDateSelection = (dateStr) => {
        const newSet = new Set(selectedDates);
        if (newSet.has(dateStr)) newSet.delete(dateStr);
        else newSet.add(dateStr);
        setSelectedDates(newSet);
    };

    const selectTeam = (teamName) => {
        const teamIds = employees.filter(e => e.team === teamName).map(e => e.id);
        const newSet = new Set(selectedEmpIds);
        teamIds.forEach(id => newSet.add(id));
        setSelectedEmpIds(newSet);
    };

    const selectAllEmployees = () => {
        if (selectedEmpIds.size === employees.length) setSelectedEmpIds(new Set());
        else setSelectedEmpIds(new Set(employees.map(e => e.id)));
    };

    const clearSelection = () => {
        setSelectedEmpIds(new Set());
        setSelectedDates(new Set());
    };

    // Interaction Handlers
    const handleCellClick = (empId, date) => {
        // If in selection mode (both row and col selected), maybe modify selection?
        // But simpler: Cell click always cycles individual cell, unless we implement drag select later.
        // Let's keep individual click.

        const dateKey = format(date, 'yyyy-MM-dd');
        const key = `${empId}-${dateKey}`;
        const currentType = shifts[key] || SHIFT_TYPES.REPOS;

        const types = Object.values(SHIFT_TYPES);
        const currentIndex = types.indexOf(currentType);
        const nextIndex = (currentIndex + 1) % types.length;
        const nextType = types[nextIndex];

        setShifts(prev => ({ ...prev, [key]: nextType }));
    };

    const handleBulkApply = (shiftType) => {
        if (selectedEmpIds.size === 0 || selectedDates.size === 0) return;

        const newShifts = { ...shifts };
        selectedEmpIds.forEach(empId => {
            selectedDates.forEach(dateStr => {
                const key = `${empId}-${dateStr}`;
                newShifts[key] = shiftType;
            });
        });

        setShifts(newShifts);
        // Optional: clear selection? 
        // clearSelection(); 
    };

    const handleApplyAbsence = (empId, startDate, endDate, type) => {
        const start = parseISO(startDate);
        const end = parseISO(endDate);
        const newShifts = { ...shifts };

        let curr = start;
        while (curr <= end) {
            const dateKey = format(curr, 'yyyy-MM-dd');
            const key = `${empId}-${dateKey}`;
            newShifts[key] = type;
            curr = addDays(curr, 1);
        }

        setShifts(newShifts);
        setShowAbsenceModal(false);
        showToast(`${type} appliquée avec succès`);
    };

    const handleSmartFill = () => {
        const endDate = addDays(currentDate, viewDays);

        let targetEmployees = employees;
        if (selectedEmpIds.size > 0) {
            targetEmployees = employees.filter(e => selectedEmpIds.has(e.id));
        }

        const newShifts = calculateProjectedSchedule(currentDate, endDate, targetEmployees, shifts);
        // calculateProjectedSchedule returns the full schedule (merged with clones), 
        // so we can just set it directly. 
        // Wait, if it clones `shifts` (passed as seed) inside, and we filter employees, 
        // the function iterates ONLY over targetEmployees.
        // So for non-target employees, it just returns their existing state in `schedule`.
        // This is perfectly correct.
        setShifts(newShifts);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const upsertData = Object.entries(shifts).map(([key, type]) => {
                // Key format: "uuid-yyyy-mm-dd"
                // UUIDs contain dashes, so we must be careful.
                // The date part "yyyy-mm-dd" is always 10 chars at the end.
                const date = key.slice(-10);
                const empId = key.slice(0, -11); // Remove date and the dash before it

                return { employee_id: empId, date: date, shift_type: type };
            });

            const { error } = await supabase
                .from('planning_shifts')
                .upsert(upsertData, { onConflict: 'employee_id,date' });

            if (error) throw error;
            showToast('Planning sauvegardé avec succès !', 'success');
        } catch (err) {
            console.error('Save failed:', err);
            showToast('Erreur lors de la sauvegarde: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleExport = async () => {
        try {
            const { exportPlanningToExcel } = await import('../utils/excelExport');
            const endDate = addDays(currentDate, viewDays);
            await exportPlanningToExcel(currentDate, endDate, shifts, employees);
            showToast('Export généré avec succès', 'success');
        } catch (err) {
            console.error('Export failed:', err);
            showToast('Erreur export: ' + err.message, 'error');
        }
    };

    // Render Grid
    const dates = [];
    for (let i = 0; i < viewDays; i++) {
        dates.push(addDays(currentDate, i));
    }

    const isSelectionActive = selectedEmpIds.size > 0 && selectedDates.size > 0;

    return (
        <div className="space-y-6 pb-20 relative">
            {/* Header / Toolbar */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Calendar className="text-indigo-600" />
                        Planning & Rotations
                    </h1>
                    <p className="text-text-muted text-sm mt-1">Gérez les équipes et générez les rotations automatique (J/N/24h)</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Team Selection Shortcuts */}
                    <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200 mr-2">
                        <button onClick={() => selectTeam(TEAMS.EQUIPE_1)} className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg">
                            Équipe 1
                        </button>
                        <button onClick={() => selectTeam(TEAMS.EQUIPE_2)} className="px-3 py-1.5 text-xs font-bold text-purple-600 hover:bg-purple-50 rounded-lg">
                            Équipe 2
                        </button>
                        <button onClick={selectAllEmployees} className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg">
                            Tous
                        </button>
                    </div>

                    <button
                        onClick={() => setShowStaffManager(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                    >
                        <Users size={18} />
                    </button>

                    <button
                        onClick={() => setShowAbsenceModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-xl font-medium hover:bg-red-100 transition-colors"
                        title="Ajouter une absence / maladie"
                    >
                        <Stethoscope size={18} />
                    </button>

                    <div className="h-8 w-px bg-gray-200 mx-1"></div>

                    <button
                        onClick={handleSmartFill}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-medium hover:bg-indigo-100 transition-colors"
                        title={selectedEmpIds.size > 0 ? `Générer pour ${selectedEmpIds.size} sélection(s)` : "Générer pour tous"}
                    >
                        <Wand2 size={18} />
                        <span className="hidden md:inline">
                            {selectedEmpIds.size > 0 ? `Auto (${selectedEmpIds.size})` : 'Génération Auto'}
                        </span>
                        <span className="md:hidden">Auto</span>
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl font-medium hover:bg-green-100 transition-colors"
                    >
                        <Save size={18} />
                        <span>{saving ? '...' : 'Sauvegarder'}</span>
                    </button>

                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-purple text-white rounded-xl font-medium shadow-md shadow-purple-200 hover:shadow-lg transition-all active:scale-95"
                    >
                        <Download size={18} />
                        <span className="hidden sm:inline">Export (Beta)</span>
                    </button>
                </div>
            </div>

            {/* Bulk Action Floating Toolbar */}
            {isSelectionActive && (
                <div className="sticky top-4 left-0 right-0 z-50 flex justify-center animate-slide-in">
                    <div className="bg-indigo-900/95 backdrop-blur-sm text-white p-2 px-4 rounded-full shadow-2xl flex items-center gap-3 border border-indigo-500/30">
                        <span className="text-xs font-medium text-indigo-200 uppercase tracking-wider">
                            {selectedEmpIds.size} emps × {selectedDates.size} dates
                        </span>
                        <div className="h-4 w-px bg-indigo-700"></div>
                        <div className="flex gap-1">
                            {Object.values(SHIFT_TYPES).map(type => (
                                <button
                                    key={type}
                                    onClick={() => handleBulkApply(type)}
                                    className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 transition-colors border border-white/5"
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                        <div className="h-4 w-px bg-indigo-700"></div>
                        <button onClick={clearSelection} className="p-1 hover:bg-red-500/20 rounded-full text-red-200 hover:text-red-100 transition-colors">
                            <Settings size={14} className="rotate-45" /> {/* Use X icon ideally, settings as placeholder for 'clear' visual implies tools? No, X is better. */}
                        </button>
                    </div>
                </div>
            )}


            {/* Grid Container */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-14rem)]">
                <div className="overflow-auto flex-1 select-none"> {/* Disable text selection for easier clicking */}
                    <table className="w-full text-sm text-center border-collapse">
                        <thead className="sticky top-0 z-30 bg-white shadow-sm">
                            <tr>
                                <th className="sticky left-0 z-40 bg-gray-50 p-3 min-w-[200px] text-left border-r border-b border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                    <div className="flex items-center justify-between">
                                        <span>Employé</span>
                                        <button onClick={clearSelection} className="text-xs text-indigo-600 hover:underline disabled:opacity-50" disabled={!selectedEmpIds.size && !selectedDates.size}>Reset</button>
                                    </div>
                                </th>
                                {dates.map((d, i) => {
                                    const isSun = d.getDay() === 0;
                                    const dateStr = format(d, 'yyyy-MM-dd');
                                    const isSelected = selectedDates.has(dateStr);

                                    return (
                                        <th
                                            key={i}
                                            onClick={() => toggleDateSelection(dateStr)}
                                            className={`p-2 min-w-[60px] border-r border-b border-gray-100 font-semibold cursor-pointer transition-colors ${isSelected ? 'bg-indigo-100 text-indigo-700' :
                                                isSun ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'text-gray-600 hover:bg-gray-100'
                                                }`}
                                        >
                                            <div className="text-[10px] uppercase">{format(d, 'EEE', { locale: fr })}</div>
                                            <div className="text-lg leading-none">{format(d, 'dd')}</div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {employees.map(emp => {
                                const isEmpSelected = selectedEmpIds.has(emp.id);
                                return (
                                    <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className={`sticky left-0 z-20 p-3 text-left border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors ${isEmpSelected ? 'bg-indigo-50' : 'bg-white group-hover:bg-gray-50/50'}`}>
                                            <div className="flex items-center gap-3">
                                                <div
                                                    onClick={() => toggleEmployeeSelection(emp.id)}
                                                    className={`cursor-pointer text-gray-400 hover:text-indigo-600 transition-colors ${isEmpSelected ? 'text-indigo-600' : ''}`}
                                                >
                                                    {isEmpSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-800">{emp.name}</div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${emp.team === TEAMS.EQUIPE_1 ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                            emp.team === TEAMS.EQUIPE_2 ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                                                'bg-gray-100 text-gray-500 border-gray-200'
                                                            }`}>
                                                            {emp.team}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">{emp.role}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        {dates.map((d, i) => {
                                            const dateKey = format(d, 'yyyy-MM-dd');
                                            const shiftType = shifts[`${emp.id}-${dateKey}`];
                                            const colorClass = SHIFT_COLORS[shiftType] || 'hover:bg-gray-100';

                                            const isColSelected = selectedDates.has(dateKey);
                                            const isCellTargeted = isEmpSelected && isColSelected;

                                            return (
                                                <td
                                                    key={i}
                                                    onClick={() => handleCellClick(emp.id, d)}
                                                    className={`border-r border-gray-100 p-1 cursor-pointer select-none transition-all ${isCellTargeted ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-400' : ''
                                                        }`}
                                                >
                                                    <div className={`w-full h-12 rounded-lg flex items-center justify-center text-xs font-bold border transition-all ${colorClass} ${shiftType ? 'shadow-sm' : ''}`}>
                                                        {shiftType === 'Jour' ? 'J' :
                                                            shiftType === 'Nuit' ? 'N' :
                                                                shiftType === '24h' ? '24' :
                                                                    shiftType === 'Repos' ? 'R' :
                                                                        shiftType === 'Congé' ? 'C' :
                                                                            shiftType === 'Maladie' ? 'M' :
                                                                                shiftType?.substring(0, 2) || ''}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {showStaffManager && (
                <StaffManager
                    onClose={() => setShowStaffManager(false)}
                    onUpdate={fetchData}
                />
            )}

            {showAbsenceModal && (
                <AbsenceModal
                    employees={employees}
                    onClose={() => setShowAbsenceModal(false)}
                    onApply={handleApplyAbsence}
                />
            )}

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-slide-up z-50 ${toast.type === 'error' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-gray-900 text-white border-gray-800'
                    }`}>
                    <div className={`w-2 h-2 rounded-full ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-400'}`}></div>
                    <span className="font-medium">{toast.message}</span>
                </div>
            )}
        </div>
    );
}
