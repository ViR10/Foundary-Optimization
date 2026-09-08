import os
import json
import pandas as pd
import numpy as np

ELEMENTS_ORDER = [
    "Cu", "Sn", "Zn", "Pb", "Fe", "Ni", "P", "Mn", "Si", "Al",
    "S", "Cr", "C", "Mg", "Ti", "Mo", "V", "Nb", "Sb", "Ca"
]

def categorize_material_name(name):
    n = name.upper()
    if any(k in n for k in ["FERRO", "CALCIUM SILICON"]):
        return "Ferro Alloys"
    if any(k in n for k in ["BRONZE", "COPPER", "KANSI", "BRASS"]):
        return "Copper & Bronze"
    if any(k in n for k in ["S.S", "SS", "201", "304", "316", "420", "430", "26/12", "26/20", "26/4", "NICKEL VALVE", "NICKEL COPPER"]):
        return "Stainless & High Alloy"
    if any(k in n for k in ["C.I", "CI ", "SG IRON", "PIG IRON"]):
        return "Cast Iron & Pig Iron"
    if any(k in n for k in ["M.S", "MS", "DIE STEEL", "GRINDING", "MANGANESE", "HIGH CHROME"]):
        return "Carbon & Special Steel"
    if any(k in n for k in ["NICKEL SCRAP", "ALUMINIUM", "ANTIMONY", "CARBON POWDER", "LEAD", "TIN", "ZINC"]):
        return "Virgin Metals & Additives"
    return "Miscellaneous"


class DataManager:
    def __init__(self, json_path="persistent_raw_materials.json", excel_path="Scrap Master Sheet_023516.xlsx"):
        self.json_path = json_path
        self.excel_path = excel_path
        self.elements = ELEMENTS_ORDER.copy()
        self.df_clean = None
        self.load_data()

    def parse_element_value(self, val):
        if pd.isna(val):
            return 0.0, 'zero'
        s = str(val).strip().replace('%', '').replace(' ', '')
        if s.lower() in ['tracer', 'trace']:
            return 0.0, 'tracer'
        if s.lower() == 'balance':
            return 0.0, 'balance'
        if '≤' in s or '<' in s:
            num = float(s.replace('≤', '').replace('<', ''))
            return round(num / 2.0, 4), 'val'
        if '99-9=100' in s:
            return 99.5, 'val'
        if '-' in s:
            parts = s.split('-')
            try:
                return round((float(parts[0]) + float(parts[1])) / 2.0, 4), 'val'
            except:
                pass
        try:
            return round(float(s), 4), 'val'
        except:
            return 0.0, 'unknown'

    def load_data(self):
        if os.path.exists(self.json_path):
            try:
                self._load_from_json(self.json_path)
                return self.df_clean
            except Exception as e:
                print(f"Warning: Failed to load from JSON ({e}). Falling back to Excel.")

        if os.path.exists(self.excel_path):
            self._load_from_excel(self.excel_path)
            self.save_to_json(self.json_path)
            return self.df_clean

        raise FileNotFoundError(f"Neither '{self.json_path}' nor '{self.excel_path}' found!")

    def _load_from_json(self, filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        self.elements = data.get("elements", ELEMENTS_ORDER.copy())
        records = data.get("materials", [])
        
        # Ensure schema completeness and data corrections
        for m in records:
            # Compatibility aliases
            if "Material_Name" in m and "Name" not in m:
                m["Name"] = m["Material_Name"]
            elif "Name" in m and "Material_Name" not in m:
                m["Material_Name"] = m["Name"]

            if "Cost_Per_Kg" in m and "Cost" not in m:
                m["Cost"] = m["Cost_Per_Kg"]
            elif "Cost" in m and "Cost_Per_Kg" not in m:
                m["Cost_Per_Kg"] = m["Cost"]

            if "Category" not in m or not m["Category"]:
                m["Category"] = categorize_material_name(m["Name"])

            if "Max_Stock_Kg" not in m:
                m["Max_Stock_Kg"] = None

            # Fix critical data bugs if still present
            if m.get("ID") == 19 or ("201" in str(m.get("Name", "")) and m.get("Fe", 0.0) < 5.0):
                sum_other = sum(m.get(el, 0.0) for el in self.elements if el != "Fe")
                m["Fe"] = round(max(0.0, 100.0 - sum_other), 3)

            if m.get("ID") == 37 or ("FERRO CHROME" in str(m.get("Name", "")).upper() and "LOW CARBON" in str(m.get("Name", "")).upper()):
                if m.get("Cr", 0.0) < 50.0:
                    m["Cr"] = 65.0
                    sum_other = sum(m.get(el, 0.0) for el in self.elements if el != "Fe")
                    m["Fe"] = round(max(0.0, 100.0 - sum_other), 3)

            # Auto-normalize if total exceeds 100.5%
            total = sum(m.get(el, 0.0) for el in self.elements)
            if total > 100.5:
                factor = 100.0 / total
                for el in self.elements:
                    if m.get(el, 0.0) > 0:
                        m[el] = round(m[el] * factor, 3)

        self.df_clean = pd.DataFrame(records)

    def _load_from_excel(self, filepath):
        df_raw = pd.read_excel(filepath, sheet_name=0)
        self.elements = [str(e).strip() for e in df_raw.iloc[0, 3:].values]

        clean_rows = []
        raw_items = df_raw.iloc[1:].copy()

        for idx, row in raw_items.iterrows():
            if pd.isna(row.iloc[1]):
                continue
            mat_id = int(row.iloc[0]) if pd.notna(row.iloc[0]) else len(clean_rows) + 1
            mat_name = str(row.iloc[1]).strip()
            cost = float(row.iloc[2]) if pd.notna(row.iloc[2]) else 0.0

            bal_element = None
            sum_known = 0.0
            elem_dict = {}

            for i, el in enumerate(self.elements):
                v = row.iloc[3 + i]
                parsed_val, kind = self.parse_element_value(v)
                if kind == 'balance':
                    bal_element = el
                else:
                    elem_dict[el] = parsed_val
                    sum_known += parsed_val

            # Fix typo for Ferro Chrome LC
            if "FERRO CHROME" in mat_name.upper() and "LOW CARBON" in mat_name.upper():
                elem_dict["Cr"] = 65.0
                bal_element = "Fe"

            # Implicit balance detection for ferrous scraps missing balance
            if not bal_element:
                if mat_id == 19 or "201" in mat_name:
                    bal_element = "Fe"
                elif any(k in mat_name.upper() for k in ["C.I", "S.S", "M.S", "STEEL", "IRON"]) and elem_dict.get("Fe", 0.0) < 1.0:
                    bal_element = "Fe"

            if bal_element:
                elem_dict[bal_element] = round(max(0.0, 100.0 - sum_known), 3)

            entry = {
                'ID': mat_id,
                'Name': mat_name,
                'Material_Name': mat_name,
                'Cost': cost,
                'Cost_Per_Kg': cost,
                'Category': categorize_material_name(mat_name),
                'Max_Stock_Kg': None
            }
            for el in self.elements:
                entry[el] = round(elem_dict.get(el, 0.0), 3)

            # Auto-normalize if total > 100.5%
            total = sum(entry.get(el, 0.0) for el in self.elements)
            if total > 100.5:
                factor = 100.0 / total
                for el in self.elements:
                    if entry.get(el, 0.0) > 0:
                        entry[el] = round(entry[el] * factor, 3)

            clean_rows.append(entry)

        self.df_clean = pd.DataFrame(clean_rows)

    def save_to_json(self, filepath=None):
        if filepath is None:
            filepath = self.json_path
        
        records = self.df_clean.to_dict('records')
        data = {
            "elements": self.elements,
            "materials": records
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return filepath

    def update_price(self, mat_id, new_price):
        mask = self.df_clean['ID'] == int(mat_id)
        if mask.any():
            new_val = float(new_price)
            self.df_clean.loc[mask, 'Cost'] = new_val
            self.df_clean.loc[mask, 'Cost_Per_Kg'] = new_val
            self.save_to_json()
            return True
        return False

    def update_stock(self, mat_id, max_stock_kg):
        mask = self.df_clean['ID'] == int(mat_id)
        if mask.any():
            val = float(max_stock_kg) if max_stock_kg is not None and str(max_stock_kg).strip() != "" else None
            self.df_clean.loc[mask, 'Max_Stock_Kg'] = val
            self.save_to_json()
            return True
        return False

    def add_material(self, name, cost, comp_dict, category=None, max_stock=None):
        max_id = int(self.df_clean['ID'].max()) if len(self.df_clean) > 0 else 0
        new_id = max_id + 1
        name = name.strip()
        cat = category if category else categorize_material_name(name)
        
        entry = {
            'ID': new_id,
            'Name': name,
            'Material_Name': name,
            'Cost': float(cost),
            'Cost_Per_Kg': float(cost),
            'Category': cat,
            'Max_Stock_Kg': float(max_stock) if max_stock is not None and str(max_stock).strip() != "" else None
        }
        for el in self.elements:
            entry[el] = round(float(comp_dict.get(el, 0.0)), 3)
            
        self.df_clean = pd.concat([self.df_clean, pd.DataFrame([entry])], ignore_index=True)
        self.save_to_json()
        return new_id

    def delete_material(self, mat_id):
        mask = self.df_clean['ID'] == int(mat_id)
        if mask.any():
            self.df_clean = self.df_clean[~mask].reset_index(drop=True)
            self.save_to_json()
            return True
        return False

    def get_categories(self):
        return sorted(self.df_clean['Category'].dropna().unique().tolist())

    def export_to_excel(self, output_path="Updated_Scrap_Master.xlsx"):
        export_df = self.df_clean.copy()
        export_df.to_excel(output_path, index=False)
        return output_path