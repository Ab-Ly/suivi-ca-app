/**
 * Revenue Control Print Utility
 * Generates an elegant, professional A4 print sheet for Daily Revenue Control & Cash Closing
 */

const formatPrice = (amount) => {
    const num = Number(amount) || 0;
    return `${num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH`;
};

const formatFrenchDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const formatted = dateObj.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

export const printRevenueControlSheet = (controlData) => {
    const {
        date,
        shifts = [],
        annexes = {},
        horsEspeces = {},
        comptageReel = 0,
        totalRendement = 0,
        totalAnnexes = 0,
        totalRecettes = 0,
        totalHorsEspeces = 0,
        soldeTheorique = 0,
        ecart = 0,
        notes = ''
    } = controlData;

    const isOk = Math.abs(ecart) <= 0.50;
    const formattedDate = formatFrenchDate(date);
    const printDate = new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const statusBadgeText = isOk
        ? 'CAISSE ÉQUILIBRÉE'
        : ecart > 0
            ? 'EXCÉDENT D\'ESPÈCES'
            : 'DÉFICIT D\'ESPÈCES';

    const statusBadgeColor = isOk
        ? { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' }
        : ecart > 0
            ? { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' }
            : { bg: '#fff1f2', text: '#9f1239', border: '#fecdd3' };

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Veuillez autoriser les fenêtres pop-up dans votre navigateur pour imprimer la fiche.");
        return;
    }

    // Build shifts rows
    let shiftsHtml = '';
    (shifts || []).forEach((s) => {
        const attendants = s.attendants || [];
        const shiftTotal = attendants.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

        if (attendants.length === 0) {
            shiftsHtml += `
                <tr>
                    <td class="font-bold text-gray-700">${s.label || 'Shift'} <span class="badge-time">${s.timeRange || ''}</span></td>
                    <td class="text-gray-400 italic">Aucun pompiste saisi</td>
                    <td class="text-right font-mono">0,00 DH</td>
                    <td class="text-right font-mono font-bold">${formatPrice(0)}</td>
                </tr>
            `;
        } else {
            attendants.forEach((att, idx) => {
                shiftsHtml += `
                    <tr>
                        ${idx === 0 ? `<td rowspan="${attendants.length}" class="shift-name font-bold">${s.label || 'Shift'}<br><span class="badge-time">${s.timeRange || ''}</span></td>` : ''}
                        <td class="attendant-name">${att.attendantName || '<span class="text-gray-400 italic">Non spécifié</span>'}</td>
                        <td class="text-right font-mono font-medium">${formatPrice(att.amount)}</td>
                        ${idx === 0 ? `<td rowspan="${attendants.length}" class="shift-subtotal text-right font-mono font-bold">${formatPrice(shiftTotal)}</td>` : ''}
                    </tr>
                `;
            });
        }
    });

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Contrôle Recettes — ${date}</title>
            <style>
                @page {
                    size: A4 portrait;
                    margin: 10mm 12mm 10mm 12mm;
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
                    font-size: 11px;
                    line-height: 1.4;
                }
                /* Top preview action bar (hidden during print) */
                .no-print-bar {
                    background: #1e293b;
                    color: white;
                    padding: 12px 24px;
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
                    font-weight: 600;
                    font-size: 13px;
                    padding: 8px 18px;
                    border-radius: 8px;
                    border: none;
                    transition: all 0.2s;
                }
                .btn-print {
                    background: #0284c7;
                    color: white;
                    margin-right: 10px;
                }
                .btn-print:hover { background: #0369a1; }
                .btn-close {
                    background: #475569;
                    color: white;
                }
                .btn-close:hover { background: #334155; }
                
                /* Printable page container */
                .page-container {
                    width: 210mm;
                    min-height: 297mm;
                    margin: 20px auto;
                    background: white;
                    padding: 14mm 15mm;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.08);
                    border-radius: 4px;
                }
                @media print {
                    .no-print-bar { display: none !important; }
                    body { background: white; }
                    .page-container {
                        width: 100%;
                        min-height: auto;
                        margin: 0;
                        padding: 0;
                        box-shadow: none;
                    }
                }

                /* Header */
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #0284c7;
                    padding-bottom: 12px;
                    margin-bottom: 14px;
                }
                .header-brand {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .header-brand img {
                    height: 48px;
                    object-fit: contain;
                }
                .brand-title {
                    font-size: 16px;
                    font-weight: 900;
                    color: #0f172a;
                    letter-spacing: -0.02em;
                    margin: 0;
                    text-transform: uppercase;
                }
                .brand-subtitle {
                    font-size: 10px;
                    color: #64748b;
                    font-weight: 600;
                    margin: 2px 0 0 0;
                }
                .header-badge {
                    text-align: right;
                }
                .status-pill {
                    display: inline-block;
                    padding: 5px 12px;
                    border-radius: 20px;
                    font-weight: 800;
                    font-size: 10px;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                    border: 1px solid ${statusBadgeColor.border};
                    background: ${statusBadgeColor.bg};
                    color: ${statusBadgeColor.text};
                }
                .date-label {
                    font-size: 13px;
                    font-weight: 800;
                    color: #1e293b;
                    margin-top: 4px;
                }

                /* 4 KPI CARDS */
                .kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                    margin-bottom: 14px;
                }
                .kpi-card {
                    padding: 9px 12px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    background: #f8fafc;
                }
                .kpi-title {
                    font-size: 9px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #64748b;
                    letter-spacing: 0.03em;
                    margin-bottom: 4px;
                }
                .kpi-value {
                    font-size: 14px;
                    font-weight: 900;
                    font-family: monospace;
                    color: #0f172a;
                }
                .kpi-card.highlight {
                    background: #f0fdf4;
                    border-color: #bbf7d0;
                }
                .kpi-card.highlight .kpi-value {
                    color: #15803d;
                }
                .kpi-card.alert-deficit {
                    background: #fef2f2;
                    border-color: #fecaca;
                }
                .kpi-card.alert-deficit .kpi-value {
                    color: #b91c1c;
                }
                .kpi-card.alert-excedent {
                    background: #eff6ff;
                    border-color: #bfdbfe;
                }
                .kpi-card.alert-excedent .kpi-value {
                    color: #1d4ed8;
                }

                /* Section container */
                .section-block {
                    margin-bottom: 12px;
                    page-break-inside: avoid;
                }
                .section-header {
                    background: #1e293b;
                    color: white;
                    font-size: 10px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    padding: 5px 10px;
                    border-radius: 4px 4px 0 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .section-header .subtotal {
                    font-family: monospace;
                    font-size: 11px;
                    color: #38bdf8;
                }

                /* Tables */
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 10px;
                }
                th, td {
                    border: 1px solid #cbd5e1;
                    padding: 5px 8px;
                    vertical-align: middle;
                }
                th {
                    background: #f1f5f9;
                    font-weight: 700;
                    color: #334155;
                    text-transform: uppercase;
                    font-size: 9px;
                    text-align: left;
                }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
                .font-bold { font-weight: 700; }
                .badge-time {
                    display: inline-block;
                    font-size: 8px;
                    font-weight: 600;
                    background: #e2e8f0;
                    color: #475569;
                    padding: 1px 5px;
                    border-radius: 4px;
                    margin-top: 2px;
                }
                .shift-name {
                    background: #f8fafc;
                    vertical-align: middle;
                    width: 25%;
                }
                .shift-subtotal {
                    background: #f8fafc;
                    color: #1e293b;
                }

                /* Dual grid for Annexes & Hors Espèces */
                .two-col-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin-bottom: 12px;
                    page-break-inside: avoid;
                }

                /* Reconciliation final banner */
                .reconciliation-card {
                    border: 2px solid ${isOk ? '#10b981' : ecart > 0 ? '#3b82f6' : '#ef4444'};
                    background: ${isOk ? '#f0fdf4' : ecart > 0 ? '#eff6ff' : '#fef2f2'};
                    border-radius: 8px;
                    padding: 10px 14px;
                    margin-bottom: 12px;
                    page-break-inside: avoid;
                }
                .recon-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 6px;
                }
                .recon-title {
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: #1e293b;
                }
                .recon-diff {
                    font-size: 16px;
                    font-weight: 900;
                    font-family: monospace;
                    color: ${isOk ? '#15803d' : ecart > 0 ? '#1d4ed8' : '#b91c1c'};
                }
                .recon-formula {
                    font-size: 9px;
                    color: #64748b;
                    display: flex;
                    justify-content: space-between;
                    font-family: monospace;
                    border-top: 1px dashed rgba(0,0,0,0.15);
                    padding-top: 6px;
                    margin-top: 4px;
                }

                /* Notes box */
                .notes-box {
                    border: 1px solid #e2e8f0;
                    background: #fafafa;
                    border-radius: 6px;
                    padding: 7px 10px;
                    margin-bottom: 14px;
                    page-break-inside: avoid;
                }
                .notes-title {
                    font-size: 9px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #475569;
                    margin-bottom: 3px;
                }
                .notes-content {
                    font-size: 10px;
                    color: #1e293b;
                    font-style: italic;
                    min-height: 16px;
                }

                /* Signatures footer */
                .signatures-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 15px;
                    margin-top: 15px;
                    page-break-inside: avoid;
                }
                .sig-box {
                    border: 1px dashed #94a3b8;
                    border-radius: 6px;
                    padding: 8px;
                    height: 65px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .sig-label {
                    font-size: 9px;
                    font-weight: 700;
                    color: #475569;
                    text-transform: uppercase;
                    text-align: center;
                }
                .sig-line {
                    border-bottom: 1px solid #cbd5e1;
                    margin-bottom: 4px;
                }
                .footer-meta {
                    margin-top: 15px;
                    border-top: 1px solid #e2e8f0;
                    padding-top: 6px;
                    display: flex;
                    justify-content: space-between;
                    font-size: 8px;
                    color: #94a3b8;
                }
            </style>
        </head>
        <body>
            <!-- On-screen preview toolbar -->
            <div class="no-print-bar">
                <div style="font-weight: 700;">
                    📄 Fiche de Contrôle des Recettes — ${date}
                </div>
                <div>
                    <button class="btn-print" onclick="window.print()">🖨️ Imprimer maintenant</button>
                    <button class="btn-close" onclick="window.close()">Fermer</button>
                </div>
            </div>

            <!-- Page A4 -->
            <div class="page-container">
                <!-- Header -->
                <div class="header">
                    <div class="header-brand">
                        <img src="/logo.png" alt="Petrom Logo" onerror="this.style.display='none'">
                        <div>
                            <h1 class="brand-title">PETROM — STATION SERVICE</h1>
                            <p class="brand-subtitle">FICHE DE CONTRÔLE DES RECETTES & ARRÊTÉ DE CAISSE</p>
                        </div>
                    </div>
                    <div class="header-badge">
                        <div class="status-pill">${statusBadgeText}</div>
                        <div class="date-label">${formattedDate}</div>
                    </div>
                </div>

                <!-- 4 KPI SUMMARY CARDS -->
                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-title">Recettes Brutes (A+B)</div>
                        <div class="kpi-value">${formatPrice(totalRecettes)}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">Hors Espèces (C)</div>
                        <div class="kpi-value">${formatPrice(totalHorsEspeces)}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">Solde Théorique (D)</div>
                        <div class="kpi-value font-mono">${formatPrice(soldeTheorique)}</div>
                    </div>
                    <div class="kpi-card ${isOk ? 'highlight' : ecart > 0 ? 'alert-excedent' : 'alert-deficit'}">
                        <div class="kpi-title">Comptage Réel & Écart</div>
                        <div class="kpi-value">${formatPrice(comptageReel)}</div>
                    </div>
                </div>

                <!-- SECTION 1 : RENDEMENT PISTE (SHIFTS) -->
                <div class="section-block">
                    <div class="section-header">
                        <span>Section 1 : Rendements Piste par Shift</span>
                        <span class="subtotal">Total Piste : ${formatPrice(totalRendement)}</span>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 25%;">Shift / Horaires</th>
                                <th style="width: 45%;">Pompiste en service</th>
                                <th class="text-right" style="width: 15%;">Rendement</th>
                                <th class="text-right" style="width: 15%;">Sous-total Shift</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${shiftsHtml}
                        </tbody>
                    </table>
                </div>

                <!-- DUAL GRID : SECTION 2 (ANNEXES) & SECTION 3 (HORS ESPÈCES) -->
                <div class="two-col-grid">
                    <!-- SECTION 2 : VENTES ANNEXES -->
                    <div>
                        <div class="section-header" style="background: #047857;">
                            <span>Section 2 : Ventes Annexes</span>
                            <span class="subtotal" style="color: #6ee7b7;">${formatPrice(totalAnnexes)}</span>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Rubrique</th>
                                    <th class="text-right">Montant</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Shop & Café</td>
                                    <td class="text-right font-mono font-medium">${formatPrice(annexes.shop_cafe)}</td>
                                </tr>
                                <tr>
                                    <td>Service Bosch</td>
                                    <td class="text-right font-mono font-medium">${formatPrice(annexes.sce_bosch)}</td>
                                </tr>
                                <tr>
                                    <td>Lubrifiants</td>
                                    <td class="text-right font-mono font-medium">${formatPrice(annexes.lubrifiant)}</td>
                                </tr>
                                <tr style="background: #f1f5f9; font-weight: bold;">
                                    <td>TOTAL ANNEXES</td>
                                    <td class="text-right font-mono">${formatPrice(totalAnnexes)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- SECTION 3 : ENCAISSEMENTS HORS ESPÈCES -->
                    <div>
                        <div class="section-header" style="background: #b45309;">
                            <span>Section 3 : Hors Espèces (Démat.)</span>
                            <span class="subtotal" style="color: #fde68a;">${formatPrice(totalHorsEspeces)}</span>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Mode d'encaissement</th>
                                    <th class="text-right">Montant</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>CMI (TPE Bancaire)</td>
                                    <td class="text-right font-mono font-medium">${formatPrice(horsEspeces.tpe)}</td>
                                </tr>
                                <tr>
                                    <td>Petrom Card</td>
                                    <td class="text-right font-mono font-medium">${formatPrice(horsEspeces.petrom_card)}</td>
                                </tr>
                                <tr>
                                    <td>Bons Crédit Client (Sociétés)</td>
                                    <td class="text-right font-mono font-medium">${formatPrice(horsEspeces.bon_ste)}</td>
                                </tr>
                                <tr>
                                    <td>Bons à Crédit SNTL</td>
                                    <td class="text-right font-mono font-medium">${formatPrice(horsEspeces.bon_sntl)}</td>
                                </tr>
                                <tr style="background: #f1f5f9; font-weight: bold;">
                                    <td>TOTAL DÉMATÉRIALISÉ</td>
                                    <td class="text-right font-mono">${formatPrice(totalHorsEspeces)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- SECTION 4 : RAPPROCHEMENT & CONTRÔLE FINAL -->
                <div class="reconciliation-card">
                    <div class="recon-header">
                        <div>
                            <span class="recon-title">Arrêté et Rapprochement de Caisse Espèces</span>
                            <div style="font-size: 9px; color: #475569; margin-top: 1px;">
                                Résultat : <b>${statusBadgeText}</b>
                            </div>
                        </div>
                        <div class="recon-diff">
                            Écart : ${ecart >= 0 ? '+' : ''}${formatPrice(ecart)}
                        </div>
                    </div>
                    <div class="recon-formula">
                        <span>Recettes Brutes : <b>${formatPrice(totalRecettes)}</b></span>
                        <span>- Hors Espèces : <b>${formatPrice(totalHorsEspeces)}</b></span>
                        <span>= Solde Théorique : <b>${formatPrice(soldeTheorique)}</b></span>
                        <span>| Comptage Réel : <b>${formatPrice(comptageReel)}</b></span>
                    </div>
                </div>

                <!-- OBSERVATIONS -->
                <div class="notes-box">
                    <div class="notes-title">Observations / Justifications de Caisse :</div>
                    <div class="notes-content">${notes ? notes.replace(/\n/g, '<br>') : 'Aucune remarque ou justification particulière signalée.'}</div>
                </div>

                <!-- SIGNATURES -->
                <div class="signatures-grid">
                    <div class="sig-box">
                        <div class="sig-label">Le Caissier / Chef de Piste</div>
                        <div class="sig-line"></div>
                    </div>
                    <div class="sig-box">
                        <div class="sig-label">Le Responsable de Station</div>
                        <div class="sig-line"></div>
                    </div>
                    <div class="sig-box">
                        <div class="sig-label">La Direction / Gérant</div>
                        <div class="sig-line"></div>
                    </div>
                </div>

                <!-- FOOTER META -->
                <div class="footer-meta">
                    <span>Document de contrôle interne — Station-Service Petrom</span>
                    <span>Date & Heure d'impression : ${printDate}</span>
                    <span>Fiche : ${date}</span>
                </div>
            </div>

            <script>
                // Auto trigger print after small delay for assets load
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
