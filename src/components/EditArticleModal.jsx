import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export default function EditArticleModal({ isOpen, onClose, article, onSuccess }) {
    const [formData, setFormData] = useState({
        name: '',
        category: 'Shop',
        price: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (article) {
            setFormData({
                name: article.name || '',
                category: article.category || 'Shop',
                price: article.price?.toString() || ''
            });
        }
    }, [article]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!article) return;
        setLoading(true);

        try {
            const { error } = await supabase
                .from('articles')
                .update({
                    name: formData.name,
                    category: formData.category,
                    price: parseFloat(formData.price)
                })
                .eq('id', article.id);

            if (error) throw error;

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error updating article:', error);
            alert('Erreur lors de la modification de l\'article.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Modifier l'Article">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-notion-gray mb-1">Nom de l'article</label>
                    <input
                        type="text"
                        name="name"
                        required
                        className="w-full px-3 py-2 border border-notion-border rounded-md focus:outline-none focus:ring-1 focus:ring-notion-gray"
                        value={formData.name}
                        onChange={handleChange}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-notion-gray mb-1">Catégorie</label>
                    <select
                        name="category"
                        className="w-full px-3 py-2 border border-notion-border rounded-md focus:outline-none focus:ring-1 focus:ring-notion-gray"
                        value={formData.category}
                        onChange={handleChange}
                    >
                        <option value="Shop">Shop</option>
                        <option value="Café">Café</option>
                        <option value="Bosch Service">Bosch Service</option>
                        <option value="Pneumatique">Pneumatique</option>
                        <option value="Lubrifiants">Lubrifiants</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-notion-gray mb-1">Prix (MAD)</label>
                    <input
                        type="number"
                        name="price"
                        step="0.01"
                        required
                        className="w-full px-3 py-2 border border-notion-border rounded-md focus:outline-none focus:ring-1 focus:ring-notion-gray"
                        value={formData.price}
                        onChange={handleChange}
                    />
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-notion-text text-white py-2 rounded-md font-medium hover:bg-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading && <Loader2 className="animate-spin" size={18} />}
                        {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
