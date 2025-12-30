import { supabase } from '../lib/supabase';

/**
 * Fetches all relevant data from the database.
 * @returns {Promise<Object>} An object containing arrays of data for each table.
 */
export const fetchAllData = async () => {
    const tables = [
        'sales',
        'fuel_sales',
        'daily_cash_operations',
        'daily_cash_entities',
        'articles',
        'fuel_receptions',
        'fuel_reception_items',
        'employees',
        'employee_absences',
        'medical_tracking',
        'stock_movements',
        'money_countings'
    ];

    const backupData = {};
    const errors = [];

    for (const table of tables) {
        try {
            const { data, error } = await supabase.from(table).select('*');
            if (error) {
                throw error;
            }
            backupData[table] = data;
        } catch (err) {
            console.error(`Error fetching data for table ${table}:`, err);
            errors.push({ table, error: err.message });
            // We continue fetching other tables even if one fails, 
            // but we note the error.
            backupData[table] = [];
        }
    }

    if (errors.length > 0) {
        backupData._errors = errors;
    }

    // Add metadata
    backupData._meta = {
        timestamp: new Date().toISOString(),
        version: '1.0'
    };

    return backupData;
};

/**
 * Triggers a download of the provided data as a JSON file.
 * @param {Object} data - The data object to save.
 * @param {string} filename - The name of the file to save.
 */
export const downloadJSON = (data, filename = 'backup.json') => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Orchestrates the full backup process.
 */
export const performFullBackup = async () => {
    const data = await fetchAllData();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_suivi_ca_${timestamp}.json`;
    downloadJSON(data, filename);
    return data;
};

/**
 * Restores data from a backup object.
 * @param {Object} backupData - The parsed JSON backup data.
 * @returns {Promise<Object>} Result status.
 */
export const restoreFromBackup = async (backupData) => {
    // dependency order is critical
    const tableOrder = [
        'articles',
        'employees',
        'daily_cash_entities',
        'sales',
        'fuel_sales',
        'stock_movements',
        'fuel_receptions',
        'fuel_reception_items',
        'daily_cash_operations',
        'employee_absences',
        'medical_tracking',
        'money_countings'
    ];

    const results = {
        success: true,
        details: {},
        errors: []
    };

    for (const table of tableOrder) {
        if (backupData[table] && Array.isArray(backupData[table]) && backupData[table].length > 0) {
            try {
                // We use upsert to update existing or insert new.
                // ignoreDuplicates: false (default) means update if exists.
                const { error } = await supabase
                    .from(table)
                    .upsert(backupData[table]);

                if (error) throw error;

                results.details[table] = `Restored ${backupData[table].length} records`;
            } catch (err) {
                console.error(`Error restoring table ${table}:`, err);
                results.success = false;
                results.errors.push({ table, error: err.message });
                // We might want to stop or continue? For now, continue but mark failed.
            }
        }
    }

    return results;
};
