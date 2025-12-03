import React, { forwardRef } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { Calendar } from 'lucide-react';
import { fr } from 'date-fns/locale/fr';
import "react-datepicker/dist/react-datepicker.css";

registerLocale('fr', fr);

export const DateInput = ({ value, onChange, label, className = '', ...props }) => {
    // Convert string YYYY-MM-DD to Date object for the picker
    const selectedDate = value ? new Date(value) : null;

    const handleDateChange = (date) => {
        if (date) {
            // Convert back to YYYY-MM-DD string for parent component compatibility
            // Adjust for timezone offset to ensure the date string is correct
            const offset = date.getTimezoneOffset();
            const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
            onChange({ target: { value: adjustedDate.toISOString().split('T')[0] } });
        } else {
            onChange({ target: { value: '' } });
        }
    };

    // Custom Input Component to maintain the existing UI look
    const CustomInput = forwardRef(({ value, onClick }, ref) => (
        <div className="relative group cursor-pointer" onClick={onClick} ref={ref}>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar size={16} className="text-text-muted group-hover:text-primary transition-colors" />
            </div>
            <input
                type="text"
                readOnly
                value={value}
                className="block w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-border rounded-xl shadow-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-text-main hover:border-gray-300 cursor-pointer"
                {...props}
            />
        </div>
    ));

    return (
        <div className={className}>
            {label && <label className="block text-xs font-medium text-text-muted mb-1.5">{label}</label>}
            <DatePicker
                selected={selectedDate}
                onChange={handleDateChange}
                dateFormat="dd/MM/yyyy"
                locale="fr"
                customInput={<CustomInput />}
                showPopperArrow={false}
                calendarClassName="shadow-xl border-0 rounded-xl font-sans overflow-hidden"
                dayClassName={() => "rounded-lg hover:bg-gray-100"}
                popperClassName="!z-[9999]"
            />
        </div>
    );
};
