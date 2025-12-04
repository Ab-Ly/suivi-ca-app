import React, { useState } from 'react';
import { BarChart2, History } from 'lucide-react';
import ComparisonCharts from './stats/ComparisonCharts';
import HistoricalEntry from './stats/HistoricalEntry';

export default function Statistics() {
    const [activeTab, setActiveTab] = useState('overview');

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Statistiques</h2>
                    <p className="text-gray-500 text-sm">Analysez vos performances et comparez avec l'année précédente</p>
                </div>

                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium transition-all ${activeTab === 'overview'
                                ? 'bg-primary text-white shadow-md'
                                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                    >
                        <BarChart2 size={16} />
                        Vue d'ensemble
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium transition-all ${activeTab === 'history'
                                ? 'bg-primary text-white shadow-md'
                                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                    >
                        <History size={16} />
                        Saisie Historique
                    </button>
                </div>
            </div>

            {activeTab === 'overview' ? (
                <ComparisonCharts />
            ) : (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="mb-6">
                        <h3 className="font-bold text-lg text-gray-900">Saisie des Données Historiques</h3>
                        <p className="text-sm text-gray-500">Remplissez les chiffres d'affaires mensuels pour permettre la comparaison.</p>
                    </div>
                    <HistoricalEntry />
                </div>
            )}
        </div>
    );
}
