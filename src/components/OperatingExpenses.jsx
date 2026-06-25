import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { 
    CreditCard, Plus, Trash2, Calendar, FileText, CheckCircle, AlertTriangle, 
    X, ShieldAlert, Sparkles, Receipt, RefreshCw, Settings, TrendingUp, 
    TrendingDown, Search, Info, Save, DollarSign, Droplet, ShoppingBag, BarChart3, Activity, UserCog, UserPlus
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatPrice, formatNumber } from '../utils/formatters';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
    ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { useToast } from './ui/Toast';

const CATEGORIES = [
    { value: 'Loyer', label: 'Loyer / Redevance foncière', color: 'bg-blue-50 text-blue-700 border-blue-100', hex: '#3B82F6' },
    { value: 'Electricite', label: 'Électricité', color: 'bg-yellow-50 text-yellow-700 border-yellow-100', hex: '#EAB308' },
    { value: 'Eau', label: 'Eau & Assainissement', color: 'bg-cyan-50 text-cyan-700 border-cyan-100', hex: '#06B6D4' },
    { value: 'Salaires', label: 'Salaires & CNSS (Fixe)', color: 'bg-purple-50 text-purple-700 border-purple-100', hex: '#A855F7' },
    { value: 'Interim', label: 'Personnel Intérimaire (Flexible)', color: 'bg-rose-50 text-rose-700 border-rose-100', hex: '#F43F5E' },
    { value: 'Taxes', label: 'Impôts & Taxes Locales', color: 'bg-red-50 text-red-700 border-red-100', hex: '#EF4444' },
    { value: 'Assurances', label: 'Assurances', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', hex: '#10B981' },
    { value: 'Entretien', label: 'Entretien & Réparations', color: 'bg-orange-50 text-orange-700 border-orange-100', hex: '#F97316' },
    { value: 'Fournitures', label: 'Fournitures & Consommables', color: 'bg-pink-50 text-pink-700 border-pink-100', hex: '#EC4899' },
    { value: 'Commissions', label: 'Commissions TPE & Cartes', color: 'bg-amber-50 text-amber-700 border-amber-100', hex: '#D97706' },
    { value: 'Securite', label: 'Sécurité & Gardiennage', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', hex: '#4F46E5' },
    { value: 'Telecom', label: 'Télécoms & Internet', color: 'bg-sky-50 text-sky-700 border-sky-100', hex: '#0284C7' },
    { value: 'Comptabilite', label: 'Honoraires Comptables & Juridiques', color: 'bg-violet-50 text-violet-700 border-violet-100', hex: '#7C3AED' },
    { value: 'Marketing', label: 'Publicité & Marketing', color: 'bg-teal-50 text-teal-700 border-teal-100', hex: '#0D9488' },
    { value: 'Transport', label: 'Transport & Logistique', color: 'bg-lime-50 text-lime-700 border-lime-100', hex: '#65A30D' },
    { value: 'Nettoyage', label: 'Nettoyage & Assainissement', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', hex: '#059669' },
    { value: 'Autre', label: 'Autre / Divers', color: 'bg-gray-50 text-gray-700 border-gray-100', hex: '#6B7280' }
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
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('VIREMENT', 'PRELEVEMENT', 'ESPECES', 'CHEQUE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Suppression de la contrainte CHECK de catégorie si elle existe pour supporter toutes les catégories opérationnelles
ALTER TABLE public.operating_expenses DROP CONSTRAINT IF EXISTS operating_expenses_category_check;

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
    ON public.fuel_prices FOR ALL USING (true) WITH CHECK (true);

-- 4. Table des coûts de stock mensuels (Shop, Café, Bosch Service)
CREATE TABLE IF NOT EXISTS public.monthly_stock_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month TEXT NOT NULL UNIQUE, -- format YYYY-MM
    shop_cogs NUMERIC(12, 2) DEFAULT 0 CHECK (shop_cogs >= 0),
    cafe_cogs NUMERIC(12, 2) DEFAULT 0 CHECK (cafe_cogs >= 0),
    bosch_cogs NUMERIC(12, 2) DEFAULT 0 CHECK (bosch_cogs >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.monthly_stock_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users on monthly_stock_costs" ON public.monthly_stock_costs;
CREATE POLICY "Enable all access for authenticated users on monthly_stock_costs" 
    ON public.monthly_stock_costs FOR ALL USING (true) WITH CHECK (true);

-- 5. Table des employés pour la gestion de la masse salariale (ou mise à jour si elle existe déjà)
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contract_type TEXT NOT NULL DEFAULT 'FIXE' CHECK (contract_type IN ('FIXE', 'INTERIM')),
    base_salary NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Si la table existait déjà, on s'assure d'ajouter les colonnes indispensables
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'FIXE';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS base_salary NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Mettre à jour les anciennes lignes pour éviter les valeurs NULL
UPDATE public.employees SET contract_type = 'FIXE' WHERE contract_type IS NULL;
UPDATE public.employees SET base_salary = 0 WHERE base_salary IS NULL;
UPDATE public.employees SET is_active = true WHERE is_active IS NULL;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users on employees" ON public.employees;
CREATE POLICY "Enable all access for authenticated users on employees" 
    ON public.employees FOR ALL USING (true) WITH CHECK (true);`;

const getMonthsInRange = (startStr, endStr) => {
    if (!startStr || !endStr) return [];
    const start = new Date(startStr);
    const end = new Date(endStr);
    const months = [];
    
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
        const yStr = current.getFullYear();
        const mStr = String(current.getMonth() + 1).padStart(2, '0');
        months.push(`${yStr}-${mStr}`);
        current.setMonth(current.getMonth() + 1);
    }
    return months;
};

const getMonthOverlapScale = (monthStr, startDateStr, endDateStr) => {
    if (!monthStr || !startDateStr || !endDateStr) return 0.0;
    
    const [year, month] = monthStr.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0); // last day of month
    
    const queryStart = new Date(startDateStr + 'T00:00:00');
    const queryEnd = new Date(endDateStr + 'T00:00:00');
    
    const intersectStart = new Date(Math.max(monthStart.getTime(), queryStart.getTime()));
    const intersectEnd = new Date(Math.min(monthEnd.getTime(), queryEnd.getTime()));
    
    if (intersectStart > intersectEnd) return 0.0;
    
    const totalDaysInMonth = monthEnd.getDate();
    const intersectDays = Math.round((intersectEnd.getTime() - intersectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    return Math.min(1.0, Math.max(0.0, intersectDays / totalDaysInMonth));
};

export default function OperatingExpenses() {
    const { success, error, info } = useToast();
    // Tab state
    const [activeTab, setActiveTab] = useState('prices'); // 'prices' | 'monthly_cogs' | 'expenses' | 'margin' | 'ebit'
    const [priceSubTab, setPriceSubTab] = useState('fuel'); // 'fuel' | 'lubricants'

    // Database Setup Verification
    const [dbSetup, setDbSetup] = useState({
        loading: true,
        operatingExpensesOk: false,
        fuelPricesOk: false,
        articlesPurchasePriceOk: false,
        monthlyStockCostsOk: false,
        employeesOk: false
    });

    // Tab 3: Employees State (for payroll generator)
    const [employees, setEmployees] = useState([]);
    const [employeesLoading, setEmployeesLoading] = useState(false);
    const [employeeForm, setEmployeeForm] = useState({
        name: '',
        contract_type: 'FIXE',
        base_salary: ''
    });
    const [expensesSubTab, setExpensesSubTab] = useState('list'); // 'list' | 'employees'
    const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().substring(0, 7)); // 'YYYY-MM'
    const [payrollAdjustments, setPayrollAdjustments] = useState({}); // id -> value
    const [showPayrollConfirmModal, setShowPayrollConfirmModal] = useState(false);
    const [payrollConfirmData, setPayrollConfirmData] = useState({
        formattedMonth: '',
        totalFixe: 0,
        totalInterim: 0,
        payrollDate: ''
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
        gasoil_purchase: '',
        gasoil_sale: '',
        ssp_purchase: '',
        ssp_sale: ''
    });

    // Lubricants
    const [lubricants, setLubricants] = useState([]);
    const [lubricantsLoading, setLubricantsLoading] = useState(false);
    const [lubricantSearch, setLubricantSearch] = useState('');

    // Tab 2: Stocks Vendus State
    const [monthlyCogs, setMonthlyCogs] = useState([]);
    const [monthlyCogsLoading, setMonthlyCogsLoading] = useState(false);
    const [monthlyCogsForm, setMonthlyCogsForm] = useState({
        month: new Date().toISOString().substring(0, 7), // 'YYYY-MM'
        shop_cogs: '',
        cafe_cogs: '',
        bosch_cogs: ''
    });

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
        shop: { revenue: 0, cost: 0, margin: 0, percent: 0 },
        cafe: { revenue: 0, cost: 0, margin: 0, percent: 0 },
        bosch: { revenue: 0, cost: 0, margin: 0, percent: 0 },
        total: { revenue: 0, cost: 0, margin: 0, percent: 0 },
        expensesTotal: 0,
        expensesByCategory: {}
    });

    // Check database structure
    const checkDatabaseSetup = async () => {
        setDbSetup(prev => ({ ...prev, loading: true }));
        let operatingExpensesOk = false;
        let fuelPricesOk = false;
        let articlesPurchasePriceOk = false;
        let monthlyStockCostsOk = false;

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

        try {
            const { error: stockError } = await supabase
                .from('monthly_stock_costs')
                .select('id')
                .limit(1);
            if (!stockError || stockError.code !== '42P01') {
                monthlyStockCostsOk = true;
            }
        } catch (e) {
            console.error(e);
        }

        let employeesOk = false;
        try {
            const { error: empError } = await supabase
                .from('employees')
                .select('id, base_salary, is_active')
                .limit(1);
            if (!empError) {
                employeesOk = true;
            } else {
                console.warn('Employees table check failed:', empError);
            }
        } catch (e) {
            console.error(e);
        }

        const setupStatus = {
            loading: false,
            operatingExpensesOk,
            fuelPricesOk,
            articlesPurchasePriceOk,
            monthlyStockCostsOk,
            employeesOk
        };
        setDbSetup(setupStatus);
        return setupStatus;
    };

    const initData = async () => {
        await checkDatabaseSetup();
    };

    useEffect(() => {
        initData();
    }, []);

    // Load data based on active tabs
    useEffect(() => {
        if (!dbSetup.operatingExpensesOk || !dbSetup.fuelPricesOk || !dbSetup.articlesPurchasePriceOk || !dbSetup.monthlyStockCostsOk || !dbSetup.employeesOk) return;

        if (activeTab === 'expenses') {
            fetchExpenses();
            fetchEmployees();
        } else if (activeTab === 'prices') {
            if (priceSubTab === 'fuel') {
                fetchFuelPrices();
            } else {
                fetchLubricants();
            }
        } else if (activeTab === 'monthly_cogs') {
            fetchMonthlyCogs();
        } else if (activeTab === 'margin' || activeTab === 'ebit') {
            calculateMargins();
        }
    }, [activeTab, priceSubTab, marginStartDate, marginEndDate, dbSetup.operatingExpensesOk, dbSetup.fuelPricesOk, dbSetup.articlesPurchasePriceOk, dbSetup.monthlyStockCostsOk]);

    // Tab 1: Fetch General Expenses
    const fetchExpenses = async () => {
        setLoading(true);
        try {
            let allData = [];
            let page = 0;
            const pageSize = 1000;
            while (true) {
                const { data, error } = await supabase
                    .from('operating_expenses')
                    .select('*')
                    .order('date', { ascending: false })
                    .order('created_at', { ascending: false })
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;
                if (!data || data.length === 0) break;
                allData.push(...data);
                if (data.length < pageSize) break;
                page++;
            }
            setExpenses(allData);
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

    // Tab 3: Employees management CRUD (Option A)
    const fetchEmployees = async () => {
        setEmployeesLoading(true);
        try {
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .order('name', { ascending: true });
            if (error) throw error;
            setEmployees(data || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
        } finally {
            setEmployeesLoading(false);
        }
    };

    const handleAddEmployee = async (e) => {
        e.preventDefault();
        if (!employeeForm.name.trim()) {
            alert("Veuillez entrer le nom de l'employé");
            return;
        }
        if (!employeeForm.base_salary || Number(employeeForm.base_salary) < 0) {
            alert('Veuillez entrer un salaire de base valide');
            return;
        }

        try {
            const { error } = await supabase
                .from('employees')
                .insert({
                    name: employeeForm.name.trim(),
                    contract_type: employeeForm.contract_type,
                    base_salary: Number(employeeForm.base_salary),
                    is_active: true
                });
            if (error) throw error;

            setEmployeeForm({
                name: '',
                contract_type: 'FIXE',
                base_salary: ''
            });
            fetchEmployees();
        } catch (error) {
            console.error('Error adding employee:', error);
            alert("Erreur lors de l'ajout de l'employé");
        }
    };

    const handleToggleEmployeeStatus = async (id, currentStatus) => {
        const statusToSet = currentStatus === undefined || currentStatus === null ? true : currentStatus;
        try {
            const { error } = await supabase
                .from('employees')
                .update({ is_active: !statusToSet })
                .eq('id', id);
            if (error) throw error;
            fetchEmployees();
        } catch (error) {
            console.error('Error toggling employee status:', error);
            alert('Erreur lors de la modification du statut');
        }
    };

    const handleDeleteEmployee = async (id) => {
        if (!window.confirm('Voulez-vous vraiment supprimer cet employé ?')) return;
        try {
            const { error } = await supabase
                .from('employees')
                .delete()
                .eq('id', id);
            if (error) throw error;
            fetchEmployees();
        } catch (error) {
            console.error('Error deleting employee:', error);
            alert("Erreur lors de la suppression de l'employé");
        }
    };

    const handleGenerateMonthlyPayroll = (e) => {
        e.preventDefault();
        
        const payrollDate = `${payrollMonth}-01`;
        let totalFixe = 0;
        let totalInterim = 0;
        
        const activeEmployees = employees.filter(emp => emp.is_active !== false);
        
        if (activeEmployees.length === 0) {
            alert('Aucun employé actif à rémunérer pour ce mois.');
            return;
        }
        
        activeEmployees.forEach(emp => {
            const adjustment = payrollAdjustments[emp.id];
            const salary = adjustment !== undefined && adjustment !== '' ? Number(adjustment) : (emp.base_salary ?? 0);
            const isFixe = emp.contract_type === 'FIXE' || emp.contract_type === 'CDI' || emp.contract_type === 'CDD' || emp.contract_type === 'Anapec';
            if (isFixe) {
                totalFixe += salary;
            } else {
                totalInterim += salary;
            }
        });

        if (totalFixe === 0 && totalInterim === 0) {
            alert('Le montant total de la paie est de 0 MAD.');
            return;
        }

        const formattedMonth = payrollMonth.split('-').reverse().join('/');
        setPayrollConfirmData({
            formattedMonth,
            totalFixe,
            totalInterim,
            payrollDate
        });
        setShowPayrollConfirmModal(true);
    };

    const executePayrollGeneration = async () => {
        setShowPayrollConfirmModal(false);
        try {
            const descriptions = [
                `Génération Auto - Paie CDI (${payrollMonth})`,
                `Génération Auto - Paie Intérim (${payrollMonth})`
            ];
            
            await supabase
                .from('operating_expenses')
                .delete()
                .in('description', descriptions);

            const newExpenses = [];
            if (payrollConfirmData.totalFixe > 0) {
                newExpenses.push({
                    date: payrollConfirmData.payrollDate,
                    category: 'Salaires',
                    amount: payrollConfirmData.totalFixe,
                    description: `Génération Auto - Paie CDI (${payrollMonth})`,
                    payment_method: 'VIREMENT'
                });
            }
            if (payrollConfirmData.totalInterim > 0) {
                newExpenses.push({
                    date: payrollConfirmData.payrollDate,
                    category: 'Interim',
                    amount: payrollConfirmData.totalInterim,
                    description: `Génération Auto - Paie Intérim (${payrollMonth})`,
                    payment_method: 'VIREMENT'
                });
            }

            const { error } = await supabase
                .from('operating_expenses')
                .insert(newExpenses);

            if (error) throw error;

            success('Masse salariale générée et synchronisée avec succès !');
            setPayrollAdjustments({});
            fetchExpenses();
            setExpensesSubTab('list');
        } catch (error) {
            console.error('Error generating payroll:', error);
            error('Erreur lors de la génération de la paie');
        }
    };

    // Tab 2: Fetch Fuel Prices
    const fetchFuelPrices = async () => {
        setFuelPricesLoading(true);
        try {
            let allData = [];
            let page = 0;
            const pageSize = 1000;
            while (true) {
                const { data, error } = await supabase
                    .from('fuel_prices')
                    .select('*')
                    .order('date', { ascending: false })
                    .order('fuel_type', { ascending: true })
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;
                if (!data || data.length === 0) break;
                allData.push(...data);
                if (data.length < pageSize) break;
                page++;
            }
            setFuelPrices(allData);
        } catch (e) {
            console.error('Error fetching fuel prices:', e);
        } finally {
            setFuelPricesLoading(false);
        }
    };

    // Tab 2: Add/Upsert Fuel Price
    const handleSaveFuelPrice = async (e) => {
        e.preventDefault();
        const gasoilP = Number(fuelPriceForm.gasoil_purchase);
        const gasoilS = Number(fuelPriceForm.gasoil_sale);
        const sspP = Number(fuelPriceForm.ssp_purchase);
        const sspS = Number(fuelPriceForm.ssp_sale);

        if (isNaN(gasoilP) || gasoilP < 0 || isNaN(gasoilS) || gasoilS < 0) {
            alert("Veuillez entrer des prix d'achat et de vente valides pour le Gasoil.");
            return;
        }
        if (isNaN(sspP) || sspP < 0 || isNaN(sspS) || sspS < 0) {
            alert("Veuillez entrer des prix d'achat et de vente valides pour le Sans Plomb (SSP).");
            return;
        }

        setSubmitting(true);
        try {
            // Upsert Gasoil
            const { error: gError } = await supabase
                .from('fuel_prices')
                .upsert({
                    date: fuelPriceForm.date,
                    fuel_type: 'Gasoil',
                    purchase_price: gasoilP,
                    sale_price: gasoilS
                }, { onConflict: 'date,fuel_type' });

            if (gError) throw gError;

            // Upsert SSP
            const { error: sError } = await supabase
                .from('fuel_prices')
                .upsert({
                    date: fuelPriceForm.date,
                    fuel_type: 'SSP',
                    purchase_price: sspP,
                    sale_price: sspS
                }, { onConflict: 'date,fuel_type' });

            if (sError) throw sError;

            alert('Tarifs Gasoil & SSP enregistrés avec succès !');
            setFuelPriceForm(prev => ({
                ...prev,
                gasoil_purchase: '',
                gasoil_sale: '',
                ssp_purchase: '',
                ssp_sale: ''
            }));
            fetchFuelPrices();
        } catch (e) {
            console.error('Error saving fuel prices:', e);
            alert("Erreur lors de l'enregistrement des tarifs. Veuillez réessayer.");
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

    // Tab 2: Fetch Monthly Stock Costs (Cogs)
    const fetchMonthlyCogs = async () => {
        setMonthlyCogsLoading(true);
        try {
            const { data, error } = await supabase
                .from('monthly_stock_costs')
                .select('*')
                .order('month', { ascending: false });
            if (error) throw error;
            setMonthlyCogs(data || []);
        } catch (e) {
            console.error('Error fetching monthly cogs:', e);
        } finally {
            setMonthlyCogsLoading(false);
        }
    };

    // Tab 2: Save/Upsert Monthly Stock Costs
    const handleSaveMonthlyCogs = async (e) => {
        e.preventDefault();
        if (!monthlyCogsForm.month) {
            alert('Veuillez sélectionner un mois');
            return;
        }
        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('monthly_stock_costs')
                .upsert({
                    month: monthlyCogsForm.month,
                    shop_cogs: Number(monthlyCogsForm.shop_cogs || 0),
                    cafe_cogs: Number(monthlyCogsForm.cafe_cogs || 0),
                    bosch_cogs: Number(monthlyCogsForm.bosch_cogs || 0)
                }, { onConflict: 'month' });

            if (error) throw error;

            alert('Coûts de stock enregistrés avec succès !');
            setMonthlyCogsForm({
                month: new Date().toISOString().substring(0, 7),
                shop_cogs: '',
                cafe_cogs: '',
                bosch_cogs: ''
            });
            fetchMonthlyCogs();
        } catch (e) {
            console.error('Error saving monthly cogs:', e);
            alert("Erreur lors de l'enregistrement des coûts mensuels");
        } finally {
            setSubmitting(false);
        }
    };

    // Tab 2: Delete Monthly Stock Costs
    const handleDeleteMonthlyCogs = async (id) => {
        if (!window.confirm("Voulez-vous supprimer ces coûts mensuels ?")) return;
        try {
            const { error } = await supabase
                .from('monthly_stock_costs')
                .delete()
                .eq('id', id);
            if (error) throw error;
            fetchMonthlyCogs();
        } catch (e) {
            console.error('Error deleting monthly cogs:', e);
            alert("Erreur lors de la suppression");
        }
    };

    // Tab 3: Calculate margins
    const calculateMargins = async () => {
        setMarginData(prev => ({ ...prev, loading: true }));
        try {
            // 1. Fetch fuel sales in date range (paginated)
            let fuelSalesData = [];
            let fuelPage = 0;
            const pageSize = 1000;
            while (true) {
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
                
                fuelQuery = fuelQuery.range(fuelPage * pageSize, (fuelPage + 1) * pageSize - 1);
                const { data, error: fuelError } = await fuelQuery;
                if (fuelError) throw fuelError;
                if (!data || data.length === 0) break;
                fuelSalesData.push(...data);
                if (data.length < pageSize) break;
                fuelPage++;
            }

            // 2. Fetch all fuel prices (paginated)
            let fuelPricesData = [];
            let pricesPage = 0;
            while (true) {
                const { data, error: pricesError } = await supabase
                    .from('fuel_prices')
                    .select('*')
                    .order('date', { ascending: true })
                    .range(pricesPage * pageSize, (pricesPage + 1) * pageSize - 1);
                if (pricesError) throw pricesError;
                if (!data || data.length === 0) break;
                fuelPricesData.push(...data);
                if (data.length < pageSize) break;
                pricesPage++;
            }

            // 3. Fetch all non-fuel sales in date range (paginated)
            let nonFuelSales = [];
            let salesPage = 0;
            while (true) {
                let salesQuery = supabase
                    .from('sales')
                    .select('*, articles!inner(*)')
                    .order('sale_date', { ascending: true });

                if (marginStartDate) {
                    salesQuery = salesQuery.gte('sale_date', marginStartDate);
                }
                if (marginEndDate) {
                    const end = new Date(marginEndDate);
                    end.setHours(23, 59, 59, 999);
                    salesQuery = salesQuery.lte('sale_date', end.toISOString());
                }

                salesQuery = salesQuery.range(salesPage * pageSize, (salesPage + 1) * pageSize - 1);
                const { data, error: salesError } = await salesQuery;
                if (salesError) throw salesError;
                if (!data || data.length === 0) break;
                nonFuelSales.push(...data);
                if (data.length < pageSize) break;
                salesPage++;
            }

            // 4. Fetch monthly stock costs
            const { data: monthlyCogsData, error: monthlyCogsError } = await supabase
                .from('monthly_stock_costs')
                .select('*');
            if (monthlyCogsError) throw monthlyCogsError;

            // 5. Fetch all operating expenses in range for EBIT (paginated)
            let expensesData = [];
            let expensesPage = 0;
            while (true) {
                let expensesQuery = supabase
                    .from('operating_expenses')
                    .select('*')
                    .order('date', { ascending: true });

                if (marginStartDate) {
                    expensesQuery = expensesQuery.gte('date', marginStartDate);
                }
                if (marginEndDate) {
                    expensesQuery = expensesQuery.lte('date', marginEndDate);
                }

                expensesQuery = expensesQuery.range(expensesPage * pageSize, (expensesPage + 1) * pageSize - 1);
                const { data, error: expensesError } = await expensesQuery;
                if (expensesError) throw expensesError;
                if (!data || data.length === 0) break;
                expensesData.push(...data);
                if (data.length < pageSize) break;
                expensesPage++;
            }

            const expensesTotal = (expensesData || []).reduce((sum, exp) => sum + Number(exp.amount), 0);
            const expensesByCategory = {};
            (expensesData || []).forEach(exp => {
                expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + Number(exp.amount);
            });

            // Map monthly cogs
            const monthlyCogsMap = {};
            (monthlyCogsData || []).forEach(item => {
                monthlyCogsMap[item.month] = {
                    shop: Number(item.shop_cogs || 0),
                    cafe: Number(item.cafe_cogs || 0),
                    bosch: Number(item.bosch_cogs || 0)
                };
            });

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

            // Compute aggregates for non-fuel categories
            let lubQty = 0, lubRevenue = 0, lubCost = 0;
            let shopRevenue = 0, shopCost = 0;
            let cafeRevenue = 0, cafeCost = 0;
            let boschRevenue = 0, boschCost = 0;

            nonFuelSales.forEach(sale => {
                const qty = Number(sale.quantity || 1);
                const revenue = Number(sale.total_price || 0);
                const purchasePrice = Number(sale.articles?.purchase_price || 0);

                const category = (sale.articles?.category || '').toLowerCase();

                if (['lubricant_piste', 'lubricant_bosch', 'lubrifiants'].includes(category)) {
                    lubQty += qty;
                    lubRevenue += revenue;
                    lubCost += qty * purchasePrice;
                } else if (category.includes('shop')) {
                    shopRevenue += revenue;
                    const saleMonth = sale.sale_date.substring(0, 7);
                    // Use fallback only if no manual monthly cogs for that month
                    if (!monthlyCogsMap[saleMonth]) {
                        shopCost += qty * purchasePrice;
                    }
                } else if (category.includes('cafe') || category.includes('café')) {
                    cafeRevenue += revenue;
                    const saleMonth = sale.sale_date.substring(0, 7);
                    if (!monthlyCogsMap[saleMonth]) {
                        cafeCost += qty * purchasePrice;
                    }
                } else {
                    // Bosch Car Service & garage services (Main d'oeuvre, Pneumatique)
                    boschRevenue += revenue;
                    const saleMonth = sale.sale_date.substring(0, 7);
                    if (!monthlyCogsMap[saleMonth]) {
                        boschCost += qty * purchasePrice;
                    }
                }
            });

            // Apply monthly cogs proportional overrides for months in date range
            const uniqueMonths = getMonthsInRange(marginStartDate, marginEndDate);
            uniqueMonths.forEach(m => {
                const scale = getMonthOverlapScale(m, marginStartDate, marginEndDate);
                if (monthlyCogsMap[m]) {
                    shopCost += monthlyCogsMap[m].shop * scale;
                    cafeCost += monthlyCogsMap[m].cafe * scale;
                    boschCost += monthlyCogsMap[m].bosch * scale;
                }
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
            const totalRevenue = gasoilRevenue + sspRevenue + lubRevenue + shopRevenue + cafeRevenue + boschRevenue;
            const totalCost = gasoilCost + sspCost + lubCost + shopCost + cafeCost + boschCost;
            const totalMargin = totalRevenue - totalCost;
            const totalPercent = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

            setMarginData({
                loading: false,
                gasoil: { liters: gasoilLiters, revenue: gasoilRevenue, cost: gasoilCost, margin: gasoilMargin, percent: gasoilPercent },
                ssp: { liters: sspLiters, revenue: sspRevenue, cost: sspCost, margin: sspMargin, percent: sspPercent },
                lubricants: { quantity: lubQty, revenue: lubRevenue, cost: lubCost, margin: lubMargin, percent: lubPercent },
                shop: { revenue: shopRevenue, cost: shopCost, margin: shopRevenue - shopCost, percent: shopRevenue > 0 ? ((shopRevenue - shopCost) / shopRevenue) * 100 : 0 },
                cafe: { revenue: cafeRevenue, cost: cafeCost, margin: cafeRevenue - cafeCost, percent: cafeRevenue > 0 ? ((cafeRevenue - cafeCost) / cafeRevenue) * 100 : 0 },
                bosch: { revenue: boschRevenue, cost: boschCost, margin: boschRevenue - boschCost, percent: boschRevenue > 0 ? ((boschRevenue - boschCost) / boschRevenue) * 100 : 0 },
                total: { revenue: totalRevenue, cost: totalCost, margin: totalMargin, percent: totalPercent },
                expensesTotal,
                expensesByCategory
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

    // Analyses de Masse Salariale et Flexibilité (EBIT)
    const salairesFixes = Number(marginData.expensesByCategory?.['Salaires'] || 0);
    const interimVariable = Number(marginData.expensesByCategory?.['Interim'] || 0);
    const totalMasseSalariale = salairesFixes + interimVariable;
    const flexRHPercent = totalMasseSalariale > 0 ? (interimVariable / totalMasseSalariale) * 100 : 0;
    const fixesRHPercent = totalMasseSalariale > 0 ? (salairesFixes / totalMasseSalariale) * 100 : 0;
    const rhRatioOnRevenue = marginData.total.revenue > 0 ? (totalMasseSalariale / marginData.total.revenue) * 100 : 0;

    const fixedCategories = ['Loyer', 'Salaires', 'Assurances', 'Securite', 'Comptabilite', 'Redevances'];
    const chargesFixes = Object.entries(marginData.expensesByCategory || {}).reduce((sum, [cat, amount]) => {
        return fixedCategories.includes(cat) ? sum + Number(amount) : sum;
    }, 0);
    const chargesVariables = marginData.expensesTotal - chargesFixes;

    const chargesFixesPercent = marginData.expensesTotal > 0 ? (chargesFixes / marginData.expensesTotal) * 100 : 0;
    const chargesVariablesPercent = marginData.expensesTotal > 0 ? (chargesVariables / marginData.expensesTotal) * 100 : 0;

    const mcv = marginData.total.margin - chargesVariables;
    const tmcv = marginData.total.revenue > 0 ? mcv / marginData.total.revenue : 0;
    const seuilRentabilite = tmcv > 0 ? chargesFixes / tmcv : 0;
    const margeSecurite = marginData.total.revenue - seuilRentabilite;
    const indiceSecurite = marginData.total.revenue > 0 && margeSecurite > 0 ? (margeSecurite / marginData.total.revenue) * 100 : 0;

    const getCategoryDetails = (catValue) => {
        return CATEGORIES.find(c => c.value === catValue) || { label: catValue, color: 'bg-gray-100', hex: '#6B7280' };
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

    if (!dbSetup.operatingExpensesOk || !dbSetup.fuelPricesOk || !dbSetup.articlesPurchasePriceOk || !dbSetup.monthlyStockCostsOk || !dbSetup.employeesOk) {
        const missingResources = [];
        if (!dbSetup.operatingExpensesOk) missingResources.push('Table "operating_expenses"');
        if (!dbSetup.fuelPricesOk) missingResources.push('Table "fuel_prices"');
        if (!dbSetup.articlesPurchasePriceOk) missingResources.push('Colonne "purchase_price" dans la table "articles"');
        if (!dbSetup.monthlyStockCostsOk) missingResources.push('Table "monthly_stock_costs"');
        if (!dbSetup.employeesOk) missingResources.push('Table "employees"');

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
            <div className="flex flex-wrap bg-white p-1 rounded-2xl shadow-sm border border-gray-100 w-full md:w-fit gap-1">
                <button
                    onClick={() => setActiveTab('prices')}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-xl font-bold transition-all ${
                        activeTab === 'prices'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                    <Settings size={16} />
                    1. Configuration des Prix
                </button>
                <button
                    onClick={() => setActiveTab('monthly_cogs')}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-xl font-bold transition-all ${
                        activeTab === 'monthly_cogs'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                    <ShoppingBag size={16} />
                    2. Stocks Vendus (Mensuel)
                </button>
                <button
                    onClick={() => setActiveTab('expenses')}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-xl font-bold transition-all ${
                        activeTab === 'expenses'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                    <Receipt size={16} />
                    3. Charges Générales
                </button>
                <button
                    onClick={() => setActiveTab('margin')}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-xl font-bold transition-all ${
                        activeTab === 'margin'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                    <Activity size={16} />
                    4. Calcul de Marge Brute
                </button>
                <button
                    onClick={() => setActiveTab('ebit')}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-xl font-bold transition-all ${
                        activeTab === 'ebit'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                    <TrendingUp size={16} />
                    5. Résultat (REX)
                </button>
            </div>

            {/* TAB 1: PRICE CONFIGURATION */}
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

                                    {/* Gasoil Section */}
                                    <div className="border-t border-gray-100 pt-3">
                                        <h4 className="text-xs font-extrabold text-orange-600 mb-2 flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                            Gasoil
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-gray-400 uppercase">Prix d'Achat (L)</label>
                                                <input
                                                    type="number"
                                                    required
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-2.5 outline-none font-bold focus:ring-2 focus:ring-indigo-100 font-mono"
                                                    value={fuelPriceForm.gasoil_purchase}
                                                    onChange={e => setFuelPriceForm({ ...fuelPriceForm, gasoil_purchase: e.target.value })}
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-gray-400 uppercase">Prix de Vente (L)</label>
                                                <input
                                                    type="number"
                                                    required
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-2.5 outline-none font-bold focus:ring-2 focus:ring-indigo-100 font-mono"
                                                    value={fuelPriceForm.gasoil_sale}
                                                    onChange={e => setFuelPriceForm({ ...fuelPriceForm, gasoil_sale: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* SSP Section */}
                                    <div className="border-t border-gray-100 pt-3">
                                        <h4 className="text-xs font-extrabold text-green-600 mb-2 flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                            Sans Plomb (SSP)
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-gray-400 uppercase">Prix d'Achat (L)</label>
                                                <input
                                                    type="number"
                                                    required
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-2.5 outline-none font-bold focus:ring-2 focus:ring-indigo-100 font-mono"
                                                    value={fuelPriceForm.ssp_purchase}
                                                    onChange={e => setFuelPriceForm({ ...fuelPriceForm, ssp_purchase: e.target.value })}
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-gray-400 uppercase">Prix de Vente (L)</label>
                                                <input
                                                    type="number"
                                                    required
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-2.5 outline-none font-bold focus:ring-2 focus:ring-indigo-100 font-mono"
                                                    value={fuelPriceForm.ssp_sale}
                                                    onChange={e => setFuelPriceForm({ ...fuelPriceForm, ssp_sale: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        <Save size={16} />
                                        {submitting ? 'Enregistrement...' : 'Enregistrer les Tarifs'}
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

            {/* TAB 2: STOCKS VENDUS (MENSUEL) */}
            {activeTab === 'monthly_cogs' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Form to insert/update monthly stock costs */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm h-fit space-y-4">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Plus className="text-indigo-600" size={20} />
                            Saisir Coût des Stocks
                        </h3>
                        <p className="text-xs text-gray-400">
                            Enregistrez le coût total des stocks vendus (COGS) par mois pour la Boutique, le Café et Bosch Service.
                        </p>

                        <form onSubmit={handleSaveMonthlyCogs} className="space-y-4 pt-2">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Mois d'activité</label>
                                <input
                                    type="month"
                                    required
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-3 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                                    value={monthlyCogsForm.month}
                                    onChange={e => setMonthlyCogsForm({ ...monthlyCogsForm, month: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Boutique / Shop (MAD)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-3 outline-none font-bold focus:ring-2 focus:ring-indigo-100 font-mono"
                                    value={monthlyCogsForm.shop_cogs}
                                    onChange={e => setMonthlyCogsForm({ ...monthlyCogsForm, shop_cogs: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Café / Restauration (MAD)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-3 outline-none font-bold focus:ring-2 focus:ring-indigo-100 font-mono"
                                    value={monthlyCogsForm.cafe_cogs}
                                    onChange={e => setMonthlyCogsForm({ ...monthlyCogsForm, cafe_cogs: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Bosch Car Service (MAD)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-3 outline-none font-bold focus:ring-2 focus:ring-indigo-100 font-mono"
                                    value={monthlyCogsForm.bosch_cogs}
                                    onChange={e => setMonthlyCogsForm({ ...monthlyCogsForm, bosch_cogs: e.target.value })}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm disabled:opacity-50"
                            >
                                <Save size={16} />
                                {submitting ? 'Enregistrement...' : 'Enregistrer Coûts'}
                            </button>
                        </form>
                    </div>

                    {/* Table showing list of monthly entries */}
                    <div className="lg:col-span-2 bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Calendar className="text-indigo-600" size={20} />
                            Historique des Coûts de Stock
                        </h3>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/70 border-b border-gray-100 text-gray-400 uppercase text-[10px] font-bold tracking-wider">
                                        <th className="px-4 py-3">Mois</th>
                                        <th className="px-4 py-3 text-right">Shop / Boutique</th>
                                        <th className="px-4 py-3 text-right">Café / Resto</th>
                                        <th className="px-4 py-3 text-right">Bosch Service</th>
                                        <th className="px-4 py-3 text-right">Coût Total</th>
                                        <th className="px-4 py-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {monthlyCogsLoading ? (
                                        <tr>
                                            <td colSpan="6" className="text-center py-8">
                                                <RefreshCw className="animate-spin text-indigo-500 mx-auto" size={18} />
                                            </td>
                                        </tr>
                                    ) : monthlyCogs.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="text-center py-10 text-gray-400 text-sm font-medium">
                                                Aucun coût de stock mensuel configuré.
                                            </td>
                                        </tr>
                                    ) : (
                                        monthlyCogs.map(item => {
                                            const total = Number(item.shop_cogs || 0) + Number(item.cafe_cogs || 0) + Number(item.bosch_cogs || 0);
                                            const dateObj = new Date(item.month + '-02');
                                            return (
                                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-4 py-3 whitespace-nowrap font-bold text-sm text-gray-800">
                                                        {format(dateObj, 'MMMM yyyy', { locale: fr })}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-600">
                                                        {formatPrice(Number(item.shop_cogs))}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-600">
                                                        {formatPrice(Number(item.cafe_cogs))}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-600">
                                                        {formatPrice(Number(item.bosch_cogs))}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-sm font-bold text-gray-900">
                                                        {formatPrice(total)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => handleDeleteMonthlyCogs(item.id)}
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

            {/* TAB 3: OPERATING EXPENSES */}
            {activeTab === 'expenses' && (
                <>
                    {/* Sub-tabs Selector */}
                    <div className="flex border-b border-gray-100 gap-4 mb-6">
                        <button
                            onClick={() => setExpensesSubTab('list')}
                            className={`flex items-center gap-2 py-3 px-1 border-b-2 font-bold text-sm transition-all -mb-px ${
                                expensesSubTab === 'list'
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-900'
                            }`}
                        >
                            <Receipt size={16} />
                            Liste des Charges
                        </button>
                        <button
                            onClick={() => setExpensesSubTab('employees')}
                            className={`flex items-center gap-2 py-3 px-1 border-b-2 font-bold text-sm transition-all -mb-px ${
                                expensesSubTab === 'employees'
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-900'
                            }`}
                        >
                            <UserCog size={16} />
                            Gestion du Personnel & Salaires
                        </button>
                    </div>

                    {expensesSubTab === 'list' ? (
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
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Formulaire d'ajout de salarié */}
                            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm h-fit">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                                    <UserPlus className="text-indigo-600" size={20} />
                                    Ajouter un Salarié
                                </h3>

                                <form onSubmit={handleAddEmployee} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Nom Complet</label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-2.5 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                                            placeholder="Ex: Ahmed Benjelloun"
                                            value={employeeForm.name}
                                            onChange={e => setEmployeeForm(prev => ({ ...prev, name: e.target.value }))}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Type de Contrat</label>
                                        <select
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-2.5 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                                            value={employeeForm.contract_type}
                                            onChange={e => setEmployeeForm(prev => ({ ...prev, contract_type: e.target.value }))}
                                        >
                                            <option value="FIXE">Salarié Fixe (CDI/CDD)</option>
                                            <option value="INTERIM">Personnel Intérimaire (Flexible)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Salaire de Base Mensuel (MAD)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-2.5 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                                            placeholder="Ex: 5500.00"
                                            value={employeeForm.base_salary}
                                            onChange={e => setEmployeeForm(prev => ({ ...prev, base_salary: e.target.value }))}
                                            required
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all text-sm shadow-sm"
                                    >
                                        Enregistrer le salarié
                                    </button>
                                </form>
                            </div>

                            {/* Section droite : Saisie mensuelle & Liste globale */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Panneau Générateur de Paie Mensuelle */}
                                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-50">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                <Calendar className="text-indigo-600" size={20} />
                                                Calculateur & Synchronisation Mensuelle
                                            </h3>
                                            <p className="text-xs text-gray-400 mt-1">Saisissez les ajustements salariaux pour générer les charges.</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-400 uppercase">Mois :</span>
                                            <input
                                                type="month"
                                                className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl p-2 outline-none font-medium focus:ring-2 focus:ring-indigo-100"
                                                value={payrollMonth}
                                                onChange={e => setPayrollMonth(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {employees.filter(e => e.is_active !== false).length === 0 ? (
                                        <div className="text-center py-10 text-gray-400 text-sm font-medium">
                                            Aucun employé actif pour ce mois. Veuillez d'abord ajouter ou activer des salariés.
                                        </div>
                                    ) : (
                                        <form onSubmit={handleGenerateMonthlyPayroll} className="space-y-4">
                                            <div className="overflow-x-auto max-h-[300px] overflow-y-auto pr-1">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 uppercase text-[9px] font-bold tracking-wider">
                                                            <th className="px-4 py-2.5">Nom</th>
                                                            <th className="px-4 py-2.5">Type</th>
                                                            <th className="px-4 py-2.5 text-right">Base (MAD)</th>
                                                            <th className="px-4 py-2.5 text-right w-[180px]">Net Versé / Coût réel</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50 font-medium text-xs text-gray-800">
                                                        {employees.filter(e => e.is_active !== false).map(emp => {
                                                            const adjustment = payrollAdjustments[emp.id];
                                                            const val = adjustment !== undefined ? adjustment : (emp.base_salary ?? 0);
                                                            const isFixe = emp.contract_type === 'FIXE' || emp.contract_type === 'CDI' || emp.contract_type === 'CDD' || emp.contract_type === 'Anapec';
                                                            return (
                                                                <tr key={emp.id} className="hover:bg-slate-50/30">
                                                                    <td className="px-4 py-2.5 font-bold text-gray-900">{emp.name}</td>
                                                                    <td className="px-4 py-2.5">
                                                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                                                            isFixe 
                                                                                ? 'bg-purple-50 text-purple-700 border-purple-100' 
                                                                                : 'bg-rose-50 text-rose-700 border-rose-100'
                                                                        }`}>
                                                                            {isFixe ? 'Fixe CDI/CDD' : 'Intérimaire'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-right font-mono text-gray-500">{formatPrice(emp.base_salary ?? 0)}</td>
                                                                    <td className="px-4 py-2.5 text-right">
                                                                        <div className="flex items-center gap-1.5 justify-end">
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                className="w-28 text-right bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg p-1 outline-none font-mono focus:ring-2 focus:ring-indigo-100"
                                                                                value={val}
                                                                                onChange={e => setPayrollAdjustments(prev => ({ ...prev, [emp.id]: e.target.value }))}
                                                                                placeholder={(emp.base_salary ?? 0).toString()}
                                                                            />
                                                                            <span className="text-[10px] text-gray-400 font-bold">MAD</span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <button
                                                type="submit"
                                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all text-sm shadow-md flex items-center justify-center gap-2"
                                            >
                                                <Save size={16} />
                                                Générer la paie & Synchroniser avec les charges
                                            </button>
                                        </form>
                                    )}
                                </div>

                                {/* Liste globale des Salariés */}
                                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                                        <UserCog className="text-indigo-600" size={20} />
                                        Registre du Personnel
                                    </h3>

                                    {employees.length === 0 ? (
                                        <div className="text-center py-10 text-gray-400 text-sm font-medium">
                                            Aucun salarié enregistré dans le registre.
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto max-h-[300px] overflow-y-auto pr-1">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 uppercase text-[9px] font-bold tracking-wider">
                                                        <th className="px-4 py-2.5">Nom</th>
                                                        <th className="px-4 py-2.5">Type</th>
                                                        <th className="px-4 py-2.5 text-right">Salaire Standard</th>
                                                        <th className="px-4 py-2.5 text-center">Statut</th>
                                                        <th className="px-4 py-2.5 text-center">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50 font-medium text-xs text-gray-800">
                                                    {employees.map(emp => (
                                                        <tr key={emp.id} className="hover:bg-slate-50/30">
                                                            <td className="px-4 py-2.5 font-bold text-gray-900">{emp.name}</td>
                                                            <td className="px-4 py-2.5">
                                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                                                    (emp.contract_type === 'FIXE' || emp.contract_type === 'CDI' || emp.contract_type === 'CDD' || emp.contract_type === 'Anapec') 
                                                                        ? 'bg-purple-50 text-purple-700 border-purple-100' 
                                                                        : 'bg-rose-50 text-rose-700 border-rose-100'
                                                                }`}>
                                                                    {(emp.contract_type === 'FIXE' || emp.contract_type === 'CDI' || emp.contract_type === 'CDD' || emp.contract_type === 'Anapec') ? 'Fixe' : 'Intérimaire'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-mono text-gray-600">{formatPrice(emp.base_salary ?? 0)}</td>
                                                            <td className="px-4 py-2.5 text-center">
                                                                <button
                                                                    onClick={() => handleToggleEmployeeStatus(emp.id, emp.is_active ?? true)}
                                                                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                                                        (emp.is_active ?? true)
                                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100' 
                                                                            : 'bg-gray-50 text-gray-500 border-gray-150 hover:bg-gray-150'
                                                                    }`}
                                                                    title={(emp.is_active ?? true) ? 'Désactiver' : 'Activer'}
                                                                >
                                                                    {(emp.is_active ?? true) ? 'Actif' : 'Inactif'}
                                                                </button>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-center">
                                                                <button
                                                                    onClick={() => handleDeleteEmployee(emp.id)}
                                                                    className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                                                                    title="Supprimer"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* TAB 4: GROSS MARGIN CALCULATIONS */}
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
                                        Détails de Marge par Produit (6 Centres de Profit)
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

                                                {/* Boutique (Shop) */}
                                                <tr className="hover:bg-slate-50/50">
                                                    <td className="px-4 py-3 font-bold flex items-center gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                                                        Boutique (Shop)
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-600">—</td>
                                                    <td className="px-4 py-3 text-right font-mono">{formatPrice(marginData.shop.revenue)}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-gray-500">{formatPrice(marginData.shop.cost)}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">{formatPrice(marginData.shop.margin)}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600">{formatNumber(marginData.shop.percent, 2)} %</td>
                                                </tr>

                                                {/* Café */}
                                                <tr className="hover:bg-slate-50/50">
                                                    <td className="px-4 py-3 font-bold flex items-center gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-pink-500"></div>
                                                        Café / Restauration
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-600">—</td>
                                                    <td className="px-4 py-3 text-right font-mono">{formatPrice(marginData.cafe.revenue)}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-gray-500">{formatPrice(marginData.cafe.cost)}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">{formatPrice(marginData.cafe.margin)}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600">{formatNumber(marginData.cafe.percent, 2)} %</td>
                                                </tr>

                                                {/* Bosch & Lavage */}
                                                <tr className="hover:bg-slate-50/50">
                                                    <td className="px-4 py-3 font-bold flex items-center gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
                                                        Bosch Car Service & Lavage
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-600">—</td>
                                                    <td className="px-4 py-3 text-right font-mono">{formatPrice(marginData.bosch.revenue)}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-gray-500">{formatPrice(marginData.bosch.cost)}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">{formatPrice(marginData.bosch.margin)}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600">{formatNumber(marginData.bosch.percent, 2)} %</td>
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
                                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[460px]">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                            <BarChart3 className="text-indigo-600" size={20} />
                                            Contribution à la Marge Brute
                                        </h3>
                                        <p className="text-xs text-gray-400 mt-1">Répartition de la marge générée par chaque univers.</p>
                                    </div>

                                    {marginData.total.margin <= 0 ? (
                                        <div className="flex-grow flex flex-col items-center justify-center text-gray-300 py-10">
                                            <Info size={48} className="opacity-20 mb-2" />
                                            <span className="text-sm font-semibold">Aucune marge positive à afficher</span>
                                        </div>
                                    ) : (
                                        <div className="flex-grow flex flex-col justify-between mt-4">
                                            {/* Unified Total Summary above the Chart */}
                                            <div className="text-center py-2.5 bg-indigo-50/40 rounded-2xl border border-indigo-100/50 mb-2">
                                                <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-wider block">Marge Totale Réalisée</span>
                                                <span className="text-xl font-black text-indigo-950">{formatPrice(marginData.total.margin)}</span>
                                            </div>

                                            {/* Donut Chart */}
                                            <div className="relative h-[160px] w-full flex items-center justify-center">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={[
                                                                { name: 'Gasoil', value: Math.max(0, marginData.gasoil.margin), color: '#F97316' },
                                                                { name: 'Sans Plomb', value: Math.max(0, marginData.ssp.margin), color: '#22C55E' },
                                                                { name: 'Lubrifiants', value: Math.max(0, marginData.lubricants.margin), color: '#6366F1' },
                                                                { name: 'Boutique', value: Math.max(0, marginData.shop.margin), color: '#3B82F6' },
                                                                { name: 'Café', value: Math.max(0, marginData.cafe.margin), color: '#EC4899' },
                                                                { name: 'Bosch & Services', value: Math.max(0, marginData.bosch.margin), color: '#8B5CF6' }
                                                            ].filter(item => item.value > 0)}
                                                            dataKey="value"
                                                            nameKey="name"
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={50}
                                                            outerRadius={68}
                                                            paddingAngle={3}
                                                        >
                                                            {[
                                                                { name: 'Gasoil', color: '#F97316' },
                                                                { name: 'Sans Plomb', color: '#22C55E' },
                                                                { name: 'Lubrifiants', color: '#6366F1' },
                                                                { name: 'Boutique', color: '#3B82F6' },
                                                                { name: 'Café', color: '#EC4899' },
                                                                { name: 'Bosch & Services', color: '#8B5CF6' }
                                                            ].filter(item => Math.max(0, marginData[
                                                                item.name === 'Sans Plomb' ? 'ssp' :
                                                                item.name === 'Lubrifiants' ? 'lubricants' :
                                                                item.name === 'Boutique' ? 'shop' :
                                                                item.name === 'Café' ? 'cafe' :
                                                                item.name === 'Bosch & Services' ? 'bosch' : 'gasoil'
                                                            ]?.margin) > 0).map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip formatter={(value) => formatPrice(value)} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>

                                            {/* Sorted custom legend list with progress bars */}
                                            {(() => {
                                                const items = [
                                                    { name: 'Gasoil', value: Math.max(0, marginData.gasoil.margin), color: '#F97316' },
                                                    { name: 'Sans Plomb', value: Math.max(0, marginData.ssp.margin), color: '#22C55E' },
                                                    { name: 'Lubrifiants', value: Math.max(0, marginData.lubricants.margin), color: '#6366F1' },
                                                    { name: 'Boutique', value: Math.max(0, marginData.shop.margin), color: '#3B82F6' },
                                                    { name: 'Café', value: Math.max(0, marginData.cafe.margin), color: '#EC4899' },
                                                    { name: 'Bosch & Services', value: Math.max(0, marginData.bosch.margin), color: '#8B5CF6' }
                                                ].filter(item => item.value > 0);
                                                
                                                const sortedLegend = [...items].sort((a, b) => b.value - a.value);
                                                const sumPositive = sortedLegend.reduce((sum, entry) => sum + entry.value, 0);

                                                return (
                                                    <div className="mt-3 space-y-2">
                                                        {sortedLegend.map((item, idx) => {
                                                            const pct = sumPositive > 0 ? (item.value / sumPositive) * 100 : 0;
                                                            return (
                                                                <div key={idx} className="flex flex-col text-xs font-semibold">
                                                                    <div className="flex justify-between items-center text-gray-700">
                                                                        <div className="flex items-center gap-1.5 truncate">
                                                                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                                                                            <span className="truncate">{item.name}</span>
                                                                        </div>
                                                                        <div className="flex gap-2 text-right">
                                                                            <span className="text-gray-900 font-mono">{formatPrice(item.value)}</span>
                                                                            <span className="text-gray-400 font-medium">{formatNumber(pct, 1)}%</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="w-full bg-gray-100 h-1.5 rounded-full mt-1 overflow-hidden">
                                                                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: item.color }}></div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* TAB 5: EBIT & BREAKEVEN (RESULTAT D'EXPLOITATION) */}
            {activeTab === 'ebit' && (
                <div className="space-y-6">
                    {/* Filters & Actions (Period sync) */}
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
                                <span className="text-gray-400 text-sm font-semibold">Calcul du résultat en cours...</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* KPI cards (EBIT, Marges, Charges) */}
                            {(() => {
                                const ebitValue = marginData.total.margin - marginData.expensesTotal;
                                return (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Total Marges Brutes</div>
                                            <div className="text-3xl font-black text-emerald-600">{formatPrice(marginData.total.margin)}</div>
                                            <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500"></div>
                                        </div>

                                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Charges d'Exploitation (Charges)</div>
                                            <div className="text-3xl font-black text-rose-500">-{formatPrice(marginData.expensesTotal)}</div>
                                            <div className="absolute bottom-0 left-0 w-full h-1 bg-rose-500"></div>
                                        </div>

                                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Résultat d'Exploitation (REX)</div>
                                            <div className={`text-3xl font-black ${ebitValue >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                                                {ebitValue >= 0 ? '+' : ''}{formatPrice(ebitValue)}
                                            </div>
                                            <div className={`absolute bottom-0 left-0 w-full h-1 ${ebitValue >= 0 ? 'bg-indigo-500' : 'bg-red-500'}`}></div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Row 1: EBIT breakdown table and Expenses Donut chart */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* EBIT breakdown table */}
                                <div className="lg:col-span-2 bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <FileText className="text-indigo-600" size={20} />
                                        Compte de Résultat d'Exploitation (REX)
                                    </h3>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50/70 border-b border-gray-100 text-gray-400 uppercase text-[10px] font-bold tracking-wider">
                                                    <th className="px-4 py-3">Poste</th>
                                                    <th className="px-4 py-3 text-right">Montant (MAD)</th>
                                                    <th className="px-4 py-3 text-right">% du Chiffre d'Affaires</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 font-medium text-sm text-gray-800">
                                                {/* Revenue */}
                                                <tr className="hover:bg-slate-50/50">
                                                    <td className="px-4 py-3 font-bold text-gray-900">Chiffre d'Affaires (Ventes de Carburant, Lubs & Services)</td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold">{formatPrice(marginData.total.revenue)}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-gray-400">100.0 %</td>
                                                </tr>
                                                {/* COGS */}
                                                <tr className="hover:bg-slate-50/50 text-gray-600">
                                                    <td className="px-4 py-3 pl-6 text-xs font-semibold">Coûts de stock / Achat carburants & marchandises (-)</td>
                                                    <td className="px-4 py-3 text-right font-mono font-semibold text-rose-500">-{formatPrice(marginData.total.cost)}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">
                                                        {marginData.total.revenue > 0 ? formatNumber((marginData.total.cost / marginData.total.revenue) * 100, 1) : 0} %
                                                    </td>
                                                </tr>
                                                {/* Gross margin */}
                                                <tr className="hover:bg-slate-50/50 bg-emerald-50/30">
                                                    <td className="px-4 py-3 font-bold text-emerald-800">Marge Brute Globale</td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{formatPrice(marginData.total.margin)}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-emerald-700 font-bold">
                                                        {marginData.total.revenue > 0 ? formatNumber((marginData.total.margin / marginData.total.revenue) * 100, 1) : 0} %
                                                    </td>
                                                </tr>
                                                {/* General Expenses */}
                                                <tr className="hover:bg-slate-50/50 text-gray-600">
                                                    <td className="px-4 py-3 pl-6 text-xs font-semibold">Charges Générales d'Exploitation (Charges) (-)</td>
                                                    <td className="px-4 py-3 text-right font-mono font-semibold text-rose-500">-{formatPrice(marginData.expensesTotal)}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">
                                                        {marginData.total.revenue > 0 ? formatNumber((marginData.expensesTotal / marginData.total.revenue) * 100, 1) : 0} %
                                                    </td>
                                                </tr>
                                                {/* EBIT */}
                                                {(() => {
                                                    const ebitVal = marginData.total.margin - marginData.expensesTotal;
                                                    const ebitPct = marginData.total.revenue > 0 ? (ebitVal / marginData.total.revenue) * 100 : 0;
                                                    return (
                                                        <tr className="bg-indigo-50/30 border-t border-gray-200">
                                                            <td className="px-4 py-3 font-black text-indigo-900 uppercase">Résultat d'Exploitation (REX)</td>
                                                            <td className={`px-4 py-3 text-right font-mono font-black ${ebitVal >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>
                                                                {ebitVal >= 0 ? '+' : ''}{formatPrice(ebitVal)}
                                                            </td>
                                                            <td className={`px-4 py-3 text-right font-mono font-black ${ebitVal >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>
                                                                {formatNumber(ebitPct, 1)} %
                                                            </td>
                                                        </tr>
                                                    );
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Expenses Donut chart with legend */}
                                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[460px]">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                            <BarChart3 className="text-indigo-600" size={20} />
                                            Répartition des Charges
                                        </h3>
                                        <p className="text-xs text-gray-400 mt-1">Répartition des charges générales saisies sur la période.</p>
                                    </div>

                                    {marginData.expensesTotal <= 0 ? (
                                        <div className="flex-grow flex flex-col items-center justify-center text-gray-300 py-10">
                                            <Info size={48} className="opacity-20 mb-2" />
                                            <span className="text-sm font-semibold">Aucune charge sur cette période</span>
                                        </div>
                                    ) : (
                                        <div className="flex-grow flex flex-col justify-between mt-4">
                                            {/* Unified Total Summary above the Chart */}
                                            <div className="text-center py-2.5 bg-rose-50/40 rounded-2xl border border-rose-100/50 mb-2">
                                                <span className="text-[10px] font-extrabold text-rose-500 uppercase tracking-wider block">Charges Totales d'Exploitation</span>
                                                <span className="text-xl font-black text-rose-950">{formatPrice(marginData.expensesTotal)}</span>
                                            </div>

                                            {/* Donut Chart */}
                                            <div className="relative h-[160px] w-full flex items-center justify-center">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={Object.entries(marginData.expensesByCategory || {})
                                                                .map(([cat, amount]) => {
                                                                    const catInfo = getCategoryDetails(cat);
                                                                    return {
                                                                        name: catInfo.label,
                                                                        value: Number(amount),
                                                                        color: catInfo.hex || '#6B7280'
                                                                    };
                                                                })
                                                                .filter(item => item.value > 0)}
                                                            dataKey="value"
                                                            nameKey="name"
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={50}
                                                            outerRadius={68}
                                                            paddingAngle={3}
                                                        >
                                                            {Object.entries(marginData.expensesByCategory || {})
                                                                .map(([cat, amount]) => {
                                                                    const catInfo = getCategoryDetails(cat);
                                                                    return { name: catInfo.label, value: Number(amount), color: catInfo.hex || '#6B7280' };
                                                                })
                                                                .filter(item => item.value > 0)
                                                                .map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                                ))}
                                                        </Pie>
                                                        <Tooltip formatter={(value) => formatPrice(value)} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
 
                                            {/* Sorted custom legend list with progress bars */}
                                            {(() => {
                                                const items = Object.entries(marginData.expensesByCategory || {})
                                                    .map(([cat, amount]) => {
                                                        const catInfo = getCategoryDetails(cat);
                                                        return {
                                                            name: catInfo.label,
                                                            value: Number(amount),
                                                            color: catInfo.hex || '#6B7280'
                                                        };
                                                    })
                                                    .filter(item => item.value > 0);
                                                
                                                const sortedLegend = [...items].sort((a, b) => b.value - a.value);
                                                const sumPositive = sortedLegend.reduce((sum, entry) => sum + entry.value, 0);

                                                return (
                                                    <div className="mt-3 space-y-2 max-h-[260px] overflow-y-auto pr-1">
                                                        {sortedLegend.map((item, idx) => {
                                                            const pct = sumPositive > 0 ? (item.value / sumPositive) * 100 : 0;
                                                            return (
                                                                <div key={idx} className="flex flex-col text-xs font-semibold">
                                                                    <div className="flex justify-between items-center text-gray-700">
                                                                        <div className="flex items-center gap-1.5 truncate">
                                                                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                                                                            <span className="truncate">{item.name}</span>
                                                                        </div>
                                                                        <div className="flex gap-2 text-right">
                                                                            <span className="text-gray-900 font-mono">{formatPrice(item.value)}</span>
                                                                            <span className="text-gray-400 font-medium">{formatNumber(pct, 1)}%</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="w-full bg-gray-100 h-1.5 rounded-full mt-1 overflow-hidden">
                                                                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: item.color }}></div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Row 2: Analysis Cards (Masse Salariale & Flexibilité RH, Structure des Charges, Point Mort & Sécurité Financière) */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Masse Salariale & Flexibilité RH */}
                                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between space-y-4">
                                    <div>
                                        <h4 className="text-base font-black text-gray-900 flex items-center gap-2">
                                            <Sparkles className="text-rose-500" size={18} />
                                            Masse Salariale & Flexibilité RH
                                        </h4>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Analyse de l'arbitrage entre salaires fixes (CDI/CDD) et personnel intérimaire flexible.
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs font-bold text-gray-500">
                                            <span>CDI & CNSS ({formatNumber(fixesRHPercent, 1)}%)</span>
                                            <span>Intérim ({formatNumber(flexRHPercent, 1)}%)</span>
                                        </div>
                                        <div className="w-full bg-gray-100 h-3 rounded-full flex overflow-hidden">
                                            <div className="bg-purple-500 h-full" style={{ width: `${fixesRHPercent}%` }}></div>
                                            <div className="bg-rose-500 h-full" style={{ width: `${flexRHPercent}%` }}></div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-xs font-bold text-gray-700 border-t border-gray-50 pt-3">
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Salaires Fixes (CDI/CNSS) :</span>
                                            <span className="font-mono text-gray-900">{formatPrice(salairesFixes)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Personnel Intérimaire :</span>
                                            <span className="font-mono text-gray-900">{formatPrice(interimVariable)}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-gray-100 pt-2 text-sm">
                                            <span className="text-gray-900 font-extrabold">Masse Salariale Totale :</span>
                                            <span className="font-mono text-indigo-600 font-extrabold">{formatPrice(totalMasseSalariale)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                                            <span className="text-gray-400 font-bold">Poids RH sur Chiffre d'Affaires :</span>
                                            <span className="font-mono">{formatNumber(rhRatioOnRevenue, 1)}%</span>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-rose-50/50 border border-rose-100 text-rose-800 rounded-xl p-3 text-[11px] font-semibold">
                                        L'intérim offre une flexibilité de {formatNumber(flexRHPercent, 1)}% pour adapter vos équipes de piste/lavage à l'activité sans alourdir vos charges fixes.
                                    </div>
                                </div>

                                {/* Structure des Charges (Fixes vs Variables) */}
                                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between space-y-4">
                                    <div>
                                        <h4 className="text-base font-black text-gray-900 flex items-center gap-2">
                                            <Activity className="text-blue-500" size={18} />
                                            Structure des Charges d'Exploitation
                                        </h4>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Répartition entre charges de structure incompressibles (Fixes) et charges liées à l'activité (Variables).
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs font-bold text-gray-500">
                                            <span>Fixes ({formatNumber(chargesFixesPercent, 1)}%)</span>
                                            <span>Variables ({formatNumber(chargesVariablesPercent, 1)}%)</span>
                                        </div>
                                        <div className="w-full bg-gray-100 h-3 rounded-full flex overflow-hidden">
                                            <div className="bg-blue-500 h-full" style={{ width: `${chargesFixesPercent}%` }}></div>
                                            <div className="bg-orange-500 h-full" style={{ width: `${chargesVariablesPercent}%` }}></div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-xs font-bold text-gray-700 border-t border-gray-50 pt-3">
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Charges Fixes (Loyer, CDI, Assur.) :</span>
                                            <span className="font-mono text-gray-900">{formatPrice(chargesFixes)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Charges Variables (Intérim, Fluides, Taxes) :</span>
                                            <span className="font-mono text-gray-900">{formatPrice(chargesVariables)}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-gray-100 pt-2 text-sm">
                                            <span className="text-gray-900 font-extrabold">Total Charges :</span>
                                            <span className="font-mono text-gray-900 font-extrabold">{formatPrice(marginData.expensesTotal)}</span>
                                        </div>
                                    </div>

                                    <div className="bg-blue-50/50 border border-blue-100 text-blue-800 rounded-xl p-3 text-[11px] font-semibold">
                                        Les charges fixes représentent {formatNumber(chargesFixesPercent, 1)}% de vos dépenses opérationnelles totales sur la période.
                                    </div>
                                </div>

                                {/* Point Mort & Sécurité Financière */}
                                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between space-y-4">
                                    <div>
                                        <h4 className="text-base font-black text-gray-900 flex items-center gap-2">
                                            <TrendingUp className="text-indigo-500" size={18} />
                                            Point Mort & Sécurité Financière
                                        </h4>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Calcul du seuil de rentabilité théorique nécessaire pour couvrir l'ensemble des charges fixes de la station.
                                        </p>
                                    </div>

                                    <div className="space-y-2 text-xs font-bold text-gray-700">
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">TMCV (Taux de Marges sur Coûts Var.) :</span>
                                            <span className="font-mono text-indigo-600">{formatNumber(tmcv * 100, 2)}%</span>
                                        </div>
                                        <div className="flex justify-between text-sm border-t border-gray-50 pt-2">
                                            <span className="text-gray-900 font-extrabold">Seuil de Rentabilité (SR) :</span>
                                            <span className="font-mono text-gray-900 font-black">{formatPrice(seuilRentabilite)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span className="text-gray-400">Marge de Sécurité :</span>
                                            <span className={`font-mono font-bold ${margeSecurite >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {margeSecurite >= 0 ? '+' : ''}{formatPrice(margeSecurite)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span className="text-gray-400">Indice de Sécurité Financière :</span>
                                            <span className={`font-mono font-extrabold ${margeSecurite >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {formatNumber(indiceSecurite, 1)}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Dynamic alert box */}
                                    {marginData.total.revenue >= seuilRentabilite ? (
                                        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl p-3 text-[11px] font-semibold flex gap-2">
                                            <CheckCircle size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-bold text-emerald-950">Seuil de Rentabilité Atteint !</p>
                                                <p className="text-emerald-700 mt-0.5">La station est bénéficiaire. Marge de sécurité positive à +{formatPrice(margeSecurite)} ({formatNumber(indiceSecurite, 1)}% du CA).</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-rose-50 border border-rose-100 text-rose-800 rounded-xl p-3 text-[11px] font-semibold flex gap-2">
                                            <AlertTriangle size={14} className="text-rose-600 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-bold text-rose-950">Seuil Non Atteint</p>
                                                <p className="text-rose-700 mt-0.5">La station travaille à perte sur cette période. Il vous manque {formatPrice(Math.abs(margeSecurite))} de CA pour équilibrer vos comptes.</p>
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

            {/* Custom Payroll Generation Confirmation Modal */}
            {showPayrollConfirmModal && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowPayrollConfirmModal(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl overflow-hidden flex flex-col transform transition-all duration-300 scale-100 animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="text-center mb-5">
                            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                                <CreditCard size={28} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">Génération de la Paie</h3>
                            <p className="text-xs text-gray-400 mt-1">Veuillez valider la masse salariale mensuelle</p>
                        </div>

                        {/* Details Card */}
                        <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500 font-medium">Mois de facturation :</span>
                                <span className="font-bold text-gray-900 bg-white px-2.5 py-1 rounded-lg shadow-sm border border-gray-150 capitalize">{payrollConfirmData.formattedMonth}</span>
                            </div>
                            <div className="h-px bg-gray-200/60 my-1"></div>
                            
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                        <span className="text-xs font-semibold text-gray-600">Salaires & CNSS (Fixe)</span>
                                    </div>
                                    <span className="font-mono text-sm font-bold text-gray-900">{formatPrice(payrollConfirmData.totalFixe)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                        <span className="text-xs font-semibold text-gray-600">Personnel Intérimaire</span>
                                    </div>
                                    <span className="font-mono text-sm font-bold text-gray-900">{formatPrice(payrollConfirmData.totalInterim)}</span>
                                </div>
                            </div>
                            
                            <div className="h-px bg-gray-200/60 my-1"></div>
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-xs font-bold text-gray-800">Total Masse Salariale</span>
                                <span className="font-mono text-base font-black text-indigo-600">{formatPrice(payrollConfirmData.totalFixe + payrollConfirmData.totalInterim)}</span>
                            </div>
                        </div>

                        {/* Warning Box */}
                        <div className="bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-3.5 text-xs font-medium flex gap-2.5 items-start mt-4">
                            <AlertTriangle size={18} className="text-rose-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-rose-950">Avertissement</p>
                                <p className="text-rose-700/95 leading-relaxed mt-0.5">Les écritures de paie déjà enregistrées pour ce mois seront définitivement écrasées et remplacées.</p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 mt-6">
                            <button
                                type="button"
                                onClick={() => setShowPayrollConfirmModal(false)}
                                className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 active:bg-gray-100 font-bold text-sm transition-all text-center"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={executePayrollGeneration}
                                className="flex-1 px-4 py-3 bg-gradient-purple text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all text-center"
                            >
                                Confirmer & Générer
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
