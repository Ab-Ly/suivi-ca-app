import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, LogIn, AlertCircle } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            navigate('/');
        } catch (error) {
            console.error('Login error:', error);
            if (error.message === 'Invalid login credentials') {
                setError('Email ou mot de passe incorrect.');
            } else if (error.message === 'Email not confirmed') {
                setError('Veuillez confirmer votre email avant de vous connecter.');
            } else {
                setError(error.message || 'Une erreur est survenue lors de la connexion.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-main p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                {/* Header with Gradient */}
                <div className="bg-gradient-purple p-8 text-center">
                    <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg p-0 overflow-hidden">
                        <img src="/logo.png" alt="Petrom Logo" className="w-full h-full object-contain scale-75" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Bienvenue</h1>
                    <p className="text-purple-100 text-sm">Connectez-vous pour accéder à votre espace</p>
                </div>

                {/* Form */}
                <div className="p-8">
                    {error && (
                        <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1.5">Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-text-main"
                                placeholder="votre@email.com"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1.5">Mot de passe</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-text-main"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-purple text-white py-3.5 rounded-xl font-bold shadow-lg shadow-purple-200 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Se connecter'}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-8 py-4 text-center border-t border-gray-100">
                    <p className="text-xs text-text-muted">
                        ipepiniere @t petrom &copy; 2025
                    </p>
                </div>
            </div>
        </div>
    );
}
