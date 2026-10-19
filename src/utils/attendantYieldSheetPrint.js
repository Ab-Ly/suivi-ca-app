/**
 * Fiche de Comptage & Rendement Pompiste (Imprimable A4)
 * Conçue pour une traçabilité rigoureuse et une justification formelle de caisse de piste.
 * Permet l'écriture manuelle de la date, des index, du billetage et des émargements.
 */

export const printAttendantYieldSheet = (options = {}) => {
    const {
        attendantName = '',
        shiftLabel = '',
        stationName = 'STATION SERVICE PETROM',
        fuelTypes = ['Gasoil', 'Super Sans Plomb (SSP)'],
        defaultRowsCount = 5
    } = options;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Veuillez autoriser les fenêtres pop-up dans votre navigateur pour imprimer la fiche.");
        return;
    }

    // Lignes de volucompteurs pré-remplies ou vierges
    let indexRowsHtml = '';
    for (let i = 1; i <= defaultRowsCount; i++) {
        const defaultProduct = i <= 3 ? 'Gasoil' : (i <= 4 ? 'SSP' : '');
        indexRowsHtml += `
            <tr>
                <td style="text-align: center; font-weight: bold; width: 45px;">P${i}</td>
                <td style="width: 130px; font-weight: 500;">${defaultProduct}</td>
                <td style="width: 105px;"></td>
                <td style="width: 105px;"></td>
                <td style="width: 85px;"></td>
                <td style="width: 75px;"></td>
                <td style="width: 110px;"></td>
            </tr>
        `;
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Fiche de Comptage & Rendement Pompiste</title>
            <style>
                @page {
                    size: A4 portrait;
                    margin: 8mm 10mm 8mm 10mm;
                }
                * {
                    box-sizing: border-box;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    background-color: #f8fafc;
                    color: #0f172a;
                    margin: 0;
                    padding: 0;
                    font-size: 10px;
                    line-height: 1.3;
                }

                /* Barre d'action supérieure (masquée à l'impression) */
                .no-print-bar {
                    background: #0f172a;
                    color: white;
                    padding: 10px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    position: sticky;
                    top: 0;
                    z-index: 9999;
                }
                .no-print-bar button {
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 12px;
                    padding: 7px 16px;
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
                    max-width: 210mm;
                    margin: 12px auto;
                    background: #ffffff;
                    padding: 8mm 8mm 6mm 8mm;
                    border-radius: 4px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
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
                        margin: 0;
                        padding: 0;
                        box-shadow: none;
                        border-radius: 0;
                    }
                }

                /* Entête de fiche */
                .header-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 8px;
                    border-bottom: 2px solid #0f172a;
                    padding-bottom: 6px;
                }
                .brand-title {
                    font-size: 13px;
                    font-weight: 900;
                    color: #0f172a;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                }
                .main-title {
                    font-size: 15px;
                    font-weight: 900;
                    color: #1e3a8a;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                    margin: 2px 0;
                }
                .sub-title {
                    font-size: 9px;
                    color: #475569;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                /* Cadre d'identification avec date manuscrite */
                .meta-box {
                    border: 1.5px solid #0f172a;
                    background: #f8fafc;
                    border-radius: 4px;
                    padding: 6px 8px;
                    margin-bottom: 8px;
                }
                .meta-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 4px;
                }
                .meta-row:last-child {
                    margin-bottom: 0;
                }
                .meta-field {
                    font-size: 10px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .field-label {
                    font-weight: 800;
                    color: #0f172a;
                    text-transform: uppercase;
                    font-size: 9.5px;
                }
                .field-fill-dots {
                    border-bottom: 1.5px dotted #64748b;
                    display: inline-block;
                    min-height: 14px;
                }
                .date-fill-box {
                    border: 1.5px solid #0f172a;
                    background: white;
                    padding: 3px 8px;
                    font-weight: 800;
                    font-size: 11px;
                    border-radius: 3px;
                    letter-spacing: 1px;
                }
                .checkbox-item {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-weight: 600;
                    font-size: 9.5px;
                    margin-right: 12px;
                }
                .check-square {
                    width: 12px;
                    height: 12px;
                    border: 1.5px solid #0f172a;
                    display: inline-block;
                    background: white;
                }

                /* Grilles et Tableaux */
                .section-header {
                    background: #1e293b;
                    color: white;
                    padding: 4px 8px;
                    font-size: 10px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 6px;
                    margin-bottom: 3px;
                    border-radius: 3px;
                }
                .section-badge {
                    background: rgba(255,255,255,0.2);
                    padding: 1px 6px;
                    border-radius: 3px;
                    font-size: 8.5px;
                }

                table.data-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 6px;
                }
                table.data-table th, table.data-table td {
                    border: 1px solid #94a3b8;
                    padding: 4px 6px;
                    font-size: 9px;
                }
                table.data-table th {
                    background: #e2e8f0;
                    color: #0f172a;
                    font-weight: 800;
                    text-align: center;
                    text-transform: uppercase;
                    font-size: 8.5px;
                }
                table.data-table tr.total-row td {
                    background: #f1f5f9;
                    font-weight: 900;
                    font-size: 9.5px;
                    border-top: 1.5px solid #0f172a;
                }

                /* Mise en page deux colonnes : Règlements & Billetage */
                .two-columns {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 6px;
                }
                .col-left {
                    flex: 1.1;
                }
                .col-right {
                    flex: 0.9;
                }

                /* Lignes de remplissage manuel pour tableau */
                .blank-cell {
                    background: white;
                    height: 18px;
                }

                /* Cadre Résultat & Écart */
                .recap-box {
                    border: 2px solid #0f172a;
                    background: #f8fafc;
                    border-radius: 4px;
                    padding: 6px 10px;
                    margin-top: 6px;
                    margin-bottom: 6px;
                }
                .recap-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                    text-align: center;
                    padding-bottom: 6px;
                    border-bottom: 1.5px dashed #cbd5e1;
                }
                .recap-item-title {
                    font-size: 8.5px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #475569;
                    margin-bottom: 3px;
                }
                .recap-item-val {
                    font-size: 11px;
                    font-weight: 900;
                    color: #0f172a;
                    border-bottom: 1.5px solid #0f172a;
                    min-height: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: white;
                }

                .ecart-zone {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: 5px;
                }
                .ecart-checks {
                    display: flex;
                    gap: 14px;
                    align-items: center;
                }

                /* Zone des Signatures */
                .signatures-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                    margin-top: 6px;
                }
                .sig-box {
                    border: 1.5px solid #0f172a;
                    background: white;
                    border-radius: 4px;
                    padding: 6px 8px;
                    height: 78px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .sig-header {
                    font-weight: 800;
                    font-size: 9px;
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
                }
                .sig-stamp {
                    font-size: 8px;
                    color: #94a3b8;
                    text-align: center;
                    margin-top: auto;
                }

                /* Ligne pointillée d'observation */
                .notes-row {
                    margin-top: 4px;
                    font-size: 8.5px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .notes-line {
                    flex: 1;
                    border-bottom: 1px dotted #64748b;
                    min-height: 12px;
                }
            </style>
        </head>
        <body>
            <!-- BARRE DE COMMANDE SUPÉRIEURE (NON IMPRIMÉE) -->
            <div class="no-print-bar">
                <div>
                    <strong style="font-size: 14px;">📄 Fiche de Comptage & Rendement Pompiste</strong>
                    <span style="font-size: 12px; opacity: 0.8; margin-left: 10px;">Format A4 Portrait · Prête pour émargement manuscrit</span>
                </div>
                <div>
                    <button class="btn-print" onclick="window.print()">🖨️ Imprimer la fiche</button>
                    <button class="btn-close" onclick="window.close()">Fermer</button>
                </div>
            </div>

            <!-- CONTENU DE LA FEUILLE A4 -->
            <div class="sheet-container">
                <!-- ENTÊTE OFFICIEL -->
                <table class="header-table">
                    <tr>
                        <td style="width: 65%;">
                            <div class="brand-title">${stationName}</div>
                            <div class="main-title">Fiche de Rendement & Comptage Piste</div>
                            <div class="sub-title">Document officiel de traçabilité, relevé de compteurs & clôture de quart</div>
                        </td>
                        <td style="width: 35%; text-align: right; vertical-align: top;">
                            <div style="font-size: 8.5px; color: #64748b; font-weight: 700;">DOCUMENT INTERNE CONTRÔLE</div>
                            <div style="font-size: 10px; font-weight: 900; margin-top: 2px;">
                                N° FICHE : <span class="field-fill-dots" style="width: 80px;"></span>
                            </div>
                        </td>
                    </tr>
                </table>

                <!-- CADRE D'IDENTIFICATION & DATE MANUELLE -->
                <div class="meta-box">
                    <div class="meta-row">
                        <div class="meta-field">
                            <span class="field-label">📅 Date de la vacation :</span>
                            <span class="date-fill-box">
                                JOUR : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / MOIS : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / 202&nbsp;&nbsp;&nbsp;
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
                            <span class="field-fill-dots" style="flex: 1; font-weight: bold; font-size: 11px; padding-left: 6px;">
                                ${attendantName || ''}
                            </span>
                        </div>
                        <div class="meta-field" style="flex: 0.8; margin-left: 12px;">
                            <span class="field-label">Îlot / Pistes :</span>
                            <span class="field-fill-dots" style="flex: 1;"></span>
                        </div>
                        <div class="meta-field" style="flex: 1.2; margin-left: 12px;">
                            <span class="field-label">Chef de piste / Caissier :</span>
                            <span class="field-fill-dots" style="flex: 1;"></span>
                        </div>
                    </div>
                </div>

                <!-- SECTION 1 : RELEVÉ DES VOLUCOMPTEURS / INDEX CARBURANTS -->
                <div class="section-header">
                    <span>1. Relevé des Compteurs Volucompteurs & Ventes Carburants</span>
                    <span class="section-badge">Contrôle Métrologique des Index</span>
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
                            <th style="width: 110px;">Montant Total (DH)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${indexRowsHtml}
                        <tr class="total-row">
                            <td colspan="4" style="text-align: right; padding-right: 8px;">SOUS-TOTAL RENDEMENT CARBURANTS (A) :</td>
                            <td class="blank-cell" style="text-align: center;">...... L</td>
                            <td style="background: #e2e8f0;"></td>
                            <td class="blank-cell" style="text-align: right; font-weight: 900;">.................... DH</td>
                        </tr>
                    </tbody>
                </table>

                <!-- SECTION 2 : VENTES ANNEXES PISTE -->
                <div class="section-header">
                    <span>2. Ventes Annexes Réalisées sur Piste (Lubrifiants & Services)</span>
                    <span class="section-badge">Produits Piste</span>
                </div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 40px;">N°</th>
                            <th style="width: 320px;">Désignation Produit (Huile / Lubrifiant / Lave-glace / Autre)</th>
                            <th style="width: 80px;">Quantité</th>
                            <th style="width: 100px;">Prix Unitaire</th>
                            <th style="width: 145px;">Montant Total (DH)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="text-align: center; font-weight: bold;">1</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                        </tr>
                        <tr>
                            <td style="text-align: center; font-weight: bold;">2</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                        </tr>
                        <tr class="total-row">
                            <td colspan="4" style="text-align: right; padding-right: 8px;">SOUS-TOTAL VENTES ANNEXES (B) :</td>
                            <td class="blank-cell" style="text-align: right; font-weight: 900;">.................... DH</td>
                        </tr>
                    </tbody>
                </table>

                <!-- SECTION 3 & 4 : DEUX COLONNES (HORS-ESPÈCES + BILLETAGE) -->
                <div class="two-columns">
                    <!-- COLONNE GAUCHE : JUSTIFICATIFS HORS-ESPÈCES -->
                    <div class="col-left">
                        <div class="section-header">
                            <span>3. Justificatifs Hors-Espèces</span>
                            <span class="section-badge">Monétique & Bons</span>
                        </div>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="width: 140px;">Mode de Règlement</th>
                                    <th style="width: 85px;">Nbre / Réf</th>
                                    <th style="width: 110px;">Montant (DH)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="font-weight: 700;">Cartes TPE (Bancaires)</td>
                                    <td>...... tickets</td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td style="font-weight: 700;">Petrom Card / Cartes</td>
                                    <td>...... tickets</td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td style="font-weight: 700;">Bons Société / Crédit</td>
                                    <td>...... bons</td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td style="font-weight: 700;">Bons SNTL</td>
                                    <td>...... bons</td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td style="font-weight: 700;">Chèques / Divers</td>
                                    <td>...... pièces</td>
                                    <td></td>
                                </tr>
                                <tr class="total-row">
                                    <td colspan="2" style="text-align: right; font-weight: bold;">TOTAL HORS-ESPÈCES (C) :</td>
                                    <td class="blank-cell" style="text-align: right; font-weight: 900;">.................... DH</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- COLONNE DROITE : DÉCOMPTE PHYSIQUE DU BILLETAGE -->
                    <div class="col-right">
                        <div class="section-header">
                            <span>4. Décompte Physique Espèces</span>
                            <span class="section-badge">Billetage</span>
                        </div>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="width: 90px;">Coupure</th>
                                    <th style="width: 60px;">Nombre</th>
                                    <th style="width: 95px;">Montant (DH)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="font-weight: bold; background: #eff6ff;">Billet 200 DH</td>
                                    <td></td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td style="font-weight: bold; background: #fffbeb;">Billet 100 DH</td>
                                    <td></td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td style="font-weight: bold; background: #ecfdf5;">Billet 50 DH</td>
                                    <td></td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td style="font-weight: bold; background: #faf5ff;">Billet 20 DH</td>
                                    <td></td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td style="font-weight: bold; background: #f8fafc;">Pièces (10, 5, 2, 1 DH)</td>
                                    <td></td>
                                    <td></td>
                                </tr>
                                <tr class="total-row">
                                    <td colspan="2" style="text-align: right; font-weight: bold;">TOTAL ESPÈCES (D) :</td>
                                    <td class="blank-cell" style="text-align: right; font-weight: 900;">.................... DH</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- SECTION 5 : BILAN DE FIN DE QUART & ÉCART CONSTATÉ -->
                <div class="recap-box">
                    <div class="recap-grid">
                        <div>
                            <div class="recap-item-title">Total Recettes (A + B)</div>
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
                            <div class="recap-item-title">Espèces Réelles (D)</div>
                            <div class="recap-item-val" style="background: #f1f5f9; font-weight: 900;">........................ DH</div>
                        </div>
                    </div>

                    <div class="ecart-zone">
                        <div style="font-weight: 900; font-size: 10px; text-transform: uppercase; color: #0f172a;">
                            VERDICT DE CAISSE :
                        </div>
                        <div class="ecart-checks">
                            <span class="checkbox-item"><span class="check-square"></span> <strong>CAISSE CONFORME (0 DH)</strong></span>
                            <span class="checkbox-item"><span class="check-square"></span> <strong>EXCÉDENT (+) :</strong> &nbsp;.............. DH</span>
                            <span class="checkbox-item"><span class="check-square"></span> <strong>MANQUANT (-) :</strong> &nbsp;.............. DH</span>
                        </div>
                    </div>

                    <div class="notes-row">
                        <span style="font-weight: 700; color: #475569;">Motif / Observations :</span>
                        <span class="notes-line"></span>
                    </div>
                </div>

                <!-- SECTION 6 : SIGNATURES & VALEUR PROBANTE -->
                <div class="signatures-grid">
                    <div class="sig-box">
                        <div class="sig-header">1. Le Pompiste</div>
                        <div class="sig-subtext">« Je certifie sur l'honneur l'exactitude des index de compteurs et du montant versé. »</div>
                        <div class="sig-stamp">Date & Signature :</div>
                    </div>

                    <div class="sig-box">
                        <div class="sig-header">2. Réceptionnaire / Chef de Piste</div>
                        <div class="sig-subtext">« Justificatifs et fonds comptés, vérifiés et réceptionnés en présence du pompiste. »</div>
                        <div class="sig-stamp">Date & Signature :</div>
                    </div>

                    <div class="sig-box">
                        <div class="sig-header">3. Visa de la Direction / Gérant</div>
                        <div class="sig-subtext">« Vu, vérifié pour rapprochement comptable et contrôle des recettes. »</div>
                        <div class="sig-stamp">Cachet & Signature :</div>
                    </div>
                </div>
            </div>

            <script>
                // Déclenchement automatique de l'impression après chargement complet
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
