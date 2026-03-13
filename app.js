// === MushuApp v4.0 estable - Parte 1/2 ===

const TEACHER_HASH = '1099370671';
function simpleHash(str) { let h = 0; for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h = h & h; } return Math.abs(h).toString(); }

function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

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

function createPendingMaterial(name, category = 'productos', subcategory = '') {
    const exists = materials.find(m => 
        m.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    if (exists) return exists;

    const pendingMat = {
        id: Date.now().toString() + '-pending',
        name: name.trim(),
        price: 0,
        qty: 0,
        unit: 'u',
        category,
        subcategory,
        pending: true,
        priceHistory: []
    };

    materials.push(pendingMat);
    saveMaterialsToStorage();
    return pendingMat;
}

// --- Basic save helpers ---
function saveMaterialsToStorage() {
    localStorage.setItem('mushu_materials', JSON.stringify(materials));
}

function saveRecipesToStorage() {
    localStorage.setItem('mushu_recipes', JSON.stringify(recipes));
}

function saveModules() {
    localStorage.setItem('mushu_modules', JSON.stringify(modules));
}

function saveCourses() {
    localStorage.setItem('mushu_courses', JSON.stringify(courses));
}

function saveImportedClasses() {
    localStorage.setItem('mushu_imported_classes', JSON.stringify(importedClasses));
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
                    <h3>${sanitizeHTML(m.name)}</h3>
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
                    <span>${sanitizeHTML(sc)}</span>
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
                            <h3>${sanitizeHTML(m.name)}</h3>
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
// RECIPE SELECTS + COSTS
// ========================================
function updateMaterialSelect() {
    const s = document.getElementById('recipe-add-mat');
    const m = materials.filter(m => (m.category || 'productos') === 'productos');
    if (m.length === 0) {
        s.innerHTML = '<option value="">No hay productos</option>';
        return;
    }
    s.innerHTML =
        '<option value="">Selecciona...</option>' +
        m.sort((a, b) => a.name.localeCompare(b.name))
            .map(m => `<option value="${m.id}">${m.name} ($${formatCLP(m.price)} x ${m.qty}${m.unit})</option>`)
            .join('');
}

function updateDecorationSelect() {
    const s = document.getElementById('recipe-add-deco-mat');
    const m = materials.filter(m => m.category === 'decoracion');
    if (m.length === 0) {
        s.innerHTML = '<option value="">No hay decoraciones</option>';
        return;
    }
    s.innerHTML =
        '<option value="">Selecciona...</option>' +
        m.sort((a, b) => a.name.localeCompare(b.name))
            .map(m => `<option value="${m.id}">${m.name} ($${formatCLP(m.price)} x ${m.qty}${m.unit})</option>`)
            .join('');
}

function updateExtraSubcategorySelect() {
    const s = document.getElementById('recipe-extra-subcat');
    const ei = materials.filter(m => m.category === 'extra');
    const sc = [...new Set(ei.map(m => m.subcategory).filter(Boolean))];
    if (sc.length === 0) {
        s.innerHTML = '<option value="">No hay extras</option>';
        return;
    }
    s.innerHTML =
        '<option value="">Sin extra</option>' +
        sc.map(sub => {
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
                if (nc !== i.cost) {
                    i.cost = nc;
                    c = true;
                }
            }
        });

        (r.decorations || []).forEach(d => {
            const m = materials.find(x => String(x.id) === String(d.matId));
            if (m) {
                const nc = calculateIngredientCost(m, d.qty, d.unit);
                if (nc !== d.cost) {
                    d.cost = nc;
                    c = true;
                }
            }
        });

        if (r.extraSubcategory) {
            const ne = materials
                .filter(m => m.category === 'extra' && m.subcategory === r.extraSubcategory)
                .reduce((s, m) => s + m.price, 0);
            if (ne !== r.extraCost) {
                r.extraCost = ne;
                c = true;
            }
        }

        if (c) {
            r.totalCost =
                (r.ingredients || []).reduce((s, i) => s + i.cost, 0) +
                (r.decorations || []).reduce((s, d) => s + d.cost, 0) +
                (r.extraCost || 0);
            ch = true;
        }
    });

    if (ch) {
        saveRecipesToStorage();
        updateRecipesView();
    }
}

function addIngredientToRecipeForm() {
    const mi = document.getElementById('recipe-add-mat').value;
    const q = parseFloat(document.getElementById('recipe-add-qty').value);
    const u = document.getElementById('recipe-add-unit').value;
    if (!mi || isNaN(q) || q <= 0) {
        showToast("Completa datos", true);
        return;
    }
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
                <span><strong>${sanitizeHTML(i.name)}</strong></span>
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
    if (!mi || isNaN(q) || q <= 0) {
        showToast("Completa datos", true);
        return;
    }
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
                <span><strong>${sanitizeHTML(i.name)}</strong></span>
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
    if (!currentRecipeExtra) {
        c.innerHTML = '';
        return;
    }
    const items = materials.filter(m => m.category === 'extra' && m.subcategory === currentRecipeExtra);
    if (items.length === 0) {
        c.innerHTML = '';
        return;
    }
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
    if (!n) {
        showToast("Ingresa nombre", true);
        return;
    }

    if (currentRecipeIngredients.length === 0 && currentRecipeDecorations.length === 0) {
        showToast("Agrega ingredientes", true);
        return;
    }

    const ic = currentRecipeIngredients.reduce((s, i) => s + i.cost, 0);
    const dc = currentRecipeDecorations.reduce((s, i) => s + i.cost, 0);
    const ec = getExtraCost();
    const tc = ic + dc + ec;
    const po = parseInt(document.getElementById('recipe-portions').value) || 1;

    const folderSelect = document.getElementById('recipe-folder-input');
    const finalFolder = recipeFolder || (folderSelect ? folderSelect.value : '') || 'Mis Recetas';

    const finalSource = window.currentModuleRecipeMode ? 'module' : recipeSource;

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
                recipeSource: finalSource,
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
            recipeSource: finalSource,
            sourceCourseName: sourceCourseName,
            sourceClassDate: sourceClassDate
        };

        recipes.push(newRecipe);
        showToast("Receta guardada!");

        if (finalSource === 'class' || finalSource === 'module') {
            currentSelectedClassRecipe = JSON.parse(JSON.stringify(newRecipe));
            renderSelectedClassRecipeBox();
        }
    }

    saveRecipesToStorage();
    updateRecipesView();
    closeModal('modal-recipe');

    // limpiar modo módulo después de guardar
    window.currentModuleRecipeMode = false;

    if (finalSource === 'class') {
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
    const openFolders = getOpenRecipeFolders();

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

    restoreOpenRecipeFolders(openFolders);
}

function renderTeacherRecipes() {
    const list = document.getElementById('teacher-recipe-groups-list');

    const ownRecipes = recipes.filter(r => (r.recipeSource || 'personal') === 'personal');
    const moduleFolders = {};

    modules.forEach(mod => {
    moduleFolders[mod.name] = recipes.filter(r =>
        (r.recipeFolder || '') === mod.name &&
        (r.recipeSource === 'module' || r.recipeSource === 'class')
    );
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
                <i class='bx bx-chevron-down recipe-folder-chevron' id="recipe-folder-chevron-${folderId}" style="transform:rotate(-90deg);"></i>
            </div>
            <div class="recipe-folder-body" id="recipe-folder-body-${folderId}">
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
                <div style="display:flex; align-items:center; gap:6px;" onclick="event.stopPropagation()">
                    <button class="btn-icon" style="width:28px;height:28px;font-size:14px;" onclick="showCreateModuleModal('${mod.id}')"><i class='bx bx-edit'></i></button>
                    <button class="btn-icon danger" style="width:28px;height:28px;font-size:14px;" onclick="deleteModule('${mod.id}')"><i class='bx bx-trash'></i></button>
                    <i class='bx bx-chevron-down recipe-folder-chevron' id="module-folder-chevron-${moduleId}" style="transform:rotate(-90deg);"></i>
                </div>
            </div>

            <div class="recipe-folder-body" id="module-folder-body-${moduleId}">
                <div class="module-info-box">
                    <strong>${mod.name}</strong>
                    <p>Prefijo del módulo: ${mod.prefix}</p>
                </div>

                <div style="margin-top:10px;">
                    <button class="btn-submit" style="margin-top:0;" onclick="createRecipeInModule('${mod.name}')">
                        <i class='bx bx-plus'></i> Nueva receta del módulo
                    </button>
                </div>

                ${recipesInModule.length
                    ? recipesInModule
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(r => renderRecipeCard(r, priceColor))
                        .join('')
                    : '<div class="empty-state" style="padding:20px;font-size:13px;margin-top:10px;">Este módulo no tiene recetas aún.</div>'}
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
                    <h3>${sanitizeHTML(r.name)}</h3>
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

// ========================================
// COURSES / CLASSES VIEW
// ========================================
function updateClassesView() {
    const teacherView = document.getElementById('teacher-classes-view');
    const studentView = document.getElementById('student-classes-view');
    const noModeView = document.getElementById('no-mode-classes-view');

    if (teacherMode.active) {
        if (teacherView) teacherView.style.display = 'block';
        if (studentView) studentView.style.display = 'none';
        if (noModeView) noModeView.style.display = 'none';
        renderCourses();
    } else if (studentName) {
        if (teacherView) teacherView.style.display = 'none';
        if (studentView) studentView.style.display = 'block';
        if (noModeView) noModeView.style.display = 'none';
        renderStudentClassesByFolders();
    } else {
        if (teacherView) teacherView.style.display = 'none';
        if (studentView) studentView.style.display = 'none';
        if (noModeView) noModeView.style.display = 'block';
    }
}

function showCreateCourseModal(courseId = null) {
    currentCourseStudents = [];
    currentEditingCourseId = null;
    document.getElementById('course-name').value = '';
    document.getElementById('course-day').value = 'Lunes';
    document.getElementById('course-schedule').value = '';
    document.getElementById('modal-course-title').textContent = 'Crear Curso';

    const moduleSelect = document.getElementById('course-module-select');
    if (!modules.length) {
        moduleSelect.innerHTML = '<option value="">No hay módulos</option>';
    } else {
        moduleSelect.innerHTML = modules.map(m =>
            `<option value="${m.id}">${m.name} (${m.prefix})</option>`
        ).join('');
    }

    if (courseId) {
        const course = courses.find(c => String(c.id) === String(courseId));
        if (course) {
            currentEditingCourseId = String(course.id);
            document.getElementById('course-name').value = course.name;
            document.getElementById('course-day').value = course.day;
            document.getElementById('course-schedule').value = course.schedule || '';
            moduleSelect.value = course.moduleId || '';
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

    const studentCode = String(currentCourseStudents.length + 1).padStart(2, '0');
    currentCourseStudents.push({
        id: Date.now().toString(),
        name,
        studentCode
    });

    input.value = '';
    renderCourseStudents();
}

function removeStudentFromCourse(studentId) {
    currentCourseStudents = currentCourseStudents.filter(s => String(s.id) !== String(studentId));
    currentCourseStudents = currentCourseStudents.map((s, index) => ({
        ...s,
        studentCode: String(index + 1).padStart(2, '0')
    }));
    renderCourseStudents();
}

function renderCourseStudents() {
    const list = document.getElementById('course-students-list');
    if (!currentCourseStudents.length) {
        list.innerHTML = '<div style="padding:10px;font-size:13px;color:var(--text-muted);text-align:center;">Sin alumnos aún</div>';
        return;
    }

    list.innerHTML = currentCourseStudents.map(s => `
        <div class="course-student-item">
            <span>👤 ${sanitizeHTML(s.name)}</span>
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="student-code-badge">${s.studentCode || '--'}</span>
                <button onclick="removeStudentFromCourse('${s.id}')"><i class='bx bx-x'></i></button>
            </div>
        </div>
    `).join('');
}

function saveCourse() {
    const name = document.getElementById('course-name').value.trim();
    const moduleId = document.getElementById('course-module-select').value;
    const day = document.getElementById('course-day').value;
    const schedule = document.getElementById('course-schedule').value.trim();

    const mod = modules.find(m => String(m.id) === String(moduleId));

    if (!name) { showToast('Ingresa nombre del curso', true); return; }
    if (!moduleId || !mod) { showToast('Selecciona un módulo', true); return; }
    if (!currentCourseStudents.length) { showToast('Agrega al menos un alumno', true); return; }

    if (currentEditingCourseId) {
        const idx = courses.findIndex(c => String(c.id) === String(currentEditingCourseId));
        if (idx !== -1) {
            courses[idx] = {
                ...courses[idx],
                name,
                moduleId: mod.id,
                moduleName: mod.name,
                day,
                schedule,
                students: currentCourseStudents
            };
            showToast('Curso actualizado!');
        }
    } else {
        courses.push({
            id: Date.now().toString(),
            name,
            moduleId: mod.id,
            moduleName: mod.name,
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
    showConfirmModal(
        'Eliminar curso',
        '¿Eliminar este curso y todas sus clases?',
        () => {
            courses = courses.filter(c => String(c.id) !== String(courseId));
            saveCourses();
            renderCourses();
            showToast('Curso eliminado');
        }
    );
}

function renderCourses() {
    const list = document.getElementById('courses-list');
    if (!courses.length) {
        list.innerHTML = '<div class="empty-state">No hay cursos. Crea tu primer curso.</div>';
        return;
    }

    list.innerHTML = courses.map((course, idx) => {
        const bodyOpen = idx === 0 ? 'open' : '';
        const moduleData = modules.find(m => String(m.id) === String(course.moduleId));
        const modulePrefix = moduleData ? moduleData.prefix : '---';

        const classesHTML = (course.classes || []).sort((a, b) => new Date(b.date) - new Date(a.date)).map(cls => {
            const att = cls.attendance || [];
            const present = att.filter(a => a.present).length;
            const total = att.length;
            return `
                <div class="class-item">
                    <div class="class-item-info" onclick="showAttendanceModal('${course.id}', '${cls.id}')">
                        <h4>${cls.name}</h4>
                        <p>📅 ${formatDate(cls.date)} • Código clase: ${cls.blockCode || '----'} • ✅ ${present}/${total}</p>
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
                            <div class="course-card-day">${course.day} • Módulo: ${course.moduleName} (${modulePrefix})</div>
                            <div class="course-card-schedule">${course.schedule || ''} • ${course.students.length} alumnos</div>
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
    document.getElementById('modal-class-title').textContent = `Editar Clase • ${cls.blockCode || ''}`;

    const courseSelect = document.getElementById('class-course-select');
    courseSelect.innerHTML = courses.map(c =>
        `<option value="${c.id}" ${String(c.id) === String(courseId) ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    renderClassPhotosPreview();
    renderSelectedClassRecipeBox();

    document.getElementById('modal-create-class').classList.add('active');
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
    if (!currentClassPhotos.length) {
        preview.innerHTML = '';
        return;
    }

    preview.innerHTML = currentClassPhotos.map((photo, i) => `
        <div class="class-photo-container">
            <img src="${photo}" class="class-photo-thumb">
            <button class="class-photo-remove" onclick="removeClassPhoto(${i})"><i class='bx bx-x'></i></button>
        </div>
    `).join('');
}

function onClassCourseChange() {}

function saveClass() {
    const courseId = document.getElementById('class-course-select').value;
    const name = document.getElementById('class-name').value.trim();
    const date = document.getElementById('class-date').value;
    const tips = document.getElementById('class-tips').value.trim();
    const codeExpiry = parseInt(document.getElementById('class-code-expiry').value);

    if (!name) { showToast('Ingresa nombre de clase', true); return; }
    if (!date) { showToast('Selecciona fecha', true); return; }
    if (!currentSelectedClassRecipe) { showToast('Debes seleccionar una receta del módulo', true); return; }

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
        const mod = modules.find(m => String(m.id) === String(course.moduleId));
        const modulePrefix = mod ? mod.prefix : 'MOD';
        const blockCode = generateClassBlockCode();

        const attendance = course.students.map(s => ({
            studentId: s.id,
            studentName: s.name,
            studentCode: s.studentCode,
            present: false,
            code: null,
            shortCode: buildVisibleShortCode(modulePrefix, blockCode, s.studentCode),
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
            blockCode,
            attendance,
            codesGenerated: false
        };

        if (!course.classes) course.classes = [];
        course.classes.push(newClass);
        showToast(`Clase creada! Código base: ${blockCode}`);
    }

    saveCourses();
    renderCourses();
    closeModal('modal-create-class');
}

function deleteClass(courseId, classId) {
    showConfirmModal(
        'Eliminar clase',
        '¿Eliminar esta clase?',
        () => {
            const course = courses.find(c => String(c.id) === String(courseId));
            if (!course) return;
            course.classes = (course.classes || []).filter(cl => String(cl.id) !== String(classId));
            saveCourses();
            renderCourses();
            showToast('Clase eliminada');
        }
    );
}

function showAttendanceModal(courseId, classId) {
    currentAttendanceCourseId = courseId;
    currentAttendanceClassId = classId;

    const course = courses.find(c => String(c.id) === String(courseId));
    if (!course) return;
    const cls = (course.classes || []).find(cl => String(cl.id) === String(classId));
    if (!cls) return;

    currentAttendanceData = JSON.parse(JSON.stringify(cls.attendance || []));

    const mod = modules.find(m => String(m.id) === String(course.moduleId));
    const modulePrefix = mod ? mod.prefix : '---';

    document.getElementById('attendance-class-info').innerHTML = `
        <div style="text-align:center;margin-bottom:16px;">
            <h4 style="margin:0 0 4px;">${cls.name}</h4>
            <p style="font-size:13px;color:var(--text-muted);margin:0;">📅 ${formatDate(cls.date)} • ${course.name}</p>
            <p style="font-size:12px;color:var(--secondary-color);font-weight:700;margin:6px 0 0;">Prefijo: ${modulePrefix} • Bloque: ${cls.blockCode || '----'}</p>
        </div>`;

    renderAttendanceList();

    // Auto-generar códigos si no se han generado
    if (!cls.codesGenerated) {
        generateCodes();
    }

    // Siempre mostrar la sección de códigos
    const codesSection = document.getElementById('generated-codes-section');
    codesSection.style.display = 'block';
    renderGeneratedCodes(cls, course);

    document.getElementById('modal-attendance').classList.add('active');
}

function toggleAttendance(studentId) {
    const student = currentAttendanceData.find(a => String(a.studentId) === String(studentId));
    if (student) {
        student.present = !student.present;
        renderAttendanceList();

        // guardar inmediatamente en el curso/clase real
        const course = courses.find(c => String(c.id) === String(currentAttendanceCourseId));
        if (!course) return;

        const cls = (course.classes || []).find(cl => String(cl.id) === String(currentAttendanceClassId));
        if (!cls) return;

        cls.attendance = JSON.parse(JSON.stringify(currentAttendanceData));
        saveCourses();
        renderCourses();
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
                    <span class="student-code-badge">${a.studentCode || '--'}</span>
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

    const mod = modules.find(m => String(m.id) === String(course.moduleId));
    const modulePrefix = mod ? mod.prefix : 'MOD';

    currentAttendanceData.forEach(a => {
        const visibleCode = buildVisibleShortCode(modulePrefix, cls.blockCode || 'R75T', a.studentCode || '00');

        const codeData = {
            code: visibleCode,
            className: cls.name,
            courseId: course.id,
            courseName: course.name,
            moduleId: course.moduleId,
            moduleName: course.moduleName,
            classId: cls.id,
            studentId: a.studentId,
            studentName: a.studentName,
            studentCode: a.studentCode,
            present: a.present,
            date: cls.date,
            tips: cls.tips,
            photos: cls.photos,
            linkedRecipe: cls.linkedRecipe,
            expiry: cls.codeExpiry > 0 ? new Date(Date.now() + cls.codeExpiry * 3600000).toISOString() : null
        };

        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(codeData))));
        a.shortCode = visibleCode;
        a.code = encoded;
        a.codeData = encoded;
        a.codeUsed = false;
    });

    cls.attendance = JSON.parse(JSON.stringify(currentAttendanceData));
    cls.codesGenerated = true;
    saveCourses();

    document.getElementById('generated-codes-section').style.display = 'block';
    renderGeneratedCodes(cls, course);
    renderAttendanceList();
    showToast('Códigos generados! 📋');
}

function regenerateCodes() {
    showConfirmModal(
        'Regenerar códigos',
        '¿Regenerar códigos? Los anteriores quedarán obsoletos.',
        () => {
            generateCodes();
            showToast('Códigos regenerados 🔄');
        }
    );
}

function renderGeneratedCodes(cls, course) {
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
                    <span class="student-code-badge">${a.studentCode || '--'}</span>
                </div>
                <div class="code-item-short">${a.shortCode || 'MODR75T00'}</div>
                <div class="code-item-code">Código completo oculto • usar botón copiar</div>
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
        .map(a => `${a.studentName} - ${a.shortCode || ''}\n${a.codeData}`)
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

function renderStudentClassesByFolders() {
    const list = document.getElementById('student-class-folders-list');
    if (!importedClasses.length) {
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
                            <p>📅 ${formatDate(ic.date)} • ${ic.visibleCode || ''}</p>
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
        <p style="font-size:12px;color:var(--secondary-color);font-weight:700;margin:6px 0 0;">Código: ${ic.visibleCode || ''}</p>
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
        moduleName: decoded.moduleName || '',
        studentName: decoded.studentName,
        studentCode: decoded.studentCode || '',
        visibleCode: decoded.code || '',
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
    updateRecipesView();
    closeModal('modal-import-class');

    if (decoded.present) {
        showToast('Clase importada! 🎓');
    } else {
        showToast('Material de repaso importado 📖');
    }
}

function exportData() {
    const personalRecipes = recipes.filter(r => 
        (r.recipeSource || 'personal') === 'personal'
    );

    const d = {
        version: '4.1',
        exportDate: new Date().toISOString(),
        materials,
        recipes: personalRecipes,
        extraSubcategories: JSON.parse(localStorage.getItem('mushu_extra_subcategories') || '[]'),
        profitMargin,
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
            if (!d.materials || !d.recipes) {
                showToast("Archivo inválido", true);
                return;
            }

            const personalCount = d.recipes.length;

            showConfirmModal(
                'Importar datos',
                `Se importarán ${d.materials.length} materiales y ${personalCount} recetas personales. ¿Continuar?`,
                () => {
                    materials = d.materials;

                    // Mantener recetas de módulos/clases que ya tengo
                    const moduleRecipes = recipes.filter(r => 
                        r.recipeSource === 'module' || r.recipeSource === 'class'
                    );
                    recipes = [...d.recipes, ...moduleRecipes];

                    profitMargin = d.profitMargin || 2;

                    if (d.studentName) {
                        studentName = d.studentName;
                        localStorage.setItem('mushu_student_name', studentName);
                    }
                    if (d.extraSubcategories) {
                        localStorage.setItem('mushu_extra_subcategories', JSON.stringify(d.extraSubcategories));
                    }

                    saveMaterialsToStorage();
                    saveRecipesToStorage();
                    localStorage.setItem('mushu_profit_margin', profitMargin.toString());

                    normalizeExistingRecipes();
                    renderMaterials();
                    updateRecipesView();
                    updateMaterialSelect();
                    updateDecorationSelect();
                    updateExtraSubcategorySelect();
                    updateClassesView();

                    showToast(`Importado ✅ ${d.materials.length} materiales y ${personalCount} recetas`);
                }
            );
        } catch (err) {
            showToast("Error al importar", true);
        }
    };

    r.readAsText(f);
    event.target.value = '';
}

// ========================================
// MODALS BÁSICOS FALTANTES
// ========================================
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

function showAddMaterialModal(materialId = null, category = 'productos', subcategory = '') {
    document.getElementById('form-material').reset();

    const placeholders = {
        productos: { name: 'Ej: Harina', price: '990' },
        decoracion: { name: 'Ej: Chispas de chocolate', price: '1500' },
        extra: { name: 'Ej: Caja para torta', price: '2000' }
    };

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

    if (currentMaterialCategory === 'extra') {
        unitSelect.innerHTML = `
            <option value="u">Unidad</option>
            <option value="cm">Centímetros</option>
            <option value="m">Metros</option>
        `;
    } else {
        unitSelect.innerHTML = `
            <option value="kg">Kilos (kg)</option>
            <option value="g">Gramos (g)</option>
            <option value="l">Litros (L)</option>
            <option value="cm3">mL</option>
            <option value="u">Unidad</option>
        `;
    }

    if (materialId) {
        const mat = materials.find(m => String(m.id) === String(materialId));
        if (mat) unitSelect.value = mat.unit;
    }

    const ph = placeholders[currentMaterialCategory] || placeholders.productos;
    document.getElementById('mat-name').placeholder = ph.name;
    document.getElementById('mat-price').placeholder = ph.price;

    document.getElementById('modal-material').classList.add('active');
}

function showAddRecipeModal(recipeId = null) {
    const btnD = document.getElementById('btn-duplicate-recipe');
    const folderGroup = document.getElementById('recipe-folder-group');
    const folderInput = document.getElementById('recipe-folder-input');
    
    fillRecipeFolderSelect();

    folderGroup.style.display = teacherMode.active ? 'block' : 'none';
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
            if (teacherMode.active) {
                document.getElementById('recipe-folder-input').value = r.recipeFolder || '';
            }
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

    if (currentRecipeExtra) {
        document.getElementById('recipe-extra-subcat').value = currentRecipeExtra;
    }

    document.getElementById('modal-recipe').classList.add('active');
}

function showCreateModuleModal(moduleId = null) {
    currentEditingModuleId = null;
    document.getElementById('module-name').value = '';
    document.getElementById('module-prefix').value = '';

    if (moduleId) {
        const mod = modules.find(m => String(m.id) === String(moduleId));
        if (mod) {
            currentEditingModuleId = String(mod.id);
            document.getElementById('module-name').value = mod.name;
            document.getElementById('module-prefix').value = mod.prefix;
            document.querySelector('#modal-module h3').textContent = '✏️ Editar Módulo';
        }
    } else {
        document.querySelector('#modal-module h3').textContent = '📚 Crear Módulo';
    }

    document.getElementById('modal-module').classList.add('active');
}

// ========================================
// FUNCIONES FALTANTES 2
// ========================================
function showSocialModal() {
    document.getElementById('modal-social').classList.add('active');
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
    updateRecipesView();
}

function showTeacherPasswordModal() {
    document.getElementById('teacher-password-modal-input').value = '';
    document.getElementById('modal-teacher-password').classList.add('active');
}

function confirmTeacherModePassword() {
    const pass = document.getElementById('teacher-password-modal-input').value;
    if (simpleHash(pass) !== TEACHER_HASH) {
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
    updateRecipesView();
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

function deleteMaterial(id) {
    showConfirmModal(
        'Eliminar material',
        '¿Estás seguro de eliminar este material?',
        () => {
            materials = materials.filter(m => String(m.id) !== String(id));
            saveMaterialsToStorage();
            recalculateAllRecipes();
            renderMaterials();
            updateMaterialSelect();
            updateDecorationSelect();
            updateExtraSubcategorySelect();
            showToast('Material eliminado');
        }
    );
}

function saveModule() {
    const name = document.getElementById('module-name').value.trim();
    const prefix = sanitizePrefix(document.getElementById('module-prefix').value.trim());

    if (!name) {
        showToast('Ingresa nombre del módulo', true);
        return;
    }

    if (!prefix || prefix.length < 2) {
        showToast('Ingresa prefijo válido', true);
        return;
    }

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

function saveMaterial(e) {
    e.preventDefault();

    const name = document.getElementById('mat-name').value.trim();
    const price = parseFloat(document.getElementById('mat-price').value);
    const qty = parseFloat(document.getElementById('mat-qty').value);
    const unit = document.getElementById('mat-unit').value;
    const category = currentMaterialCategory;
    const subcategory = currentMaterialSubcategory;

    if (!name || isNaN(price) || isNaN(qty) || qty <= 0) {
        showToast("Por favor ingresa datos válidos", true);
        return;
    }

    let priceHistory = [];

    if (currentEditingMaterialId) {
        const idx = materials.findIndex(m => String(m.id) === String(currentEditingMaterialId));
        if (idx !== -1) {
            const oldMat = materials[idx];
            priceHistory = [...(oldMat.priceHistory || [])];
            if (oldMat.price !== price) {
                priceHistory.push({
                    date: new Date().toISOString().slice(0, 10),
                    price: price
                });
            }
        }
    } else {
        priceHistory = [{
            date: new Date().toISOString().slice(0, 10),
            price: price
        }];
    }

    const material = {
        id: currentEditingMaterialId || Date.now().toString(),
        name,
        price,
        qty,
        unit,
        category,
        subcategory,
        priceHistory
    };

    if (currentEditingMaterialId) {
        const idx = materials.findIndex(m => String(m.id) === String(currentEditingMaterialId));
        if (idx !== -1) materials[idx] = material;
        recalculateAllRecipes();
        showToast("Material actualizado!");
    } else {
        materials.push(material);
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

function fillRecipeFolderSelect() {
    const select = document.getElementById('recipe-folder-input');
    if (!select) return;

    const options = [`<option value="Mis Recetas">Mis Recetas</option>`];

    modules
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(mod => {
            options.push(`<option value="${mod.name}">${mod.name} (${mod.prefix})</option>`);
        });

    select.innerHTML = options.join('');
}

function createRecipeInModule(moduleName) {
    window.currentModuleRecipeMode = true;

    currentEditingRecipeId = null;
    currentRecipeIngredients = [];
    currentRecipeDecorations = [];
    currentRecipeExtra = null;

    document.getElementById('recipe-name').value = '';
    document.getElementById('recipe-portions').value = '';
    document.getElementById('recipe-add-qty').value = '';
    document.getElementById('recipe-add-deco-qty').value = '';

    const folderGroup = document.getElementById('recipe-folder-group');
    const folderSelect = document.getElementById('recipe-folder-input');

    if (folderGroup) folderGroup.style.display = 'block';

    fillRecipeFolderSelect();
    folderSelect.value = moduleName;

    renderCurrentRecipeIngredients();
    renderCurrentRecipeDecorations();
    updateMaterialSelect();
    updateDecorationSelect();
    updateExtraSubcategorySelect();
    renderExtraInRecipe();
    updateRecipeTotal();

    document.querySelector('#modal-recipe h3').textContent = "Crear Receta del Módulo";
    document.getElementById('modal-recipe').classList.add('active');
}

function getOpenRecipeFolders() {
    const openFolders = [];

    document.querySelectorAll('.recipe-folder-body.open').forEach(el => {
        if (el.id) openFolders.push(el.id);
    });

    document.querySelectorAll('.recipe-card-detail.open').forEach(el => {
        if (el.id) openFolders.push(el.id);
    });

    document.querySelectorAll('.course-card-body.open').forEach(el => {
        if (el.id) openFolders.push(el.id);
    });

    document.querySelectorAll('.folder-card-body.open').forEach(el => {
        if (el.id) openFolders.push(el.id);
    });

    return openFolders;
}

function restoreOpenRecipeFolders(openFolders) {
    openFolders.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('open');

        const chevronId = id
            .replace('-body-', '-chevron-')
            .replace('body-', 'chevron-');

        const chevron = document.getElementById(chevronId);
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    });
}

function selectExistingRecipeForClass() {
    if (recipes.length === 0) {
        showToast('No hay recetas aún. Crea una primero.', true);
        return;
    }

    document.getElementById('search-select-recipe').value = '';
    renderRecipeSelectionList(recipes);
    document.getElementById('modal-select-recipe').classList.add('active');
}

function filterRecipeSelection() {
    const q = document.getElementById('search-select-recipe').value.toLowerCase().trim();
    const filtered = recipes.filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.recipeFolder || '').toLowerCase().includes(q)
    );
    renderRecipeSelectionList(filtered);
}

function renderRecipeSelectionList(recipeList) {
    const list = document.getElementById('select-recipe-list');
    if (!recipeList.length) {
        list.innerHTML = '<div class="empty-state" style="padding:20px;font-size:13px;">Sin recetas encontradas</div>';
        return;
    }

    list.innerHTML = recipeList
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(r => `
            <div class="select-recipe-item" onclick="selectRecipeForClass('${r.id}')">
                <h4>${r.name}</h4>
                <p>${r.recipeFolder || 'Mis Recetas'} • $${formatCLP(r.totalCost)} • ${r.portions > 1 ? r.portions + ' porciones' : 'Entera'}</p>
            </div>
        `).join('');
}

function selectRecipeForClass(recipeId) {
    const r = recipes.find(x => String(x.id) === String(recipeId));
    if (!r) return;

    currentSelectedClassRecipe = JSON.parse(JSON.stringify(r));
    renderSelectedClassRecipeBox();
    closeModal('modal-select-recipe');
    showToast(`Receta "${currentSelectedClassRecipe.name}" seleccionada`);
}

// === FUNCIONES FALTANTES ===

function saveStudentName() {
    const name = document.getElementById('student-name-input').value.trim();
    if (!name) {
        showToast('Ingresa tu nombre', true);
        return;
    }
    studentName = name;
    localStorage.setItem('mushu_student_name', studentName);
    updateClassesView();
    updateRecipesView();
    showToast('Nombre guardado: ' + name);
}

function saveProfitMargin() {
    const val = parseFloat(document.getElementById('profit-margin').value);
    if (isNaN(val) || val < 1) {
        showToast('Margen inválido', true);
        return;
    }
    profitMargin = val;
    localStorage.setItem('mushu_profit_margin', profitMargin.toString());
    updateRecipesView();
    showToast('Margen actualizado: x' + profitMargin);
}
