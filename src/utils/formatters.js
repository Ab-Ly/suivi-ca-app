export const formatPrice = (amount) => {
    if (amount === undefined || amount === null) return '0 DH';
    return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ') + ' DH';
};

export const formatNumber = (number, decimals = 0) => {
    if (number === undefined || number === null) return '0';
    return number.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).replace(/\s/g, ' ');
};

export const getArticleWeightInKg = (name = '', category = '', quantity = 1) => {
    if (!name) return null;
    const cleanName = name.toLowerCase();
    const cleanCat = (category || '').toLowerCase();
    const qty = Number(quantity) || 0;

    // 1. Check if it's a known liquid/grease product
    const isWaterBasedLiquid = cleanName.includes('adblue') || 
                               cleanName.includes('ad blue') || 
                               cleanName.includes('refroidissement') || 
                               cleanName.includes('lave glace') || 
                               cleanName.includes('lave-glace') || 
                               cleanName.includes('batterie');

    const isLubricant = cleanCat.includes('lubrif') || 
                        cleanName.includes('huile') || 
                        cleanName.includes('lubrif') ||
                        cleanName.includes('graisse');

    if (!isWaterBasedLiquid && !isLubricant) {
        return null; // Not a tracked liquid, do not display weight
    }

    // 2. Determine Density
    let density = 1.0; // Default density (AdBlue, Coolant, Battery Water, Windshield washer, etc. = 1.0 kg/L)
    if (isLubricant && !isWaterBasedLiquid) {
        density = 0.9; // Lubricant oil / Grease = 0.9 kg/L (or kg/kg capacity factor)
    }

    // 3. Special case for KG products (e.g., "Graisse 180 KG" stored in units)
    const kgMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*kg/);
    if (kgMatch) {
        const kgCapacity = parseFloat(kgMatch[1]);
        return kgCapacity * density * qty; // e.g. 180 KG * 0.9 * qty
    }

    // 4. Special case for drums (Fûts) of 205L and 180L (stored in Liters)
    const isDrum205Or180 = cleanName.includes('205') || cleanName.includes('180');
    if (isDrum205Or180) {
        return qty * density;
    }

    // 5. Parse Volume from name
    let volumeLiters = null;

    const mlMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*ml/);
    if (mlMatch) {
        const mlValue = parseFloat(mlMatch[1]);
        if (mlValue === 300) {
            return 0.3 * qty; // Force 300ml of any liquid to weigh 0.3 kg
        }
        volumeLiters = mlValue / 1000;
    } else {
        const lMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*l/);
        if (lMatch) {
            volumeLiters = parseFloat(lMatch[1]);
        }
    }

    // Default to 1L if no volume was found
    if (volumeLiters === null) {
        volumeLiters = 1.0;
    }

    return volumeLiters * density * qty;
};
