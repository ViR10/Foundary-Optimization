# ⚡ AlloyForge AI | Foundry Charge Mix Optimizer

An industrial-grade **Linear Programming (LP)** charge optimization application built for metal foundries, melt shops, and casting facilities. AlloyForge AI calculates the mathematical least-cost blend of scrap, pig iron, returns, and ferro-alloys to hit target metallurgical specifications with zero spectrometer off-spec heats.

[![Streamlit App](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://share.streamlit.io)
![Python Version](https://img.shields.io/badge/python-3.10%2B-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🌟 Key Features

### 1. 🎯 3-Tier Multi-Option Charge Formulations
Every calculation automatically generates 3 practical foundry charge recipes:
- **🟢 Option 1: Lowest Cost (Maximum Economy)**: Aggressive least-cost formulation utilizing maximum cost-effective scrap while strictly adhering to chemical and tramp limits.
- **🔵 Option 2: Balanced Standard (Mid-Spec Safety Buffer)**: Centered within target chemical tolerance bands to provide safety margins against melt variability.
- **🟣 Option 3: High Purity Mix (Clean Charge)**: Premium virgin and clean heavy scrap mix; eliminates turnings, shavings, borings, and contaminated shells.

### 2. 🔥 Furnace Oxidation & Melting Loss Engine
In real induction furnaces and cupolas, reactive elements oxidize into slag or vaporize:
- Built-in recovery factor adjustments: **Carbon (92%)**, **Silicon (88%)**, **Manganese (88%)**, **Chromium (95%)**, **Zinc (90%)**, **Magnesium (40%)**.
- Guarantees tapped liquid metal exactly hits target spectrometer chemistry after oxidation losses.

### 3. 🛡️ Tramp Element Guard
Automatically restricts harmful residual tramp elements:
- **Lead (Pb ≤ 0.015%)**, **Tin (Sn ≤ 0.030%)**, **Zinc (Zn ≤ 0.020%)**, **Phosphorus (P ≤ 0.045%)**, **Sulfur (S ≤ 0.035%)**.
- Prevents catastrophic hot shortness, cracking, and melt contamination from unconstrained scrap.

### 4. 📚 Comprehensive Alloy Preset Library (15+ Grades)
- **Stainless Steels**: SS 304, SS 316, SS 309 (26/12), SS 310 (26/20), SS 420, SS 430, SS 201.
- **Cast Irons**: Grey Iron (FG 200/250), Ductile / SG Iron (GGG 40/50), High Chrome White Iron (25% Cr).
- **Carbon & Special Steels**: Mild Steel (ASTM A216 WCB), Hadfield High Manganese (12-14% Mn), H-13 Die Steel.
- **Copper & Bronzes**: Bronze 555 (Leaded Gunmetal LG2), Tin Bronze (9-12% Sn).
- **Custom Formulation Builder**: Fully configurable min/max bounds for any chemical specification.

### 5. 📊 Visual Recipe & Chemistry Analytics
- **Cost Distribution Donut Chart**: Interactive Plotly breakdown showing cost contribution by raw material.
- **Spectrometer Compliance Table**: Live status badges (`OPTIMAL (PASS)`, `AT MIN LIMIT`, `AT MAX LIMIT`, `UNDER/OVER SPEC`).

### 6. 📦 Scrap Master & Live Inventory Management
- Database of 55+ raw materials with 20 chemical elements: `Cu, Sn, Zn, Pb, Fe, Ni, P, Mn, Si, Al, S, Cr, C, Mg, Ti, Mo, V, Nb, Sb, Ca`.
- Live editable table for unit price revisions and stock availability constraints ($w_i \le \text{Max\_Stock}_i$).
- Full modal to add custom scrap materials and export the master catalog to Excel.

### 7. 📜 Furnace Heat Ledger & Printable Shop-Floor Cards
- Complete heat history logging with supervisor/operator notes.
- **One-Click Printable Batch Card**: Formatted HTML charge sheet with charging sequence, scale weights, operator check-boxes, and chemist sign-offs.
- Export heat history to CSV.

---

## 🛠️ Project Structure

```text
Foundary Optimizer/
│
├── app.py                         # Main Streamlit web application (UI & Dashboard)
├── optimizer.py                   # SciPy HiGHS Linear Programming Solver
├── data_manager.py                # Data ingestion, schema cleaning, JSON/Excel sync
├── history_manager.py             # Furnace heat ledger & printable batch card generator
├── persistent_raw_materials.json  # Persistent JSON scrap master database
├── Scrap Master Sheet_023516.xlsx # Original raw material catalog
├── requirements.txt               # Production Python package dependencies
└── README.md                      # Documentation
```

---

## 🚀 Local Installation & Quick Start

### 1. Prerequisites
- Python 3.10 or higher
- Git

### 2. Clone the Repository
```bash
git clone https://github.com/your-username/foundry-charge-optimizer.git
cd foundry-charge-optimizer
```

### 3. Create a Virtual Environment (Recommended)
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

### 5. Launch the Application
```bash
streamlit run app.py
```
Open your browser and navigate to `http://localhost:8501`.

---

## ☁️ Deployment Guide (Streamlit Community Cloud)

Deploying AlloyForge AI to **Streamlit Community Cloud** is free and takes less than 3 minutes:

### Step 1: Push Code to GitHub
Ensure all files including `app.py`, `optimizer.py`, `data_manager.py`, `history_manager.py`, `persistent_raw_materials.json`, and `requirements.txt` are committed and pushed to your GitHub repository:
```bash
git init
git add .
git commit -m "Initial release of AlloyForge AI"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

### Step 2: Deploy on Streamlit Cloud
1. Visit [share.streamlit.io](https://share.streamlit.io) and log in with GitHub.
2. Click **New app**.
3. Select your **Repository**, **Branch** (`main`), and set **Main file path** to `app.py`.
4. Click **Deploy!**.

Your app will be live with a public URL (e.g. `https://your-foundry-optimizer.streamlit.app`) accessible from any desktop, tablet, or mobile phone.

---

## 📦 Dependencies

| Package | Minimum Version | Purpose |
|---|---|---|
| `streamlit` | `>=1.35.0` | Frontend web interface & reactive state management |
| `scipy` | `>=1.10.0` | Matrix Linear Programming solver (`method='highs'`) |
| `pandas` | `>=2.0.0` | Tabular data manipulation & indexing |
| `numpy` | `>=1.24.0` | Matrix vectorization & chemical math |
| `plotly` | `>=5.18.0` | Interactive cost & chemistry visualization |
| `openpyxl` | `>=3.1.0` | Excel spreadsheet read/write support |

---

## 📄 License

This project is licensed under the **MIT License**.
