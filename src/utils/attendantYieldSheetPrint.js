/**
 * Fiche de Comptage & Rendement Pompiste (Imprimable A4 - 1 Seule Page Garantie)
 * Optimisée pour tenir strictement sur 1 seule feuille A4 sans débordement,
 * avec une excellente lisibilité et des cases adaptées à l'écriture manuelle.
 */

export const printAttendantYieldSheet = (options = {}) => {
    const {
        attendantName = '',
        shiftLabel = '',
        stationName = 'STATION SERVICE PETROM',
        defaultRowsCount = 5
    } = options;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Veuillez autoriser les fenêtres pop-up dans votre navigateur pour imprimer la fiche.");
        return;
    }

    // 5 lignes de volucompteurs (P1 à P5)
    let indexRowsHtml = '';
    for (let i = 1; i <= defaultRowsCount; i++) {
        const defaultProduct = i <= 3 ? 'Gasoil' : (i <= 4 ? 'SSP (Super)' : '');
        indexRowsHtml += `
            <tr class="write-row">
                <td class="cell-center font-bold">P${i}</td>
                <td class="cell-product font-semibold">${defaultProduct}</td>
                <td class="cell-blank"></td>
                <td class="cell-blank"></td>
                <td class="cell-blank"></td>
                <td class="cell-blank"></td>
                <td class="cell-blank"></td>
            </tr>
        `;
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Fiche de Rendement & Comptage Pompiste A4</title>
            <style>
                @page {
                    size: A4 portrait;
                    margin: 5mm 6mm 5mm 6mm;
                }
                * {
                    box-sizing: border-box;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                html, body {
                    margin: 0;
                    padding: 0;
                    background-color: #f1f5f9;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    color: #0f172a;
                    -webkit-font-smoothing: antialiased;
                }

                /* Barre de prévisualisation (masquée à l'impression) */
                .no-print-bar {
                    background: #0f172a;
                    color: white;
                    padding: 10px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 4px 14px rgba(0,0,0,0.25);
                    position: sticky;
                    top: 0;
                    z-index: 9999;
                }
                .no-print-bar button {
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 13px;
                    padding: 7px 18px;
                    border-radius: 6px;
                    border: none;
                    transition: all 0.2s;
                }
                .btn-print {
                    background: #2563eb;
                    color: white;
                    margin-right: 8px;
                }
                .btn-print:hover { background: #1d4ed8; }
                .btn-close {
                    background: #475569;
                    color: white;
                }
                .btn-close:hover { background: #334155; }

                /* Conteneur Feuille A4 */
                .sheet-container {
                    width: 100%;
                    max-width: 198mm;
                    margin: 8px auto;
                    background: #ffffff;
                    padding: 4mm 6mm 3mm 6mm;
                    box-sizing: border-box;
                    box-shadow: 0 4px 25px rgba(0,0,0,0.08);
                    page-break-after: avoid !important;
                    break-after: avoid !important;
                }

                @media print {
                    html, body {
                        background: white;
                        height: 100%;
                        overflow: hidden;
                    }
                    .no-print-bar {
                        display: none !important;
                    }
                    .sheet-container {
                        max-width: 100%;
                        margin: 0;
                        padding: 0;
                        box-shadow: none;
                        border-radius: 0;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                }

                /* Anti-saut de page sur tous les blocs */
                .header-table, .meta-box, table.data-table, .two-columns, .recap-box, .signatures-grid {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }

                /* 1. EN-TÊTE */
                .header-table {
                    width: 100%;
                    border-collapse: collapse;
                    border-bottom: 2px solid #0f172a;
                    padding-bottom: 4px;
                    margin-bottom: 5px;
                }
                .brand-title {
                    font-size: 13px;
                    font-weight: 900;
                    color: #0f172a;
                    letter-spacing: 0.6px;
                    text-transform: uppercase;
                }
                .main-title {
                    font-size: 16px;
                    font-weight: 900;
                    color: #1e3a8a;
                    text-transform: uppercase;
                    letter-spacing: 0.4px;
                    margin: 1px 0;
                }
                .sub-title {
                    font-size: 9.5px;
                    color: #475569;
                    font-weight: 700;
                    text-transform: uppercase;
                }
                .doc-ref-box {
                    text-align: right;
                    vertical-align: top;
                }
                .doc-ref-badge {
                    display: inline-block;
                    font-size: 8.5px;
                    font-weight: 800;
                    background: #e2e8f0;
                    color: #1e293b;
                    padding: 2px 6px;
                    border-radius: 3px;
                    text-transform: uppercase;
                }
                .fiche-number {
                    font-size: 10.5px;
                    font-weight: 900;
                    margin-top: 3px;
                    color: #0f172a;
                }

                /* 2. CADRE D'IDENTIFICATION & DATE MANUELLE */
                .meta-box {
                    border: 1.5px solid #0f172a;
                    background: #f8fafc;
                    border-radius: 4px;
                    padding: 5px 8px;
                    margin-bottom: 5px;
                }
                .meta-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .meta-field {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .field-label {
                    font-weight: 900;
                    color: #0f172a;
                    text-transform: uppercase;
                    font-size: 10px;
                }
                .field-underline {
                    border-bottom: 1.5px dotted #334155;
                    display: inline-block;
                    min-height: 16px;
                }
                .date-fill-box {
                    border: 1.5px solid #0f172a;
                    background: white;
                    padding: 3px 10px;
                    font-weight: 900;
                    font-size: 11px;
                    border-radius: 3px;
                    letter-spacing: 1px;
                    display: inline-flex;
                    align-items: center;
                }
                .checkbox-item {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    font-weight: 700;
                    font-size: 10px;
                    margin-left: 8px;
                }
                .check-square {
                    width: 13px;
                    height: 13px;
                    border: 1.5px solid #0f172a;
                    display: inline-block;
                    background: white;
                    border-radius: 2px;
                }

                /* 3. EN-TÊTE DE SECTION */
                .section-header {
                    background: #1e293b;
                    color: white;
                    padding: 3.5px 8px;
                    font-size: 10.5px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-radius: 3px;
                    margin-top: 4px;
                    margin-bottom: 2px;
                }
                .section-badge {
                    background: rgba(255,255,255,0.2);
                    padding: 1px 6px;
                    border-radius: 3px;
                    font-size: 8.5px;
                    font-weight: 700;
                }

                /* 4. TABLEAUX DE DONNÉES */
                table.data-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 4px;
                }
                table.data-table th, table.data-table td {
                    border: 1px solid #475569;
                    padding: 3.5px 6px;
                    font-size: 9.5px;
                }
                table.data-table th {
                    background: #e2e8f0;
                    color: #0f172a;
                    font-weight: 900;
                    text-align: center;
                    text-transform: uppercase;
                    font-size: 9px;
                    letter-spacing: 0.2px;
                }
                tr.write-row td {
                    height: 22px; /* Hauteur nette et calibrée */
                }
                .cell-center { text-align: center; }
                .cell-right { text-align: right; }
                .cell-blank { background: white; }
                .cell-product { font-size: 10px; }

                table.data-table tr.total-row td {
                    background: #f1f5f9;
                    font-weight: 900;
                    font-size: 10px;
                    border-top: 2px solid #0f172a;
                    height: 23px;
                }

                /* 5. DEUX COLONNES HORS-ESPÈCES + BILLETAGE */
                .two-columns {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 4px;
                }
                .col-left {
                    flex: 1.12;
                }
                .col-right {
                    flex: 0.88;
                }

                /* 6. CADRE RÉCAPITULATIF & ÉCART DE CAISSE */
                .recap-box {
                    border: 1.5px solid #0f172a;
                    background: #f8fafc;
                    border-radius: 4px;
                    padding: 5px 8px;
                    margin-top: 3px;
                    margin-bottom: 4px;
                }
                .recap-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                    text-align: center;
                    padding-bottom: 4px;
                    border-bottom: 1.5px dashed #cbd5e1;
                }
                .recap-item-title {
                    font-size: 9px;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: #475569;
                    margin-bottom: 2px;
                }
                .recap-item-val {
                    font-size: 11.5px;
                    font-weight: 900;
                    color: #0f172a;
                    border: 1px solid #0f172a;
                    border-radius: 3px;
                    min-height: 22px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: white;
                }

                .ecart-zone {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: 4px;
                }
                .ecart-checks {
                    display: flex;
                    gap: 14px;
                    align-items: center;
                }

                .notes-row {
                    margin-top: 4px;
                    font-size: 9px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .notes-line {
                    flex: 1;
                    border-bottom: 1px dotted #64748b;
                    min-height: 14px;
                }

                /* 7. CADRES DE SIGNATURES (STRICTEMENT SUR LA MÊME PAGE) */
                .signatures-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                    margin-top: 4px;
                }
                .sig-box {
                    border: 1.5px solid #0f172a;
                    background: white;
                    border-radius: 4px;
                    padding: 5px 8px;
                    height: 68px; /* Hauteur compacte pour ne jamais déborder */
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .sig-header {
                    font-weight: 900;
                    font-size: 10px;
                    text-transform: uppercase;
                    color: #0f172a;
                    border-bottom: 1px solid #e2e8f0;
                    padding-bottom: 2px;
                }
                .sig-subtext {
                    font-size: 7.5px;
                    color: #64748b;
                    font-style: italic;
                    margin-top: 1px;
                    line-height: 1.2;
                }
                .sig-stamp {
                    font-size: 8.5px;
                    color: #94a3b8;
                    text-align: center;
                    font-weight: 700;
                    margin-top: auto;
                }
            </style>
        </head>
        <body>
            <!-- BARRE DE COMMANDE SUPÉRIEURE (NON IMPRIMÉE) -->
            <div class="no-print-bar">
                <div>
                    <strong style="font-size: 14px;">📄 Fiche de Comptage & Rendement Pompiste</strong>
                    <span style="font-size: 12px; opacity: 0.8; margin-left: 10px;">Format A4 Portrait · 1 Seule Page Garantie</span>
                </div>
                <div>
                    <button class="btn-print" onclick="window.print()">🖨️ Lancer l'impression A4</button>
                    <button class="btn-close" onclick="window.close()">Fermer</button>
                </div>
            </div>

            <!-- CONTENU DE LA FEUILLE A4 (1 SEULE PAGE) -->
            <div class="sheet-container">
                <!-- 1. ENTÊTE OFFICIEL -->
                <table class="header-table">
                    <tr>
                        <td style="width: 65%;">
                            <div class="brand-title">${stationName}</div>
                            <div class="main-title">Fiche de Rendement & Comptage Piste</div>
                            <div class="sub-title">Contrôle Métrologique des Index · Justification des Recettes & Clôture de Quart</div>
                        </td>
                        <td class="doc-ref-box" style="width: 35%;">
                            <div class="doc-ref-badge">TRAÇABILITÉ INTERNE & AUDIT</div>
                            <div class="fiche-number">
                                N° FICHE : <span class="field-underline" style="width: 80px;"></span>
                            </div>
                        </td>
                    </tr>
                </table>

                <!-- 2. CADRE D'IDENTIFICATION & DATE MANUELLE -->
                <div class="meta-box">
                    <div class="meta-row">
                        <div class="meta-field">
                            <span class="field-label">📅 Date de la vacation :</span>
                            <span class="date-fill-box">
                                JOUR : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / MOIS : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / 202&nbsp;&nbsp;&nbsp;
                            </span>
                        </div>
                        <div class="meta-field">
                            <span class="field-label">Quart / Shift :</span>
                            <span class="checkbox-item"><span class="check-square"></span> Shift 1 (Nuit 00h-08h)</span>
                            <span class="checkbox-item"><span class="check-square"></span> Shift 2 (Jour 08h-18h)</span>
                            <span class="checkbox-item"><span class="check-square"></span> Shift 3 (Soir 18h-00h)</span>
                        </div>
                    </div>
                    <div class="meta-row" style="margin-top: 5px;">
                        <div class="meta-field" style="flex: 1.4;">
                            <span class="field-label">👤 Nom du Pompiste :</span>
                            <span class="field-underline" style="flex: 1; font-weight: bold; font-size: 12px; padding-left: 6px;">
                                ${attendantName || ''}
                            </span>
                        </div>
                        <div class="meta-field" style="flex: 0.8; margin-left: 12px;">
                            <span class="field-label">Îlot / Pistes :</span>
                            <span class="field-underline" style="flex: 1;"></span>
                        </div>
                        <div class="meta-field" style="flex: 1.2; margin-left: 12px;">
                            <span class="field-label">Chef de Piste :</span>
                            <span class="field-underline" style="flex: 1;"></span>
                        </div>
                    </div>
                </div>

                <!-- 3. SECTION 1 : VOLUCOMPTEURS / INDEX (5 POMPES P1 À P5) -->
                <div class="section-header">
                    <span>1. Relevé des Compteurs Volucompteurs & Ventes Carburants</span>
                    <span class="section-badge">Index Métrologiques de Début & Fin de Quart</span>
                </div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 45px;">Pompe</th>
                            <th style="width: 140px;">Carburant</th>
                            <th style="width: 110px;">Index Départ (Prise)</th>
                            <th style="width: 110px;">Index Arrivée (Fin)</th>
                            <th style="width: 90px;">Volume Vendu (L)</th>
                            <th style="width: 80px;">Prix / L (DH)</th>
                            <th style="width: 115px;">Montant Total (DH)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${indexRowsHtml}
                        <tr class="total-row">
                            <td colspan="4" style="text-align: right; padding-right: 10px; font-weight: 900;">SOUS-TOTAL RENDEMENT CARBURANTS (A) :</td>
                            <td class="cell-blank cell-center" style="font-weight: 800;">.......... L</td>
                            <td style="background: #e2e8f0;"></td>
                            <td class="cell-blank cell-right" style="font-weight: 900; font-size: 11px;">.................... DH</td>
                        </tr>
                    </tbody>
                </table>

                <!-- 4. SECTION 2 : VENTES ANNEXES PISTE (2 LIGNES) -->
                <div class="section-header">
                    <span>2. Ventes Annexes Réalisées sur Piste (Lubrifiants, Huiles & Services)</span>
                    <span class="section-badge">Produits Piste</span>
                </div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 40px;">N°</th>
                            <th style="width: 340px;">Désignation Produit (Lubrifiant, Bidon huile, Lave-glace, Lavage, Autre)</th>
                            <th style="width: 85px;">Quantité</th>
                            <th style="width: 100px;">Prix Unitaire</th>
                            <th style="width: 145px;">Montant Total (DH)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="write-row">
                            <td class="cell-center font-bold">1</td>
                            <td class="cell-blank"></td>
                            <td class="cell-blank"></td>
                            <td class="cell-blank"></td>
                            <td class="cell-blank"></td>
                        </tr>
                        <tr class="write-row">
                            <td class="cell-center font-bold">2</td>
                            <td class="cell-blank"></td>
                            <td class="cell-blank"></td>
                            <td class="cell-blank"></td>
                            <td class="cell-blank"></td>
                        </tr>
                        <tr class="total-row">
                            <td colspan="4" style="text-align: right; padding-right: 10px; font-weight: 900;">SOUS-TOTAL VENTES ANNEXES (B) :</td>
                            <td class="cell-blank cell-right" style="font-weight: 900; font-size: 11px;">.................... DH</td>
                        </tr>
                    </tbody>
                </table>

                <!-- 5. SECTION 3 & 4 : DEUX COLONNES (HORS-ESPÈCES & BILLETAGE) -->
                <div class="two-columns">
                    <!-- HORS-ESPÈCES -->
                    <div class="col-left">
                        <div class="section-header">
                            <span>3. Justificatifs Hors-Espèces</span>
                            <span class="section-badge">Monétique & Bons</span>
                        </div>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="width: 140px;">Mode de Règlement</th>
                                    <th style="width: 90px;">Nbre / Réf</th>
                                    <th style="width: 110px;">Montant (DH)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr class="write-row">
                                    <td style="font-weight: 800;">Cartes TPE (Bancaires)</td>
                                    <td class="cell-center text-gray-500">...... tickets</td>
                                    <td class="cell-blank"></td>
                                </tr>
                                <tr class="write-row">
                                    <td style="font-weight: 800;">Petrom Card / Cartes</td>
                                    <td class="cell-center text-gray-500">...... tickets</td>
                                    <td class="cell-blank"></td>
                                </tr>
                                <tr class="write-row">
                                    <td style="font-weight: 800;">Bons Société / Crédit</td>
                                    <td class="cell-center text-gray-500">...... bons</td>
                                    <td class="cell-blank"></td>
                                </tr>
                                <tr class="write-row">
                                    <td style="font-weight: 800;">Bons SNTL</td>
                                    <td class="cell-center text-gray-500">...... bons</td>
                                    <td class="cell-blank"></td>
                                </tr>
                                <tr class="write-row">
                                    <td style="font-weight: 800;">Chèques / Divers</td>
                                    <td class="cell-center text-gray-500">...... pièces</td>
                                    <td class="cell-blank"></td>
                                </tr>
                                <tr class="total-row">
                                    <td colspan="2" style="text-align: right; font-weight: 900;">TOTAL HORS-ESPÈCES (C) :</td>
                                    <td class="cell-blank cell-right" style="font-weight: 900;">.................... DH</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- BILLETAGE ESPÈCES -->
                    <div class="col-right">
                        <div class="section-header">
                            <span>4. Billetage Espèces Remises</span>
                            <span class="section-badge">Comptage</span>
                        </div>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="width: 100px;">Coupure</th>
                                    <th style="width: 60px;">Nombre</th>
                                    <th style="width: 95px;">Montant (DH)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr class="write-row">
                                    <td style="font-weight: 900; background: #eff6ff;">Billet 200 DH</td>
                                    <td class="cell-blank"></td>
                                    <td class="cell-blank"></td>
                                </tr>
                                <tr class="write-row">
                                    <td style="font-weight: 900; background: #fffbeb;">Billet 100 DH</td>
                                    <td class="cell-blank"></td>
                                    <td class="cell-blank"></td>
                                </tr>
                                <tr class="write-row">
                                    <td style="font-weight: 900; background: #ecfdf5;">Billet 50 DH</td>
                                    <td class="cell-blank"></td>
                                    <td class="cell-blank"></td>
                                </tr>
                                <tr class="write-row">
                                    <td style="font-weight: 900; background: #faf5ff;">Billet 20 DH</td>
                                    <td class="cell-blank"></td>
                                    <td class="cell-blank"></td>
                                </tr>
                                <tr class="write-row">
                                    <td style="font-weight: 900; background: #f8fafc;">Pièces & Monnaie</td>
                                    <td class="cell-blank"></td>
                                    <td class="cell-blank"></td>
                                </tr>
                                <tr class="total-row">
                                    <td colspan="2" style="text-align: right; font-weight: 900;">TOTAL ESPÈCES (D) :</td>
                                    <td class="cell-blank cell-right" style="font-weight: 900;">.................... DH</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 6. CADRE RÉCAPITULATIF & ÉCART DE CAISSE -->
                <div class="recap-box">
                    <div class="recap-grid">
                        <div>
                            <div class="recap-item-title">Total Ventes (A + B)</div>
                            <div class="recap-item-val">........................ DH</div>
                        </div>
                        <div>
                            <div class="recap-item-title">Moins Hors-Espèces (C)</div>
                            <div class="recap-item-val">- ...................... DH</div>
                        </div>
                        <div>
                            <div class="recap-item-title">Espèces Dues ((A+B)-C)</div>
                            <div class="recap-item-val">........................ DH</div>
                        </div>
                        <div>
                            <div class="recap-item-title">Espèces Remises (D)</div>
                            <div class="recap-item-val" style="background: #f1f5f9; font-weight: 900;">........................ DH</div>
                        </div>
                    </div>

                    <div class="ecart-zone">
                        <div style="font-weight: 900; font-size: 10px; text-transform: uppercase; color: #0f172a;">
                            RÉSULTAT DU CONTRÔLE DE CAISSE :
                        </div>
                        <div class="ecart-checks">
                            <span class="checkbox-item"><span class="check-square"></span> <strong>CAISSE CONFORME (0 DH)</strong></span>
                            <span class="checkbox-item"><span class="check-square"></span> <strong>EXCÉDENT (+) :</strong> &nbsp;.............. DH</span>
                            <span class="checkbox-item"><span class="check-square"></span> <strong>MANQUANT (-) :</strong> &nbsp;.............. DH</span>
                        </div>
                    </div>

                    <div class="notes-row">
                        <span style="font-weight: 800; color: #334155;">Observations / Motif d'écart :</span>
                        <span class="notes-line"></span>
                    </div>
                </div>

                <!-- 7. CADRES DE SIGNATURES (STRICTEMENT SUR LA MÊME PAGE UNIQUE) -->
                <div class="signatures-grid">
                    <div class="sig-box">
                        <div class="sig-header">1. Le Pompiste</div>
                        <div class="sig-subtext">« Je certifie sur l'honneur l'exactitude des index de compteurs relevés et du montant versé. »</div>
                        <div class="sig-stamp">Date & Signature :</div>
                    </div>

                    <div class="sig-box">
                        <div class="sig-header">2. Chef de Piste / Caissier</div>
                        <div class="sig-subtext">« Justificatifs hors-espèces et fonds physiques comptés, vérifiés et réceptionnés en présence du pompiste. »</div>
                        <div class="sig-stamp">Date & Signature :</div>
                    </div>

                    <div class="sig-box">
                        <div class="sig-header">3. Direction / Gérant</div>
                        <div class="sig-subtext">« Vu et visé pour rapprochement comptable, vérification du stock et contrôle des recettes. »</div>
                        <div class="sig-stamp">Cachet & Signature :</div>
                    </div>
                </div>
            </div>

            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 300);
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
};
