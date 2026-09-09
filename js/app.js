/**
 * AlloyForge AI - Master Application Controller
 * Wires up Reactive UI, Tabs, Preset Loading, Charts, and Modals.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Core Managers
    const invMgr = new InventoryManager();
    const opt = new FoundryChargeOptimizer({
        ...window.ALLOYFORGE_DEFAULT_DATA,
        materials: invMgr.getMaterials()
    });
    const histMgr = new HistoryManager();
    const assistant = new MetallurgyAssistant(opt, invMgr, histMgr);

    let activeCalculation = null;

    // 2. Tab Navigation
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');

            if (targetId === 'tab-inventory') renderInventoryTable();
            if (targetId === 'tab-history') renderHistoryTable();
        });
    });

    // 3. Render Header Statistics
    function updateHeaderStats() {
        const mats = invMgr.getMaterials();
        document.getElementById('stat-mats-count').innerText = `${mats.length} Materials`;
        document.getElementById('stat-heats-count').innerText = `${histMgr.history.length} Logged`;
    }
    updateHeaderStats();

    // 4. Alloy Presets Population
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

        const elements = window.ALLOYFORGE_DEFAULT_DATA.elements;
        const constrainedElements = Object.keys(preset.targets);

        constrainedElements.forEach(el => {
            const [defLow, defHigh] = preset.targets[el];
            const card = document.createElement('div');
            card.className = 'element-card';
            card.innerHTML = `
                <div class="element-header">
                    <span class="element-symbol">${el}</span>
                    <span style="font-size:11px; color:#94a3b8;">Bounds (%)</span>
                </div>
                <div class="bounds-inputs">
                    <div>
                        <span style="font-size:10px; color:#94a3b8;">MIN %</span>
                        <input type="number" step="0.01" class="form-control el-min" data-element="${el}" value="${defLow}">
                    </div>
                    <div>
                        <span style="font-size:10px; color:#94a3b8;">MAX %</span>
                        <input type="number" step="0.01" class="form-control el-max" data-element="${el}" value="${defHigh}">
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    presetSelect.addEventListener('change', (e) => loadPreset(e.target.value));
    loadPreset(presetSelect.value);

    // 5. Run Optimization
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

    // 6. Display Results
    function displayResults(calc) {
        const results = calc.results;
        const resultsSection = document.getElementById('results-section');
        resultsSection.style.display = 'block';

        document.getElementById('results-header-title').innerText = `🏆 Formulated Charge Options for ${calc.alloy} (${calc.batch.toLocaleString()} Kg Batch)`;

        const opt1 = results["Option 1: Lowest Cost"];
        const opt2 = results["Option 2: Balanced Mix"];
        const opt3 = results["Option 3: High Purity Mix"];

        renderOptionCard('card-opt-1', opt1);
        renderOptionCard('card-opt-2', opt2);
        renderOptionCard('card-opt-3', opt3);

        renderOptionDetails(1, opt1, calc);
        renderOptionDetails(2, opt2, calc);
        renderOptionDetails(3, opt3, calc);

        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    function renderOptionCard(containerId, data) {
        const el = document.getElementById(containerId);
        if (data.success) {
            el.innerHTML = `
                <div class="badge-tag">${data.badge}</div>
                <h3 style="font-size:17px; margin:4px 0 6px 0;">${data.title}</h3>
                <div style="font-size:12px; opacity:0.85;">Cost per Kg Melt</div>
                <div class="opt-rate">PKR ${data.cost_per_kg.toFixed(2)}</div>
                <div class="opt-tot">Total Heat: <b>PKR ${data.total_cost.toLocaleString()}</b></div>
                <div style="font-size:11px; margin-top:6px; opacity:0.9;">Tramp Contamination: <b>${data.tramp_index}%</b></div>
            `;
        } else {
            el.innerHTML = `<div style="color:#ef4444; font-weight:bold;">Infeasible Target</div><p style="font-size:12px; margin-top:4px;">${data.message}</p>`;
        }
    }

    function renderOptionDetails(optNum, data, calc) {
        const tbody = document.getElementById(`recipe-tbody-${optNum}`);
        const chemTbody = document.getElementById(`chem-tbody-${optNum}`);

        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444;">Infeasible with current parameters.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.recipe.map(item => `
            <tr>
                <td style="font-weight:600;">${item.Material_Name}</td>
                <td><span style="background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:4px; font-size:11px;">${item.Category}</span></td>
                <td style="text-align:right; font-weight:700; color:#38bdf8;">${item.Weight_Kg.toLocaleString()} kg</td>
                <td style="text-align:right;">${item.Weight_Pct.toFixed(1)}%</td>
                <td style="text-align:right;">PKR ${item.Rate_PKR.toFixed(1)}</td>
                <td style="text-align:right; font-weight:700;">PKR ${item.Cost_PKR.toLocaleString()}</td>
            </tr>
        `).join('');

        chemTbody.innerHTML = data.chemistry_table.map(row => {
            let badgeClass = "status-pass";
            if (row.Status.includes("LIMIT")) badgeClass = "status-limit";
            if (row.Status.includes("SPEC")) badgeClass = "status-fail";

            return `
                <tr>
                    <td style="font-weight:700; color:#38bdf8;">${row.Element}</td>
                    <td>${row.Min_Spec.toFixed(3)}</td>
                    <td>${row.Max_Spec.toFixed(3)}</td>
                    <td style="font-weight:700;">${row.Achieved_Pct.toFixed(3)}%</td>
                    <td><span class="status-badge ${badgeClass}">${row.Status}</span></td>
                </tr>
            `;
        }).join('');

        // Save Button Handler
        document.getElementById(`btn-save-opt-${optNum}`).onclick = () => {
            const notes = document.getElementById(`notes-opt-${optNum}`).value;
            const heatId = histMgr.saveHeat(calc.alloy, calc.batch, data.title, data, notes);
            alert(`✅ Saved heat successfully as ${heatId}!`);
            updateHeaderStats();
        };

        // Print Card Handler
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

    // 7. Scrap Master Tab & Table
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
                <td style="color:#64748b;">${m.ID}</td>
                <td><input type="text" class="form-control inv-edit" data-id="${m.ID}" data-field="Name" value="${m.Name}" style="min-width:180px;"></td>
                <td>
                    <select class="form-control inv-edit" data-id="${m.ID}" data-field="Category" style="min-width:140px;">
                        ${categories.map(c => `<option value="${c}" ${c === m.Category ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </td>
                <td><input type="number" step="10" class="form-control inv-edit" data-id="${m.ID}" data-field="Cost" value="${m.Cost}" style="width:100px; text-align:right;"></td>
                <td><input type="number" step="100" class="form-control inv-edit" data-id="${m.ID}" data-field="Max_Stock_Kg" value="${m.Max_Stock_Kg || ''}" placeholder="∞" style="width:90px; text-align:right;"></td>
                <td><button class="btn btn-danger btn-sm btn-del-mat" data-id="${m.ID}" style="padding:4px 8px; font-size:11px;">🗑️</button></td>
            </tr>
        `).join('');

        document.querySelectorAll('.inv-edit').forEach(inp => {
            inp.addEventListener('change', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                const field = e.target.getAttribute('data-field');
                invMgr.updateField(id, field, e.target.value);
                updateHeaderStats();
            });
        });

        document.querySelectorAll('.btn-del-mat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                if (confirm(`Delete material ID #${id}?`)) {
                    invMgr.deleteMaterial(id);
                    renderInventoryTable();
                    updateHeaderStats();
                }
            });
        });
    }

    document.getElementById('inv-filter-cat').addEventListener('change', renderInventoryTable);
    document.getElementById('inv-search').addEventListener('input', renderInventoryTable);
    document.getElementById('btn-export-csv').addEventListener('click', () => invMgr.exportToCSV());
    document.getElementById('btn-export-json').addEventListener('click', () => invMgr.exportToJSON());
    document.getElementById('btn-reset-db').addEventListener('click', () => {
        if (confirm("Reset Scrap Master to original factory default compositions?")) {
            invMgr.resetToDefaults();
            renderInventoryTable();
            updateHeaderStats();
            alert("Database reset to factory defaults!");
        }
    });

    // 8. Add Material Modal
    const addModal = document.getElementById('modal-add-material');
    document.getElementById('btn-open-add-modal').addEventListener('click', () => {
        const container = document.getElementById('add-mat-elements-grid');
        container.innerHTML = window.ALLOYFORGE_DEFAULT_DATA.elements.map(el => `
            <div>
                <span style="font-size:11px; color:#94a3b8;">${el} %</span>
                <input type="number" step="0.1" class="form-control new-el-comp" data-el="${el}" value="0.0">
            </div>
        `).join('');
        addModal.classList.add('active');
    });

    document.getElementById('btn-close-modal').addEventListener('click', () => addModal.classList.remove('active'));

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
        updateHeaderStats();
    });

    // 9. History Table
    function renderHistoryTable() {
        const tbody = document.getElementById('history-tbody');
        const heats = histMgr.history;

        if (heats.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:20px;">No furnace heats logged yet. Calculate a charge mix and click "Save to Log" to record heats.</td></tr>`;
            return;
        }

        tbody.innerHTML = heats.map(h => `
            <tr>
                <td style="font-weight:700; color:#38bdf8;">${h.heat_id}</td>
                <td>${h.timestamp}</td>
                <td style="font-weight:600;">${h.alloy_name}</td>
                <td style="text-align:right;">${h.batch_size_kg.toLocaleString()} kg</td>
                <td>${h.selected_option}</td>
                <td style="text-align:right; font-weight:700;">PKR ${h.total_cost_pkr.toLocaleString()}</td>
                <td style="text-align:center;">
                    <button class="btn btn-secondary btn-sm btn-print-heat" data-id="${h.heat_id}" style="padding:4px 8px; font-size:11px;">🖨️ Print</button>
                    <button class="btn btn-danger btn-sm btn-del-heat" data-id="${h.heat_id}" style="padding:4px 8px; font-size:11px; margin-left:4px;">🗑️</button>
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
                    updateHeaderStats();
                }
            });
        });
    }

    document.getElementById('btn-export-heats-csv').addEventListener('click', () => histMgr.exportToCSV());

    // 10. AI Assistant Chat
    const chatFeed = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input-text');
    const chatSendBtn = document.getElementById('btn-send-chat');

    function sendChatMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Add user bubble
        const userDiv = document.createElement('div');
        userDiv.className = 'chat-bubble bubble-user';
        userDiv.innerText = text;
        chatFeed.appendChild(userDiv);
        chatInput.value = '';

        // Process with assistant
        setTimeout(() => {
            const resp = assistant.processMessage(text);
            const botDiv = document.createElement('div');
            botDiv.className = 'chat-bubble bubble-assistant';
            botDiv.innerHTML = resp.replyHTML;

            if (resp.type === 'calculation') {
                const loadBtn = document.createElement('button');
                loadBtn.className = 'btn btn-primary btn-sm';
                loadBtn.style.marginTop = '10px';
                loadBtn.innerHTML = '⚡ Load into Optimizer';
                loadBtn.onclick = () => {
                    presetSelect.value = resp.alloy;
                    loadPreset(resp.alloy);
                    document.getElementById('batch-weight').value = resp.batch;
                    document.querySelector('[data-tab="tab-optimizer"]').click();
                    document.getElementById('btn-optimize').click();
                };
                botDiv.appendChild(loadBtn);
            }

            chatFeed.appendChild(botDiv);
            chatFeed.scrollTop = chatFeed.scrollHeight;
        }, 150);
    }

    chatSendBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
});
