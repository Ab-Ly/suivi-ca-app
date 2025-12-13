import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Save, X, User } from 'lucide-react';

const TEAMS = ['Equipe 1', 'Equipe 2', 'Stable'];

export default function StaffManager({ onClose, onUpdate }) {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newEmp, setNewEmp] = useState({ name: '', role: '', team: 'Equipe 1' });

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
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

    const handleAdd = async () => {
        if (!newEmp.name) return;
        try {
            const { data, error } = await supabase
                .from('employees')
                .insert([newEmp])
                .select();

            if (error) throw error;
            setEmployees([...employees, data[0]]);
            setNewEmp({ name: '', role: '', team: 'Equipe 1' });
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error('Error adding employee:', err);
            alert('Erreur: ' + err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cet employé ?')) return;
        try {
            const { error } = await supabase
                .from('employees')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setEmployees(employees.filter(e => e.id !== id));
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error('Error deleting employee:', err);
        }
    };

    const handleUpdateTeam = async (id, team) => {
        try {
            const { error } = await supabase
                .from('employees')
                .update({ team })
                .eq('id', id);

            if (error) throw error;
            setEmployees(employees.map(e => e.id === id ? { ...e, team } : e));
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error('Error updating team:', err);
        }
    };

    const handleUpdateRestDay = async (id, dayIndex) => {
        try {
            const { error } = await supabase
                .from('employees')
                .update({ stable_rest_day: dayIndex })
                .eq('id', id);

            if (error) throw error;
            setEmployees(employees.map(e => e.id === id ? { ...e, stable_rest_day: dayIndex } : e));
            if (onUpdate) onUpdate(); // Trigger refresh in parent to update generated schedule if needed
        } catch (err) {
            console.error('Error updating rest day:', err);
        }
    };

    const handleUpdateDefaultShift = async (id, shiftType) => {
        try {
            const { error } = await supabase
                .from('employees')
                .update({ default_shift: shiftType })
                .eq('id', id);

            if (error) throw error;
            setEmployees(employees.map(e => e.id === id ? { ...e, default_shift: shiftType } : e));
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error('Error updating default shift:', err);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <User className="text-indigo-600" />
                        Gestion du Personnel
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* Add Form */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <input
                            placeholder="Nom complet"
                            className="md:col-span-2 px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={newEmp.name}
                            onChange={e => setNewEmp({ ...newEmp, name: e.target.value })}
                        />
                        <input
                            placeholder="Rôle (ex: Pompiste)"
                            className="px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={newEmp.role}
                            onChange={e => setNewEmp({ ...newEmp, role: e.target.value })}
                        />
                        <div className="flex gap-2">
                            <select
                                className="flex-1 px-2 py-2 rounded-lg border border-gray-300 bg-white"
                                value={newEmp.team}
                                onChange={e => setNewEmp({ ...newEmp, team: e.target.value })}
                            >
                                {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <select
                                className="w-32 px-2 py-2 rounded-lg border border-gray-300 bg-white"
                                value={newEmp.stable_rest_day !== undefined ? newEmp.stable_rest_day : ''}
                                onChange={e => setNewEmp({ ...newEmp, stable_rest_day: e.target.value ? parseInt(e.target.value) : null })}
                            >
                                <option value="">Repos défaut</option>
                                <option value="0">Dimanche</option>
                                <option value="1">Lundi</option>
                                <option value="2">Mardi</option>
                                <option value="3">Mercredi</option>
                                <option value="4">Jeudi</option>
                                <option value="5">Vendredi</option>
                                <option value="6">Samedi</option>
                            </select>
                            {newEmp.team === 'Stable' && (
                                <select
                                    className="w-24 px-2 py-2 rounded-lg border border-gray-300 bg-white"
                                    value={newEmp.default_shift || 'Jour'}
                                    onChange={e => setNewEmp({ ...newEmp, default_shift: e.target.value })}
                                >
                                    <option value="Jour">Jour</option>
                                    <option value="Nuit">Nuit</option>
                                </select>
                            )}
                            <button
                                onClick={handleAdd}
                                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="space-y-2">
                        {loading ? <div className="text-center py-4">Chargement...</div> : employees.map(emp => (
                            <div key={emp.id} className="flex flex-col md:flex-row items-center justify-between p-3 bg-white border border-gray-100 rounded-lg hover:shadow-sm transition-shadow">
                                <div className="flex-1">
                                    <div className="font-bold text-gray-800">{emp.name}</div>
                                    <div className="text-xs text-gray-500">{emp.role}</div>
                                </div>
                                <div className="flex items-center gap-4 mt-2 md:mt-0">
                                    <select
                                        value={emp.team}
                                        onChange={(e) => handleUpdateTeam(emp.id, e.target.value)}
                                        className="text-sm border-none bg-gray-50 rounded-md px-2 py-1 font-medium text-indigo-600 cursor-pointer focus:ring-0"
                                    >
                                        {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>

                                    <select
                                        value={emp.stable_rest_day !== null && emp.stable_rest_day !== undefined ? emp.stable_rest_day : ''}
                                        onChange={(e) => handleUpdateRestDay(emp.id, e.target.value ? parseInt(e.target.value) : null)}
                                        className="text-xs border border-gray-200 bg-white rounded-md px-2 py-1 text-gray-600 cursor-pointer focus:ring-0 w-24 mr-1"
                                        title="Jour de Repos Fixe"
                                    >
                                        <option value="">Repos Auto</option>
                                        <option value="0">Dim</option>
                                        <option value="1">Lun</option>
                                        <option value="2">Mar</option>
                                        <option value="3">Mer</option>
                                        <option value="4">Jeu</option>
                                        <option value="5">Ven</option>
                                        <option value="6">Sam</option>
                                    </select>

                                    {emp.team === 'Stable' && (
                                        <select
                                            value={emp.default_shift || 'Jour'}
                                            onChange={(e) => handleUpdateDefaultShift(emp.id, e.target.value)}
                                            className="text-xs border border-gray-200 bg-white rounded-md px-2 py-1 text-gray-600 cursor-pointer focus:ring-0 w-20"
                                            title="Shift par défaut"
                                        >
                                            <option value="Jour">Jour</option>
                                            <option value="Nuit">Nuit</option>
                                        </select>
                                    )}

                                    <button
                                        onClick={() => handleDelete(emp.id)}
                                        className="text-red-400 hover:text-red-600 p-1"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="w-full py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                    >
                        Terminé
                    </button>
                </div>
            </div>
        </div>
    );
}
