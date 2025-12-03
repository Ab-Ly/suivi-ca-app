import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from './ui/Card';
import { FileDown, FileJson, FileSpreadsheet, FileText, Loader2, RefreshCw } from 'lucide-react';
import { DateInput } from './ui/DateInput';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';

export default function Reports() {
    const [salesData, setSalesData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [category, setCategory] = useState('');

    useEffect(() => {
        fetchSalesData();
    }, [startDate, endDate, searchTerm, category]);

    const fetchSalesData = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('sales')
                .select(`
                    *,
                    articles!inner (
                        name,
                        category
                    )
                `)
                .order('sale_date', { ascending: false });

            if (startDate) {
                query = query.gte('sale_date', startDate);
            }
            if (endDate) {
                // Set to end of day
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query = query.lte('sale_date', end.toISOString());
            }
            if (category) {
                query = query.eq('articles.category', category);
            }
            if (searchTerm) {
                query = query.ilike('articles.name', `%${searchTerm}%`);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Calculate daily totals
            const dailyTotals = data.reduce((acc, sale) => {
                const date = new Date(sale.sale_date).toLocaleDateString('fr-FR');
                acc[date] = (acc[date] || 0) + sale.total_price;
                return acc;
            }, {});

            const formattedData = data.map(sale => {
                const date = new Date(sale.sale_date).toLocaleDateString('fr-FR');
                return {
                    date: date,
                    article: sale.articles?.name || 'Article inconnu',
                    category: sale.articles?.category || '-',
                    location: sale.sales_location === 'piste' ? 'Piste' : (sale.sales_location === 'bosch' ? 'Bosch' : '-'),
                    quantity: sale.quantity,
                    total: sale.total_price,
                    dailyTotal: dailyTotals[date]
                };
            });

            setSalesData(formattedData);
        } catch (error) {
            console.error('Error fetching sales for reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = () => {
        if (salesData.length === 0) {
            alert("Aucune donnée à exporter.");
            return;
        }
        setExporting(true);
        try {
            // Format data for Excel headers
            const excelData = salesData.map(item => ({
                "Date": item.date,
                "Article": item.article,
                "Catégorie": item.category,
                "Emplacement": item.location,
                "Quantité": item.quantity,
                "Total (MAD)": item.total,
                "Total Journée (MAD)": item.dailyTotal
            }));

            const ws = XLSX.utils.json_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Ventes");
            XLSX.writeFile(wb, "rapport_ventes_complet.xlsx");
        } catch (error) {
            console.error("Export Excel failed", error);
            alert("Erreur lors de l'export Excel");
        } finally {
            setExporting(false);
        }
    };

    const exportToPDF = () => {
        if (salesData.length === 0) {
            alert("Aucune donnée à exporter.");
            return;
        }
        setExporting(true);
        try {
            const doc = new jsPDF();
            doc.text("Rapport Détaillé des Ventes", 14, 15);
            doc.setFontSize(10);
            doc.text(`Généré le: ${new Date().toLocaleString('fr-FR')}`, 14, 22);

            const tableColumn = ["Date", "Article", "Catégorie", "Lieu", "Qté", "Total", "Total Jour"];
            const tableRows = salesData.map(item => [
                item.date,
                item.article,
                item.category,
                item.location,
                item.quantity,
                item.total,
                item.dailyTotal
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 30,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [66, 66, 66] }
            });

            doc.save("rapport_ventes_complet.pdf");
        } catch (error) {
            console.error("Export PDF failed", error);
            alert(`Erreur lors de l'export PDF: ${error.message}`);
        } finally {
            setExporting(false);
        }
    };

    const exportToJSON = () => {
        if (salesData.length === 0) {
            alert("Aucune donnée à exporter.");
            return;
        }
        setExporting(true);
        try {
            const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(
                JSON.stringify(salesData, null, 2)
            )}`;
            const link = document.createElement("a");
            link.href = jsonString;
            link.download = "rapport_ventes_complet.json";
            link.click();
        } catch (error) {
            console.error("Export JSON failed", error);
            alert("Erreur lors de l'export JSON");
        } finally {
            setExporting(false);
        }
    };

    const resetFilters = () => {
        setStartDate('');
        setEndDate('');
        setSearchTerm('');
        setCategory('');
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-text-main">Rapports & Exports</h2>
                    <p className="text-text-muted text-sm">Générez et téléchargez vos rapports d'activité</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={resetFilters}
                        className="text-sm text-primary hover:text-primary/80 underline font-medium"
                    >
                        Réinitialiser
                    </button>
                    <button
                        onClick={fetchSalesData}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-border rounded-xl shadow-sm hover:bg-gray-50 hover:text-primary hover:border-primary/30 transition-all duration-200 group"
                    >
                        <RefreshCw size={18} className={`transition-transform duration-500 ${loading ? 'animate-spin' : 'group-hover:rotate-180'}`} />
                        <span className="font-medium">Actualiser</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div
                    onClick={exportToExcel}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-border hover:shadow-md hover:border-green-200 transition-all cursor-pointer group"
                >
                    <div className="flex flex-col items-center justify-center gap-4">
                        <div className="p-4 bg-green-50 rounded-full text-green-600 group-hover:scale-110 transition-transform duration-300">
                            {exporting ? <Loader2 className="animate-spin" size={32} /> : <FileSpreadsheet size={32} />}
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-lg text-text-main group-hover:text-green-700 transition-colors">Excel (.xlsx)</h3>
                            <p className="text-sm text-text-muted">Format tableur standard</p>
                        </div>
                    </div>
                </div>

                <div
                    onClick={exportToPDF}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-border hover:shadow-md hover:border-red-200 transition-all cursor-pointer group"
                >
                    <div className="flex flex-col items-center justify-center gap-4">
                        <div className="p-4 bg-red-50 rounded-full text-red-600 group-hover:scale-110 transition-transform duration-300">
                            {exporting ? <Loader2 className="animate-spin" size={32} /> : <FileText size={32} />}
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-lg text-text-main group-hover:text-red-700 transition-colors">PDF (.pdf)</h3>
                            <p className="text-sm text-text-muted">Document imprimable</p>
                        </div>
                    </div>
                </div>

                <div
                    onClick={exportToJSON}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-border hover:shadow-md hover:border-yellow-200 transition-all cursor-pointer group"
                >
                    <div className="flex flex-col items-center justify-center gap-4">
                        <div className="p-4 bg-yellow-50 rounded-full text-yellow-600 group-hover:scale-110 transition-transform duration-300">
                            {exporting ? <Loader2 className="animate-spin" size={32} /> : <FileJson size={32} />}
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-lg text-text-main group-hover:text-yellow-700 transition-colors">JSON (.json)</h3>
                            <p className="text-sm text-text-muted">Données brutes structurées</p>
                        </div>
                    </div>
                </div>
            </div>

            <Card className="border-none shadow-lg shadow-gray-100/50 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-border">
                    <h3 className="font-bold text-lg text-text-main mb-4">Aperçu des données</h3>

                    {/* Filters Section */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1.5">Rechercher</label>
                            <input
                                type="text"
                                placeholder="Nom de l'article..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1.5">Catégorie</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-4 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-all duration-200"
                            >
                                <option value="">Toutes</option>
                                <option value="Shop">Shop</option>
                                <option value="Café">Café</option>
                                <option value="Bosch Service">Bosch Service</option>
                                <option value="Lubrifiants">Lubrifiants</option>
                            </select>
                        </div>
                        <div>
                            <DateInput
                                label="Date début"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <DateInput
                                label="Date fin"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin text-primary" size={32} />
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider bg-gray-50/50">
                                    <th className="py-4 px-6 font-semibold">Date</th>
                                    <th className="py-4 px-6 font-semibold">Article</th>
                                    <th className="py-4 px-6 font-semibold text-right">Quantité</th>
                                    <th className="py-4 px-6 font-semibold text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {salesData.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="py-8 text-center text-text-muted">Aucune donnée disponible</td>
                                    </tr>
                                ) : (
                                    salesData.slice(0, 10).map((row, i) => (
                                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-4 px-6 text-text-main font-medium">{row.date}</td>
                                            <td className="py-4 px-6 text-text-main">{row.article}</td>
                                            <td className="py-4 px-6 text-right text-text-main">{row.quantity}</td>
                                            <td className="py-4 px-6 text-right font-bold text-primary">{row.total} MAD</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>
        </div>
    );
}
