# ⚡ AlloyForge AI | Standalone Foundry Charge Optimizer

An industrial-grade, **zero-dependency, standalone Linear Programming (LP)** charge optimization application designed for metal foundries, melt shops, and casting facilities. 

AlloyForge AI calculates the mathematical least-cost blend of scrap, pig iron, returns, and ferro-alloys to hit target metallurgical specifications with zero off-spec heats.

[![Platform](https://img.shields.io/badge/platform-Offline%20Browser%20%7C%20Windows%20%7C%20Mac%20%7C%20Mobile-blue)](index.html)
[![Setup](https://img.shields.io/badge/installation-Zero%20Dependencies%20(No%20Python%20Needed)-brightgreen)](Launch_App.bat)
[![License](https://img.shields.io/badge/license-MIT-green)](#)

---

## 🌟 Key Capabilities

### 1. 🎯 3 Cost-Tier Charge Formulations (Ranked by Lowest Price)
Every calculation automatically formulates 3 distinct, practical foundry charge recipes:
- **🔥 Option 1: Lowest Cost (Maximum Economy)**: Absolute least-cost formulation utilizing maximum cost-effective scrap while strictly adhering to chemical and tramp limits.
- **⚖️ Option 2: Balanced Standard (Foundry Standard)**: Centered within target chemical tolerance bands with safety margins against melt variability.
- **💎 Option 3: Clean Purity (Premium Charge)**: High-purity charge with hard exclusion and heavy penalization on dirty turnings, shavings, and borings.

### 2. ⚡ Client-Side Two-Phase Simplex LP Engine
- Fully embedded mathematical linear programming solver running natively in the browser with **0ms latency**.
- Enforces strict batch weight equality ($\sum w_i = \text{Batch}$).
- Enforces 20 chemical element tolerance limits with furnace oxidation recovery factors (**C: 92%**, **Si: 88%**, **Mn: 88%**, **Cr: 95%**, **Zn: 90%**).
- Enforces tramp element caps (**Pb $\le$ 0.015%**, **Sn $\le$ 0.030%**, **Zn $\le$ 0.020%**, **P $\le$ 0.045%**, **S $\le$ 0.035%**).

### 3. 🤖 AI Metallurgy Copilot (Interactive Assistant)
- Natural language chat assistant (supports English & Roman Urdu).
- Type queries like *"Calculate 1000kg of SS 304"* or *"Check price of Ferro Chrome"*.
- Automatically extracts target alloy, batch weight, solves linear matrices, and offers a **"⚡ Load into Optimizer"** button.

### 4. 📦 Live Scrap Master & Inventory Management
- Pre-loaded with **55+ industrial raw materials** and **20 elements**: `Cu, Sn, Zn, Pb, Fe, Ni, P, Mn, Si, Al, S, Cr, C, Mg, Ti, Mo, V, Nb, Sb, Ca`.
- **Inline Table Editing**: Revise scrap prices, categories, and stock availability limits with instant `localStorage` persistence.
- **Add New Scrap Material**: Interactive modal with automatic balance detection.
- **Data Export & Backup**: One-click CSV/Excel catalog export and full JSON backup/restore.

### 5. 📜 Furnace Heat Ledger & 1-Click Printable Charge Cards
- Permanent heat log history with operator/shift notes.
- **Shop-Floor Charge Card (Heat Sheet)**: Formatted A4 printable card with charging sequence, scale weights, checkbox checklist `[ ]`, spectrometer tap targets, and operator/metallurgist/in-charge signature blocks.
- Export heat ledger to CSV.

---

## 📁 Clean Project Structure

```text
Foundary Optimizer/
│
├── 🚀 Launch_App.bat          # 1-Click Windows Launcher (Opens default browser)
├── 🌐 index.html              # Main Standalone Web Application
├── 📄 README.md               # Documentation & User Guide
├── ⚙️ .gitignore              # Git Ignore Rules
│
├── 📁 css/
│   └── style.css              # Cyber-Metallic High-End Responsive Theme
│
├── 📁 js/
│   ├── app.js                 # Master UI Application Controller
│   ├── assistant.js           # AI Metallurgy Conversational Copilot
│   ├── data.js                # Embedded Materials & 15+ Preset Library
│   ├── history.js             # Heat History & Printable Charge Card Generator
│   ├── inventory.js           # Live Scrap Master CRUD & LocalStorage Persistence
│   └── solver.js              # Pure JavaScript Two-Phase Simplex LP Matrix Solver
│
└── 📁 data/
    ├── persistent_raw_materials.json # JSON Master Catalog Reference
    └── Scrap Master Sheet_023516.xlsx # Original Excel Sheet Reference
```

---

## 🚀 How to Run (One-Click, Zero Setup)

1. **On Windows PC / Laptop**:
   - Double-click **`Launch_App.bat`** (or double-click **`index.html`**).
   - The application opens instantly in your default web browser (Edge, Chrome, Brave, Firefox).

2. **On Mac / Linux / Chromebook**:
   - Double-click **`index.html`**.

3. **On Smartphone or Tablet (Android / iPhone / iPad)**:
   - Open **`index.html`** in Safari or Chrome.

> **Note**: No Python, Node.js, terminal commands, or internet connection are required! Everything runs 100% offline.

---

## 📱 How to Share via WhatsApp

1. Right-click the `Foundary Optimizer` folder and select **Compress to ZIP** (`Foundry_Optimizer_v2.0.zip`).
2. The total ZIP size is **under 1.2 MB**.
3. Send it as a document on WhatsApp.
4. Your client simply extracts the ZIP and double-clicks **`Launch_App.bat`**!

---

## 📄 License
This project is licensed under the **MIT License**.
