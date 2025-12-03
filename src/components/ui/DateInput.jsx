import React from 'react';
import { Calendar } from 'lucide-react';

export const DateInput = ({ value, onChange, label, className = '', ...props }) => {
    return (
        <div className={className}>
            {label && <label className="block text-xs font-medium text-text-muted mb-1.5">{label}</label>}
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar size={16} className="text-text-muted group-focus-within:text-primary transition-colors" />
                </div>
                <input
                    type="date"
                    value={value}
                    onChange={onChange}
                    className="block w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-border rounded-xl shadow-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-text-main hover:border-gray-300"
                    {...props}
                />
            </div>
        </div>
    );
};
