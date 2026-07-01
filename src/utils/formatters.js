export const formatPrice = (amount) => {
    if (amount === undefined || amount === null) return '0 DH';
    return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ') + ' DH';
};

export const formatNumber = (number, decimals = 0) => {
    if (number === undefined || number === null) return '0';
    return number.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).replace(/\s/g, ' ');
};
