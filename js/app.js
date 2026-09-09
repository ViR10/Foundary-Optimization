/**
 * AlloyForge - Master UI Controller
 * With Direct Excel (.xlsx) Import/Export, "Balance" and "Tracer" logic, and Dynamic Sliders.
 */

const ELEMENT_NAMES = {
    'C': 'Carbon', 'Si': 'Silicon', 'Mn': 'Manganese', 'Cr': 'Chromium',
    'Ni': 'Nickel', 'Mo': 'Molybdenum', 'Cu': 'Copper', 'Fe': 'Iron',
    'Al': 'Aluminium', 'Ti': 'Titanium', 'Mg': 'Magnesium', 'P': 'Phosphorus',
    'S': 'Sulfur', 'Pb': 'Lead', 'Zn': 'Zinc', 'Sn': 'Tin',
    'V': 'Vanadium', 'Nb': 'Niobium', 'Ca': 'Calcium', 'Sb': 'Antimony'
};

document.addEventListener('DOMContentLoaded', () => {
    const invMgr = new InventoryManager();
    const opt = new FoundryChargeOptimizer({
        ...window.ALLOYFORGE_DEFAULT_DATA,
        materials: invMgr.getMaterials()
    });
    const histMgr = new HistoryManager();

    let activeCalculation = null;
    let currentTargets = {};
    let editingMatId = null;

    // 1. Navigation Tabs
    const navLinks = document.querySelectorAll('.nav-link');
    const tabViews = document.querySelectorAll('.tab-view');

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.forEach(l => l.classList.remove('active'));
            tabViews.forEach(v => v.classList.remove('active'));
            link.classList.add('active');
            const targetId = link.getAttribute('data-tab');
            const view = document.getElementById(targetId);
            if (view) view.classList.add('active');

            if (targetId === 'tab-inventory') renderInventoryTable();
            if (targetId === 'tab-history') renderHistoryTable();
        });
    });

    // 2. Alloy Presets Population
    const presetSelect = document.getElementById('preset-selector');
    const presets = window.ALLOYFORGE_DEFAULT_DATA.presets;

    Object.keys(presets).forEach(name => {
        const optEl = document.createElement('option');
        optEl.value = name;
        optEl.innerText = name;
        presetSelect.appendChild(optEl);
    });

    // 3. Load Preset Targets
    function loadPreset(presetName) {
        const preset = presets[presetName];
        if (!preset) return;

        document.getElementById('preset-desc').innerText = preset.desc;
        currentTargets = {};

        Object.entries(preset.targets).forEach(([el, [low, high]]) => {
            currentTargets[el] = [parseFloat(low), parseFloat(high)];
        });

        renderElementMatrix();
        populateAddElementDropdown();
    }

    presetSelect.addEventListener('change', (e) => loadPreset(e.target.value));

    // 4. Dynamic Element Matrix with Sliders
    function getSliderMax(el, currentMaxVal) {
        let baseMax = 20.0;
        if (['C', 'P', 'S', 'Mg', 'Ti', 'Nb', 'V', 'Ca', 'Sb'].includes(el)) {
            baseMax = 4.0;
        } else if (['Cr', 'Ni', 'Cu', 'Fe'].includes(el)) {
            baseMax = 100.0;
        }
        return Math.max(baseMax, Math.ceil(currentMaxVal * 1.25));
    }

    function getSliderStep(el) {
        if (['C', 'P', 'S', 'Mg', 'Ti', 'Nb', 'V', 'Ca', 'Sb'].includes(el)) return 0.005;
        if (['Cr', 'Ni', 'Cu', 'Fe'].includes(el)) return 0.1;
        return 0.02;
    }

    function renderElementMatrix() {
        const grid = document.getElementById('elements-slider-grid');
        grid.innerHTML = '';

        Object.entries(currentTargets).forEach(([el, [low, high]]) => {
            const elName = ELEMENT_NAMES[el] || el;
            const sliderMax = getSliderMax(el, high);
            const sliderStep = getSliderStep(el);

            const card = document.createElement('div');
            card.className = 'element-card';
            card.id = `elem-card-${el}`;
            card.innerHTML = `
                <div class="elem-card-top">
                    <div class="elem-badge-group">
                        <span class="elem-symbol">${el}</span>
                        <span class="elem-fullname">${elName}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="elem-range-readout" id="readout-${el}">${low.toFixed(2)}% – ${high.toFixed(2)}%</span>
                        <button class="btn-remove-elem" data-element="${el}" title="Remove this element">✕</button>
                    </div>
                </div>

                <!-- Min Slider -->
                <div class="slider-control-row">
                    <div class="slider-label-bar">
                        <span>MINIMUM LIMIT</span>
                        <span id="label-min-${el}">${low.toFixed(3)}%</span>
                    </div>
                    <div class="slider-input-combo">
                        <input type="range" class="range-slider slider-min" data-element="${el}" min="0" max="${sliderMax}" step="${sliderStep}" value="${low}">
                        <input type="number" class="num-stepper num-min" data-element="${el}" min="0" max="${sliderMax}" step="${sliderStep}" value="${low.toFixed(3)}">
                    </div>
                </div>

                <!-- Max Slider -->
                <div class="slider-control-row">
                    <div class="slider-label-bar">
                        <span>MAXIMUM LIMIT</span>
                        <span id="label-max-${el}">${high.toFixed(3)}%</span>
                    </div>
                    <div class="slider-input-combo">
                        <input type="range" class="range-slider slider-max" data-element="${el}" min="0" max="${sliderMax}" step="${sliderStep}" value="${high}">
                        <input type="number" class="num-stepper num-max" data-element="${el}" min="0" max="${sliderMax}" step="${sliderStep}" value="${high.toFixed(3)}">
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });

        attachSliderListeners();
        populateAddElementDropdown();
    }

    function attachSliderListeners() {
        document.querySelectorAll('.btn-remove-elem').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const el = e.target.getAttribute('data-element');
                delete currentTargets[el];
                renderElementMatrix();
            });
        });

        document.querySelectorAll('.slider-min').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const el = e.target.getAttribute('data-element');
                let val = parseFloat(e.target.value) || 0.0;
                let currentMax = currentTargets[el][1];
                if (val > currentMax) {
                    val = currentMax;
                    e.target.value = val;
                }
                currentTargets[el][0] = val;
                updateElementUI(el);
            });
        });

        document.querySelectorAll('.num-min').forEach(inp => {
            inp.addEventListener('change', (e) => {
                const el = e.target.getAttribute('data-element');
                let val = parseFloat(e.target.value) || 0.0;
                let currentMax = currentTargets[el][1];
                if (val > currentMax) val = currentMax;
                if (val < 0) val = 0;
                currentTargets[el][0] = val;
                updateElementUI(el);
            });
        });

        document.querySelectorAll('.slider-max').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const el = e.target.getAttribute('data-element');
                let val = parseFloat(e.target.value) || 0.0;
                let currentMin = currentTargets[el][0];
                if (val < currentMin) {
                    val = currentMin;
                    e.target.value = val;
                }
                currentTargets[el][1] = val;
                updateElementUI(el);
            });
        });

        document.querySelectorAll('.num-max').forEach(inp => {
            inp.addEventListener('change', (e) => {
                const el = e.target.getAttribute('data-element');
                let val = parseFloat(e.target.value) || 0.0;
                let currentMin = currentTargets[el][0];
                if (val < currentMin) val = currentMin;
                currentTargets[el][1] = val;
                updateElementUI(el);
            });
        });
    }

    function updateElementUI(el) {
        const [low, high] = currentTargets[el];
        const card = document.getElementById(`elem-card-${el}`);
        if (!card) return;

        card.querySelector('.slider-min').value = low;
        card.querySelector('.num-min').value = low.toFixed(3);
        card.querySelector(`#label-min-${el}`).innerText = `${low.toFixed(3)}%`;

        card.querySelector('.slider-max').value = high;
        card.querySelector('.num-max').value = high.toFixed(3);
        card.querySelector(`#label-max-${el}`).innerText = `${high.toFixed(3)}%`;

        card.querySelector(`#readout-${el}`).innerText = `${low.toFixed(2)}% – ${high.toFixed(2)}%`;
    }

    function populateAddElementDropdown() {
        const select = document.getElementById('select-add-element');
        select.innerHTML = '<option value="">+ Add Constrained Element</option>';

        const allElements = window.ALLOYFORGE_DEFAULT_DATA.elements;
        const unused = allElements.filter(el => !currentTargets[el]);

        unused.forEach(el => {
            const optEl = document.createElement('option');
            optEl.value = el;
            optEl.innerText = `${el} — ${ELEMENT_NAMES[el] || el}`;
            select.appendChild(optEl);
        });
    }

    document.getElementById('select-add-element').addEventListener('change', (e) => {
        const el = e.target.value;
        if (!el) return;

        let defHigh = 1.0;
        if (['Cr', 'Ni', 'Cu', 'Fe'].includes(el)) defHigh = 10.0;
        if (['C', 'P', 'S', 'Mg'].includes(el)) defHigh = 0.05;

        currentTargets[el] = [0.0, defHigh];
        renderElementMatrix();
    });

    loadPreset(presetSelect.value);

    // 5. Optimization Execution
    document.getElementById('btn-optimize').addEventListener('click', () => {
        const selectedPresetName = presetSelect.value;
        const presetData = presets[selectedPresetName];
        const batchWeight = parseFloat(document.getElementById('batch-weight').value) || 1000.0;
        const useRecovery = document.getElementById('toggle-recovery').checked;
        const useTrampGuard = document.getElementById('toggle-tramp').checked;
        const useStockLimits = document.getElementById('toggle-stock').checked;

        if (Object.keys(currentTargets).length === 0) {
            alert("Please constrain at least one chemical element.");
            return;
        }

        opt.setMaterials(invMgr.getMaterials());

        const results = opt.solveAllOptions({
            targets: currentTargets,
            batchSize: batchWeight,
            alloyFamily: useTrampGuard ? (presetData?.family || "stainless") : null,
            useRecovery: useRecovery,
            useTrampGuard: useTrampGuard,
            customStockLimits: useStockLimits ? {} : {}
        });

        activeCalculation = {
            alloy: selectedPresetName,
            batch: batchWeight,
            targets: currentTargets,
            results: results,
            timestamp: new Date().toLocaleString()
        };

        displayResults(activeCalculation);
    });

    function displayResults(calc) {
        const results = calc.results;
        const section = document.getElementById('results-section');
        section.style.display = 'block';

        document.getElementById('results-header-title').innerText = `Formulated Mixes for ${calc.alloy} (${calc.batch.toLocaleString()} Kg)`;

        const opt1 = results["Option 1: Lowest Cost"];
        const opt2 = results["Option 2: Balanced Mix"];
        const opt3 = results["Option 3: High Purity Mix"];

        renderOptionCard('card-opt-1', opt1, 'badge-1', 'rate-val-1');
        renderOptionCard('card-opt-2', opt2, 'badge-2', 'rate-val-2');
        renderOptionCard('card-opt-3', opt3, 'badge-3', 'rate-val-3');

        renderOptionDetails(1, opt1, calc);
        renderOptionDetails(2, opt2, calc);
        renderOptionDetails(3, opt3, calc);

        section.scrollIntoView({ behavior: 'smooth' });
    }

    function renderOptionCard(containerId, data, badgeClass, rateValClass) {
        const el = document.getElementById(containerId);
        if (data.success) {
            el.innerHTML = `
                <div class="tier-badge ${badgeClass}">${data.badge}</div>
                <div class="tier-title">${data.title}</div>
                <div class="tier-desc">${data.description}</div>
                <div class="tier-rate-box">
                    <div class="tier-rate-label">Rate / Kg</div>
                    <div class="tier-rate-val ${rateValClass}">PKR ${data.cost_per_kg.toFixed(2)}</div>
                    <div class="tier-total-val">Total: PKR ${data.total_cost.toLocaleString()}</div>
                </div>
                <div class="tier-meta">
                    <span>Tramp Index: <b>${data.tramp_index}%</b></span>
                    <span>Materials: <b>${data.recipe.length} Scraps</b></span>
                </div>
            `;
        } else {
            el.innerHTML = `
                <div class="tier-badge" style="background:#fee2e2; color:#b91c1c;">Infeasible</div>
                <div class="tier-title">${data.title}</div>
                <p style="font-size:12px; color:#b91c1c; margin-top:8px;">${data.message}</p>
            `;
        }
    }

    function renderOptionDetails(optNum, data, calc) {
        const tbody = document.getElementById(`recipe-tbody-${optNum}`);
        const chemTbody = document.getElementById(`chem-tbody-${optNum}`);

        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--danger); padding:12px;">Infeasible target.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.recipe.map(item => `
            <tr>
                <td style="font-weight:600;">${item.Material_Name}</td>
                <td><span style="font-size:11px; color:var(--text-muted);">${item.Category}</span></td>
                <td style="text-align:right; font-weight:700; color:var(--primary);">${item.Weight_Kg.toLocaleString()} kg</td>
                <td style="text-align:right;">${item.Weight_Pct.toFixed(1)}%</td>
                <td style="text-align:right; font-weight:600;">PKR ${item.Cost_PKR.toLocaleString()}</td>
            </tr>
        `).join('');

        chemTbody.innerHTML = data.chemistry_table.map(row => {
            let tagClass = "tag-pass";
            if (row.Status.includes("LIMIT")) tagClass = "tag-limit";
            if (row.Status.includes("SPEC")) tagClass = "tag-fail";

            return `
                <tr>
                    <td style="font-weight:600; color:var(--primary);">${row.Element}</td>
                    <td>${row.Min_Spec.toFixed(3)}</td>
                    <td>${row.Max_Spec.toFixed(3)}</td>
                    <td style="font-weight:600;">${row.Achieved_Pct.toFixed(3)}%</td>
                    <td><span class="status-tag ${tagClass}">${row.Status}</span></td>
                </tr>
            `;
        }).join('');

        document.getElementById(`btn-save-opt-${optNum}`).onclick = () => {
            const notes = document.getElementById(`notes-opt-${optNum}`).value;
            const heatId = histMgr.saveHeat(calc.alloy, calc.batch, data.title, data, notes);
            alert(`✅ Saved heat as ${heatId}!`);
        };

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

    // 6. Scrap Master: Table, Inline Editing & Excel Import/Export
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

        tbody.innerHTML = materials.map((m, idx) => {
            // Main elements preview string (e.g. "Cr: 18%, Ni: 8%")
            const compParts = [];
            window.ALLOYFORGE_DEFAULT_DATA.elements.forEach(el => {
                const v = parseFloat(m[el] || 0);
                if (v > 0.5) compParts.push(`${el}:${v.toFixed(1)}%`);
            });
            const compStr = compParts.slice(0, 3).join(', ') + (compParts.length > 3 ? '...' : '');

            return `
            <tr>
                <td style="color:var(--text-muted);">${m.ID || idx + 1}</td>
                <td><input type="text" class="form-input inv-edit" data-id="${m.ID}" data-field="Name" value="${m.Name}" style="padding:4px 8px; font-size:12.5px;"></td>
                <td>
                    <select class="form-select inv-edit" data-id="${m.ID}" data-field="Category" style="padding:4px 8px; font-size:12px;">
                        ${categories.map(c => `<option value="${c}" ${c === m.Category ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </td>
                <td><input type="number" step="10" class="form-input inv-edit" data-id="${m.ID}" data-field="Cost" value="${m.Cost}" style="padding:4px 8px; font-size:12.5px; width:100px; text-align:right; font-weight:600;"></td>
                <td><input type="number" step="100" class="form-input inv-edit" data-id="${m.ID}" data-field="Max_Stock_Kg" value="${m.Max_Stock_Kg || ''}" placeholder="∞" style="padding:4px 8px; font-size:12.5px; width:85px; text-align:right;"></td>
                <td style="text-align:center;">
                    <button class="btn btn-default btn-edit-comp" data-id="${m.ID}" style="padding:3px 8px; font-size:11px;" title="View and edit chemical composition">🧪 ${compStr || 'Edit %'}</button>
                </td>
                <td style="text-align:center;"><button class="btn btn-default btn-del-mat" data-id="${m.ID}" style="padding:2px 6px; color:var(--danger);" title="Delete Material">✕</button></td>
            </tr>
            `;
        }).join('');

        document.querySelectorAll('.inv-edit').forEach(inp => {
            inp.addEventListener('change', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                const field = e.target.getAttribute('data-field');
                invMgr.updateField(id, field, e.target.value);
            });
        });

        document.querySelectorAll('.btn-edit-comp').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                openEditCompositionModal(id);
            });
        });

        document.querySelectorAll('.btn-del-mat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                if (confirm(`Delete material ID #${id}?`)) {
                    invMgr.deleteMaterial(id);
                    renderInventoryTable();
                }
            });
        });
    }

    document.getElementById('inv-filter-cat').addEventListener('change', renderInventoryTable);
    document.getElementById('inv-search').addEventListener('input', renderInventoryTable);

    // Excel Export
    document.getElementById('btn-export-excel').addEventListener('click', () => {
        invMgr.exportToExcelFile();
    });

    // Excel Import
    const excelFileInput = document.getElementById('excel-file-input');
    document.getElementById('btn-import-excel').addEventListener('click', () => {
        excelFileInput.click();
    });

    excelFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const res = await invMgr.importFromExcelFile(file);
            alert(`✅ Successfully imported ${res.count} materials from Excel!\n\nAll "Balance" elements and "Traces" were automatically normalized.`);
            renderInventoryTable();
            opt.setMaterials(invMgr.getMaterials());
        } catch (err) {
            alert(`❌ Excel import failed: ${err.message}`);
        }
        excelFileInput.value = '';
    });

    document.getElementById('btn-reset-db').addEventListener('click', () => {
        if (confirm("Reset Scrap Master to original factory default compositions?")) {
            invMgr.resetToDefaults();
            renderInventoryTable();
            opt.setMaterials(invMgr.getMaterials());
            alert("Database reset to factory defaults!");
        }
    });

    // 7. Edit Composition Modal
    const compModal = document.getElementById('modal-edit-composition');
    function openEditCompositionModal(matId) {
        editingMatId = matId;
        const mat = invMgr.getMaterials().find(m => m.ID === matId);
        if (!mat) return;

        document.getElementById('edit-comp-mat-title').innerText = `Edit Composition: ${mat.Name}`;
        const container = document.getElementById('edit-mat-elements-grid');
        const elements = window.ALLOYFORGE_DEFAULT_DATA.elements;

        container.innerHTML = elements.map(el => {
            const v = parseFloat(mat[el] || 0.0);
            return `
                <div class="comp-grid-cell">
                    <span class="comp-el-label">${el} %</span>
                    <input type="number" step="0.05" class="form-input edit-comp-val" data-el="${el}" value="${v.toFixed(3)}" style="padding:3px 5px; font-size:12px; text-align:right;">
                </div>
            `;
        }).join('');

        function updateCompTotal() {
            let sum = 0.0;
            document.querySelectorAll('.edit-comp-val').forEach(inp => {
                sum += parseFloat(inp.value) || 0.0;
            });
            document.getElementById('edit-comp-total-readout').innerText = `Total: ${sum.toFixed(2)}%`;
            document.getElementById('edit-comp-total-readout').style.color = (sum > 101.0 || sum < 98.0) ? 'var(--danger)' : 'var(--green)';
        }

        document.querySelectorAll('.edit-comp-val').forEach(inp => {
            inp.addEventListener('input', updateCompTotal);
        });

        updateCompTotal();
        compModal.classList.add('active');
    }

    document.getElementById('btn-close-comp-modal').onclick = () => compModal.classList.remove('active');
    document.getElementById('btn-cancel-comp-modal').onclick = () => compModal.classList.remove('active');

    document.getElementById('btn-save-comp-modal').onclick = () => {
        if (!editingMatId) return;
        const mat = invMgr.getMaterials().find(m => m.ID === editingMatId);
        if (mat) {
            document.querySelectorAll('.edit-comp-val').forEach(inp => {
                const el = inp.getAttribute('data-el');
                const val = parseFloat(inp.value) || 0.0;
                mat[el] = val;
            });
            invMgr.saveMaterials();
            renderInventoryTable();
            opt.setMaterials(invMgr.getMaterials());
            compModal.classList.remove('active');
            alert(`✅ Composition for ${mat.Name} updated!`);
        }
    };

    // 8. Add Material Modal (with Balance Auto-Calculation)
    const addModal = document.getElementById('modal-add-material');
    document.getElementById('btn-open-add-modal').addEventListener('click', () => {
        const container = document.getElementById('add-mat-elements-grid');
        const elements = window.ALLOYFORGE_DEFAULT_DATA.elements;

        container.innerHTML = elements.map(el => `
            <div class="comp-grid-cell">
                <span class="comp-el-label">${el} %</span>
                <input type="text" class="form-input new-el-input" data-el="${el}" placeholder="0" style="padding:3px 5px; font-size:12px; text-align:right;">
            </div>
        `).join('');

        function updateBalancePreview() {
            const balEl = document.getElementById('new-mat-balance-el').value;
            let otherSum = 0.0;

            document.querySelectorAll('.new-el-input').forEach(inp => {
                const el = inp.getAttribute('data-el');
                const s = inp.value.trim().toLowerCase();
                let val = parseFloat(s) || 0.0;
                if (s === 'tracer' || s === 'traces' || s === 'trace' || s === '') val = 0.0;

                if (el !== balEl) {
                    otherSum += val;
                }
            });

            if (balEl !== 'None') {
                const balInput = document.querySelector(`.new-el-input[data-el="${balEl}"]`);
                if (balInput) {
                    const remaining = Math.max(0.0, 100.0 - otherSum);
                    balInput.value = remaining.toFixed(2);
                }
            }

            let total = 0.0;
            document.querySelectorAll('.new-el-input').forEach(inp => {
                total += parseFloat(inp.value) || 0.0;
            });

            document.getElementById('add-mat-total-preview').innerText = `Total: ${total.toFixed(2)}%`;
        }

        document.getElementById('new-mat-balance-el').onchange = updateBalancePreview;
        document.querySelectorAll('.new-el-input').forEach(inp => {
            inp.addEventListener('input', updateBalancePreview);
        });

        updateBalancePreview();
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
        document.querySelectorAll('.new-el-input').forEach(inp => {
            const el = inp.getAttribute('data-el');
            const s = inp.value.trim().toLowerCase();
            let val = parseFloat(s) || 0.0;
            if (s === 'tracer' || s === 'traces' || s === 'trace' || s === '') val = 0.0;
            comp[el] = val;
        });

        const newId = invMgr.addMaterial(name, cost, cat, comp, stock);
        alert(`✅ Material added as ID #${newId}!`);
        addModal.classList.remove('active');
        renderInventoryTable();
        opt.setMaterials(invMgr.getMaterials());
    });

    // 9. History Table
    function renderHistoryTable() {
        const tbody = document.getElementById('history-tbody');
        const heats = histMgr.history;

        if (heats.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:16px;">No furnace heats logged yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = heats.map(h => `
            <tr>
                <td style="font-weight:600; color:var(--primary);">${h.heat_id}</td>
                <td style="color:var(--text-muted);">${h.timestamp}</td>
                <td style="font-weight:600;">${h.alloy_name}</td>
                <td style="text-align:right;">${h.batch_size_kg.toLocaleString()} kg</td>
                <td>${h.selected_option.split(':')[0]}</td>
                <td style="text-align:right;">PKR ${h.cost_per_kg.toFixed(2)}</td>
                <td style="text-align:right; font-weight:700;">PKR ${h.total_cost_pkr.toLocaleString()}</td>
                <td style="text-align:center;">
                    <button class="btn btn-default btn-print-heat" data-id="${h.heat_id}" style="padding:2px 6px;">Card</button>
                    <button class="btn btn-default btn-del-heat" data-id="${h.heat_id}" style="padding:2px 6px; color:var(--danger); margin-left:4px;">✕</button>
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
                }
            });
        });
    }

    document.getElementById('btn-export-heats-csv').addEventListener('click', () => histMgr.exportToCSV());
});
