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
            return "<p>Heat record not found.</p>"

        recipe_rows = ""
        for idx, item in enumerate(heat.get('recipe', []), 1):
            recipe_rows += f"""
            <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 8px; text-align: center;">[ &nbsp; ]</td>
                <td style="padding: 8px; text-align: center;">{idx}</td>
                <td style="padding: 8px; font-weight: 600;">{item['Material_Name']}</td>
                <td style="padding: 8px; text-align: center;"><span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 11px;">{item.get('Category', 'Scrap')}</span></td>
                <td style="padding: 8px; text-align: right; font-size: 15px; font-weight: 700;">{item['Weight_Kg']:,.2f} kg</td>
                <td style="padding: 8px; text-align: right;">{item.get('Weight_Pct', 0.0):.1f}%</td>
                <td style="padding: 8px; border-bottom: 1px dashed #aaa;">&nbsp;</td>
            </tr>
            """

        chem_badges = ""
        for el, pct in heat.get('chemistry', {}).items():
            chem_badges += f"""
            <div style="display: inline-block; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 8px; margin: 3px; font-size: 12px;">
                <b>{el}:</b> {pct:.3f}%
            </div>
            """

        html = f"""
        <div style="font-family: Arial, sans-serif; background: white; color: #1e293b; padding: 25px; border-radius: 8px; border: 2px solid #334155; max-width: 800px; margin: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px;">
                <div>
                    <h2 style="margin: 0; color: #0f172a; font-size: 22px; text-transform: uppercase; letter-spacing: 1px;">⚡ FURNACE CHARGE CARD (HEAT SHEET)</h2>
                    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">AlloyForge AI Intelligent Foundry Optimization System</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 18px; font-weight: 800; color: #1e40af;">{heat['heat_id']}</div>
                    <div style="font-size: 12px; color: #64748b;">{heat['timestamp']}</div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 18px;">
                <div><span style="font-size: 11px; color: #64748b; text-transform: uppercase;">Target Alloy:</span><br><b style="font-size: 15px;">{heat['alloy_name']}</b></div>
                <div><span style="font-size: 11px; color: #64748b; text-transform: uppercase;">Batch Total Weight:</span><br><b style="font-size: 15px; color: #059669;">{heat['batch_size_kg']:,.0f} Kg</b></div>
                <div><span style="font-size: 11px; color: #64748b; text-transform: uppercase;">Charge Mix Option:</span><br><b>{heat['selected_option']}</b></div>
                <div><span style="font-size: 11px; color: #64748b; text-transform: uppercase;">Total Melt Cost:</span><br><b>PKR {heat['total_cost_pkr']:,.0f}</b> ({heat['cost_per_kg']:.1f}/Kg)</div>
            </div>

            <h4 style="margin: 15px 0 8px 0; color: #0f172a; font-size: 14px; text-transform: uppercase;">Furnace Charge Sequence & Scale Weights:</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background: #0f172a; color: white;">
                        <th style="padding: 8px; width: 40px; text-align: center;">Loaded</th>
                        <th style="padding: 8px; width: 30px; text-align: center;">#</th>
                        <th style="padding: 8px; text-align: left;">Raw Material / Scrap</th>
                        <th style="padding: 8px; text-align: center;">Category</th>
                        <th style="padding: 8px; text-align: right;">Target Weight</th>
                        <th style="padding: 8px; text-align: right;">% Total</th>
                        <th style="padding: 8px; width: 120px; text-align: center;">Actual Weighed (Kg)</th>
                    </tr>
                </thead>
                <tbody>
                    {recipe_rows}
                </tbody>
            </table>

            <h4 style="margin: 20px 0 8px 0; color: #0f172a; font-size: 14px; text-transform: uppercase;">Expected Tap Chemistry (Spectrometer Target):</h4>
            <div style="margin-bottom: 25px;">
                {chem_badges}
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; border-top: 1px solid #cbd5e1; padding-top: 18px; margin-top: 25px; font-size: 12px; color: #475569;">
                <div>
                    <div>Furnace Operator Signature:</div>
                    <div style="border-bottom: 1px solid #94a3b8; height: 35px; margin-top: 5px;"></div>
                </div>
                <div>
                    <div>Metallurgist / Chemist Sign:</div>
                    <div style="border-bottom: 1px solid #94a3b8; height: 35px; margin-top: 5px;"></div>
                </div>
                <div>
                    <div>Foundry In-Charge Sign:</div>
                    <div style="border-bottom: 1px solid #94a3b8; height: 35px; margin-top: 5px;"></div>
                </div>
            </div>
        </div>
        """
        return html

    def generate_batch_card_html_from_data(self, heat):
        """Generate batch card HTML from a heat data dict directly (for live preview without saving)."""
        recipe_rows = ""
        for idx, item in enumerate(heat.get('recipe', []), 1):
            recipe_rows += f"""
            <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 8px; text-align: center;">[ &nbsp; ]</td>
                <td style="padding: 8px; text-align: center;">{idx}</td>
                <td style="padding: 8px; font-weight: 600;">{item['Material_Name']}</td>
                <td style="padding: 8px; text-align: center;"><span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 11px;">{item.get('Category', 'Scrap')}</span></td>
                <td style="padding: 8px; text-align: right; font-size: 15px; font-weight: 700;">{item['Weight_Kg']:,.2f} kg</td>
                <td style="padding: 8px; text-align: right;">{item.get('Weight_Pct', 0.0):.1f}%</td>
                <td style="padding: 8px; border-bottom: 1px dashed #aaa;">&nbsp;</td>
            </tr>
            """

        chem_badges = ""
        for el, pct in heat.get('chemistry', {}).items():
            chem_badges += f"""
            <div style="display: inline-block; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 8px; margin: 3px; font-size: 12px;">
                <b>{el}:</b> {pct:.3f}%
            </div>
            """

        html = f"""
        <div style="font-family: Arial, sans-serif; background: white; color: #1e293b; padding: 25px; border-radius: 8px; border: 2px solid #334155; max-width: 800px; margin: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px;">
                <div>
                    <h2 style="margin: 0; color: #0f172a; font-size: 22px; text-transform: uppercase; letter-spacing: 1px;">⚡ FURNACE CHARGE CARD (HEAT SHEET)</h2>
                    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">AlloyForge AI Intelligent Foundry Optimization System</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 18px; font-weight: 800; color: #1e40af;">{heat['heat_id']}</div>
                    <div style="font-size: 12px; color: #64748b;">{heat['timestamp']}</div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 18px;">
                <div><span style="font-size: 11px; color: #64748b; text-transform: uppercase;">Target Alloy:</span><br><b style="font-size: 15px;">{heat['alloy_name']}</b></div>
                <div><span style="font-size: 11px; color: #64748b; text-transform: uppercase;">Batch Total Weight:</span><br><b style="font-size: 15px; color: #059669;">{heat['batch_size_kg']:,.0f} Kg</b></div>
                <div><span style="font-size: 11px; color: #64748b; text-transform: uppercase;">Charge Mix Option:</span><br><b>{heat['selected_option']}</b></div>
                <div><span style="font-size: 11px; color: #64748b; text-transform: uppercase;">Total Melt Cost:</span><br><b>PKR {heat['total_cost_pkr']:,.0f}</b> ({heat['cost_per_kg']:.1f}/Kg)</div>
            </div>

            <h4 style="margin: 15px 0 8px 0; color: #0f172a; font-size: 14px; text-transform: uppercase;">Furnace Charge Sequence & Scale Weights:</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background: #0f172a; color: white;">
                        <th style="padding: 8px; width: 40px; text-align: center;">Loaded</th>
                        <th style="padding: 8px; width: 30px; text-align: center;">#</th>
                        <th style="padding: 8px; text-align: left;">Raw Material / Scrap</th>
                        <th style="padding: 8px; text-align: center;">Category</th>
                        <th style="padding: 8px; text-align: right;">Target Weight</th>
                        <th style="padding: 8px; text-align: right;">% Total</th>
                        <th style="padding: 8px; width: 120px; text-align: center;">Actual Weighed (Kg)</th>
                    </tr>
                </thead>
                <tbody>
                    {recipe_rows}
                </tbody>
            </table>

            <h4 style="margin: 20px 0 8px 0; color: #0f172a; font-size: 14px; text-transform: uppercase;">Expected Tap Chemistry (Spectrometer Target):</h4>
            <div style="margin-bottom: 25px;">
                {chem_badges}
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; border-top: 1px solid #cbd5e1; padding-top: 18px; margin-top: 25px; font-size: 12px; color: #475569;">
                <div>
                    <div>Furnace Operator Signature:</div>
                    <div style="border-bottom: 1px solid #94a3b8; height: 35px; margin-top: 5px;"></div>
                </div>
                <div>
                    <div>Metallurgist / Chemist Sign:</div>
                    <div style="border-bottom: 1px solid #94a3b8; height: 35px; margin-top: 5px;"></div>
                </div>
                <div>
                    <div>Foundry In-Charge Sign:</div>
                    <div style="border-bottom: 1px solid #94a3b8; height: 35px; margin-top: 5px;"></div>
                </div>
            </div>
        </div>
        """
        return html