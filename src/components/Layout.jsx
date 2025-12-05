import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, FileText, User, LogOut, Menu, X, BarChart2, BarChart3, PlusCircle, Wallet, Truck } from 'lucide-react';
import { PullToRefresh } from './ui/PullToRefresh';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import SalesEntry from './SalesEntry';
import UpdateNotification from './UpdateNotification';
import { supabase } from '../lib/supabase';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// eslint-disable-next-line no-unused-vars
const NavItem = ({ to, icon: IconComponent, label, active, onClick, isButton, onLogout }) => {
    if (isButton) {
        return (
            <button
                onClick={onClick}
                className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium group text-red-500 hover:bg-red-50"
                )}
            >
                <IconComponent size={20} className="transition-transform duration-200 group-hover:scale-110" />
                <span>{label}</span>
            </button>
        );
    }

    return (
        <Link
            to={to}
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium group",
                active
                    ? "bg-gradient-purple text-white shadow-md shadow-purple-200"
                    : "text-text-muted hover:bg-gray-50 hover:text-text-main"
            )}
        >
            <IconComponent size={20} className={cn("transition-transform duration-200", active ? "" : "group-hover:scale-110")} />
            <span>{label}</span>
        </Link>
    );
};

export default function Layout() {
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
        { to: '/daily-cash', icon: Wallet, label: 'Suivi Caisse' },
        { to: '/statistics', icon: BarChart2, label: 'Statistiques' },
        { to: '/sales', icon: ShoppingCart, label: 'Ventes' },
        { to: '/deliveries', icon: Truck, label: 'Suivi Dépotage' },
        { to: '/stock', icon: Package, label: 'Stock' },
        { to: '/reports', icon: BarChart3, label: 'Rapports' },
        { to: '/profile', icon: User, label: 'Profil' },
    ];



    // ... imports

    const handleSaleSuccess = () => {
        setRefreshTrigger(prev => prev + 1);
        setIsSalesModalOpen(false);
    };

    const handleRefresh = async () => {
        setRefreshTrigger(prev => prev + 1);
        // Simulate a small delay for visual feedback
        await new Promise(resolve => setTimeout(resolve, 1000));
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    // Auto-logout on inactivity
    useEffect(() => {
        const TIMEOUT_DURATION = 15 * 60 * 1000; // 15 minutes
        let logoutTimer;

        const resetTimer = () => {
            if (logoutTimer) clearTimeout(logoutTimer);
            logoutTimer = setTimeout(() => {
                handleLogout();
            }, TIMEOUT_DURATION);
        };

        // Events to listen for
        const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];

        // Attach listeners
        events.forEach(event => {
            document.addEventListener(event, resetTimer);
        });

        // Initial start
        resetTimer();

        // Cleanup
        return () => {
            if (logoutTimer) clearTimeout(logoutTimer);
            events.forEach(event => {
                document.removeEventListener(event, resetTimer);
            });
        };
    }, [navigate, handleLogout]);

    return (
        <div className="min-h-screen bg-bg-main text-text-main flex flex-col md:flex-row font-sans">
            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between p-4 bg-white shadow-sm sticky top-0 z-30">
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 -ml-2 text-text-muted hover:bg-gray-50 rounded-lg transition-colors"
                >
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>

                <h1 className="font-bold text-lg bg-gradient-purple bg-clip-text text-transparent">Suivi CH Affaire</h1>

                <div className="w-10"></div> {/* Spacer to center title */}
            </div>

            {/* Mobile FAB for New Sale */}
            <button
                onClick={() => setIsSalesModalOpen(true)}
                className="md:hidden fixed bottom-6 right-6 z-40 p-4 bg-gradient-purple text-white rounded-full shadow-lg shadow-purple-200 active:scale-95 transition-transform hover:scale-105 flex items-center justify-center"
                aria-label="Nouvelle vente"
            >
                <PlusCircle size={28} />
            </button>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="md:hidden fixed inset-0 bg-white z-10 pt-20 px-4">
                    <nav className="flex flex-col gap-2">
                        {navItems.map((item) => (
                            <NavItem
                                key={item.to}
                                {...item}
                                active={location.pathname === item.to}
                                onClick={() => setIsMobileMenuOpen(false)}
                            />
                        ))}
                        <div className="h-px bg-gray-100 my-2"></div>
                        <NavItem
                            isButton
                            icon={LogOut}
                            label="Déconnexion"
                            onClick={handleLogout}
                        />
                    </nav>
                </div>
            )}

            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col w-72 h-screen sticky top-0 p-4 bg-sidebar-bg shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10 overflow-y-auto">
                <div className="mb-6 px-1 flex flex-col gap-4">
                    <div className="flex items-center justify-center py-1">
                        <img src="/logo.png" alt="Petrom Logo" className="h-16 w-auto object-contain drop-shadow-sm" />
                    </div>

                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1">
                        <div className="flex flex-col gap-3">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-1 h-3 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Station</div>
                                </div>
                                <div className="text-sm font-bold text-gray-900 pl-3">ISTIRAHA PEPEINIERE</div>
                            </div>
                            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-1 h-3 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Gérant</div>
                                </div>
                                <div className="text-sm font-bold text-gray-900 pl-3">ABDELALI LYOUSSEFI</div>
                            </div>
                        </div>
                    </div>
                </div>

                <nav className="flex flex-col gap-2 flex-1">
                    <button
                        onClick={() => setIsSalesModalOpen(true)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium group text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 mb-2"
                    >
                        <PlusCircle size={20} className="transition-transform duration-200 group-hover:scale-110" />
                        <span>Nouvelle Vente</span>
                    </button>
                    {navItems.map((item) => (
                        <NavItem
                            key={item.to}
                            {...item}
                            active={location.pathname === item.to}
                        />
                    ))}
                </nav>

                <div className="mt-auto space-y-4 pt-4">
                    <div className="p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1">
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-xs font-medium text-gray-400">Statut système</div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-full border border-emerald-100 shadow-sm">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">En ligne</span>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all duration-200 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-500 hover:text-white hover:shadow-lg hover:shadow-red-200 group"
                        >
                            <LogOut size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                            <span>Déconnexion</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-8 overflow-auto" id="main-content">
                <PullToRefresh onRefresh={handleRefresh} className="h-full">
                    <div className="max-w-7xl mx-auto min-h-[calc(100vh-4rem)]">
                        <Outlet context={{ refreshTrigger }} />
                    </div>
                </PullToRefresh>
            </main>

            <SalesEntry
                isOpen={isSalesModalOpen}
                onClose={() => setIsSalesModalOpen(false)}
                onSuccess={handleSaleSuccess}
            />
            <UpdateNotification />
        </div>
    );
}
