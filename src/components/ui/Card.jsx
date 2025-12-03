import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export function Card({ children, className, ...props }) {
    return (
        <div className={cn("bg-white border border-notion-border rounded-md shadow-sm p-4", className)} {...props}>
            {children}
        </div>
    );
}

export function CardHeader({ title, description, action }) {
    return (
        <div className="flex items-center justify-between mb-4">
            <div>
                <h3 className="font-semibold text-lg">{title}</h3>
                {description && <p className="text-sm text-notion-gray">{description}</p>}
            </div>
            {action && <div>{action}</div>}
        </div>
    );
}

export function StatCard({ title, value, subtext, icon: Icon, trend }) {
    return (
        <Card>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-notion-gray font-medium">{title}</p>
                    <h4 className="text-2xl font-bold mt-1">{value}</h4>
                    {subtext && <p className="text-xs text-notion-gray mt-1">{subtext}</p>}
                </div>
                {Icon && <div className="p-2 bg-notion-sidebar rounded-md"><Icon size={20} className="text-notion-text" /></div>}
            </div>
            {trend && (
                <div className={cn("text-xs font-medium mt-3", trend > 0 ? "text-green-600" : "text-red-600")}>
                    {trend > 0 ? "+" : ""}{trend}% vs last period
                </div>
            )}
        </Card>
    );
}
