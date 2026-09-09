/**
 * AlloyForge AI - Master Application Controller (Bright Engineering Tool Edition)
 * Zero Chat, 100% Engineering Tool Focus.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Core Managers
    const invMgr = new InventoryManager();
    const opt = new FoundryChargeOptimizer({
        ...window.ALLOYFORGE_DEFAULT_DATA,
        materials: invMgr.getMaterials()
    });
    const histMgr = new HistoryManager();

    let activeCalculation = null;

    // 2. Tab Navigation
    const tabBtns = document.querySelectorAll('.nav-tab[data-tab]');
    const viewPanels = document.querySelectorAll('.view-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            viewPanels.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            const targetPanel = document.getElementById(targetId);
            if (targetPanel) targetPanel.classList.add('active');

            if (targetId === 'tab-inventory') renderInventoryTable();
            if (targetId === 'tab-history') renderHistoryTable();
        });
    });

    // 3. Update Header & Summary Stats
    function updateStats() {
        const mats = invMgr.getMaterials();
        document.getElementById('stat-mats-count').innerText = `${mats.length} Items`;
        document.getElementById('stat-heats-count').innerText = `${histMgr.history.length} Logged`;

        // Inventory Metrics Summary
        const invTotalEl = document.getElementById('inv-stat-total');
        if (invTotalEl) {
            invTotalEl.innerText = mats.length;
            const costs = mats.map(m => parseFloat(m.Cost || m.Cost_Per_Kg || 0));
            const avg = costs.length ? (costs.reduce((a, b) => a + b, 0) / costs.length) : 0;
            document.getElementById('inv-stat-avg').innerText = `PKR ${avg.toFixed(1)}`;

            let minMat = mats[0];
            let maxMat = mats[0];
            mats.forEach(m => {
                const c = parseFloat(m.Cost || m.Cost_Per_Kg || 0);
                if (c < parseFloat(minMat.Cost || minMat.Cost_Per_Kg || 0)) minMat = m;
                if (c > parseFloat(maxMat.Cost || maxMat.Cost_Per_Kg || 0)) maxMat = m;
            });

            if (minMat) {
                document.getElementById('inv-stat-min').innerText = `PKR ${minMat.Cost || minMat.Cost_Per_Kg}`;
                document.getElementById('inv-stat-min-name').innerText = minMat.Name.slice(0, 18);
            }
            if (maxMat) {
                document.getElementById('inv-stat-max').innerText = `PKR ${maxMat.Cost || maxMat.Cost_Per_Kg}`;
                document.getElementById('inv-stat-max-name').innerText = maxMat.Name.slice(0, 18);
            }
        }
    }
    updateStats();

    // 4. Alloy Presets Loading
    const presetSelect = document.getElementById('preset-selector');
    const presets = window.ALLOYFORGE_DEFAULT_DATA.presets;

    Object.keys(presets).forEach(name => {
        const optEl = document.createElement('option');
        optEl.value = name;
        optEl.innerText = name;
        presetSelect.appendChild(optEl);
    });

    function loadPreset(presetName) {
        const preset = presets[presetName];
        if (!preset) return;

        document.getElementById('preset-desc').innerText = `ℹ️ ${preset.desc}`;
        const container = document.getElementById('element-bounds-container');
        container.innerHTML = '';

        const constrainedElements = Object.keys(preset.targets);

        constrainedElements.forEach(el => {
            const [defLow, defHigh] = preset.targets[el];
            const box = document.createElement('div');
            box.className = 'elem-bound-box';
            box.innerHTML = `
                <div class="elem-bound-header">
                    <span class="elem-symbol">${el}</span>
                    <span class="elem-label">Spec Limits (%)</span>
                </div>
                <div class="elem-inputs-row">
                    <div>
                        <span>MIN %</span>
                        <input type="number" step="0.01" class="input-control el-min" data-element="${el}" value="${defLow}">
                    </div>
                    <div>
                        <span>MAX %</span>
                        <input type="number" step="0.01" class="input-control el-max" data-element="${el}" value="${defHigh}">
                    </div>
                </div>
            `;
            container.appendChild(box);
        });
    }

    presetSelect.addEventListener('change', (e) => loadPreset(e.target.value));
    loadPreset(presetSelect.value);

    // 5. Optimization Execution
    document.getElementById('btn-optimize').addEventListener('click', () => {
        const selectedPresetName = presetSelect.value;
        const presetData = presets[selectedPresetName];
        const batchWeight = parseFloat(document.getElementById('batch-weight').value) || 1000.0;
        const useRecovery = document.getElementById('toggle-recovery').checked;
        const useTrampGuard = document.getElementById('toggle-tramp').checked;
        const useStockLimits = document.getElementById('toggle-stock').checked;

        const targets = {};
        const minInputs = document.querySelectorAll('.el-min');
        const maxInputs = document.querySelectorAll('.el-max');

        minInputs.forEach((minInp, idx) => {
            const el = minInp.getAttribute('data-element');
            const low = parseFloat(minInp.value) || 0.0;
            const high = parseFloat(maxInputs[idx].value) || 0.0;
            targets[el] = [low, high];
        });

        opt.setMaterials(invMgr.getMaterials());

        const results = opt.solveAllOptions({
            targets: targets,
            batchSize: batchWeight,
            alloyFamily: useTrampGuard ? (presetData?.family || "stainless") : null,
            useRecovery: useRecovery,
            useTrampGuard: useTrampGuard,
            customStockLimits: useStockLimits ? {} : {}
        });

        activeCalculation = {
            alloy: selectedPresetName,
            batch: batchWeight,
            targets: targets,
            results: results,
            timestamp: new Date().toLocaleString()
        };

        displayResults(activeCalculation);
    });

    // 6. Display 3 Formulation Options
    function displayResults(calc) {
        const results = calc.results;
        const resultsSection = document.getElementById('results-section');
        resultsSection.style.display = 'block';

        document.getElementById('results-header-title').innerText = `🏆 Formulated Charge Options for ${calc.alloy} (${calc.batch.toLocaleString()} Kg Batch)`;

        const opt1 = results["Option 1: Lowest Cost"];
        const opt2 = results["Option 2: Balanced Mix"];
        const opt3 = results["Option 3: High Purity Mix"];

        renderOptionCard('card-opt-1', opt1, 'tag-1', 'rate-1');
        renderOptionCard('card-opt-2', opt2, 'tag-2', 'rate-2');
        renderOptionCard('card-opt-3', opt3, 'tag-3', 'rate-3');

        renderOptionDetails(1, opt1, calc);
        renderOptionDetails(2, opt2, calc);
        renderOptionDetails(3, opt3, calc);

        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    function renderOptionCard(containerId, data, tagClass, rateClass) {
        const el = document.getElementById(containerId);
        if (data.success) {
            el.innerHTML = `
                <div class="opt-badge-tag ${tagClass}">${data.badge}</div>
                <div class="opt-title">${data.title}</div>
                <div class="opt-desc-text">${data.description}</div>
                <div class="opt-price-block">
                    <div class="opt-sub-label">Unit Melt Cost</div>
                    <div class="opt-main-rate ${rateClass}">PKR ${data.cost_per_kg.toFixed(2)}<span style="font-size:14px; font-weight:normal; color:var(--text-muted);"> /Kg</span></div>
                    <div class="opt-total-heat">Total Heat: <b>PKR ${data.total_cost.toLocaleString()}</b></div>
                </div>
                <div class="opt-meta-strip">
                    <span>Tramp Index: <b>${data.tramp_index}%</b></span>
                    <span>Materials: <b>${data.recipe.length} Scraps</b></span>
                </div>
            `;
        } else {
            el.innerHTML = `
                <div class="opt-badge-tag" style="background:#fee2e2; color:#b91c1c;">Infeasible</div>
                <div class="opt-title">${data.title}</div>
                <p style="font-size:12px; color:#b91c1c; margin-top:8px;">${data.message}</p>
            `;
        }
    }

    function renderOptionDetails(optNum, data, calc) {
        const tbody = document.getElementById(`recipe-tbody-${optNum}`);
        const chemTbody = document.getElementById(`chem-tbody-${optNum}`);

        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger); padding:16px;">Infeasible with current parameters.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.recipe.map(item => `
            <tr>
                <td style="font-weight:700;">${item.Material_Name}</td>
                <td><span style="background:var(--bg-subtle); border:1px solid var(--border); padding:2px 6px; border-radius:4px; font-size:11px;">${item.Category}</span></td>
                <td style="text-align:right; font-weight:800; color:var(--brand-primary);">${item.Weight_Kg.toLocaleString()} kg</td>
                <td style="text-align:right; font-weight:600;">${item.Weight_Pct.toFixed(1)}%</td>
                <td style="text-align:right;">PKR ${item.Rate_PKR.toFixed(1)}</td>
                <td style="text-align:right; font-weight:700;">PKR ${item.Cost_PKR.toLocaleString()}</td>
            </tr>
        `).join('');

        chemTbody.innerHTML = data.chemistry_table.map(row => {
            let pillClass = "pill-pass";
            if (row.Status.includes("LIMIT")) pillClass = "pill-limit";
            if (row.Status.includes("SPEC")) pillClass = "pill-fail";

            return `
                <tr>
                    <td style="font-weight:700; color:var(--brand-primary);">${row.Element}</td>
                    <td>${row.Min_Spec.toFixed(3)}</td>
                    <td>${row.Max_Spec.toFixed(3)}</td>
                    <td style="font-weight:700;">${row.Achieved_Pct.toFixed(3)}%</td>
                    <td><span class="status-pill ${pillClass}">${row.Status}</span></td>
                </tr>
            `;
        }).join('');

        // Save Heat Handler
        document.getElementById(`btn-save-opt-${optNum}`).onclick = () => {
            const notes = document.getElementById(`notes-opt-${optNum}`).value;
            const heatId = histMgr.saveHeat(calc.alloy, calc.batch, data.title, data, notes);
            alert(`✅ Saved heat successfully as ${heatId}!`);
            updateStats();
        };

        // Print Charge Card Handler
        document.getElementById(`btn-print-opt-${optNum}`).onclick = () => {
            const tempHeat = {
                heat_id: "PREVIEW-HT",
                timestamp: new Date().toLocaleString(),
                alloy_name: calc.alloy,
                batch_size_kg: calc.batch,
                selected_option: data.title,
                total_cost_pkr: data.total_cost,
                cost_per_kg: data.cost_per_kg,
                recipe: data.recipe,
                chemistry: data.chemistry,
                notes: document.getElementById(`notes-opt-${optNum}`).value
            };
            const printHtml = histMgr.generateBatchCardHTML(tempHeat);
            const w = window.open('', '_blank');
            w.document.write(printHtml);
            w.document.close();
            w.print();
        };
    }

    // 7. Scrap Master Inventory Rendering & Inline Editing
    function renderInventoryTable() {
        const tbody = document.getElementById('inventory-tbody');
        const filterCat = document.getElementById('inv-filter-cat').value;
        const searchQuery = document.getElementById('inv-search').value.toLowerCase().trim();

        const categories = invMgr.getCategories();
        const catSelect = document.getElementById('inv-filter-cat');
        if (catSelect.children.length === 1) {
            categories.forEach(cat => {
                const optEl = document.createElement('option');
                optEl.value = cat;
                optEl.innerText = cat;
                catSelect.appendChild(optEl);
            });
        }

        let materials = invMgr.getMaterials();
        if (filterCat !== 'all') materials = materials.filter(m => m.Category === filterCat);
        if (searchQuery) materials = materials.filter(m => (m.Name || '').toLowerCase().includes(searchQuery));

        tbody.innerHTML = materials.map(m => `
            <tr>
                <td style="color:var(--text-muted); font-weight:bold;">${m.ID}</td>
                <td><input type="text" class="input-control inv-edit" data-id="${m.ID}" data-field="Name" value="${m.Name}" style="min-width:180px;"></td>
                <td>
                    <select class="input-control inv-edit" data-id="${m.ID}" data-field="Category" style="min-width:140px;">
                        ${categories.map(c => `<option value="${c}" ${c === m.Category ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </td>
                <td><input type="number" step="10" class="input-control inv-edit" data-id="${m.ID}" data-field="Cost" value="${m.Cost}" style="width:110px; text-align:right; font-weight:bold;"></td>
                <td><input type="number" step="100" class="input-control inv-edit" data-id="${m.ID}" data-field="Max_Stock_Kg" value="${m.Max_Stock_Kg || ''}" placeholder="Unlimited" style="width:100px; text-align:right;"></td>
                <td style="text-align:center;"><button class="btn-action btn-outline-action btn-del-mat" data-id="${m.ID}" style="padding:4px 8px; color:var(--danger);" title="Delete Material">🗑️</button></td>
            </tr>
        `).join('');

        document.querySelectorAll('.inv-edit').forEach(inp => {
            inp.addEventListener('change', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                const field = e.target.getAttribute('data-field');
                invMgr.updateField(id, field, e.target.value);
                updateStats();
            });
        });

        document.querySelectorAll('.btn-del-mat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                if (confirm(`Delete material ID #${id}?`)) {
                    invMgr.deleteMaterial(id);
                    renderInventoryTable();
                    updateStats();
                }
            });
        });

        updateStats();
    }

    document.getElementById('inv-filter-cat').addEventListener('change', renderInventoryTable);
    document.getElementById('inv-search').addEventListener('input', renderInventoryTable);
    document.getElementById('btn-export-csv').addEventListener('click', () => invMgr.exportToCSV());
    document.getElementById('btn-export-json').addEventListener('click', () => invMgr.exportToJSON());
    document.getElementById('btn-reset-db').addEventListener('click', () => {
        if (confirm("Reset Scrap Master to original factory default compositions?")) {
            invMgr.resetToDefaults();
            renderInventoryTable();
            updateStats();
            alert("Database reset to factory defaults!");
        }
    });

    // 8. Add Material Modal
    const addModal = document.getElementById('modal-add-material');
    document.getElementById('btn-open-add-modal').addEventListener('click', () => {
        const container = document.getElementById('add-mat-elements-grid');
        container.innerHTML = window.ALLOYFORGE_DEFAULT_DATA.elements.map(el => `
            <div>
                <span style="font-size:10px; color:var(--text-muted); font-weight:700;">${el} %</span>
                <input type="number" step="0.1" class="input-control new-el-comp" data-el="${el}" value="0.0">
            </div>
        `).join('');
        addModal.classList.add('active');
    });

    document.getElementById('btn-close-modal').addEventListener('click', () => addModal.classList.remove('active'));
    document.getElementById('btn-cancel-modal').addEventListener('click', () => addModal.classList.remove('active'));

    document.getElementById('btn-save-new-material').addEventListener('click', () => {
        const name = document.getElementById('new-mat-name').value.trim();
        const cost = parseFloat(document.getElementById('new-mat-cost').value) || 0;
        const cat = document.getElementById('new-mat-cat').value;
        const stock = document.getElementById('new-mat-stock').value;

        if (!name) {
            alert("Please enter a valid material name");
            return;
        }

        const comp = {};
        document.querySelectorAll('.new-el-comp').forEach(inp => {
            comp[inp.getAttribute('data-el')] = parseFloat(inp.value) || 0.0;
        });

        const newId = invMgr.addMaterial(name, cost, cat, comp, stock);
        alert(`✅ Material added successfully as ID #${newId}!`);
        addModal.classList.remove('active');
        renderInventoryTable();
        updateStats();
    });

    // 9. History Table
    function renderHistoryTable() {
        const tbody = document.getElementById('history-tbody');
        const heats = histMgr.history;

        if (heats.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:24px;">No furnace heats logged yet. Formulate a charge in the Optimizer tab and click "Save to Log" to record heats.</td></tr>`;
            return;
        }

        tbody.innerHTML = heats.map(h => `
            <tr>
                <td style="font-weight:700; color:var(--brand-primary);">${h.heat_id}</td>
                <td style="color:var(--text-secondary);">${h.timestamp}</td>
                <td style="font-weight:700;">${h.alloy_name}</td>
                <td style="text-align:right; font-weight:600;">${h.batch_size_kg.toLocaleString()} kg</td>
                <td><span class="status-pill pill-pass">${h.selected_option.split(':')[0]}</span></td>
                <td style="text-align:right;">PKR ${h.cost_per_kg.toFixed(2)}</td>
                <td style="text-align:right; font-weight:800; color:var(--text-primary);">PKR ${h.total_cost_pkr.toLocaleString()}</td>
                <td style="text-align:center;">
                    <button class="btn-action btn-outline-action btn-print-heat" data-id="${h.heat_id}" style="padding:3px 8px; font-size:11px;">🖨️ Card</button>
                    <button class="btn-action btn-outline-action btn-del-heat" data-id="${h.heat_id}" style="padding:3px 8px; font-size:11px; color:var(--danger); margin-left:4px;">🗑️</button>
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.btn-print-heat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const heat = histMgr.getHeat(id);
                if (heat) {
                    const printHtml = histMgr.generateBatchCardHTML(heat);
                    const w = window.open('', '_blank');
                    w.document.write(printHtml);
                    w.document.close();
                    w.print();
                }
            });
        });

        document.querySelectorAll('.btn-del-heat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                if (confirm(`Delete heat record ${id}?`)) {
                    histMgr.deleteHeat(id);
                    renderHistoryTable();
                    updateStats();
                }
            });
        });
    }

    document.getElementById('btn-export-heats-csv').addEventListener('click', () => histMgr.exportToCSV());
});
