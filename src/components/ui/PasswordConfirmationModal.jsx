import React, { useState } from 'react';
import { Modal } from './Modal';
import { supabase } from '../../lib/supabase';
import { Loader2, Lock, AlertTriangle } from 'lucide-react';

export default function PasswordConfirmationModal({ isOpen, onClose, onConfirm, title, message }) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !user.email) {
                throw new Error("Utilisateur non identifié");
            }

            // Verify password by attempting to sign in (re-authentication)
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: password,
            });

            if (signInError) {
                throw new Error("Mot de passe incorrect");
            }

            // Password verified
            await onConfirm();
            onClose();
            setPassword('');
        } catch (err) {
            console.error("Verification error:", err);
            setError(err.message || "Erreur de vérification");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title || "Confirmation Requise"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {message && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
                        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                        <p className="text-sm text-amber-800">{message}</p>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mot de passe administrateur
                    </label>
                    <div className="relative">
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                            placeholder="Entrez votre mot de passe pour confirmer"
                        />
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    </div>
                    {error && <p className="text-red-500 text-xs mt-1.5 font-medium">{error}</p>}
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        type="submit"
                        disabled={loading || !password}
                        className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : 'Confirmer la suppression'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
