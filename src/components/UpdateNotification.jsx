import React, { useState, useEffect } from 'react';
import { X, Sparkles, ArrowRight } from 'lucide-react';

const CURRENT_VERSION = '1.2.0'; // Increment this for new updates
const UPDATES = [
    {
        title: "Gestion Carburant Complète",
        description: "Suivez les volumes Gasoil et SSP avec des graphiques d'évolution et des comparaisons mensuelles."
    },
    {
        title: "Saisie Historique Améliorée",
        description: "Nouvelle interface pour saisir l'historique des ventes carburant et comparer les années."
    },
    {
        title: "Formatage Standardisé",
        description: "Tous les montants et volumes sont maintenant formatés clairement (ex: 1 234 MAD)."
    }
];

export default function UpdateNotification() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const lastSeenVersion = localStorage.getItem('lastSeenVersion');
        if (lastSeenVersion !== CURRENT_VERSION) {
            // Small delay for better UX
            const timer = setTimeout(() => setIsVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem('lastSeenVersion', CURRENT_VERSION);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-slide-up">
            <div className="bg-white rounded-2xl shadow-2xl border border-indigo-100 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                        <Sparkles size={20} className="text-yellow-300" />
                        <h3 className="font-bold text-lg">Nouveautés !</h3>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="text-white/80 hover:text-white hover:bg-white/20 p-1 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                    <div className="space-y-3">
                        {UPDATES.map((update, index) => (
                            <div key={index} className="flex gap-3 items-start">
                                <div className="mt-1 min-w-[6px] h-[6px] rounded-full bg-indigo-500"></div>
                                <div>
                                    <h4 className="font-bold text-gray-900 text-sm">{update.title}</h4>
                                    <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{update.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleDismiss}
                        className="w-full py-2.5 bg-gray-50 hover:bg-gray-100 text-indigo-600 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 group"
                    >
                        J'ai compris
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}
