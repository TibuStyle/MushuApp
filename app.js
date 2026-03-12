// === MushuApp v3.4 - Modales internos para profesor y extras ===

// --- CONFIG ---
const TEACHER_MASTER_PASSWORD = 'amormiomucushu88';

// --- Data State ---
let materials = JSON.parse(localStorage.getItem('mushu_materials')) || [];
let recipes = JSON.parse(localStorage.getItem('mushu_recipes')) || [];
let profitMargin = parseFloat(localStorage.getItem('mushu_profit_margin')) || 2;
let courses = JSON.parse(localStorage.getItem('mushu_courses')) || [];
let importedClasses = JSON.parse(localStorage.getItem('mushu_imported_classes')) || [];
let teacherMode = JSON.parse(localStorage.getItem('mushu_teacher_mode')) || { active: false };
let studentName = localStorage.getItem('mushu_student_name') || '';

let currentRecipeIngredients = [];
let currentRecipeDecorations = [];
let currentRecipeExtra = null;
let currentEditingRecipeId = null;
let currentEditingMaterialId = null;
let currentMaterialCategory = 'productos';
let currentMaterialSubcategory = '';
let showMinSellingPrice = false;

// Classes
let currentCourseStudents = [];
let currentEditingCourseId = null;
let currentClassPhotos = [];
let currentEditingClassId = null;
let currentAttendanceCourseId = null;
let currentAttendanceClassId = null;
let currentAttendanceData = [];
let currentSelectedClassRecipe = null;
let pendingImportClassData = null;

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    const sm = localStorage.getItem('mushu_profit_margin');
    if (sm) profitMargin = parseFloat(sm);

    normalizeExistingRecipes();
    renderMaterials();
    renderRecipes();
    updateMaterialSelect();
    updateDecorationSelect();
    updateExtraSubcategorySelect();
    updateClassesView();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(e => console.log('SW fail', e));
    }

    document.addEventListener('touchmove', function (e) {
        if (!e.target.closest('.content-area, .modal-content')) e.preventDefault();
    }, { passive: false });

    window.scrollTo(0, 0);

    setTimeout(() => {
        const sp = document.getElementById('splash-screen');
        if (sp) {
            sp.classList.add('fade-out');
            setTimeout(() => sp.remove(), 500);
        }
    }, 3000);
});

// --- Normalize old recipes ---
function normalizeExistingRecipes() {
    let changed = false;
    recipes.forEach(r => {
        if (!r.recipeFolder) {
            r.recipeFolder = 'Mis Recetas';
            changed = true;
        }
        if (!r.recipeSource) {
            r.recipeSource = 'personal';
            changed = true;
        }
    });
    if (changed) saveRecipesToStorage();
}

// --- Tabs ---
function switchTab(tabName) {
    const view = document.getElementById(`view-${tabName}`);
    const nav = document.getElementById(`nav-${tabName}`);
    if (!view || !nav) return;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    view.classList.add('active');
    nav.classList.add('active');
    if (tabName === 'clases') updateClassesView();
    if (tabName === 'recetas') renderRecipes();
}

// --- Generic toggle folders ---
function toggleFolderBody(idPrefix, id) {
    const body = document.getElementById(`${idPrefix}-body-${id}`);
    const chevron = document.getElementById(`${idPrefix}-chevron-${id}`);
    if (!body || !chevron) return;
    body.classList.toggle('open');
    chevron.style.transform = body.classList.contains('open') ? 'rotate(0deg)' : 'rotate(-90deg)';
}

// --- Modals ---
function showAddMaterialModal(materialId = null, category = 'productos', subcategory = '') {
    document.getElementById('form-material').reset();
    const ph = {
        productos: { name: 'Ej: Harina', price: '990' },
        decoracion: { name: 'Ej: Chispas de chocolate', price: '1500' },
        extra: { name: 'Ej: Caja para torta', price: '2000' }
    };
    const subcatGroup = document.getElementById('mat-subcategory-group');
    const unitSelect = document.getElementById('mat-unit');

    if (materialId) {
        const mat = materials.find(m => String(m.id) === String(materialId));
        if (mat) {
            currentEditingMaterialId = String(mat.id);
            currentMaterialCategory = mat.category || 'productos';
            currentMaterialSubcategory = mat.subcategory || '';
            document.getElementById('mat-name').value = mat.name;
            document.getElementById('mat-price').value = mat.price;
            document.getElementById('mat-qty').value = mat.qty;
            document.querySelector('#modal-material h3').textContent = "Editar Material";
            renderPriceHistory(mat);
        }
    } else {
        currentEditingMaterialId = null;
        currentMaterialCategory = category;
        currentMaterialSubcategory = subcategory;
        document.querySelector('#modal-material h3').textContent = "Agregar Material";
        document.getElementById('price-history-section').style.display = 'none';
    }

    subcatGroup.style.display = 'none';

    if (currentMaterialCategory === 'extra') {
        unitSelect.innerHTML = '<option value="u">Unidad</option><option value="cm">Centímetros</option><option value="m">Metros</option>';
    } else {
        unitSelect.innerHTML = '<option value="kg">Kilos (kg)</option><option value="g">Gramos (g)</option><option value="l">Litros (L)</option><option value="cm3">mL</option><option value="u">Unidad</option>';
    }

    if (materialId) {
        const mat = materials.find(m => String(m.id) === String(materialId));
        if (mat) unitSelect.value = mat.unit;
    }

    const p = ph[currentMaterialCategory] || ph.productos;
    document.getElementById('mat-name').placeholder = p.name;
    document.getElementById('mat-price').placeholder = p.price;
    document.getElementById('modal-material').classList.add('active');
}

function showAddRecipeModal(recipeId = null) {
    const btnD = document.getElementById('btn-duplicate-recipe');
    const folderGroup = document.getElementById('recipe-folder-group');
    const folderInput = document.getElementById('recipe-folder-input');

    folderGroup.style.display = 'none';
    folderInput.value = '';

    if (recipeId) {
        const r = recipes.find(r => String(r.id) === String(recipeId));
        if (r) {
            currentEditingRecipeId = String(r.id);
            document.getElementById('recipe-name').value = r.name;
            document.getElementById('recipe-portions').value = r.portions || '';
            currentRecipeIngredients = JSON.parse(JSON.stringify(r.ingredients || []));
            currentRecipeDecorations = JSON.parse(JSON.stringify(r.decorations || []));
            currentRecipeExtra = r.extraSubcategory || null;
            document.querySelector('#modal-recipe h3').textContent = "Editar Receta";
            recalculateIngredientCosts();
            if (btnD) btnD.style.display = 'flex';
        }
    } else {
        currentEditingRecipeId = null;
        document.getElementById('recipe-name').value = '';
        document.getElementById('recipe-portions').value = '';
        currentRecipeIngredients = [];
        currentRecipeDecorations = [];
        currentRecipeExtra = null;
        document.querySelector('#modal-recipe h3').textContent = "Crear Receta";
        if (btnD) btnD.style.display = 'none';
    }

    renderCurrentRecipeIngredients();
    renderCurrentRecipeDecorations();
    updateMaterialSelect();
    updateDecorationSelect();
    updateExtraSubcategorySelect();
    renderExtraInRecipe();
    updateRecipeTotal();
    document.getElementById('recipe-add-qty').value = '';
    document.getElementById('recipe-add-deco-qty').value = '';
    if (currentRecipeExtra) document.getElementById('recipe-extra-subcat').value = currentRecipeExtra;
    document.getElementById('modal-recipe').classList.add('active');
}

function showSettingsModal() {
    const mi = document.getElementById('profit-margin');
    if (mi) mi.value = profitMargin;

    const tt = document.getElementById('toggle-teacher-mode');
    if (tt) tt.checked = teacherMode.active;

    const sns = document.getElementById('student-name-section');
    if (sns) sns.style.display = teacherMode.active ? 'none' : 'block';

    const sni = document.getElementById('student-name-input');
    if (sni) sni.value = studentName;

    document.getElementById('modal-settings').classList.add('active');
}

function showSocialModal() {
    document.getElementById('modal-social').classList.add('active');
}

function showTeacherPasswordModal() {
    document.getElementById('teacher-password-modal-input').value = '';
    document.getElementById('modal-teacher-password').classList.add('active');
}

function confirmTeacherModePassword() {
    const pass = document.getElementById('teacher-password-modal-input').value;
    if (pass !== TEACHER_MASTER_PASSWORD) {
        document.getElementById('toggle-teacher-mode').checked = false;
        showToast('Contraseña incorrecta', true);
        return;
    }
    teacherMode.active = true;
    localStorage.setItem('mushu_teacher_mode', JSON.stringify(teacherMode));
    const studentSection = document.getElementById('student-name-section');
    if (studentSection) studentSection.style.display = 'none';
    closeModal('modal-teacher-password');
    showToast('Modo Profesor activado 🎓');
    updateClassesView();
}

function cancelTeacherModeModal() {
    document.getElementById('toggle-teacher-mode').checked = false;
    closeModal('modal-teacher-password');
}

function showAddExtraSubcategoryModal() {
    document.getElementById('extra-subcategory-name').value = '';
    document.getElementById('modal-extra-subcategory').classList.add('active');
}

function saveExtraSubcategoryFromModal() {
    const n = document.getElementById('extra-subcategory-name').value.trim();
    if (!n) {
        showToast('Ingresa un nombre', true);
        return;
    }
    let s = JSON.parse(localStorage.getItem('mushu_extra_subcategories') || '[]');
    if (s.includes(n)) {
        showToast('Ya existe', true);
        return;
    }
    s.push(n);
    localStorage.setItem('mushu_extra_subcategories', JSON.stringify(s));
    renderMaterials();
    updateExtraSubcategorySelect();
    closeModal('modal-extra-subcategory');
    showToast(`"${n}" creada!`);
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// --- Toast ---
function showToast(msg, err = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show';
    if (err) t.classList.add('error');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ========================================
// MATERIALS
// ========================================
function saveMaterial(e) {
    e.preventDefault();
    const name = document.getElementById('mat-name').value.trim();
    const price = parseFloat(document.getElementById('mat-price').value);
    const qty = parseFloat(document.getElementById('mat-qty').value);
    const unit = document.getElementById('mat-unit').value;

    if (!name || isNaN(price) || isNaN(qty) || qty <= 0) {
        showToast("Datos inválidos", true);
        return;
    }

    let priceHistory = [];
    if (currentEditingMaterialId) {
        const idx = materials.findIndex(m => String(m.id) === String(currentEditingMaterialId));
        if (idx !== -1) {
            priceHistory = [...(materials[idx].priceHistory || [])];
            if (materials[idx].price !== price) {
                priceHistory.push({ date: new Date().toISOString().slice(0, 10), price });
            }
        }
    } else {
        priceHistory = [{ date: new Date().toISOString().slice(0, 10), price }];
    }

    const mat = {
        id: currentEditingMaterialId || Date.now().toString(),
        name, price, qty, unit,
        category: currentMaterialCategory,
        subcategory: currentMaterialSubcategory,
        priceHistory
    };

    if (currentEditingMaterialId) {
        const idx = materials.findIndex(m => String(m.id) === String(currentEditingMaterialId));
        if (idx !== -1) materials[idx] = mat;
        recalculateAllRecipes();
        showToast("Material actualizado!");
    } else {
        materials.push(mat);
        showToast("Material guardado!");
    }

    currentEditingMaterialId = null;
    saveMaterialsToStorage();
    renderMaterials();
    updateMaterialSelect();
    updateDecorationSelect();
    updateExtraSubcategorySelect();
    closeModal('modal-material');
}

function deleteMaterial(id) {
    if (!confirm("¿Eliminar este material?")) return;
    materials = materials.filter(m => String(m.id) !== String(id));
    saveMaterialsToStorage();
    recalculateAllRecipes();
    renderMaterials();
    updateMaterialSelect();
    updateDecorationSelect();
    updateExtraSubcategorySelect();
}

function saveMaterialsToStorage() {
    localStorage.setItem('mushu_materials', JSON.stringify(materials));
}

function getPriceBadgeHTML(mat) {
    if (!mat.priceHistory || mat.priceHistory.length < 2) return '';
    const cur = mat.price;
    const prev = mat.priceHistory[mat.priceHistory.length - 2].price;
    const diff = cur - prev;
    const pct = Math.round(Math.abs(diff) / prev * 100);
    if (diff === 0) return '';
    if (diff < 0) {
        return `<div class="price-badge cheaper"><i class='bx bx-trending-down'></i> ${pct}% más barato - Ahorras $${formatCLP(Math.abs(diff))}</div>`;
    }
    return `<div class="price-badge expensive"><i class='bx bx-trending-up'></i> ${pct}% más caro - Pagas $${formatCLP(diff)} de más</div>`;
}

function renderPriceHistory(mat) {
    const sec = document.getElementById('price-history-section');
    const list = document.getElementById('price-history-list');
    if (!mat || !mat.priceHistory || mat.priceHistory.length < 1) {
        sec.style.display = 'none';
        return;
    }
    sec.style.display = 'block';
    list.innerHTML = [...mat.priceHistory].reverse().map((e, i, a) => {
        let ch = '';
        const pi = i + 1;
        if (pi < a.length) {
            const p = a[pi].price;
            const d = e.price - p;
            const pc = Math.round(Math.abs(d) / p * 100);
            if (d > 0) ch = `<span class="price-history-change up">+${pc}%</span>`;
            else if (d < 0) ch = `<span class="price-history-change down">-${pc}%</span>`;
        }
        return `<div class="price-history-item"><span class="price-history-date">${formatDate(e.date)}</span><span class="price-history-value">$${formatCLP(e.price)}</span>${ch}</div>`;
    }).join('');
}

function filterMaterials() { renderMaterials(); }

function renderMaterials() {
    const si = document.getElementById('search-materials');
    const q = si ? si.value.toLowerCase().trim() : '';

    ['productos', 'decoracion'].forEach(ck => {
        const list = document.getElementById(`list-${ck}`);
        const items = materials.filter(m => (m.category || 'productos') === ck);
        const f = q ? items.filter(m => m.name.toLowerCase().includes(q)) : items;
        const em = ck === 'productos' ? 'Agrega tu primera materia prima' : 'Agrega elementos de decoración';

        if (f.length === 0) {
            list.innerHTML = `<div class="empty-state" style="padding:20px;font-size:13px;">${q ? 'Sin resultados' : em}</div>`;
            return;
        }

        list.innerHTML = f.sort((a, b) => a.name.localeCompare(b.name)).map(m => `
            <div class="card" onclick="showAddMaterialModal('${m.id}')" style="cursor:pointer;">
                <div class="card-info">
                    <h3>${m.name}</h3>
                    <p>${m.qty} ${m.unit}</p>
                    ${getPriceBadgeHTML(m)}
                </div>
                <div style="display:flex;align-items:center;gap:15px;" onclick="event.stopPropagation()">
                    <span class="card-price">$${formatCLP(m.price)}</span>
                    <button class="btn-icon danger" onclick="deleteMaterial('${m.id}')"><i class='bx bx-trash'></i></button>
                </div>
            </div>
        `).join('');
    });

    renderExtraMaterials(q);
}

function renderExtraMaterials(q) {
    const el = document.getElementById('list-extra');
    const ei = materials.filter(m => m.category === 'extra');
    let es = JSON.parse(localStorage.getItem('mushu_extra_subcategories')) || [];

    ei.forEach(m => {
        if (m.subcategory && !es.includes(m.subcategory)) es.push(m.subcategory);
    });

    if (es.length === 0) {
        el.innerHTML = '<div class="empty-state" style="padding:20px;font-size:13px;">Presiona + para crear una subcategoría</div>';
        return;
    }

    let h = '';
    es.forEach(sc => {
        const items = ei.filter(m => m.subcategory === sc);
        const f = q ? items.filter(m => m.name.toLowerCase().includes(q)) : items;
        const tot = items.reduce((s, m) => s + m.price, 0);
        const sid = sc.replace(/[^a-zA-Z0-9]/g, '_');

        if (q && f.length === 0) return;

        h += `<div class="extra-subcat">
            <div class="extra-subcat-header" onclick="toggleExtraSubcat('${sid}')">
                <div style="display:flex;align-items:center;gap:8px;">
                    <i class='bx bx-chevron-down' id="chevron-extra-${sid}" style="transition:transform 0.3s;"></i>
                    <i class='bx bx-folder' style="color:var(--secondary-color);"></i>
                    <span>${sc}</span>
                </div>
                <div style="display:flex;align-items:center;gap:10px;" onclick="event.stopPropagation()">
                    <span class="card-price">$${formatCLP(tot)}</span>
                    <button class="btn-add-small" onclick="showAddMaterialModal(null,'extra','${sc}')"><i class='bx bx-plus'></i></button>
                    <button class="btn-icon danger" style="width:26px;height:26px;font-size:14px;" onclick="deleteExtraSubcategory('${sc}')"><i class='bx bx-trash'></i></button>
                </div>
            </div>
            <div class="extra-subcat-body open" id="body-extra-${sid}">
                ${(q ? f : items).sort((a, b) => a.name.localeCompare(b.name)).map(m => `
                    <div class="card" onclick="showAddMaterialModal('${m.id}')" style="cursor:pointer;margin-left:8px;">
                        <div class="card-info">
                            <h3>${m.name}</h3>
                            <p>${m.qty} ${m.unit}</p>
                            ${getPriceBadgeHTML(m)}
                        </div>
                        <div style="display:flex;align-items:center;gap:15px;" onclick="event.stopPropagation()">
                            <span class="card-price">$${formatCLP(m.price)}</span>
                            <button class="btn-icon danger" onclick="deleteMaterial('${m.id}')"><i class='bx bx-trash'></i></button>
                        </div>
                    </div>
                `).join('') || '<div class="empty-state" style="padding:12px;font-size:12px;">Sin items.</div>'}
            </div>
        </div>`;
    });

    el.innerHTML = h || '<div class="empty-state" style="padding:20px;font-size:13px;">Sin resultados</div>';
}

function toggleCategory(ck) {
    const b = document.getElementById(`body-${ck}`);
    const c = document.getElementById(`chevron-${ck}`);
    b.classList.toggle('open');
    c.style.transform = b.classList.contains('open') ? 'rotate(0)' : 'rotate(-90deg)';
}

function toggleExtraSubcat(sid) {
    const b = document.getElementById(`body-extra-${sid}`);
    const c = document.getElementById(`chevron-extra-${sid}`);
    if (!b) return;
    b.classList.toggle('open');
    c.style.transform = b.classList.contains('open') ? 'rotate(0)' : 'rotate(-90deg)';
}

function addExtraSubcategory() {
    showAddExtraSubcategoryModal();
}

function deleteExtraSubcategory(sc) {
    if (!confirm(`¿Eliminar "${sc}"?`)) return;
    materials = materials.filter(m => !(m.category === 'extra' && m.subcategory === sc));
    let s = JSON.parse(localStorage.getItem('mushu_extra_subcategories') || '[]');
    s = s.filter(x => x !== sc);
    localStorage.setItem('mushu_extra_subcategories', JSON.stringify(s));
    saveMaterialsToStorage();
    renderMaterials();
    updateExtraSubcategorySelect();
    showToast(`"${sc}" eliminada`);
}

// ========================================
// RECIPE SELECTS + COSTS
// ========================================
function updateMaterialSelect() {
    const s = document.getElementById('recipe-add-mat');
    const m = materials.filter(m => (m.category || 'productos') === 'productos');
    if (m.length === 0) { s.innerHTML = '<option value="">No hay productos</option>'; return; }
    s.innerHTML = '<option value="">Selecciona...</option>' + m.sort((a, b) => a.name.localeCompare(b.name)).map(m =>
        `<option value="${m.id}">${m.name} ($${formatCLP(m.price)} x ${m.qty}${m.unit})</option>`).join('');
}

function updateDecorationSelect() {
    const s = document.getElementById('recipe-add-deco-mat');
    const m = materials.filter(m => m.category === 'decoracion');
    if (m.length === 0) { s.innerHTML = '<option value="">No hay decoraciones</option>'; return; }
    s.innerHTML = '<option value="">Selecciona...</option>' + m.sort((a, b) => a.name.localeCompare(b.name)).map(m =>
        `<option value="${m.id}">${m.name} ($${formatCLP(m.price)} x ${m.qty}${m.unit})</option>`).join('');
}

function updateExtraSubcategorySelect() {
    const s = document.getElementById('recipe-extra-subcat');
    const ei = materials.filter(m => m.category === 'extra');
    const sc = [...new Set(ei.map(m => m.subcategory).filter(Boolean))];
    if (sc.length === 0) { s.innerHTML = '<option value="">No hay extras</option>'; return; }
    s.innerHTML = '<option value="">Sin extra</option>' + sc.map(sub => {
        const t = ei.filter(m => m.subcategory === sub).reduce((s, m) => s + m.price, 0);
        return `<option value="${sub}">${sub} ($${formatCLP(t)})</option>`;
    }).join('');
}

function calculateIngredientCost(mat, rq, ru) {
    const EGG = 55;
    const isE = /\bhuevos?\b/i.test(mat.name.trim());

    let smq = mat.qty;
    if (mat.unit === 'kg') smq *= 1000;
    else if (mat.unit === 'l') smq *= 1000;
    else if (mat.unit === 'u' && isE && ru !== 'u') smq *= EGG;

    let srq = rq;
    if (ru === 'kg') srq *= 1000;
    else if (ru === 'l') srq *= 1000;
    else if (ru === 'u' && isE && (mat.unit === 'g' || mat.unit === 'kg')) srq *= EGG;

    if (smq <= 0) return 0;
    return Math.round((srq * mat.price) / smq);
}

function recalculateIngredientCosts() {
    currentRecipeIngredients.forEach(i => {
        const m = materials.find(x => String(x.id) === String(i.matId));
        if (m) i.cost = calculateIngredientCost(m, i.qty, i.unit);
    });
    currentRecipeDecorations.forEach(d => {
        const m = materials.find(x => String(x.id) === String(d.matId));
        if (m) d.cost = calculateIngredientCost(m, d.qty, d.unit);
    });
}

function recalculateAllRecipes() {
    let ch = false;
    recipes.forEach(r => {
        let c = false;
        (r.ingredients || []).forEach(i => {
            const m = materials.find(x => String(x.id) === String(i.matId));
            if (m) {
                const nc = calculateIngredientCost(m, i.qty, i.unit);
                if (nc !== i.cost) { i.cost = nc; c = true; }
            }
        });
        (r.decorations || []).forEach(d => {
            const m = materials.find(x => String(x.id) === String(d.matId));
            if (m) {
                const nc = calculateIngredientCost(m, d.qty, d.unit);
                if (nc !== d.cost) { d.cost = nc; c = true; }
            }
        });
        if (r.extraSubcategory) {
            const ne = materials.filter(m => m.category === 'extra' && m.subcategory === r.extraSubcategory).reduce((s, m) => s + m.price, 0);
            if (ne !== r.extraCost) { r.extraCost = ne; c = true; }
        }
        if (c) {
            r.totalCost = (r.ingredients || []).reduce((s, i) => s + i.cost, 0) +
                          (r.decorations || []).reduce((s, d) => s + d.cost, 0) +
                          (r.extraCost || 0);
            ch = true;
        }
    });
    if (ch) { saveRecipesToStorage(); renderRecipes(); }
}

function addIngredientToRecipeForm() {
    const mi = document.getElementById('recipe-add-mat').value;
    const q = parseFloat(document.getElementById('recipe-add-qty').value);
    const u = document.getElementById('recipe-add-unit').value;
    if (!mi || isNaN(q) || q <= 0) { showToast("Completa datos", true); return; }
    const m = materials.find(x => String(x.id) === String(mi));
    if (!m) return;
    currentRecipeIngredients.push({
        id: Date.now().toString(),
        matId: String(m.id),
        name: m.name,
        qty: q,
        unit: u,
        cost: calculateIngredientCost(m, q, u)
    });
    document.getElementById('recipe-add-mat').value = '';
    document.getElementById('recipe-add-qty').value = '';
    renderCurrentRecipeIngredients();
    updateRecipeTotal();
}

function removeIngredientFromRecipe(id) {
    currentRecipeIngredients = currentRecipeIngredients.filter(i => String(i.id) !== String(id));
    renderCurrentRecipeIngredients();
    updateRecipeTotal();
}

function renderCurrentRecipeIngredients() {
    const l = document.getElementById('recipe-ingredients-list');
    if (currentRecipeIngredients.length === 0) {
        l.innerHTML = '<div class="empty-state" style="padding:15px;font-size:13px;">Sin ingredientes.</div>';
        return;
    }
    l.innerHTML = currentRecipeIngredients.map(i => `
        <div class="ingredient-item">
            <div class="ingredient-details">
                <span><strong>${i.name}</strong></span>
                <span style="font-size:12px;color:var(--text-muted);">${i.qty} ${i.unit}</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
                <span class="ingredient-cost">$${formatCLP(i.cost)}</span>
                <button class="btn-icon danger" onclick="removeIngredientFromRecipe('${i.id}')" style="width:28px;height:28px;font-size:16px;">
                    <i class='bx bx-trash'></i>
                </button>
            </div>
        </div>
    `).join('');
}

function addDecorationToRecipeForm() {
    const mi = document.getElementById('recipe-add-deco-mat').value;
    const q = parseFloat(document.getElementById('recipe-add-deco-qty').value);
    const u = document.getElementById('recipe-add-deco-unit').value;
    if (!mi || isNaN(q) || q <= 0) { showToast("Completa datos", true); return; }
    const m = materials.find(x => String(x.id) === String(mi));
    if (!m) return;
    currentRecipeDecorations.push({
        id: Date.now().toString(),
        matId: String(m.id),
        name: m.name,
        qty: q,
        unit: u,
        cost: calculateIngredientCost(m, q, u)
    });
    document.getElementById('recipe-add-deco-mat').value = '';
    document.getElementById('recipe-add-deco-qty').value = '';
    renderCurrentRecipeDecorations();
    updateRecipeTotal();
}

function removeDecorationFromRecipe(id) {
    currentRecipeDecorations = currentRecipeDecorations.filter(i => String(i.id) !== String(id));
    renderCurrentRecipeDecorations();
    updateRecipeTotal();
}

function renderCurrentRecipeDecorations() {
    const l = document.getElementById('recipe-decorations-list');
    if (currentRecipeDecorations.length === 0) {
        l.innerHTML = '<div class="empty-state" style="padding:15px;font-size:13px;">Sin decoración.</div>';
        return;
    }
    l.innerHTML = currentRecipeDecorations.map(i => `
        <div class="ingredient-item">
            <div class="ingredient-details">
                <span><strong>${i.name}</strong></span>
                <span style="font-size:12px;color:var(--text-muted);">${i.qty} ${i.unit}</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
                <span class="ingredient-cost">$${formatCLP(i.cost)}</span>
                <button class="btn-icon danger" onclick="removeDecorationFromRecipe('${i.id}')" style="width:28px;height:28px;font-size:16px;">
                    <i class='bx bx-trash'></i>
                </button>
            </div>
        </div>
    `).join('');
}

function onExtraSubcategoryChange() {
    currentRecipeExtra = document.getElementById('recipe-extra-subcat').value || null;
    renderExtraInRecipe();
    updateRecipeTotal();
}

function renderExtraInRecipe() {
    const c = document.getElementById('recipe-extra-details');
    if (!currentRecipeExtra) { c.innerHTML = ''; return; }
    const items = materials.filter(m => m.category === 'extra' && m.subcategory === currentRecipeExtra);
    if (items.length === 0) { c.innerHTML = ''; return; }
    const t = items.reduce((s, m) => s + m.price, 0);
    c.innerHTML = `<div style="margin-top:10px;font-size:13px;color:var(--text-muted);">
        ${items.map(m => `<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>${m.name}</span><span>$${formatCLP(m.price)}</span></div>`).join('')}
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid rgba(0,0,0,0.1);margin-top:4px;font-weight:600;color:var(--text-main);">
            <span>Subtotal Extra</span><span>$${formatCLP(t)}</span>
        </div>
    </div>`;
}

function getExtraCost() {
    if (!currentRecipeExtra) return 0;
    return materials.filter(m => m.category === 'extra' && m.subcategory === currentRecipeExtra).reduce((s, m) => s + m.price, 0);
}

function updateRecipeTotal() {
    const ic = currentRecipeIngredients.reduce((s, i) => s + i.cost, 0);
    const dc = currentRecipeDecorations.reduce((s, i) => s + i.cost, 0);
    const ec = getExtraCost();
    const t = ic + dc + ec;
    document.getElementById('recipe-total-cost').textContent = `$${formatCLP(t)} CLP`;
    const p = parseInt(document.getElementById('recipe-portions').value);
    const pd = document.getElementById('recipe-portion-cost');
    if (!isNaN(p) && p > 1) {
        pd.textContent = `$${formatCLP(Math.round(t / p))} CLP / porción`;
        pd.style.display = 'block';
    } else {
        pd.style.display = 'none';
    }
}

function saveRecipe(recipeFolder = null, recipeSource = 'personal', sourceCourseName = '', sourceClassDate = '') {
    const n = document.getElementById('recipe-name').value.trim();
    if (!n) { showToast("Ingresa nombre", true); return; }
    if (currentRecipeIngredients.length === 0 && currentRecipeDecorations.length === 0) {
        showToast("Agrega ingredientes", true); return;
    }

    const ic = currentRecipeIngredients.reduce((s, i) => s + i.cost, 0);
    const dc = currentRecipeDecorations.reduce((s, i) => s + i.cost, 0);
    const ec = getExtraCost();
    const tc = ic + dc + ec;
    const po = parseInt(document.getElementById('recipe-portions').value) || 1;
    const finalFolder = recipeFolder || 'Mis Recetas';

    if (currentEditingRecipeId) {
        const idx = recipes.findIndex(r => String(r.id) === String(currentEditingRecipeId));
        if (idx !== -1) {
            recipes[idx] = {
                ...recipes[idx],
                name: n,
                ingredients: currentRecipeIngredients,
                decorations: currentRecipeDecorations,
                extraSubcategory: currentRecipeExtra,
                extraCost: ec,
                totalCost: tc,
                portions: po,
                recipeFolder: recipes[idx].recipeFolder || finalFolder,
                recipeSource: recipes[idx].recipeSource || recipeSource,
                sourceCourseName: recipes[idx].sourceCourseName || sourceCourseName,
                sourceClassDate: recipes[idx].sourceClassDate || sourceClassDate
            };
            showToast("Receta actualizada!");
        }
    } else {
        const newRecipe = {
            id: Date.now().toString(),
            name: n,
            ingredients: currentRecipeIngredients,
            decorations: currentRecipeDecorations,
            extraSubcategory: currentRecipeExtra,
            extraCost: ec,
            totalCost: tc,
            portions: po,
            recipeFolder: finalFolder,
            recipeSource: recipeSource,
            sourceCourseName: sourceCourseName,
            sourceClassDate: sourceClassDate
        };
        recipes.push(newRecipe);
        showToast("Receta guardada!");

        if (recipeSource === 'class') {
            currentSelectedClassRecipe = JSON.parse(JSON.stringify(newRecipe));
            renderSelectedClassRecipeBox();
        }
    }

    saveRecipesToStorage();
    renderRecipes();
    closeModal('modal-recipe');

    if (recipeSource === 'class') {
        document.getElementById('modal-create-class').classList.add('active');
    }
}

function deleteRecipe(id) {
    if (!confirm("¿Eliminar receta?")) return;
    recipes = recipes.filter(r => String(r.id) !== String(id));
    saveRecipesToStorage();
    renderRecipes();
}

function duplicateCurrentRecipe() {
    if (!currentEditingRecipeId) return;
    const r = recipes.find(x => String(x.id) === String(currentEditingRecipeId));
    if (!r) return;
    const nr = {
        ...JSON.parse(JSON.stringify(r)),
        id: Date.now().toString(),
        name: r.name + ' (copia)'
    };
    recipes.push(nr);
    saveRecipesToStorage();
    renderRecipes();
    closeModal('modal-recipe');
    showToast(`"${nr.name}" duplicada!`);
}

function saveRecipesToStorage() {
    localStorage.setItem('mushu_recipes', JSON.stringify(recipes));
}

function toggleSellingPrice() {
    showMinSellingPrice = document.getElementById('toggle-selling-price').checked;
    renderRecipes();
}

function toggleRecipeDetail(rid) {
    const d = document.getElementById(`recipe-detail-${rid}`);
    const t = document.getElementById(`recipe-toggle-${rid}`);
    if (d && t) {
        d.classList.toggle('open');
        t.classList.toggle('open');
    }
}

function generateRecipeTip(r) {
    const a = [...(r.ingredients || []), ...(r.decorations || [])];
    if (a.length === 0) return '';
    const tc = a.reduce((s, i) => s + i.cost, 0);
    if (tc === 0) return '';
    const mx = a.reduce((m, i) => i.cost > m.cost ? i : m, a[0]);
    const p = Math.round((mx.cost / tc) * 100);
    if (p >= 30) {
        return `El ingrediente más caro es <strong>${mx.name}</strong> ($${formatCLP(mx.cost)}), representa el ${p}% del costo. Busca si encuentras uno más barato o pregúntale a la profe si puedes usar otro.`;
    }
    return '';
}

// ========================================
// RECIPES RENDER BY FOLDERS
// ========================================
function renderRecipes() {
    const list = document.getElementById('recipe-folders-list');
    if (recipes.length === 0) {
        list.innerHTML = '<div class="empty-state">No hay recetas todavía. Crea tu primera receta.</div>';
        return;
    }

    const priceColor = showMinSellingPrice ? 'var(--secondary-color)' : 'var(--primary-color)';
    const folders = {};

    recipes.forEach(r => {
        const folder = r.recipeFolder || 'Mis Recetas';
        if (!folders[folder]) folders[folder] = [];
        folders[folder].push(r);
    });

    const folderNames = Object.keys(folders).sort((a, b) => {
        if (a === 'Mis Recetas') return -1;
        if (b === 'Mis Recetas') return 1;
        return a.localeCompare(b);
    });

    list.innerHTML = folderNames.map((folderName, idx) => {
        const folderId = folderName.replace(/[^a-zA-Z0-9]/g, '_');
        const folderRecipes = folders[folderName].sort((a, b) => a.name.localeCompare(b.name));
        return `
            <div class="recipe-folder">
                <div class="recipe-folder-header" onclick="toggleFolderBody('recipe-folder','${folderId}')">
                    <div class="recipe-folder-header-left">
                        <i class='bx bx-folder-open' style="font-size:22px;color:var(--secondary-color);"></i>
                        <div>
                            <h3>${folderName}</h3>
                            <div class="recipe-folder-count">${folderRecipes.length} receta${folderRecipes.length !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                    <i class='bx bx-chevron-down recipe-folder-chevron' id="recipe-folder-chevron-${folderId}" style="transform:${idx === 0 ? 'rotate(0deg)' : 'rotate(-90deg)'};"></i>
                </div>
                <div class="recipe-folder-body ${idx === 0 ? 'open' : ''}" id="recipe-folder-body-${folderId}">
                    ${folderRecipes.map(r => renderRecipeCard(r, priceColor)).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function renderRecipeCard(r, priceColor) {
    let dp = r.totalCost;
    let pl = "Precio costo:";
    if (showMinSellingPrice) {
        dp = Math.floor((r.totalCost * profitMargin) / 500) * 500;
        pl = `Sugerido (x${profitMargin}):`;
    }

    const ic = (r.ingredients || []).reduce((s, i) => s + i.cost, 0);
    const dc = (r.decorations || []).reduce((s, i) => s + i.cost, 0);
    const ec = r.extraCost || 0;
    const ti = (r.ingredients || []).length + (r.decorations || []).length;
    const se = Math.floor((r.totalCost * profitMargin) / 500) * 500;

    const pb = r.portions > 1
        ? `<div class="portions-badge"><i class='bx bx-cut'></i> ${r.portions} porciones • $${formatCLP(Math.round(dp / r.portions))} c/u</div>`
        : '';

    let bd = '';
    if ((r.ingredients || []).length > 0) {
        bd += `<div class="recipe-breakdown-section">
            <div class="recipe-breakdown-header"><span><i class='bx bx-package'></i> Ingredientes</span><span>$${formatCLP(ic)}</span></div>
            ${r.ingredients.map(i => `<div class="recipe-breakdown-item"><span>${i.name} (${i.qty} ${i.unit})</span><span>$${formatCLP(i.cost)}</span></div>`).join('')}
        </div>`;
    }
    if ((r.decorations || []).length > 0) {
        bd += `<div class="recipe-breakdown-section">
            <div class="recipe-breakdown-header"><span><i class='bx bx-palette'></i> Decoración</span><span>$${formatCLP(dc)}</span></div>
            ${r.decorations.map(d => `<div class="recipe-breakdown-item"><span>${d.name} (${d.qty} ${d.unit})</span><span>$${formatCLP(d.cost)}</span></div>`).join('')}
        </div>`;
    }
    if (r.extraSubcategory && ec > 0) {
        const eis = materials.filter(m => m.category === 'extra' && m.subcategory === r.extraSubcategory);
        bd += `<div class="recipe-breakdown-section">
            <div class="recipe-breakdown-header"><span><i class='bx bx-star'></i> Extra</span><span>$${formatCLP(ec)}</span></div>
            ${eis.map(m => `<div class="recipe-breakdown-item"><span>${m.name}</span><span>$${formatCLP(m.price)}</span></div>`).join('')}
        </div>`;
    }
    bd += `<div class="recipe-breakdown-total"><span>COSTO TOTAL</span><span>$${formatCLP(r.totalCost)}</span></div>`;

    let sl = `<div class="recipe-selling-section"><div class="recipe-selling-row highlight"><span>💰 Venta entera:</span><span>$${formatCLP(se)}</span></div>`;
    if (r.portions > 1) {
        const sp = Math.round(se / r.portions);
        sl += `<div class="recipe-selling-row"><span>🍰 Por porción (${r.portions}x):</span><span>$${formatCLP(sp)} c/u</span></div>
               <div class="recipe-selling-row"><span>Total porciones:</span><span>$${formatCLP(sp * r.portions)}</span></div>`;
    }
    sl += `</div>`;

    const tip = generateRecipeTip(r);
    const tipH = tip ? `<div class="recipe-tip"><strong>💡 Consejo</strong>${tip}</div>` : '';

    const sourceBadge = r.recipeSource === 'class'
        ? `<div style="font-size:11px;color:var(--secondary-color);font-weight:600;margin-top:4px;">📚 Importada de clase</div>`
        : '';

    return `
        <div class="recipe-card">
            <div class="recipe-card-header">
                <div class="recipe-card-info">
                    <h3>${r.name}</h3>
                    <p>${ti} Items${r.extraSubcategory ? ' + Extra' : ''}</p>
                    ${sourceBadge}
                    ${pb}
                </div>
                <div class="recipe-card-price">
                    <div class="recipe-card-price-label">${pl}</div>
                    <div class="recipe-card-price-value" style="color:${priceColor};">$${formatCLP(dp)}</div>
                </div>
            </div>
            <div class="recipe-card-toggle" id="recipe-toggle-${r.id}" onclick="toggleRecipeDetail('${r.id}')">
                <span>Ver detalle</span><i class='bx bx-chevron-down'></i>
            </div>
            <div class="recipe-card-detail" id="recipe-detail-${r.id}">
                <div class="recipe-detail-content">
                    ${bd}
                    ${sl}
                    ${tipH}
                    <div style="display:flex;gap:10px;margin-top:16px;">
                        <button class="btn-submit" style="margin-top:0;flex:1;" onclick="showAddRecipeModal('${r.id}')"><i class='bx bx-edit'></i> Editar</button>
                        <button class="btn-icon danger" style="width:48px;height:48px;font-size:20px;" onclick="deleteRecipe('${r.id}')"><i class='bx bx-trash'></i></button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ========================================
// SETTINGS
// ========================================
function saveProfitMargin() {
    const v = parseFloat(document.getElementById('profit-margin').value);
    if (isNaN(v) || v < 1) { showToast("Mínimo 1", true); return; }
    profitMargin = v;
    localStorage.setItem('mushu_profit_margin', profitMargin.toString());
    renderRecipes();
    showToast(`Margen x${profitMargin}`);
}

function toggleTeacherMode() {
    const checked = document.getElementById('toggle-teacher-mode').checked;
    const studentSection = document.getElementById('student-name-section');

    if (checked) {
        showTeacherPasswordModal();
        return;
    } else {
        teacherMode.active = false;
        localStorage.setItem('mushu_teacher_mode', JSON.stringify(teacherMode));
        if (studentSection) studentSection.style.display = 'block';
        showToast('Modo Profesor desactivado');
    }

    updateClassesView();
}

function saveStudentName() {
    const name = document.getElementById('student-name-input').value.trim();
    if (!name) { showToast('Ingresa tu nombre', true); return; }
    studentName = name;
    localStorage.setItem('mushu_student_name', studentName);
    showToast(`Nombre guardado: ${studentName}`);
    updateClassesView();
}

// ========================================
// COURSES / CLASSES VIEW
// ========================================
function saveCourses() {
    localStorage.setItem('mushu_courses', JSON.stringify(courses));
}

function saveImportedClasses() {
    localStorage.setItem('mushu_imported_classes', JSON.stringify(importedClasses));
}

function updateClassesView() {
    const teacherView = document.getElementById('teacher-classes-view');
    const studentView = document.getElementById('student-classes-view');
    const noModeView = document.getElementById('no-mode-classes-view');

    if (teacherMode.active) {
        teacherView.style.display = 'block';
        studentView.style.display = 'none';
        noModeView.style.display = 'none';
        renderCourses();
    } else if (studentName) {
        teacherView.style.display = 'none';
        studentView.style.display = 'block';
        noModeView.style.display = 'none';
        renderStudentClassesByFolders();
    } else {
        teacherView.style.display = 'none';
        studentView.style.display = 'none';
        noModeView.style.display = 'block';
    }
}

// ========================================
// COURSES (Teacher)
// ========================================
function showCreateCourseModal(courseId = null) {
    currentCourseStudents = [];
    currentEditingCourseId = null;
    document.getElementById('course-name').value = '';
    document.getElementById('course-base-folder').value = '';
    document.getElementById('course-day').value = 'Lunes';
    document.getElementById('course-schedule').value = '';
    document.getElementById('modal-course-title').textContent = 'Crear Curso';

    if (courseId) {
        const course = courses.find(c => String(c.id) === String(courseId));
        if (course) {
            currentEditingCourseId = String(course.id);
            document.getElementById('course-name').value = course.name;
            document.getElementById('course-base-folder').value = course.baseFolder || '';
            document.getElementById('course-day').value = course.day;
            document.getElementById('course-schedule').value = course.schedule || '';
            currentCourseStudents = [...(course.students || [])];
            document.getElementById('modal-course-title').textContent = 'Editar Curso';
        }
    }

    renderCourseStudents();
    document.getElementById('modal-course').classList.add('active');
}

function addStudentToCourse() {
    const input = document.getElementById('course-add-student');
    const name = input.value.trim();
    if (!name) { showToast('Ingresa un nombre', true); return; }
    if (currentCourseStudents.find(s => s.name.toLowerCase() === name.toLowerCase())) {
        showToast('Alumno ya existe', true);
        return;
    }
    currentCourseStudents.push({ id: Date.now().toString(), name: name });
    input.value = '';
    renderCourseStudents();
}

function removeStudentFromCourse(studentId) {
    currentCourseStudents = currentCourseStudents.filter(s => String(s.id) !== String(studentId));
    renderCourseStudents();
}

function renderCourseStudents() {
    const list = document.getElementById('course-students-list');
    if (currentCourseStudents.length === 0) {
        list.innerHTML = '<div style="padding:10px;font-size:13px;color:var(--text-muted);text-align:center;">Sin alumnos aún</div>';
        return;
    }
    list.innerHTML = currentCourseStudents.map(s => `
        <div class="course-student-item">
            <span>👤 ${s.name}</span>
            <button onclick="removeStudentFromCourse('${s.id}')"><i class='bx bx-x'></i></button>
        </div>
    `).join('');
}

function saveCourse() {
    const name = document.getElementById('course-name').value.trim();
    const baseFolder = document.getElementById('course-base-folder').value.trim();
    const day = document.getElementById('course-day').value;
    const schedule = document.getElementById('course-schedule').value.trim();

    if (!name) { showToast('Ingresa nombre del curso', true); return; }
    if (!baseFolder) { showToast('Ingresa carpeta base', true); return; }
    if (currentCourseStudents.length === 0) { showToast('Agrega al menos un alumno', true); return; }

    if (currentEditingCourseId) {
        const idx = courses.findIndex(c => String(c.id) === String(currentEditingCourseId));
        if (idx !== -1) {
            courses[idx] = {
                ...courses[idx],
                name, baseFolder, day, schedule,
                students: currentCourseStudents
            };
            showToast('Curso actualizado!');
        }
    } else {
        courses.push({
            id: Date.now().toString(),
            name,
            baseFolder,
            day,
            schedule,
            students: currentCourseStudents,
            classes: []
        });
        showToast('Curso creado!');
    }

    saveCourses();
    renderCourses();
    closeModal('modal-course');
}

function deleteCourse(courseId) {
    if (!confirm('¿Eliminar este curso y todas sus clases?')) return;
    courses = courses.filter(c => String(c.id) !== String(courseId));
    saveCourses();
    renderCourses();
    showToast('Curso eliminado');
}

function renderCourses() {
    const list = document.getElementById('courses-list');
    if (courses.length === 0) {
        list.innerHTML = '<div class="empty-state">No hay cursos. Crea tu primer curso.</div>';
        return;
    }

    list.innerHTML = courses.map((course, idx) => {
        const bodyOpen = idx === 0 ? 'open' : '';
        const classesHTML = (course.classes || []).sort((a, b) => new Date(b.date) - new Date(a.date)).map(cls => {
            const att = cls.attendance || [];
            const present = att.filter(a => a.present).length;
            const total = att.length;
            return `
                <div class="class-item">
                    <div class="class-item-info" onclick="showAttendanceModal('${course.id}', '${cls.id}')">
                        <h4>${cls.name}</h4>
                        <p>📅 ${formatDate(cls.date)} • ✅ ${present}/${total}</p>
                    </div>
                    <div class="class-item-actions">
                        <button class="btn-icon" style="width:28px;height:28px;font-size:14px;" onclick="showEditClassModal('${course.id}','${cls.id}')"><i class='bx bx-edit'></i></button>
                        <button class="btn-icon" style="width:28px;height:28px;font-size:14px;" onclick="showAttendanceModal('${course.id}','${cls.id}')"><i class='bx bx-clipboard'></i></button>
                        <button class="btn-icon danger" style="width:28px;height:28px;font-size:14px;" onclick="deleteClass('${course.id}','${cls.id}')"><i class='bx bx-trash'></i></button>
                    </div>
                </div>`;
        }).join('');

        const folderId = course.id;

        return `
            <div class="course-card">
                <div class="course-card-header" onclick="toggleFolderBody('course-folder','${folderId}')">
                    <div class="course-card-header-left">
                        <i class='bx bxs-graduation' style="font-size:24px;color:var(--secondary-color);"></i>
                        <div>
                            <h3>${course.name}</h3>
                            <div class="course-card-day">${course.day}</div>
                            <div class="course-card-schedule">${course.schedule || ''} • ${course.students.length} alumnos • Carpeta: ${course.baseFolder}</div>
                        </div>
                    </div>
                    <div class="course-card-actions" onclick="event.stopPropagation()">
                        <button class="btn-icon" style="width:28px;height:28px;font-size:14px;" onclick="showCreateCourseModal('${course.id}')"><i class='bx bx-edit'></i></button>
                        <button class="btn-icon danger" style="width:28px;height:28px;font-size:14px;" onclick="deleteCourse('${course.id}')"><i class='bx bx-trash'></i></button>
                    </div>
                </div>
                <div class="course-card-body ${bodyOpen}" id="course-folder-body-${folderId}">
                    ${classesHTML}
                    <button class="btn-add-class" onclick="showCreateClassModal('${course.id}')">
                        <i class='bx bx-plus'></i> Nueva Clase
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ========================================
// CLASSES (Teacher)
// ========================================
function showCreateClassModal(courseId) {
    currentEditingClassId = null;
    currentClassPhotos = [];
    currentSelectedClassRecipe = null;

    document.getElementById('class-name').value = '';
    document.getElementById('class-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('class-tips').value = '';
    document.getElementById('class-photos-preview').innerHTML = '';
    document.getElementById('selected-class-recipe-box').style.display = 'none';
    document.getElementById('selected-class-recipe-box').innerHTML = '';
    document.getElementById('modal-class-title').textContent = 'Crear Clase';

    const courseSelect = document.getElementById('class-course-select');
    courseSelect.innerHTML = courses.map(c =>
        `<option value="${c.id}" ${String(c.id) === String(courseId) ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    document.getElementById('modal-create-class').classList.add('active');
}

function showEditClassModal(courseId, classId) {
    const course = courses.find(c => String(c.id) === String(courseId));
    if (!course) return;
    const cls = (course.classes || []).find(cl => String(cl.id) === String(classId));
    if (!cls) return;

    currentEditingClassId = classId;
    currentClassPhotos = [...(cls.photos || [])];
    currentSelectedClassRecipe = cls.linkedRecipe ? JSON.parse(JSON.stringify(cls.linkedRecipe)) : null;

    document.getElementById('class-name').value = cls.name;
    document.getElementById('class-date').value = cls.date;
    document.getElementById('class-tips').value = cls.tips || '';
    document.getElementById('modal-class-title').textContent = 'Editar Clase';

    const courseSelect = document.getElementById('class-course-select');
    courseSelect.innerHTML = courses.map(c =>
        `<option value="${c.id}" ${String(c.id) === String(courseId) ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    renderClassPhotosPreview();
    renderSelectedClassRecipeBox();

    document.getElementById('modal-create-class').classList.add('active');
}

function selectExistingRecipeForClass() {
    if (recipes.length === 0) {
        showToast('No hay recetas aún. Crea una primero.', true);
        return;
    }

    const names = recipes.map((r, i) => `${i + 1}. ${r.name} (${r.recipeFolder || 'Mis Recetas'})`).join('\n');
    const pick = prompt(`Selecciona el número de la receta:\n\n${names}`);
    const idx = parseInt(pick) - 1;

    if (isNaN(idx) || idx < 0 || idx >= recipes.length) return;

    currentSelectedClassRecipe = JSON.parse(JSON.stringify(recipes[idx]));
    renderSelectedClassRecipeBox();
    showToast(`Receta "${currentSelectedClassRecipe.name}" seleccionada`);
}

function createNewRecipeForClass() {
    const courseId = document.getElementById('class-course-select').value;
    const course = courses.find(c => String(c.id) === String(courseId));
    if (!course) { showToast('Selecciona un curso', true); return; }

    currentEditingRecipeId = null;
    document.getElementById('recipe-name').value = '';
    document.getElementById('recipe-portions').value = '';
    currentRecipeIngredients = [];
    currentRecipeDecorations = [];
    currentRecipeExtra = null;

    document.querySelector('#modal-recipe h3').textContent = "Crear Receta para Clase";
    document.getElementById('recipe-folder-group').style.display = 'block';
    document.getElementById('recipe-folder-input').value = course.baseFolder || course.name;

    renderCurrentRecipeIngredients();
    renderCurrentRecipeDecorations();
    updateMaterialSelect();
    updateDecorationSelect();
    updateExtraSubcategorySelect();
    renderExtraInRecipe();
    updateRecipeTotal();

    closeModal('modal-create-class');
    document.getElementById('modal-recipe').classList.add('active');
}

function renderSelectedClassRecipeBox() {
    const box = document.getElementById('selected-class-recipe-box');
    if (!currentSelectedClassRecipe) {
        box.style.display = 'none';
        box.innerHTML = '';
        return;
    }

    box.style.display = 'block';
    box.className = 'selected-class-recipe-box';
    box.innerHTML = `
        <strong>📖 ${currentSelectedClassRecipe.name}</strong>
        <p>Costo: $${formatCLP(currentSelectedClassRecipe.totalCost)} • ${currentSelectedClassRecipe.portions > 1 ? currentSelectedClassRecipe.portions + ' porciones' : 'Entera'}</p>
        <div class="selected-class-recipe-actions">
            <button class="change" onclick="selectExistingRecipeForClass()">Cambiar</button>
            <button class="clear" onclick="clearSelectedClassRecipe()">Quitar</button>
        </div>
    `;
}

function clearSelectedClassRecipe() {
    currentSelectedClassRecipe = null;
    renderSelectedClassRecipeBox();
}

function handleClassPhotos(event) {
    const files = Array.from(event.target.files);
    if (currentClassPhotos.length + files.length > 5) {
        showToast('Máximo 5 fotos', true);
        return;
    }

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                const maxW = 800;
                let w = img.width, h = img.height;
                if (w > maxW) {
                    h = Math.round(h * maxW / w);
                    w = maxW;
                }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const compressed = canvas.toDataURL('image/jpeg', 0.7);
                currentClassPhotos.push(compressed);
                renderClassPhotosPreview();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

    event.target.value = '';
}

function removeClassPhoto(index) {
    currentClassPhotos.splice(index, 1);
    renderClassPhotosPreview();
}

function renderClassPhotosPreview() {
    const preview = document.getElementById('class-photos-preview');
    if (currentClassPhotos.length === 0) { preview.innerHTML = ''; return; }

    preview.innerHTML = currentClassPhotos.map((photo, i) => `
        <div class="class-photo-container">
            <img src="${photo}" class="class-photo-thumb">
            <button class="class-photo-remove" onclick="removeClassPhoto(${i})"><i class='bx bx-x'></i></button>
        </div>
    `).join('');
}

function onClassCourseChange() { }

function saveClass() {
    const courseId = document.getElementById('class-course-select').value;
    const name = document.getElementById('class-name').value.trim();
    const date = document.getElementById('class-date').value;
    const tips = document.getElementById('class-tips').value.trim();
    const codeExpiry = parseInt(document.getElementById('class-code-expiry').value);

    if (!name) { showToast('Ingresa nombre de clase', true); return; }
    if (!date) { showToast('Selecciona fecha', true); return; }
    if (!currentSelectedClassRecipe) { showToast('Debes seleccionar o crear una receta', true); return; }

    const course = courses.find(c => String(c.id) === String(courseId));
    if (!course) { showToast('Selecciona un curso', true); return; }

    if (currentEditingClassId) {
        const cls = (course.classes || []).find(cl => String(cl.id) === String(currentEditingClassId));
        if (!cls) return;

        cls.name = name;
        cls.date = date;
        cls.tips = tips;
        cls.photos = [...currentClassPhotos];
        cls.linkedRecipe = JSON.parse(JSON.stringify(currentSelectedClassRecipe));
        cls.linkedRecipeId = currentSelectedClassRecipe.id;
        cls.codeExpiry = codeExpiry;
        showToast('Clase actualizada!');
    } else {
        const attendance = course.students.map(s => ({
            studentId: s.id,
            studentName: s.name,
            present: false,
            code: null,
            codeData: null,
            codeUsed: false,
            activatedAt: null
        }));

        const newClass = {
            id: Date.now().toString(),
            name,
            date,
            tips,
            photos: [...currentClassPhotos],
            linkedRecipeId: currentSelectedClassRecipe.id,
            linkedRecipe: JSON.parse(JSON.stringify(currentSelectedClassRecipe)),
            codeExpiry,
            attendance,
            codesGenerated: false
        };

        if (!course.classes) course.classes = [];
        course.classes.push(newClass);
        showToast('Clase creada! 🎓');
    }

    saveCourses();
    renderCourses();
    closeModal('modal-create-class');
}

function deleteClass(courseId, classId) {
    if (!confirm('¿Eliminar esta clase?')) return;
    const course = courses.find(c => String(c.id) === String(courseId));
    if (!course) return;
    course.classes = (course.classes || []).filter(cl => String(cl.id) !== String(classId));
    saveCourses();
    renderCourses();
    showToast('Clase eliminada');
}

// ========================================
// ATTENDANCE + CODES
// ========================================
function showAttendanceModal(courseId, classId) {
    currentAttendanceCourseId = courseId;
    currentAttendanceClassId = classId;

    const course = courses.find(c => String(c.id) === String(courseId));
    if (!course) return;
    const cls = (course.classes || []).find(cl => String(cl.id) === String(classId));
    if (!cls) return;

    currentAttendanceData = JSON.parse(JSON.stringify(cls.attendance || []));

    document.getElementById('attendance-class-info').innerHTML = `
        <div style="text-align:center;margin-bottom:16px;">
            <h4 style="margin:0 0 4px;">${cls.name}</h4>
            <p style="font-size:13px;color:var(--text-muted);margin:0;">📅 ${formatDate(cls.date)} • ${course.name}</p>
        </div>`;

    renderAttendanceList();

    const codesSection = document.getElementById('generated-codes-section');
    if (cls.codesGenerated) {
        document.getElementById('btn-generate-codes').style.display = 'flex';
        codesSection.style.display = 'block';
        renderGeneratedCodes(cls);
    } else {
        document.getElementById('btn-generate-codes').style.display = 'flex';
        codesSection.style.display = 'none';
    }

    document.getElementById('modal-attendance').classList.add('active');
}

function toggleAttendance(studentId) {
    const student = currentAttendanceData.find(a => String(a.studentId) === String(studentId));
    if (student) {
        student.present = !student.present;
        renderAttendanceList();
    }
}

function saveAttendanceOnly() {
    const course = courses.find(c => String(c.id) === String(currentAttendanceCourseId));
    if (!course) return;
    const cls = (course.classes || []).find(cl => String(cl.id) === String(currentAttendanceClassId));
    if (!cls) return;
    cls.attendance = JSON.parse(JSON.stringify(currentAttendanceData));
    saveCourses();
    renderAttendanceList();
    showToast('Asistencia guardada');
}

function renderAttendanceList() {
    const list = document.getElementById('attendance-list');
    list.innerHTML = currentAttendanceData.map(a => {
        const statusIcon = a.present ? '✅' : '❌';
        let codeStatus = '';
        if (a.code) {
            codeStatus = a.codeUsed
                ? `<span class="attendance-code-status sent">📋 enviado</span>`
                : `<span class="attendance-code-status pending">⚠️ pendiente</span>`;
        }
        return `
            <div class="attendance-item">
                <div class="attendance-left">
                    <span class="attendance-status" onclick="toggleAttendance('${a.studentId}')">${statusIcon}</span>
                    <span class="attendance-name">${a.studentName}</span>
                </div>
                ${codeStatus}
            </div>`;
    }).join('');
}

function generateCodes() {
    const course = courses.find(c => String(c.id) === String(currentAttendanceCourseId));
    if (!course) return;
    const cls = (course.classes || []).find(cl => String(cl.id) === String(currentAttendanceClassId));
    if (!cls) return;

    currentAttendanceData.forEach(a => {
        const initials = a.studentName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);
        const dayCode = course.day.slice(0, 2).toUpperCase();
        const dateCode = cls.date.replace(/-/g, '').slice(4);
        const type = a.present ? 'P' : 'A';
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();

        const codeData = {
            className: cls.name,
            courseId: course.id,
            courseName: course.name,
            baseFolder: course.baseFolder,
            classId: cls.id,
            studentName: a.studentName,
            present: a.present,
            date: cls.date,
            tips: cls.tips,
            photos: cls.photos,
            linkedRecipe: cls.linkedRecipe,
            expiry: cls.codeExpiry > 0 ? new Date(Date.now() + cls.codeExpiry * 3600000).toISOString() : null
        };

        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(codeData))));
        const shortCode = `MUSH-${dayCode}${dateCode}-${initials}-${type}-${rand}`;

        a.code = shortCode;
        a.codeData = encoded;
        a.codeUsed = false;
    });

    cls.attendance = JSON.parse(JSON.stringify(currentAttendanceData));
    cls.codesGenerated = true;
    saveCourses();

    document.getElementById('generated-codes-section').style.display = 'block';
    renderGeneratedCodes(cls);
    renderAttendanceList();
    showToast('Códigos generados! 📋');
}

function regenerateCodes() {
    if (!confirm('¿Regenerar códigos? Los anteriores quedarán obsoletos.')) return;
    generateCodes();
    showToast('Códigos regenerados 🔄');
}

function renderGeneratedCodes(cls) {
    const list = document.getElementById('generated-codes-list');
    const att = cls.attendance || [];
    const present = att.filter(a => a.present);
    const absent = att.filter(a => !a.present);

    let html = '';
    if (present.length > 0) {
        html += `<div style="font-size:13px;font-weight:600;color:var(--success-color);margin:8px 0;">✅ Presentes (${present.length})</div>`;
        html += present.map(a => renderCodeItem(a)).join('');
    }
    if (absent.length > 0) {
        html += `<div style="font-size:13px;font-weight:600;color:var(--warning-color);margin:8px 0;">❌ Ausentes (${absent.length})</div>`;
        html += absent.map(a => renderCodeItem(a)).join('');
    }
    list.innerHTML = html;
}

function renderCodeItem(a) {
    return `
        <div class="code-item">
            <div>
                <div class="code-item-left">
                    <span class="code-item-status">${a.present ? '✅' : '❌'}</span>
                    <span class="code-item-name">${a.studentName}</span>
                </div>
                <div class="code-item-code">${a.codeData ? a.codeData.slice(0, 40) + '...' : ''}</div>
            </div>
            <button class="code-item-copy" onclick="copySingleCode('${a.studentId}')">Copiar</button>
        </div>`;
}

function copySingleCode(studentId) {
    const a = currentAttendanceData.find(x => String(x.studentId) === String(studentId));
    if (!a || !a.codeData) return;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(a.codeData).then(() => {
            a.codeUsed = true;
            saveAttendanceOnly();
            renderAttendanceList();
            showToast(`Código de ${a.studentName} copiado!`);
        });
    } else {
        const ta = document.createElement('textarea');
        ta.value = a.codeData;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        a.codeUsed = true;
        saveAttendanceOnly();
        renderAttendanceList();
        showToast(`Código de ${a.studentName} copiado!`);
    }
}

function copyAllCodes() {
    const allCodes = currentAttendanceData
        .filter(a => a.codeData)
        .map(a => `${a.studentName} (${a.present ? 'Presente' : 'Ausente'}):\n${a.codeData}`)
        .join('\n\n');

    if (navigator.clipboard) {
        navigator.clipboard.writeText(allCodes).then(() => {
            currentAttendanceData.forEach(a => { if (a.code) a.codeUsed = true; });
            saveAttendanceOnly();
            renderAttendanceList();
            showToast('Todos los códigos copiados!');
        });
    } else {
        const ta = document.createElement('textarea');
        ta.value = allCodes;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        currentAttendanceData.forEach(a => { if (a.code) a.codeUsed = true; });
        saveAttendanceOnly();
        renderAttendanceList();
        showToast('Todos los códigos copiados!');
    }
}

// ========================================
// STUDENT IMPORT CLASS + CHECK MATERIALS
// ========================================
function showImportClassModal() {
    document.getElementById('import-class-code').value = '';
    document.getElementById('modal-import-class').classList.add('active');
}

function normalizeName(str) {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function getMissingMaterialsForRecipe(recipe) {
    const needed = [];
    const all = [...(recipe.ingredients || []), ...(recipe.decorations || [])];

    all.forEach(item => {
        const exists = materials.some(m => normalizeName(m.name) === normalizeName(item.name));
        if (!exists && !needed.find(n => normalizeName(n.name) === normalizeName(item.name))) {
            needed.push({
                name: item.name,
                category: (recipe.decorations || []).some(d => normalizeName(d.name) === normalizeName(item.name)) ? 'decoracion' : 'productos'
            });
        }
    });

    return needed;
}

function importClassFromCode() {
    const codeInput = document.getElementById('import-class-code').value.trim();
    if (!codeInput) { showToast('Pega un código', true); return; }

    try {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(codeInput))));

        if (!decoded.className || !decoded.linkedRecipe) {
            showToast('Código inválido', true);
            return;
        }

        if (decoded.expiry && new Date(decoded.expiry) < new Date()) {
            showToast('Este código ha expirado ⏰', true);
            return;
        }

        const existing = importedClasses.find(ic =>
            ic.classId === decoded.classId && ic.studentName === decoded.studentName
        );
        if (existing) {
            showToast('Ya importaste esta clase', true);
            return;
        }

        const missing = getMissingMaterialsForRecipe(decoded.linkedRecipe);
        if (missing.length > 0) {
            pendingImportClassData = decoded;
            showMissingMaterialsModal(missing);
            closeModal('modal-import-class');
            return;
        }

        completeClassImport(decoded);

    } catch (err) {
        console.error(err);
        showToast('Código inválido o corrupto', true);
    }
}

function showMissingMaterialsModal(missing) {
    const list = document.getElementById('missing-materials-list');
    list.innerHTML = missing.map((m, i) => `
        <div class="missing-material-item">
            <h4><i class='bx bx-error-circle'></i> ${m.name}</h4>
            <div class="form-row">
                <div class="form-group">
                    <label>Precio (CLP)</label>
                    <input type="number" id="missing-price-${i}" placeholder="990" min="0">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Cantidad Base</label>
                    <input type="number" id="missing-qty-${i}" placeholder="1" min="0.01" step="0.01">
                </div>
                <div class="form-group">
                    <label>Unidad</label>
                    <select id="missing-unit-${i}">
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="l">L</option>
                        <option value="cm3">mL</option>
                        <option value="u">u</option>
                    </select>
                </div>
            </div>
            <input type="hidden" id="missing-name-${i}" value="${m.name}">
            <input type="hidden" id="missing-category-${i}" value="${m.category}">
        </div>
    `).join('');
    document.getElementById('modal-missing-materials').classList.add('active');
}

function saveMissingMaterialsAndContinue() {
    const items = document.querySelectorAll('[id^="missing-name-"]');

    for (let i = 0; i < items.length; i++) {
        const name = document.getElementById(`missing-name-${i}`).value;
        const category = document.getElementById(`missing-category-${i}`).value;
        const price = parseFloat(document.getElementById(`missing-price-${i}`).value);
        const qty = parseFloat(document.getElementById(`missing-qty-${i}`).value);
        const unit = document.getElementById(`missing-unit-${i}`).value;

        if (!name || isNaN(price) || isNaN(qty) || qty <= 0) {
            showToast('Completa todos los materiales faltantes', true);
            return;
        }

        materials.push({
            id: Date.now().toString() + '-' + i,
            name,
            price,
            qty,
            unit,
            category,
            subcategory: '',
            priceHistory: [{ date: new Date().toISOString().slice(0, 10), price }]
        });
    }

    saveMaterialsToStorage();
    renderMaterials();
    updateMaterialSelect();
    updateDecorationSelect();
    updateExtraSubcategorySelect();

    closeModal('modal-missing-materials');

    if (pendingImportClassData) {
        completeClassImport(pendingImportClassData);
        pendingImportClassData = null;
    }
}

function completeClassImport(decoded) {
    const importedClass = {
        id: Date.now().toString(),
        classId: decoded.classId,
        className: decoded.className,
        courseName: decoded.courseName,
        baseFolder: decoded.baseFolder || decoded.courseName,
        studentName: decoded.studentName,
        present: decoded.present,
        date: decoded.date,
        tips: decoded.tips || '',
        photos: decoded.photos || [],
        linkedRecipe: decoded.linkedRecipe,
        importedAt: new Date().toISOString()
    };

    importedClasses.push(importedClass);
    saveImportedClasses();

    const recipeCopy = JSON.parse(JSON.stringify(decoded.linkedRecipe));
    recipeCopy.id = Date.now().toString() + '-class';
    recipeCopy.recipeFolder = decoded.courseName;
    recipeCopy.recipeSource = 'class';
    recipeCopy.sourceCourseName = decoded.courseName;
    recipeCopy.sourceClassDate = decoded.date;

    const alreadyExists = recipes.find(r =>
        r.name === recipeCopy.name &&
        r.recipeFolder === recipeCopy.recipeFolder &&
        r.sourceClassDate === recipeCopy.sourceClassDate
    );

    if (!alreadyExists) {
        recipes.push(recipeCopy);
        saveRecipesToStorage();
    }

    renderImportedClasses();
    renderStudentClassesByFolders();
    renderRecipes();
    closeModal('modal-import-class');

    if (decoded.present) {
        showToast('Clase importada! 🎓');
    } else {
        showToast('Material de repaso importado 📖');
    }
}

// ========================================
// STUDENT CLASSES BY FOLDER
// ========================================
function renderStudentClassesByFolders() {
    const list = document.getElementById('student-class-folders-list');
    if (importedClasses.length === 0) {
        list.innerHTML = '<div class="empty-state">No hay clases importadas todavía.</div>';
        return;
    }

    const folders = {};
    importedClasses.forEach(ic => {
        const folder = ic.courseName;
        if (!folders[folder]) folders[folder] = [];
        folders[folder].push(ic);
    });

    const names = Object.keys(folders).sort((a, b) => a.localeCompare(b));

    list.innerHTML = names.map((folderName, idx) => {
        const folderId = folderName.replace(/[^a-zA-Z0-9]/g, '_');
        const classes = folders[folderName].sort((a, b) => new Date(b.date) - new Date(a.date));

        return `
            <div class="folder-card">
                <div class="folder-card-header" onclick="toggleFolderBody('student-class-folder','${folderId}')">
                    <div class="folder-card-left">
                        <i class='bx bxs-graduation' style="font-size:22px;color:var(--secondary-color);"></i>
                        <div>
                            <h3>${folderName}</h3>
                            <p>${classes.length} clase${classes.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <i class='bx bx-chevron-down folder-card-chevron' id="student-class-folder-chevron-${folderId}" style="transform:${idx === 0 ? 'rotate(0deg)' : 'rotate(-90deg)'};"></i>
                </div>
                <div class="folder-card-body ${idx === 0 ? 'open' : ''}" id="student-class-folder-body-${folderId}">
                    ${classes.map(ic => `
                        <div class="imported-class-card" onclick="viewImportedClass('${ic.id}')">
                            <h3>${ic.className}</h3>
                            <p>📅 ${formatDate(ic.date)}</p>
                            <span class="class-content-badge ${ic.present ? 'present' : 'absent'}">
                                ${ic.present ? '✅ Clase' : '⚠️ Material de repaso'}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function renderImportedClasses() {
    renderStudentClassesByFolders();
}

function viewImportedClass(classId) {
    const ic = importedClasses.find(x => String(x.id) === String(classId));
    if (!ic) return;

    const watermarkName = studentName || ic.studentName || 'Alumno';
    document.getElementById('view-class-title').textContent = ic.className;

    let html = '';

    html += `<div class="class-content-header">
        <h2>${ic.className}</h2>
        <p>📅 ${formatDate(ic.date)} • ${ic.courseName}</p>
        <span class="class-content-badge ${ic.present ? 'present' : 'absent'}">
            ${ic.present ? '✅ Asistencia registrada' : '⚠️ Material de repaso - No registra asistencia'}
        </span>
    </div>`;

    if (ic.photos && ic.photos.length > 0) {
        html += `<div class="class-content-section">
            <h4><i class='bx bx-camera'></i> Fotos</h4>
            <div class="class-content-photos">
                ${ic.photos.map(p => `
                    <div class="class-content-photo">
                        <img src="${p}" alt="Foto de clase">
                        <div class="watermark-photo">${watermarkName}</div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    if (ic.tips) {
        html += `<div class="class-content-section">
            <h4><i class='bx bx-bulb'></i> Tips de la Profe</h4>
            <div class="class-content-tips">
                <div class="watermark">${watermarkName}</div>
                ${ic.tips.replace(/\n/g, '<br>')}
            </div>
        </div>`;
    }

    if (ic.linkedRecipe) {
        const r = ic.linkedRecipe;
        const ic2 = (r.ingredients || []).reduce((s, i) => s + i.cost, 0);
        const dc2 = (r.decorations || []).reduce((s, i) => s + i.cost, 0);
        const ec2 = r.extraCost || 0;

        html += `<div class="class-content-section">
            <h4><i class='bx bx-calculator'></i> Receta y Costos</h4>
            <div style="background:var(--surface-hover);border-radius:var(--radius-sm);padding:12px;position:relative;overflow:hidden;">
                <div class="watermark">${watermarkName}</div>
                <div style="font-weight:700;font-size:16px;margin-bottom:8px;">${r.name}</div>
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;"><span>Ingredientes:</span><span>$${formatCLP(ic2)}</span></div>
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;"><span>Decoración:</span><span>$${formatCLP(dc2)}</span></div>
                ${ec2 > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;"><span>Extra:</span><span>$${formatCLP(ec2)}</span></div>` : ''}
                <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid rgba(0,0,0,0.08);margin-top:4px;font-weight:700;font-size:16px;"><span>COSTO TOTAL</span><span>$${formatCLP(r.totalCost)}</span></div>
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;color:var(--secondary-color);font-weight:600;"><span>💰 Venta sugerida (x${profitMargin}):</span><span>$${formatCLP(Math.floor((r.totalCost * profitMargin) / 500) * 500)}</span></div>
                ${r.portions > 1 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:var(--text-muted);"><span>🍰 Por porción (${r.portions}x):</span><span>$${formatCLP(Math.round(Math.floor((r.totalCost * profitMargin) / 500) * 500 / r.portions))} c/u</span></div>` : ''}
            </div>
        </div>`;
    }

    document.getElementById('view-class-content').innerHTML = html;
    document.getElementById('modal-view-class').classList.add('active');
}

// ========================================
// EXPORT / IMPORT
// ========================================
function exportData() {
    const d = {
        version: '3.4',
        exportDate: new Date().toISOString(),
        materials,
        recipes,
        courses,
        importedClasses,
        extraSubcategories: JSON.parse(localStorage.getItem('mushu_extra_subcategories') || '[]'),
        profitMargin,
        teacherMode,
        studentName
    };
    const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = `mushuapp_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(u);
    showToast("Exportado! 📦");
}

function importData(event) {
    const f = event.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = function (e) {
        try {
            const d = JSON.parse(e.target.result);
            if (!d.materials || !d.recipes) { showToast("Archivo inválido", true); return; }
            if (!confirm(`¿Importar ${d.materials.length} materiales y ${d.recipes.length} recetas?`)) return;

            materials = d.materials;
            recipes = d.recipes;
            profitMargin = d.profitMargin || 2;
            if (d.courses) courses = d.courses;
            if (d.importedClasses) importedClasses = d.importedClasses;
            if (d.teacherMode) {
                teacherMode = d.teacherMode;
                localStorage.setItem('mushu_teacher_mode', JSON.stringify(teacherMode));
            }
            if (d.studentName) {
                studentName = d.studentName;
                localStorage.setItem('mushu_student_name', studentName);
            }
            if (d.extraSubcategories) {
                localStorage.setItem('mushu_extra_subcategories', JSON.stringify(d.extraSubcategories));
            }

            saveMaterialsToStorage();
            saveRecipesToStorage();
            saveCourses();
            saveImportedClasses();
            localStorage.setItem('mushu_profit_margin', profitMargin.toString());

            normalizeExistingRecipes();
            renderMaterials();
            renderRecipes();
            updateMaterialSelect();
            updateDecorationSelect();
            updateExtraSubcategorySelect();
            updateClassesView();

            showToast(`Importado ✅`);
        } catch (err) {
            showToast("Error", true);
        }
    };
    r.readAsText(f);
    event.target.value = '';
}

// ========================================
// UTILS
// ========================================
function formatCLP(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatDate(ds) {
    const ms = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const d = new Date(ds + 'T00:00:00');
    return `${d.getDate()} ${ms[d.getMonth()]} ${d.getFullYear()}`;
}
