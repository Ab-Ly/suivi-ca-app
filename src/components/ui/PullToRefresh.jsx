import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

export const PullToRefresh = ({ onRefresh, children, className = '' }) => {
    const [startY, setStartY] = useState(0);
    const [currentY, setCurrentY] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const contentRef = useRef(null);
    const threshold = 150; // Pull distance to trigger refresh

    const handleTouchStart = (e) => {
        // Only enable pull if scrolled to top
        if (contentRef.current && contentRef.current.scrollTop === 0) {
            setStartY(e.touches[0].clientY);
        }
    };

    const handleTouchMove = (e) => {
        if (startY === 0 || refreshing) return;

        const touchY = e.touches[0].clientY;
        const diff = touchY - startY;

        // Only allow pulling down
        if (diff > 0 && contentRef.current && contentRef.current.scrollTop === 0) {
            // Add resistance
            setCurrentY(diff * 0.4);
            // Prevent default only if we are pulling down at the top
            if (e.cancelable) e.preventDefault();
        }
    };

    const handleTouchEnd = async () => {
        if (startY === 0 || refreshing) return;

        if (currentY > 60) { // Trigger threshold
            setRefreshing(true);
            setCurrentY(60); // Snap to loading position
            try {
                await onRefresh();
            } finally {
                setRefreshing(false);
                setCurrentY(0);
            }
        } else {
            setCurrentY(0); // Snap back
        }
        setStartY(0);
    };

    return (
        <div
            className={`relative overflow-hidden flex flex-col ${className}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Loading Indicator */}
            <div
                className="absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none transition-transform duration-200 ease-out"
                style={{
                    height: '60px',
                    transform: `translateY(${currentY - 60}px)`
                }}
            >
                {refreshing ? (
                    <Loader2 className="animate-spin text-primary" size={24} />
                ) : (
                    <div
                        className="text-text-muted text-xs font-medium transition-opacity duration-200"
                        style={{ opacity: currentY > 30 ? 1 : 0 }}
                    >
                        {currentY > 60 ? 'Relâcher pour actualiser' : 'Tirer pour actualiser'}
                    </div>
                )}
            </div>

            {/* Content */}
            <div
                ref={contentRef}
                className="flex-1 overflow-y-auto transition-transform duration-200 ease-out"
                style={{ transform: `translateY(${currentY}px)` }}
            >
                {children}
            </div>
        </div>
    );
};
