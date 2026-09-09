/**
 * AlloyForge AI - Inventory & Scrap Master Manager
 * Full Native Excel (.xlsx) Import & Export via SheetJS.
 * Handles "Balance" (remaining percentage) and "Tracer" (set to 0.0) automatically.
 */

class InventoryManager {
    constructor() {
        this.storageKey = "alloyforge_scrap_master_v3";
        this.materials = this.loadMaterials();
    }

    loadMaterials() {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error("Failed to parse stored materials, using defaults", e);
            }
        }
        return JSON.parse(JSON.stringify(window.ALLOYFORGE_DEFAULT_DATA.materials));
    }

    saveMaterials() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.materials));
    }

    resetToDefaults() {
        this.materials = JSON.parse(JSON.stringify(window.ALLOYFORGE_DEFAULT_DATA.materials));
        this.saveMaterials();
        return this.materials;
    }

    getMaterials() {
        return this.materials;
    }

    getCategories() {
        const cats = new Set();
        this.materials.forEach(m => {
            if (m.Category) cats.add(m.Category);
        });
        return Array.from(cats).sort();
    }

    updateField(id, field, value) {
        const mat = this.materials.find(m => m.ID === id);
        if (mat) {
            if (field === 'Name' || field === 'Material_Name' || field === 'Category') {
                mat[field] = value;
                if (field === 'Name') mat.Material_Name = value;
                if (field === 'Material_Name') mat.Name = value;
            } else if (field === 'Max_Stock_Kg') {
                mat[field] = (value !== "" && value !== null && !isNaN(value) && parseFloat(value) > 0) ? parseFloat(value) : null;
            } else {
                mat[field] = parseFloat(value) || 0.0;
                if (field === 'Cost') mat.Cost_Per_Kg = mat[field];
                if (field === 'Cost_Per_Kg') mat.Cost = mat[field];
            }
            this.saveMaterials();
            return true;
        }
        return false;
    }

    addMaterial(name, cost, category, composition, maxStock = null) {
        const maxId = this.materials.reduce((max, m) => Math.max(max, m.ID || 0), 0);
        const newId = maxId + 1;
        
        const newMat = {
            ID: newId,
            Name: name.trim(),
            Material_Name: name.trim(),
            Cost: parseFloat(cost) || 0.0,
            Cost_Per_Kg: parseFloat(cost) || 0.0,
            Category: category || "Custom Scrap",
            Max_Stock_Kg: maxStock && parseFloat(maxStock) > 0 ? parseFloat(maxStock) : null
        };

        window.ALLOYFORGE_DEFAULT_DATA.elements.forEach(el => {
            newMat[el] = parseFloat(composition[el]) || 0.0;
        });

        this.materials.push(newMat);
        this.saveMaterials();
        return newId;
    }

    deleteMaterial(id) {
        const initialLen = this.materials.length;
        this.materials = this.materials.filter(m => m.ID !== id);
        if (this.materials.length < initialLen) {
            this.saveMaterials();
            return true;
        }
        return false;
    }

    /**
     * Parse cell content from Excel:
     * - "Tracer", "Traces", "Tr", "nil" -> 0.0
     * - "Balance" -> marker for remaining element calculation
     * - "4-6%" or "0.5-2%" -> average of the range
     * - Numbers -> float
     */
    parseExcelCell(val) {
        if (val === null || val === undefined) return 0.0;
        const s = String(val).trim();
        if (!s || s === '-' || s === 'nil' || s === 'null') return 0.0;
        
        const lower = s.toLowerCase();
        if (lower.includes('tracer') || lower.includes('trace') || lower === 'tr') {
            return 0.0;
        }
        if (lower.includes('balance')) {
            return 'BALANCE';
        }

        // Clean percent sign
        const clean = s.replace(/%/g, '').trim();
        // Check for range e.g. "4-6" or "0.05-0.20"
        const rangeMatch = clean.match(/^([\d\.]+)\s*-\s*([\d\.]+)$/);
        if (rangeMatch) {
            const v1 = parseFloat(rangeMatch[1]);
            const v2 = parseFloat(rangeMatch[2]);
            if (!isNaN(v1) && !isNaN(v2)) {
                return (v1 + v2) / 2.0;
            }
        }

        const num = parseFloat(clean);
        return isNaN(num) ? 0.0 : num;
    }

    /**
     * Auto-detect Category from material name if not specified in Excel
     */
    detectCategory(name) {
        const n = (name || '').toLowerCase();
        if (n.includes('bronze') || n.includes('copper') || n.includes('gunmetal')) return 'Copper & Bronze';
        if (n.includes('s.s') || n.includes('stainless') || n.includes('304') || n.includes('316') || n.includes('201') || n.includes('420') || n.includes('430') || n.includes('26/4') || n.includes('26/12') || n.includes('26/20')) return 'Stainless & High Alloy';
        if (n.includes('c.i') || n.includes('cast iron') || n.includes('pig iron') || n.includes('sg iron') || n.includes('ductile') || n.includes('ci ')) return 'Cast Iron & Pig Iron';
        if (n.includes('ferro') || n.includes('fe-si') || n.includes('fe-cr') || n.includes('fe-mn') || n.includes('femn') || n.includes('fesi') || n.includes('fecr') || n.includes('silico manganese')) return 'Ferro Alloys';
        if (n.includes('m.s') || n.includes('mild steel') || n.includes('hadfield') || n.includes('manganese steel') || n.includes('die steel') || n.includes('h-13') || n.includes('wcb')) return 'Carbon & Special Steel';
        return 'Virgin Metals & Additives';
    }

    /**
     * Import directly from an Excel (.xlsx, .xls) file using SheetJS
     */
    async importFromExcelFile(file) {
        return new Promise((resolve, reject) => {
            if (typeof XLSX === 'undefined') {
                reject(new Error("SheetJS (XLSX) library is not loaded."));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[firstSheetName];
                    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    if (!rows || rows.length < 2) {
                        reject(new Error("Excel sheet appears to be empty or has insufficient rows."));
                        return;
                    }

                    const elements = window.ALLOYFORGE_DEFAULT_DATA.elements;
                    const parsedMaterials = [];

                    // Identify element column mapping
                    // Row 0 or Row 1 might contain headers.
                    let nameCol = 1;
                    let costCol = 2;
                    let categoryCol = -1;
                    let elementColMap = {}; // { 'Cu': colIndex, ... }
                    let startRow = 2;

                    // Scan first 3 rows to locate element headers
                    for (let r = 0; r < Math.min(3, rows.length); r++) {
                        const row = rows[r];
                        if (!row) continue;
                        row.forEach((cellVal, cIdx) => {
                            if (!cellVal) return;
                            const cellStr = String(cellVal).trim();
                            const cellLower = cellStr.toLowerCase();

                            if (cellLower === 'scrap name' || cellLower === 'name' || cellLower === 'material') {
                                nameCol = cIdx;
                            }
                            if (cellLower.includes('cost') || cellLower.includes('price') || cellLower.includes('rate')) {
                                costCol = cIdx;
                            }
                            if (cellLower === 'category') {
                                categoryCol = cIdx;
                            }
                            // Check if cell is an element symbol
                            if (elements.includes(cellStr)) {
                                elementColMap[cellStr] = cIdx;
                                startRow = Math.max(startRow, r + 1);
                            }
                        });
                    }

                    // Fallback element mapping if not found by exact header (standard master sheet structure)
                    if (Object.keys(elementColMap).length < 5) {
                        elements.forEach((el, idx) => {
                            elementColMap[el] = 3 + idx; // Default starts at col index 3 (4th column)
                        });
                        startRow = 2; // Data starts at row index 2 (Row 3 in Excel)
                    }

                    // Parse data rows
                    for (let r = startRow; r < rows.length; r++) {
                        const row = rows[r];
                        if (!row || !row[nameCol] || String(row[nameCol]).trim() === '') continue;

                        const name = String(row[nameCol]).trim();
                        const rawCost = row[costCol];
                        const cost = parseFloat(rawCost) || 0.0;
                        const category = categoryCol !== -1 && row[categoryCol] 
                            ? String(row[categoryCol]).trim() 
                            : this.detectCategory(name);

                        const comp = {};
                        let balanceEl = null;

                        elements.forEach(el => {
                            const cIdx = elementColMap[el];
                            const cellVal = (cIdx !== undefined && row[cIdx] !== undefined) ? row[cIdx] : 0.0;
                            const parsed = this.parseExcelCell(cellVal);

                            if (parsed === 'BALANCE') {
                                balanceEl = el;
                                comp[el] = 0.0;
                            } else {
                                comp[el] = typeof parsed === 'number' ? parsed : 0.0;
                            }
                        });

                        // Calculate Balance = 100 - sum(all other elements)
                        if (balanceEl) {
                            let otherSum = 0.0;
                            for (const [el, val] of Object.entries(comp)) {
                                if (el !== balanceEl) otherSum += val;
                            }
                            comp[balanceEl] = Math.max(0.0, parseFloat((100.0 - otherSum).toFixed(3)));
                        }

                        parsedMaterials.push({
                            ID: parsedMaterials.length + 1,
                            Name: name,
                            Material_Name: name,
                            Category: category,
                            Cost: cost,
                            Cost_Per_Kg: cost,
                            Max_Stock_Kg: null,
                            ...comp
                        });
                    }

                    if (parsedMaterials.length === 0) {
                        reject(new Error("No valid raw material rows could be extracted from Excel file."));
                        return;
                    }

                    // Update and save
                    this.materials = parsedMaterials;
                    this.saveMaterials();
                    resolve({ success: true, count: this.materials.length });
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error("Failed to read Excel file."));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Export master catalog to real Excel (.xlsx) file using SheetJS
     */
    exportToExcelFile() {
        if (typeof XLSX === 'undefined') {
            alert("Excel export engine not loaded. Downloading as CSV instead.");
            this.exportToCSV();
            return;
        }

        const elements = window.ALLOYFORGE_DEFAULT_DATA.elements;

        // Construct 2-Row Header matching original industrial sheet format
        const row1 = ['Sr#', 'Scrap Name', 'Category', 'Cost/Kg', 'Max Stock (Kg)', 'Composition'];
        // Pad row1 for the remaining elements
        for (let i = 0; i < elements.length - 1; i++) row1.push('');

        const row2 = ['', '', '', '', '', ...elements];

        const dataRows = this.materials.map((m, idx) => {
            const row = [
                m.ID || (idx + 1),
                m.Name || m.Material_Name || 'Scrap',
                m.Category || 'General',
                m.Cost || m.Cost_Per_Kg || 0,
                m.Max_Stock_Kg || ''
            ];
            elements.forEach(el => {
                row.push(m[el] !== undefined ? m[el] : 0.0);
            });
            return row;
        });

        const ws_data = [row1, row2, ...dataRows];
        const ws = XLSX.utils.aoa_to_sheet(ws_data);

        // Column widths for readability
        ws['!cols'] = [
            { wch: 6 },  // Sr#
            { wch: 30 }, // Scrap Name
            { wch: 22 }, // Category
            { wch: 12 }, // Cost/Kg
            { wch: 14 }  // Max Stock
        ];
        elements.forEach(() => ws['!cols'].push({ wch: 9 }));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Scrap Master');

        const fileName = `Scrap_Master_Sheet_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }

    exportToCSV() {
        const elements = window.ALLOYFORGE_DEFAULT_DATA.elements;
        const headers = ["ID", "Name", "Category", "Cost_PKR_Kg", "Max_Stock_Kg", ...elements];
        
        const rows = this.materials.map(m => {
            const row = [
                m.ID,
                `"${(m.Name || m.Material_Name).replace(/"/g, '""')}"`,
                `"${(m.Category || '').replace(/"/g, '""')}"`,
                m.Cost || m.Cost_Per_Kg || 0,
                m.Max_Stock_Kg || ""
            ];
            elements.forEach(el => {
                row.push(m[el] !== undefined ? m[el] : 0);
            });
            return row.join(",");
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Scrap_Master_Catalog_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    exportToJSON() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
            version: "3.0",
            exportDate: new Date().toISOString(),
            elements: window.ALLOYFORGE_DEFAULT_DATA.elements,
            materials: this.materials
        }, null, 2));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `AlloyForge_Database_Backup_${new Date().toISOString().slice(0,10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    }
}

window.InventoryManager = InventoryManager;
