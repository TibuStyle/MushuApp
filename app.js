// === MushuApp v4.0 estable - Parte 1/2 ===

// --- CONFIG ---
const TEACHER_MASTER_PASSWORD = 'amormiomucushu88';

// --- Data State ---
let materials = JSON.parse(localStorage.getItem('mushu_materials')) || [];
let recipes = JSON.parse(localStorage.getItem('mushu_recipes')) || [];
let modules = JSON.parse(localStorage.getItem('mushu_modules')) || [];
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

// Modules / Classes
let currentEditingModuleId = null;
let currentCourseStudents = [];
let currentEditingCourseId = null;
let currentClassPhotos = [];
let currentEditingClassId = null;
let currentAttendanceCourseId = null;
let currentAttendanceClassId = null;
let currentAttendanceData = [];
let currentSelectedClassRecipe = null;
let pendingImportClassData = null;

// Confirm modal
let currentConfirmAction = null;

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    const sm = localStorage.getItem('mushu_profit_margin');
    if (sm) profitMargin = parseFloat(sm);

    normalizeExistingRecipes();
    normalizeExistingCourses();
    renderMaterials();
    updateRecipesView();
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

// --- Normalize old courses ---
function normalizeExistingCourses() {
    let changed = false;

    courses.forEach(course => {
        if (!course.moduleId) {
            course.moduleId = '';
            changed = true;
        }
        if (!course.moduleName) {
            course.moduleName = '';
            changed = true;
        }

        if (!course.students) course.students = [];
        course.students.forEach((student, index) => {
            if (!student.studentCode) {
                student.studentCode = String(index + 1).padStart(2, '0');
                changed = true;
            }
        });

        if (course.classes) {
            course.classes.forEach(cls => {
                if (!cls.blockCode) {
                    cls.blockCode = generateClassBlockCode();
                    changed = true;
                }
                if (cls.attendance) {
                    cls.attendance.forEach((a, index) => {
                        if (!a.studentCode) {
                            const st = course.students.find(s => String(s.id) === String(a.studentId));
                            a.studentCode = st ? st.studentCode : String(index + 1).padStart(2, '0');
                            changed = true;
                        }
                    });
                }
            });
        }
    });

    if (changed) saveCourses();
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
    if (tabName === 'recetas') updateRecipesView();
}

// --- Generic toggle folders ---
function toggleFolderBody(idPrefix, id) {
    const body = document.getElementById(`${idPrefix}-body-${id}`);
    const chevron = document.getElementById(`${idPrefix}-chevron-${id}`);
    if (!body || !chevron) return;
    body.classList.toggle('open');
    chevron.style.transform = body.classList.contains('open') ? 'rotate(0deg)' : 'rotate(-90deg)';
}

// --- Confirm Modal ---
function showConfirmModal(title, message, action) {
    document.getElementById('confirm-title').textContent = title || 'Confirmar acción';
    document.getElementById('confirm-message').textContent = message || '¿Estás seguro?';
    currentConfirmAction = action;

    const btn = document.getElementById('confirm-accept-btn');
    btn.onclick = () => {
        if (typeof currentConfirmAction === 'function') currentConfirmAction();
        currentConfirmAction = null;
        closeModal('modal-confirm');
    };

    document.getElementById('modal-confirm').classList.add('active');
}

// --- Utilities for codes ---
function sanitizePrefix(text) {
    return (text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
}

function generateClassBlockCode() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const l1 = letters[Math.floor(Math.random() * letters.length)];
    const l2 = letters[Math.floor(Math.random() * letters.length)];
    const n = Math.floor(100 + Math.random() * 900);
    return `${l1}${n}${l2}`;
}

function buildVisibleShortCode(modulePrefix, blockCode, studentCode) {
    return `${modulePrefix}${blockCode}${studentCode}`;
}

// --- Basic modals ---
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

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

function filterMaterials() {
    renderMaterials();
}

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
    showConfirmModal(
        'Eliminar subcategoría',
        `¿Eliminar "${sc}" y todos sus elementos?`,
        () => {
            materials = materials.filter(m => !(m.category === 'extra' && m.subcategory === sc));
            let s = JSON.parse(localStorage.getItem('mushu_extra_subcategories') || '[]');
            s = s.filter(x => x !== sc);
            localStorage.setItem('mushu_extra_subcategories', JSON.stringify(s));
            saveMaterialsToStorage();
            renderMaterials();
            updateExtraSubcategorySelect();
            showToast(`"${sc}" eliminada`);
        }
    );
}


// ========================================
// MODULES
// ========================================
function saveModules() {
    localStorage.setItem('mushu_modules', JSON.stringify(modules));
}

function saveModule() {
    const name = document.getElementById('module-name').value.trim();
    const prefix = sanitizePrefix(document.getElementById('module-prefix').value.trim());

    if (!name) { showToast('Ingresa nombre del módulo', true); return; }
    if (!prefix || prefix.length < 2) { showToast('Ingresa prefijo válido', true); return; }

    if (currentEditingModuleId) {
        const idx = modules.findIndex(m => String(m.id) === String(currentEditingModuleId));
        if (idx !== -1) {
            modules[idx] = { ...modules[idx], name, prefix };
            showToast('Módulo actualizado!');
        }
    } else {
        modules.push({
            id: Date.now().toString(),
            name,
            prefix
        });
        showToast('Módulo creado!');
    }

    saveModules();
    updateRecipesView();
    closeModal('modal-module');
}

function deleteModule(moduleId) {
    showConfirmModal(
        'Eliminar módulo',
        '¿Eliminar este módulo? Las recetas que usen su nombre quedarán como están.',
        () => {
            modules = modules.filter(m => String(m.id) !== String(moduleId));
            saveModules();
            updateRecipesView();
            showToast('Módulo eliminado');
        }
    );
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
    if (ch) { saveRecipesToStorage(); updateRecipesView(); }
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
    const finalFolder = recipeFolder || document.getElementById('recipe-folder-input').value.trim() || 'Mis Recetas';

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
                recipeFolder: finalFolder,
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
    updateRecipesView();
    closeModal('modal-recipe');

    if (recipeSource === 'class') {
        document.getElementById('modal-create-class').classList.add('active');
    }
}

function deleteRecipe(id) {
    showConfirmModal(
        'Eliminar receta',
        '¿Estás seguro de eliminar esta receta?',
        () => {
            recipes = recipes.filter(r => String(r.id) !== String(id));
            saveRecipesToStorage();
            updateRecipesView();
            showToast('Receta eliminada');
        }
    );
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
    updateRecipesView();
    closeModal('modal-recipe');
    showToast(`"${nr.name}" duplicada!`);
}

function saveRecipesToStorage() {
    localStorage.setItem('mushu_recipes', JSON.stringify(recipes));
}

function toggleSellingPrice() {
    showMinSellingPrice = document.querySelector('#toggle-selling-price, #toggle-selling-price-student, #toggle-selling-price-default')?.checked || false;
    updateRecipesView();
}

function toggleSellingPriceStudentMirror() {
    const checked = document.getElementById('toggle-selling-price-student').checked;
    showMinSellingPrice = checked;
    const d = document.getElementById('toggle-selling-price-default');
    if (d) d.checked = checked;
    updateRecipesView();
}

function toggleSellingPriceDefaultMirror() {
    const checked = document.getElementById('toggle-selling-price-default').checked;
    showMinSellingPrice = checked;
    const s = document.getElementById('toggle-selling-price-student');
    if (s) s.checked = checked;
    updateRecipesView();
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
// RECIPES VIEWS
// ========================================
function updateRecipesView() {
    const teacherView = document.getElementById('teacher-recipes-view');
    const studentView = document.getElementById('student-recipes-view');
    const defaultView = document.getElementById('default-recipes-view');

    if (teacherMode.active) {
        teacherView.style.display = 'block';
        studentView.style.display = 'none';
        defaultView.style.display = 'none';
        renderTeacherRecipes();
    } else if (studentName) {
        teacherView.style.display = 'none';
        studentView.style.display = 'block';
        defaultView.style.display = 'none';
        renderStudentRecipes();
    } else {
        teacherView.style.display = 'none';
        studentView.style.display = 'none';
        defaultView.style.display = 'block';
        renderDefaultRecipes();
    }
}

function renderTeacherRecipes() {
    const list = document.getElementById('teacher-recipe-groups-list');

    const ownRecipes = recipes.filter(r => (r.recipeSource || 'personal') === 'personal');
    const moduleFolders = {};

    modules.forEach(mod => {
        moduleFolders[mod.name] = recipes.filter(r => (r.recipeFolder || '') === mod.name);
    });

    let html = '';
    html += renderRecipeGroupFolder('Mis Recetas', 'mis_recetas', ownRecipes, true);

    modules.sort((a, b) => a.name.localeCompare(b.name)).forEach(mod => {
        html += renderModuleFolder(mod, moduleFolders[mod.name] || []);
    });

    list.innerHTML = html || '<div class="empty-state">No hay recetas todavía.</div>';
}

function renderStudentRecipes() {
    const list = document.getElementById('student-recipe-groups-list');
    renderRecipeFoldersInto(list, recipes);
}

function renderDefaultRecipes() {
    const list = document.getElementById('default-recipe-groups-list');
    renderRecipeFoldersInto(list, recipes);
}

function renderRecipeFoldersInto(container, recipeList) {
    if (!recipeList.length) {
        container.innerHTML = '<div class="empty-state">No hay recetas todavía. Crea tu primera receta.</div>';
        return;
    }

    const folders = {};
    recipeList.forEach(r => {
        const folder = r.recipeFolder || 'Mis Recetas';
        if (!folders[folder]) folders[folder] = [];
        folders[folder].push(r);
    });

    const folderNames = Object.keys(folders).sort((a, b) => {
        if (a === 'Mis Recetas') return -1;
        if (b === 'Mis Recetas') return 1;
        return a.localeCompare(b);
    });

    container.innerHTML = folderNames.map((folderName, idx) => {
        const folderId = folderName.replace(/[^a-zA-Z0-9]/g, '_');
        const folderRecipes = folders[folderName].sort((a, b) => a.name.localeCompare(b.name));
        return renderRecipeGroupFolder(folderName, folderId, folderRecipes, idx === 0);
    }).join('');
}

function renderRecipeGroupFolder(folderName, folderId, folderRecipes, openFirst = false) {
    const priceColor = showMinSellingPrice ? 'var(--secondary-color)' : 'var(--primary-color)';
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
                <i class='bx bx-chevron-down recipe-folder-chevron' id="recipe-folder-chevron-${folderId}" style="transform:${openFirst ? 'rotate(0deg)' : 'rotate(-90deg)'};"></i>
            </div>
            <div class="recipe-folder-body ${openFirst ? 'open' : ''}" id="recipe-folder-body-${folderId}">
                ${folderRecipes.map(r => renderRecipeCard(r, priceColor)).join('')}
            </div>
        </div>
    `;
}

function renderModuleFolder(mod, recipesInModule) {
    const moduleId = mod.id;
    const priceColor = showMinSellingPrice ? 'var(--secondary-color)' : 'var(--primary-color)';
    return `
        <div class="recipe-folder">
            <div class="recipe-folder-header" onclick="toggleFolderBody('module-folder','${moduleId}')">
                <div class="recipe-folder-header-left">
                    <i class='bx bx-book' style="font-size:22px;color:var(--secondary-color);"></i>
                    <div>
                        <h3>${mod.name}</h3>
                        <div class="recipe-folder-count">Prefijo: ${mod.prefix} • ${recipesInModule.length} receta${recipesInModule.length !== 1 ? 's' : ''}</div>
                    </div>
                </div>
                <div style="display:flex; gap:6px;" onclick="event.stopPropagation()">
                    <button class="btn-icon" style="width:28px;height:28px;font-size:14px;" onclick="showCreateModuleModal('${mod.id}')"><i class='bx bx-edit'></i></button>
                    <button class="btn-icon danger" style="width:28px;height:28px;font-size:14px;" onclick="deleteModule('${mod.id}')"><i class='bx bx-trash'></i></button>
                </div>
            </div>
            <div class="recipe-folder-body" id="module-folder-body-${moduleId}">
                <div class="module-info-box">
                    <strong>${mod.name}</strong>
                    <p>Prefijo del módulo: ${mod.prefix}</p>
                </div>
                ${recipesInModule.length
                    ? recipesInModule.sort((a,b)=>a.name.localeCompare(b.name)).map(r => renderRecipeCard(r, priceColor)).join('')
                    : '<div class="empty-state" style="padding:20px;font-size:13px;margin-top:10px;">Este módulo no tiene recetas aún. Crea una receta y guárdala dentro de este módulo.</div>'}
            </div>
        </div>
    `;
}

function renderRecipes() {
    updateRecipesView();
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
        ? `<div class="module-badge"><i class='bx bx-book'></i> Receta de módulo</div>`
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
