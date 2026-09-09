/**
 * AlloyForge AI - Metallurgy Conversational Copilot
 * Natural Language Query Parser & Charge Formulation Assistant.
 */

class MetallurgyAssistant {
    constructor(optimizer, inventoryMgr, historyMgr) {
        this.opt = optimizer;
        this.inv = inventoryMgr;
        this.hist = historyMgr;
    }

    processMessage(userText) {
        const text = userText.toLowerCase().trim();
        const presets = window.ALLOYFORGE_DEFAULT_DATA.presets;
        const materials = this.inv.getMaterials();

        // 1. Check for Batch Weight (e.g. "1000kg", "500 kg", "2 ton", "2000")
        let batchWeight = 1000.0;
        const tonMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:ton|tonne|tons)/);
        const kgMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilo)/);
        const numMatch = text.match(/\b(\d{3,5})\b/);

        if (tonMatch) {
            batchWeight = parseFloat(tonMatch[1]) * 1000.0;
        } else if (kgMatch) {
            batchWeight = parseFloat(kgMatch[1]);
        } else if (numMatch) {
            batchWeight = parseFloat(numMatch[1]);
        }

        // 2. Identify Target Alloy Preset
        let detectedPreset = null;
        let detectedKey = null;

        for (const [pName, pData] of Object.entries(presets)) {
            const cleanName = pName.toLowerCase();
            if (
                (cleanName.includes("304") && text.includes("304")) ||
                (cleanName.includes("316") && text.includes("316")) ||
                (cleanName.includes("201") && text.includes("201")) ||
                (cleanName.includes("309") && text.includes("309")) ||
                (cleanName.includes("310") && text.includes("310")) ||
                (cleanName.includes("420") && text.includes("420")) ||
                (cleanName.includes("430") && text.includes("430")) ||
                (cleanName.includes("grey") && (text.includes("grey") || text.includes("fg 200") || text.includes("fg 250") || text.includes("c.i"))) ||
                (cleanName.includes("ductile") && (text.includes("ductile") || text.includes("sg iron") || text.includes("ggg"))) ||
                (cleanName.includes("high chrome") && text.includes("high chrome")) ||
                (cleanName.includes("mild steel") && (text.includes("mild steel") || text.includes("wcb") || text.includes("m.s"))) ||
                (cleanName.includes("hadfield") && (text.includes("hadfield") || text.includes("manganese steel"))) ||
                (cleanName.includes("h-13") && (text.includes("h13") || text.includes("h-13") || text.includes("die steel"))) ||
                (cleanName.includes("bronze 555") && (text.includes("555") || text.includes("gunmetal") || text.includes("lg2"))) ||
                (cleanName.includes("tin bronze") && (text.includes("tin bronze") || text.includes("gear bronze")))
            ) {
                detectedPreset = pData;
                detectedKey = pName;
                break;
            }
        }

        // If alloy detected, formulate charge
        if (detectedPreset) {
            this.opt.setMaterials(this.inv.getMaterials());
            const results = this.opt.solveAllOptions({
                targets: detectedPreset.targets,
                batchSize: batchWeight,
                alloyFamily: detectedPreset.family,
                useRecovery: true,
                useTrampGuard: true
            });

            const opt1 = results["Option 1: Lowest Cost"];
            const opt2 = results["Option 2: Balanced Mix"];
            const opt3 = results["Option 3: High Purity Mix"];

            if (opt1.success) {
                return {
                    type: "calculation",
                    alloy: detectedKey,
                    batch: batchWeight,
                    targets: detectedPreset.targets,
                    results: results,
                    replyHTML: `
                        <p>⚡ <b>Formulated 3 Charge Mixes for ${detectedKey} (${batchWeight.toLocaleString()} Kg Batch)</b></p>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 10px 0;">
                            <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; padding: 10px; border-radius: 8px;">
                                <div style="font-size: 11px; font-weight: bold; color: #10b981;">🔥 OPTION 1: LOWEST COST</div>
                                <div style="font-size: 18px; font-weight: 800;">PKR ${opt1.cost_per_kg.toFixed(2)}/Kg</div>
                                <div style="font-size: 12px; color: #94a3b8;">Total: PKR ${opt1.total_cost.toLocaleString()}</div>
                                <div style="font-size: 11px; margin-top: 4px;">Top: ${opt1.recipe[0]?.Material_Name} (${opt1.recipe[0]?.Weight_Kg}kg)</div>
                            </div>
                            <div style="background: rgba(59, 130, 246, 0.15); border: 1px solid #3b82f6; padding: 10px; border-radius: 8px;">
                                <div style="font-size: 11px; font-weight: bold; color: #38bdf8;">⚖️ OPTION 2: BALANCED</div>
                                <div style="font-size: 18px; font-weight: 800;">PKR ${opt2.cost_per_kg.toFixed(2)}/Kg</div>
                                <div style="font-size: 12px; color: #94a3b8;">Total: PKR ${opt2.total_cost.toLocaleString()}</div>
                                <div style="font-size: 11px; margin-top: 4px;">Top: ${opt2.recipe[0]?.Material_Name} (${opt2.recipe[0]?.Weight_Kg}kg)</div>
                            </div>
                            <div style="background: rgba(168, 85, 247, 0.15); border: 1px solid #a855f7; padding: 10px; border-radius: 8px;">
                                <div style="font-size: 11px; font-weight: bold; color: #c084fc;">💎 OPTION 3: CLEAN PURITY</div>
                                <div style="font-size: 18px; font-weight: 800;">PKR ${opt3.cost_per_kg.toFixed(2)}/Kg</div>
                                <div style="font-size: 12px; color: #94a3b8;">Total: PKR ${opt3.total_cost.toLocaleString()}</div>
                                <div style="font-size: 11px; margin-top: 4px;">Top: ${opt3.recipe[0]?.Material_Name} (${opt3.recipe[0]?.Weight_Kg}kg)</div>
                            </div>
                        </div>
                        <p style="font-size: 12px; color: #94a3b8;">💡 <i>Click "Load into Optimizer" to view full scale weights, spectrometry tables, and print shop-floor cards.</i></p>
                    `
                };
            }
        }

        // 3. Price inquiry (e.g. "price of nickel", "cost ferro chrome", "show scrap prices")
        if (text.includes("price") || text.includes("cost") || text.includes("rate")) {
            const matchedMats = materials.filter(m => {
                const n = (m.Name || '').toLowerCase();
                return text.split(' ').some(w => w.length > 2 && n.includes(w));
            });

            if (matchedMats.length > 0) {
                const listItems = matchedMats.slice(0, 8).map(m => `
                    <li><b>${m.Name}</b> (${m.Category}): <span style="color: #38bdf8; font-weight: bold;">PKR ${m.Cost || m.Cost_Per_Kg}/Kg</span></li>
                `).join('');

                return {
                    type: "info",
                    replyHTML: `
                        <p>📦 <b>Found ${matchedMats.length} matching scrap materials in catalog:</b></p>
                        <ul style="padding-left: 20px; line-height: 1.6; font-size: 13px;">${listItems}</ul>
                        <p style="font-size: 12px; color: #94a3b8;">You can edit any price anytime in the <b>Raw Material & Scrap Master</b> tab.</p>
                    `
                };
            }
        }

        // 4. Default Assistant Guidance
        return {
            type: "general",
            replyHTML: `
                <p>🤖 <b>AlloyForge AI Metallurgy Copilot</b> at your service!</p>
                <p>I can instantly optimize furnace charges and inspect your raw material inventory. Try asking me:</p>
                <ul style="padding-left: 20px; line-height: 1.6; font-size: 12.5px; color: #cbd5e1;">
                    <li><i>"Optimize 1000 kg batch of SS 304"</i></li>
                    <li><i>"Calculate Bronze 555 2000kg"</i></li>
                    <li><i>"What is the charge mix for Grey Cast Iron FG 250 500kg?"</i></li>
                    <li><i>"Show prices for Ferro Alloys"</i></li>
                    <li><i>"Check price of Nickel scrap"</i></li>
                </ul>
            `
        };
    }
}

window.MetallurgyAssistant = MetallurgyAssistant;
