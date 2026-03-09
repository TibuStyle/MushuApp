// --- Data State ---
let materials = JSON.parse(localStorage.getItem('mushu_materials')) || [];
let recipes = JSON.parse(localStorage.getItem('mushu_recipes')) || [];

// Current recipe state
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
    renderMaterials();
    renderRecipes();
    updateMaterialSelect();
    updateExtraSubcategorySelect();
    
    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('Service Worker Registered'))
            .catch(err => console.log('Service Worker Failed', err));
    }

    // Splash Screen timeout: 3 seconds
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.classList.add('fade-out');
            // Remove from DOM after transition (0.5s)
            setTimeout(() => splash.remove(), 500);
        }
    }, 3000);
});

// --- Tab Navigation ---
function switchTab(tabName) {
    console.log('Switching to tab:', tabName);
    if (tabName === 'clases') {
        showToast("¡Pronto disponible! 🚀");
        return;
    }
    const view = document.getElementById(`view-${tabName}`);
    const nav = document.getElementById(`nav-${tabName}`);
    console.log('Found view:', !!view, 'Found nav:', !!nav);
    
    if (!view || !nav) {
        console.error('Tab elements not found for:', tabName);
        return;
    }

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
            currentEditingMaterialId = mat.id;
            currentMaterialCategory = mat.category || 'productos';
            currentMaterialSubcategory = mat.subcategory || '';
            document.getElementById('mat-name').value = mat.name;
            document.getElementById('mat-price').value = mat.price;
            document.getElementById('mat-qty').value = mat.qty;
            document.querySelector('#modal-material h3').textContent = "Editar Material";
        }
    } else {
        currentEditingMaterialId = null;
        currentMaterialCategory = category;
        currentMaterialSubcategory = subcategory;
        document.querySelector('#modal-material h3').textContent = "Agregar Material";
    }

    subcatGroup.style.display = 'none';

    if (currentMaterialCategory === 'extra') {
        unitSelect.innerHTML = `
            <option value="u">Unidad</option>
            <option value="cm">Centímetros (cm)</option>
            <option value="m">Metros (m)</option>
        `;
    } else {
        unitSelect.innerHTML = `
            <option value="kg">Kilos (kg)</option>
            <option value="g">Gramos (g)</option>
            <option value="l">Litros (L)</option>
            <option value="cm3">mL</option>
            <option value="u">Unidad (ej. Huevos)</option>
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
    if (recipeId) {
        const recipe = recipes.find(r => String(r.id) === String(recipeId));
        if (recipe) {
            currentEditingRecipeId = recipe.id;
            document.getElementById('recipe-name').value = recipe.name;
            document.getElementById('recipe-portions').value = recipe.portions || '';
            currentRecipeIngredients = [...(recipe.ingredients || [])];
            currentRecipeDecorations = [...(recipe.decorations || [])];
            currentRecipeExtra = recipe.extraSubcategory || null;
            document.querySelector('#modal-recipe h3').textContent = "Editar Receta";
        }
    } else {
        currentEditingRecipeId = null;
        document.getElementById('recipe-name').value = '';
        document.getElementById('recipe-portions').value = '';
        currentRecipeIngredients = [];
        currentRecipeDecorations = [];
        currentRecipeExtra = null;
        document.querySelector('#modal-recipe h3').textContent = "Crear Receta";
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

    // Set the extra select value
    if (currentRecipeExtra) {
        document.getElementById('recipe-extra-subcat').value = currentRecipeExtra;
    }
    
    document.getElementById('modal-recipe').classList.add('active');
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

    const material = {
        id: currentEditingMaterialId || Date.now().toString(),
        name, price, qty, unit, category, subcategory
    };

    if (currentEditingMaterialId) {
        const idx = materials.findIndex(m => String(m.id) === String(currentEditingMaterialId));
        if (idx !== -1) materials[idx] = material;
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
        renderMaterials();
        updateMaterialSelect();
        updateDecorationSelect();
        updateExtraSubcategorySelect();
    }
}

function saveMaterialsToStorage() {
    localStorage.setItem('mushu_materials', JSON.stringify(materials));
}

function renderMaterials() {
    // Productos & Decoracion
    ['productos', 'decoracion'].forEach(catKey => {
        const list = document.getElementById(`list-${catKey}`);
        const items = materials.filter(m => (m.category || 'productos') === catKey);
        const emptyMsg = catKey === 'productos' ? 'Agrega tu primera materia prima' : 'Agrega elementos de decoración';

        if (items.length === 0) {
            list.innerHTML = `<div class="empty-state" style="padding:20px; font-size: 13px;">${emptyMsg}</div>`;
            return;
        }
        list.innerHTML = items.map(mat => `
            <div class="card" onclick="showAddMaterialModal('${mat.id}')" style="cursor: pointer;">
                <div class="card-info">
                    <h3>${mat.name}</h3>
                    <p>${mat.qty} ${mat.unit}</p>
                </div>
                <div style="display:flex; align-items:center; gap:15px;" onclick="event.stopPropagation()">
                    <span class="card-price">$${formatCLP(mat.price)}</span>
                    <button class="btn-icon danger" onclick="deleteMaterial('${mat.id}')">
                        <i class='bx bx-trash'></i>
                    </button>
                </div>
            </div>
        `).join('');
    });

    // Extra - grouped by subcategory with collapsible headers
    const extraList = document.getElementById('list-extra');
    const extraItems = materials.filter(m => m.category === 'extra');

    let extraSubcategories = JSON.parse(localStorage.getItem('mushu_extra_subcategories')) || [];
    extraItems.forEach(mat => {
        if (mat.subcategory && !extraSubcategories.includes(mat.subcategory)) {
            extraSubcategories.push(mat.subcategory);
        }
    });

    if (extraSubcategories.length === 0) {
        extraList.innerHTML = '<div class="empty-state" style="padding:20px; font-size: 13px;">Presiona + para crear una subcategoría</div>';
        return;
    }

    let html = '';
    extraSubcategories.forEach(subcat => {
        const items = extraItems.filter(m => m.subcategory === subcat);
        const subcatTotal = items.reduce((sum, m) => sum + m.price, 0);
        const subcatId = subcat.replace(/[^a-zA-Z0-9]/g, '_');

        html += `<div class="extra-subcat">`;
        html += `<div class="extra-subcat-header" onclick="toggleExtraSubcat('${subcatId}')">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class='bx bx-chevron-down' id="chevron-extra-${subcatId}" style="transition:transform 0.3s;"></i>
                        <i class='bx bx-folder' style="color:var(--secondary-color);"></i>
                        <span>${subcat}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;" onclick="event.stopPropagation()">
                        <span class="card-price">$${formatCLP(subcatTotal)}</span>
                        <button class="btn-add-small" onclick="showAddMaterialModal(null, 'extra', '${subcat}')">
                            <i class='bx bx-plus'></i>
                        </button>
                        <button class="btn-icon danger" style="width:26px;height:26px;font-size:14px;" onclick="deleteExtraSubcategory('${subcat}')">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                 </div>`;
        html += `<div class="extra-subcat-body open" id="body-extra-${subcatId}">`;
        if (items.length === 0) {
            html += '<div class="empty-state" style="padding:12px; font-size:12px;">Sin items aún. Presiona + para agregar.</div>';
        } else {
            html += items.map(mat => `
                <div class="card" onclick="showAddMaterialModal('${mat.id}')" style="cursor: pointer; margin-left:8px;">
                    <div class="card-info">
                        <h3>${mat.name}</h3>
                        <p>${mat.qty} ${mat.unit}</p>
                    </div>
                    <div style="display:flex; align-items:center; gap:15px;" onclick="event.stopPropagation()">
                        <span class="card-price">$${formatCLP(mat.price)}</span>
                        <button class="btn-icon danger" onclick="deleteMaterial('${mat.id}')">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }
        html += `</div></div>`;
    });

    extraList.innerHTML = html;
}

// --- Toggle Category Sections ---
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
    if (subs.includes(trimmed)) {
        showToast('Esa subcategoría ya existe', true);
        return;
    }
    subs.push(trimmed);
    localStorage.setItem('mushu_extra_subcategories', JSON.stringify(subs));
    renderMaterials();
    updateExtraSubcategorySelect();
    showToast(`Subcategoría "${trimmed}" creada!`);
}

function deleteExtraSubcategory(subcat) {
    if (!confirm(`¿Eliminar la subcategoría "${subcat}" y todos sus items?`)) return;
    materials = materials.filter(m => !(m.category === 'extra' && m.subcategory === subcat));
    let subs = JSON.parse(localStorage.getItem('mushu_extra_subcategories')) || [];
    subs = subs.filter(s => s !== subcat);
    localStorage.setItem('mushu_extra_subcategories', JSON.stringify(subs));
    saveMaterialsToStorage();
    renderMaterials();
    updateExtraSubcategorySelect();
    showToast(`Subcategoría "${subcat}" eliminada`);
}

// --- Recipes Logic ---

function updateMaterialSelect() {
    const select = document.getElementById('recipe-add-mat');
    const productMats = materials.filter(m => (m.category || 'productos') === 'productos');
    if (productMats.length === 0) {
        select.innerHTML = '<option value="">No hay productos</option>';
        return;
    }
    select.innerHTML = '<option value="">Selecciona...</option>' + 
        productMats.map(mat => `<option value="${mat.id}">${mat.name} ($${formatCLP(mat.price)} x ${mat.qty}${mat.unit})</option>`).join('');
}

function updateDecorationSelect() {
    const select = document.getElementById('recipe-add-deco-mat');
    const decoMats = materials.filter(m => m.category === 'decoracion');
    if (decoMats.length === 0) {
        select.innerHTML = '<option value="">No hay decoraciones</option>';
        return;
    }
    select.innerHTML = '<option value="">Selecciona...</option>' + 
        decoMats.map(mat => `<option value="${mat.id}">${mat.name} ($${formatCLP(mat.price)} x ${mat.qty}${mat.unit})</option>`).join('');
}

function updateExtraSubcategorySelect() {
    const select = document.getElementById('recipe-extra-subcat');
    const extraItems = materials.filter(m => m.category === 'extra');
    const subcats = [...new Set(extraItems.map(m => m.subcategory).filter(Boolean))];
    
    if (subcats.length === 0) {
        select.innerHTML = '<option value="">No hay extras</option>';
        return;
    }
    select.innerHTML = '<option value="">Sin extra</option>' + 
        subcats.map(sub => {
            const total = extraItems.filter(m => m.subcategory === sub).reduce((s, m) => s + m.price, 0);
            return `<option value="${sub}">${sub} ($${formatCLP(total)})</option>`;
        }).join('');
}

// Cost calculation
function calculateIngredientCost(mat, reqQty, reqUnit) {
    let matQtyBase = mat.qty;
    let matUnit = mat.unit;
    let matPrice = mat.price;

    const EGG_WEIGHT_GR = 55;
    const isEgg = /\bhuevos?\b/i.test(mat.name.trim());

    let standardMatQty = matQtyBase;
    if (matUnit === 'kg') standardMatQty = matQtyBase * 1000;
    else if (matUnit === 'g') standardMatQty = matQtyBase;
    else if (matUnit === 'l') standardMatQty = matQtyBase * 1000;
    else if (matUnit === 'cm3') standardMatQty = matQtyBase;
    else if (matUnit === 'u') {
        standardMatQty = (isEgg && reqUnit !== 'u') ? matQtyBase * EGG_WEIGHT_GR : matQtyBase;
    }

    let standardReqQty = reqQty;
    if (reqUnit === 'kg') standardReqQty = reqQty * 1000;
    else if (reqUnit === 'g') standardReqQty = reqQty;
    else if (reqUnit === 'l') standardReqQty = reqQty * 1000;
    else if (reqUnit === 'cm3') standardReqQty = reqQty;
    else if (reqUnit === 'u') {
        standardReqQty = (isEgg && (matUnit === 'g' || matUnit === 'kg')) ? reqQty * EGG_WEIGHT_GR : reqQty;
    }

    return Math.round((standardReqQty * matPrice) / standardMatQty);
}

// --- Ingredient (Product) functions ---
function addIngredientToRecipeForm() {
    const matId = document.getElementById('recipe-add-mat').value;
    const qty = parseFloat(document.getElementById('recipe-add-qty').value);
    const unit = document.getElementById('recipe-add-unit').value;

    if (!matId || isNaN(qty) || qty <= 0) {
        showToast("Completa los datos del ingrediente", true);
        return;
    }
    const material = materials.find(m => m.id === matId);
    if (!material) return;

    currentRecipeIngredients.push({
        id: Date.now().toString(),
        matId: material.id, name: material.name,
        qty, unit, cost: calculateIngredientCost(material, qty, unit)
    });

    document.getElementById('recipe-add-mat').value = '';
    document.getElementById('recipe-add-qty').value = '';
    renderCurrentRecipeIngredients();
    updateRecipeTotal();
}

function removeIngredientFromRecipe(ingId) {
    currentRecipeIngredients = currentRecipeIngredients.filter(ing => ing.id !== ingId);
    renderCurrentRecipeIngredients();
    updateRecipeTotal();
}

function renderCurrentRecipeIngredients() {
    const list = document.getElementById('recipe-ingredients-list');
    if (currentRecipeIngredients.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding:15px; font-size:13px;">Sin ingredientes.</div>';
        return;
    }
    list.innerHTML = currentRecipeIngredients.map(ing => `
        <div class="ingredient-item">
            <div class="ingredient-details">
                <span><strong>${ing.name}</strong></span>
                <span style="font-size:12px; color:var(--text-muted);">${ing.qty} ${ing.unit}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span class="ingredient-cost">$${formatCLP(ing.cost)}</span>
                <button class="btn-icon danger" onclick="removeIngredientFromRecipe('${ing.id}')" style="width:28px; height:28px; font-size:16px;">
                    <i class='bx bx-trash'></i>
                </button>
            </div>
        </div>
    `).join('');
}

// --- Decoration functions ---
function addDecorationToRecipeForm() {
    const matId = document.getElementById('recipe-add-deco-mat').value;
    const qty = parseFloat(document.getElementById('recipe-add-deco-qty').value);
    const unit = document.getElementById('recipe-add-deco-unit').value;

    if (!matId || isNaN(qty) || qty <= 0) {
        showToast("Completa los datos de la decoración", true);
        return;
    }
    const material = materials.find(m => m.id === matId);
    if (!material) return;

    currentRecipeDecorations.push({
        id: Date.now().toString(),
        matId: material.id, name: material.name,
        qty, unit, cost: calculateIngredientCost(material, qty, unit)
    });

    document.getElementById('recipe-add-deco-mat').value = '';
    document.getElementById('recipe-add-deco-qty').value = '';
    renderCurrentRecipeDecorations();
    updateRecipeTotal();
}

function removeDecorationFromRecipe(ingId) {
    currentRecipeDecorations = currentRecipeDecorations.filter(ing => ing.id !== ingId);
    renderCurrentRecipeDecorations();
    updateRecipeTotal();
}

function renderCurrentRecipeDecorations() {
    const list = document.getElementById('recipe-decorations-list');
    if (currentRecipeDecorations.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding:15px; font-size:13px;">Sin decoración.</div>';
        return;
    }
    list.innerHTML = currentRecipeDecorations.map(ing => `
        <div class="ingredient-item">
            <div class="ingredient-details">
                <span><strong>${ing.name}</strong></span>
                <span style="font-size:12px; color:var(--text-muted);">${ing.qty} ${ing.unit}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span class="ingredient-cost">$${formatCLP(ing.cost)}</span>
                <button class="btn-icon danger" onclick="removeDecorationFromRecipe('${ing.id}')" style="width:28px; height:28px; font-size:16px;">
                    <i class='bx bx-trash'></i>
                </button>
            </div>
        </div>
    `).join('');
}

// --- Extra in recipe ---
function onExtraSubcategoryChange() {
    const val = document.getElementById('recipe-extra-subcat').value;
    currentRecipeExtra = val || null;
    renderExtraInRecipe();
    updateRecipeTotal();
}

function renderExtraInRecipe() {
    const container = document.getElementById('recipe-extra-details');
    if (!currentRecipeExtra) {
        container.innerHTML = '';
        return;
    }
    const extraItems = materials.filter(m => m.category === 'extra' && m.subcategory === currentRecipeExtra);
    if (extraItems.length === 0) {
        container.innerHTML = '';
        return;
    }
    const total = extraItems.reduce((s, m) => s + m.price, 0);
    container.innerHTML = `
        <div style="margin-top: 10px; font-size: 13px; color: var(--text-muted);">
            ${extraItems.map(m => `<div style="display:flex; justify-content:space-between; padding:4px 0;"><span>${m.name}</span><span>$${formatCLP(m.price)}</span></div>`).join('')}
            <div style="display:flex; justify-content:space-between; padding:6px 0; border-top:1px solid rgba(0,0,0,0.1); margin-top:4px; font-weight:600; color:var(--text-main);">
                <span>Subtotal Extra</span><span>$${formatCLP(total)}</span>
            </div>
        </div>
    `;
}

function getExtraCost() {
    if (!currentRecipeExtra) return 0;
    return materials
        .filter(m => m.category === 'extra' && m.subcategory === currentRecipeExtra)
        .reduce((s, m) => s + m.price, 0);
}

// --- Total ---
function updateRecipeTotal() {
    const ingredientsCost = currentRecipeIngredients.reduce((sum, ing) => sum + ing.cost, 0);
    const decorationsCost = currentRecipeDecorations.reduce((sum, ing) => sum + ing.cost, 0);
    const extraCost = getExtraCost();
    const total = ingredientsCost + decorationsCost + extraCost;

    document.getElementById('recipe-total-cost').textContent = `$${formatCLP(total)} CLP`;
    
    const portions = parseInt(document.getElementById('recipe-portions').value);
    const portionCostDiv = document.getElementById('recipe-portion-cost');
    
    if (!isNaN(portions) && portions > 1) {
        portionCostDiv.textContent = `$${formatCLP(Math.round(total / portions))} CLP / porción`;
        portionCostDiv.style.display = 'block';
    } else {
        portionCostDiv.style.display = 'none';
    }
}

// --- Save Recipe ---
function saveRecipe() {
    const name = document.getElementById('recipe-name').value.trim();
    if (!name) { showToast("Ingresa un nombre para la receta", true); return; }
    if (currentRecipeIngredients.length === 0 && currentRecipeDecorations.length === 0) {
        showToast("Agrega al menos un ingrediente o decoración", true); return;
    }

    const ingredientsCost = currentRecipeIngredients.reduce((sum, ing) => sum + ing.cost, 0);
    const decorationsCost = currentRecipeDecorations.reduce((sum, ing) => sum + ing.cost, 0);
    const extraCost = getExtraCost();
    const totalCost = ingredientsCost + decorationsCost + extraCost;
    const portions = parseInt(document.getElementById('recipe-portions').value) || 1;

    if (currentEditingRecipeId) {
        const idx = recipes.findIndex(r => String(r.id) === String(currentEditingRecipeId));
        if (idx !== -1) {
            recipes[idx] = { ...recipes[idx], name, ingredients: currentRecipeIngredients, decorations: currentRecipeDecorations, extraSubcategory: currentRecipeExtra, extraCost, totalCost, portions };
            showToast("Receta actualizada!");
        }
    } else {
        recipes.push({
            id: Date.now().toString(), name,
            ingredients: currentRecipeIngredients,
            decorations: currentRecipeDecorations,
            extraSubcategory: currentRecipeExtra,
            extraCost, totalCost, portions
        });
        showToast("Receta guardada!");
    }

    saveRecipesToStorage();
    renderRecipes();
    closeModal('modal-recipe');
}

function deleteRecipe(id) {
    if (confirm("¿Estás seguro de eliminar esta receta?")) {
        recipes = recipes.filter(r => String(r.id) !== String(id));
        saveRecipesToStorage();
        renderRecipes();
    }
}

function saveRecipesToStorage() {
    localStorage.setItem('mushu_recipes', JSON.stringify(recipes));
}

function toggleSellingPrice() {
    showMinSellingPrice = document.getElementById('toggle-selling-price').checked;
    renderRecipes();
}

function renderRecipes() {
    const list = document.getElementById('recipes-list');
    if (recipes.length === 0) {
        list.innerHTML = '<div class="empty-state">No hay recetas todavía. Crea tu primera receta.</div>';
        return;
    }

    list.innerHTML = recipes.map(recipe => {
        let displayPrice = recipe.totalCost;
        let pricingLabel = showMinSellingPrice ? "Sugerido: " : "Precio costo: ";

        if (showMinSellingPrice) {
            // Lógica: Duplicar cost -> Redondear hacia abajo a múltiplo de 500
            // Ejemplo: 14.200 -> 14.000 | 14.700 -> 14.500
            let rawSellingPrice = recipe.totalCost * 2;
            displayPrice = Math.floor(rawSellingPrice / 500) * 500;
            pricingLabel = "Sugerido: ";
        }

        const portionsText = recipe.portions > 1 ? ` • ${recipe.portions} porciones ($${formatCLP(Math.round(displayPrice / recipe.portions))} c/u)` : '';
        const totalItems = (recipe.ingredients || []).length + (recipe.decorations || []).length;
        
        return `
        <div class="card" onclick="showAddRecipeModal('${recipe.id}')" style="cursor: pointer;">
            <div class="card-info">
                <h3>${recipe.name}</h3>
                <p>${totalItems} Items${recipe.extraSubcategory ? ' + Extra' : ''}${portionsText}</p>
            </div>
            <div style="display:flex; align-items:center; gap:15px;" onclick="event.stopPropagation()">
                <div style="text-align: right;">
                    <div style="font-size:10px; color:var(--text-muted);">${pricingLabel}</div>
                    <span class="card-price" style="font-size:20px;">$${formatCLP(displayPrice)}</span>
                </div>
                <button class="btn-icon danger" onclick="deleteRecipe('${recipe.id}')">
                    <i class='bx bx-trash'></i>
                </button>
            </div>
        </div>
    `;}).join('');
}

// --- Utils ---
function formatCLP(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
