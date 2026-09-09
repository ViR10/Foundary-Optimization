/**
 * AlloyForge AI - Furnace Heat History & Batch Card Generator
 * Manages logged heats, LocalStorage persistence, and 1-click printable shop-floor cards.
 */

class HistoryManager {
    constructor() {
        this.storageKey = "alloyforge_heat_history_v2";
        this.history = this.loadHistory();
    }

    loadHistory() {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error("Failed to parse heat history", e);
            }
        }
        return [];
    }

    saveHistory() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.history));
    }

    saveHeat(alloyName, batchSize, optName, optData, notes = "") {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const heatId = `HT-${dateStr}-${String(this.history.length + 1).padStart(3, '0')}`;

        const entry = {
            heat_id: heatId,
            timestamp: now.toLocaleString(),
            alloy_name: alloyName,
            batch_size_kg: parseFloat(batchSize),
            selected_option: optName,
            total_cost_pkr: parseFloat(optData.total_cost || 0),
            cost_per_kg: parseFloat(optData.cost_per_kg || 0),
            recipe: optData.recipe || [],
            chemistry: optData.chemistry || {},
            chemistry_table: optData.chemistry_table || [],
            tramp_index: optData.tramp_index || 0,
            notes: notes.trim()
        };

        this.history.unshift(entry);
        this.saveHistory();
        return heatId;
    }

    deleteHeat(heatId) {
        const initLen = this.history.length;
        this.history = this.history.filter(h => h.heat_id !== heatId);
        if (this.history.length < initLen) {
            this.saveHistory();
            return true;
        }
        return false;
    }

    getHeat(heatId) {
        return this.history.find(h => h.heat_id === heatId) || null;
    }

    exportToCSV() {
        if (this.history.length === 0) return;
        const headers = ["Heat_ID", "Date_Time", "Alloy_Grade", "Batch_Kg", "Option", "Cost_Kg_PKR", "Total_Cost_PKR", "Tramp_Index_Pct", "Notes"];
        const rows = this.history.map(h => [
            h.heat_id,
            `"${h.timestamp}"`,
            `"${h.alloy_name}"`,
            h.batch_size_kg,
            `"${h.selected_option}"`,
            h.cost_per_kg,
            h.total_cost_pkr,
            h.tramp_index,
            `"${(h.notes || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Furnace_Heat_Ledger_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    generateBatchCardHTML(heat) {
        if (!heat) return "<p style='color:red;'>Heat record not found.</p>";

        const recipeRows = (heat.recipe || []).map((item, idx) => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 7px 4px; text-align: center;">[ &nbsp; ]</td>
                <td style="padding: 7px 4px; text-align: center;">${idx + 1}</td>
                <td style="padding: 7px 6px; font-weight: 600; font-size: 13px;">${item.Material_Name}</td>
                <td style="padding: 7px 4px; text-align: center;"><span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${item.Category || 'Scrap'}</span></td>
                <td style="padding: 7px 6px; text-align: right; font-size: 14px; font-weight: 700; color: #0f172a;">${item.Weight_Kg.toLocaleString()} kg</td>
                <td style="padding: 7px 4px; text-align: right; font-size: 12px;">${item.Weight_Pct.toFixed(1)}%</td>
                <td style="padding: 7px 4px; border-bottom: 1px dashed #cbd5e1;">&nbsp;</td>
            </tr>
        `).join('');

        const chemBadges = Object.entries(heat.chemistry || {}).map(([el, pct]) => `
            <div style="display: inline-block; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 8px; margin: 3px; font-size: 12px;">
                <b>${el}:</b> ${parseFloat(pct).toFixed(3)}%
            </div>
        `).join('');

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Charge Card - ${heat.heat_id}</title>
            <style>
                * { box-sizing: border-box; }
                body { margin: 0; padding: 12px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; background: white; }
                .card-container {
                    border: 2px solid #0f172a;
                    border-radius: 8px;
                    padding: 20px;
                    max-width: 820px;
                    margin: auto;
                }
                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #0f172a;
                    padding-bottom: 10px;
                    margin-bottom: 14px;
                }
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                    background: #f8fafc;
                    padding: 12px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                    margin-bottom: 16px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12.5px;
                    margin-bottom: 16px;
                }
                th {
                    background: #0f172a;
                    color: white;
                    padding: 8px;
                    font-size: 11px;
                    text-transform: uppercase;
                    text-align: left;
                }
                .sign-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 16px;
                    border-top: 1px solid #cbd5e1;
                    padding-top: 14px;
                    margin-top: 20px;
                    font-size: 11px;
                    color: #475569;
                }
                .sign-line {
                    border-bottom: 1px solid #94a3b8;
                    height: 30px;
                    margin-top: 4px;
                }
                @media print {
                    body { padding: 0; }
                    .card-container { border: 1px solid #000; }
                }
            </style>
        </head>
        <body>
            <div class="card-container">
                <div class="card-header">
                    <div>
                        <h2 style="margin: 0; color: #0f172a; font-size: 20px; text-transform: uppercase; letter-spacing: 0.5px;">⚡ FURNACE CHARGE CARD (HEAT SHEET)</h2>
                        <div style="font-size: 11.5px; color: #64748b; margin-top: 3px;">AlloyForge AI Metallurgical Charge Optimization System</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 18px; font-weight: 800; color: #1e40af;">${heat.heat_id}</div>
                        <div style="font-size: 11px; color: #64748b;">${heat.timestamp}</div>
                    </div>
                </div>

                <div class="summary-grid">
                    <div>
                        <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Target Alloy</div>
                        <div style="font-size: 15px; font-weight: 700;">${heat.alloy_name}</div>
                    </div>
                    <div>
                        <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Batch Total Weight</div>
                        <div style="font-size: 15px; font-weight: 700; color: #059669;">${heat.batch_size_kg.toLocaleString()} Kg</div>
                    </div>
                    <div>
                        <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Charge Mix Option</div>
                        <div style="font-size: 14px; font-weight: 700;">${heat.selected_option}</div>
                    </div>
                    <div>
                        <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Total Melt Cost</div>
                        <div style="font-size: 14px; font-weight: 700;">PKR ${heat.total_cost_pkr.toLocaleString()} <span style="font-size: 11px; font-weight: normal;">(${heat.cost_per_kg.toFixed(1)}/Kg)</span></div>
                    </div>
                </div>

                <div style="font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 6px;">Furnace Charge Sequence & Scale Weights:</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px; text-align: center;">Loaded</th>
                            <th style="width: 25px; text-align: center;">#</th>
                            <th>Raw Material / Scrap</th>
                            <th style="text-align: center;">Category</th>
                            <th style="text-align: right;">Target Weight</th>
                            <th style="text-align: right;">% Total</th>
                            <th style="width: 120px; text-align: center;">Actual Weighed</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recipeRows}
                    </tbody>
                </table>

                <div style="font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 6px;">Expected Tap Chemistry (Spectrometer Target):</div>
                <div style="margin-bottom: 16px;">
                    ${chemBadges}
                </div>

                <div class="sign-grid">
                    <div>
                        <div>Furnace Operator Signature:</div>
                        <div class="sign-line"></div>
                    </div>
                    <div>
                        <div>Metallurgist / Chemist Sign:</div>
                        <div class="sign-line"></div>
                    </div>
                    <div>
                        <div>Foundry In-Charge Sign:</div>
                        <div class="sign-line"></div>
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;
    }
}

window.HistoryManager = HistoryManager;
