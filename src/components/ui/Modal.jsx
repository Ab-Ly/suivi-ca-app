import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export function Modal({ isOpen, onClose, title, children, className }) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className={cn("bg-white rounded-2xl sm:rounded-lg shadow-xl w-full max-w-md max-h-[95vh] sm:max-h-[90vh] flex flex-col", className)} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-notion-border shrink-0">
                    <h3 className="font-semibold text-lg">{title}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-notion-sidebar rounded-md transition-colors">
                        <X size={20} className="text-notion-gray hover:text-notion-text" />
                    </button>
                </div>
                <div className="p-3 sm:p-4 overflow-y-auto flex-1">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
