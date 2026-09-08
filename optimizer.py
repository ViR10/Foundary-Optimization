import numpy as np
import pandas as pd
from scipy.optimize import linprog

# Industry-standard furnace element recovery efficiencies in induction furnaces
DEFAULT_RECOVERY_FACTORS = {
    'C': 0.92,   # ~8% burn-off oxidation
    'Si': 0.88,  # ~12% oxidation to slag
    'Mn': 0.88,  # ~12% oxidation to slag
    'Cr': 0.95,  # ~5% loss
    'Ni': 0.99,  # noble in melt, minimal loss
    'Mo': 0.98,  # stable in melt
    'Cu': 0.98,  # stable in melt
    'Fe': 0.97,  # normal melting/slag loss
    'Al': 0.75,  # strong oxidation / deoxidation consumption
    'Ti': 0.70,  # high affinity for oxygen/nitrogen
    'Mg': 0.40,  # high vapor pressure / reaction loss in ductile iron
    'P': 1.00,   # does not oxidize out in acid/neutral lining
    'S': 1.00,   # stable without active desulfurization
    'Pb': 0.95,  # minimal loss under flux
    'Zn': 0.90,  # ~10% fuming loss under standard bronze flux cover
    'Sn': 0.95,
    'V': 0.90,
    'Nb': 0.92,
    'Ca': 0.40,
    'Sb': 0.90
}

# Standard tramp element maximum allowable limits for ferrous alloys (prevents molten scrap contamination)
FERROUS_TRAMP_CAPS = {
    'Pb': 0.015,  # Lead causes severe hot shortness
    'Sn': 0.030,  # Tin embrittles grain boundaries
    'Zn': 0.020,  # Zinc fumes and causes porosity
    'P': 0.045,   # Unless specified higher for gray iron
    'S': 0.035,   # Unless specified higher
    'Cu': 0.600   # Copper causes hot shortness in steels if unconstrained
}

COPPER_BASE_TRAMP_CAPS = {
    'Fe': 0.50,
    'Al': 0.50,
    'Si': 0.15,
    'P': 0.15
}


class ChargeOptimizer:
    def __init__(self, data_manager):
        self.dm = data_manager

    def solve_all_options(
        self,
        targets,
        batch_size=1000.0,
        alloy_family="stainless",
        use_recovery=True,
        recovery_factors=None,
        stock_limits=None
    ):
        df = self.dm.df_clean.copy()
        elements = self.dm.elements
        n_mats = len(df)
        
        # Support both 'Cost' and 'Cost_Per_Kg'
        cost_col = 'Cost_Per_Kg' if 'Cost_Per_Kg' in df.columns else 'Cost'
        name_col = 'Material_Name' if 'Material_Name' in df.columns else 'Name'
        c = df[cost_col].values.astype(float)

        # Batch weight constraint: sum(w_i) = batch_size
        A_eq = [np.ones(n_mats)]
        b_eq = [float(batch_size)]

        # Prepare recovery factors
        rec = {}
        for el in elements:
            if use_recovery:
                if recovery_factors and el in recovery_factors:
                    rec[el] = float(recovery_factors[el])
                else:
                    rec[el] = DEFAULT_RECOVERY_FACTORS.get(el, 0.95)
            else:
                rec[el] = 1.0

        # Build effective targets including tramp element protection
        effective_targets = dict(targets)
        if alloy_family is not None:
            tramp_caps = FERROUS_TRAMP_CAPS if alloy_family != "bronze" else COPPER_BASE_TRAMP_CAPS
            
            for tramp_el, max_val in tramp_caps.items():
                if tramp_el in elements and tramp_el not in effective_targets:
                    # Do not cap Cu if Cu is a major alloy element
                    if tramp_el == 'Cu' and alloy_family in ['bronze', 'copper']:
                        continue
                    effective_targets[tramp_el] = (0.0, max_val)

        def build_inequalities(target_specs):
            A, b = [], []
            for el, (low, high) in target_specs.items():
                if el in elements and el in df.columns:
                    # Mass fraction of element in raw scrap
                    p = (df[el].values / 100.0) * rec[el]
                    # Upper limit: sum(w_i * p * rec) <= high * batch / 100
                    A.append(p)
                    b.append(high * batch_size / 100.0)
                    # Lower limit: sum(w_i * p * rec) >= low * batch / 100 => -sum(...) <= -low * batch / 100
                    A.append(-p)
                    b.append(-low * batch_size / 100.0)
            return A, b

        # Base bounds from inventory / stock limits
        base_bounds = []
        for i in range(n_mats):
            mat_id = df.iloc[i].get('ID', i + 1)
            row_stock = df.iloc[i].get('Max_Stock_Kg', None)
            
            # Check user-supplied stock limits override
            if stock_limits and mat_id in stock_limits:
                limit_val = stock_limits[mat_id]
            elif pd.notna(row_stock) and row_stock is not None and float(row_stock) > 0:
                limit_val = float(row_stock)
            else:
                limit_val = None

            if limit_val is not None:
                base_bounds.append((0.0, min(float(limit_val), float(batch_size))))
            else:
                base_bounds.append((0.0, None))

        results = {}

        # =========================================================
        # OPTION 1: Maximum Economy (Lowest Cost Scrap Mix)
        # =========================================================
        A_ub1, b_ub1 = build_inequalities(effective_targets)
        res1 = linprog(c, A_ub=A_ub1, b_ub=b_ub1, A_eq=A_eq, b_eq=b_eq, bounds=base_bounds, method='highs')
        
        # If strict tramp caps made it infeasible, retry without secondary tramp caps but warn
        if not res1.success:
            A_ub1_raw, b_ub1_raw = build_inequalities(targets)
            res1 = linprog(c, A_ub=A_ub1_raw, b_ub=b_ub1_raw, A_eq=A_eq, b_eq=b_eq, bounds=base_bounds, method='highs')
            warn_msg = "Relaxed tramp caps" if res1.success else None
        else:
            warn_msg = None

        results['Option 1: Lowest Cost'] = self._format_result(
            res1, df, targets, effective_targets, batch_size, rec,
            title="Option 1: Lowest Cost",
            badge="🔥 Maximum Savings",
            desc="Maximum cost reduction with least-cost scrap combination",
            warning=warn_msg
        )

        # =========================================================
        # OPTION 2: Balanced Mix (Mid-Spec Foundry Standard)
        # =========================================================
        # Target safety buffer around midpoint of critical elements
        t_balanced = dict(effective_targets)
        res2 = None
        # Try progressively relaxing the midpoint safety window (20% -> 10% -> 5%)
        for buf_pct in [0.20, 0.10, 0.05]:
            for el, (low, high) in targets.items():
                if high > low and (high - low) > 0.02:
                    mid = (low + high) / 2.0
                    band = (high - low) * buf_pct
                    t_balanced[el] = (max(low, mid - band), min(high, mid + band))
            A_ub2, b_ub2 = build_inequalities(t_balanced)
            res2 = linprog(c, A_ub=A_ub2, b_ub=b_ub2, A_eq=A_eq, b_eq=b_eq, bounds=base_bounds, method='highs')
            if res2.success:
                break

        if res2 is None or not res2.success:
            res2 = res1
            opt2_desc = "Foundry Standard (Target Mid-Point with Melt Loss Margin - Converged with Opt 1)"
        else:
            opt2_desc = "Foundry Standard (Centrally Buffered within Chemical Tolerance Bands)"

        results['Option 2: Balanced Mix'] = self._format_result(
            res2, df, targets, effective_targets, batch_size, rec,
            title="Option 2: Balanced Mix",
            badge="⚖️ Foundry Standard",
            desc=opt2_desc
        )

        # =========================================================
        # OPTION 3: High Purity Mix (Clean Scrap & Master Alloys)
        # =========================================================
        bounds3 = list(base_bounds)
        dirty_keywords = ['shaving', 'misc', 'shell', 'boring', 'turnings', 'c.i shaving', 'm.s shaving', 's.s shaving']
        dirty_indices = []
        
        for i, name in enumerate(df[name_col]):
            if any(bad in str(name).lower() for bad in dirty_keywords):
                dirty_indices.append(i)
                bounds3[i] = (0.0, 0.0)

        res3 = linprog(c, A_ub=A_ub1, b_ub=b_ub1, A_eq=A_eq, b_eq=b_eq, bounds=bounds3, method='highs')
        
        used_penalty = False
        if not res3.success:
            # Penalize dirty scrap heavily instead of hard 0 to maintain mathematical feasibility
            c_penalized = c.copy()
            for idx in dirty_indices:
                c_penalized[idx] *= 4.0
            res3 = linprog(c_penalized, A_ub=A_ub1, b_ub=b_ub1, A_eq=A_eq, b_eq=b_eq, bounds=base_bounds, method='highs')
            used_penalty = True

        opt3_desc = "Premium Clean Charge (Zero Shavings & Contaminants)" if not used_penalty else "High Purity Charge (Heavily Penalized Shavings / Cleanest Feasible Mix)"

        results['Option 3: High Purity Mix'] = self._format_result(
            res3, df, targets, effective_targets, batch_size, rec,
            title="Option 3: High Purity Mix",
            badge="💎 Clean Charge",
            desc=opt3_desc,
            warning="Limited clean scrap available in inventory; minimal shavings blended." if used_penalty and res3.success else None
        )

        return results

    def _format_result(self, res, df, targets, all_targets, batch_size, rec, title, badge, desc, warning=None):
        if not res.success:
            return {
                "success": False,
                "title": title,
                "badge": badge,
                "description": desc,
                "message": "Infeasible chemical target: Please broaden element specification or verify scrap inventory."
            }

        w = res.x
        cost_col = 'Cost_Per_Kg' if 'Cost_Per_Kg' in df.columns else 'Cost'
        name_col = 'Material_Name' if 'Material_Name' in df.columns else 'Name'
        cat_col = 'Category' if 'Category' in df.columns else None

        recipe = []
        total_cost = 0.0

        for i, wt in enumerate(w):
            if wt > 0.04:  # Filter out trivial fractions < 40g
                rate = float(df.iloc[i][cost_col])
                cost = float(wt * rate)
                total_cost += cost
                mat_name = str(df.iloc[i][name_col])
                mat_cat = str(df.iloc[i][cat_col]) if cat_col else "General Scrap"
                
                recipe.append({
                    'ID': int(df.iloc[i].get('ID', i + 1)),
                    'Material_Name': mat_name,
                    'Category': mat_cat,
                    'Weight_Kg': round(float(wt), 2),
                    'Weight_Pct': round(float((wt / batch_size) * 100.0), 2),
                    'Rate_PKR': round(rate, 2),
                    'Cost_PKR': round(cost, 2)
                })

        # Calculate cost percentage
        for item in recipe:
            item['Cost_Pct'] = round((item['Cost_PKR'] / total_cost) * 100.0, 2) if total_cost > 0 else 0.0

        # Sort recipe by descending weight
        recipe.sort(key=lambda x: x['Weight_Kg'], reverse=True)

        # Chemistry calculations (actual recovered tap composition)
        chemistry_summary = {}
        chemistry_rows = []

        all_checked_elements = list(targets.keys())
        for el in all_targets.keys():
            if el not in all_checked_elements:
                all_checked_elements.append(el)

        for el in all_checked_elements:
            if el in df.columns:
                p_vec = (df[el].values / 100.0) * rec.get(el, 1.0)
                achieved_pct = float(np.sum(w * p_vec) / batch_size * 100.0)
                chemistry_summary[el] = round(achieved_pct, 3)

                min_val, max_val = all_targets.get(el, (0.0, 100.0))
                mid_val = round((min_val + max_val) / 2.0, 3)

                # Determine status
                if achieved_pct < min_val - 0.005:
                    status = "UNDER SPEC"
                elif achieved_pct > max_val + 0.005:
                    status = "OVER SPEC"
                elif abs(achieved_pct - min_val) <= 0.05:
                    status = "AT MIN LIMIT"
                elif abs(achieved_pct - max_val) <= 0.05:
                    status = "AT MAX LIMIT"
                else:
                    status = "OPTIMAL (PASS)"

                is_primary = el in targets
                chemistry_rows.append({
                    "Element": el,
                    "Min_Spec": min_val,
                    "Max_Spec": max_val,
                    "Target_Mid": mid_val,
                    "Achieved_Pct": round(achieved_pct, 3),
                    "Recovery_Pct": round(rec.get(el, 1.0) * 100.0, 1),
                    "Status": status,
                    "Is_Primary": is_primary
                })

        # Calculate Tramp Contamination Index (sum of residual Pb, Sn, Zn, P, S)
        tramp_sum = 0.0
        for t_el in ['Pb', 'Sn', 'Zn', 'P', 'S']:
            if t_el in chemistry_summary:
                tramp_sum += chemistry_summary[t_el]

        return {
            "success": True,
            "title": title,
            "badge": badge,
            "description": desc,
            "warning": warning,
            "total_cost": round(total_cost, 2),
            "cost_per_kg": round(total_cost / batch_size, 2),
            "batch_size_kg": batch_size,
            "recipe": recipe,
            "chemistry": chemistry_summary,
            "chemistry_table": chemistry_rows,
            "tramp_index": round(tramp_sum, 3)
        }