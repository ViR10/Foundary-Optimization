import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime
import json
import os

from data_manager import DataManager, ELEMENTS_ORDER
from optimizer import ChargeOptimizer, DEFAULT_RECOVERY_FACTORS, FERROUS_TRAMP_CAPS
from history_manager import HistoryManager

# ================= PAGE CONFIG & MODERN THEME =================
st.set_page_config(
    page_title="AlloyForge AI | Foundry Charge Optimizer",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom High-End Engineering CSS
st.markdown("""
<style>
    /* Metric Cards */
    .metric-card {
        background: linear-gradient(145deg, #1e293b, #0f172a);
        border: 1px solid #334155;
        border-radius: 12px;
        padding: 16px 20px;
        color: #f8fafc;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .metric-card .label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #94a3b8;
    }
    .metric-card .value {
        font-size: 26px;
        font-weight: 800;
        margin: 4px 0;
        color: #38bdf8;
    }
    .metric-card .subtext {
        font-size: 12px;
        color: #cbd5e1;
    }

    /* Option Result Cards */
    .opt-card-1 {
        background: linear-gradient(145deg, #064e3b, #022c22);
        border: 1.5px solid #10b981;
        border-radius: 14px;
        padding: 20px;
        color: white;
        box-shadow: 0 6px 20px rgba(16, 185, 129, 0.15);
    }
    .opt-card-2 {
        background: linear-gradient(145deg, #1e3a8a, #172554);
        border: 1.5px solid #3b82f6;
        border-radius: 14px;
        padding: 20px;
        color: white;
        box-shadow: 0 6px 20px rgba(59, 130, 246, 0.15);
    }
    .opt-card-3 {
        background: linear-gradient(145deg, #581c87, #3b0764);
        border: 1.5px solid #a855f7;
        border-radius: 14px;
        padding: 20px;
        color: white;
        box-shadow: 0 6px 20px rgba(168, 85, 247, 0.15);
    }
    .badge-tag {
        display: inline-block;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.8px;
        padding: 3px 10px;
        border-radius: 20px;
        background: rgba(255,255,255,0.15);
        text-transform: uppercase;
        margin-bottom: 8px;
    }
    .opt-rate {
        font-size: 28px;
        font-weight: 800;
        margin: 6px 0;
    }
    .opt-tot {
        font-size: 14px;
        opacity: 0.9;
    }
    
    /* Header Container */
    .foundry-header {
        background: linear-gradient(135deg, #09131d 0%, #132738 50%, #1e3a5f 100%);
        padding: 22px 28px;
        border-radius: 14px;
        color: white;
        margin-bottom: 20px;
        border: 1px solid #234768;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
</style>
""", unsafe_allow_html=True)

# ================= DATA MANAGERS INITIALIZATION =================
@st.cache_resource
def get_managers():
    dm = DataManager()
    opt = ChargeOptimizer(dm)
    hm = HistoryManager()
    return dm, opt, hm

dm, opt, hm = get_managers()

# Session State Initialization
if "preset_version" not in st.session_state:
    st.session_state.preset_version = 0
if "last_calculation" not in st.session_state:
    st.session_state.last_calculation = None


# ================= ALLOY PRESET LIBRARY =================
ALLOY_PRESETS = {
    # Stainless Steels
    "SS 304 (Austenitic Standard)": {
        "family": "stainless",
        "targets": {'C': (0.0, 0.08), 'Cr': (18.0, 20.0), 'Ni': (8.0, 10.5), 'Mn': (0.5, 2.0), 'Si': (0.2, 1.0), 'P': (0.0, 0.045), 'S': (0.0, 0.030)},
        "desc": "Standard 18/8 austenitic stainless steel for food, dairy, chemical & architectural casting."
    },
    "SS 316 (Marine & Acid Resistant)": {
        "family": "stainless",
        "targets": {'C': (0.0, 0.08), 'Cr': (16.0, 18.0), 'Ni': (10.0, 14.0), 'Mo': (2.0, 3.0), 'Mn': (0.5, 2.0), 'Si': (0.2, 1.0), 'P': (0.0, 0.045), 'S': (0.0, 0.030)},
        "desc": "Molybdenum-bearing stainless grade with superior pitting & crevice corrosion resistance."
    },
    "SS 309 (26/12 Heat Resistant)": {
        "family": "stainless",
        "targets": {'C': (0.03, 0.15), 'Cr': (22.0, 24.0), 'Ni': (12.0, 15.0), 'Mn': (0.5, 2.0), 'Si': (0.5, 1.5)},
        "desc": "High chromium-nickel heat resistant alloy for furnace fixtures & boilers (up to 1000°C)."
    },
    "SS 310 (26/20 High Temp)": {
        "family": "stainless",
        "targets": {'C': (0.03, 0.15), 'Cr': (24.0, 26.0), 'Ni': (19.0, 22.0), 'Mn': (0.5, 2.0), 'Si': (0.5, 1.5)},
        "desc": "Severe high-temperature oxidation resistant casting alloy (up to 1150°C)."
    },
    "SS 420 (Martensitic Tool/Knife)": {
        "family": "stainless",
        "targets": {'C': (0.15, 0.40), 'Cr': (12.0, 14.0), 'Mn': (0.2, 1.0), 'Si': (0.2, 1.0), 'Ni': (0.0, 0.75)},
        "desc": "Hardenable martensitic stainless steel for valves, cutlery, and pump shafts."
    },
    "SS 430 (Ferritic Stainless)": {
        "family": "stainless",
        "targets": {'C': (0.0, 0.12), 'Cr': (16.0, 18.0), 'Mn': (0.2, 1.0), 'Si': (0.2, 1.0), 'Ni': (0.0, 0.75)},
        "desc": "Non-nickel ferritic stainless steel with good ductility and corrosion resistance."
    },
    "SS 201 (Low Nickel Economy)": {
        "family": "stainless",
        "targets": {'C': (0.0, 0.15), 'Cr': (16.0, 18.0), 'Ni': (3.5, 5.5), 'Mn': (5.5, 7.5), 'Cu': (1.0, 3.0), 'Si': (0.2, 1.0)},
        "desc": "Austenitic grade substituting manganese and nitrogen for nickel."
    },
    # Cast Irons
    "Grey Cast Iron (FG 200/250)": {
        "family": "cast_iron",
        "targets": {'C': (3.1, 3.5), 'Si': (1.8, 2.4), 'Mn': (0.5, 0.9), 'P': (0.0, 0.15), 'S': (0.0, 0.12)},
        "desc": "Class 30/35 flake graphite iron for machinery bases, pump housings, and manifolds."
    },
    "Ductile / SG Iron (GGG 40/50)": {
        "family": "cast_iron",
        "targets": {'C': (3.4, 3.8), 'Si': (2.2, 2.8), 'Mn': (0.2, 0.5), 'Mg': (0.035, 0.06), 'P': (0.0, 0.05), 'S': (0.0, 0.02)},
        "desc": "Nodular spheroidal graphite iron with high tensile strength and elongation."
    },
    "High Chrome White Iron (25% Cr)": {
        "family": "cast_iron",
        "targets": {'C': (2.2, 3.0), 'Cr': (23.0, 27.0), 'Si': (0.8, 1.5), 'Mn': (0.5, 1.5), 'Mo': (0.5, 1.5)},
        "desc": "Abrasion-resistant martensitic white iron for slurry pumps, impellers and grinding liners."
    },
    # Carbon & Special Steels
    "Mild Steel Cast (ASTM A216 WCB)": {
        "family": "steel",
        "targets": {'C': (0.18, 0.25), 'Mn': (0.6, 1.0), 'Si': (0.3, 0.6), 'P': (0.0, 0.04), 'S': (0.0, 0.045)},
        "desc": "Standard carbon steel casting for pressure valves, flanges, and structural brackets."
    },
    "Hadfield Manganese Steel (12-14% Mn)": {
        "family": "steel",
        "targets": {'C': (1.0, 1.35), 'Mn': (11.5, 14.0), 'Si': (0.3, 0.8), 'Cr': (0.0, 2.0), 'P': (0.0, 0.07)},
        "desc": "Severe work-hardening austenitic manganese steel for crusher jaws, hammers, and railway frogs."
    },
    "H-13 Die Steel (Hot Work)": {
        "family": "steel",
        "targets": {'C': (0.35, 0.42), 'Cr': (4.8, 5.5), 'Mo': (1.2, 1.6), 'V': (0.8, 1.2), 'Si': (0.8, 1.2), 'Mn': (0.25, 0.50)},
        "desc": "Hot-work tool steel with excellent thermal fatigue cracking resistance."
    },
    # Copper & Bronzes
    "Bronze 555 (Leaded Gunmetal LG2)": {
        "family": "bronze",
        "targets": {'Cu': (82.0, 87.0), 'Sn': (4.0, 6.0), 'Zn': (4.0, 6.0), 'Pb': (4.0, 6.0), 'Ni': (0.0, 1.0), 'P': (0.0, 0.05)},
        "desc": "Free-machining bearing bronze / gunmetal with good pressure tightness for valves and bushings."
    },
    "Tin Bronze (9-12% Sn Gear Bronze)": {
        "family": "bronze",
        "targets": {'Cu': (85.0, 90.0), 'Sn': (9.0, 12.0), 'Zn': (0.5, 2.5), 'Pb': (0.5, 2.5), 'P': (0.0, 0.20)},
        "desc": "Heavy-duty phosphor/tin bronze for high-load bearings, worm gears, and marine bushings."
    },
    "Custom Formulation": {
        "family": "custom",
        "targets": {'C': (0.1, 0.3), 'Mn': (0.5, 1.2), 'Si': (0.2, 0.6)},
        "desc": "Fully configurable custom foundry alloy specification."
    }
}

# ================= APP HEADER =================
total_mats = len(dm.df_clean)
heats_count = len(hm.history)
avg_scrap_rate = dm.df_clean['Cost'].mean()

st.markdown(f"""
<div class="foundry-header">
    <div>
        <h2 style="margin:0; font-size:26px; font-weight:800; letter-spacing:0.5px;">⚡ ALLOYFORGE AI | SMART CHARGE OPTIMIZER</h2>
        <p style="margin:4px 0 0 0; opacity:0.85; font-size:13px;">Foundry Matrix Linear Program • Multi-Tier Formulations • Metallurgical Recovery Engine</p>
    </div>
    <div style="display:flex; gap:16px; text-align:right;">
        <div style="background:rgba(255,255,255,0.08); padding:8px 14px; border-radius:8px; border:1px solid rgba(255,255,255,0.12);">
            <div style="font-size:10px; text-transform:uppercase; color:#94a3b8;">Scrap Master</div>
            <div style="font-size:16px; font-weight:700; color:#38bdf8;">{total_mats} Materials</div>
        </div>
        <div style="background:rgba(255,255,255,0.08); padding:8px 14px; border-radius:8px; border:1px solid rgba(255,255,255,0.12);">
            <div style="font-size:10px; text-transform:uppercase; color:#94a3b8;">Furnace Heats</div>
            <div style="font-size:16px; font-weight:700; color:#10b981;">{heats_count} Logged</div>
        </div>
    </div>
</div>
""", unsafe_allow_html=True)

# Main Navigation Tabs
main_tabs = st.tabs([
    "⚡ Furnace Charge Optimizer",
    "📦 Raw Material & Scrap Master",
    "📜 Furnace Heat History & Cards"
])

# ==============================================================================
# TAB 1: CHARGE MIX OPTIMIZER
# ==============================================================================
with main_tabs[0]:
    # Preset selection with callback to fix Streamlit widget state bug
    def handle_preset_change():
        st.session_state.preset_version += 1

    ctrl_col1, ctrl_col2 = st.columns([1.6, 1.0])
    
    with ctrl_col1:
        st.subheader("🎯 1. Select Target Alloy & Batch")
        preset_names = list(ALLOY_PRESETS.keys())
        
        c_sel1, c_sel2 = st.columns([1.8, 1.0])
        with c_sel1:
            selected_preset_name = st.selectbox(
                "Alloy Grade Preset",
                preset_names,
                index=0,
                key="preset_selector_widget",
                on_change=handle_preset_change
            )
            preset_data = ALLOY_PRESETS[selected_preset_name]
            st.caption(f"ℹ️ {preset_data['desc']}")

        with c_sel2:
            batch_weight = st.number_input(
                "Batch Total Weight (Kg)",
                min_value=50.0,
                max_value=50000.0,
                value=1000.0,
                step=50.0,
                key="batch_weight_input"
            )

    with ctrl_col2:
        st.subheader("⚙️ 2. Furnace Parameters")
        f_col1, f_col2 = st.columns(2)
        with f_col1:
            use_recovery = st.toggle("Furnace Oxidation Loss", value=True, help="Applies element-specific burn-off recovery rates (C: 92%, Si: 88%, Mn: 88%, etc.)")
            use_stock = st.toggle("Enforce Stock Limits", value=True, help="Caps scrap additions to current available yard inventory")
        with f_col2:
            tramp_guard = st.toggle("Tramp Element Guard", value=True, help="Restricts tramp residuals (Pb ≤ 0.015%, Sn ≤ 0.030%, Zn ≤ 0.020%) to avoid molten contamination")
            st.markdown("<div style='font-size:12px; color:#64748b; margin-top:8px;'>Linear Solver: <b>HiGHS Matrix LP</b></div>", unsafe_allow_html=True)

    st.markdown("---")

    # Chemical Limits Builder
    st.subheader("🧪 3. Chemical Composition Target Limits (%)")
    preset_targets = preset_data["targets"]
    p_ver = st.session_state.preset_version
    
    # Multiselect for constrained elements
    default_els = list(preset_targets.keys())
    active_elements = st.multiselect(
        "Elements to Constrain in Linear Program",
        options=dm.elements,
        default=default_els,
        key=f"active_elements_multiselect_{p_ver}"
    )

    # Render element input cards in a responsive grid
    if active_elements:
        final_targets = {}
        grid_cols = st.columns(min(len(active_elements), 5))
        
        for idx, el in enumerate(active_elements):
            col = grid_cols[idx % 5]
            # Default bounds from preset or standard 0.0 - 1.0
            def_l, def_h = preset_targets.get(el, (0.0, 1.0))
            with col:
                st.markdown(f"<div style='font-weight:700; color:#38bdf8; font-size:14px;'>{el} Bounds</div>", unsafe_allow_html=True)
                l_val = st.number_input(
                    f"Min {el} %",
                    min_value=0.0,
                    max_value=100.0,
                    value=float(def_l),
                    step=0.05,
                    format="%.3f",
                    key=f"inp_min_{p_ver}_{el}"
                )
                h_val = st.number_input(
                    f"Max {el} %",
                    min_value=0.0,
                    max_value=100.0,
                    value=float(def_h),
                    step=0.05,
                    format="%.3f",
                    key=f"inp_max_{p_ver}_{el}"
                )
                final_targets[el] = (l_val, h_val)
    else:
        st.warning("Please select at least one element to constrain.")
        final_targets = {}

    st.markdown("<br>", unsafe_allow_html=True)

    # Optimization Execution Button
    if st.button("⚡ GENERATE 3 OPTIMIZED CHARGE RECIPES", type="primary", use_container_width=True):
        if not final_targets:
            st.error("Cannot run without constrained elements.")
        else:
            with st.spinner("Matrix Solver Running (HiGHS Dual Simplex Engine)..."):
                # When tramp_guard is off, pass alloy_family=None to skip tramp caps
                effective_family = preset_data.get("family", "stainless") if tramp_guard else None
                results = opt.solve_all_options(
                    targets=final_targets,
                    batch_size=batch_weight,
                    alloy_family=effective_family,
                    use_recovery=use_recovery,
                    stock_limits=None if not use_stock else {}
                )
                st.session_state.last_calculation = {
                    "alloy": selected_preset_name,
                    "batch": batch_weight,
                    "targets": final_targets,
                    "results": results,
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }

    # ================= DISPLAY OPTIMIZATION RESULTS =================
    if st.session_state.last_calculation:
        calc = st.session_state.last_calculation
        results = calc["results"]
        
        st.markdown("---")
        st.markdown(f"### 🏆 Formulated Charge Options for **{calc['alloy']}** ({calc['batch']:,.0f} Kg Batch)")
        st.caption(f"Calculated on: {calc['timestamp']} • Elements constrained: {', '.join(calc['targets'].keys())}")

        # Top 3 Comparison Cards
        opt_keys = ["Option 1: Lowest Cost", "Option 2: Balanced Mix", "Option 3: High Purity Mix"]
        c1, c2, c3 = st.columns(3)
        cols = [c1, c2, c3]
        themes = ["opt-card-1", "opt-card-2", "opt-card-3"]

        for idx, key in enumerate(opt_keys):
            data = results.get(key, {})
            with cols[idx]:
                if data.get("success"):
                    st.markdown(f"""
                    <div class="{themes[idx]}">
                        <div class="badge-tag">{data['badge']}</div>
                        <h3 style="margin:4px 0 6px 0; font-size:18px;">{data['title']}</h3>
                        <div style="font-size:12px; opacity:0.85;">Cost per Kg Melt</div>
                        <div class="opt-rate">PKR {data['cost_per_kg']:,.2f}</div>
                        <div class="opt-tot">Total Heat: <b>PKR {data['total_cost']:,.0f}</b></div>
                        <div style="font-size:11px; margin-top:8px; opacity:0.9;">Tramp Index: <b>{data['tramp_index']:.3f}%</b></div>
                    </div>
                    """, unsafe_allow_html=True)
                else:
                    st.error(f"{key}: Infeasible Target")

        st.markdown("<br>", unsafe_allow_html=True)

        # Detailed Tabbed Analysis for Each Option
        opt_tabs = st.tabs(["🔥 Option 1: Maximum Economy", "⚖️ Option 2: Balanced Standard", "💎 Option 3: Clean Purity"])
        
        for idx, key in enumerate(opt_keys):
            data = results.get(key, {})
            with opt_tabs[idx]:
                if not data.get("success"):
                    st.error(f"⚠️ {data.get('message', 'Infeasible with current parameters.')}")
                    continue

                if data.get("warning"):
                    st.warning(f"Notice: {data['warning']}")

                col_recipe, col_charts = st.columns([1.3, 1.2])

                with col_recipe:
                    st.markdown("#### 📋 Charge Mix Recipe (Furnace Scale Weights)")
                    df_recipe = pd.DataFrame(data["recipe"])
                    
                    if not df_recipe.empty:
                        # Display recipe with formatted columns
                        st.dataframe(
                            df_recipe[[
                                "Material_Name", "Category", "Weight_Kg",
                                "Weight_Pct", "Rate_PKR", "Cost_PKR", "Cost_Pct"
                            ]],
                            column_config={
                                "Material_Name": st.column_config.TextColumn("Raw Material / Scrap"),
                                "Category": st.column_config.TextColumn("Category"),
                                "Weight_Kg": st.column_config.NumberColumn("Weight (Kg)", format="%.2f kg"),
                                "Weight_Pct": st.column_config.ProgressColumn("Weight Share", format="%.1f%%", min_value=0, max_value=100),
                                "Rate_PKR": st.column_config.NumberColumn("Rate", format="PKR %.1f"),
                                "Cost_PKR": st.column_config.NumberColumn("Cost", format="PKR %,.0f"),
                                "Cost_Pct": st.column_config.NumberColumn("Cost %", format="%.1f%%")
                            },
                            hide_index=True,
                            use_container_width=True
                        )

                    # Save and Print Buttons
                    st.markdown("##### 💾 Actions for this Option:")
                    b_save, b_print = st.columns([1.5, 1.5])
                    
                    with b_save:
                        notes_inp = st.text_input("Operator / Furnace Notes", placeholder="e.g. Induction Heat #4, morning shift", key=f"notes_{key}")
                        if st.button(f"💾 Save {key.split(':')[0]} to Furnace Log", key=f"btn_save_{key}", type="primary"):
                            h_id = hm.save_heat(
                                alloy_name=calc["alloy"],
                                batch_size=calc["batch"],
                                opt_name=key,
                                opt_data=data,
                                notes=notes_inp
                            )
                            st.success(f"✅ Successfully logged heat as **{h_id}**! Viewable in Heat History tab.")

                    with b_print:
                        st.write("")
                        st.write("")
                        with st.popover("🖨️ Preview Printable Batch Card"):
                            # Build a live preview from current calculation data
                            preview_heat = {
                                "heat_id": "PREVIEW",
                                "timestamp": calc["timestamp"],
                                "alloy_name": calc["alloy"],
                                "batch_size_kg": calc["batch"],
                                "selected_option": key,
                                "total_cost_pkr": data["total_cost"],
                                "cost_per_kg": data["cost_per_kg"],
                                "recipe": data["recipe"],
                                "chemistry": data.get("chemistry", {}),
                                "notes": ""
                            }
                            preview_html = hm.generate_batch_card_html_from_data(preview_heat)
                            st.components.v1.html(preview_html, height=500, scrolling=True)

                with col_charts:
                    st.markdown("#### 📊 Recipe Analytics & Compliance")
                    
                    # 1. Cost Distribution Donut Chart
                    if not df_recipe.empty:
                        fig_cost = px.pie(
                            df_recipe,
                            names="Material_Name",
                            values="Cost_PKR",
                            title="Cost Contribution by Material",
                            hole=0.45,
                            color_discrete_sequence=px.colors.qualitative.Dark24
                        )
                        fig_cost.update_layout(
                            margin=dict(l=10, r=10, t=35, b=10),
                            height=250,
                            legend=dict(orientation="h", yanchor="bottom", y=-0.3, font=dict(size=10))
                        )
                        st.plotly_chart(fig_cost, use_container_width=True)

                    # 2. Chemistry Target vs Achieved Table
                    st.markdown("##### 🧪 Chemistry Compliance Status")
                    df_chem = pd.DataFrame(data["chemistry_table"])
                    if not df_chem.empty:
                        st.dataframe(
                            df_chem[["Element", "Min_Spec", "Max_Spec", "Achieved_Pct", "Status"]],
                            column_config={
                                "Element": st.column_config.TextColumn("Element"),
                                "Min_Spec": st.column_config.NumberColumn("Min %", format="%.3f"),
                                "Max_Spec": st.column_config.NumberColumn("Max %", format="%.3f"),
                                "Achieved_Pct": st.column_config.NumberColumn("Achieved Tap %", format="%.3f"),
                                "Status": st.column_config.TextColumn("Status")
                            },
                            hide_index=True,
                            use_container_width=True
                        )


# ==============================================================================
# TAB 2: RAW MATERIAL & SCRAP MASTER
# ==============================================================================
with main_tabs[1]:
    st.subheader("📦 Scrap Master & Live Inventory Database")
    st.caption("Manage unit prices, compositions, categories, and yard stock availability. All modifications persist to disk.")

    df_curr = dm.df_clean.copy()

    # Metrics Summary Row
    m1, m2, m3, m4 = st.columns(4)
    with m1:
        st.markdown(f"""
        <div class="metric-card">
            <div class="label">Total Raw Materials</div>
            <div class="value">{len(df_curr)}</div>
            <div class="subtext">Active Scrap & Alloys</div>
        </div>
        """, unsafe_allow_html=True)
    with m2:
        st.markdown(f"""
        <div class="metric-card">
            <div class="label">Avg Scrap Cost</div>
            <div class="value">PKR {df_curr['Cost'].mean():,.1f}</div>
            <div class="subtext">Across All Categories</div>
        </div>
        """, unsafe_allow_html=True)
    with m3:
        st.markdown(f"""
        <div class="metric-card">
            <div class="label">Cheapest Scrap</div>
            <div class="value" style="color:#10b981;">PKR {df_curr['Cost'].min():,.1f}</div>
            <div class="subtext">{df_curr.sort_values('Cost').iloc[0]['Name'][:18]}</div>
        </div>
        """, unsafe_allow_html=True)
    with m4:
        st.markdown(f"""
        <div class="metric-card">
            <div class="label">Highest Value Alloy</div>
            <div class="value" style="color:#a855f7;">PKR {df_curr['Cost'].max():,.1f}</div>
            <div class="subtext">{df_curr.sort_values('Cost', ascending=False).iloc[0]['Name'][:18]}</div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # Category and Search Filter
    f_col1, f_col2, f_col3 = st.columns([1.5, 1.5, 1.0])
    with f_col1:
        all_cats = ["All Categories"] + dm.get_categories()
        sel_cat = st.selectbox("Filter by Category", all_cats)
    with f_col2:
        search_query = st.text_input("🔍 Search Material Name", placeholder="e.g. 304, bronze, ferro")
    with f_col3:
        st.write("")
        st.write("")
        if st.button("📥 Export to Excel", use_container_width=True):
            exp_file = dm.export_to_excel()
            st.success(f"Exported to `{exp_file}`")

    # Apply filters
    df_filtered = df_curr.copy()
    if sel_cat != "All Categories":
        df_filtered = df_filtered[df_filtered['Category'] == sel_cat]
    if search_query.strip():
        df_filtered = df_filtered[df_filtered['Name'].str.contains(search_query.strip(), case=False, na=False)]

    inv_tab1, inv_tab2 = st.tabs(["📝 View & Edit Material Master", "➕ Add New Material to Database"])

    with inv_tab1:
        st.caption("Click any cell below to edit price, category, stock, or chemical composition. Then click 'Save Changes' below.")
        
        # Display editable table
        edited_df = st.data_editor(
            df_filtered,
            num_rows="fixed",
            use_container_width=True,
            height=450,
            column_config={
                "ID": st.column_config.NumberColumn("ID", disabled=True, width="small"),
                "Name": st.column_config.TextColumn("Material / Scrap Name", width="medium"),
                "Cost": st.column_config.NumberColumn("Cost (PKR/Kg)", format="PKR %.1f", width="small"),
                "Category": st.column_config.SelectboxColumn("Category", options=dm.get_categories(), width="medium"),
                "Max_Stock_Kg": st.column_config.NumberColumn("Max Stock (Kg)", format="%.0f", help="Leave blank for unlimited")
            },
            key="scrap_data_editor"
        )

        b_save_table, b_delete_mat = st.columns([1.5, 2.5])
        with b_save_table:
            if st.button("💾 Save All Table Changes Permanently", type="primary", use_container_width=True):
                # Update main dataframe
                for _, row in edited_df.iterrows():
                    mat_id = row['ID']
                    mask = dm.df_clean['ID'] == mat_id
                    if mask.any():
                        for col in dm.df_clean.columns:
                            if col in row:
                                dm.df_clean.loc[mask, col] = row[col]
                dm.save_to_json()
                st.success("✅ Changes permanently saved to database!")
                st.rerun()

        with b_delete_mat:
            with st.popover("🗑️ Delete a Material"):
                del_id = st.selectbox("Select Material ID to Delete", df_filtered['ID'].tolist(), format_func=lambda x: f"ID {x}: {dm.df_clean[dm.df_clean['ID']==x].iloc[0]['Name']}")
                if st.button("Confirm Delete", type="secondary"):
                    dm.delete_material(del_id)
                    st.success(f"Material {del_id} deleted!")
                    st.rerun()

    with inv_tab2:
        st.markdown("#### Add New Scrap or Master Alloy to Inventory")
        with st.form("add_new_material_full_form"):
            a1, a2, a3 = st.columns([2.0, 1.2, 1.2])
            with a1:
                new_mat_name = st.text_input("Material / Scrap Name", placeholder="e.g. DUCTILE SCRAP BORINGS")
            with a2:
                new_mat_cost = st.number_input("Cost per Kg (PKR)", min_value=1.0, value=250.0, step=10.0)
            with a3:
                new_mat_cat = st.selectbox("Category", dm.get_categories() + ["Custom Scrap"])

            st.markdown("##### Elemental Composition (%) - Enter values for all known elements:")
            
            # Divide 20 elements into 4 logical columns
            elem_cols = st.columns(5)
            new_comp = {}
            for i, el in enumerate(dm.elements):
                c = elem_cols[i % 5]
                with c:
                    new_comp[el] = st.number_input(f"{el} %", min_value=0.0, max_value=100.0, value=0.0, step=0.1, format="%.2f", key=f"add_el_{el}")

            stock_inp = st.number_input("Max Available Stock (Kg) - Optional", min_value=0.0, value=0.0, step=100.0, help="Leave 0 for unconstrained")

            submitted = st.form_submit_button("➕ Add Material to System", type="primary", use_container_width=True)
            if submitted and new_mat_name.strip():
                # Validate sum
                elem_sum = sum(new_comp.values())
                if elem_sum > 105.0:
                    st.error(f"Total element percentages sum to {elem_sum:.1f}%, which exceeds 100%!")
                else:
                    stock_val = stock_inp if stock_inp > 0 else None
                    new_id = dm.add_material(new_mat_name, new_mat_cost, new_comp, category=new_mat_cat, max_stock=stock_val)
                    st.success(f"Successfully added '{new_mat_name}' as ID #{new_id}!")
                    st.rerun()


# ==============================================================================
# TAB 3: FURNACE HEAT HISTORY & BATCH CARDS
# ==============================================================================
with main_tabs[2]:
    st.subheader("📜 Furnace Heat History Ledger")
    st.caption("Official log of formulated and tapped furnace heats. Inspect previous recipes, generate shop-floor batch cards, or export reports.")

    if not hm.history:
        st.info("No heats logged yet. Calculate a charge mix in Tab 1 and click 'Save to Furnace Log' to create your first heat entry.")
    else:
        # History Statistics
        tot_heats = len(hm.history)
        tot_tonnes = sum(h['batch_size_kg'] for h in hm.history) / 1000.0
        tot_cost_all = sum(h['total_cost_pkr'] for h in hm.history)

        hs1, hs2, hs3 = st.columns(3)
        with hs1:
            st.markdown(f"""
            <div class="metric-card">
                <div class="label">Total Logged Heats</div>
                <div class="value">{tot_heats} Heats</div>
                <div class="subtext">Archived in Furnace Ledger</div>
            </div>
            """, unsafe_allow_html=True)
        with hs2:
            st.markdown(f"""
            <div class="metric-card">
                <div class="label">Total Metal Formulated</div>
                <div class="value" style="color:#10b981;">{tot_tonnes:,.1f} Tonnes</div>
                <div class="subtext">Total Batch Tonnage</div>
            </div>
            """, unsafe_allow_html=True)
        with hs3:
            st.markdown(f"""
            <div class="metric-card">
                <div class="label">Total Raw Material Expenditure</div>
                <div class="value" style="color:#a855f7;">PKR {tot_cost_all:,.0f}</div>
                <div class="subtext">Sum of All Formulated Heats</div>
            </div>
            """, unsafe_allow_html=True)

        st.markdown("<br>", unsafe_allow_html=True)

        # History Table View
        df_hist = hm.to_dataframe()
        st.dataframe(
            df_hist,
            use_container_width=True,
            hide_index=True
        )

        csv_data = df_hist.to_csv(index=False).encode('utf-8')
        st.download_button(
            "📥 Download Heat Ledger as CSV",
            data=csv_data,
            file_name=f"Furnace_Heat_Ledger_{datetime.now().strftime('%Y%m%d')}.csv",
            mime="text/csv"
        )

        st.markdown("---")

        # Drill-Down Inspector & Printable Card
        st.subheader("🔍 Inspect Heat & Generate Shop-Floor Card")
        h_inspect_col1, h_inspect_col2 = st.columns([1.2, 1.8])

        with h_inspect_col1:
            heat_ids = [h['heat_id'] for h in hm.history]
            selected_heat_id = st.selectbox("Select Heat ID to Inspect", heat_ids)
            selected_heat = hm.get_heat(selected_heat_id)

            if selected_heat:
                st.markdown(f"""
                <div class="metric-card">
                    <div class="label">{selected_heat['heat_id']} • {selected_heat['timestamp']}</div>
                    <div style="font-size:18px; font-weight:700; color:#38bdf8; margin:6px 0;">{selected_heat['alloy_name']}</div>
                    <div>Batch: <b>{selected_heat['batch_size_kg']:,.0f} Kg</b></div>
                    <div>Option: <b>{selected_heat['selected_option']}</b></div>
                    <div>Total Cost: <b>PKR {selected_heat['total_cost_pkr']:,.0f}</b> ({selected_heat['cost_per_kg']:.1f}/Kg)</div>
                    <div style="margin-top:6px; font-size:12px; color:#94a3b8;">Notes: {selected_heat.get('notes', 'None')}</div>
                </div>
                """, unsafe_allow_html=True)

                st.markdown("<br>", unsafe_allow_html=True)
                if st.button("🗑️ Delete this Heat Record", type="secondary"):
                    hm.delete_heat(selected_heat_id)
                    st.success(f"Heat {selected_heat_id} deleted!")
                    st.rerun()

        with h_inspect_col2:
            if selected_heat:
                st.markdown("#### 🖨️ Printable Furnace Charge Card")
                batch_card_html = hm.generate_batch_card_html(selected_heat_id)
                st.components.v1.html(batch_card_html, height=520, scrolling=True)