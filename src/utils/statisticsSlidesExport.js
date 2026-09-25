import pptxgen from 'pptxgenjs';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { formatPrice, formatNumber } from './formatters';

const MONTHS_NAMES = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

/**
 * Palette Épurée & Lumineuse Top Tendance 2026
 * Style épuré, contraste optimal, aucun fond noir, cartes aérées et accents colorés
 */
const THEME = {
    bgSlide: 'FFFFFF',        // Fond de slide blanc pur
    bgCard: 'F8FAFC',         // Fond carte slate 50
    bgCardWhite: 'FFFFFF',    // Fond carte blanc pur
    borderLight: 'E2E8F0',    // Bordure slate 200
    borderStrong: 'CBD5E1',   // Bordure slate 300
    
    // Typographie
    textHeading: '0F172A',    // Slate 900
    textBody: '334155',       // Slate 700
    textMuted: '64748B',      // Slate 500
    
    // Accents
    primary: '4F46E5',        // Indigo 600
    primaryLight: 'EEF2FF',   // Indigo 50
    primaryBorder: 'C7D2FE',  // Indigo 200
    
    secondary: '0284C7',      // Sky 600
    secondaryLight: 'F0F9FF', // Sky 50
    
    emerald: '059669',        // Vert émeraude
    emeraldLight: 'ECFDF5',   // Vert clair 50
    emeraldBorder: 'A7F3D0',  // Vert bordure
    
    rose: 'E11D48',           // Rose / Rouge alerte
    roseLight: 'FFF1F2',      // Rose clair
    roseBorder: 'FECDD3',     // Rose bordure
    
    orange: 'EA580C',         // Gasoil orange vif
    orangeLight: 'FFF7ED',    // Orange clair
    orangeBorder: 'FED7AA',   // Orange bordure
    
    greenFuel: '16A34A',      // SSP Vert
    greenFuelLight: 'F0FDF4', // SSP Vert clair
    greenFuelBorder: 'BBF7D0',// SSP Vert bordure
    
    blueLub: '2563EB',        // Bleu lubrifiants
    blueLubLight: 'EFF6FF',   // Bleu lub clair
    blueLubBorder: 'BFDBFE'   // Bleu lub bordure
};

/**
 * Dimensions Widescreen 16:9 (13.333 x 7.5 pouces)
 */
const LAYOUT = {
    slideW: 13.333,
    slideH: 7.5,
    marginL: 0.8,
    marginR: 0.8,
    usableW: 11.733
};

/**
 * Tracés SVG des icônes modernes (style Lucide 2026)
 */
const SVG_ICONS = {
    wallet: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><circle cx="16" cy="14" r="1.5"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    trendingUp: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    trendingDown: '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>',
    fuel: '<path d="M3 22V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v17"/><path d="M13 10h4a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9l-3-3"/><circle cx="8" cy="9" r="2"/>',
    droplet: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
    award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
    shieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
    barChart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><line x1="2" y1="7" x2="22" y2="7"/>',
    scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h18"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>',
    lightbulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    sparkles: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>'
};

/**
 * Rendu d'icône vectorielle ultra-nette avec badge squircle moderne (PNG haute résolution 128x128)
 */
const renderIconBadge = (svgKey, strokeColorHex, bgColorHex = null, size = 128) => {
    return new Promise((resolve) => {
        try {
            if (typeof document === 'undefined') {
                resolve(null);
                return;
            }
            const svgPath = SVG_ICONS[svgKey];
            if (!svgPath) {
                resolve(null);
                return;
            }

            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(null);
                return;
            }

            // Fond arrondi moderne (Squircle / rounded rectangle doux)
            if (bgColorHex) {
                const r = size * 0.28;
                ctx.fillStyle = bgColorHex.startsWith('#') ? bgColorHex : `#${bgColorHex}`;
                ctx.beginPath();
                ctx.moveTo(r, 0);
                ctx.lineTo(size - r, 0);
                ctx.quadraticCurveTo(size, 0, size, r);
                ctx.lineTo(size, size - r);
                ctx.quadraticCurveTo(size, size, size - r, size);
                ctx.lineTo(r, size);
                ctx.quadraticCurveTo(0, size, 0, size - r);
                ctx.lineTo(0, r);
                ctx.quadraticCurveTo(0, 0, r, 0);
                ctx.closePath();
                ctx.fill();
            }

            // Dessiner l'icône SVG
            const strokeColor = strokeColorHex.startsWith('#') ? strokeColorHex : `#${strokeColorHex}`;
            const iconSize = Math.round(size * 0.52);
            const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg>`;
            const img = new Image();
            const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            img.onload = () => {
                const offset = (size - iconSize) / 2;
                ctx.drawImage(img, offset, offset, iconSize, iconSize);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(null);
            };
            img.src = url;
        } catch (e) {
            resolve(null);
        }
    });
};

/**
 * Génère toutes les icônes nécessaires à la présentation en parallèle
 */
const generatePresentationIcons = async (isGlobalPositive, fuelKpis, lubKpis) => {
    const iconPromises = {
        caCurrent: renderIconBadge('wallet', THEME.primary, THEME.primaryLight),
        caPrev: renderIconBadge('calendar', THEME.textMuted, THEME.bgCard),
        growth: renderIconBadge(isGlobalPositive ? 'trendingUp' : 'trendingDown', isGlobalPositive ? THEME.emerald : THEME.rose, isGlobalPositive ? THEME.emeraldLight : THEME.roseLight),
        fuelMini: renderIconBadge('fuel', THEME.orange, THEME.orangeLight),
        lubMini: renderIconBadge('droplet', THEME.blueLub, THEME.blueLubLight),
        healthMini: renderIconBadge(isGlobalPositive ? 'award' : 'shieldCheck', isGlobalPositive ? THEME.emerald : THEME.rose, isGlobalPositive ? THEME.emeraldLight : THEME.roseLight),
        timeTrend: renderIconBadge('barChart', THEME.primary, THEME.primaryLight),
        categories: renderIconBadge('store', THEME.primary, THEME.primaryLight),
        fuelGasoil: renderIconBadge('fuel', THEME.orange, THEME.orangeLight),
        fuelSSP: renderIconBadge('fuel', THEME.greenFuel, THEME.greenFuelLight),
        lubLitres: renderIconBadge('droplet', THEME.blueLub, THEME.blueLubLight),
        lubKg: renderIconBadge('scale', THEME.textMuted, THEME.bgCard),
        lubDh: renderIconBadge('award', THEME.emerald, THEME.emeraldLight),
        growthRocket: renderIconBadge('rocket', THEME.emerald, THEME.emeraldLight),
        stratLightbulb: renderIconBadge('lightbulb', THEME.primary, THEME.primaryLight)
    };

    const keys = Object.keys(iconPromises);
    const results = await Promise.all(Object.values(iconPromises));
    const icons = {};
    keys.forEach((key, idx) => {
        icons[key] = results[idx];
    });
    return icons;
};

/**
 * Injection automatique des transitions douces (Fade / Fondu moderne)
 * 100% compatible Google Slides, Microsoft PowerPoint & Apple Keynote
 */
const injectSlideTransitions = async (pptxBuffer) => {
    try {
        const zip = await JSZip.loadAsync(pptxBuffer);
        const slideFiles = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name));
        
        // Transition douce moderne (Fade)
        const transitionXml = '<p:transition spd="med" advClick="1"><p:fade/></p:transition>';

        for (const file of slideFiles) {
            let content = await zip.file(file).async('string');
            if (content.includes('</p:sld>') && !content.includes('<p:transition')) {
                content = content.replace('</p:sld>', transitionXml + '</p:sld>');
                zip.file(file, content);
            }
        }
        return await zip.generateAsync({ type: 'arraybuffer' });
    } catch (e) {
        console.warn('Transition injection notice:', e);
        return pptxBuffer;
    }
};

/**
 * Format helper for periods
 */
const getPeriodLabel = (period, year, selectedMonth, customStartMonth, customEndMonth) => {
    if (period === 'year') {
        return `Bilan Annuel ${year} (vs ${year - 1})`;
    } else if (period === 'month') {
        return `Bilan Mensuel : ${MONTHS_NAMES[selectedMonth]} ${year} (vs ${year - 1})`;
    } else if (period === 'custom') {
        return `Période Spécifique : ${MONTHS_NAMES[customStartMonth]} à ${MONTHS_NAMES[customEndMonth]} ${year} (vs ${year - 1})`;
    } else if (period === 'week') {
        return `Bilan Hebdomadaire (Semaine en cours vs ${year - 1})`;
    } else {
        return `Bilan Journalier (Aujourd'hui vs N-1)`;
    }
};

/**
 * En-tête de diapositive moderne 2026
 */
const addSlideHeader = (slide, title, categorySubtitle, periodLabel, headerIcon = null) => {
    // Bandeau supérieur moderne
    slide.addShape('rect', {
        x: LAYOUT.marginL, y: 0.35, w: LAYOUT.usableW, h: 0.9,
        fill: { color: THEME.bgCard },
        line: { color: THEME.borderLight, width: 1 }
    });

    // Ligne d'accent supérieure fine
    slide.addShape('rect', {
        x: LAYOUT.marginL, y: 0.35, w: LAYOUT.usableW, h: 0.04,
        fill: { color: THEME.primary },
        line: { type: 'none' }
    });

    let textOffsetX = LAYOUT.marginL + 0.25;

    // Icône de header si présente
    if (headerIcon) {
        slide.addImage({
            data: headerIcon,
            x: LAYOUT.marginL + 0.2,
            y: 0.5,
            w: 0.55,
            h: 0.55
        });
        textOffsetX += 0.65;
    }

    // Tag / Catégorie
    slide.addText(categorySubtitle.toUpperCase(), {
        x: textOffsetX, y: 0.45, w: 6.5, h: 0.25,
        fontSize: 8.5, bold: true, color: THEME.primary, fontFace: 'Segoe UI'
    });

    // Titre de la slide
    slide.addText(title, {
        x: textOffsetX, y: 0.72, w: 7.0, h: 0.45,
        fontSize: 15, bold: true, color: THEME.textHeading, fontFace: 'Segoe UI'
    });

    // Badge Période à droite (aspect pill)
    slide.addText(periodLabel, {
        x: LAYOUT.marginL + 7.5, y: 0.58, w: LAYOUT.usableW - 7.7, h: 0.45,
        fontSize: 10, bold: true, color: THEME.textMuted, align: 'right', fontFace: 'Segoe UI'
    });
};

/**
 * Footer institutionnel avec numérotation moderne
 */
const addSlideFooter = (slide, slideNum, totalSlides = 7) => {
    slide.addShape('line', {
        x: LAYOUT.marginL, y: 6.85, w: LAYOUT.usableW, h: 0,
        line: { color: THEME.borderLight, width: 1 }
    });

    slide.addText('Petrom - Suivi du Chiffre d\'Affaires | Export Google Slides & PowerPoint 2026', {
        x: LAYOUT.marginL, y: 6.9, w: 8.0, h: 0.35,
        fontSize: 8.5, color: THEME.textMuted, fontFace: 'Segoe UI'
    });

    slide.addText(`Diapositive ${slideNum} / ${totalSlides}`, {
        x: LAYOUT.marginL + 8.5, y: 6.9, w: LAYOUT.usableW - 8.5, h: 0.35,
        fontSize: 8.5, bold: true, color: THEME.textMuted, align: 'right', fontFace: 'Segoe UI'
    });
};

export const exportStatisticsToSlides = async (statsData) => {
    const {
        period,
        year,
        selectedMonth,
        customStartMonth,
        customEndMonth,
        kpis = { currentTotal: 0, previousTotal: 0, growth: 0 },
        categoryDetails = [],
        data = [],
        fuelKpis = { gasoil: 0, ssp: 0, gasoilPrev: 0, sspPrev: 0, gasoilGrowth: 0, sspGrowth: 0 },
        fuelData = [],
        fuelRevenueKpis = { gasoil: 0, ssp: 0, gasoilPrev: 0, sspPrev: 0, gasoilGrowth: 0, sspGrowth: 0 },
        fuelRevenueData = [],
        lubKpis = { liters: 0, kg: 0, val: 0, litersPrev: 0, kgPrev: 0, valPrev: 0, litersGrowth: 0, kgGrowth: 0, valGrowth: 0 },
        lubData = []
    } = statsData;

    const isGlobalPositive = (kpis.growth || 0) >= 0;

    // Pré-génération des icônes vectorielles en badges modernes 2026
    const icons = await generatePresentationIcons(isGlobalPositive, fuelKpis, lubKpis);

    const pres = new pptxgen();
    pres.layout = 'LAYOUT_WIDE';
    pres.title = `Rapport Statistique - ${year}`;
    pres.subject = 'Suivi du Chiffre d\'Affaires Petrom';
    pres.author = 'Petrom Suivi CA';

    const periodLabel = getPeriodLabel(period, year, selectedMonth, customStartMonth, customEndMonth);

    // =========================================================================
    // SLIDE 1 : COUVERTURE & SYNTHÈSE EXÉCUTIVE MODERNE
    // =========================================================================
    {
        const slide = pres.addSlide();
        slide.bkgd = THEME.bgSlide;

        // Header de couverture épuré
        slide.addShape('rect', {
            x: LAYOUT.marginL, y: 0.5, w: 2.3, h: 0.32,
            fill: { color: THEME.primaryLight },
            line: { color: THEME.primaryBorder, width: 1 }
        });
        slide.addText('PETROM EXECUTIVE DECK', {
            x: LAYOUT.marginL + 0.1, y: 0.5, w: 2.1, h: 0.32,
            fontSize: 9, bold: true, color: THEME.primary, align: 'center', fontFace: 'Segoe UI'
        });

        slide.addText(periodLabel, {
            x: LAYOUT.marginL, y: 0.95, w: LAYOUT.usableW, h: 0.65,
            fontSize: 26, bold: true, color: THEME.textHeading, fontFace: 'Segoe UI'
        });

        slide.addText(`Généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} • Analyse consolidée de performance`, {
            x: LAYOUT.marginL, y: 1.65, w: LAYOUT.usableW, h: 0.3,
            fontSize: 10, color: THEME.textMuted, fontFace: 'Segoe UI'
        });

        // 3 Grandes Cartes KPI Principales avec Icon Badges
        const cardW = 3.65;
        const cardH = 2.5;
        const startY = 2.15;

        // CARTE 1 : Chiffre d'Affaires N
        slide.addShape('rect', {
            x: LAYOUT.marginL, y: startY, w: cardW, h: cardH,
            fill: { color: THEME.bgCard },
            line: { color: THEME.primaryBorder, width: 1.5 }
        });
        slide.addShape('rect', {
            x: LAYOUT.marginL, y: startY, w: cardW, h: 0.05,
            fill: { color: THEME.primary },
            line: { type: 'none' }
        });
        if (icons.caCurrent) {
            slide.addImage({
                data: icons.caCurrent,
                x: LAYOUT.marginL + cardW - 0.75,
                y: startY + 0.2,
                w: 0.55,
                h: 0.55
            });
        }
        slide.addText(`CHIFFRE D'AFFAIRES (${year})`, {
            x: LAYOUT.marginL + 0.25, y: startY + 0.22, w: cardW - 1.1, h: 0.3,
            fontSize: 9.5, bold: true, color: THEME.primary, fontFace: 'Segoe UI'
        });
        slide.addText(formatPrice(kpis.currentTotal), {
            x: LAYOUT.marginL + 0.25, y: startY + 0.68, w: cardW - 0.5, h: 0.7,
            fontSize: 22, bold: true, color: THEME.textHeading, fontFace: 'Segoe UI'
        });
        slide.addText('Total des ventes réalisées sur l\'exercice', {
            x: LAYOUT.marginL + 0.25, y: startY + 1.65, w: cardW - 0.5, h: 0.4,
            fontSize: 9, color: THEME.textMuted, fontFace: 'Segoe UI'
        });

        // CARTE 2 : Chiffre d'Affaires N-1
        slide.addShape('rect', {
            x: LAYOUT.marginL + cardW + 0.39, y: startY, w: cardW, h: cardH,
            fill: { color: THEME.bgCard },
            line: { color: THEME.borderLight, width: 1.5 }
        });
        slide.addShape('rect', {
            x: LAYOUT.marginL + cardW + 0.39, y: startY, w: cardW, h: 0.05,
            fill: { color: THEME.borderStrong },
            line: { type: 'none' }
        });
        if (icons.caPrev) {
            slide.addImage({
                data: icons.caPrev,
                x: LAYOUT.marginL + (cardW * 2) + 0.39 - 0.75,
                y: startY + 0.2,
                w: 0.55,
                h: 0.55
            });
        }
        slide.addText(`EXERCICE PRÉCÉDENT (${year - 1})`, {
            x: LAYOUT.marginL + cardW + 0.64, y: startY + 0.22, w: cardW - 1.1, h: 0.3,
            fontSize: 9.5, bold: true, color: THEME.textMuted, fontFace: 'Segoe UI'
        });
        slide.addText(formatPrice(kpis.previousTotal), {
            x: LAYOUT.marginL + cardW + 0.64, y: startY + 0.68, w: cardW - 0.5, h: 0.7,
            fontSize: 22, bold: true, color: THEME.textBody, fontFace: 'Segoe UI'
        });
        slide.addText('Période de référence pour le benchmark', {
            x: LAYOUT.marginL + cardW + 0.64, y: startY + 1.65, w: cardW - 0.5, h: 0.4,
            fontSize: 9, color: THEME.textMuted, fontFace: 'Segoe UI'
        });

        // CARTE 3 : Évolution & Tendance
        const growthColor = isGlobalPositive ? THEME.emerald : THEME.rose;
        const growthBg = isGlobalPositive ? THEME.emeraldLight : THEME.roseLight;
        const growthBorder = isGlobalPositive ? THEME.emeraldBorder : THEME.roseBorder;
        slide.addShape('rect', {
            x: LAYOUT.marginL + (cardW * 2) + 0.78, y: startY, w: cardW, h: cardH,
            fill: { color: growthBg },
            line: { color: growthBorder, width: 1.5 }
        });
        slide.addShape('rect', {
            x: LAYOUT.marginL + (cardW * 2) + 0.78, y: startY, w: cardW, h: 0.05,
            fill: { color: growthColor },
            line: { type: 'none' }
        });
        if (icons.growth) {
            slide.addImage({
                data: icons.growth,
                x: LAYOUT.marginL + (cardW * 3) + 0.78 - 0.75,
                y: startY + 0.2,
                w: 0.55,
                h: 0.55
            });
        }
        slide.addText('ÉVOLUTION GLOBALE', {
            x: LAYOUT.marginL + (cardW * 2) + 1.03, y: startY + 0.22, w: cardW - 1.1, h: 0.3,
            fontSize: 9.5, bold: true, color: growthColor, fontFace: 'Segoe UI'
        });
        slide.addText(`${isGlobalPositive ? '+' : ''}${kpis.growth.toFixed(1)}%`, {
            x: LAYOUT.marginL + (cardW * 2) + 1.03, y: startY + 0.68, w: cardW - 0.5, h: 0.7,
            fontSize: 24, bold: true, color: growthColor, fontFace: 'Segoe UI'
        });
        slide.addText(`Écart net : ${isGlobalPositive ? '+' : ''}${formatPrice(kpis.currentTotal - kpis.previousTotal)}`, {
            x: LAYOUT.marginL + (cardW * 2) + 1.03, y: startY + 1.65, w: cardW - 0.5, h: 0.4,
            fontSize: 10, bold: true, color: growthColor, fontFace: 'Segoe UI'
        });

        // 3 Mini Synthèses Métiers avec Icon Badges
        const miniW = 3.65;
        const miniH = 1.6;
        const miniY = 4.9;

        // Mini 1 : Carburant
        slide.addShape('rect', {
            x: LAYOUT.marginL, y: miniY, w: miniW, h: miniH,
            fill: { color: THEME.orangeLight },
            line: { color: THEME.orangeBorder, width: 1.2 }
        });
        if (icons.fuelMini) {
            slide.addImage({
                data: icons.fuelMini,
                x: LAYOUT.marginL + miniW - 0.65,
                y: miniY + 0.15,
                w: 0.48,
                h: 0.48
            });
        }
        slide.addText('PÔLE CARBURANTS', {
            x: LAYOUT.marginL + 0.2, y: miniY + 0.15, w: miniW - 0.9, h: 0.25,
            fontSize: 9, bold: true, color: THEME.orange, fontFace: 'Segoe UI'
        });
        slide.addText(formatPrice((fuelRevenueKpis.gasoil || 0) + (fuelRevenueKpis.ssp || 0)), {
            x: LAYOUT.marginL + 0.2, y: miniY + 0.45, w: miniW - 0.4, h: 0.45,
            fontSize: 15, bold: true, color: THEME.textHeading, fontFace: 'Segoe UI'
        });
        slide.addText(`Volume : ${formatNumber((fuelKpis.gasoil || 0) + (fuelKpis.ssp || 0))} Litres distribués`, {
            x: LAYOUT.marginL + 0.2, y: miniY + 1.02, w: miniW - 0.4, h: 0.3,
            fontSize: 8.5, color: THEME.textMuted, fontFace: 'Segoe UI'
        });

        // Mini 2 : Lubrifiants
        slide.addShape('rect', {
            x: LAYOUT.marginL + miniW + 0.39, y: miniY, w: miniW, h: miniH,
            fill: { color: THEME.blueLubLight },
            line: { color: THEME.blueLubBorder, width: 1.2 }
        });
        if (icons.lubMini) {
            slide.addImage({
                data: icons.lubMini,
                x: LAYOUT.marginL + (miniW * 2) + 0.39 - 0.65,
                y: miniY + 0.15,
                w: 0.48,
                h: 0.48
            });
        }
        slide.addText('PÔLE LUBRIFIANTS', {
            x: LAYOUT.marginL + miniW + 0.59, y: miniY + 0.15, w: miniW - 0.9, h: 0.25,
            fontSize: 9, bold: true, color: THEME.blueLub, fontFace: 'Segoe UI'
        });
        slide.addText(formatPrice(lubKpis.val || 0), {
            x: LAYOUT.marginL + miniW + 0.59, y: miniY + 0.45, w: miniW - 0.4, h: 0.45,
            fontSize: 15, bold: true, color: THEME.textHeading, fontFace: 'Segoe UI'
        });
        slide.addText(`Volume : ${formatNumber(lubKpis.liters || 0)} L (${formatNumber(lubKpis.kg || 0)} kg)`, {
            x: LAYOUT.marginL + miniW + 0.59, y: miniY + 1.02, w: miniW - 0.4, h: 0.3,
            fontSize: 8.5, color: THEME.textMuted, fontFace: 'Segoe UI'
        });

        // Mini 3 : Statut Commercial
        slide.addShape('rect', {
            x: LAYOUT.marginL + (miniW * 2) + 0.78, y: miniY, w: miniW, h: miniH,
            fill: { color: THEME.bgCard },
            line: { color: THEME.borderLight, width: 1.2 }
        });
        if (icons.healthMini) {
            slide.addImage({
                data: icons.healthMini,
                x: LAYOUT.marginL + (miniW * 3) + 0.78 - 0.65,
                y: miniY + 0.15,
                w: 0.48,
                h: 0.48
            });
        }
        slide.addText('SANTÉ COMMERCIALE', {
            x: LAYOUT.marginL + (miniW * 2) + 0.98, y: miniY + 0.15, w: miniW - 0.9, h: 0.25,
            fontSize: 9, bold: true, color: THEME.primary, fontFace: 'Segoe UI'
        });
        slide.addText(isGlobalPositive ? 'Surperformance Globale' : 'Phase d\'Ajustement', {
            x: LAYOUT.marginL + (miniW * 2) + 0.98, y: miniY + 0.45, w: miniW - 0.4, h: 0.45,
            fontSize: 14, bold: true, color: isGlobalPositive ? THEME.emerald : THEME.rose, fontFace: 'Segoe UI'
        });
        slide.addText('Basé sur l\'analyse comparative annuelle', {
            x: LAYOUT.marginL + (miniW * 2) + 0.98, y: miniY + 1.02, w: miniW - 0.4, h: 0.3,
            fontSize: 8.5, color: THEME.textMuted, fontFace: 'Segoe UI'
        });

        addSlideFooter(slide, 1);
    }

    // =========================================================================
    // SLIDE 2 : ÉVOLUTION DU CA DANS LE TEMPS & GRAPHIQUE
    // =========================================================================
    {
        const slide = pres.addSlide();
        slide.bkgd = THEME.bgSlide;
        addSlideHeader(slide, 'Évolution & Comparatif Temporel du Chiffre d\'Affaires', 'Analyse Temporelle', periodLabel, icons.timeTrend);

        const labels = (data || []).map(d => d.name || '');
        const currentVals = (data || []).map(d => Number(d.current || 0));
        const prevVals = (data || []).map(d => Number(d.previous || 0));

        if (labels.length > 0) {
            const chartData = [
                { name: `Année ${year - 1}`, labels: labels, values: prevVals },
                { name: `Année ${year}`, labels: labels, values: currentVals }
            ];

            slide.addChart(pres.ChartType.bar, chartData, {
                x: LAYOUT.marginL, y: 1.45, w: 7.8, h: 5.15,
                barGapWidthPct: 20,
                barGrouping: 'clustered',
                chartColors: [THEME.borderLight, THEME.primary],
                showLegend: true,
                legendPos: 't',
                showValue: false,
                catAxisLabelColor: THEME.textMuted,
                valAxisLabelColor: THEME.textMuted,
                valGridLine: { color: THEME.borderLight, style: 'dash' }
            });
        }

        // Encadré de droite avec tableau synthétique
        slide.addShape('rect', {
            x: LAYOUT.marginL + 8.1, y: 1.45, w: LAYOUT.usableW - 8.1, h: 5.15,
            fill: { color: THEME.bgCard },
            line: { color: THEME.borderLight, width: 1 }
        });

        slide.addText('RÉSUMÉ DES INDICATEURS', {
            x: LAYOUT.marginL + 8.35, y: 1.65, w: 3.0, h: 0.3,
            fontSize: 10, bold: true, color: THEME.primary, fontFace: 'Segoe UI'
        });

        const rows = [
            [
                { text: 'Indicateur', options: { bold: true, color: THEME.textHeading, fill: THEME.primaryLight } },
                { text: 'Valeur', options: { bold: true, color: THEME.textHeading, fill: THEME.primaryLight, align: 'right' } }
            ],
            [{ text: `CA ${year}` }, { text: formatPrice(kpis.currentTotal), options: { bold: true, align: 'right' } }],
            [{ text: `CA ${year - 1}` }, { text: formatPrice(kpis.previousTotal), options: { align: 'right' } }],
            [{ text: 'Variation Nette' }, { text: `${isGlobalPositive ? '+' : ''}${formatPrice(kpis.currentTotal - kpis.previousTotal)}`, options: { bold: true, color: isGlobalPositive ? THEME.emerald : THEME.rose, align: 'right' } }],
            [{ text: 'Taux de Croissance' }, { text: `${isGlobalPositive ? '+' : ''}${kpis.growth.toFixed(1)}%`, options: { bold: true, color: isGlobalPositive ? THEME.emerald : THEME.rose, align: 'right' } }],
            [{ text: 'Périodes mesurées' }, { text: `${labels.length}`, options: { align: 'right' } }]
        ];

        slide.addTable(rows, {
            x: LAYOUT.marginL + 8.3, y: 2.15, w: LAYOUT.usableW - 8.5, h: 2.7,
            fontSize: 9,
            fontFace: 'Segoe UI',
            border: { type: 'solid', pt: 1, color: THEME.borderLight },
            align: 'left',
            valign: 'middle'
        });

        slide.addText('Ce graphique est directement éditable et manipulable dans Google Slides et PowerPoint.', {
            x: LAYOUT.marginL + 8.3, y: 5.4, w: LAYOUT.usableW - 8.5, h: 1.0,
            fontSize: 8.5, color: THEME.textMuted, italic: true, fontFace: 'Segoe UI'
        });

        addSlideFooter(slide, 2);
    }

    // =========================================================================
    // SLIDE 3 : PERFORMANCE PAR CATÉGORIE
    // =========================================================================
    {
        const slide = pres.addSlide();
        slide.bkgd = THEME.bgSlide;
        addSlideHeader(slide, 'Performance & Ventilation par Catégorie', 'Rayons & Services', periodLabel, icons.categories);

        const sortedCats = [...(categoryDetails || [])].sort((a, b) => (b.current || 0) - (a.current || 0));

        const tableRows = [
            [
                { text: 'Catégorie', options: { bold: true, color: THEME.textHeading, fill: THEME.primaryLight } },
                { text: `CA ${year - 1}`, options: { bold: true, color: THEME.textHeading, fill: THEME.primaryLight, align: 'right' } },
                { text: `CA ${year}`, options: { bold: true, color: THEME.textHeading, fill: THEME.primaryLight, align: 'right' } },
                { text: 'Évolution', options: { bold: true, color: THEME.textHeading, fill: THEME.primaryLight, align: 'right' } },
                { text: 'Part (%)', options: { bold: true, color: THEME.textHeading, fill: THEME.primaryLight, align: 'right' } }
            ]
        ];

        sortedCats.slice(0, 10).forEach((cat) => {
            const share = kpis.currentTotal > 0 ? ((cat.current || 0) / kpis.currentTotal) * 100 : 0;
            const growth = Number(cat.growth || 0);
            const isPos = growth >= 0;

            tableRows.push([
                { text: cat.name || '-' },
                { text: formatPrice(cat.previous), options: { align: 'right' } },
                { text: formatPrice(cat.current), options: { bold: true, align: 'right' } },
                { text: `${isPos ? '+' : ''}${growth.toFixed(1)}%`, options: { bold: true, color: isPos ? THEME.emerald : THEME.rose, align: 'right' } },
                { text: `${share.toFixed(1)}%`, options: { align: 'right' } }
            ]);
        });

        slide.addTable(tableRows, {
            x: LAYOUT.marginL, y: 1.45, w: 7.8, h: Math.min(5.15, 0.42 * (tableRows.length + 1)),
            fontSize: 9,
            fontFace: 'Segoe UI',
            border: { type: 'solid', pt: 1, color: THEME.borderLight },
            align: 'left',
            valign: 'middle'
        });

        // Graphique Donut à droite
        if (sortedCats.length > 0) {
            const top5 = sortedCats.slice(0, 5);
            const donutLabels = top5.map(c => c.name || '');
            const donutVals = top5.map(c => Number(c.current || 0));

            const donutData = [
                { name: 'Part de CA', labels: donutLabels, values: donutVals }
            ];

            slide.addChart(pres.ChartType.doughnut, donutData, {
                x: LAYOUT.marginL + 8.1, y: 1.45, w: LAYOUT.usableW - 8.1, h: 5.15,
                chartColors: [THEME.primary, THEME.secondary, THEME.orange, THEME.emerald, THEME.borderLight],
                showLegend: true,
                legendPos: 'b',
                showValue: true,
                holeSize: 55
            });
        }

        addSlideFooter(slide, 3);
    }

    // =========================================================================
    // SLIDE 4 : VOLUMES CARBURANTS (LITRES & M3)
    // =========================================================================
    {
        const slide = pres.addSlide();
        slide.bkgd = THEME.bgSlide;
        addSlideHeader(slide, 'Statistiques Carburant - Volumes Distribués', 'Piste & Énergie', periodLabel, icons.fuelGasoil);

        const cardW = (LAYOUT.usableW - 0.4) / 2;
        const cardH = 2.1;

        // Gasoil
        const isGasoilPos = (fuelKpis.gasoilGrowth || 0) >= 0;
        slide.addShape('rect', {
            x: LAYOUT.marginL, y: 1.45, w: cardW, h: cardH,
            fill: { color: THEME.orangeLight },
            line: { color: THEME.orangeBorder, width: 1.5 }
        });
        if (icons.fuelGasoil) {
            slide.addImage({
                data: icons.fuelGasoil,
                x: LAYOUT.marginL + cardW - 0.75,
                y: 1.6,
                w: 0.55,
                h: 0.55
            });
        }
        slide.addText('GASOIL (VOLUME PISTE)', {
            x: LAYOUT.marginL + 0.25, y: 1.6, w: cardW - 1.1, h: 0.3,
            fontSize: 10.5, bold: true, color: THEME.orange, fontFace: 'Segoe UI'
        });
        slide.addText(`${formatNumber(fuelKpis.gasoil)} Litres`, {
            x: LAYOUT.marginL + 0.25, y: 1.95, w: cardW - 0.5, h: 0.6,
            fontSize: 22, bold: true, color: THEME.textHeading, fontFace: 'Segoe UI'
        });
        slide.addText(`Équivalent : ${(fuelKpis.gasoil / 1000).toFixed(2)} m³ | Précédent : ${formatNumber(fuelKpis.gasoilPrev)} L | Évolution : ${isGasoilPos ? '+' : ''}${fuelKpis.gasoilGrowth.toFixed(1)}%`, {
            x: LAYOUT.marginL + 0.25, y: 2.7, w: cardW - 0.5, h: 0.4,
            fontSize: 9.5, bold: true, color: isGasoilPos ? THEME.emerald : THEME.rose, fontFace: 'Segoe UI'
        });

        // SSP
        const isSSPPos = (fuelKpis.sspGrowth || 0) >= 0;
        slide.addShape('rect', {
            x: LAYOUT.marginL + cardW + 0.4, y: 1.45, w: cardW, h: cardH,
            fill: { color: THEME.greenFuelLight },
            line: { color: THEME.greenFuelBorder, width: 1.5 }
        });
        if (icons.fuelSSP) {
            slide.addImage({
                data: icons.fuelSSP,
                x: LAYOUT.marginL + (cardW * 2) + 0.4 - 0.75,
                y: 1.6,
                w: 0.55,
                h: 0.55
            });
        }
        slide.addText('SUPER SANS PLOMB - SSP (VOLUME PISTE)', {
            x: LAYOUT.marginL + cardW + 0.65, y: 1.6, w: cardW - 1.1, h: 0.3,
            fontSize: 10.5, bold: true, color: THEME.greenFuel, fontFace: 'Segoe UI'
        });
        slide.addText(`${formatNumber(fuelKpis.ssp)} Litres`, {
            x: LAYOUT.marginL + cardW + 0.65, y: 1.95, w: cardW - 0.5, h: 0.6,
            fontSize: 22, bold: true, color: THEME.textHeading, fontFace: 'Segoe UI'
        });
        slide.addText(`Équivalent : ${(fuelKpis.ssp / 1000).toFixed(2)} m³ | Précédent : ${formatNumber(fuelKpis.sspPrev)} L | Évolution : ${isSSPPos ? '+' : ''}${fuelKpis.sspGrowth.toFixed(1)}%`, {
            x: LAYOUT.marginL + cardW + 0.65, y: 2.7, w: cardW - 0.5, h: 0.4,
            fontSize: 9.5, bold: true, color: isSSPPos ? THEME.emerald : THEME.rose, fontFace: 'Segoe UI'
        });

        // Graphique comparatif des volumes carburant
        const fuelLabels = (fuelData || []).map(d => d.name || '');
        if (fuelLabels.length > 0) {
            const fuelChartData = [
                { name: `Gasoil ${year}`, labels: fuelLabels, values: fuelData.map(d => Number(d.gasoil || 0)) },
                { name: `SSP ${year}`, labels: fuelLabels, values: fuelData.map(d => Number(d.ssp || 0)) }
            ];

            slide.addChart(pres.ChartType.bar, fuelChartData, {
                x: LAYOUT.marginL, y: 3.8, w: LAYOUT.usableW, h: 2.8,
                barGapWidthPct: 20,
                barGrouping: 'clustered',
                chartColors: [THEME.orange, THEME.greenFuel],
                showLegend: true,
                legendPos: 't',
                showValue: false,
                valGridLine: { color: THEME.borderLight, style: 'dash' }
            });
        }

        addSlideFooter(slide, 4);
    }

    // =========================================================================
    // SLIDE 5 : CA CARBURANTS (DH)
    // =========================================================================
    {
        const slide = pres.addSlide();
        slide.bkgd = THEME.bgSlide;
        addSlideHeader(slide, 'Statistiques Carburant - Chiffre d\'Affaires (DH)', 'Valorisation Financière', periodLabel, icons.caCurrent);

        const totalRevCurr = (fuelRevenueKpis.gasoil || 0) + (fuelRevenueKpis.ssp || 0);
        const totalRevPrev = (fuelRevenueKpis.gasoilPrev || 0) + (fuelRevenueKpis.sspPrev || 0);
        const totalGrowth = totalRevPrev > 0 ? ((totalRevCurr - totalRevPrev) / totalRevPrev) * 100 : 0;

        const cardW = (LAYOUT.usableW - 0.6) / 3;
        const cardH = 2.05;

        // Total
        slide.addShape('rect', {
            x: LAYOUT.marginL, y: 1.45, w: cardW, h: cardH,
            fill: { color: THEME.bgCard },
            line: { color: THEME.primaryBorder, width: 1.5 }
        });
        if (icons.caCurrent) {
            slide.addImage({
                data: icons.caCurrent,
                x: LAYOUT.marginL + cardW - 0.65,
                y: 1.6,
                w: 0.48,
                h: 0.48
            });
        }
        slide.addText('TOTAL RECETTES CARBURANT', {
            x: LAYOUT.marginL + 0.15, y: 1.6, w: cardW - 0.8, h: 0.3,
            fontSize: 9, bold: true, color: THEME.primary, fontFace: 'Segoe UI'
        });
        slide.addText(formatPrice(totalRevCurr), {
            x: LAYOUT.marginL + 0.15, y: 1.95, w: cardW - 0.3, h: 0.55,
            fontSize: 18, bold: true, color: THEME.textHeading, fontFace: 'Segoe UI'
        });
        slide.addText(`Précédent : ${formatPrice(totalRevPrev)} (${totalGrowth >= 0 ? '+' : ''}${totalGrowth.toFixed(1)}%)`, {
            x: LAYOUT.marginL + 0.15, y: 2.65, w: cardW - 0.3, h: 0.4,
            fontSize: 8.5, bold: true, color: totalGrowth >= 0 ? THEME.emerald : THEME.rose, fontFace: 'Segoe UI'
        });

        // CA Gasoil
        slide.addShape('rect', {
            x: LAYOUT.marginL + cardW + 0.3, y: 1.45, w: cardW, h: cardH,
            fill: { color: THEME.orangeLight },
            line: { color: THEME.orangeBorder, width: 1.5 }
        });
        if (icons.fuelGasoil) {
            slide.addImage({
                data: icons.fuelGasoil,
                x: LAYOUT.marginL + (cardW * 2) + 0.3 - 0.65,
                y: 1.6,
                w: 0.48,
                h: 0.48
            });
        }
        slide.addText('RECETTES GASOIL', {
            x: LAYOUT.marginL + cardW + 0.45, y: 1.6, w: cardW - 0.8, h: 0.3,
            fontSize: 9, bold: true, color: THEME.orange, fontFace: 'Segoe UI'
        });
        slide.addText(formatPrice(fuelRevenueKpis.gasoil), {
            x: LAYOUT.marginL + cardW + 0.45, y: 1.95, w: cardW - 0.3, h: 0.55,
            fontSize: 18, bold: true, color: THEME.textHeading, fontFace: 'Segoe UI'
        });
        slide.addText(`Part : ${totalRevCurr > 0 ? ((fuelRevenueKpis.gasoil / totalRevCurr) * 100).toFixed(1) : 0}% | Évol : ${fuelRevenueKpis.gasoilGrowth >= 0 ? '+' : ''}${fuelRevenueKpis.gasoilGrowth.toFixed(1)}%`, {
            x: LAYOUT.marginL + cardW + 0.45, y: 2.65, w: cardW - 0.3, h: 0.4,
            fontSize: 8.5, bold: true, color: fuelRevenueKpis.gasoilGrowth >= 0 ? THEME.emerald : THEME.rose, fontFace: 'Segoe UI'
        });

        // CA SSP
        slide.addShape('rect', {
            x: LAYOUT.marginL + (cardW * 2) + 0.6, y: 1.45, w: cardW, h: cardH,
            fill: { color: THEME.greenFuelLight },
            line: { color: THEME.greenFuelBorder, width: 1.5 }
        });
        if (icons.fuelSSP) {
            slide.addImage({
                data: icons.fuelSSP,
                x: LAYOUT.marginL + (cardW * 3) + 0.6 - 0.65,
                y: 1.6,
                w: 0.48,
                h: 0.48
            });
        }
        slide.addText('RECETTES SANS PLOMB (SSP)', {
            x: LAYOUT.marginL + (cardW * 2) + 0.75, y: 1.6, w: cardW - 0.8, h: 0.3,
            fontSize: 9, bold: true, color: THEME.greenFuel, fontFace: 'Segoe UI'
        });
        slide.addText(formatPrice(fuelRevenueKpis.ssp), {
            x: LAYOUT.marginL + (cardW * 2) + 0.75, y: 1.95, w: cardW - 0.3, h: 0.55,
            fontSize: 18, bold: true, color: THEME.textHeading, fontFace: 'Segoe UI'
        });
        slide.addText(`Part : ${totalRevCurr > 0 ? ((fuelRevenueKpis.ssp / totalRevCurr) * 100).toFixed(1) : 0}% | Évol : ${fuelRevenueKpis.sspGrowth >= 0 ? '+' : ''}${fuelRevenueKpis.sspGrowth.toFixed(1)}%`, {
            x: LAYOUT.marginL + (cardW * 2) + 0.75, y: 2.65, w: cardW - 0.3, h: 0.4,
            fontSize: 8.5, bold: true, color: fuelRevenueKpis.sspGrowth >= 0 ? THEME.emerald : THEME.rose, fontFace: 'Segoe UI'
        });

        // Graphique d'évolution du CA Carburant
        const revLabels = (fuelRevenueData || []).map(d => d.name || '');
        if (revLabels.length > 0) {
            const revChartData = [
                { name: 'CA Gasoil', labels: revLabels, values: fuelRevenueData.map(d => Number(d.gasoil || 0)) },
                { name: 'CA SSP', labels: revLabels, values: fuelRevenueData.map(d => Number(d.ssp || 0)) }
            ];

            slide.addChart(pres.ChartType.bar, revChartData, {
                x: LAYOUT.marginL, y: 3.75, w: LAYOUT.usableW, h: 2.85,
                barGapWidthPct: 20,
                barGrouping: 'stacked',
                chartColors: [THEME.orange, THEME.greenFuel],
                showLegend: true,
                legendPos: 't',
                showValue: false,
                valGridLine: { color: THEME.borderLight, style: 'dash' }
            });
        }

        addSlideFooter(slide, 5);
    }

    // =========================================================================
    // SLIDE 6 : LUBRIFIANTS (LITRES, KG, DH)
    // =========================================================================
    {
        const slide = pres.addSlide();
        slide.bkgd = THEME.bgSlide;
        addSlideHeader(slide, 'Performance Lubrifiants (Volumes, Masse & Valeur)', 'Maintenance & Huiles', periodLabel, icons.lubLitres);

        const cardW = (LAYOUT.usableW - 0.6) / 3;
        const cardH = 2.1;

        // Litres
        slide.addShape('rect', {
            x: LAYOUT.marginL, y: 1.45, w: cardW, h: cardH,
            fill: { color: THEME.blueLubLight },
            line: { color: THEME.blueLubBorder, width: 1.5 }
        });
        if (icons.lubLitres) {
            slide.addImage({
                data: icons.lubLitres,
                x: LAYOUT.marginL + cardW - 0.65,
                y: 1.6,
                w: 0.48,
                h: 0.48
            });
        }
        slide.addText('VOLUME DISTRIBUÉ (LITRES)', {
            x: LAYOUT.marginL + 0.15, y: 1.6, w: cardW - 0.8, h: 0.3,
            fontSize: 9, bold: true, color: THEME.blueLub, fontFace: 'Segoe UI'
        });
        slide.addText(`${formatNumber(lubKpis.liters)} L`, {
            x: LAYOUT.marginL + 0.15, y: 1.95, w: cardW - 0.3, h: 0.6,
            fontSize: 20, bold: true, color: THEME.textHeading, fontFace: 'Segoe UI'
        });
        slide.addText(`Précédent : ${formatNumber(lubKpis.litersPrev)} L | Évolution : ${lubKpis.litersGrowth >= 0 ? '+' : ''}${lubKpis.litersGrowth.toFixed(1)}%`, {
            x: LAYOUT.marginL + 0.15, y: 2.7, w: cardW - 0.3, h: 0.4,
            fontSize: 8.5, bold: true, color: lubKpis.litersGrowth >= 0 ? THEME.emerald : THEME.rose, fontFace: 'Segoe UI'
        });

        // Masse Kg
        slide.addShape('rect', {
            x: LAYOUT.marginL + cardW + 0.3, y: 1.45, w: cardW, h: cardH,
            fill: { color: THEME.bgCard },
            line: { color: THEME.borderLight, width: 1.5 }
        });
        if (icons.lubKg) {
            slide.addImage({
                data: icons.lubKg,
                x: LAYOUT.marginL + (cardW * 2) + 0.3 - 0.65,
                y: 1.6,
                w: 0.48,
                h: 0.48
            });
        }
        slide.addText('MASSE DISTRIBUÉE (KG)', {
            x: LAYOUT.marginL + cardW + 0.45, y: 1.6, w: cardW - 0.8, h: 0.3,
            fontSize: 9, bold: true, color: THEME.textMuted, fontFace: 'Segoe UI'
        });
        slide.addText(`${formatNumber(lubKpis.kg)} kg`, {
            x: LAYOUT.marginL + cardW + 0.45, y: 1.95, w: cardW - 0.3, h: 0.6,
            fontSize: 20, bold: true, color: THEME.textHeading, fontFace: 'Segoe UI'
        });
        slide.addText(`Précédent : ${formatNumber(lubKpis.kgPrev)} kg | Évolution : ${lubKpis.kgGrowth >= 0 ? '+' : ''}${lubKpis.kgGrowth.toFixed(1)}%`, {
            x: LAYOUT.marginL + cardW + 0.45, y: 2.7, w: cardW - 0.3, h: 0.4,
            fontSize: 8.5, bold: true, color: lubKpis.kgGrowth >= 0 ? THEME.emerald : THEME.rose, fontFace: 'Segoe UI'
        });

        // Valeur DH
        slide.addShape('rect', {
            x: LAYOUT.marginL + (cardW * 2) + 0.6, y: 1.45, w: cardW, h: cardH,
            fill: { color: THEME.emeraldLight },
            line: { color: THEME.emeraldBorder, width: 1.5 }
        });
        if (icons.lubDh) {
            slide.addImage({
                data: icons.lubDh,
                x: LAYOUT.marginL + (cardW * 3) + 0.6 - 0.65,
                y: 1.6,
                w: 0.48,
                h: 0.48
            });
        }
        slide.addText('CHIFFRE D\'AFFAIRES LUBRIFIANTS', {
            x: LAYOUT.marginL + (cardW * 2) + 0.75, y: 1.6, w: cardW - 0.8, h: 0.3,
            fontSize: 9, bold: true, color: THEME.emerald, fontFace: 'Segoe UI'
        });
        slide.addText(formatPrice(lubKpis.val), {
            x: LAYOUT.marginL + (cardW * 2) + 0.75, y: 1.95, w: cardW - 0.3, h: 0.6,
            fontSize: 20, bold: true, color: THEME.textHeading, fontFace: 'Segoe UI'
        });
        slide.addText(`Précédent : ${formatPrice(lubKpis.valPrev)} | Évolution : ${lubKpis.valGrowth >= 0 ? '+' : ''}${lubKpis.valGrowth.toFixed(1)}%`, {
            x: LAYOUT.marginL + (cardW * 2) + 0.75, y: 2.7, w: cardW - 0.3, h: 0.4,
            fontSize: 8.5, bold: true, color: lubKpis.valGrowth >= 0 ? THEME.emerald : THEME.rose, fontFace: 'Segoe UI'
        });

        // Graphique comparatif Lubrifiants
        const lubLabels = (lubData || []).map(d => d.name || '');
        if (lubLabels.length > 0) {
            const lubChartData = [
                { name: `Volume N-1 (L)`, labels: lubLabels, values: lubData.map(d => Number(d.litersPrev || 0)) },
                { name: `Volume N (L)`, labels: lubLabels, values: lubData.map(d => Number(d.liters || 0)) }
            ];

            slide.addChart(pres.ChartType.bar, lubChartData, {
                x: LAYOUT.marginL, y: 3.8, w: LAYOUT.usableW, h: 2.8,
                barGapWidthPct: 20,
                barGrouping: 'clustered',
                chartColors: [THEME.borderLight, THEME.blueLub],
                showLegend: true,
                legendPos: 't',
                showValue: false,
                valGridLine: { color: THEME.borderLight, style: 'dash' }
            });
        }

        addSlideFooter(slide, 6);
    }

    // =========================================================================
    // SLIDE 7 : BILAN STRATÉGIQUE & RECOMMANDATIONS
    // =========================================================================
    {
        const slide = pres.addSlide();
        slide.bkgd = THEME.bgSlide;
        addSlideHeader(slide, 'Bilan Exécutif & Recommandations Décisionnelles', 'Perspectives & Stratégie', periodLabel, icons.stratLightbulb);

        const topCat = [...(categoryDetails || [])].sort((a, b) => (b.current || 0) - (a.current || 0))[0];

        const blockW = (LAYOUT.usableW - 0.4) / 2;
        const blockH = 5.15;

        // Bloc 1 : Moteurs de Performance
        slide.addShape('rect', {
            x: LAYOUT.marginL, y: 1.45, w: blockW, h: blockH,
            fill: { color: THEME.bgCard },
            line: { color: THEME.emeraldBorder, width: 1.5 }
        });
        slide.addShape('rect', {
            x: LAYOUT.marginL, y: 1.45, w: blockW, h: 0.05,
            fill: { color: THEME.emerald },
            line: { type: 'none' }
        });
        if (icons.growthRocket) {
            slide.addImage({
                data: icons.growthRocket,
                x: LAYOUT.marginL + blockW - 0.75,
                y: 1.6,
                w: 0.52,
                h: 0.52
            });
        }
        slide.addText('MOTEURS DE CROISSANCE & RÉALISATIONS', {
            x: LAYOUT.marginL + 0.3, y: 1.65, w: blockW - 1.2, h: 0.35,
            fontSize: 10.5, bold: true, color: THEME.emerald, fontFace: 'Segoe UI'
        });

        const pointsForts = [
            `Chiffre d'affaires global de ${formatPrice(kpis.currentTotal)} réalisé sur la période.`,
            `Progression annuelle globale établie à ${isGlobalPositive ? '+' : ''}${kpis.growth.toFixed(1)}% par rapport à l'exercice N-1.`,
            topCat ? `Premier centre de profit : ${topCat.name} avec un volume de ventes de ${formatPrice(topCat.current)}.` : 'Bonne diversification du mix produits.',
            fuelKpis.gasoilGrowth > 0 ? `Dynamique favorable sur la piste Gasoil (+${fuelKpis.gasoilGrowth.toFixed(1)}% en volume distribué).` : 'Maintien des parts de marché sur la distribution carburant.',
            'Consolidation des marges brutes sur l\'ensemble des activités de la station.'
        ];

        slide.addText(
            pointsForts.map(pt => ({
                text: pt,
                options: { bullet: true, breakLine: true, fontSize: 10, color: THEME.textBody }
            })),
            {
                x: LAYOUT.marginL + 0.35, y: 2.15, w: blockW - 0.7, h: 4.2,
                fontFace: 'Segoe UI',
                valign: 'top',
                paraSpaceAfter: 12
            }
        );

        // Bloc 2 : Points d'Attention & Actions Préconisées
        slide.addShape('rect', {
            x: LAYOUT.marginL + blockW + 0.4, y: 1.45, w: blockW, h: blockH,
            fill: { color: THEME.bgCard },
            line: { color: THEME.primaryBorder, width: 1.5 }
        });
        slide.addShape('rect', {
            x: LAYOUT.marginL + blockW + 0.4, y: 1.45, w: blockW, h: 0.05,
            fill: { color: THEME.primary },
            line: { type: 'none' }
        });
        if (icons.stratLightbulb) {
            slide.addImage({
                data: icons.stratLightbulb,
                x: LAYOUT.marginL + (blockW * 2) + 0.4 - 0.75,
                y: 1.6,
                w: 0.52,
                h: 0.52
            });
        }
        slide.addText('POINTS DE VIGILANCE & RECOMMANDATIONS STRATÉGIQUES', {
            x: LAYOUT.marginL + blockW + 0.7, y: 1.65, w: blockW - 1.2, h: 0.35,
            fontSize: 10.5, bold: true, color: THEME.primary, fontFace: 'Segoe UI'
        });

        const recommendations = [
            'Poursuivre la politique de fidélisation active de la clientèle professionnelle et transporteurs.',
            'Optimiser les ventes croisées entre la piste carburant et la boutique Shop / Espace Café.',
            lubKpis.valGrowth < 0 
                ? `Redynamiser le rayon Lubrifiants (${lubKpis.valGrowth.toFixed(1)}%) via des offres packagées vidange & entretien.`
                : 'Maintenir la dynamique sur les ventes de lubrifiants à forte valeur ajoutée.',
            'Surveiller les écarts d\'inventaires et ajuster les approvisionnements en fonction des pics de consommation.',
            'Organiser des revues de performance mensuelles régulières avec les équipes opérationnelles.'
        ];

        slide.addText(
            recommendations.map(rec => ({
                text: rec,
                options: { bullet: true, breakLine: true, fontSize: 10, color: THEME.textBody }
            })),
            {
                x: LAYOUT.marginL + blockW + 0.65, y: 2.15, w: blockW - 0.7, h: 4.2,
                fontFace: 'Segoe UI',
                valign: 'top',
                paraSpaceAfter: 12
            }
        );

        addSlideFooter(slide, 7);
    }

    // =========================================================================
    // EXPORT ET ENREGISTREMENT DU FICHIER PPTX AVEC TRANSITIONS INTÉGRÉES
    // =========================================================================
    const cleanPeriodStr = period === 'month'
        ? `${MONTHS_NAMES[selectedMonth]}_${year}`
        : period === 'year'
            ? `Annee_${year}`
            : period === 'custom'
                ? `${MONTHS_NAMES[customStartMonth]}_a_${MONTHS_NAMES[customEndMonth]}_${year}`
                : `${period}_${year}`;

    const fileName = `Presentation_Statistiques_Petrom_${cleanPeriodStr}.pptx`;

    // 1. Génération initiale du binaire PPTX
    const initialBuffer = await pres.write({ outputType: 'arraybuffer' });

    // 2. Injection des transitions animées (Fade) dans chaque diapositive
    const finalBuffer = await injectSlideTransitions(initialBuffer);

    // 3. Téléchargement ou partage selon la plateforme
    if (Capacitor.isNativePlatform()) {
        const uint8 = new Uint8Array(finalBuffer);
        let binary = '';
        for (let i = 0; i < uint8.byteLength; i++) {
            binary += String.fromCharCode(uint8[i]);
        }
        const base64Data = btoa(binary);

        const result = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Documents
        });
        await Share.share({
            title: fileName,
            url: result.uri,
            dialogTitle: 'Partager la présentation Google Slides / PPTX'
        });
    } else {
        const blob = new Blob([finalBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        });
        saveAs(blob, fileName);
    }
};
