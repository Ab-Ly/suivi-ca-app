import React, { useState } from 'react';
import { X, Calendar, User, Stethoscope } from 'lucide-react';
import { format } from 'date-fns';

export default function AbsenceModal({ employees, onClose, onApply }) {
    const [selectedEmpId, setSelectedEmpId] = useState('');
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [type, setType] = useState('Maladie');

    const handleSubmit = () => {
        if (!selectedEmpId || !startDate || !endDate) return;
        onApply(selectedEmpId, startDate, endDate, type);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-scale-in">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900">
                        <Stethoscope className="text-red-500" />
                        Ajouter une Absence
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Employé</label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <select
                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white"
                                value={selectedEmpId}
                                onChange={e => setSelectedEmpId(e.target.value)}
                            >
                                <option value="">Choisir un employé...</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Du</label>
                            <input
                                type="date"
                                className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Au</label>
                            <input
                                type="date"
                                className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type d'absence</label>
                        <div className="flex gap-2">
                            {['Maladie', 'Congé', 'Autre'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setType(t)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${type === t
                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!selectedEmpId}
                        className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none"
                    >
                        Appliquer
                    </button>
                </div>
            </div>
        </div>
    );
}
