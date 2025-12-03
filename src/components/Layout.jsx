import React, { useState } from 'react';
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, BarChart3, Menu, X, PlusCircle, LogOut, User } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import SalesEntry from './SalesEntry';
import { supabase } from '../lib/supabase';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// eslint-disable-next-line no-unused-vars
const NavItem = ({ to, icon: IconComponent, label, active, onClick, isButton, onLogout }) => {
    if (isButton) {
        return (
            <button
                onClick={onLogout}
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
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/sales', icon: ShoppingCart, label: 'Ventes' },
        { to: '/stock', icon: Package, label: 'Stock' },
        { to: '/reports', icon: BarChart3, label: 'Rapports' },
        { to: '/profile', icon: User, label: 'Profil' },
    ];

    const handleSaleSuccess = () => {
        setRefreshTrigger(prev => prev + 1);
        setIsSalesModalOpen(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

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
                            onLogout={handleLogout}
                        />
                    </nav>
                </div>
            )}

            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col w-72 h-screen sticky top-0 p-6 bg-sidebar-bg shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
                <div className="mb-10 px-2 flex flex-col gap-4">
                    <div className="flex items-center justify-center">
                        <img src="/logo.png" alt="Petrom Logo" className="h-24 w-auto object-contain" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">Station</div>
                        <div className="text-sm font-bold text-text-main leading-tight">ISTIRAHA PEPEINIERE</div>

                        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mt-2">Gérant</div>
                        <div className="text-sm font-bold text-text-main leading-tight">ABDELALI LYOUSSEFI</div>
                    </div>
                </div>

                <button
                    onClick={() => setIsSalesModalOpen(true)}
                    className="mb-8 w-full flex items-center justify-center gap-2 bg-gradient-dark text-white py-3.5 rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 font-medium shadow-md group"
                >
                    <PlusCircle size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                    <span>Nouvelle Vente</span>
                </button>

                <nav className="flex flex-col gap-2 flex-1">
                    {navItems.map((item) => (
                        <NavItem
                            key={item.to}
                            {...item}
                            active={location.pathname === item.to}
                        />
                    ))}
                </nav>

                <div className="mt-auto">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium text-red-500 hover:bg-red-50 group mb-4"
                    >
                        <LogOut size={20} className="transition-transform duration-200 group-hover:scale-110" />
                        <span>Déconnexion</span>
                    </button>

                    <div className="p-4 bg-bg-main rounded-xl">
                        <div className="text-xs font-medium text-text-muted mb-2">Statut du système</div>
                        <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            En ligne
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-8 overflow-auto">
                <div className="max-w-7xl mx-auto">
                    <Outlet context={{ refreshTrigger }} />
                </div>
            </main>

            <SalesEntry
                isOpen={isSalesModalOpen}
                onClose={() => setIsSalesModalOpen(false)}
                onSuccess={handleSaleSuccess}
            />
        </div>
    );
}
