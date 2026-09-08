import json
import os
import pandas as pd
from datetime import datetime

class HistoryManager:
    def __init__(self, filepath="heat_history.json"):
        self.filepath = filepath
        self.history = self.load_history()

    def load_history(self):
        if os.path.exists(self.filepath):
            try:
                with open(self.filepath, 'r', encoding='utf-8') as f:
                    raw = json.load(f)
                # Normalize legacy keys
                normalized = []
                for entry in raw:
                    norm = {
                        "heat_id": entry.get("heat_id", "HT-UNKNOWN"),
                        "timestamp": entry.get("timestamp", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
                        "alloy_name": entry.get("alloy_name", entry.get("alloy", "Standard Alloy")),
                        "batch_size_kg": float(entry.get("batch_size_kg", entry.get("batch_kg", 1000.0))),
                        "selected_option": entry.get("selected_option", entry.get("option", "Option 1")),
                        "total_cost_pkr": float(entry.get("total_cost_pkr", entry.get("total_cost", 0.0))),
                        "cost_per_kg": float(entry.get("cost_per_kg", entry.get("cost_kg", 0.0))),
                        "recipe": entry.get("recipe", []),
                        "chemistry": entry.get("chemistry", {}),
                        "chemistry_table": entry.get("chemistry_table", []),
                        "notes": entry.get("notes", "")
                    }
                    normalized.append(norm)
                return normalized
            except Exception as e:
                print(f"Error loading history: {e}")
                return []
        return []

    def save_heat(self, alloy_name, batch_size, opt_name, opt_data, notes=""):
        heat_id = f"HT-{datetime.now().strftime('%Y%m%d')}-{len(self.history) + 1:03d}"
        
        # Standardize recipe items to ensure Material_Name exists
        clean_recipe = []
        for r in opt_data.get('recipe', []):
            mat_name = r.get('Material_Name', r.get('Material', 'Unknown Scrap'))
            clean_recipe.append({
                "ID": r.get('ID', 0),
                "Material_Name": mat_name,
                "Category": r.get('Category', 'Scrap'),
                "Weight_Kg": r.get('Weight_Kg', r.get('Weight (Kg)', 0.0)),
                "Weight_Pct": r.get('Weight_Pct', 0.0),
                "Rate_PKR": r.get('Rate_PKR', r.get('Rate (PKR)', 0.0)),
                "Cost_PKR": r.get('Cost_PKR', r.get('Cost (PKR)', 0.0))
            })

        entry = {
            "heat_id": heat_id,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "alloy_name": alloy_name,
            "batch_size_kg": float(batch_size),
            "selected_option": opt_name,
            "total_cost_pkr": float(opt_data.get('total_cost', 0.0)),
            "cost_per_kg": float(opt_data.get('cost_per_kg', 0.0)),
            "recipe": clean_recipe,
            "chemistry": opt_data.get('chemistry', {}),
            "chemistry_table": opt_data.get('chemistry_table', []),
            "notes": notes
        }
        
        self.history.insert(0, entry)
        self._write_to_disk()
        return heat_id

    def delete_heat(self, heat_id):
        orig_len = len(self.history)
        self.history = [h for h in self.history if h['heat_id'] != heat_id]
        if len(self.history) < orig_len:
            self._write_to_disk()
            return True
        return False

    def get_heat(self, heat_id):
        for h in self.history:
            if h['heat_id'] == heat_id:
                return h
        return None

    def _write_to_disk(self):
        with open(self.filepath, 'w', encoding='utf-8') as f:
            json.dump(self.history, f, indent=2, ensure_ascii=False)

    def to_dataframe(self):
        if not self.history:
            return pd.DataFrame()
        rows = []
        for h in self.history:
            recipe_items = h.get('recipe', [])
            top_mat = f"{recipe_items[0]['Material_Name']} ({recipe_items[0]['Weight_Kg']} kg)" if recipe_items else "-"
            mat_count = len(recipe_items)
            
            rows.append({
                "Heat ID": h['heat_id'],
                "Date & Time": h['timestamp'],
                "Alloy Grade": h['alloy_name'],
                "Batch (Kg)": f"{h['batch_size_kg']:,.0f}",
                "Option": h['selected_option'].split(':')[0],
                "Cost/Kg (PKR)": f"PKR {h['cost_per_kg']:,.2f}",
                "Total Cost (PKR)": f"PKR {h['total_cost_pkr']:,.0f}",
                "Materials": f"{mat_count} items (Primary: {top_mat})",
                "Notes": h.get('notes', '')
            })
        return pd.DataFrame(rows)

    def generate_batch_card_html(self, heat_id):
        heat = self.get_heat(heat_id)
        if not heat:
            return "<p style='font-family: sans-serif; color: #ef4444; padding: 12px;'>Heat record not found.</p>"
        return self._build_card_html(heat)

    def generate_batch_card_html_from_data(self, heat):
        """Generate batch card HTML from a heat data dict directly (for live preview without saving)."""
        return self._build_card_html(heat)

    def _build_card_html(self, heat):
        recipe_rows = ""
        for idx, item in enumerate(heat.get('recipe', []), 1):
            recipe_rows += f"""
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 7px 4px; text-align: center;">[ &nbsp; ]</td>
                <td style="padding: 7px 4px; text-align: center;">{idx}</td>
                <td style="padding: 7px 6px; font-weight: 600; font-size: 12.5px;">{item['Material_Name']}</td>
                <td style="padding: 7px 4px; text-align: center;"><span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 10.5px;">{item.get('Category', 'Scrap')}</span></td>
                <td style="padding: 7px 6px; text-align: right; font-size: 13.5px; font-weight: 700; color: #0f172a;">{item['Weight_Kg']:,.2f} kg</td>
                <td style="padding: 7px 4px; text-align: right; font-size: 12px;">{item.get('Weight_Pct', 0.0):.1f}%</td>
                <td style="padding: 7px 4px; border-bottom: 1px dashed #cbd5e1;">&nbsp;</td>
            </tr>
            """

        chem_badges = ""
        for el, pct in heat.get('chemistry', {}).items():
            chem_badges += f"""
            <div class="chem-badge">
                <b>{el}:</b> {pct:.3f}%
            </div>
            """

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * {{ box-sizing: border-box; }}
                body {{ margin: 0; padding: 6px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: transparent; }}
                .card-container {{
                    background: white;
                    color: #1e293b;
                    padding: 20px;
                    border-radius: 10px;
                    border: 1.5px solid #334155;
                    max-width: 800px;
                    margin: auto;
                    box-shadow: 0 4px 14px rgba(0,0,0,0.06);
                }}
                .card-header {{
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #0f172a;
                    padding-bottom: 10px;
                    margin-bottom: 14px;
                    gap: 8px;
                }}
                .header-title h2 {{
                    margin: 0;
                    color: #0f172a;
                    font-size: 18px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }}
                .header-title div {{
                    font-size: 11px;
                    color: #64748b;
                    margin-top: 2px;
                }}
                .header-heat-id {{
                    text-align: right;
                }}
                .heat-id-text {{
                    font-size: 17px;
                    font-weight: 800;
                    color: #1e40af;
                }}
                .heat-timestamp {{
                    font-size: 11px;
                    color: #64748b;
                }}
                .summary-grid {{
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                    background: #f8fafc;
                    padding: 10px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                    margin-bottom: 16px;
                }}
                .summary-item-label {{
                    font-size: 10px;
                    color: #64748b;
                    text-transform: uppercase;
                }}
                .summary-item-val {{
                    font-size: 13.5px;
                    font-weight: 700;
                }}
                .table-wrapper {{
                    width: 100%;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    margin-bottom: 16px;
                }}
                table {{
                    width: 100%;
                    min-width: 540px;
                    border-collapse: collapse;
                    font-size: 12px;
                }}
                th {{
                    background: #0f172a;
                    color: white;
                    padding: 7px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                }}
                .chem-badge {{
                    display: inline-block;
                    background: #f1f5f9;
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    padding: 3px 7px;
                    margin: 2px;
                    font-size: 11.5px;
                }}
                .sign-grid {{
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 14px;
                    border-top: 1px solid #cbd5e1;
                    padding-top: 14px;
                    margin-top: 20px;
                    font-size: 11px;
                    color: #475569;
                }}
                .sign-line {{
                    border-bottom: 1px solid #94a3b8;
                    height: 28px;
                    margin-top: 4px;
                }}

                /* Mobile Viewport Adaptations */
                @media (max-width: 600px) {{
                    .card-container {{
                        padding: 12px;
                    }}
                    .card-header {{
                        flex-direction: column;
                        align-items: flex-start;
                    }}
                    .header-heat-id {{
                        text-align: left;
                    }}
                    .summary-grid {{
                        grid-template-columns: 1fr 1fr;
                        gap: 8px;
                    }}
                    .sign-grid {{
                        grid-template-columns: 1fr;
                        gap: 10px;
                    }}
                    .sign-line {{
                        height: 24px;
                    }}
                }}
            </style>
        </head>
        <body>
            <div class="card-container">
                <div class="card-header">
                    <div class="header-title">
                        <h2>⚡ FURNACE CHARGE CARD (HEAT SHEET)</h2>
                        <div>AlloyForge AI Intelligent Foundry Optimization System</div>
                    </div>
                    <div class="header-heat-id">
                        <div class="heat-id-text">{heat['heat_id']}</div>
                        <div class="heat-timestamp">{heat['timestamp']}</div>
                    </div>
                </div>

                <div class="summary-grid">
                    <div>
                        <div class="summary-item-label">Target Alloy</div>
                        <div class="summary-item-val">{heat['alloy_name']}</div>
                    </div>
                    <div>
                        <div class="summary-item-label">Batch Total Weight</div>
                        <div class="summary-item-val" style="color: #059669;">{heat['batch_size_kg']:,.0f} Kg</div>
                    </div>
                    <div>
                        <div class="summary-item-label">Charge Mix Option</div>
                        <div class="summary-item-val">{heat['selected_option']}</div>
                    </div>
                    <div>
                        <div class="summary-item-label">Total Melt Cost</div>
                        <div class="summary-item-val">PKR {heat['total_cost_pkr']:,.0f} <span style="font-size:11px; font-weight:normal;">({heat['cost_per_kg']:.1f}/Kg)</span></div>
                    </div>
                </div>

                <div style="font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 6px;">Furnace Charge Sequence & Scale Weights:</div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 35px; text-align: center;">Loaded</th>
                                <th style="width: 25px; text-align: center;">#</th>
                                <th style="text-align: left;">Raw Material / Scrap</th>
                                <th style="text-align: center;">Category</th>
                                <th style="text-align: right;">Target Weight</th>
                                <th style="text-align: right;">% Total</th>
                                <th style="width: 100px; text-align: center;">Actual Weighed</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recipe_rows}
                        </tbody>
                    </table>
                </div>

                <div style="font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 6px;">Expected Tap Chemistry (Spectrometer Target):</div>
                <div style="margin-bottom: 14px;">
                    {chem_badges}
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
        """
        return html