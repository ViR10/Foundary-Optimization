/**
 * AlloyForge AI - Inventory & Scrap Master Manager
 * Handles local storage persistence, inline editing, categorization, and export/import.
 */

class InventoryManager {
    constructor() {
        this.storageKey = "alloyforge_scrap_master_v2";
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
            version: "2.0",
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

    importFromJSON(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            if (parsed.materials && Array.isArray(parsed.materials)) {
                this.materials = parsed.materials;
                this.saveMaterials();
                return { success: true, count: this.materials.length };
            }
            return { success: false, message: "Invalid JSON structure (missing materials array)." };
        } catch (e) {
            return { success: false, message: e.message };
        }
    }
}

window.InventoryManager = InventoryManager;
