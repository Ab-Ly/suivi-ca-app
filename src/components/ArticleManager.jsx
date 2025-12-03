import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export default function ArticleManager({ isOpen, onClose }) {
    const [formData, setFormData] = useState({
        name: '',
        category: 'shop',
        type: 'stockable',
        price: '',
        initialStock: ''
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase
                .from('articles')
                .insert({
                    name: formData.name,
                    category: formData.category,
                    type: formData.type,
                    price: parseFloat(formData.price),
                    current_stock: formData.type === 'stockable' ? parseInt(formData.initialStock || 0) : 0
                });

            if (error) throw error;

            onClose();
            setFormData({ name: '', category: 'shop', type: 'stockable', price: '', initialStock: '' });
        } catch (error) {
            console.error('Error creating article:', error);
            alert('Erreur lors de la création de l\'article.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Ajouter un Article">
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

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-notion-gray mb-1">Type</label>
                        <select
                            name="type"
                            className="w-full px-3 py-2 border border-notion-border rounded-md focus:outline-none focus:ring-1 focus:ring-notion-gray"
                            value={formData.type}
                            onChange={handleChange}
                        >
                            <option value="stockable">Stockable</option>
                            <option value="service">Service</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-notion-gray mb-1">Catégorie</label>
                        <select
                            name="category"
                            className="w-full px-3 py-2 border border-notion-border rounded-md focus:outline-none focus:ring-1 focus:ring-notion-gray"
                            value={formData.category}
                            onChange={handleChange}
                        >
                            <option value="shop">Shop</option>
                            <option value="cafe">Café</option>
                            <option value="bosch_service">Bosch Service</option>
                            <option value="lubricant_piste">Lubrifiant Piste</option>
                            <option value="lubricant_bosch">Lubrifiant Bosch</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-notion-gray mb-1">Prix (MAD)</label>
                        <input
                            type="number"
                            name="price"
                            required
                            className="w-full px-3 py-2 border border-notion-border rounded-md focus:outline-none focus:ring-1 focus:ring-notion-gray"
                            value={formData.price}
                            onChange={handleChange}
                        />
                    </div>
                    {formData.type === 'stockable' && (
                        <div>
                            <label className="block text-sm font-medium text-notion-gray mb-1">Stock Initial</label>
                            <input
                                type="number"
                                name="initialStock"
                                className="w-full px-3 py-2 border border-notion-border rounded-md focus:outline-none focus:ring-1 focus:ring-notion-gray"
                                value={formData.initialStock}
                                onChange={handleChange}
                            />
                        </div>
                    )}
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-notion-text text-white py-2 rounded-md font-medium hover:bg-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading && <Loader2 className="animate-spin" size={18} />}
                        {loading ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
