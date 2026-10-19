/**
 * Fiche de Comptage & Rendement Pompiste (Imprimable A4 Pleine Page)
 * Calibrée pour occuper 100% de la hauteur et largeur de la page A4,
 * avec une typographie grande et lisible et des cases hautes pour l'écriture manuscrite.
 */

export const printAttendantYieldSheet = (options = {}) => {
    const {
        attendantName = '',
        shiftLabel = '',
        stationName = 'STATION SERVICE PETROM',
        defaultRowsCount = 6
    } = options;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Veuillez autoriser les fenêtres pop-up dans votre navigateur pour imprimer la fiche.");
        return;
    }

    // 6 lignes de volucompteurs avec hauteur d'écriture confortable
    let indexRowsHtml = '';
    for (let i = 1; i <= defaultRowsCount; i++) {
        const defaultProduct = i <= 3 ? 'Gasoil' : (i <= 5 ? 'SSP (Super)' : '');
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
                    margin: 7mm 9mm 7mm 9mm;
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

                /* Barre de contrôle prévisualisation (masquée à l'impression) */
                .no-print-bar {
                    background: #0f172a;
                    color: white;
                    padding: 12px 24px;
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
                    padding: 8px 20px;
                    border-radius: 8px;
                    border: none;
                    transition: all 0.2s;
                }
                .btn-print {
                    background: #2563eb;
                    color: white;
                    margin-right: 10px;
                }
                .btn-print:hover { background: #1d4ed8; }
                .btn-close {
                    background: #475569;
                    color: white;
                }
                .btn-close:hover { background: #334155; }

                /* Conteneur principal A4 PLEINE PAGE */
                .sheet-container {
                    width: 100%;
                    max-width: 196mm;
                    min-height: 278mm;
                    margin: 10px auto;
                    background: #ffffff;
                    padding: 6mm 7mm 4mm 7mm;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    box-shadow: 0 4px 25px rgba(0,0,0,0.08);
                }

                @media print {
                    body {
                        background: white;
                    }
                    .no-print-bar {
                        display: none !important;
                    }
                    .sheet-container {
                        max-width: 100%;
                        min-height: 100%;
                        height: 100%;
                        margin: 0;
                        padding: 0;
                        box-shadow: none;
                        border-radius: 0;
                    }
                }

                /* 1. EN-TÊTE OFFICIEL */
                .header-table {
                    width: 100%;
                    border-collapse: collapse;
                    border-bottom: 2.5px solid #0f172a;
                    padding-bottom: 6px;
                    margin-bottom: 7px;
                }
                .brand-title {
                    font-size: 14px;
                    font-weight: 900;
                    color: #0f172a;
                    letter-spacing: 0.8px;
                    text-transform: uppercase;
                }
                .main-title {
                    font-size: 18px;
                    font-weight: 900;
                    color: #1e3a8a;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin: 2px 0 1px 0;
                }
                .sub-title {
                    font-size: 10px;
                    color: #475569;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }
                .doc-ref-box {
                    text-align: right;
                    vertical-align: top;
                }
                .doc-ref-badge {
                    display: inline-block;
                    font-size: 9.5px;
                    font-weight: 800;
                    background: #e2e8f0;
                    color: #1e293b;
                    padding: 2px 8px;
                    border-radius: 4px;
                    text-transform: uppercase;
                }
                .fiche-number {
                    font-size: 11px;
                    font-weight: 900;
                    margin-top: 4px;
                    color: #0f172a;
                }

                /* 2. CADRE D'IDENTIFICATION & DATE MANUELLE */
                .meta-box {
                    border: 2px solid #0f172a;
                    background: #f8fafc;
                    border-radius: 5px;
                    padding: 7px 10px;
                    margin-bottom: 7px;
                }
                .meta-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .meta-field {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .field-label {
                    font-weight: 900;
                    color: #0f172a;
                    text-transform: uppercase;
                    font-size: 11px;
                }
                .field-underline {
                    border-bottom: 1.5px dotted #334155;
                    display: inline-block;
                    min-height: 18px;
                }
                .date-fill-box {
                    border: 2px solid #0f172a;
                    background: white;
                    padding: 4px 12px;
                    font-weight: 900;
                    font-size: 12px;
                    border-radius: 4px;
                    letter-spacing: 1.5px;
                    display: inline-flex;
                    align-items: center;
                }
                .checkbox-item {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-weight: 700;
                    font-size: 11px;
                    margin-left: 10px;
                }
                .check-square {
                    width: 14px;
                    height: 14px;
                    border: 2px solid #0f172a;
                    display: inline-block;
                    background: white;
                    border-radius: 2px;
                }

                /* 3. EN-TÊTE DE SECTION */
                .section-header {
                    background: #1e293b;
                    color: white;
                    padding: 5px 10px;
                    font-size: 11.5px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.6px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-radius: 4px;
                    margin-top: 6px;
                    margin-bottom: 3px;
                }
                .section-badge {
                    background: rgba(255,255,255,0.25);
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 9.5px;
                    font-weight: 700;
                }

                /* 4. TABLEAUX DE DONNÉES */
                table.data-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 6px;
                }
                table.data-table th, table.data-table td {
                    border: 1.5px solid #475569;
                    padding: 5px 8px;
                    font-size: 10.5px;
                }
                table.data-table th {
                    background: #e2e8f0;
                    color: #0f172a;
                    font-weight: 900;
                    text-align: center;
                    text-transform: uppercase;
                    font-size: 10px;
                    letter-spacing: 0.3px;
                }
                tr.write-row td {
                    height: 29px; /* Hauteur confortable pour écrire au stylo */
                }
                tr.write-row-lg td {
                    height: 31px;
                }
                .cell-center { text-align: center; }
                .cell-right { text-align: right; }
                .cell-blank { background: white; }
                .cell-product { font-size: 11px; }

                table.data-table tr.total-row td {
                    background: #f1f5f9;
                    font-weight: 900;
                    font-size: 11px;
                    border-top: 2.5px solid #0f172a;
                    height: 30px;
                }

                /* 5. DISPOSITION EN DEUX COLONNES HORS-ESPÈCES + BILLETAGE */
                .two-columns {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 6px;
                }
                .col-left {
                    flex: 1.15;
                }
                .col-right {
                    flex: 0.85;
                }

                /* 6. CADRE RÉCAPITULATIF & ÉCART DE CAISSE */
                .recap-box {
                    border: 2px solid #0f172a;
                    background: #f8fafc;
                    border-radius: 5px;
                    padding: 7px 12px;
                    margin-top: 5px;
                    margin-bottom: 6px;
                }
                .recap-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                    text-align: center;
                    padding-bottom: 7px;
                    border-bottom: 2px dashed #cbd5e1;
                }
                .recap-item-title {
                    font-size: 10px;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: #475569;
                    margin-bottom: 3px;
                }
                .recap-item-val {
                    font-size: 13px;
                    font-weight: 900;
                    color: #0f172a;
                    border: 1.5px solid #0f172a;
                    border-radius: 4px;
                    min-height: 27px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: white;
                }

                .ecart-zone {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: 6px;
                }
                .ecart-checks {
                    display: flex;
                    gap: 18px;
                    align-items: center;
                }

                .notes-row {
                    margin-top: 6px;
                    font-size: 10px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .notes-line {
                    flex: 1;
                    border-bottom: 1.5px dotted #64748b;
                    min-height: 16px;
                }

                /* 7. CADRES DE SIGNATURES */
                .signatures-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                    margin-top: 6px;
                }
                .sig-box {
                    border: 2px solid #0f172a;
                    background: white;
                    border-radius: 5px;
                    padding: 8px 10px;
                    height: 100px; /* Grand cadre spacieux pour signature et cachet */
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .sig-header {
                    font-weight: 900;
                    font-size: 11px;
                    text-transform: uppercase;
                    color: #0f172a;
                    border-bottom: 1.5px solid #e2e8f0;
                    padding-bottom: 3px;
                }
                .sig-subtext {
                    font-size: 8.5px;
                    color: #64748b;
                    font-style: italic;
                    margin-top: 2px;
                    line-height: 1.25;
                }
                .sig-stamp {
                    font-size: 9.5px;
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
                    <strong style="font-size: 15px;">📄 Fiche de Comptage & Rendement Pompiste</strong>
                    <span style="font-size: 13px; opacity: 0.8; margin-left: 12px;">Format A4 Portrait Pleine Page · Prête pour émargement manuscrit</span>
                </div>
                <div>
                    <button class="btn-print" onclick="window.print()">🖨️ Lancer l'impression A4</button>
                    <button class="btn-close" onclick="window.close()">Fermer</button>
                </div>
            </div>

            <!-- CONTENU DE LA FEUILLE A4 (PLEINE HAUTEUR) -->
            <div class="sheet-container">
                <div>
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
                                    N° FICHE : <span class="field-underline" style="width: 90px;"></span>
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
                        <div class="meta-row" style="margin-top: 7px;">
                            <div class="meta-field" style="flex: 1.4;">
                                <span class="field-label">👤 Nom du Pompiste :</span>
                                <span class="field-underline" style="flex: 1; font-weight: bold; font-size: 13px; padding-left: 8px;">
                                    ${attendantName || ''}
                                </span>
                            </div>
                            <div class="meta-field" style="flex: 0.8; margin-left: 14px;">
                                <span class="field-label">Îlot / Pistes :</span>
                                <span class="field-underline" style="flex: 1;"></span>
                            </div>
                            <div class="meta-field" style="flex: 1.2; margin-left: 14px;">
                                <span class="field-label">Chef de Piste :</span>
                                <span class="field-underline" style="flex: 1;"></span>
                            </div>
                        </div>
                    </div>

                    <!-- 3. SECTION 1 : RELEVÉ DES VOLUCOMPTEURS / INDEX (6 LIGNES HAUTES) -->
                    <div class="section-header">
                        <span>1. Relevé des Compteurs Volucompteurs & Ventes Carburants</span>
                        <span class="section-badge">Index Métrologiques de Début & Fin de Quart</span>
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="width: 48px;">Pompe</th>
                                <th style="width: 140px;">Carburant</th>
                                <th style="width: 115px;">Index Départ (Prise)</th>
                                <th style="width: 115px;">Index Arrivée (Fin)</th>
                                <th style="width: 95px;">Volume Vendu (L)</th>
                                <th style="width: 85px;">Prix / L (DH)</th>
                                <th style="width: 115px;">Montant Total (DH)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${indexRowsHtml}
                            <tr class="total-row">
                                <td colspan="4" style="text-align: right; padding-right: 12px; font-weight: 900;">SOUS-TOTAL RENDEMENT CARBURANTS (A) :</td>
                                <td class="cell-blank cell-center" style="font-weight: 800;">.......... L</td>
                                <td style="background: #e2e8f0;"></td>
                                <td class="cell-blank cell-right" style="font-weight: 900; font-size: 12px;">.................... DH</td>
                            </tr>
                        </tbody>
                    </table>

                    <!-- 4. SECTION 2 : VENTES ANNEXES PISTE (3 LIGNES CONFORTABLES) -->
                    <div class="section-header">
                        <span>2. Ventes Annexes Réalisées sur Piste (Lubrifiants, Huiles & Services)</span>
                        <span class="section-badge">Produits Piste</span>
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="width: 45px;">N°</th>
                                <th style="width: 330px;">Désignation Produit (Lubrifiant, Bidon huile, Lave-glace, Lavage, Autre)</th>
                                <th style="width: 85px;">Quantité</th>
                                <th style="width: 105px;">Prix Unitaire</th>
                                <th style="width: 145px;">Montant Total (DH)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="write-row-lg">
                                <td class="cell-center font-bold">1</td>
                                <td class="cell-blank"></td>
                                <td class="cell-blank"></td>
                                <td class="cell-blank"></td>
                                <td class="cell-blank"></td>
                            </tr>
                            <tr class="write-row-lg">
                                <td class="cell-center font-bold">2</td>
                                <td class="cell-blank"></td>
                                <td class="cell-blank"></td>
                                <td class="cell-blank"></td>
                                <td class="cell-blank"></td>
                            </tr>
                            <tr class="write-row-lg">
                                <td class="cell-center font-bold">3</td>
                                <td class="cell-blank"></td>
                                <td class="cell-blank"></td>
                                <td class="cell-blank"></td>
                                <td class="cell-blank"></td>
                            </tr>
                            <tr class="total-row">
                                <td colspan="4" style="text-align: right; padding-right: 12px; font-weight: 900;">SOUS-TOTAL VENTES ANNEXES (B) :</td>
                                <td class="cell-blank cell-right" style="font-weight: 900; font-size: 12px;">.................... DH</td>
                            </tr>
                        </tbody>
                    </table>

                    <!-- 5. SECTION 3 & 4 : DEUX COLONNES (HORS-ESPÈCES & BILLETAGE PHYSIQUE) -->
                    <div class="two-columns">
                        <!-- COLONNE GAUCHE : HORS-ESPÈCES -->
                        <div class="col-left">
                            <div class="section-header">
                                <span>3. Justificatifs Hors-Espèces</span>
                                <span class="section-badge">Monétique & Bons</span>
                            </div>
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th style="width: 145px;">Mode de Règlement</th>
                                        <th style="width: 95px;">Nbre / Réf</th>
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

                        <!-- COLONNE DROITE : BILLETAGE ESPÈCES -->
                        <div class="col-right">
                            <div class="section-header">
                                <span>4. Billetage Espèces Remises</span>
                                <span class="section-badge">Comptage Réel</span>
                            </div>
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th style="width: 105px;">Coupure</th>
                                        <th style="width: 65px;">Nombre</th>
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
                            <div style="font-weight: 900; font-size: 11px; text-transform: uppercase; color: #0f172a;">
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
                </div>

                <!-- 7. CADRES DE SIGNATURES (BAS DE PAGE A4) -->
                <div class="signatures-grid">
                    <div class="sig-box">
                        <div class="sig-header">1. Le Pompiste</div>
                        <div class="sig-subtext">« Je certifie sur l'honneur l'exactitude des index de compteurs relevés et du montant des fonds remis. »</div>
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
                    }, 350);
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
};
