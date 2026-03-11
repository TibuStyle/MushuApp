// --- Data State ---
let materials = JSON.parse(localStorage.getItem('mushu_materials')) || [];
let recipes = JSON.parse(localStorage.getItem('mushu_recipes')) || [];
let profitMargin = parseFloat(localStorage.getItem('mushu_profit_margin')) || 2;

let currentRecipeIngredients = [];
let currentRecipeDecorations = [];
let currentRecipeExtra = null;
let currentEditingRecipeId = null;
let currentEditingMaterialId = null;
let currentMaterialCategory = 'productos';
let currentMaterialSubcategory = '';
let showMinSellingPrice = false;

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    const savedMargin = localStorage.getItem('mushu_profit_margin');
    if (savedMargin) profitMargin = parseFloat(savedMargin);

    renderMaterials();
    renderRecipes();
    updateMaterialSelect();
    updateDecorationSelect();
    updateExtraSubcategorySelect();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('SW Registered'))
            .catch(err => console.log('SW Failed', err));
    }

    document.addEventListener('touchmove', function (e) {
        const s = e.target.closest('.content-area, .modal-content');
        if (!s) e.preventDefault();
    }, { passive: false });

    window.scrollTo(0, 0);

    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.classList.add('fade-out');
            setTimeout(() => splash.remove(), 500);
        }
    }, 3000);
});

// --- Tab Navigation ---
function switchTab(tabName) {
    const view = document.getElementById(`view-${tabName}`);
    const nav = document.getElementById(`nav-${tabName}`);
    if (!view || !nav) return;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    view.classList.add('active');
    nav.classList.add('active');
}

// --- Modals ---
function showAddMaterialModal(materialId = null, category = 'productos', subcategory = '') {
    document.getElementById('form-material').reset();
    const placeholders = {
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
        unitSelect.innerHTML = '<option value="u">Unidad</option><option value="cm">Centímetros (cm)</option><option value="m">Metros (m)</option>';
    } else {
        unitSelect.innerHTML = '<option value="kg">Kilos (kg)</option><option value="g">Gramos (g)</option><option value="l">Litros (L)</option><option value="cm3">mL</option><option value="u">Unidad (ej. Huevos)</option>';
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
    const btnDuplicate = document.getElementById('btn-duplicate-recipe');
    if (recipeId) {
        const recipe = recipes.find(r => String(r.id) === String(recipeId));
        if (recipe) {
            currentEditingRecipeId = String(recipe.id);
            document.getElementById('recipe-name').value = recipe.name;
            document.getElementById('recipe-portions').value = recipe.portions || '';
            currentRecipeIngredients = JSON.parse(JSON.stringify(recipe.ingredients || []));
            currentRecipeDecorations = JSON.parse(JSON.stringify(recipe.decorations || []));
            currentRecipeExtra = recipe.extraSubcategory || null;
            document.querySelector('#modal-recipe h3').textContent = "Editar Receta";
            recalculateIngredientCosts();
            if (btnDuplicate) btnDuplicate.style.display = 'flex';
        }
    } else {
        currentEditingRecipeId = null;
        document.getElementById('recipe-name').value = '';
        document.getElementById('recipe-portions').value = '';
        currentRecipeIngredients = [];
        currentRecipeDecorations = [];
        currentRecipeExtra = null;
        document.querySelector('#modal-recipe h3').textContent = "Crear Receta";
        if (btnDuplicate) btnDuplicate.style.display = 'none';
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
    document.getElementById('modal-settings').classList.add('active');
}

function showSocialModal() {
    document.getElementById('modal-social').classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// --- Toast ---
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show';
    if (isError) toast.classList.add('error');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// --- Materials Logic ---
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
                priceHistory.push({ date: new Date().toISOString().slice(0, 10), price: price });
            }
        }
    } else {
        priceHistory = [{ date: new Date().toISOString().slice(0, 10), price: price }];
    }

    const material = {
        id: currentEditingMaterialId || Date.now().toString(),
        name, price, qty, unit, category, subcategory, priceHistory
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

function deleteMaterial(id) {
    if (confirm("¿Estás seguro de eliminar este material?")) {
        materials = materials.filter(m => String(m.id) !== String(id));
        saveMaterialsToStorage();
        recalculateAllRecipes();
        renderMaterials();
        updateMaterialSelect();
        updateDecorationSelect();
        updateExtraSubcategorySelect();
    }
}

function saveMaterialsToStorage() {
    localStorage.setItem('mushu_materials', JSON.stringify(materials));
}

// --- Price History ---
function getPriceBadgeHTML(mat) {
    if (!mat.priceHistory || mat.priceHistory.length < 2) return '';
    const current = mat.price;
    const previous = mat.priceHistory[mat.priceHistory.length - 2].price;
    const diff = current - previous;
    const pct = Math.round(Math.abs(diff) / previous * 100);
    if (diff === 0) return '';
    if (diff < 0) {
        return `<div class="price-badge cheaper"><i class='bx bx-trending-down'></i> ${pct}% más barato - Ahorras $${formatCLP(Math.abs(diff))}</div>`;
    }
    return `<div class="price-badge expensive"><i class='bx bx-trending-up'></i> ${pct}% más caro - Pagas $${formatCLP(diff)} de más</div>`;
}

function renderPriceHistory(mat) {
    const section = document.getElementById('price-history-section');
    const list = document.getElementById('price-history-list');
    if (!mat || !mat.priceHistory || mat.priceHistory.length < 1) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';
    list.innerHTML = [...mat.priceHistory].reverse().map((entry, i, arr) => {
        let changeHTML = '';
        const prevIdx = i + 1;
        if (prevIdx < arr.length) {
            const prev = arr[prevIdx].price;
            const diff = entry.price - prev;
            const pct = Math.round(Math.abs(diff) / prev * 100);
            if (diff > 0) changeHTML = `<span class="price-history-change up">+${pct}%</span>`;
            else if (diff < 0) changeHTML = `<span class="price-history-change down">-${pct}%</span>`;
        }
        return `<div class="price-history-item"><span class="price-history-date">${formatDate(entry.date)}</span><span class="price-history-value">$${formatCLP(entry.price)}</span>${changeHTML}</div>`;
    }).join('');
}

// --- Search / Filter Materials ---
function filterMaterials() { renderMaterials(); }

function renderMaterials() {
    const searchInput = document.getElementById('search-materials');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    ['productos', 'decoracion'].forEach(catKey => {
        const list = document.getElementById(`list-${catKey}`);
        const items = materials.filter(m => (m.category || 'productos') === catKey);
        const filtered = query ? items.filter(m => m.name.toLowerCase().includes(query)) : items;
        const emptyMsg = catKey === 'productos' ? 'Agrega tu primera materia prima' : 'Agrega elementos de decoración';

        if (filtered.length === 0) {
            list.innerHTML = `<div class="empty-state" style="padding:20px; font-size: 13px;">${query ? 'Sin resultados' : emptyMsg}</div>`;
            return;
        }
        list.innerHTML = filtered.sort((a, b) => a.name.localeCompare(b.name)).map(mat => `
            <div class="card" onclick="showAddMaterialModal('${mat.id}')" style="cursor: pointer;">
                <div class="card-info">
                    <h3>${mat.name}</h3>
                    <p>${mat.qty} ${mat.unit}</p>
                    ${getPriceBadgeHTML(mat)}
                </div>
                <div style="display:flex; align-items:center; gap:15px;" onclick="event.stopPropagation()">
                    <span class="card-price">$${formatCLP(mat.price)}</span>
                    <button class="btn-icon danger" onclick="deleteMaterial('${mat.id}')"><i class='bx bx-trash'></i></button>
                </div>
            </div>
        `).join('');
    });
    renderExtraMaterials(query);
}

function renderExtraMaterials(query) {
    const extraList = document.getElementById('list-extra');
    const extraItems = materials.filter(m => m.category === 'extra');
    let extraSubcategories = JSON.parse(localStorage.getItem('mushu_extra_subcategories')) || [];
    extraItems.forEach(mat => {
        if (mat.subcategory && !extraSubcategories.includes(mat.subcategory)) extraSubcategories.push(mat.subcategory);
    });

    if (extraSubcategories.length === 0) {
        extraList.innerHTML = '<div class="empty-state" style="padding:20px; font-size: 13px;">Presiona + para crear una subcategoría</div>';
        return;
    }

    let html = '';
    extraSubcategories.forEach(subcat => {
        const items = extraItems.filter(m => m.subcategory === subcat);
        const filtered = query ? items.filter(m => m.name.toLowerCase().includes(query)) : items;
        const subcatTotal = items.reduce((sum, m) => sum + m.price, 0);
        const subcatId = subcat.replace(/[^a-zA-Z0-9]/g, '_');
        if (query && filtered.length === 0) return;

        html += `<div class="extra-subcat"><div class="extra-subcat-header" onclick="toggleExtraSubcat('${subcatId}')">
            <div style="display:flex; align-items:center; gap:8px;">
                <i class='bx bx-chevron-down' id="chevron-extra-${subcatId}" style="transition:transform 0.3s;"></i>
                <i class='bx bx-folder' style="color:var(--secondary-color);"></i><span>${subcat}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;" onclick="event.stopPropagation()">
                <span class="card-price">$${formatCLP(subcatTotal)}</span>
                <button class="btn-add-small" onclick="showAddMaterialModal(null, 'extra', '${subcat}')"><i class='bx bx-plus'></i></button>
                <button class="btn-icon danger" style="width:26px;height:26px;font-size:14px;" onclick="deleteExtraSubcategory('${subcat}')"><i class='bx bx-trash'></i></button>
            </div></div>`;
        html += `<div class="extra-subcat-body open" id="body-extra-${subcatId}">`;
        const displayItems = query ? filtered : items;
        if (displayItems.length === 0) {
            html += '<div class="empty-state" style="padding:12px; font-size:12px;">Sin items aún.</div>';
        } else {
            html += displayItems.sort((a, b) => a.name.localeCompare(b.name)).map(mat => `
                <div class="card" onclick="showAddMaterialModal('${mat.id}')" style="cursor: pointer; margin-left:8px;">
                    <div class="card-info"><h3>${mat.name}</h3><p>${mat.qty} ${mat.unit}</p>${getPriceBadgeHTML(mat)}</div>
                    <div style="display:flex; align-items:center; gap:15px;" onclick="event.stopPropagation()">
                        <span class="card-price">$${formatCLP(mat.price)}</span>
                        <button class="btn-icon danger" onclick="deleteMaterial('${mat.id}')"><i class='bx bx-trash'></i></button>
                    </div>
                </div>`).join('');
        }
        html += `</div></div>`;
    });
    extraList.innerHTML = html || '<div class="empty-state" style="padding:20px; font-size: 13px;">Sin resultados</div>';
}

// --- Toggle Categories ---
function toggleCategory(catKey) {
    const body = document.getElementById(`body-${catKey}`);
    const chevron = document.getElementById(`chevron-${catKey}`);
    body.classList.toggle('open');
    chevron.style.transform = body.classList.contains('open') ? 'rotate(0deg)' : 'rotate(-90deg)';
}

function toggleExtraSubcat(subcatId) {
    const body = document.getElementById(`body-extra-${subcatId}`);
    const chevron = document.getElementById(`chevron-extra-${subcatId}`);
    if (!body) return;
    body.classList.toggle('open');
    chevron.style.transform = body.classList.contains('open') ? 'rotate(0deg)' : 'rotate(-90deg)';
}

function addExtraSubcategory() {
    const name = prompt('Nombre de la subcategoría (Ej: Tortas, Cupcakes):');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    let subs = JSON.parse(localStorage.getItem('mushu_extra_subcategories')) || [];
    if (subs.includes(trimmed)) { showToast('Esa subcategoría ya existe', true); return; }
    subs.push(trimmed);
    localStorage.setItem('mushu_extra_subcategories', JSON.stringify(subs));
    renderMaterials();
    updateExtraSubcategorySelect();
    showToast(`Subcategoría "${trimmed}" creada!`);
}

function deleteExtraSubcategory(subcat) {
    if (!confirm(`¿Eliminar "${subcat}" y todos sus items?`)) return;
    materials = materials.filter(m => !(m.category === 'extra' && m.subcategory === subcat));
    let subs = JSON.parse(localStorage.getItem('mushu_extra_subcategories')) || [];
    subs = subs.filter(s => s !== subcat);
    localStorage.setItem('mushu_extra_subcategories', JSON.stringify(subs));
    saveMaterialsToStorage();
    renderMaterials();
    updateExtraSubcategorySelect();
    showToast(`"${subcat}" eliminada`);
}

// --- Recipe Selects ---
function updateMaterialSelect() {
    const select = document.getElementById('recipe-add-mat');
    const mats = materials.filter(m => (m.category || 'productos') === 'productos');
    if (mats.length === 0) { select.innerHTML = '<option value="">No hay productos</option>'; return; }
    select.innerHTML = '<option value="">Selecciona...</option>' +
        mats.sort((a, b) => a.name.localeCompare(b.name)).map(m => `<option value="${m.id}">${m.name} ($${formatCLP(m.price)} x ${m.qty}${m.unit})</option>`).join('');
}

function updateDecorationSelect() {
    const select = document.getElementById('recipe-add-deco-mat');
    const mats = materials.filter(m => m.category === 'decoracion');
    if (mats.length === 0) { select.innerHTML = '<option value="">No hay decoraciones</option>'; return; }
    select.innerHTML = '<option value="">Selecciona...</option>' +
        mats.sort((a, b) => a.name.localeCompare(b.name)).map(m => `<option value="${m.id}">${m.name} ($${formatCLP(m.price)} x ${m.qty}${m.unit})</option>`).join('');
}

function updateExtraSubcategorySelect() {
    const select = document.getElementById('recipe-extra-subcat');
    const extraItems = materials.filter(m => m.category === 'extra');
    const subcats = [...new Set(extraItems.map(m => m.subcategory).filter(Boolean))];
    if (subcats.length === 0) { select.innerHTML = '<option value="">No hay extras</option>'; return; }
    select.innerHTML = '<option value="">Sin extra</option>' +
        subcats.map(sub => {
            const total = extraItems.filter(m => m.subcategory === sub).reduce((s, m) => s + m.price, 0);
            return `<option value="${sub}">${sub} ($${formatCLP(total)})</option>`;
        }).join('');
}

// --- Cost Calculation ---
function calculateIngredientCost(mat, reqQty, reqUnit) {
    const EGG_WEIGHT_GR = 55;
    const isEgg = /\bhuevos?\b/i.test(mat.name.trim());
    let standardMatQty = mat.qty;
    if (mat.unit === 'kg') standardMatQty = mat.qty * 1000;
    else if (mat.unit === 'l') standardMatQty = mat.qty * 1000;
    else if (mat.unit === 'u' && isEgg && reqUnit !== 'u') standardMatQty = mat.qty * EGG_WEIGHT_GR;

    let standardReqQty = reqQty;
    if (reqUnit === 'kg') standardReqQty = reqQty * 1000;
    else if (reqUnit === 'l') standardReqQty = reqQty * 1000;
    else if (reqUnit === 'u' && isEgg && (mat.unit === 'g' || mat.unit === 'kg')) standardReqQty = reqQty * EGG_WEIGHT_GR;

    if (standardMatQty <= 0) return 0;
    return Math.round((standardReqQty * mat.price) / standardMatQty);
}

// --- Recalculate ---
function recalculateIngredientCosts() {
    currentRecipeIngredients.forEach(ing => {
        const mat = materials.find(m => String(m.id) === String(ing.matId));
        if (mat) ing.cost = calculateIngredientCost(mat, ing.qty, ing.unit);
    });
    currentRecipeDecorations.forEach(dec => {
        const mat = materials.find(m => String(m.id) === String(dec.matId));
        if (mat) dec.cost = calculateIngredientCost(mat, dec.qty, dec.unit);
    });
}

function recalculateAllRecipes() {
    let anyChanged = false;
    recipes.forEach(recipe => {
        let changed = false;
        (recipe.ingredients || []).forEach(ing => {
            const mat = materials.find(m => String(m.id) === String(ing.matId));
            if (mat) { const nc = calculateIngredientCost(mat, ing.qty, ing.unit); if (nc !== ing.cost) { ing.cost = nc; changed = true; } }
        });
        (recipe.decorations || []).forEach(dec => {
            const mat = materials.find(m => String(m.id) === String(dec.matId));
            if (mat) { const nc = calculateIngredientCost(mat, dec.qty, dec.unit); if (nc !== dec.cost) { dec.cost = nc; changed = true; } }
        });
        if (recipe.extraSubcategory) {
            const nec = materials.filter(m => m.category === 'extra' && m.subcategory === recipe.extraSubcategory).reduce((s, m) => s + m.price, 0);
            if (nec !== recipe.extraCost) { recipe.extraCost = nec; changed = true; }
        }
        if (changed) {
            recipe.totalCost = (recipe.ingredients || []).reduce((s, i) => s + i.cost, 0) + (recipe.decorations || []).reduce((s, d) => s + d.cost, 0) + (recipe.extraCost || 0);
            anyChanged = true;
        }
    });
    if (anyChanged) { saveRecipesToStorage(); renderRecipes(); }
}

// --- Ingredients ---
function addIngredientToRecipeForm() {
    const matId = document.getElementById('recipe-add-mat').value;
    const qty = parseFloat(document.getElementById('recipe-add-qty').value);
    const unit = document.getElementById('recipe-add-unit').value;
    if (!matId || isNaN(qty) || qty <= 0) { showToast("Completa los datos", true); return; }
    const mat = materials.find(m => String(m.id) === String(matId));
    if (!mat) return;
    currentRecipeIngredients.push({ id: Date.now().toString(), matId: String(mat.id), name: mat.name, qty, unit, cost: calculateIngredientCost(mat, qty, unit) });
    document.getElementById('recipe-add-mat').value = '';
    document.getElementById('recipe-add-qty').value = '';
    renderCurrentRecipeIngredients();
    updateRecipeTotal();
}

function removeIngredientFromRecipe(ingId) {
    currentRecipeIngredients = currentRecipeIngredients.filter(i => String(i.id) !== String(ingId));
    renderCurrentRecipeIngredients();
    updateRecipeTotal();
}

function renderCurrentRecipeIngredients() {
    const list = document.getElementById('recipe-ingredients-list');
    if (currentRecipeIngredients.length === 0) { list.innerHTML = '<div class="empty-state" style="padding:15px; font-size:13px;">Sin ingredientes.</div>'; return; }
    list.innerHTML = currentRecipeIngredients.map(ing => `
        <div class="ingredient-item"><div class="ingredient-details"><span><strong>${ing.name}</strong></span><span style="font-size:12px; color:var(--text-muted);">${ing.qty} ${ing.unit}</span></div>
        <div style="display:flex; align-items:center; gap:10px;"><span class="ingredient-cost">$${formatCLP(ing.cost)}</span>
        <button class="btn-icon danger" onclick="removeIngredientFromRecipe('${ing.id}')" style="width:28px; height:28px; font-size:16px;"><i class='bx bx-trash'></i></button></div></div>`).join('');
}

// --- Decorations ---
function addDecorationToRecipeForm() {
    const matId = document.getElementById('recipe-add-deco-mat').value;
    const qty = parseFloat(document.getElementById('recipe-add-deco-qty').value);
    const unit = document.getElementById('recipe-add-deco-unit').value;
    if (!matId || isNaN(qty) || qty <= 0) { showToast("Completa los datos", true); return; }
    const mat = materials.find(m => String(m.id) === String(matId));
    if (!mat) return;
    currentRecipeDecorations.push({ id: Date.now().toString(), matId: String(mat.id), name: mat.name, qty, unit, cost: calculateIngredientCost(mat, qty, unit) });
    document.getElementById('recipe-add-deco-mat').value = '';
    document.getElementById('recipe-add-deco-qty').value = '';
    renderCurrentRecipeDecorations();
    updateRecipeTotal();
}

function removeDecorationFromRecipe(ingId) {
    currentRecipeDecorations = currentRecipeDecorations.filter(i => String(i.id) !== String(ingId));
    renderCurrentRecipeDecorations();
    updateRecipeTotal();
}

function renderCurrentRecipeDecorations() {
    const list = document.getElementById('recipe-decorations-list');
    if (currentRecipeDecorations.length === 0) { list.innerHTML = '<div class="empty-state" style="padding:15px; font-size:13px;">Sin decoración.</div>'; return; }
    list.innerHTML = currentRecipeDecorations.map(ing => `
        <div class="ingredient-item"><div class="ingredient-details"><span><strong>${ing.name}</strong></span><span style="font-size:12px; color:var(--text-muted);">${ing.qty} ${ing.unit}</span></div>
        <div style="display:flex; align-items:center; gap:10px;"><span class="ingredient-cost">$${formatCLP(ing.cost)}</span>
        <button class="btn-icon danger" onclick="removeDecorationFromRecipe('${ing.id}')" style="width:28px; height:28px; font-size:16px;"><i class='bx bx-trash'></i></button></div></div>`).join('');
}

// --- Extra in Recipe ---
function onExtraSubcategoryChange() {
    currentRecipeExtra = document.getElementById('recipe-extra-subcat').value || null;
    renderExtraInRecipe();
    updateRecipeTotal();
}

function renderExtraInRecipe() {
    const container = document.getElementById('recipe-extra-details');
    if (!currentRecipeExtra) { container.innerHTML = ''; return; }
    const items = materials.filter(m => m.category === 'extra' && m.subcategory === currentRecipeExtra);
    if (items.length === 0) { container.innerHTML = ''; return; }
    const total = items.reduce((s, m) => s + m.price, 0);
    container.innerHTML = `<div style="margin-top:10px; font-size:13px; color:var(--text-muted);">
        ${items.map(m => `<div style="display:flex; justify-content:space-between; padding:4px 0;"><span>${m.name}</span><span>$${formatCLP(m.price)}</span></div>`).join('')}
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-top:1px solid rgba(0,0,0,0.1); margin-top:4px; font-weight:600; color:var(--text-main);"><span>Subtotal Extra</span><span>$${formatCLP(total)}</span></div></div>`;
}

function getExtraCost() {
    if (!currentRecipeExtra) return 0;
    return materials.filter(m => m.category === 'extra' && m.subcategory === currentRecipeExtra).reduce((s, m) => s + m.price, 0);
}

// --- Recipe Total ---
function updateRecipeTotal() {
    const ic = currentRecipeIngredients.reduce((s, i) => s + i.cost, 0);
    const dc = currentRecipeDecorations.reduce((s, i) => s + i.cost, 0);
    const ec = getExtraCost();
    const total = ic + dc + ec;
    document.getElementById('recipe-total-cost').textContent = `$${formatCLP(total)} CLP`;
    const portions = parseInt(document.getElementById('recipe-portions').value);
    const portionDiv = document.getElementById('recipe-portion-cost');
    if (!isNaN(portions) && portions > 1) {
        portionDiv.textContent = `$${formatCLP(Math.round(total / portions))} CLP / porción`;
        portionDiv.style.display = 'block';
    } else { portionDiv.style.display = 'none'; }
}

// --- Save Recipe ---
function saveRecipe() {
    const name = document.getElementById('recipe-name').value.trim();
    if (!name) { showToast("Ingresa un nombre", true); return; }
    if (currentRecipeIngredients.length === 0 && currentRecipeDecorations.length === 0) { showToast("Agrega al menos un ingrediente", true); return; }
    const ic = currentRecipeIngredients.reduce((s, i) => s + i.cost, 0);
    const dc = currentRecipeDecorations.reduce((s, i) => s + i.cost, 0);
    const ec = getExtraCost();
    const totalCost = ic + dc + ec;
    const portions = parseInt(document.getElementById('recipe-portions').value) || 1;

    if (currentEditingRecipeId) {
        const idx = recipes.findIndex(r => String(r.id) === String(currentEditingRecipeId));
        if (idx !== -1) {
            recipes[idx] = { ...recipes[idx], name, ingredients: currentRecipeIngredients, decorations: currentRecipeDecorations, extraSubcategory: currentRecipeExtra, extraCost: ec, totalCost, portions };
            showToast("Receta actualizada!");
        }
    } else {
        recipes.push({ id: Date.now().toString(), name, ingredients: currentRecipeIngredients, decorations: currentRecipeDecorations, extraSubcategory: currentRecipeExtra, extraCost: ec, totalCost, portions });
        showToast("Receta guardada!");
    }
    saveRecipesToStorage();
    renderRecipes();
    closeModal('modal-recipe');
}

function deleteRecipe(id) {
    if (confirm("¿Eliminar esta receta?")) {
        recipes = recipes.filter(r => String(r.id) !== String(id));
        saveRecipesToStorage();
        renderRecipes();
    }
}

function duplicateCurrentRecipe() {
    if (!currentEditingRecipeId) return;
    const recipe = recipes.find(r => String(r.id) === String(currentEditingRecipeId));
    if (!recipe) return;
    const nr = { ...JSON.parse(JSON.stringify(recipe)), id: Date.now().toString(), name: recipe.name + ' (copia)' };
    recipes.push(nr);
    saveRecipesToStorage();
    renderRecipes();
    closeModal('modal-recipe');
    showToast(`"${nr.name}" duplicada!`);
}

function saveRecipesToStorage() { localStorage.setItem('mushu_recipes', JSON.stringify(recipes)); }

function toggleSellingPrice() {
    showMinSellingPrice = document.getElementById('toggle-selling-price').checked;
    renderRecipes();
}

// --- Recipe Detail Toggle ---
function toggleRecipeDetail(recipeId) {
    const detail = document.getElementById(`recipe-detail-${recipeId}`);
    const toggle = document.getElementById(`recipe-toggle-${recipeId}`);
    if (detail && toggle) {
        detail.classList.toggle('open');
        toggle.classList.toggle('open');
    }
}

// --- Recipe Tip ---
function generateRecipeTip(recipe) {
    const allItems = [...(recipe.ingredients || []), ...(recipe.decorations || [])];
    if (allItems.length === 0) return '';
    const totalCost = allItems.reduce((s, i) => s + i.cost, 0);
    if (totalCost === 0) return '';
    const most = allItems.reduce((max, i) => i.cost > max.cost ? i : max, allItems[0]);
    const pct = Math.round((most.cost / totalCost) * 100);
    if (pct >= 30) {
        return `El ingrediente más caro es <strong>${most.name}</strong> ($${formatCLP(most.cost)}), representa el ${pct}% del costo. Busca si encuentras uno más barato o pregúntale a la profe si puedes usar otro.`;
    }
    return '';
}

// --- Render Recipes (Expandable Cards) ---
function renderRecipes() {
    const list = document.getElementById('recipes-list');
    if (recipes.length === 0) { list.innerHTML = '<div class="empty-state">No hay recetas todavía. Crea tu primera receta.</div>'; return; }

    const priceColor = showMinSellingPrice ? 'var(--secondary-color)' : 'var(--primary-color)';

    list.innerHTML = recipes.map(recipe => {
        let displayPrice = recipe.totalCost;
        let pricingLabel = "Precio costo:";
        if (showMinSellingPrice) {
            displayPrice = Math.floor((recipe.totalCost * profitMargin) / 500) * 500;
            pricingLabel = `Sugerido (x${profitMargin}):`;
        }

        const ic = (recipe.ingredients || []).reduce((s, i) => s + i.cost, 0);
        const dc = (recipe.decorations || []).reduce((s, i) => s + i.cost, 0);
        const ec = recipe.extraCost || 0;
        const totalItems = (recipe.ingredients || []).length + (recipe.decorations || []).length;
        const sellingEntera = Math.floor((recipe.totalCost * profitMargin) / 500) * 500;

        // Portions badge
        const portionCost = recipe.portions > 1 ? Math.round(displayPrice / recipe.portions) : 0;
        const portionsBadge = recipe.portions > 1
            ? `<div class="portions-badge"><i class='bx bx-cut'></i> ${recipe.portions} porciones • $${formatCLP(portionCost)} c/u</div>` : '';

        // Breakdown
        let breakdown = '';
        if ((recipe.ingredients || []).length > 0) {
            breakdown += `<div class="recipe-breakdown-section"><div class="recipe-breakdown-header"><span><i class='bx bx-package'></i> Ingredientes</span><span>$${formatCLP(ic)}</span></div>`;
            breakdown += recipe.ingredients.map(i => `<div class="recipe-breakdown-item"><span>${i.name} (${i.qty} ${i.unit})</span><span>$${formatCLP(i.cost)}</span></div>`).join('');
            breakdown += `</div>`;
        }
        if ((recipe.decorations || []).length > 0) {
            breakdown += `<div class="recipe-breakdown-section"><div class="recipe-breakdown-header"><span><i class='bx bx-palette'></i> Decoración</span><span>$${formatCLP(dc)}</span></div>`;
            breakdown += recipe.decorations.map(d => `<div class="recipe-breakdown-item"><span>${d.name} (${d.qty} ${d.unit})</span><span>$${formatCLP(d.cost)}</span></div>`).join('');
            breakdown += `</div>`;
        }
        if (recipe.extraSubcategory && ec > 0) {
            const extraItems = materials.filter(m => m.category === 'extra' && m.subcategory === recipe.extraSubcategory);
            breakdown += `<div class="recipe-breakdown-section"><div class="recipe-breakdown-header"><span><i class='bx bx-star'></i> Extra (${recipe.extraSubcategory})</span><span>$${formatCLP(ec)}</span></div>`;
            breakdown += extraItems.map(m => `<div class="recipe-breakdown-item"><span>${m.name}</span><span>$${formatCLP(m.price)}</span></div>`).join('');
            breakdown += `</div>`;
        }
        breakdown += `<div class="recipe-breakdown-total"><span>COSTO TOTAL</span><span>$${formatCLP(recipe.totalCost)}</span></div>`;

        // Selling
        let selling = `<div class="recipe-selling-section"><div class="recipe-selling-row highlight"><span>💰 Venta entera:</span><span>$${formatCLP(sellingEntera)}</span></div>`;
        if (recipe.portions > 1) {
            const sp = Math.round(sellingEntera / recipe.portions);
            selling += `<div class="recipe-selling-row"><span>🍰 Por porción (${recipe.portions}x):</span><span>$${formatCLP(sp)} c/u</span></div>`;
            selling += `<div class="recipe-selling-row"><span>Total porciones:</span><span>$${formatCLP(sp * recipe.portions)}</span></div>`;
        }
        selling += `</div>`;

        // Tip
        const tip = generateRecipeTip(recipe);
        const tipHTML = tip ? `<div class="recipe-tip"><strong>💡 Consejo</strong>${tip}</div>` : '';

        return `
        <div class="recipe-card">
            <div class="recipe-card-header">
                <div class="recipe-card-info">
                    <h3>${recipe.name}</h3>
                    <p>${totalItems} Items${recipe.extraSubcategory ? ' + Extra' : ''}</p>
                    ${portionsBadge}
                </div>
                <div class="recipe-card-price">
                    <div class="recipe-card-price-label">${pricingLabel}</div>
                    <div class="recipe-card-price-value" style="color:${priceColor};">$${formatCLP(displayPrice)}</div>
                </div>
            </div>
            <div class="recipe-card-toggle" id="recipe-toggle-${recipe.id}" onclick="toggleRecipeDetail('${recipe.id}')">
                <span>Ver detalle</span><i class='bx bx-chevron-down'></i>
            </div>
            <div class="recipe-card-detail" id="recipe-detail-${recipe.id}">
                <div class="recipe-detail-content">
                    ${breakdown}
                    ${selling}
                    ${tipHTML}
                    <div style="display:flex; gap:10px; margin-top:16px;">
                        <button class="btn-submit" style="margin-top:0; flex:1;" onclick="showAddRecipeModal('${recipe.id}')"><i class='bx bx-edit'></i> Editar</button>
                        <button class="btn-icon danger" style="width:48px; height:48px; font-size:20px;" onclick="deleteRecipe('${recipe.id}')"><i class='bx bx-trash'></i></button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

// --- Settings ---
function saveProfitMargin() {
    const val = parseFloat(document.getElementById('profit-margin').value);
    if (isNaN(val) || val < 1) { showToast("El margen debe ser al menos 1", true); return; }
    profitMargin = val;
    localStorage.setItem('mushu_profit_margin', profitMargin.toString());
    renderRecipes();
    showToast(`Margen actualizado a x${profitMargin}`);
}

// --- Export / Import ---
function exportData() {
    const data = {
        version: '3.0', exportDate: new Date().toISOString(),
        materials, recipes,
        extraSubcategories: JSON.parse(localStorage.getItem('mushu_extra_subcategories') || '[]'),
        profitMargin
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mushuapp_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Datos exportados! 📦");
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.materials || !data.recipes) { showToast("Archivo no válido", true); return; }
            if (!confirm(`¿Importar?\n• ${data.materials.length} materiales\n• ${data.recipes.length} recetas`)) return;
            materials = data.materials;
            recipes = data.recipes;
            profitMargin = data.profitMargin || 2;
            if (data.extraSubcategories) localStorage.setItem('mushu_extra_subcategories', JSON.stringify(data.extraSubcategories));
            saveMaterialsToStorage();
            saveRecipesToStorage();
            localStorage.setItem('mushu_profit_margin', profitMargin.toString());
            renderMaterials(); renderRecipes(); updateMaterialSelect(); updateDecorationSelect(); updateExtraSubcategorySelect();
            showToast(`Importado: ${materials.length} materiales, ${recipes.length} recetas ✅`);
        } catch (err) { showToast("Error al leer archivo", true); }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// --- Utils ---
function formatCLP(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatDate(dateStr) {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
