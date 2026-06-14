import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { 
    CreditCard, Plus, Trash2, Calendar, FileText, CheckCircle, AlertTriangle, 
    X, ShieldAlert, Sparkles, Receipt, RefreshCw, Settings, TrendingUp, 
    TrendingDown, Search, Info, Save, DollarSign, Droplet, ShoppingBag, BarChart3, Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatPrice, formatNumber } from '../utils/formatters';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
    ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';

const CATEGORIES = [
    { value: 'Loyer', label: 'Loyer', color: 'bg-blue-50 text-blue-700 border-blue-100' },
    { value: 'Electricite', label: 'Électricité', color: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
    { value: 'Eau', label: 'Eau', color: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
    { value: 'Salaires', label: 'Salaires', color: 'bg-purple-50 text-purple-700 border-purple-100' },
    { value: 'Taxes', label: 'Taxes et Impôts', color: 'bg-red-50 text-red-700 border-red-100' },
    { value: 'Assurances', label: 'Assurances', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { value: 'Entretien', label: 'Entretien & Réparations', color: 'bg-orange-50 text-orange-700 border-orange-100' },
    { value: 'Fournitures', label: 'Fournitures', color: 'bg-pink-50 text-pink-700 border-pink-100' },
    { value: 'Autre', label: 'Autre', color: 'bg-gray-50 text-gray-700 border-gray-100' }
];

const PAYMENT_METHODS = [
    { value: 'VIREMENT', label: 'Virement' },
    { value: 'PRELEVEMENT', label: 'Prélèvement' },
    { value: 'ESPECES', label: 'Espèces' },
    { value: 'CHEQUE', label: 'Chèque' }
];

const UNIFIED_SQL = `-- Exécutez ce script dans le SQL Editor de Supabase pour activer les fonctionnalités de Charges et de Marge Brute.

-- 1. Table des Charges d'Exploitation (si manquante)
CREATE TABLE IF NOT EXISTS public.operating_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Loyer', 'Electricite', 'Eau', 'Salaires', 'Taxes', 'Assurances', 'Entretien', 'Fournitures', 'Autre')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('VIREMENT', 'PRELEVEMENT', 'ESPECES', 'CHEQUE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.operating_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users on operating_expenses" ON public.operating_expenses;
CREATE POLICY "Enable all access for authenticated users on operating_expenses" ON public.operating_expenses
    FOR ALL USING (true) WITH CHECK (true);

-- 2. Ajout de la colonne purchase_price pour les lubrifiants (si manquante)
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10, 2) DEFAULT 0;

-- 3. Table des prix carburants (si manquante)
CREATE TABLE IF NOT EXISTS public.fuel_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    fuel_type TEXT NOT NULL CHECK (fuel_type IN ('Gasoil', 'SSP')),
    purchase_price NUMERIC(10, 2) NOT NULL CHECK (purchase_price >= 0),
    sale_price NUMERIC(10, 2) NOT NULL CHECK (sale_price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (date, fuel_type)
);

ALTER TABLE public.fuel_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users on fuel_prices" ON public.fuel_prices;
CREATE POLICY "Enable all access for authenticated users on fuel_prices" 
    ON public.fuel_prices FOR ALL USING (true) WITH CHECK (true);`;

export default function OperatingExpenses() {
    // Tab state
    const [activeTab, setActiveTab] = useState('expenses'); // 'expenses' | 'prices' | 'margin'
    const [priceSubTab, setPriceSubTab] = useState('fuel'); // 'fuel' | 'lubricants'

    // Database Setup Verification
    const [dbSetup, setDbSetup] = useState({
        loading: true,
        operatingExpensesOk: false,
        fuelPricesOk: false,
        articlesPurchasePriceOk: false
    });

    // Tab 1: Operating Expenses State
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
    const [selectedMonthFilter, setSelectedMonthFilter] = useState('');
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        category: 'Loyer',
        amount: '',
        description: '',
        payment_method: 'VIREMENT'
    });

    // Tab 2: Prices Config State
    // Fuel Prices
    const [fuelPrices, setFuelPrices] = useState([]);
    const [fuelPricesLoading, setFuelPricesLoading] = useState(false);
    const [fuelPriceForm, setFuelPriceForm] = useState({
        date: new Date().toISOString().split('T')[0],
        fuel_type: 'Gasoil',
        purchase_price: '',
        sale_price: ''
    });

    // Lubricants
    const [lubricants, setLubricants] = useState([]);
    const [lubricantsLoading, setLubricantsLoading] = useState(false);
    const [lubricantSearch, setLubricantSearch] = useState('');

    // Tab 3: Margin Calculation State
    const [marginStartDate, setMarginStartDate] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    });
    const [marginEndDate, setMarginEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });
    const [marginData, setMarginData] = useState({
        loading: false,
        gasoil: { liters: 0, revenue: 0, cost: 0, margin: 0, percent: 0 },
        ssp: { liters: 0, revenue: 0, cost: 0, margin: 0, percent: 0 },
        lubricants: { quantity: 0, revenue: 0, cost: 0, margin: 0, percent: 0 },
        total: { revenue: 0, cost: 0, margin: 0, percent: 0 }
    });

    // Check database structure
    const checkDatabaseSetup = async () => {
        setDbSetup(prev => ({ ...prev, loading: true }));
        let operatingExpensesOk = false;
        let fuelPricesOk = false;
        let articlesPurchasePriceOk = false;

        try {
            const { error: expError } = await supabase
                .from('operating_expenses')
                .select('id')
                .limit(1);
            if (!expError || expError.code !== '42P01') {
                operatingExpensesOk = true;
            }
        } catch (e) {
            console.error(e);
        }

        try {
            const { error: fuelError } = await supabase
                .from('fuel_prices')
                .select('id')
                .limit(1);
            if (!fuelError || fuelError.code !== '42P01') {
                fuelPricesOk = true;
            }
        } catch (e) {
            console.error(e);
        }

        try {
            const { error: artError } = await supabase
                .from('articles')
                .select('purchase_price')
                .limit(1);
            if (!artError || artError.code !== '42703') {
                articlesPurchasePriceOk = true;
            }
        } catch (e) {
            console.error(e);
        }

        const setupStatus = {
            loading: false,
            operatingExpensesOk,
            fuelPricesOk,
            articlesPurchasePriceOk
        };
        setDbSetup(setupStatus);
        return setupStatus;
    };

    const initData = async () => {
        const status = await checkDatabaseSetup();
        if (status.operatingExpensesOk) {
            fetchExpenses();
        }
    };

    useEffect(() => {
        initData();
    }, []);

    // Load data based on active tabs
    useEffect(() => {
        if (!dbSetup.operatingExpensesOk || !dbSetup.fuelPricesOk || !dbSetup.articlesPurchasePriceOk) return;

        if (activeTab === 'expenses') {
            fetchExpenses();
        } else if (activeTab === 'prices') {
            if (priceSubTab === 'fuel') {
                fetchFuelPrices();
            } else {
                fetchLubricants();
            }
        } else if (activeTab === 'margin') {
            calculateMargins();
        }
    }, [activeTab, priceSubTab, marginStartDate, marginEndDate]);

    // Tab 1: Fetch General Expenses
    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('operating_expenses')
                .select('*')
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;
            setExpenses(data || []);
        } catch (error) {
            console.error('Error fetching expenses:', error);
        } finally {
            setLoading(false);
        }
    };

    // Tab 1: Add general expense
    const handleSubmitExpense = async (e) => {
        e.preventDefault();
        if (!formData.amount || Number(formData.amount) <= 0) {
            alert('Veuillez entrer un montant valide');
            return;
        }

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('operating_expenses')
                .insert({
                    date: formData.date,
                    category: formData.category,
                    amount: Number(formData.amount),
                    description: formData.description,
                    payment_method: formData.payment_method
                });

            if (error) throw error;

            setFormData({
                date: new Date().toISOString().split('T')[0],
                category: 'Loyer',
                amount: '',
                description: '',
                payment_method: 'VIREMENT'
            });
            setShowAddModal(false);
            fetchExpenses();
        } catch (error) {
            console.error('Error adding expense:', error);
            alert("Erreur lors de l'enregistrement de la charge");
        } finally {
            setSubmitting(false);
        }
    };

    // Tab 1: Delete general expense
    const handleDeleteExpense = async (id) => {
        if (!window.confirm('Voulez-vous vraiment supprimer cette charge ?')) return;

        try {
            const { error } = await supabase
                .from('operating_expenses')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchExpenses();
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert('Erreur lors de la suppression');
        }
    };

    // Tab 2: Fetch Fuel Prices
    const fetchFuelPrices = async () => {
        setFuelPricesLoading(true);
        try {
            const { data, error } = await supabase
                .from('fuel_prices')
                .select('*')
                .order('date', { ascending: false })
                .order('fuel_type', { ascending: true });
            if (error) throw error;
            setFuelPrices(data || []);
        } catch (e) {
            console.error('Error fetching fuel prices:', e);
        } finally {
            setFuelPricesLoading(false);
        }
    };

    // Tab 2: Add/Upsert Fuel Price
    const handleSaveFuelPrice = async (e) => {
        e.preventDefault();
        if (!fuelPriceForm.purchase_price || Number(fuelPriceForm.purchase_price) < 0) {
            alert("Prix d'achat invalide");
            return;
        }
        if (!fuelPriceForm.sale_price || Number(fuelPriceForm.sale_price) < 0) {
            alert("Prix de vente invalide");
            return;
        }

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('fuel_prices')
                .upsert({
                    date: fuelPriceForm.date,
                    fuel_type: fuelPriceForm.fuel_type,
                    purchase_price: Number(fuelPriceForm.purchase_price),
                    sale_price: Number(fuelPriceForm.sale_price)
                }, { onConflict: 'date,fuel_type' });

            if (error) throw error;

            alert('Prix enregistré avec succès !');
            setFuelPriceForm(prev => ({
                ...prev,
                purchase_price: '',
                sale_price: ''
            }));
            fetchFuelPrices();
        } catch (e) {
            console.error('Error saving fuel price:', e);
            alert("Erreur lors de l'enregistrement du prix. Vérifiez si vous n'avez pas de doublons.");
        } finally {
            setSubmitting(false);
        }
    };

    // Tab 2: Delete Fuel Price
    const handleDeleteFuelPrice = async (id) => {
        if (!window.confirm("Voulez-vous supprimer ce tarif carburant ?")) return;
        try {
            const { error } = await supabase
                .from('fuel_prices')
                .delete()
                .eq('id', id);
            if (error) throw error;
            fetchFuelPrices();
        } catch (e) {
            console.error('Error deleting fuel price:', e);
            alert("Erreur lors de la suppression");
        }
    };

    // Tab 2: Fetch Lubricant articles list
    const fetchLubricants = async () => {
        setLubricantsLoading(true);
        try {
            const { data, error } = await supabase
                .from('articles')
                .select('*')
                .in('category', ['lubricant_piste', 'lubricant_bosch', 'Lubrifiants'])
                .order('name', { ascending: true });
            if (error) throw error;
            
            setLubricants((data || []).map(item => ({
                ...item,
                editPurchasePrice: item.purchase_price !== null && item.purchase_price !== undefined ? item.purchase_price : 0,
                editSalePrice: item.price !== null && item.price !== undefined ? item.price : 0,
                isSaving: false
            })));
        } catch (e) {
            console.error('Error fetching lubricants:', e);
        } finally {
            setLubricantsLoading(false);
        }
    };

    // Tab 2: Edit inline Lubricant price
    const handleLubricantFieldChange = (id, field, value) => {
        setLubricants(prev => prev.map(l => {
            if (l.id === id) {
                return { ...l, [field]: value };
            }
            return l;
        }));
    };

    // Tab 2: Save individual Lubricant prices
    const handleSaveLubricantPrice = async (article) => {
        setLubricants(prev => prev.map(l => l.id === article.id ? { ...l, isSaving: true } : l));
        try {
            const { error } = await supabase
                .from('articles')
                .update({
                    purchase_price: Number(article.editPurchasePrice),
                    price: Number(article.editSalePrice)
                })
                .eq('id', article.id);
            if (error) throw error;

            setLubricants(prev => prev.map(l => {
                if (l.id === article.id) {
                    return {
                        ...l,
                        purchase_price: Number(article.editPurchasePrice),
                        price: Number(article.editSalePrice),
                        isSaving: false
                    };
                }
                return l;
            }));
        } catch (e) {
            console.error('Error saving lubricant price:', e);
            alert("Erreur lors de la mise à jour des prix");
            setLubricants(prev => prev.map(l => l.id === article.id ? { ...l, isSaving: false } : l));
        }
    };

    // Tab 3: Calculate margins
    const calculateMargins = async () => {
        setMarginData(prev => ({ ...prev, loading: true }));
        try {
            // 1. Fetch fuel sales in date range
            let fuelQuery = supabase
                .from('fuel_sales')
                .select('*')
                .order('sale_date', { ascending: true });
            
            if (marginStartDate) {
                fuelQuery = fuelQuery.gte('sale_date', marginStartDate);
            }
            if (marginEndDate) {
                const end = new Date(marginEndDate);
                end.setHours(23, 59, 59, 999);
                fuelQuery = fuelQuery.lte('sale_date', end.toISOString());
            }
            
            const { data: fuelSalesData, error: fuelError } = await fuelQuery;
            if (fuelError) throw fuelError;

            // 2. Fetch all fuel prices
            const { data: fuelPricesData, error: pricesError } = await supabase
                .from('fuel_prices')
                .select('*')
                .order('date', { ascending: true });
            if (pricesError) throw pricesError;

            // 3. Fetch lubricant sales in date range
            let salesQuery = supabase
                .from('sales')
                .select('*, articles!inner(*)')
                .in('articles.category', ['lubricant_piste', 'lubricant_bosch', 'Lubrifiants'])
                .order('sale_date', { ascending: true });

            if (marginStartDate) {
                salesQuery = salesQuery.gte('sale_date', marginStartDate);
            }
            if (marginEndDate) {
                const end = new Date(marginEndDate);
                end.setHours(23, 59, 59, 999);
                salesQuery = salesQuery.lte('sale_date', end.toISOString());
            }

            const { data: lubSalesData, error: lubError } = await salesQuery;
            if (lubError) throw lubError;

            // Helper to match sale date to closest price
            const getFuelPrice = (saleDateStr, fuelType) => {
                const saleDate = saleDateStr.split('T')[0];
                let activePrice = null;
                for (const p of fuelPricesData) {
                    if (p.fuel_type === fuelType && p.date <= saleDate) {
                        activePrice = p;
                    }
                }
                return activePrice || { purchase_price: 0, sale_price: 0 };
            };

            // Compute aggregates - Gasoil
            let gasoilLiters = 0;
            let gasoilRevenue = 0;
            let gasoilCost = 0;

            // Compute aggregates - SSP
            let sspLiters = 0;
            let sspRevenue = 0;
            let sspCost = 0;

            fuelSalesData.forEach(sale => {
                const priceInfo = getFuelPrice(sale.sale_date, sale.fuel_type);
                const qty = Number(sale.quantity_liters);
                const purchasePrice = Number(priceInfo.purchase_price);
                const salePrice = Number(priceInfo.sale_price);

                const revenue = qty * salePrice;
                const cost = qty * purchasePrice;

                if (sale.fuel_type === 'Gasoil') {
                    gasoilLiters += qty;
                    gasoilRevenue += revenue;
                    gasoilCost += cost;
                } else if (sale.fuel_type === 'SSP') {
                    sspLiters += qty;
                    sspRevenue += revenue;
                    sspCost += cost;
                }
            });

            // Compute aggregates - Lubricants
            let lubQty = 0;
            let lubRevenue = 0;
            let lubCost = 0;

            lubSalesData.forEach(sale => {
                const qty = Number(sale.quantity);
                const revenue = Number(sale.total_price);
                const purchasePrice = Number(sale.articles?.purchase_price || 0);
                const cost = qty * purchasePrice;

                lubQty += qty;
                lubRevenue += revenue;
                lubCost += cost;
            });

            // Math Gasoil
            const gasoilMargin = gasoilRevenue - gasoilCost;
            const gasoilPercent = gasoilRevenue > 0 ? (gasoilMargin / gasoilRevenue) * 100 : 0;

            // Math SSP
            const sspMargin = sspRevenue - sspCost;
            const sspPercent = sspRevenue > 0 ? (sspMargin / sspRevenue) * 100 : 0;

            // Math Lubrifiants
            const lubMargin = lubRevenue - lubCost;
            const lubPercent = lubRevenue > 0 ? (lubMargin / lubRevenue) * 100 : 0;

            // Math Grand Total
            const totalRevenue = gasoilRevenue + sspRevenue + lubRevenue;
            const totalCost = gasoilCost + sspCost + lubCost;
            const totalMargin = totalRevenue - totalCost;
            const totalPercent = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

            setMarginData({
                loading: false,
                gasoil: { liters: gasoilLiters, revenue: gasoilRevenue, cost: gasoilCost, margin: gasoilMargin, percent: gasoilPercent },
                ssp: { liters: sspLiters, revenue: sspRevenue, cost: sspCost, margin: sspMargin, percent: sspPercent },
                lubricants: { quantity: lubQty, revenue: lubRevenue, cost: lubCost, margin: lubMargin, percent: lubPercent },
                total: { revenue: totalRevenue, cost: totalCost, margin: totalMargin, percent: totalPercent }
            });

        } catch (err) {
            console.error('Error calculating margins:', err);
            alert('Erreur lors du calcul des marges');
            setMarginData(prev => ({ ...prev, loading: false }));
        }
    };

    // Filter calculations for Tab 1
    const filteredExpenses = expenses.filter(exp => {
        const matchesCategory = selectedCategoryFilter ? exp.category === selectedCategoryFilter : true;
        const matchesMonth = selectedMonthFilter ? exp.date.startsWith(selectedMonthFilter) : true;
        return matchesCategory && matchesMonth;
    });

    const availableMonths = Array.from(
        new Set(expenses.map(exp => exp.date.substring(0, 7)))
    ).sort((a, b) => b.localeCompare(a));

    const totalAmount = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    
    const categoryTotals = filteredExpenses.reduce((acc, exp) => {
        acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount);
        return acc;
    }, {});

    const getCategoryDetails = (catValue) => {
        return CATEGORIES.find(c => c.value === catValue) || { label: catValue, color: 'bg-gray-100' };
    };

    // Filter lubricants by search input
    const filteredLubricants = lubricants.filter(l =>
        l.name.toLowerCase().includes(lubricantSearch.toLowerCase())
    );

    // Database check screen
    if (dbSetup.loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="animate-spin text-indigo-500" size={32} />
                    <span className="text-gray-500 font-semibold text-sm">Vérification de la configuration...</span>
                </div>
            </div>
        );
    }

    if (!dbSetup.operatingExpensesOk || !dbSetup.fuelPricesOk || !dbSetup.articlesPurchasePriceOk) {
        const missingResources = [];
        if (!dbSetup.operatingExpensesOk) missingResources.push('Table "operating_expenses"');
        if (!dbSetup.fuelPricesOk) missingResources.push('Table "fuel_prices"');
        if (!dbSetup.articlesPurchasePriceOk) missingResources.push('Colonne "purchase_price" dans la table "articles"');

        return (
            <div className="max-w-4xl mx-auto py-10 px-4">
                <div className="bg-orange-50 border border-orange-200 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col items-center text-center space-y-6">
                    <div className="p-4 bg-orange-100 text-orange-600 rounded-full">
                        <ShieldAlert size={36} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Configuration de base de données requise</h2>
                        <p className="text-gray-600 text-sm mt-2 max-w-lg">
                            Les ressources de base de données suivantes sont manquantes : <strong className="text-orange-700">{missingResources.join(', ')}</strong>.
                            Exécutez le script SQL ci-dessous dans le <strong>SQL Editor</strong> de Supabase pour configurer l'application.
                        </p>
                    </div>

                    <div className="w-full text-left bg-gray-900 rounded-2xl p-5 overflow-x-auto border border-gray-800 relative group">
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(UNIFIED_SQL);
                                alert('Code SQL copié ! Collez-le dans le SQL Editor de Supabase.');
                            }}
                            className="absolute top-3 right-3 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold px-3 py-1.5 rounded-lg transition-colors border border-gray-700"
                        >
                            Copier le SQL
                        </button>
                        <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">{UNIFIED_SQL}</pre>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={initData}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm font-semibold"
                        >
                            <RefreshCw size={18} />
                            Vérifier à nouveau
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <CreditCard className="text-purple-600" size={28} />
                            Charges & Marges Brutes
                        </h1>
                        <span className="text-[10px] font-extrabold uppercase bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                            <Sparkles size={10} /> Beta
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">Gérez vos charges d'exploitation, configurez les prix d'achat/vente et analysez votre marge brute.</p>
                </div>
                {activeTab === 'expenses' && (
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                    >
                        <Plus size={18} />
                        Saisir une Charge
                    </button>
                )}
            </div>

            {/* Tabs Navigation */}
            <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100 w-full md:w-fit">
                <button
                    onClick={() => setActiveTab('expenses')}
                    className={`flex items-center justify-center gap-2 px-5 py-2.5 text-sm rounded-xl font-bold transition-all ${
                        activeTab === 'expenses'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                    <Receipt size={16} />
                    Charges Générales
                </button>
                <button
                    onClick={() => setActiveTab('prices')}
                    className={`flex items-center justify-center gap-2 px-5 py-2.5 text-sm rounded-xl font-bold transition-all ${
                        activeTab === 'prices'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                    <Settings size={16} />
                    Configuration des Prix
                </button>
                <button
                    onClick={() => setActiveTab('margin')}
                    className={`flex items-center justify-center gap-2 px-5 py-2.5 text-sm rounded-xl font-bold transition-all ${
                        activeTab === 'margin'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                    <Activity size={16} />
                    Calcul de Marge Brute
                </button>
            </div>

            {/* TAB 1: OPERATING EXPENSES */}
            {activeTab === 'expenses' && (
                <>
                    {/* Stats Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Receipt size={64} className="text-indigo-600" />
                            </div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Total Charges Filtré</div>
                            <div className="text-3xl font-black text-gray-900">{formatPrice(totalAmount)}</div>
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-500"></div>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Calendar size={64} className="text-purple-600" />
                            </div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Nombre d'enregistrements</div>
                            <div className="text-3xl font-black text-gray-900">
                                {filteredExpenses.length} <span className="text-sm font-semibold text-gray-400">charges</span>
                            </div>
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-purple-500"></div>
                        </div>

                        {(() => {
                            const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
                            const topCat = sortedCats[0];
                            return (
                                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Sparkles size={64} className="text-orange-600" />
                                    </div>
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Poste le plus important</div>
                                    <div className="text-2xl font-black text-gray-900 truncate">
                                        {topCat ? `${getCategoryDetails(topCat[0]).label} (${formatPrice(topCat[1])})` : 'Aucun'}
                                    </div>
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-500"></div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Filter controls */}
                    <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-gray-400 uppercase">Filtrer par :</label>
                        </div>
                        
                        <select
                            value={selectedCategoryFilter}
                            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl p-2.5 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                        >
                            <option value="">Toutes les catégories</option>
                            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>

                        <select
                            value={selectedMonthFilter}
                            onChange={(e) => setSelectedMonthFilter(e.target.value)}
                            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl p-2.5 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                        >
                            <option value="">Tous les mois</option>
                            {availableMonths.map(m => {
                                const date = new Date(m + '-02');
                                return (
                                    <option key={m} value={m}>
                                        {format(date, 'MMMM yyyy', { locale: fr })}
                                    </option>
                                );
                            })}
                        </select>

                        {(selectedCategoryFilter || selectedMonthFilter) && (
                            <button
                                onClick={() => {
                                    setSelectedCategoryFilter('');
                                    setSelectedMonthFilter('');
                                }}
                                className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors ml-auto"
                            >
                                Réinitialiser les filtres
                            </button>
                        )}
                    </div>

                    {/* Expenses List */}
                    <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/70 border-b border-gray-100 text-gray-400 uppercase text-[10px] font-bold tracking-wider">
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Catégorie</th>
                                        <th className="px-6 py-4">Libellé / Description</th>
                                        <th className="px-6 py-4">Mode de Règlement</th>
                                        <th className="px-6 py-4 text-right">Montant (MAD)</th>
                                        <th className="px-6 py-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="6" className="text-center py-10">
                                                <div className="flex justify-center items-center gap-2 text-gray-400">
                                                    <RefreshCw className="animate-spin text-indigo-500" size={20} />
                                                    <span>Chargement...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredExpenses.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="text-center py-16 text-gray-400">
                                                <Receipt size={40} className="mx-auto mb-3 opacity-30" />
                                                <p className="text-sm">Aucune charge enregistrée correspondant aux critères.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredExpenses.map(exp => {
                                            const catInfo = getCategoryDetails(exp.category);
                                            const pMethod = PAYMENT_METHODS.find(p => p.value === exp.payment_method) || { label: exp.payment_method };
                                            
                                            return (
                                                <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm font-bold text-gray-700">
                                                        {format(new Date(exp.date), 'dd/MM/yyyy')}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${catInfo.color}`}>
                                                            {catInfo.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 font-medium text-gray-800">{exp.description || '—'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">{pMethod.label}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-base font-black text-gray-900">
                                                        {formatPrice(Number(exp.amount))}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <button
                                                            onClick={() => handleDeleteExpense(exp.id)}
                                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                            title="Supprimer"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* TAB 2: PRICE CONFIGURATION */}
            {activeTab === 'prices' && (
                <div className="space-y-6">
                    {/* Sub tabs */}
                    <div className="flex border-b border-gray-100 gap-4">
                        <button
                            onClick={() => setPriceSubTab('fuel')}
                            className={`flex items-center gap-2 py-3 px-1 border-b-2 font-bold text-sm transition-all -mb-px ${
                                priceSubTab === 'fuel'
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-400 hover:text-gray-700'
                            }`}
                        >
                            <Droplet size={16} />
                            Carburants (Gasoil / SSP)
                        </button>
                        <button
                            onClick={() => setPriceSubTab('lubricants')}
                            className={`flex items-center gap-2 py-3 px-1 border-b-2 font-bold text-sm transition-all -mb-px ${
                                priceSubTab === 'lubricants'
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-400 hover:text-gray-700'
                            }`}
                        >
                            <ShoppingBag size={16} />
                            Lubrifiants
                        </button>
                    </div>

                    {/* Sub-Tab 1: Fuel Price Settings */}
                    {priceSubTab === 'fuel' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Form Box */}
                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm h-fit space-y-4">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <Plus className="text-indigo-600" size={20} />
                                    Nouveau Tarif
                                </h3>
                                <p className="text-xs text-gray-400">Enregistrez un prix d'achat et de vente. Ces prix seront appliqués à toutes les ventes à partir de cette date.</p>

                                <form onSubmit={handleSaveFuelPrice} className="space-y-4 pt-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Date d'effet</label>
                                        <input
                                            type="date"
                                            required
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-3 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                                            value={fuelPriceForm.date}
                                            onChange={e => setFuelPriceForm({ ...fuelPriceForm, date: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Carburant</label>
                                        <select
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-3 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                                            value={fuelPriceForm.fuel_type}
                                            onChange={e => setFuelPriceForm({ ...fuelPriceForm, fuel_type: e.target.value })}
                                        >
                                            <option value="Gasoil">Gasoil</option>
                                            <option value="SSP">Sans Plomb (SSP)</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">Prix d'Achat (L)</label>
                                            <input
                                                type="number"
                                                required
                                                step="0.01"
                                                placeholder="0.00"
                                                className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-3 outline-none font-bold focus:ring-2 focus:ring-indigo-100 font-mono"
                                                value={fuelPriceForm.purchase_price}
                                                onChange={e => setFuelPriceForm({ ...fuelPriceForm, purchase_price: e.target.value })}
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">Prix de Vente (L)</label>
                                            <input
                                                type="number"
                                                required
                                                step="0.01"
                                                placeholder="0.00"
                                                className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-3 outline-none font-bold focus:ring-2 focus:ring-indigo-100 font-mono"
                                                value={fuelPriceForm.sale_price}
                                                onChange={e => setFuelPriceForm({ ...fuelPriceForm, sale_price: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        <Save size={16} />
                                        {submitting ? 'Enregistrement...' : 'Enregistrer le Prix'}
                                    </button>
                                </form>
                            </div>

                            {/* History Table */}
                            <div className="lg:col-span-2 bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <Calendar className="text-indigo-600" size={20} />
                                    Historique des tarifs carburants
                                </h3>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50/70 border-b border-gray-100 text-gray-400 uppercase text-[10px] font-bold tracking-wider">
                                                <th className="px-4 py-3">Date d'effet</th>
                                                <th className="px-4 py-3">Carburant</th>
                                                <th className="px-4 py-3 text-right">Prix Achat</th>
                                                <th className="px-4 py-3 text-right">Prix Vente</th>
                                                <th className="px-4 py-3 text-right">Marge Unitaire</th>
                                                <th className="px-4 py-3 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {fuelPricesLoading ? (
                                                <tr>
                                                    <td colSpan="6" className="text-center py-8">
                                                        <RefreshCw className="animate-spin text-indigo-500 mx-auto" size={18} />
                                                    </td>
                                                </tr>
                                            ) : fuelPrices.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="text-center py-10 text-gray-400 text-sm font-medium">
                                                        Aucun prix carburant configuré.
                                                    </td>
                                                </tr>
                                            ) : (
                                                fuelPrices.map(item => {
                                                    const unitMargin = Number(item.sale_price) - Number(item.purchase_price);
                                                    return (
                                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-4 py-3 whitespace-nowrap font-mono text-sm font-bold text-gray-700">
                                                                {format(new Date(item.date), 'dd/MM/yyyy')}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                                                                    item.fuel_type === 'Gasoil'
                                                                        ? 'bg-orange-50 text-orange-700 border border-orange-100'
                                                                        : 'bg-green-50 text-green-700 border border-green-100'
                                                                }`}>
                                                                    {item.fuel_type}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono text-sm font-medium text-gray-600">
                                                                {formatPrice(Number(item.purchase_price))}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono text-sm font-bold text-gray-900">
                                                                {formatPrice(Number(item.sale_price))}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono text-sm font-bold text-emerald-600">
                                                                +{formatPrice(unitMargin)}
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <button
                                                                    onClick={() => handleDeleteFuelPrice(item.id)}
                                                                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                                                                    title="Supprimer"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sub-Tab 2: Lubricants pricing list */}
                    {priceSubTab === 'lubricants' && (
                        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <ShoppingBag className="text-indigo-600" size={20} />
                                    Gestion des tarifs lubrifiants
                                </h3>

                                {/* Search Bar */}
                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Rechercher un lubrifiant..."
                                        className="w-full bg-gray-50 border border-gray-200 text-sm rounded-xl pl-9 pr-4 py-2 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                                        value={lubricantSearch}
                                        onChange={e => setLubricantSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/70 border-b border-gray-100 text-gray-400 uppercase text-[10px] font-bold tracking-wider">
                                            <th className="px-4 py-3">Nom de l'article</th>
                                            <th className="px-4 py-3">Catégorie</th>
                                            <th className="px-4 py-3 text-center">Stock Actuel</th>
                                            <th className="px-4 py-3 w-36 text-center">Prix Achat (MAD)</th>
                                            <th className="px-4 py-3 w-36 text-center">Prix Vente (MAD)</th>
                                            <th className="px-4 py-3 text-right">Marge Unitaire</th>
                                            <th className="px-4 py-3 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {lubricantsLoading ? (
                                            <tr>
                                                <td colSpan="7" className="text-center py-10">
                                                    <RefreshCw className="animate-spin text-indigo-500 mx-auto" size={20} />
                                                </td>
                                            </tr>
                                        ) : filteredLubricants.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="text-center py-10 text-gray-400 text-sm">
                                                    Aucun lubrifiant trouvé.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredLubricants.map(art => {
                                                const unitMargin = Number(art.editSalePrice) - Number(art.editPurchasePrice);
                                                const isChanged = Number(art.editPurchasePrice) !== (art.purchase_price || 0) || 
                                                                  Number(art.editSalePrice) !== (art.price || 0);

                                                return (
                                                    <tr key={art.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-4 py-3 text-sm font-bold text-gray-800">{art.name}</td>
                                                        <td className="px-4 py-3">
                                                            <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                                                {art.category === 'lubricant_piste' ? 'Lubrifiant Piste' : 
                                                                 art.category === 'lubricant_bosch' ? 'Lubrifiant Bosch' : 'Lubrifiants'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center font-mono font-bold text-sm text-gray-600">
                                                            {art.current_stock}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                className="w-24 text-center bg-gray-50 border border-gray-200 text-sm font-bold text-gray-800 rounded-lg py-1 px-2 focus:bg-white focus:ring-1 focus:ring-indigo-300 outline-none font-mono"
                                                                value={art.editPurchasePrice}
                                                                onChange={e => handleLubricantFieldChange(art.id, 'editPurchasePrice', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                className="w-24 text-center bg-gray-50 border border-gray-200 text-sm font-bold text-gray-800 rounded-lg py-1 px-2 focus:bg-white focus:ring-1 focus:ring-indigo-300 outline-none font-mono"
                                                                value={art.editSalePrice}
                                                                onChange={e => handleLubricantFieldChange(art.id, 'editSalePrice', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className={`px-4 py-3 text-right font-mono text-sm font-bold ${
                                                            unitMargin >= 0 ? 'text-emerald-600' : 'text-red-500'
                                                        }`}>
                                                            {unitMargin >= 0 ? '+' : ''}{formatPrice(unitMargin)}
                                                        </td>
                                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                                            <button
                                                                onClick={() => handleSaveLubricantPrice(art)}
                                                                disabled={art.isSaving || !isChanged}
                                                                className={`p-2 rounded-xl transition-all ${
                                                                    isChanged 
                                                                        ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:shadow-sm' 
                                                                        : 'text-gray-300 cursor-not-allowed'
                                                                }`}
                                                                title="Enregistrer"
                                                            >
                                                                {art.isSaving ? (
                                                                    <RefreshCw size={16} className="animate-spin text-indigo-500" />
                                                                ) : (
                                                                    <Save size={16} />
                                                                )}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: GROSS MARGIN CALCULATIONS */}
            {activeTab === 'margin' && (
                <div className="space-y-6">
                    {/* Filters & Actions */}
                    <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-gray-400 uppercase">Période d'analyse :</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl p-2 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                                    value={marginStartDate}
                                    onChange={e => setMarginStartDate(e.target.value)}
                                />
                                <span className="text-gray-400 font-bold">-</span>
                                <input
                                    type="date"
                                    className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl p-2 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                                    value={marginEndDate}
                                    onChange={e => setMarginEndDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            onClick={calculateMargins}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all font-semibold text-sm"
                        >
                            <RefreshCw size={16} className={marginData.loading ? 'animate-spin' : ''} />
                            Recalculer
                        </button>
                    </div>

                    {marginData.loading ? (
                        <div className="flex justify-center items-center py-20">
                            <div className="flex flex-col items-center gap-2">
                                <RefreshCw className="animate-spin text-indigo-500" size={32} />
                                <span className="text-gray-400 text-sm font-semibold">Calcul des marges en cours...</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* KPI Layout */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Chiffre d'Affaires</div>
                                    <div className="text-3xl font-black text-gray-900">{formatPrice(marginData.total.revenue)}</div>
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500"></div>
                                </div>

                                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Coût d'Achat Global</div>
                                    <div className="text-3xl font-black text-gray-900">{formatPrice(marginData.total.cost)}</div>
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-red-400"></div>
                                </div>

                                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Marge Brute Globale</div>
                                    <div className="text-3xl font-black text-emerald-600">{formatPrice(marginData.total.margin)}</div>
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500"></div>
                                </div>

                                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Taux de Marge Moyen</div>
                                    <div className="text-3xl font-black text-purple-600">{formatNumber(marginData.total.percent, 2)} %</div>
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-purple-500"></div>
                                </div>
                            </div>

                            {/* Alert for configured price mismatch */}
                            {(marginData.total.revenue > 0 && marginData.total.cost === 0) && (
                                <div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-2xl p-4 text-xs font-semibold flex items-center gap-2">
                                    <Info size={16} />
                                    <span>Attention : Le coût d'achat calculé est de 0 MAD. Veuillez vous assurer que vous avez configuré des prix d'achat dans l'onglet <strong>Configuration des Prix</strong>.</span>
                                </div>
                            )}

                            {/* Analytical Table & Charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Table breakdown */}
                                <div className="lg:col-span-2 bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <FileText className="text-indigo-600" size={20} />
                                        Détails de Marge par Produit
                                    </h3>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50/70 border-b border-gray-100 text-gray-400 uppercase text-[10px] font-bold tracking-wider">
                                                    <th className="px-4 py-3">Produit / Catégorie</th>
                                                    <th className="px-4 py-3 text-right">Quantité Vendue</th>
                                                    <th className="px-4 py-3 text-right">Chiffre d'Affaires</th>
                                                    <th className="px-4 py-3 text-right">Coût d'Achat</th>
                                                    <th className="px-4 py-3 text-right">Marge Brute</th>
                                                    <th className="px-4 py-3 text-right">Marge %</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 font-medium text-sm text-gray-800">
                                                {/* Gasoil */}
                                                <tr className="hover:bg-slate-50/50">
                                                    <td className="px-4 py-3 font-bold flex items-center gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                                                        Gasoil
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-600">{formatNumber(marginData.gasoil.liters)} L</td>
                                                    <td className="px-4 py-3 text-right font-mono">{formatPrice(marginData.gasoil.revenue)}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-gray-500">{formatPrice(marginData.gasoil.cost)}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">{formatPrice(marginData.gasoil.margin)}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600">{formatNumber(marginData.gasoil.percent, 2)} %</td>
                                                </tr>

                                                {/* SSP */}
                                                <tr className="hover:bg-slate-50/50">
                                                    <td className="px-4 py-3 font-bold flex items-center gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                                                        Sans Plomb (SSP)
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-600">{formatNumber(marginData.ssp.liters)} L</td>
                                                    <td className="px-4 py-3 text-right font-mono">{formatPrice(marginData.ssp.revenue)}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-gray-500">{formatPrice(marginData.ssp.cost)}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">{formatPrice(marginData.ssp.margin)}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600">{formatNumber(marginData.ssp.percent, 2)} %</td>
                                                </tr>

                                                {/* Lubricants */}
                                                <tr className="hover:bg-slate-50/50">
                                                    <td className="px-4 py-3 font-bold flex items-center gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                                                        Lubrifiants
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-600">{formatNumber(marginData.lubricants.quantity)} U</td>
                                                    <td className="px-4 py-3 text-right font-mono">{formatPrice(marginData.lubricants.revenue)}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-gray-500">{formatPrice(marginData.lubricants.cost)}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">{formatPrice(marginData.lubricants.margin)}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600">{formatNumber(marginData.lubricants.percent, 2)} %</td>
                                                </tr>

                                                {/* Grand Total */}
                                                <tr className="bg-gray-50 border-t border-gray-200">
                                                    <td className="px-4 py-3 font-black text-gray-900 uppercase">Total Général</td>
                                                    <td className="px-4 py-3 text-right font-mono"></td>
                                                    <td className="px-4 py-3 text-right font-mono font-black text-gray-900">{formatPrice(marginData.total.revenue)}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-black text-gray-900">{formatPrice(marginData.total.cost)}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-black text-emerald-700">{formatPrice(marginData.total.margin)}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-black text-purple-700">{formatNumber(marginData.total.percent, 2)} %</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Pie Chart visualization */}
                                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between h-[360px] lg:h-auto">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                            <BarChart3 className="text-indigo-600" size={20} />
                                            Parts de Marge Brute
                                        </h3>
                                        <p className="text-xs text-gray-400 mt-1">Répartition de la marge générée par chaque univers.</p>
                                    </div>

                                    {marginData.total.margin <= 0 ? (
                                        <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                                            <Info size={48} className="opacity-20 mb-2" />
                                            <span className="text-sm font-semibold">Aucune marge positive à afficher</span>
                                        </div>
                                    ) : (
                                        <div className="flex-1 min-h-[200px] relative flex items-center justify-center">
                                            <ResponsiveContainer width="100%" height={200}>
                                                <PieChart>
                                                    <Pie
                                                        data={[
                                                            { name: 'Gasoil', value: Math.max(0, marginData.gasoil.margin), color: '#F97316' },
                                                            { name: 'Sans Plomb', value: Math.max(0, marginData.ssp.margin), color: '#22C55E' },
                                                            { name: 'Lubrifiants', value: Math.max(0, marginData.lubricants.margin), color: '#6366F1' }
                                                        ].filter(item => item.value > 0)}
                                                        dataKey="value"
                                                        nameKey="name"
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={45}
                                                        outerRadius={70}
                                                        paddingAngle={4}
                                                    >
                                                        {[
                                                            { name: 'Gasoil', color: '#F97316' },
                                                            { name: 'Sans Plomb', color: '#22C55E' },
                                                            { name: 'Lubrifiants', color: '#6366F1' }
                                                        ].map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(value) => formatPrice(value)} />
                                                </PieChart>
                                            </ResponsiveContainer>

                                            {/* Custom Legends */}
                                            <div className="absolute bottom-2 flex justify-center gap-4 text-xs font-semibold">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                                                    <span>Gasoil</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                                                    <span>SSP</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                                                    <span>Lub.</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* General Expense Saisie Modal */}
            {showAddModal && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Receipt className="text-purple-600" size={20} />
                                Enregistrer une Charge
                            </h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitExpense} className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Date de Paiement</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-3 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Montant (MAD)</label>
                                    <input
                                        type="number"
                                        required
                                        placeholder="0.00"
                                        step="0.01"
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-3 outline-none font-bold focus:ring-2 focus:ring-indigo-100"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Catégorie</label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-3 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Mode de Règlement</label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-3 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                                        value={formData.payment_method}
                                        onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                                    >
                                        {PAYMENT_METHODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Libellé / Description</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Factures Lydec Mai 2026, Loyer Station..."
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-3 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {submitting ? 'Enregistrement...' : 'Enregistrer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
