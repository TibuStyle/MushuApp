// 🔥 IMPORTAR FIREBASE (DESHABILITADO TEMPORALMENTE)
// import { database, auth, ref, get, set, update, remove, onValue, off } 
//   from './firebase-config.js';
// === MushuApp v4.0 estable - Parte 1/2 ===

const TEACHER_HASH = '46115714';
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
let studentProfiles = JSON.parse(localStorage.getItem('mushu_student_profiles')) || [];
// Mantener compatibilidad si tenía un perfil único viejo
if (!Array.isArray(studentProfiles)) {
    const oldProfile = JSON.parse(localStorage.getItem('mushu_student_profile'));
    if (oldProfile) {
        studentProfiles = [oldProfile];
        localStorage.setItem('mushu_student_profiles', JSON.stringify(studentProfiles));
    } else {
        studentProfiles = [];
    }
}
let studentName = studentProfiles.length > 0 ? studentProfiles[0].name : '';
let currentRecipeIngredients = [];
let currentRecipeDecorations = [];
let currentRecipeExtra = null;
let currentRecipePhoto = null;
let currentRecipeTips = '';
let currentRecipeModuleClass = '';
let currentRecipeIsRestricted = false;
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
    if (!body) return;
    body.classList.toggle('open');
    
    const chevron = document.getElementById(`${idPrefix}-chevron-${id}`);
    if (chevron) {
        chevron.style.transform = body.classList.contains('open') ? 'rotate(0deg)' : 'rotate(-90deg)';
    }
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

function buildVisibleShortCode(modulePrefix, blockCode, studentCode, present) {
    const oddDigits = [1, 3, 5, 7, 9];
    const evenDigits = [0, 2, 4, 6, 8];
    const attendanceDigit = present
        ? oddDigits[Math.floor(Math.random() * oddDigits.length)]
        : evenDigits[Math.floor(Math.random() * evenDigits.length)];
    return `${modulePrefix}${blockCode}${attendanceDigit}${studentCode}`;
}

function readAttendanceFromCode(code, modulePrefix, blockCode) {
    const after = code.replace(modulePrefix, '').replace(blockCode, '');
    const attendanceDigit = parseInt(after.charAt(0));
    return attendanceDigit % 2 !== 0;
}

// === MATERIALES PENDIENTES - VARIABLES ===
let pendingMaterialData = null;
let pendingMaterialCallback = null;
let newMaterialNameCallback = null;
let newMaterialNameCategory = 'productos';

function createPendingMaterial(name, category = 'productos', subcategory = '') {
    const exists = materials.find(m => 
        m.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    if (exists) return exists;

    const uniqueId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 8) + '-' + materials.length;

    const pendingMat = {
        id: uniqueId,
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
    
    // 🔥 Subir módulos a Firebase
    if (typeof firebaseDB !== 'undefined' && teacherMode.active) {
        modules.forEach(modulo => {
            firebaseDB.ref(`modulos/${modulo.prefix}/metadata`).update({
                codigo: modulo.prefix,
                nombre: modulo.name,
                activo: true,
                ultimaActualizacion: new Date().toISOString()
            }).then(() => {
                console.log('✅ Módulo subido a Firebase:', modulo.prefix);
            }).catch(err => console.error('Error subiendo módulo:', err));
        });
    }
}

function saveCourses() {
    localStorage.setItem('mushu_courses', JSON.stringify(courses));
    
    // 🔥 Subir cursos y alumnas a Firebase
    if (typeof firebaseDB !== 'undefined' && teacherMode.active) {
        courses.forEach(curso => {
            const modulo = modules.find(m => String(m.id) === String(curso.moduleId));
            if (!modulo) return;
            
            const cursoRef = firebaseDB.ref(`modulos/${modulo.prefix}/cursos/${curso.id}`);
            cursoRef.set({
                id: curso.id,
                nombre: curso.name,
                dia: curso.day || '',
                horario: curso.schedule || '',
                moduloId: curso.moduleId,
                moduloNombre: curso.moduleName,
                estudiantes: (curso.students || []).map(student => ({
                    id: student.id,
                    nombre: student.name,
                    codigo: student.studentCode
                }))
            }).then(() => {
                console.log('✅ Curso subido a Firebase:', curso.name);
                
                // 🔥 LIMPIAR ALUMNAS ELIMINADAS
                firebaseDB.ref(`alumnas/${modulo.prefix}/${curso.id}`).once('value').then(snap => {
                    if (snap.exists()) {
                        const alumnasFirebase = Object.keys(snap.val());
                        const alumnasCurso = (curso.students || []).map(s => s.studentCode);
                        
                        // Eliminar las que ya no están en el curso
                        alumnasFirebase.forEach(codigo => {
                            if (!alumnasCurso.includes(codigo)) {
                                firebaseDB.ref(`alumnas/${modulo.prefix}/${curso.id}/${codigo}`).remove()
                                    .then(() => {
                                        console.log('🗑️ Alumna eliminada de Firebase:', codigo);
                                    });
                            }
                        });
                    }
                });
                
                // 🔥 Registrar alumnas: alumnas/{modulo}/{cursoId}/{codigo}
                (curso.students || []).forEach(student => {
                    const alumnaRef = firebaseDB.ref(`alumnas/${modulo.prefix}/${curso.id}/${student.studentCode}`);
                    alumnaRef.once('value').then(snap => {
                        if (!snap.exists()) {
                            // Crear nueva alumna
                            alumnaRef.set({
                                id: student.studentCode,
                                nombre: student.name,
                                modulo: modulo.prefix,
                                cursoId: curso.id,
                                cursoNombre: curso.name,
                                fechaRegistro: new Date().toISOString(),
                                activa: true,
                                clasesDesbloqueadas: [],
                                asistencia: []
                            }).then(() => {
                                console.log('✅ Alumna creada:', student.name);
                            });
                        } else {
                            // Actualizar nombre si cambió
                            alumnaRef.update({
                                nombre: student.name,
                                cursoNombre: curso.name
                            });
                        }
                    });
                });
            }).catch(err => console.error('Error subiendo curso:', err));
        });
    }
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

list.innerHTML = f.sort((a, b) => a.name.localeCompare(b.name)).map(m => {
            const isPending = m.pending === true;
            const pendingClass = isPending ? ' pending' : '';
            const pendingBadge = isPending ? '<div class="pending-badge"><i class="bx bx-error-circle"></i> Pendiente por completar</div>' : '';
            const priceDisplay = isPending ? '<span class="card-price" style="color:var(--warning-color);">⚠️ Sin precio</span>' : `<span class="card-price">$${formatCLP(m.price)}</span>`;

              return `
            <div class="card${pendingClass}" onclick="showAddMaterialModal('${m.id}')" style="cursor:pointer;">
                <div class="card-info">
                    <h3>${sanitizeHTML(m.name)}</h3>
                    <p>${isPending ? 'Sin datos' : m.qty + ' ' + m.unit}</p>
                    ${pendingBadge}
                    ${isPending ? '' : getPriceBadgeHTML(m)}
                </div>
                <div style="display:flex;align-items:center;gap:15px;">
                    ${priceDisplay}
                    <button class="btn-icon danger" onclick="event.stopPropagation(); deleteMaterial('${m.id}')"><i class='bx bx-trash'></i></button>
                </div>
            </div>
        `;
        }).join('');
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
    s.innerHTML =
        '<option value="">Selecciona...</option>' +
        '<option value="__nuevo__">➕ Nuevo material...</option>' +
        m.sort((a, b) => a.name.localeCompare(b.name))
            .map(m => `<option value="${m.id}">${m.name}${m.pending ? ' ⚠️' : ''} ($${formatCLP(m.price)} x ${m.qty}${m.unit})</option>`)
            .join('');
}

function updateDecorationSelect() {
    const s = document.getElementById('recipe-add-deco-mat');
    const m = materials.filter(m => m.category === 'decoracion');
    s.innerHTML =
        '<option value="">Selecciona...</option>' +
        '<option value="__nuevo__">➕ Nueva decoración...</option>' +
        m.sort((a, b) => a.name.localeCompare(b.name))
            .map(m => `<option value="${m.id}">${m.name}${m.pending ? ' ⚠️' : ''} ($${formatCLP(m.price)} x ${m.qty}${m.unit})</option>`)
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
                if (!m.pending && i.pending) {
                    i.pending = false;
                    c = true;
                }
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
                if (!m.pending && d.pending) {
                    d.pending = false;
                    c = true;
                }
                const nc = calculateIngredientCost(m, d.qty, d.unit);
                if (nc !== d.cost) {
                    d.cost = nc;
                    c = true;
                }
            }
        });

        if (r.extraSubcategory) {
            const ne = materials
                .filter(m => m.category === 'extra' && normalizeText(m.subcategory) === normalizeText(r.extraSubcategory))
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

    if (mi === '__nuevo__') {
        if (isNaN(q) || q <= 0) {
            showToast('Ingresa la cantidad primero', true);
            document.getElementById('recipe-add-mat').value = '';
            return;
        }

        showNewMaterialNameModal('productos', function(name) {
            const existing = materials.find(m =>
                m.name.toLowerCase().trim() === name.toLowerCase().trim() &&
                (m.category || 'productos') === 'productos'
            );

            if (existing) {
                currentRecipeIngredients.push({
                    id: Date.now().toString(),
                    matId: String(existing.id),
                    name: existing.name,
                    qty: q,
                    unit: u,
                    cost: existing.pending ? 0 : calculateIngredientCost(existing, q, u),
                    pending: existing.pending || false
                });
                document.getElementById('recipe-add-mat').value = '';
                document.getElementById('recipe-add-qty').value = '';
                renderCurrentRecipeIngredients();
                updateRecipeTotal();
                showToast('"' + existing.name + '" agregado');
                return;
            }

            showPendingMaterialModal(name, 'productos', function(mat) {
                currentRecipeIngredients.push({
                    id: Date.now().toString(),
                    matId: String(mat.id),
                    name: mat.name,
                    qty: q,
                    unit: u,
                    cost: mat.pending ? 0 : calculateIngredientCost(mat, q, u),
                    pending: mat.pending || false
                });
                document.getElementById('recipe-add-mat').value = '';
                document.getElementById('recipe-add-qty').value = '';
                updateMaterialSelect();
                renderCurrentRecipeIngredients();
                updateRecipeTotal();
            });
        });
        return;
    }

    if (mi && !isNaN(q) && q > 0) {
        const m = materials.find(x => String(x.id) === String(mi));
        if (!m) return;

        currentRecipeIngredients.push({
            id: Date.now().toString(),
            matId: String(m.id),
            name: m.name,
            qty: q,
            unit: u,
            cost: m.pending ? 0 : calculateIngredientCost(m, q, u),
            pending: m.pending || false
        });

        document.getElementById('recipe-add-mat').value = '';
        document.getElementById('recipe-add-qty').value = '';
        renderCurrentRecipeIngredients();
        updateRecipeTotal();
        return;
    }

    showToast("Completa datos", true);
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
    l.innerHTML = currentRecipeIngredients.map(i => {
        const isPending = i.pending === true;
        const costDisplay = isPending 
            ? '<span class="ingredient-cost" style="color:var(--warning-color);">⚠️ Pendiente</span>' 
            : `<span class="ingredient-cost">$${formatCLP(i.cost)}</span>`;

        const trashBtn = currentRecipeIsRestricted ? '' : `
            <button class="btn-icon danger" onclick="removeIngredientFromRecipe('${i.id}')" style="width:28px;height:28px;font-size:16px;">
                <i class='bx bx-trash'></i>
            </button>`;

        return `
        <div class="ingredient-item" style="${isPending ? 'border:1px dashed var(--warning-color);' : ''}">
            <div class="ingredient-details">
                <span><strong>${sanitizeHTML(i.name)}</strong></span>
                <span style="font-size:12px;color:var(--text-muted);">${i.qty} ${i.unit}</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
                ${costDisplay}
                ${trashBtn}
            </div>
        </div>
    `;
    }).join('');
}

function addDecorationToRecipeForm() {
    const mi = document.getElementById('recipe-add-deco-mat').value;
    const q = parseFloat(document.getElementById('recipe-add-deco-qty').value);
    const u = document.getElementById('recipe-add-deco-unit').value;

    if (mi === '__nuevo__') {
        if (isNaN(q) || q <= 0) {
            showToast('Ingresa la cantidad primero', true);
            document.getElementById('recipe-add-deco-mat').value = '';
            return;
        }

        showNewMaterialNameModal('decoracion', function(name) {
            const existing = materials.find(m =>
                m.name.toLowerCase().trim() === name.toLowerCase().trim() &&
                m.category === 'decoracion'
            );

            if (existing) {
                currentRecipeDecorations.push({
                    id: Date.now().toString(),
                    matId: String(existing.id),
                    name: existing.name,
                    qty: q,
                    unit: u,
                    cost: existing.pending ? 0 : calculateIngredientCost(existing, q, u),
                    pending: existing.pending || false
                });
                document.getElementById('recipe-add-deco-mat').value = '';
                document.getElementById('recipe-add-deco-qty').value = '';
                renderCurrentRecipeDecorations();
                updateRecipeTotal();
                showToast('"' + existing.name + '" agregado');
                return;
            }

            showPendingMaterialModal(name, 'decoracion', function(mat) {
                currentRecipeDecorations.push({
                    id: Date.now().toString(),
                    matId: String(mat.id),
                    name: mat.name,
                    qty: q,
                    unit: u,
                    cost: mat.pending ? 0 : calculateIngredientCost(mat, q, u),
                    pending: mat.pending || false
                });
                document.getElementById('recipe-add-deco-mat').value = '';
                document.getElementById('recipe-add-deco-qty').value = '';
                updateDecorationSelect();
                renderCurrentRecipeDecorations();
                updateRecipeTotal();
            });
        });
        return;
    }

    if (mi && !isNaN(q) && q > 0) {
        const m = materials.find(x => String(x.id) === String(mi));
        if (!m) return;

        currentRecipeDecorations.push({
            id: Date.now().toString(),
            matId: String(m.id),
            name: m.name,
            qty: q,
            unit: u,
            cost: m.pending ? 0 : calculateIngredientCost(m, q, u),
            pending: m.pending || false
        });

        document.getElementById('recipe-add-deco-mat').value = '';
        document.getElementById('recipe-add-deco-qty').value = '';
        renderCurrentRecipeDecorations();
        updateRecipeTotal();
        return;
    }

    showToast("Completa datos", true);
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
    l.innerHTML = currentRecipeDecorations.map(i => {
        const isPending = i.pending === true;
        const costDisplay = isPending 
            ? '<span class="ingredient-cost" style="color:var(--warning-color);">⚠️ Pendiente</span>' 
            : `<span class="ingredient-cost">$${formatCLP(i.cost)}</span>`;

        return `
        <div class="ingredient-item" style="${isPending ? 'border:1px dashed var(--warning-color);' : ''}">
            <div class="ingredient-details">
                <span><strong>${sanitizeHTML(i.name)}</strong></span>
                <span style="font-size:12px;color:var(--text-muted);">${i.qty} ${i.unit}</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
                ${costDisplay}
                <button class="btn-icon danger" onclick="removeDecorationFromRecipe('${i.id}')" style="width:28px;height:28px;font-size:16px;">
                    <i class='bx bx-trash'></i>
                </button>
            </div>
        </div>
    `;
    }).join('');
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
    const recipeTips = document.getElementById('recipe-tips-input') ? document.getElementById('recipe-tips-input').value.trim() : '';
    const recipePhoto = currentRecipePhoto || null;
    const moduleClassSelect = document.getElementById('recipe-module-class-select');
    const recipeModuleClass = moduleClassSelect ? moduleClassSelect.value : '';

    const folderSelect = document.getElementById('recipe-folder-input');
    const finalFolder = recipeFolder || (folderSelect ? folderSelect.value : '') || 'Mis Recetas';

    let finalSource = recipeSource;
    if (window.currentModuleRecipeMode) {
        finalSource = 'module';
    } else if (finalFolder !== 'Mis Recetas') {
        const matchingModule = modules.find(m => m.name === finalFolder);
        if (matchingModule) {
            finalSource = 'module';
        }
    } else if (finalFolder === 'Mis Recetas') {
        finalSource = 'personal';
    }
 
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
                sourceClassDate: recipes[idx].sourceClassDate || sourceClassDate,
                recipePhoto: recipePhoto,
                recipeTips: recipeTips,
                moduleClass: recipeModuleClass
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
            sourceClassDate: sourceClassDate,
            recipePhoto: recipePhoto,
            recipeTips: recipeTips,
            moduleClass: recipeModuleClass
         };

        recipes.push(newRecipe);
        showToast("Receta guardada!");

        if (finalSource === 'class' || finalSource === 'module') {
            currentSelectedClassRecipe = JSON.parse(JSON.stringify(newRecipe));
            renderSelectedClassRecipeBox();
        }
    }

    // Advertencia si se mueve a módulo sin foto o tips
    if (finalSource === 'module' && teacherMode.active) {
        if (!recipePhoto && !recipeTips) {
            showToast('⚠️ Receta sin foto ni tips', false);
        } else if (!recipePhoto) {
            showToast('⚠️ Receta sin foto', false);
        } else if (!recipeTips) {
            showToast('⚠️ Receta sin tips', false);
        }
    }
    
    // ¡NUEVO! Sincronizar esta receta actualizada con las clases que ya la están usando
    if (currentEditingRecipeId) {
        const updatedRecipe = recipes.find(r => String(r.id) === String(currentEditingRecipeId));
        if (updatedRecipe) {
            let coursesUpdated = false;
            courses.forEach(c => {
                (c.classes || []).forEach(cls => {
                    // Actualizar en linkedRecipes (array nuevo)
                    if (cls.linkedRecipes) {
                        const idx = cls.linkedRecipes.findIndex(lr => String(lr.id) === String(currentEditingRecipeId));
                        if (idx !== -1) {
                            cls.linkedRecipes[idx] = JSON.parse(JSON.stringify(updatedRecipe));
                            coursesUpdated = true;
                        }
                    }
                    // Actualizar en linkedRecipe (versión antigua por compatibilidad)
                    if (cls.linkedRecipe && String(cls.linkedRecipe.id) === String(currentEditingRecipeId)) {
                        cls.linkedRecipe = JSON.parse(JSON.stringify(updatedRecipe));
                        coursesUpdated = true;
                    }
                });
            });
            if (coursesUpdated) {
                saveCourses();
            }
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
    const checked = document.getElementById('toggle-selling-price').checked;
    syncAllPriceToggles(checked);
}

function toggleSellingPriceStudentMirror() {
    const checked = document.getElementById('toggle-selling-price-student').checked;
    syncAllPriceToggles(checked);
}

function toggleSellingPriceDefaultMirror() {
    const checked = document.getElementById('toggle-selling-price-default').checked;
    syncAllPriceToggles(checked);
}

function syncAllPriceToggles(checked) {
    showMinSellingPrice = checked;

    ['toggle-selling-price', 'toggle-selling-price-student', 'toggle-selling-price-default'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = checked;
    });

    document.querySelectorAll('.price-toggle-label.cost-label').forEach(el => {
        if (checked) {
            el.classList.remove('active-label');
        } else {
            el.classList.add('active-label');
        }
    });

    document.querySelectorAll('.price-toggle-label.sale-label').forEach(el => {
        if (checked) {
            el.classList.add('active-label');
        } else {
            el.classList.remove('active-label');
        }
    });

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

    // Separar recetas por clase (subcarpeta)
    const classGroups = {};
    const noClassRecipes = [];

    folderRecipes.forEach(r => {
        if (r.moduleClass) {
            if (!classGroups[r.moduleClass]) classGroups[r.moduleClass] = [];
            classGroups[r.moduleClass].push(r);
        } else {
            noClassRecipes.push(r);
        }
    });

    const classNames = Object.keys(classGroups).sort((a, b) => a.localeCompare(b));

    let recipesHTML = '';

    // Dibujar las subcarpetas (Clase 1, Clase 2...)
    classNames.forEach(className => {
        const classRecipes = classGroups[className].sort((a, b) => a.name.localeCompare(b.name));
        const classSubId = className.replace(/[^a-zA-Z0-9]/g, '_') + '_' + folderId;

        recipesHTML += `
            <div class="recipe-folder" style="margin-top:10px;">
                <div class="recipe-folder-header" onclick="toggleFolderBody('student-class','${classSubId}')">
                    <div class="recipe-folder-header-left">
                        <i class='bx bx-book-open' style="font-size:18px;color:var(--secondary-color);"></i>
                        <div>
                            <h3 style="font-size:14px;">${sanitizeHTML(className)}</h3>
                            <div class="recipe-folder-count">${classRecipes.length} receta${classRecipes.length !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                    <i class='bx bx-chevron-down recipe-folder-chevron' id="student-class-chevron-${classSubId}" style="transform:rotate(-90deg);"></i>
                </div>
                <div class="recipe-folder-body" id="student-class-body-${classSubId}">
                    ${classRecipes.map(r => renderRecipeCard(r, priceColor)).join('')}
                </div>
            </div>
        `;
    });

    // Dibujar las recetas sueltas (como las de "Mis Recetas")
    if (noClassRecipes.length > 0) {
        recipesHTML += noClassRecipes
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(r => renderRecipeCard(r, priceColor))
            .join('');
    }

    return `
        <div class="recipe-folder">
            <div class="recipe-folder-header" onclick="toggleFolderBody('recipe-folder','${folderId}')">
                <div class="recipe-folder-header-left">
                    <i class='bx bx-folder-open' style="font-size:22px;color:var(--secondary-color);"></i>
                    <div>
                        <h3>${sanitizeHTML(folderName)}</h3>
                        <div class="recipe-folder-count">${folderRecipes.length} receta${folderRecipes.length !== 1 ? 's' : ''}</div>
                    </div>
                </div>
                <i class='bx bx-chevron-down recipe-folder-chevron' id="recipe-folder-chevron-${folderId}" style="transform:rotate(-90deg);"></i>
            </div>
            <div class="recipe-folder-body" id="recipe-folder-body-${folderId}">
                ${recipesHTML}
            </div>
        </div>
    `;
}

function renderModuleFolder(mod, recipesInModule) {
    const moduleId = mod.id;
    const priceColor = showMinSellingPrice ? 'var(--secondary-color)' : 'var(--primary-color)';

    const classGroups = {};
    const noClassRecipes = [];

    recipesInModule.forEach(r => {
        if (r.moduleClass) {
            if (!classGroups[r.moduleClass]) classGroups[r.moduleClass] = [];
            classGroups[r.moduleClass].push(r);
        } else {
            noClassRecipes.push(r);
        }
    });

    const classNames = Object.keys(classGroups).sort((a, b) => a.localeCompare(b));

    let recipesHTML = '';

    classNames.forEach(className => {
        const classRecipes = classGroups[className].sort((a, b) => a.name.localeCompare(b.name));
        const classId = className.replace(/[^a-zA-Z0-9]/g, '_') + '_' + moduleId;

        recipesHTML += `
            <div class="recipe-folder" style="margin-top:10px;">
                <div class="recipe-folder-header" onclick="toggleFolderBody('module-class','${classId}')">
                    <div class="recipe-folder-header-left">
                        <i class='bx bx-book-open' style="font-size:18px;color:var(--secondary-color);"></i>
                        <div>
                            <h3 style="font-size:14px;">${sanitizeHTML(className)}</h3>
                            <div class="recipe-folder-count">${classRecipes.length} receta${classRecipes.length !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                    <div class="action-buttons-group" onclick="event.stopPropagation()">
                        <button class="btn-icon" style="width:32px; height:32px;" onclick="editModuleClassName('${mod.name}', '${className}')">
                            <i class='bx bx-edit' style="font-size:16px;"></i>
                        </button>
                        <button class="btn-icon danger" style="width:32px; height:32px;" onclick="deleteModuleClass('${mod.name}', '${className}')">
                            <i class='bx bx-trash' style="font-size:16px;"></i>
                        </button>
                    </div>
                    <i class='bx bx-chevron-down recipe-folder-chevron' id="module-class-chevron-${classId}" style="transform:rotate(-90deg); margin-left:4px;"></i>
                </div>
                <div class="recipe-folder-body" id="module-class-body-${classId}">
                    ${classRecipes.map(r => renderRecipeCard(r, priceColor)).join('')}
                    <button class="btn-add-class" style="margin-top:12px;" onclick="createRecipeInModuleClass('${mod.name}', '${className}')">
                        <i class='bx bx-plus'></i> Agregar receta a esta clase
                    </button>
                </div>
            </div>
        `;
    });

    if (noClassRecipes.length > 0) {
        recipesHTML += noClassRecipes
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(r => renderRecipeCard(r, priceColor))
            .join('');
    }

    return `
        <div class="recipe-folder">
            <div class="recipe-folder-header" onclick="toggleFolderBody('module-folder','${moduleId}')">
                <div class="recipe-folder-header-left">
                    <i class='bx bx-book' style="font-size:22px;color:var(--secondary-color);"></i>
                    <div>
                        <h3>${sanitizeHTML(mod.name)}</h3>
                        <div class="recipe-folder-count">Prefijo: ${mod.prefix} • ${recipesInModule.length} receta${recipesInModule.length !== 1 ? 's' : ''}${classNames.length > 0 ? ' • ' + classNames.length + ' clase' + (classNames.length !== 1 ? 's' : '') : ''}</div>
                    </div>
                </div>
                <div class="action-buttons-group" onclick="event.stopPropagation()">
                    <button class="btn-icon" onclick="showCreateModuleModal('${mod.id}')"><i class='bx bx-edit'></i></button>
                    <button class="btn-icon danger" onclick="deleteModule('${mod.id}')"><i class='bx bx-trash'></i></button>
                    <i class='bx bx-chevron-down recipe-folder-chevron' id="module-folder-chevron-${moduleId}" style="transform:rotate(-90deg); margin-left:4px;"></i>
                </div>
            </div>

            <div class="recipe-folder-body" id="module-folder-body-${moduleId}">
                ${recipesHTML}

                <button class="btn-add-class" style="margin-top:16px; border:2px dashed var(--secondary-color); background:transparent;" onclick="addNewModuleClassDirectly('${mod.name}')">
                    <i class='bx bx-plus'></i> Crear Nueva Clase
                </button>
            </div>
        </div>
    `;
}

function renderRecipeCard(r, priceColor) {
    const scale = r.scale || 1;
    
    // Toggles de exclusión
    const includeDeco = !r.excludeDecorations;
    const includeExtra = !r.excludeExtra;

    const ic = (r.ingredients || []).reduce((s, i) => s + i.cost, 0) * scale;
    const rawDc = (r.decorations || []).reduce((s, i) => s + i.cost, 0) * scale;
    const rawEc = (r.extraCost || 0) * scale;
    
    const dc = includeDeco ? rawDc : 0;
    const ec = includeExtra ? rawEc : 0;
    
    const scaledTotal = ic + dc + ec;
    
    let dp = scaledTotal;
    let pl = "Precio costo:";
    if (showMinSellingPrice) {
        dp = Math.floor((scaledTotal * profitMargin) / 500) * 500;
        pl = `Sugerido (x${profitMargin}):`;
    }

    const ti = (r.ingredients || []).length + (r.decorations || []).length;
    const se = Math.floor((scaledTotal * profitMargin) / 500) * 500;
    const scaledPortions = (r.portions || 1) * scale;

    const pendingIngredients = (r.ingredients || []).filter(i => i.pending === true);
    const pendingDecorations = (r.decorations || []).filter(i => i.pending === true);
    const totalPending = pendingIngredients.length + pendingDecorations.length;
    const pendingWarning = totalPending > 0 
        ? `<div class="pending-alert"><i class='bx bx-error-circle'></i> ${totalPending} material${totalPending > 1 ? 'es' : ''} pendiente${totalPending > 1 ? 's' : ''}</div>` 
        : '';

    const pb = scaledPortions > 1
        ? `<div class="portions-badge"><i class='bx bx-cut'></i> ${formatQty(scaledPortions)} porciones • $${formatCLP(Math.round(dp / scaledPortions))} c/u</div>`
        : '';

    let bd = '';
    
    bd += `
    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-color); padding:8px 12px; border-radius:var(--radius-sm); margin-bottom:12px; border:1px solid rgba(0,0,0,0.05);">
        <span style="font-size:13px; font-weight:600;"><i class='bx bx-math'></i> Multiplicar receta:</span>
        <select onchange="changeRecipeScale('${r.id}', this.value)" onclick="event.stopPropagation()" style="width:auto; padding:4px 8px; font-size:13px; min-height:auto; border-color:var(--secondary-color);">
            <option value="0.5" ${scale === 0.5 ? 'selected' : ''}>x0.5 (Mitad)</option>
            <option value="1" ${scale === 1 ? 'selected' : ''}>x1 (Normal)</option>
            <option value="2" ${scale === 2 ? 'selected' : ''}>x2 (Doble)</option>
            <option value="3" ${scale === 3 ? 'selected' : ''}>x3 (Triple)</option>
        </select>
    </div>`;

    if ((r.ingredients || []).length > 0) {
        bd += `<div class="recipe-breakdown-section">
            <div class="recipe-breakdown-header"><span><i class='bx bx-package'></i> Ingredientes</span><span>$${formatCLP(ic)}</span></div>
            ${r.ingredients.map(i => `<div class="recipe-breakdown-item"><span>${sanitizeHTML(i.name)} (${formatQty(i.qty * scale)} ${i.unit})</span><span>$${formatCLP(i.cost * scale)}</span></div>`).join('')}
        </div>`;
    }
    if ((r.decorations || []).length > 0) {
        bd += `<div class="recipe-breakdown-section">
            <div class="recipe-breakdown-header" style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class='bx bx-palette'></i> Decoración
                    <label class="switch" style="width:28px; height:16px; margin:0;">
                        <input type="checkbox" ${includeDeco ? 'checked' : ''} onclick="event.stopPropagation()" onchange="toggleRecipeSection('${r.id}', 'deco', this.checked)">
                        <span class="slider round" style="border-radius:16px;"></span>
                    </label>
                </div>
                <span style="${!includeDeco ? 'text-decoration:line-through; opacity:0.5;' : ''}">$${formatCLP(rawDc)}</span>
            </div>
            ${includeDeco ? r.decorations.map(d => `<div class="recipe-breakdown-item"><span>${sanitizeHTML(d.name)} (${formatQty(d.qty * scale)} ${d.unit})</span><span>$${formatCLP(d.cost * scale)}</span></div>`).join('') : ''}
        </div>`;
    }
    if (r.extraSubcategory && rawEc > 0) {
        const eis = materials.filter(m => m.category === 'extra' && normalizeText(m.subcategory) === normalizeText(r.extraSubcategory));
        bd += `<div class="recipe-breakdown-section">
            <div class="recipe-breakdown-header" style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class='bx bx-star'></i> Extra
                    <label class="switch" style="width:28px; height:16px; margin:0;">
                        <input type="checkbox" ${includeExtra ? 'checked' : ''} onclick="event.stopPropagation()" onchange="toggleRecipeSection('${r.id}', 'extra', this.checked)">
                        <span class="slider round" style="border-radius:16px;"></span>
                    </label>
                </div>
                <span style="${!includeExtra ? 'text-decoration:line-through; opacity:0.5;' : ''}">$${formatCLP(rawEc)}</span>
            </div>
            ${includeExtra ? eis.map(m => `<div class="recipe-breakdown-item"><span>${sanitizeHTML(m.name)}</span><span>$${formatCLP(m.price * scale)}</span></div>`).join('') : ''}
        </div>`;
    }
    bd += `<div class="recipe-breakdown-total"><span>COSTO TOTAL</span><span>$${formatCLP(scaledTotal)}</span></div>`;

    if (totalPending > 0) {
        bd += `<div style="background:rgba(245,158,11,0.1);border-left:3px solid var(--warning-color);border-radius:0 var(--radius-sm) var(--radius-sm) 0;padding:12px 14px;margin-top:12px;">
            <strong style="color:var(--warning-color);font-size:13px;display:block;margin-bottom:6px;">⚠️ Materiales pendientes por completar:</strong>
            ${pendingIngredients.map(i => `<div style="font-size:13px;color:var(--text-muted);padding:2px 0;">• ${sanitizeHTML(i.name)} (${formatQty(i.qty * scale)} ${i.unit})</div>`).join('')}
            ${pendingDecorations.map(i => `<div style="font-size:13px;color:var(--text-muted);padding:2px 0;">• ${sanitizeHTML(i.name)} (${formatQty(i.qty * scale)} ${i.unit})</div>`).join('')}
            <p style="font-size:12px;color:var(--text-muted);margin:8px 0 0;">Ve a Materiales y completa los datos para calcular el costo real.</p>
        </div>`;
    }

    let sl = `<div class="recipe-selling-section"><div class="recipe-selling-row highlight"><span>💰 Venta entera:</span><span>$${formatCLP(se)}</span></div>`;
    if (scaledPortions > 1) {
        const sp = Math.round(se / scaledPortions);
        sl += `<div class="recipe-selling-row"><span>🍰 Por porción (${formatQty(scaledPortions)}x):</span><span>$${formatCLP(sp)} c/u</span></div>
               <div class="recipe-selling-row"><span>Total porciones:</span><span>$${formatCLP(sp * scaledPortions)}</span></div>`;
    }
    sl += `</div>`;

    let tipH = '';
    
    // Los tips de la profe ahora van en la vista de la clase, no en la receta.
    // Aquí solo mostramos el consejo automático del ingrediente más caro.
    const tip = generateRecipeTip(r);
    tipH = tip ? `<div class="recipe-tip"><strong>💡 Consejo</strong><br>${tip}</div>` : '';

    const recipePhotoH = (teacherMode.active && r.recipePhoto)
        ? `<button class="btn-submit" style="margin-top:12px; background:var(--surface-hover); color:var(--secondary-color); border:1px dashed var(--secondary-color);" onclick="event.stopPropagation(); openPhotoFullscreen('${r.recipePhoto}', 'Vista Previa')">
            <i class='bx bx-image'></i> Ver foto adjunta
           </button>`
        : '';

    const sourceBadge = r.recipeSource === 'class'
        ? `<div class="module-badge"><i class='bx bx-book'></i> Receta de módulo</div>`
        : '';

    return `
        <div class="recipe-card">
            <div class="recipe-card-header" onclick="toggleRecipeDetail('${r.id}')" style="cursor:pointer;">
                <div class="recipe-card-info">
                    <h3>${sanitizeHTML(r.name)}</h3>
                    <p>${ti} Items${r.extraSubcategory ? ' + Extra' : ''}</p>
                    ${sourceBadge}
                    ${pendingWarning}
                    ${pb}
                </div>
                <div class="recipe-card-price">
                    <div class="recipe-card-price-label">${pl}</div>
                    <div class="recipe-card-price-value" style="color:${priceColor};">$${formatCLP(dp)}</div>
                </div>
            </div>
            <div class="recipe-card-toggle" id="recipe-toggle-${r.id}" onclick="toggleRecipeDetail('${r.id}')" style="cursor:pointer;">
                <i class='bx bx-chevron-down'></i>
            </div>
            <div class="recipe-card-detail" id="recipe-detail-${r.id}">
                <div class="recipe-detail-content">
                    ${recipePhotoH}
                    ${bd}
                    ${sl}
                    ${tipH}
                    ${r.sharedBy ? `
                    <div style="text-align:center; padding:10px 0; margin-top:12px; border-top:1px dashed rgba(0,0,0,0.08);">
                        <span style="font-size:12px; color:var(--text-muted);">
                            <i class='bx bx-share-alt' style="font-size:14px; vertical-align:middle; margin-right:4px; color:var(--secondary-color);"></i>
                            Receta compartida por 
                            <strong style="color:var(--secondary-color);">
                                ${sanitizeHTML(r.sharedBy)}
                            </strong>
                        </span>
                    </div>` : ''}
                    ${(r.recipeSource !== 'class' && r.recipeSource !== 'module') || teacherMode.active ? `
                    <div class="action-buttons-group" style="margin-top:16px;">
                        <button class="btn-submit" style="margin-top:0;flex:1;" onclick="showAddRecipeModal('${r.id}')"><i class='bx bx-edit'></i> Editar</button>
                        <button class="btn-icon" style="background:var(--secondary-color);color:white;" onclick="shareRecipe('${r.id}')" title="Compartir"><i class='bx bx-share-alt'></i></button>
                        <button class="btn-icon danger" onclick="deleteRecipe('${r.id}')"><i class='bx bx-trash'></i></button>
                    </div>` : `
                    <div class="action-buttons-group" style="margin-top:16px; justify-content:center;">
                        <button class="btn-submit" style="margin-top:0;flex:1; background:var(--surface-hover); color:var(--text-main); border:1px dashed var(--secondary-color);" onclick="showAddRecipeModal('${r.id}')">
                            <i class='bx bx-slider-alt' style="color:var(--secondary-color);"></i> Personalizar Receta
                        </button>
                    </div>`}
                </div>
            </div>
        </div>
    `;
}

function formatCLP(value) {
    if (value === null || value === undefined || isNaN(value)) {
        value = 0;
    }
    // Solo devuelve el número con puntos, SIN el signo peso
    return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatDate(ds) {
    const ms = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const d = new Date(ds + 'T00:00:00');
    return `${d.getDate()} ${ms[d.getMonth()]} ${d.getFullYear()}`;
}

function updateClassesView() {
    const teacherView = document.getElementById('teacher-classes-view');
    const studentView = document.getElementById('student-classes-view');
    const noModeView = document.getElementById('no-mode-classes-view');

    if (teacherMode.active) {
        if (teacherView) teacherView.style.display = 'block';
        if (studentView) studentView.style.display = 'none';
        if (noModeView) noModeView.style.display = 'none';
        renderCourses();
    } else {
        if (teacherView) teacherView.style.display = 'none';
        if (studentView) studentView.style.display = 'block';
        if (noModeView) noModeView.style.display = 'none';

        const loginContainer = document.getElementById('student-login-container');
        const dashboardContainer = document.getElementById('student-dashboard-container');
        
        if (studentProfiles.length > 0) {
            if (loginContainer) loginContainer.style.display = 'none';
            if (dashboardContainer) dashboardContainer.style.display = 'block';
            renderStudentDashboard();
            document.getElementById('student-header-name-display').style.display = 'block';
            document.getElementById('student-header-name-display').textContent = 'Hola, ' + studentName;
        } else {
            // Si no se ha registrado
            if (loginContainer) loginContainer.style.display = 'block';
            if (dashboardContainer) dashboardContainer.style.display = 'none';
            document.getElementById('student-header-name-display').style.display = 'none';
        }
    }
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

    list.innerHTML = courses.map((course) => {
        const moduleData = modules.find(m => String(m.id) === String(course.moduleId));
        const modulePrefix = moduleData ? moduleData.prefix : '---';
        const totalClasses = course.totalClasses || 18;

        const studentStats = (course.students || []).map(student => {
            let attended = 0;
            let totalClassesHeld = (course.classes || []).length;

            (course.classes || []).forEach(cls => {
                const att = (cls.attendance || []).find(a => 
                    String(a.studentId) === String(student.id)
                );
                if (att && att.present) attended++;
            });

            const percentage = totalClassesHeld > 0 ? Math.round((attended / totalClassesHeld) * 100) : 100;
            const absences = totalClassesHeld - attended;
            const warning = absences >= 3;

            return {
                ...student,
                attended,
                totalClassesHeld,
                percentage,
                absences,
                warning
            };
        });

        const classesHTML = (course.classes || [])
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(cls => {
                const att = cls.attendance || [];
                const present = att.filter(a => a.present).length;
                const total = att.length;
                return `
                <div class="class-item">
                    <div class="class-item-info" onclick="previewClassAsStudent('${course.id}', '${cls.id}')">
                        <h4>${sanitizeHTML(cls.name)}</h4>
                        <p>📅 ${formatDate(cls.date)} • ${cls.blockCode || '----'} • ✅ ${present}/${total}</p>
                    </div>
                    <div class="action-buttons-group">
                        <button class="btn-icon" onclick="showEditClassModal('${course.id}','${cls.id}')"><i class='bx bx-edit'></i></button>
                        <button class="btn-icon" onclick="showAttendanceModal('${course.id}','${cls.id}')"><i class='bx bx-clipboard'></i></button>
                        <button class="btn-icon danger" onclick="deleteClass('${course.id}','${cls.id}')"><i class='bx bx-trash'></i></button>
                    </div>
                </div>`;
            }).join('');

        const studentsHTML = studentStats.map(s => {
            const barColor = s.warning ? 'var(--danger-color)' : s.percentage >= 80 ? 'var(--success-color)' : 'var(--warning-color)';
            const warningIcon = s.warning ? ' ⚠️' : '';
            return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(0,0,0,0.04); font-size:13px;">
                <div style="display:flex; align-items:center; gap:6px;">
                    <span class="student-code-badge">${s.studentCode || '--'}</span>
                    <span>${sanitizeHTML(s.name)}${warningIcon}</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="width:60px; height:6px; background:rgba(0,0,0,0.08); border-radius:3px; overflow:hidden;">
                        <div style="width:${s.percentage}%; height:100%; background:${barColor}; border-radius:3px;"></div>
                    </div>
                    <span style="font-weight:600; color:${barColor}; min-width:35px; text-align:right;">${s.percentage}%</span>
                </div>
            </div>`;
        }).join('');

        const folderId = course.id;
        const classCount = (course.classes || []).length;

        return `
            <div class="course-card">
                <div class="course-card-header" onclick="toggleFolderBody('course-folder','${folderId}')">
                    <div class="course-card-header-left">
                        <i class='bx bxs-graduation' style="font-size:24px;color:var(--secondary-color);"></i>
                        <div>
                            <h3>${sanitizeHTML(course.name)}</h3>
                            <div class="course-card-day">${course.day} • ${modulePrefix}</div>
                            <div class="course-card-schedule">${course.schedule || ''} • ${course.students.length} alumnos • ${classCount} clase${classCount !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                    <div class="action-buttons-group" onclick="event.stopPropagation()">
                        <button class="btn-icon" onclick="showCreateCourseModal('${course.id}')"><i class='bx bx-edit'></i></button>
                        <button class="btn-icon danger" onclick="deleteCourse('${course.id}')"><i class='bx bx-trash'></i></button>
                    </div>
                </div>
                <div class="course-card-body" id="course-folder-body-${folderId}">
                    <div style="background:var(--surface-hover); border-radius:var(--radius-sm); padding:12px; margin-bottom:12px;">
                        <h4 style="font-size:13px; color:var(--text-muted); margin:0 0 8px; display:flex; align-items:center; gap:6px;">
                            <i class='bx bx-user' style="color:var(--secondary-color);"></i> Alumnos y Asistencia
                        </h4>
                        ${studentsHTML || '<p style="font-size:13px;color:var(--text-muted);">Sin alumnos</p>'}
                    </div>

                    ${classesHTML}

                    <button class="btn-add-class" onclick="showCreateClassModal('${course.id}')">
                        <i class='bx bx-plus'></i> Nueva Clase
                    </button>
                </div>
            </div>
        `;
    }).join('');
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
                <button type="button" onclick="removeStudentFromCourse('${s.id}')"><i class='bx bx-x'></i></button>
            </div>
        </div>
    `).join('');
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
    // Buscar datos del estudiante antes de eliminarlo
    const studentToRemove = currentCourseStudents.find(s => String(s.id) === String(studentId));
    
    // Eliminar de la lista local
    currentCourseStudents = currentCourseStudents.filter(s => String(s.id) !== String(studentId));
    
    // Reordenar códigos
    currentCourseStudents = currentCourseStudents.map((s, index) => ({
        ...s,
        studentCode: String(index + 1).padStart(2, '0')
    }));
    
    // 🔥 Eliminar de Firebase si existe
    if (studentToRemove && typeof firebaseDB !== 'undefined' && teacherMode.active) {
        // Obtener módulo y curso actual
        const courseId = currentEditingCourseId;
        if (courseId) {
            const course = courses.find(c => String(c.id) === String(courseId));
            if (course) {
                const modulo = modules.find(m => String(m.id) === String(course.moduleId));
                if (modulo) {
                    const alumnaRef = firebaseDB.ref(`alumnas/${modulo.prefix}/${courseId}/${studentToRemove.studentCode}`);
                    alumnaRef.remove()
                        .then(() => {
                            console.log('✅ Alumna eliminada de Firebase:', studentToRemove.name);
                        })
                        .catch(err => {
                            console.error('Error eliminando de Firebase:', err);
                        });
                }
            }
        }
    }
    
    renderCourseStudents();
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

function showCreateClassModal(courseId) {
    currentEditingClassId = null;
    currentClassPhotos = [];
    currentSelectedClassRecipe = null;

    document.getElementById('class-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('modal-class-title').textContent = 'Crear Clase';
    document.getElementById('class-linked-recipes-box').style.display = 'none';
    document.getElementById('class-linked-recipes-list').innerHTML = '';

    const courseSelect = document.getElementById('class-course-select');
    const courseName = courses.find(c => String(c.id) === String(courseId))?.name || '';
    courseSelect.innerHTML = `<option value="${courseId}" selected>${courseName}</option>`;
    courseSelect.disabled = true;

    updateClassModuleClassSelect(courseId);

    document.getElementById('modal-create-class').classList.add('active');
}

function updateClassModuleClassSelect(courseId) {
    const course = courses.find(c => String(c.id) === String(courseId));
    if (!course) return;

    const mod = modules.find(m => String(m.id) === String(course.moduleId));
    if (!mod) return;

    const moduleClasses = getModuleClasses(mod.name);
    const select = document.getElementById('class-module-class-select');

    select.innerHTML = '<option value="">Selecciona una clase...</option>' +
        moduleClasses.map(c => `<option value="${c}">${c}</option>`).join('');
}

function onClassCourseChange() {
    const courseId = document.getElementById('class-course-select').value;
    updateClassModuleClassSelect(courseId);
    document.getElementById('class-linked-recipes-box').style.display = 'none';
    document.getElementById('class-linked-recipes-list').innerHTML = '';
}

function onClassModuleClassChange() {
    const moduleClassName = document.getElementById('class-module-class-select').value;
    const courseId = document.getElementById('class-course-select').value;
    const course = courses.find(c => String(c.id) === String(courseId));

    if (!moduleClassName || !course) {
        document.getElementById('class-linked-recipes-box').style.display = 'none';
        return;
    }

    const mod = modules.find(m => String(m.id) === String(course.moduleId));
    if (!mod) return;

    const classRecipes = recipes.filter(r =>
        r.recipeFolder === mod.name &&
        r.moduleClass === moduleClassName &&
        (r.recipeSource === 'module' || r.recipeSource === 'class')
    );

    const box = document.getElementById('class-linked-recipes-box');
    const list = document.getElementById('class-linked-recipes-list');

    if (classRecipes.length === 0) {
        box.style.display = 'block';
        list.innerHTML = '<p style="font-size:13px; color:var(--warning-color);">⚠️ No hay recetas en esta clase del módulo</p>';
        return;
    }

    box.style.display = 'block';
    list.innerHTML = classRecipes.map(r => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; font-size:13px;">
            <span>✅ ${sanitizeHTML(r.name)}</span>
            <span style="font-weight:600;">$${formatCLP(r.totalCost)}</span>
        </div>
    `).join('');
}

function showEditClassModal(courseId, classId) {
    const course = courses.find(c => String(c.id) === String(courseId));
    if (!course) return;
    const cls = (course.classes || []).find(cl => String(cl.id) === String(classId));
    if (!cls) return;

    currentEditingClassId = classId;
    currentClassPhotos = [...(cls.photos || [])];

    document.getElementById('class-date').value = cls.date;
    document.getElementById('modal-class-title').textContent = 'Editar Clase • ' + (cls.blockCode || '');

    const courseSelect = document.getElementById('class-course-select');
    courseSelect.innerHTML = courses.map(c =>
        `<option value="${c.id}" ${String(c.id) === String(courseId) ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    updateClassModuleClassSelect(courseId);

    // Seleccionar la clase del módulo
    const moduleClassSelect = document.getElementById('class-module-class-select');
    if (cls.moduleClassName) {
        moduleClassSelect.value = cls.moduleClassName;
        onClassModuleClassChange();
    }

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
    if (!preview) return;
    if (!currentClassPhotos || !currentClassPhotos.length) {
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

function saveClass() {
    const courseId = document.getElementById('class-course-select').value;
    const date = document.getElementById('class-date').value;
    const moduleClassName = document.getElementById('class-module-class-select').value;
    const codeExpiry = parseInt(document.getElementById('class-code-expiry').value);

    if (!date) { showToast('Selecciona fecha', true); return; }
    if (!moduleClassName) { showToast('Selecciona una clase del módulo', true); return; }

    const course = courses.find(c => String(c.id) === String(courseId));
    if (!course) { showToast('Selecciona un curso', true); return; }

    const mod = modules.find(m => String(m.id) === String(course.moduleId));
    if (!mod) return;

    // Buscar recetas de la clase del módulo
    const classRecipes = recipes.filter(r =>
        r.recipeFolder === mod.name &&
        r.moduleClass === moduleClassName &&
        (r.recipeSource === 'module' || r.recipeSource === 'class')
    );

    if (classRecipes.length === 0) {
        showToast('Esta clase no tiene recetas', true);
        return;
    }

    if (currentEditingClassId) {
        const cls = (course.classes || []).find(cl => String(cl.id) === String(currentEditingClassId));
        if (!cls) return;

        cls.name = moduleClassName;
        cls.date = date;
        cls.moduleClassName = moduleClassName;
        cls.linkedRecipes = classRecipes.map(r => JSON.parse(JSON.stringify(r)));
        cls.linkedRecipe = classRecipes[0] ? JSON.parse(JSON.stringify(classRecipes[0])) : null;
        cls.codeExpiry = codeExpiry;
        showToast('Clase actualizada!');
    } else {
        const modulePrefix = mod ? mod.prefix : 'MOD';
        const blockCode = generateClassBlockCode();

        const attendance = course.students.map(s => ({
            studentId: s.id,
            studentName: s.name,
            studentCode: s.studentCode,
            present: false,
            code: null,
            shortCode: '',
            codeData: null,
            codeUsed: false,
            activatedAt: null
        }));

        const newClass = {
            id: Date.now().toString(),
            name: moduleClassName,
            date,
            moduleClassName,
            tips: '',
            photos: [],
            linkedRecipeId: classRecipes[0] ? classRecipes[0].id : null,
            linkedRecipe: classRecipes[0] ? JSON.parse(JSON.stringify(classRecipes[0])) : null,
            linkedRecipes: classRecipes.map(r => JSON.parse(JSON.stringify(r))),
            codeExpiry,
            blockCode,
            attendance,
            codesGenerated: false
        };

        if (!course.classes) course.classes = [];
        course.classes.push(newClass);
        showToast('Clase "' + moduleClassName + '" creada! Código: ' + blockCode);
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

    // Mostrar códigos solo si ya se generaron
    const codesSection = document.getElementById('generated-codes-section');
    if (cls.codesGenerated) {
        codesSection.style.display = 'block';
        renderGeneratedCodes(cls, course);
    } else {
        codesSection.style.display = 'none';
    }

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

    // Guardar asistencia
    cls.attendance = JSON.parse(JSON.stringify(currentAttendanceData));
    saveCourses();

    // Generar códigos con la asistencia actual
    generateCodes();

    renderAttendanceList();
    renderCourses();
    showToast('Asistencia guardada y códigos generados! ✅');
}

function renderAttendanceList() {
    const list = document.getElementById('attendance-list');
    list.innerHTML = currentAttendanceData.map(a => {
        const statusIcon = a.present ? '✅' : '❌';
        let codeStatus = '';
        if (a.code && a.codeUsed) {
            codeStatus = `<span class="attendance-code-status sent">📋 copiado</span>`;
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
        const visibleCode = buildVisibleShortCode(
            modulePrefix,
            cls.blockCode || 'R75T',
            a.studentCode || '00',
            a.present
        );

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

    const codesSection = document.getElementById('generated-codes-section');
    codesSection.style.display = 'block';
    renderGeneratedCodes(cls, course);
    renderAttendanceList();
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
                    <span class="code-item-name">${sanitizeHTML(a.studentName)}</span>
                    <span class="student-code-badge">${a.studentCode || '--'}</span>
                </div>
                <div class="code-item-short">${a.shortCode || '---'}</div>
            </div>
            <button class="code-item-copy" onclick="copyShortCode('${a.studentId}')">Copiar</button>
        </div>`;
}

function copyShortCode(studentId) {
    const a = currentAttendanceData.find(x => String(x.studentId) === String(studentId));
    if (!a || !a.shortCode) {
        showToast('No hay código generado', true);
        return;
    }

    const codeToCopy = a.shortCode;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(codeToCopy).then(() => {
            a.codeUsed = true;
            saveAttendanceOnly();
            renderAttendanceList();
            showToast('Código ' + codeToCopy + ' copiado!');
        });
    } else {
        const ta = document.createElement('textarea');
        ta.value = codeToCopy;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        a.codeUsed = true;
        saveAttendanceOnly();
        renderAttendanceList();
        showToast('Código ' + codeToCopy + ' copiado!');
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

function renderStudentDashboard() {
    if (studentProfiles.length === 0) return;

    const modulesList = document.getElementById('student-modules-list');

    modulesList.innerHTML = studentProfiles.map(p => {
        const myClasses = importedClasses.filter(ic => ic.courseName === p.courseName);
        const attended = myClasses.filter(ic => ic.present).length;
        const totalClasses = Math.max(p.totalClassesInModule || 0, myClasses.length);
        const percentage = totalClasses > 0 ? Math.round((attended / totalClasses) * 100) : 100;
        const folderId = 'student-mod-' + (p.moduleId || '').replace(/[^a-zA-Z0-9]/g, '_');

        // Ordenar clases por fecha
        const sortedClasses = myClasses.sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastClass = sortedClasses.length > 0 ? sortedClasses[0] : null;

        // Renderizar clases dentro del módulo
        const classesHTML = sortedClasses.length > 0
            ? sortedClasses.map(ic => `
                <div class="imported-class-card" onclick="viewImportedClass('${ic.id}')" style="margin-bottom:8px;">
                    <h3>${sanitizeHTML(ic.className)}</h3>
                    <p>📅 ${formatDate(ic.date)}</p>
                    <span class="class-content-badge ${ic.present ? 'present' : 'absent'}">
                        ${ic.present ? '✅ Presente' : '⚠️ Ausente'}
                    </span>
                </div>
            `).join('')
            : '<div class="empty-state" style="padding:15px;font-size:13px;">No has desbloqueado clases aún.</div>';

        return `
        <div class="course-card" style="margin-bottom:12px;">
            <div class="course-card-header" onclick="toggleFolderBody('${folderId}','main')">
                <div class="course-card-header-left">
                    <i class='bx bxs-graduation' style="font-size:24px;color:var(--secondary-color);"></i>
                    <div>
                        <h3>${sanitizeHTML(p.courseName)}</h3>
                        <div class="course-card-day">${p.modulePrefix} • ${sanitizeHTML(p.name)}</div>
                        <div class="course-card-schedule">
                            Asistencia: ${percentage}% (${attended}/${totalClasses})
                            ${lastClass ? ' • Última: ' + sanitizeHTML(lastClass.className) : ''}
                        </div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:6px;" onclick="event.stopPropagation()">
                    <button class="btn-icon" onclick="removeStudentModule('${p.moduleId}')" style="width:24px; height:24px; font-size:14px; opacity:0.5;">
                        <i class='bx bx-x'></i>
                    </button>
                </div>
            </div>
            <div class="course-card-body" id="${folderId}-body-main">
                <div style="margin-top:8px; padding:8px; background:var(--surface-hover); border-radius:var(--radius-sm); margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted);">
                        <span>Asistencia</span>
                        <span style="font-weight:600; color:${percentage >= 80 ? 'var(--success-color)' : 'var(--warning-color)'};">${percentage}%</span>
                    </div>
                    <div style="width:100%; height:4px; background:rgba(0,0,0,0.05); border-radius:2px; margin-top:4px; overflow:hidden;">
                        <div style="width:${percentage}%; height:100%; background:${percentage >= 80 ? 'var(--success-color)' : 'var(--warning-color)'}; border-radius:2px;"></div>
                    </div>
                </div>

                ${classesHTML}

                <button class="btn-add-class" onclick="showImportClassModal()">
                    <i class='bx bx-key'></i> Ingresar Código de Clase
                </button>
            </div>
        </div>`;
    }).join('');

    // Ocultar la lista global de clases
    const globalList = document.getElementById('student-class-folders-list');
    if (globalList) globalList.style.display = 'none';
}

function showAddModuleModal() {
    document.getElementById('student-login-container').style.display = 'block';
    document.getElementById('student-dashboard-container').style.display = 'none';
    document.getElementById('student-login-prefix').value = '';
    document.getElementById('student-login-step2').style.display = 'none';
}

function removeStudentModule(moduleId) {
    showConfirmModal('Quitar módulo', '¿Seguro? No perderás tus clases desbloqueadas, pero dejarás de ver este módulo en tu lista.', () => {
        studentProfiles = studentProfiles.filter(p => String(p.moduleId) !== String(moduleId));
        localStorage.setItem('mushu_student_profiles', JSON.stringify(studentProfiles));
        updateClassesView();
    });
}

function refreshAllStudentClasses() {
    if (!navigator.onLine) {
        showToast('Necesitas internet para sincronizar', true);
        return;
    }
    if (studentProfiles.length === 0 || importedClasses.length === 0) {
        showToast('No tienes clases para sincronizar', true);
        return;
    }
    showToast('⏳ Sincronizando desde GitHub...', false);

    const uniquePrefixes = [...new Set(studentProfiles.map(p => p.modulePrefix))];
    let updatedClassesCount = 0;
    let fetchesCompleted = 0;
    const allMissing = [];

    uniquePrefixes.forEach(prefix => {
        const fileName = prefix.toLowerCase() + '-module.json';
        const url = 'https://tibustyle.github.io/MushuApp/modules/' + fileName + '?v=' + Date.now();

        fetch(url)
            .then(response => { if (!response.ok) throw new Error('No encontrado'); return response.json(); })
            .then(data => {
                if (!data.type || data.type !== 'module') throw new Error('Inválido');

                importedClasses.forEach(ic => {
                    if (ic.moduleName === data.module.name || data.module.prefix === prefix) {
                        let githubClass = null;
                        (data.classes || []).forEach(cls => {
                            if (cls.classId === ic.classId || cls.blockCode === (ic.visibleCode || '').slice(-8, -3)) {
                                githubClass = cls;
                            }
                        });

                        if (githubClass) {
                            ic.tips = githubClass.tips || '';
                            ic.photos = githubClass.photos || [];
                            ic.className = githubClass.className || ic.className;
                            updatedClassesCount++;
                            
                            const recipesToUpdate = githubClass.linkedRecipes || (githubClass.linkedRecipe ? [githubClass.linkedRecipe] : []);
                            ic.linkedRecipes = recipesToUpdate;

                            recipesToUpdate.forEach(githubRecipe => {
                                const localRecipe = recipes.find(r => 
                                    normalizeText(r.name) === normalizeText(githubRecipe.name) && 
                                    r.recipeSource === 'class' && r.recipeFolder === ic.courseName
                                );
                                
                                if (localRecipe) {
                                    localRecipe.recipeTips = githubRecipe.recipeTips || '';
                                    localRecipe.recipePhoto = githubRecipe.recipePhoto || null;
                                    localRecipe.portions = githubRecipe.portions || 1;
                                    localRecipe.extraSubcategory = githubRecipe.extraSubcategory || null;
                                    localRecipe.moduleClass = githubRecipe.moduleClass || '';
                                    
                                    const allItems = [...(githubRecipe.ingredients || []), ...(githubRecipe.decorations || [])];
                                    allItems.forEach(item => {
                                        const found = materials.find(m => normalizeText(m.name) === normalizeText(item.name));
                                        if (!found && !allMissing.find(mm => normalizeText(mm.name) === normalizeText(item.name))) {
                                            const isDeco = (githubRecipe.decorations || []).some(d => normalizeText(d.name) === normalizeText(item.name));
                                            allMissing.push({ name: item.name, category: isDeco ? 'decoracion' : 'productos' });
                                        }
                                    });

                                    // ¡Buscando Extras faltantes!
                                    if (githubRecipe.extraSubcategory) {
                                        const extraFound = materials.find(m => m.category === 'extra' && normalizeText(m.subcategory) === normalizeText(githubRecipe.extraSubcategory));
                                        if (!extraFound && !allMissing.find(mm => normalizeText(mm.name) === normalizeText(githubRecipe.extraSubcategory))) {
                                            allMissing.push({ name: githubRecipe.extraSubcategory, category: 'extra' });
                                        }
                                    }

                                    localRecipe.ingredients = (githubRecipe.ingredients || []).map(i => {
                                        const localMat = materials.find(m => normalizeText(m.name) === normalizeText(i.name));
                                        return { ...i, id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5), matId: localMat ? String(localMat.id) : '', cost: (localMat && !localMat.pending) ? calculateIngredientCost(localMat, i.qty, i.unit) : 0, pending: localMat ? (localMat.pending || false) : true };
                                    });

                                    localRecipe.decorations = (githubRecipe.decorations || []).map(d => {
                                        const localMat = materials.find(m => normalizeText(m.name) === normalizeText(d.name));
                                        return { ...d, id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5), matId: localMat ? String(localMat.id) : '', cost: (localMat && !localMat.pending) ? calculateIngredientCost(localMat, d.qty, d.unit) : 0, pending: localMat ? (localMat.pending || false) : true };
                                    });

                                    const icCost = localRecipe.ingredients.reduce((s, i) => s + (i.cost || 0), 0);
                                    const dcCost = localRecipe.decorations.reduce((s, d) => s + (d.cost || 0), 0);
                                    let ecCost = 0;
                                    if (localRecipe.extraSubcategory) {
                                        const extraItems = materials.filter(m => m.category === 'extra' && m.subcategory === localRecipe.extraSubcategory);
                                        ecCost = extraItems.reduce((s, m) => s + m.price, 0);
                                    }
                                    localRecipe.totalCost = icCost + dcCost + ecCost;
                                }
                            });
                        }
                    }
                });
            })
            .catch(err => console.error(err))
            .finally(() => {
                fetchesCompleted++;
                if (fetchesCompleted === uniquePrefixes.length) {
                    if (allMissing.length > 0) {
                        showMissingMaterialsModal(allMissing);
                    }
                    if (updatedClassesCount > 0) {
                        saveImportedClasses();
                        saveRecipesToStorage();
                        updateClassesView();
                        updateRecipesView();
                        closeModal('modal-settings');
                        showToast(`¡Sincronizado! (${updatedClassesCount} clases actualizadas) ✅`);
                    } else {
                        showToast('Tus clases ya están al día ✅');
                    }
                }
            });
    });
}

function renderImportedClasses() {
    renderStudentClassesByFolders();
}

function viewImportedClass(classId) {
    const ic = importedClasses.find(x => String(x.id) === String(classId));
    if (!ic) return;

    const watermarkName = (studentName || ic.studentName || 'Alumno') + ' • MushuApp';

    document.getElementById('modal-view-class-title').textContent = sanitizeHTML(ic.className);

    let html = `<div style="margin-bottom:12px; font-size:13px; color:var(--text-muted);">
        📅 ${ic.date || ''} | 📌 ${sanitizeHTML(ic.moduleName || '')}
    </div>`;

    // === 1. FOTOS DE LA CLASE PRIMERO ===
    // Asegurar compatibilidad por si Firebase lo guardó como 'fotos' en vez de 'photos'
    const classPhotos = ic.photos || ic.fotos || [];
    
    if (classPhotos.length > 0) {
        html += `<div class="class-content-section" style="margin-bottom:16px;">
            <h4 style="margin:0 0 10px 0; font-size:14px;"><i class='bx bx-camera'></i> Fotos de la Clase</h4>
            <div class="class-content-photos" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                ${classPhotos.map(p => `
                    <div class="class-content-photo" style="position:relative; overflow:hidden; border-radius:var(--radius-sm);">
                        <img src="${p}" alt="Foto de clase" class="no-save-img" draggable="false" 
                             oncontextmenu="return false;" 
                             onclick="event.stopPropagation(); openPhotoFullscreen('${p}', '${sanitizeHTML(watermarkName)}')" 
                             style="cursor:pointer; width:100%; height:120px; object-fit:cover; display:block;">
                        <div class="watermark-photo">${sanitizeHTML(watermarkName)}</div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    // === 2. TIPS GENERALES DE LA CLASE ===
    if (ic.tips) {
        html += `<div class="class-content-tips" style="margin-bottom:20px; background:var(--surface-hover); padding:12px; border-radius:var(--radius-sm); border-left:3px solid var(--secondary-color);">
                    <strong style="color:var(--secondary-color); font-size:13px; display:block; margin-bottom:4px;">💡 Tips de la Profe:</strong>
                    ${sanitizeHTML(ic.tips).replace(/\n/g, '<br>')}
                 </div>`;
    }

    // === 3. RECETAS VINCULADAS ===
    const rList = ic.linkedRecipes || (ic.linkedRecipe ? [ic.linkedRecipe] : []);

    if (rList && rList.length > 0) {
        html += `<h4 style="margin:0 0 10px 0; font-size:14px;"><i class='bx bx-receipt'></i> Recetas de la Clase</h4>`;
        
        rList.forEach(r => {
            // Buscar la receta en el inventario local para el botón
            let recipeId = null;
            const fullR = recipes.find(rr => rr.name === r.name && rr.recipeFolder === ic.moduleName);
            if (fullR) recipeId = fullR.id;

            html += `<div style="margin-bottom:16px; border:1px solid var(--border-color); border-radius:var(--radius-md); padding:12px;">
                        <h4 style="margin:0 0 10px 0; color:var(--text-color); font-size:15px;">${sanitizeHTML(r.name)}</h4>`;

            // Foto individual de la receta
            if (r.recipePhoto) {
                html += `<div class="class-content-photo" style="margin-bottom:10px; position:relative; overflow:hidden;">
                    <img src="${r.recipePhoto}" alt="Foto de receta" 
                         class="no-save-img" draggable="false"
                         oncontextmenu="return false;"
                         onclick="event.stopPropagation(); openPhotoFullscreen('${r.recipePhoto}', '${sanitizeHTML(watermarkName)}')" 
                         style="cursor:pointer; width:100%; border-radius:var(--radius-sm); display:block;">
                    <div class="watermark-photo">${sanitizeHTML(watermarkName)}</div>
                </div>`;
            }

            // Tips de la receta individual
            if (r.recipeTips) {
                html += `<div class="class-content-tips" style="margin-bottom:12px; margin-top:8px;">
                            <strong style="color:var(--secondary-color); font-size:13px; display:block; margin-bottom:4px;">💡 Nota de receta:</strong>
                            ${sanitizeHTML(r.recipeTips).replace(/\n/g, '<br>')}
                         </div>`;
            }

            // Botón de ver costo
            if (recipeId) {
                html += `<button class="btn-submit" style="margin-top:0; background:linear-gradient(135deg, var(--secondary-color), var(--secondary-hover));" 
                         onclick="closeModal('modal-view-class'); openRecipeFromClass('${recipeId}')">
                    <i class='bx bx-book-open'></i> Ver costo de receta
                </button>`;
            } else {
                html += `<div style="background:var(--surface-hover);border-radius:var(--radius-sm);padding:12px;margin-top:8px;">
                    <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${sanitizeHTML(r.name)}</div>
                    <div style="font-size:13px;color:var(--text-muted);">Costo: $${formatCLP(r.totalCost)}</div>
                </div>`;
            }

            html += `</div>`;
        });
    } else {
        html += `<div class="empty-state" style="margin-top:12px;">No hay recetas vinculadas a esta clase</div>`;
    }

    document.getElementById('modal-view-class-content').innerHTML = html;
    document.getElementById('modal-view-class').classList.add('active');
}

function showImportClassModal() {
    document.getElementById('import-class-code').value = '';
    document.getElementById('modal-import-class').classList.add('active');
}

function normalizeText(str) {
    if (!str) return '';
    return str.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar acentos
        .replace(/[^a-z0-9]/g, "") // quitar símbolos
        .trim();
}

function getMissingMaterialsForRecipe(recipe) {
    const needed = [];
    const all = [...(recipe.ingredients || []), ...(recipe.decorations || [])];

    all.forEach(item => {
        const exists = materials.some(m => normalizeText(m.name) === normalizeText(item.name));
        
        if (!exists && !needed.find(n => normalizeText(n.name) === normalizeText(item.name))) {
            const isDeco = (recipe.decorations || []).some(d => 
                normalizeText(d.name) === normalizeText(item.name)
            );
            needed.push({
                name: item.name,
                category: isDeco ? 'decoracion' : 'productos'
            });
        }
    });

    // ¡NUEVO! Detectar si falta el Extra
    if (recipe.extraSubcategory) {
        const extraExists = materials.some(m => 
            m.category === 'extra' && normalizeText(m.subcategory) === normalizeText(recipe.extraSubcategory)
        );
        if (!extraExists && !needed.find(n => normalizeText(n.name) === normalizeText(recipe.extraSubcategory))) {
            needed.push({
                name: recipe.extraSubcategory,
                category: 'extra'
            });
        }
    }

    return needed;
}

function importClassFromCode() {
    const codeInput = document.getElementById('import-class-code').value.trim();
    if (!codeInput) { showToast('Pega un código', true); return; }

    if (codeInput.length > 20) {
        importClassFromLongCode(codeInput);
        return;
    }

    importClassFromShortCode(codeInput);
}

function importClassFromLongCode(codeInput) {
    try {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(codeInput))));

        if (!decoded.className || (!decoded.linkedRecipe && !decoded.linkedRecipes)) {
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

        const linkedRecipes = decoded.linkedRecipes || (decoded.linkedRecipe ? [decoded.linkedRecipe] : []);
        const allMissing = [];

        linkedRecipes.forEach(r => {
            const missing = getMissingMaterialsForRecipe(r);
            missing.forEach(m => {
                if (!allMissing.find(am => normalizeText(am.name) === normalizeText(m.name))) {
                    allMissing.push(m);
                }
            });
        });

        if (allMissing.length > 0) {
            pendingImportClassData = decoded;
            showMissingMaterialsModal(allMissing);
            closeModal('modal-import-class');
            return;
        }

        completeClassImport(decoded);

    } catch (err) {
        console.error(err);
        showToast('Código inválido o corrupto', true);
    }
}

function importClassFromShortCode(code) {
    if (code.length < 10) {
        showToast('Código muy corto', true);
        return;
    }

    const studentCode = code.slice(-2);
    const attendanceDigit = parseInt(code.slice(-3, -2));
    const blockCode = code.slice(-8, -3);
    const prefix = code.slice(0, -8);

    if (!prefix || prefix.length < 2) {
        showToast('Código inválido (prefijo)', true);
        return;
    }

    if (isNaN(attendanceDigit)) {
        showToast('Código inválido (asistencia)', true);
        return;
    }

    const isPresent = attendanceDigit % 2 !== 0;

    const fileName = prefix.toLowerCase() + '-module.json';
    const url = 'https://tibustyle.github.io/MushuApp/modules/' + fileName + '?v=' + Date.now();

    showToast('⏳ Buscando clase...', false);

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Módulo no encontrado');
            return response.json();
        })
        .then(data => {
            if (!data.type || data.type !== 'module') {
                showToast('Módulo no válido', true);
                return;
            }

            let classData = null;
            let courseData = null;

            (data.courses || []).forEach(c => {
                const foundClass = (data.classes || []).find(cls => 
                    cls.blockCode === blockCode && cls.courseId === c.id
                );
                if (foundClass) {
                    classData = foundClass;
                    courseData = c;
                }
            });

            if (!classData) {
                classData = (data.classes || []).find(cls => cls.blockCode === blockCode);
            }

            if (!classData) {
                showToast('Clase no encontrada con ese código', true);
                return;
            }

            const studentData = (classData.attendance || []).find(a =>
                a.studentCode === studentCode
            );

            if (!studentData) {
                showToast('Alumno no encontrado con ese código', true);
                return;
            }

            const existing = importedClasses.find(ic =>
                ic.classId === classData.classId &&
                ic.studentName === studentData.studentName
            );
            if (existing) {
                showToast('Ya importaste esta clase', true);
                return;
            }

            const decoded = {
                code: code,
                className: classData.className,
                courseId: classData.courseId,
                courseName: classData.courseName,
                moduleId: data.module.id,
                moduleName: data.module.name,
                classId: classData.classId,
                studentId: studentData.studentId,
                studentName: studentData.studentName,
                studentCode: studentCode,
                present: isPresent,
                date: classData.date,
                tips: classData.tips || '',
                photos: classData.photos || [],
                linkedRecipe: classData.linkedRecipe || null,
                linkedRecipes: classData.linkedRecipes || [],
                expiry: null
            };

            const linkedRecipes = decoded.linkedRecipes || (decoded.linkedRecipe ? [decoded.linkedRecipe] : []);
            const allMissing = [];

            linkedRecipes.forEach(r => {
                const missing = getMissingMaterialsForRecipe(r);
                missing.forEach(m => {
                    if (!allMissing.find(am => normalizeText(am.name) === normalizeText(m.name))) {
                        allMissing.push(m);
                    }
                });
            });

            if (allMissing.length > 0) {
                pendingImportClassData = decoded;
                showMissingMaterialsModal(allMissing);
                closeModal('modal-import-class');
                return;
            }

            completeClassImport(decoded);
        })
        .catch(err => {
            console.error(err);
            showToast('No se encontró el módulo "' + prefix + '". ¿Ya lo subieron?', true);
        });
}

function showMissingMaterialsModal(missing) {
    const list = document.getElementById('missing-materials-list');
    list.innerHTML = missing.map((m, i) => {
       const catLabel = m.category === 'decoracion' ? 'Decoración' : (m.category === 'extra' ? 'Extra' : 'Ingrediente');
        
        return `
        <div class="missing-material-item">
            <h4><i class='bx bx-error-circle'></i> ${catLabel}: ${sanitizeHTML(m.name)}</h4>
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
        `;
    }).join('');
    document.getElementById('modal-missing-materials').classList.add('active');
}

function saveMissingMaterialsAndContinue() {
    const items = document.querySelectorAll('[id^="missing-name-"]');

    for (let i = 0; i < items.length; i++) {
        const rawName = document.getElementById('missing-name-' + i).value.trim();
        const category = document.getElementById('missing-category-' + i).value;
        const price = parseFloat(document.getElementById('missing-price-' + i).value);
        const qty = parseFloat(document.getElementById('missing-qty-' + i).value);
        const unit = document.getElementById('missing-unit-' + i).value;

        if (!rawName || isNaN(price) || isNaN(qty) || qty <= 0) {
            showToast('Completa todos los materiales faltantes', true);
            return;
        }

        const exists = materials.find(m => normalizeText(m.name) === normalizeText(rawName) && m.category === category);
        
        if (exists) {
            if (exists.pending) {
                exists.price = price;
                exists.qty = qty;
                exists.unit = unit;
                exists.pending = false;
                if (category === 'extra') {
                    exists.subcategory = rawName;
                }
                exists.priceHistory = [{ date: new Date().toISOString().slice(0, 10), price: price }];
            }
        } else {
            materials.push({
                id: Date.now().toString() + '-' + i + '-' + Math.random().toString(36).substr(2, 5),
                name: rawName,
                price: price,
                qty: qty,
                unit: unit,
                category: category,
                subcategory: category === 'extra' ? rawName : '',
                priceHistory: [{ date: new Date().toISOString().slice(0, 10), price: price }]
            });
        }
    }

    const extraItems = materials.filter(m => m.category === 'extra');
    let extraSubcategories = JSON.parse(localStorage.getItem('mushu_extra_subcategories')) || [];
    extraItems.forEach(m => {
        if (m.subcategory && !extraSubcategories.includes(m.subcategory)) {
            extraSubcategories.push(m.subcategory);
        }
    });
    localStorage.setItem('mushu_extra_subcategories', JSON.stringify(extraSubcategories));

    saveMaterialsToStorage();

    // 🔴 AQUÍ ESTÁ LA CLAVE: Forzar el recálculo en las recetas guardadas
    recalculateAllRecipes();

    renderMaterials();
    updateMaterialSelect();
    updateDecorationSelect();
    updateExtraSubcategorySelect();

    closeModal('modal-missing-materials');

    // 🔴 Y en el Alumno hay que asegurarse de recalcular el pendingImportClassData ANTES de importarlo
    if (pendingImportClassData) {
        
        const recipesToProcess = pendingImportClassData.linkedRecipes || (pendingImportClassData.linkedRecipe ? [pendingImportClassData.linkedRecipe] : []);
        
        recipesToProcess.forEach(r => {
            (r.ingredients || []).forEach(i => {
                const localMat = materials.find(m => normalizeText(m.name) === normalizeText(i.name));
                if (localMat && !localMat.pending) {
                    i.cost = calculateIngredientCost(localMat, i.qty, i.unit);
                }
            });
            (r.decorations || []).forEach(d => {
                const localMat = materials.find(m => normalizeText(m.name) === normalizeText(d.name));
                if (localMat && !localMat.pending) {
                    d.cost = calculateIngredientCost(localMat, d.qty, d.unit);
                }
            });
            
            if (r.extraSubcategory) {
                const extraItemsLocal = materials.filter(m => m.category === 'extra' && normalizeText(m.subcategory) === normalizeText(r.extraSubcategory));
                r.extraCost = extraItemsLocal.reduce((s, m) => s + m.price, 0);
            }

            const icCost = (r.ingredients || []).reduce((s, i) => s + (i.cost || 0), 0);
            const dcCost = (r.decorations || []).reduce((s, d) => s + (d.cost || 0), 0);
            r.totalCost = icCost + dcCost + (r.extraCost || 0);
        });

        completeClassImport(pendingImportClassData);
        pendingImportClassData = null;
        setTimeout(() => {
            updateClassesView();
        }, 100);
    } else {
        showToast('Materiales guardados y clases actualizadas ✅');
        updateClassesView();
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
        linkedRecipes: decoded.linkedRecipes,
        importedAt: new Date().toISOString()
    };

    importedClasses.push(importedClass);
    saveImportedClasses();

        importedClasses.push(importedClass);
    saveImportedClasses();

    // 🔥 PROCESAR CÓDIGO EN FIREBASE
    // Extraer datos del código visual (formato: PA1-A123B-1-01)
    if (decoded.code) {
        const partes = decoded.code.split('-');
        if (partes.length === 4) {
            const codigoData = {
                modulePrefix: partes[0],      // PA1
                classId: partes[1],           // A123B
                attendance: partes[2],        // 1 (impar=presente)
                studentId: partes[3]          // 01
            };
            
            procesarCodigoEnFirebase(decoded.code, codigoData)
                .then(success => {
                    if (success) {
                        console.log('✅ Código procesado en Firebase');
                    }
                })
                .catch(err => {
                    console.error('Error procesando código en Firebase:', err);
                });
        }
    }

    const recipesToProcess = decoded.linkedRecipes || (decoded.linkedRecipe ? [decoded.linkedRecipe] : []);

    recipesToProcess.forEach(r => {
        const recipeCopy = JSON.parse(JSON.stringify(r));
        recipeCopy.id = Date.now().toString() + '-class-' + Math.random().toString(36).substr(2, 5);
        recipeCopy.recipeFolder = decoded.courseName;
        recipeCopy.recipeSource = 'class';
        recipeCopy.sourceCourseName = decoded.courseName;
        recipeCopy.sourceClassDate = decoded.date;

        // Actualizar IDs y RECALCULAR COSTOS de los ingredientes
        (recipeCopy.ingredients || []).forEach(i => {
            const localMat = materials.find(m => normalizeText(m.name) === normalizeText(i.name));
            if (localMat) {
                i.matId = String(localMat.id);
                i.pending = localMat.pending || false;
                if (!localMat.pending) {
                    i.cost = calculateIngredientCost(localMat, i.qty, i.unit);
                }
            }
        });

        // Actualizar IDs y RECALCULAR COSTOS de las decoraciones
        (recipeCopy.decorations || []).forEach(d => {
            const localMat = materials.find(m => normalizeText(m.name) === normalizeText(d.name));
            if (localMat) {
                d.matId = String(localMat.id);
                d.pending = localMat.pending || false;
                if (!localMat.pending) {
                    d.cost = calculateIngredientCost(localMat, d.qty, d.unit);
                }
            }
        });

        // Recalcular el costo extra y el costo total de la receta final
        const ic = (recipeCopy.ingredients || []).reduce((s, i) => s + (i.cost || 0), 0);
        const dc = (recipeCopy.decorations || []).reduce((s, d) => s + (d.cost || 0), 0);
        let ec = 0;
        if (recipeCopy.extraSubcategory) {
            const extraItems = materials.filter(m => m.category === 'extra' && m.subcategory === recipeCopy.extraSubcategory);
            ec = extraItems.reduce((s, m) => s + m.price, 0);
        }
        recipeCopy.totalCost = ic + dc + ec;

        const alreadyExists = recipes.find(rec =>
            rec.name === recipeCopy.name &&
            rec.recipeFolder === recipeCopy.recipeFolder &&
            rec.sourceClassDate === recipeCopy.sourceClassDate
        );

        if (!alreadyExists) {
            recipes.push(recipeCopy);
        }
    });

    saveRecipesToStorage();
    
    // Actualizar toda la información en las 3 pestañas
    renderMaterials();
    updateRecipesView();
    updateClassesView();
    
    // Auto-abrir la carpeta del curso en el dashboard del alumno
    setTimeout(() => {
        if (decoded.moduleId) {
            const folderId = 'student-mod-' + decoded.moduleId.replace(/[^a-zA-Z0-9]/g, '_');
            const bodyElement = document.getElementById(`${folderId}-body-main`);
            if (bodyElement) {
                bodyElement.classList.add('open');
            }
        }
    }, 100);
    
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

    // Mostrar sección de Actualizar Clases solo para alumnos con al menos un perfil
    const updateClassesSection = document.getElementById('student-update-classes-section');
    if (updateClassesSection) {
        if (!teacherMode.active && studentProfiles && studentProfiles.length > 0) {
            updateClassesSection.style.display = 'block';
        } else {
            updateClassesSection.style.display = 'none';
        }
    }

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
    
    if (teacherMode.active) {
        folderGroup.style.display = 'block';
        fillRecipeFolderSelect();
    } else {
        folderGroup.style.display = 'none';
    }

    if (folderInput) folderInput.value = '';
    currentRecipeIsRestricted = false;

    if (recipeId) {
        const r = recipes.find(r => String(r.id) === String(recipeId));
        if (r) {
            currentEditingRecipeId = String(r.id);
            document.getElementById('recipe-name').value = r.name;
            document.getElementById('recipe-portions').value = r.portions || '';
            currentRecipeIngredients = JSON.parse(JSON.stringify(r.ingredients || []));
            currentRecipeDecorations = JSON.parse(JSON.stringify(r.decorations || []));
             // 🔥 Asegurar que todos tengan un 'cost' numérico válido para evitar errores
            currentRecipeIngredients.forEach(i => i.cost = i.cost || 0);
            currentRecipeDecorations.forEach(d => d.cost = d.cost || 0);
            currentRecipeExtra = r.extraSubcategory || null;
            
            // Verificar si es alumno editando una receta importada
            currentRecipeIsRestricted = (!teacherMode.active && (r.recipeSource === 'class' || r.recipeSource === 'module'));
            
            document.querySelector('#modal-recipe h3').textContent = currentRecipeIsRestricted ? "🛠️ Personalizar Receta" : "Editar Receta";
            
            if (teacherMode.active && folderInput) {
                folderInput.value = r.recipeFolder || '';
            }
            recalculateIngredientCosts();
            if (btnD) btnD.style.display = 'flex';

            const moduleExtras = document.getElementById('module-recipe-extras');
            const tipsInput = document.getElementById('recipe-tips-input');
            const photoPreview = document.getElementById('recipe-photo-preview');
            const folderValue = folderInput ? folderInput.value : '';
            const isModuleRecipe = teacherMode.active && folderValue && folderValue !== 'Mis Recetas';
            const isEditingModuleRecipe = recipeId && teacherMode.active && recipes.find(rec => String(rec.id) === String(recipeId) && rec.recipeFolder && rec.recipeFolder !== 'Mis Recetas');

            if (isModuleRecipe || isEditingModuleRecipe || window.currentModuleRecipeMode) {
                if(moduleExtras) moduleExtras.style.display = 'block';
                currentRecipePhoto = r.recipePhoto || null;
                currentRecipeTips = r.recipeTips || '';
                if(tipsInput) tipsInput.value = currentRecipeTips;
                renderRecipePhotoPreview();
                currentRecipeModuleClass = r.moduleClass || '';
                updateModuleClassSelect(r.recipeFolder);
            } else {
                if(moduleExtras) moduleExtras.style.display = 'none';
                currentRecipePhoto = null;
                currentRecipeTips = '';
                currentRecipeModuleClass = '';
            }
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
        
        const moduleExtras = document.getElementById('module-recipe-extras');
        if(moduleExtras) moduleExtras.style.display = window.currentModuleRecipeMode ? 'block' : 'none';
        currentRecipePhoto = null;
        currentRecipeTips = '';
        currentRecipeModuleClass = '';
    }

    // Aplicar restricciones visuales si es alumno personalizando
    const nameGroup = document.getElementById('recipe-name-group');
    const portionsGroup = document.getElementById('recipe-portions-group');
    const ingredientsGroup = document.getElementById('recipe-ingredients-group');
    
    if (currentRecipeIsRestricted) {
        if (nameGroup) nameGroup.style.display = 'none';
        if (portionsGroup) portionsGroup.style.display = 'none';
        if (ingredientsGroup) ingredientsGroup.style.display = 'none';
        if (btnD) btnD.style.display = 'none';
        document.getElementById('recipe-name').disabled = true;
        document.getElementById('recipe-portions').disabled = true;
    } else {
        if (nameGroup) nameGroup.style.display = 'block';
        if (portionsGroup) portionsGroup.style.display = 'block';
        if (ingredientsGroup) ingredientsGroup.style.display = 'block';
        document.getElementById('recipe-name').disabled = false;
        document.getElementById('recipe-portions').disabled = false;
        if (currentEditingRecipeId && btnD) btnD.style.display = 'flex';
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
        priceHistory,
        pending: false
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

    if (window.pendingMaterialSaveCallback && material) {
        window.pendingMaterialSaveCallback(material);
        window.pendingMaterialSaveCallback = null;
    }

    // Scroll al nuevo material
    setTimeout(() => {
        const contentArea = document.querySelector('.content-area');
        if (contentArea) {
            contentArea.scrollTop = contentArea.scrollHeight;
        }
    }, 100);
    
    closeModal('modal-material');
}

function deleteModule(moduleId) {
    // Buscar el módulo para obtener el prefix
    const moduleToDelete = modules.find(m => String(m.id) === String(moduleId));
    
    showConfirmModal(
        'Eliminar módulo',
        '¿Eliminar este módulo? Las recetas que usen su nombre quedarán como están.\n\n⚠️ También se eliminará de Firebase (alumnas y cursos de este módulo).',
        () => {
            // 🔥 ELIMINAR DE FIREBASE
            if (moduleToDelete && typeof firebaseDB !== 'undefined' && teacherMode.active) {
                const prefix = moduleToDelete.prefix;
                
                // Eliminar módulo completo de Firebase
                firebaseDB.ref(`modulos/${prefix}`).remove()
                    .then(() => {
                        console.log('✅ Módulo eliminado de Firebase:', prefix);
                    })
                    .catch(err => {
                        console.error('Error eliminando módulo de Firebase:', err);
                    });
                
                // Eliminar todas las alumnas de este módulo
                firebaseDB.ref(`alumnas/${prefix}`).remove()
                    .then(() => {
                        console.log('✅ Alumnas del módulo eliminadas de Firebase:', prefix);
                    })
                    .catch(err => {
                        console.error('Error eliminando alumnas de Firebase:', err);
                    });
                
                // Eliminar cursos relacionados de la lista local
                courses = courses.filter(c => String(c.moduleId) !== String(moduleId));
                saveCourses();
            }
            
            // Eliminar de localStorage
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
    if (folderSelect) folderSelect.value = moduleName;

    renderCurrentRecipeIngredients();
    renderCurrentRecipeDecorations();
    updateMaterialSelect();
    updateDecorationSelect();
    updateExtraSubcategorySelect();
    renderExtraInRecipe();
    updateRecipeTotal();

    // Mostrar campos de módulo
    const moduleExtras = document.getElementById('module-recipe-extras');
    if (moduleExtras) moduleExtras.style.display = 'block';
    
    updateModuleClassSelect(moduleName);
    currentRecipeModuleClass = '';

    // Limpiar foto y tips
    currentRecipePhoto = null;
    currentRecipeTips = '';
    const tipsInput = document.getElementById('recipe-tips-input');
    if (tipsInput) tipsInput.value = '';
    const photoPreview = document.getElementById('recipe-photo-preview');
    if (photoPreview) photoPreview.innerHTML = '';
    
    document.querySelector('#modal-recipe h3').textContent = "Crear Receta del Módulo";
    document.getElementById('modal-recipe').classList.add('active');
}

function createRecipeInModuleClass(moduleName, className) {
    createRecipeInModule(moduleName);
    
    // Auto-seleccionar la clase recién creada
    setTimeout(() => {
        const select = document.getElementById('recipe-module-class-select');
        if (select) {
            select.value = className;
            currentRecipeModuleClass = className;
        }
    }, 100);
}

function addNewModuleClassDirectly(moduleName) {
    // Usamos el mismo modal bonito de "Nueva Clase" en vez de un prompt feo
    document.getElementById('new-mat-name-input').value = '';
    document.getElementById('new-mat-name-label').textContent = 'Nombre de la clase';
    document.getElementById('new-mat-name-input').placeholder = 'Ej: Clase 1';
    document.querySelector('#modal-new-material-name h3').textContent = '📁 Crear Nueva Clase';
    
    newMaterialNameCallback = function(className) {
        if (!className || !className.trim()) return;

        // Crear una receta temporal vacía para que se cree la clase en el módulo
        const tempId = Date.now().toString();
        recipes.push({
            id: tempId,
            name: "Nueva receta sin título",
            ingredients: [],
            decorations: [],
            totalCost: 0,
            portions: 1,
            recipeFolder: moduleName,
            recipeSource: 'module',
            moduleClass: className.trim(),
            recipePhoto: null,
            recipeTips: ''
        });

        saveRecipesToStorage();
        updateRecipesView();
        showToast('Clase "' + className.trim() + '" creada');

        // Abrir la creación de receta al instante en esa clase
        setTimeout(() => {
            showAddRecipeModal(tempId);
        }, 300);
    };

    document.getElementById('modal-new-material-name').classList.add('active');
}

function editModuleClassName(moduleName, oldClassName) {
    document.getElementById('new-mat-name-input').value = oldClassName;
    document.getElementById('new-mat-name-label').textContent = 'Nuevo nombre de la clase';
    document.getElementById('new-mat-name-input').placeholder = 'Ej: Clase 2';
    document.querySelector('#modal-new-material-name h3').textContent = '✏️ Editar Nombre de Clase';
    
    newMaterialNameCallback = function(newClassName) {
        if (!newClassName || !newClassName.trim()) return;
        const finalNewName = newClassName.trim();
        
        if (finalNewName === oldClassName) {
            return; // No cambió el nombre
        }

        // Cambiar el nombre de la clase en todas las recetas que la tengan
        let updatedCount = 0;
        recipes.forEach(r => {
            if (r.recipeFolder === moduleName && r.moduleClass === oldClassName) {
                r.moduleClass = finalNewName;
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            saveRecipesToStorage();
            updateRecipesView();
            showToast('Nombre actualizado a "' + finalNewName + '" ✅');
        } else {
            showToast('No se encontraron recetas para actualizar', true);
        }
    };

    document.getElementById('modal-new-material-name').classList.add('active');
}

function deleteModuleClass(moduleName, className) {
    const classRecipesCount = recipes.filter(r => 
        r.recipeFolder === moduleName && 
        r.moduleClass === className
    ).length;

    let warningText = `¿Estás seguro de eliminar "${className}"?`;
    if (classRecipesCount > 0) {
        warningText += `\n⚠️ Se eliminarán ${classRecipesCount} receta(s) que están adentro.`;
    }

    showConfirmModal(
        'Eliminar Clase',
        warningText,
        () => {
            recipes = recipes.filter(r => 
                !(r.recipeFolder === moduleName && r.moduleClass === className)
            );
            
            saveRecipesToStorage();
            updateRecipesView();
            showToast(`Clase "${className}" eliminada 🗑️`);
        }
    );
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

function previewClassAsStudent(courseId, classId) {
    const crs = courses.find(c => String(c.id) === String(courseId));
    if (!crs) return;
    const cls = (crs.classes || []).find(c => String(c.id) === String(classId));
    if (!cls) return;

    const mod = modules.find(m => String(m.id) === String(crs.moduleId));
    if (!mod) return;

    const watermarkName = 'Vista Previa • MushuApp';

    // 🔥 USANDO LOS IDs CORRECTOS
    document.getElementById('view-class-title').textContent = sanitizeHTML(cls.name);

    let html = `<div style="margin-bottom:12px; font-size:13px; color:var(--text-muted);">
        📅 ${cls.date || ''} | 📌 ${sanitizeHTML(crs.moduleName || '')}
    </div>`;

    // === 1. FOTOS DE LA CLASE PRIMERO ===
    const classPhotos = cls.photos || cls.fotos || [];
    
    if (classPhotos.length > 0) {
        html += `<div class="class-content-section" style="margin-bottom:16px;">
            <h4 style="margin:0 0 10px 0; font-size:14px;"><i class='bx bx-camera'></i> Fotos de la Clase</h4>
            <div class="class-content-photos" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                ${classPhotos.map(p => `
                    <div class="class-content-photo" style="position:relative; overflow:hidden; border-radius:var(--radius-sm);">
                        <img src="${p}" alt="Foto de clase" class="no-save-img" draggable="false" 
                             oncontextmenu="return false;" 
                             onclick="event.stopPropagation(); openPhotoFullscreen('${p}', '${sanitizeHTML(watermarkName)}')" 
                             style="cursor:pointer; width:100%; height:120px; object-fit:cover; display:block;">
                        <div class="watermark-photo">${sanitizeHTML(watermarkName)}</div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    // === 2. TIPS GENERALES DE LA CLASE ===
    if (cls.tips) {
        html += `<div class="class-content-tips" style="margin-bottom:20px; background:var(--surface-hover); padding:12px; border-radius:var(--radius-sm); border-left:3px solid var(--secondary-color);">
                    <strong style="color:var(--secondary-color); font-size:13px; display:block; margin-bottom:4px;">💡 Tips de la Profe:</strong>
                    ${sanitizeHTML(cls.tips).replace(/\n/g, '<br>')}
                 </div>`;
    }

    // === 3. RECETAS VINCULADAS ===
    const rList = cls.linkedRecipes || (cls.linkedRecipe ? [cls.linkedRecipe] : []);

    if (rList && rList.length > 0) {
        html += `<h4 style="margin:0 0 10px 0; font-size:14px;"><i class='bx bx-receipt'></i> Recetas de la Clase</h4>`;
        
        rList.forEach(r => {
            let recipeId = null;
            // Para el modo profe, buscamos la receta localmente
            let fullR = recipes.find(rr => rr.name === r.name && rr.recipeFolder === mod.name);
            // Si viene directo con el objeto (del JSON/Firebase viejo)
            if (!fullR && typeof r === 'object' && r.id) fullR = r;
            
            if (fullR) recipeId = fullR.id;

            html += `<div style="margin-bottom:16px; border:1px solid var(--border-color); border-radius:var(--radius-md); padding:12px;">
                        <h4 style="margin:0 0 10px 0; color:var(--text-color); font-size:15px;">${sanitizeHTML(r.name || r.nombre || 'Receta')}</h4>`;

            // Foto individual de la receta
            if (r.recipePhoto || r.foto) {
                const fotoR = r.recipePhoto || r.foto;
                html += `<div class="class-content-photo" style="margin-bottom:10px; position:relative; overflow:hidden;">
                    <img src="${fotoR}" alt="Foto de receta" 
                         class="no-save-img" draggable="false"
                         oncontextmenu="return false;"
                         onclick="event.stopPropagation(); openPhotoFullscreen('${fotoR}', '${sanitizeHTML(watermarkName)}')" 
                         style="cursor:pointer; width:100%; border-radius:var(--radius-sm); display:block;">
                    <div class="watermark-photo">${sanitizeHTML(watermarkName)}</div>
                </div>`;
            }

            // Tips de la receta individual
            if (r.recipeTips || r.tips) {
                const tipsR = r.recipeTips || r.tips;
                html += `<div class="class-content-tips" style="margin-bottom:12px; margin-top:8px;">
                            <strong style="color:var(--secondary-color); font-size:13px; display:block; margin-bottom:4px;">💡 Nota de receta:</strong>
                            ${sanitizeHTML(tipsR).replace(/\n/g, '<br>')}
                         </div>`;
            }

            // Botón de ver costo
            if (recipeId) {
                html += `<button class="btn-submit" style="margin-top:0; background:linear-gradient(135deg, var(--secondary-color), var(--secondary-hover));" 
                         onclick="closeModal('modal-view-class-teacher'); openRecipeFromClass('${recipeId}')">
                    <i class='bx bx-book-open'></i> Ver costo de receta
                </button>`;
            } else {
                html += `<div style="background:var(--surface-hover);border-radius:var(--radius-sm);padding:12px;margin-top:8px;">
                    <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${sanitizeHTML(r.name || r.nombre || 'Receta')}</div>
                    <div style="font-size:13px;color:var(--text-muted);">Costo: $${formatCLP(r.totalCost || r.costoTotal || 0)}</div>
                </div>`;
            }

            html += `</div>`;
        });
    } else {
        html += `<div class="empty-state" style="margin-top:12px;">No hay recetas vinculadas a esta clase</div>`;
    }

    // === BOTÓN ASISTENCIA ===
    html += `<div style="display:flex; gap:10px; margin-top:20px;">
        <button class="btn-submit" style="margin-top:0; flex:1;" onclick="closeModal('modal-view-class-teacher'); showAttendanceModal('${courseId}', '${classId}')">
            <i class='bx bx-clipboard'></i> Asistencia
        </button>
    </div>`;

    // 🔥 USANDO LOS IDs CORRECTOS
    document.getElementById('view-class-content').innerHTML = html;
    document.getElementById('modal-view-class').classList.add('active');
}

// === PHOTO FULLSCREEN CON ZOOM ===
let currentZoom = 1;
let initialDistance = null;

function openPhotoFullscreen(src, watermark) {
    const viewer = document.getElementById('photo-fullscreen');
    const img = document.getElementById('photo-fullscreen-img');
    const wm = document.getElementById('photo-fullscreen-watermark');
    
    img.src = src;
    wm.textContent = watermark || '';
    
    // Resetear zoom
    currentZoom = 1;
    img.style.transform = `scale(1)`;
    
    viewer.style.display = 'block';

    // Asegurarse de que el botón atrás de Android cierre la foto en vez de salir de la app
    history.pushState({photoOpen: true}, "photo", "#photo");
}

function closePhotoFullscreen() {
    document.getElementById('photo-fullscreen').style.display = 'none';
    if (history.state && history.state.photoOpen) {
        history.back();
    }
}

// Escuchar botón atrás de Android
window.addEventListener('popstate', function(event) {
    document.getElementById('photo-fullscreen').style.display = 'none';
});

// === LOGICA DE PELLIZCO PARA ZOOM (PINCH TO ZOOM) ===
document.addEventListener('DOMContentLoaded', () => {
    const imgContainer = document.getElementById('photo-zoom-container');
    const img = document.getElementById('photo-fullscreen-img');

    if (imgContainer) {
        // Evitar que el touch normal cierre la foto si estamos haciendo zoom
        imgContainer.addEventListener('click', (e) => {
            if (currentZoom > 1) {
                e.stopPropagation(); // No cierra si tiene zoom
            }
        });

        // Detectar dos dedos (TouchStart)
        imgContainer.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                initialDistance = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
            }
        });

        // Detectar movimiento de los dedos (TouchMove)
        imgContainer.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && initialDistance) {
                e.preventDefault(); // Evitar scroll de la página

                const currentDistance = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );

                // Calcular nuevo zoom basado en qué tanto se separaron los dedos
                let zoomFactor = currentDistance / initialDistance;
                let newZoom = currentZoom * zoomFactor;

                // Limitar el zoom (entre x1 y x4)
                if (newZoom < 1) newZoom = 1;
                if (newZoom > 4) newZoom = 4;

                img.style.transform = `scale(${newZoom})`;
            }
        }, { passive: false });

        // Guardar el zoom actual cuando se levantan los dedos
        imgContainer.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                initialDistance = null;
                // Extraer el valor actual de scale de la propiedad CSS
                const transform = img.style.transform;
                if (transform.includes('scale')) {
                    currentZoom = parseFloat(transform.replace('scale(', '').replace(')', ''));
                }
            }
        });
        
        // Hacer doble tap para zoom rápido
        let lastTap = 0;
        imgContainer.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < 300 && tapLength > 0) {
                // Doble tap detectado
                currentZoom = currentZoom > 1 ? 1 : 2; // Alternar entre normal y x2
                img.style.transform = `scale(${currentZoom})`;
                e.preventDefault();
            }
            lastTap = currentTime;
        });
    }
});

// === ESCALAR RECETAS (MULTIPLICADOR) ===
function formatQty(q) {
    // Redondea a 2 decimales solo si es necesario (para que no salga 2.00)
    return Number.isInteger(q) ? q : parseFloat(q.toFixed(2));
}

function changeRecipeScale(recipeId, scaleStr) {
    const scale = parseFloat(scaleStr);
    const r = recipes.find(x => String(x.id) === String(recipeId));
    if (r) {
        r.scale = scale;
        saveRecipesToStorage();
        updateRecipesView(); // Refresca la vista manteniendo la tarjeta abierta
    }
}

function changeRecipeScaleFromClass(recipeId, scaleStr) {
    const scale = parseFloat(scaleStr);
    const r = recipes.find(x => String(x.id) === String(recipeId));
    if (r) {
        r.scale = scale;
        saveRecipesToStorage();
        openRecipeFromClass(recipeId); // Refresca el modal en vivo
    }
}

function toggleRecipeSection(recipeId, section, isChecked) {
    const r = recipes.find(x => String(x.id) === String(recipeId));
    if (r) {
        if (section === 'deco') r.excludeDecorations = !isChecked;
        if (section === 'extra') r.excludeExtra = !isChecked;
        saveRecipesToStorage();
        updateRecipesView();
    }
}

function toggleRecipeSectionFromClass(recipeId, section, isChecked) {
    const r = recipes.find(x => String(x.id) === String(recipeId));
    if (r) {
        if (section === 'deco') r.excludeDecorations = !isChecked;
        if (section === 'extra') r.excludeExtra = !isChecked;
        saveRecipesToStorage();
        openRecipeFromClass(recipeId); // Refresca el modal en vivo
    }
}

// === ABRIR RECETA DESDE CLASE ===
function findRecipeByName(recipeName) {
    const r = recipes.find(x =>
        x.name.toLowerCase().trim() === recipeName.toLowerCase().trim()
    );
    return r ? r.id : null;
}

function openRecipeFromClass(recipeId) {
    const r = recipes.find(x => String(x.id) === String(recipeId));
    if (!r) {
        showToast('Receta no encontrada', true);
        return;
    }

    const scale = r.scale || 1;
    const includeDeco = !r.excludeDecorations;
    const includeExtra = !r.excludeExtra;

    let ic = 0;
    let rawDc = 0;

    const ingredientsHTML = (r.ingredients || []).map(i => {
        const m = materials.find(x => String(x.id) === String(i.matId));
        let cost = i.cost;
        if (m && !m.pending) {
            cost = calculateIngredientCost(m, i.qty, i.unit);
        }
        cost = cost * scale;
        ic += cost;
        return `
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;">
                <span>${sanitizeHTML(i.name)} (${formatQty(i.qty * scale)} ${i.unit})</span>
                <span style="font-weight:500;">$${formatCLP(cost)}</span>
            </div>
        `;
    }).join('');

    const decorationsHTML = (r.decorations || []).map(d => {
        const m = materials.find(x => String(x.id) === String(d.matId));
        let cost = d.cost;
        if (m && !m.pending) {
            cost = calculateIngredientCost(m, d.qty, d.unit);
        }
        cost = cost * scale;
        rawDc += cost;
        return `
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;">
                <span>${sanitizeHTML(d.name)} (${formatQty(d.qty * scale)} ${d.unit})</span>
                <span style="font-weight:500;">$${formatCLP(cost)}</span>
            </div>
        `;
    }).join('');

    const ec = r.extraCost || 0;
    let rawEc = ec;
    let extraItemsList = [];
    if (r.extraSubcategory) {
        extraItemsList = materials.filter(m => m.category === 'extra' && normalizeText(m.subcategory) === normalizeText(r.extraSubcategory));
        rawEc = extraItemsList.reduce((s, m) => s + m.price, 0);
    }
    rawEc = rawEc * scale;

    const dc = includeDeco ? rawDc : 0;
    const finalEc = includeExtra ? rawEc : 0;

    const totalCost = ic + dc + finalEc;
    const se = Math.floor((totalCost * profitMargin) / 500) * 500;
    const scaledPortions = (r.portions || 1) * scale;

    let html = '';

    html += `<div class="class-content-header">
        <h2>${sanitizeHTML(r.name)}</h2>
        <p>${(r.ingredients || []).length + (r.decorations || []).length} Items${r.extraSubcategory ? ' + Extra' : ''}${scaledPortions > 1 ? ' • ' + formatQty(scaledPortions) + ' porciones' : ''}</p>
    </div>`;

    // Dropdown Multiplicador en Modal
    html += `
    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-color); padding:8px 12px; border-radius:var(--radius-sm); margin-bottom:12px; border:1px solid rgba(0,0,0,0.05);">
        <span style="font-size:13px; font-weight:600;"><i class='bx bx-math'></i> Multiplicar receta:</span>
        <select onchange="changeRecipeScaleFromClass('${r.id}', this.value)" style="width:auto; padding:4px 8px; font-size:13px; min-height:auto; border-color:var(--secondary-color);">
            <option value="0.5" ${scale === 0.5 ? 'selected' : ''}>x0.5 (Mitad)</option>
            <option value="1" ${scale === 1 ? 'selected' : ''}>x1 (Normal)</option>
            <option value="2" ${scale === 2 ? 'selected' : ''}>x2 (Doble)</option>
            <option value="3" ${scale === 3 ? 'selected' : ''}>x3 (Triple)</option>
            <option value="4" ${scale === 4 ? 'selected' : ''}>x4</option>
            <option value="5" ${scale === 5 ? 'selected' : ''}>x5</option>
            <option value="10" ${scale === 10 ? 'selected' : ''}>x10</option>
        </select>
    </div>`;

    if ((r.ingredients || []).length > 0) {
        html += `<div class="class-content-section">
            <div style="background:var(--surface-hover);border-radius:var(--radius-sm);padding:12px;">
                <div style="display:flex; justify-content:space-between; font-weight:600; font-size:14px; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid rgba(0,0,0,0.05);">
                    <span><i class='bx bx-package' style="color:var(--secondary-color);"></i> Ingredientes</span>
                    <span>$${formatCLP(ic)}</span>
                </div>
                ${ingredientsHTML}
            </div>
        </div>`;
    }

    if ((r.decorations || []).length > 0) {
        html += `<div class="class-content-section">
            <div style="background:var(--surface-hover);border-radius:var(--radius-sm);padding:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-weight:600; font-size:14px; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid rgba(0,0,0,0.05);">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class='bx bx-palette' style="color:var(--secondary-color);"></i> Decoración
                        <label class="switch" style="width:28px; height:16px; margin:0;">
                            <input type="checkbox" ${includeDeco ? 'checked' : ''} onchange="toggleRecipeSectionFromClass('${r.id}', 'deco', this.checked)">
                            <span class="slider round" style="border-radius:16px;"></span>
                        </label>
                    </div>
                    <span style="${!includeDeco ? 'text-decoration:line-through; opacity:0.5;' : ''}">$${formatCLP(rawDc)}</span>
                </div>
                ${includeDeco ? decorationsHTML : ''}
            </div>
        </div>`;
    }

    if (r.extraSubcategory && rawEc > 0) {
        html += `<div class="class-content-section">
            <div style="background:var(--surface-hover);border-radius:var(--radius-sm);padding:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-weight:600; font-size:14px; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid rgba(0,0,0,0.05);">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class='bx bx-star' style="color:var(--secondary-color);"></i> Extra
                        <label class="switch" style="width:28px; height:16px; margin:0;">
                            <input type="checkbox" ${includeExtra ? 'checked' : ''} onchange="toggleRecipeSectionFromClass('${r.id}', 'extra', this.checked)">
                            <span class="slider round" style="border-radius:16px;"></span>
                        </label>
                    </div>
                    <span style="${!includeExtra ? 'text-decoration:line-through; opacity:0.5;' : ''}">$${formatCLP(rawEc)}</span>
                </div>
                ${includeExtra ? extraItemsList.map(m => `
                    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;">
                        <span>${sanitizeHTML(m.name)}</span>
                        <span style="font-weight:500;">$${formatCLP(m.price * scale)}</span>
                    </div>
                `).join('') : ''}
            </div>
        </div>`;
    }

    html += `<div class="class-content-section">
        <div style="background:var(--surface-hover);border-radius:var(--radius-sm);padding:12px;">
            <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:700;font-size:16px;">
                <span>COSTO TOTAL</span><span>$${formatCLP(totalCost)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;color:var(--secondary-color);font-weight:600;">
                <span>💰 Venta sugerida (x${profitMargin}):</span><span>$${formatCLP(se)}</span>
            </div>
            ${scaledPortions > 1 ? `
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:var(--text-muted);">
                <span>🍰 Por porción (${formatQty(scaledPortions)}x):</span><span>$${formatCLP(Math.round(se / scaledPortions))} c/u</span>
            </div>` : ''}
        </div>
    </div>`;

    const autoTip = generateRecipeTip(r);
    if (autoTip) {
        html += `<div class="recipe-tip"><strong>💡 Consejo</strong><br>${autoTip}</div>`;
    }

    document.getElementById('view-class-title').textContent = r.name;
    document.getElementById('view-class-content').innerHTML = html;
    document.getElementById('modal-view-class').classList.add('active');
}

function getModuleClasses(moduleName) {
    const moduleRecipes = recipes.filter(r =>
        r.recipeFolder === moduleName &&
        (r.recipeSource === 'module' || r.recipeSource === 'class') &&
        r.moduleClass
    );
    const classes = [...new Set(moduleRecipes.map(r => r.moduleClass))];
    return classes.sort((a, b) => a.localeCompare(b));
}

function updateModuleClassSelect(moduleName) {
    const select = document.getElementById('recipe-module-class-select');
    if (!select) return;

    const classes = getModuleClasses(moduleName);
    select.innerHTML = '<option value="">Sin clase (suelto)</option>' +
        classes.map(c => `<option value="${c}">${c}</option>`).join('');

    if (currentRecipeModuleClass) {
        select.value = currentRecipeModuleClass;
    }
}

function addNewModuleClass() {
    const folderValue = document.getElementById('recipe-folder-input').value;
    if (!folderValue || folderValue === 'Mis Recetas') {
        showToast('Primero selecciona un módulo', true);
        return;
    }

    showNewModuleClassModal();
}

function showNewModuleClassModal() {
    document.getElementById('new-mat-name-input').value = '';
    document.getElementById('new-mat-name-label').textContent = 'Nombre de la clase';
    document.getElementById('new-mat-name-input').placeholder = 'Ej: Clase 1';
    document.querySelector('#modal-new-material-name h3').textContent = '📁 Nueva Clase del Módulo';
    
    newMaterialNameCallback = function(name) {
        const select = document.getElementById('recipe-module-class-select');
        
        // Verificar si ya existe
        const exists = Array.from(select.options).some(o => o.value.toLowerCase() === name.toLowerCase());
        if (exists) {
            select.value = name;
            currentRecipeModuleClass = name;
            showToast('Clase "' + name + '" seleccionada');
            return;
        }

        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
        select.value = name;
        currentRecipeModuleClass = name;
        showToast('"' + name + '" creada');
    };

    document.getElementById('modal-new-material-name').classList.add('active');
}

function onRecipeFolderChange() {
    const folderValue = document.getElementById('recipe-folder-input').value;
    const moduleExtras = document.getElementById('module-recipe-extras');
    const tipsInput = document.getElementById('recipe-tips-input');
    const photoPreview = document.getElementById('recipe-photo-preview');

    if (folderValue && folderValue !== 'Mis Recetas') {
        moduleExtras.style.display = 'block';
        updateModuleClassSelect(folderValue);
    } else {
        moduleExtras.style.display = 'none';
        currentRecipePhoto = null;
        currentRecipeTips = '';
        currentRecipeModuleClass = '';
        if (tipsInput) tipsInput.value = '';
        if (photoPreview) photoPreview.innerHTML = '';
    }
}

// === FOTO Y TIPS DE RECETA ===
function handleRecipePhoto(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxW = 800;
            let w = img.width, h = img.height;
            if (w > maxW) {
                h = Math.round(h * maxW / w);
                w = maxW;
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            currentRecipePhoto = canvas.toDataURL('image/jpeg', 0.7);
            renderRecipePhotoPreview();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function removeRecipePhoto() {
    currentRecipePhoto = null;
    renderRecipePhotoPreview();
}

function renderRecipePhotoPreview() {
    const preview = document.getElementById('recipe-photo-preview');
    if (!currentRecipePhoto) {
        preview.innerHTML = '';
        return;
    }
    preview.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-hover); padding:10px 14px; border-radius:var(--radius-sm); border:1px dashed var(--secondary-color);">
            <div style="display:flex; align-items:center; gap:8px;">
                <i class='bx bxs-image' style="font-size:20px; color:var(--secondary-color);"></i>
                <span style="font-size:14px; font-weight:600;">Foto subida</span>
            </div>
            <div style="display:flex; gap:8px;">
                <button type="button" class="btn-icon" style="width:36px; height:36px;" onclick="event.stopPropagation(); openPhotoFullscreen('${currentRecipePhoto}', 'Vista Previa')" title="Ver Foto">
                    <i class='bx bx-search-alt-2'></i>
                </button>
                <button type="button" class="btn-icon danger" style="width:36px; height:36px;" onclick="removeRecipePhoto()" title="Borrar Foto">
                    <i class='bx bx-trash'></i>
                </button>
            </div>
        </div>
    `;
}

// === COMPARTIR RECETAS ===
function shareRecipe(recipeId) {
    const r = recipes.find(x => String(x.id) === String(recipeId));
    if (!r) return;

    const shareData = {
        version: '4.1',
        type: 'recipe',
        exportDate: new Date().toISOString(),
        sharedBy: studentName || (teacherMode.active ? 'Profesor/a' : 'Anónimo'),
        recipe: {
            name: r.name,
            ingredients: r.ingredients || [],
            decorations: r.decorations || [],
            extraSubcategory: r.extraSubcategory || null,
            extraCost: r.extraCost || 0,
            totalCost: r.totalCost,
            portions: r.portions || 1
        }
    };

    const fileName = r.name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') + '.json';

    const jsonString = JSON.stringify(shareData, null, 2);

    // Si estamos en la APK, usar el puente Android
    if (window.AndroidShare) {
        window.AndroidShare.shareFile(jsonString, fileName);
        return;
    }

    // Si estamos en navegador, intentar Web Share API
    try {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const file = new File([blob], fileName, { type: 'application/json' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({
                title: r.name + ' - MushuApp',
                files: [file]
            }).then(() => {
                showToast('Receta compartida! 📤');
            }).catch((err) => {
                if (err.name !== 'AbortError') {
                    downloadRecipeFile(jsonString, fileName, r.name);
                }
            });
            return;
        }
    } catch(e) {
        // No soportado
    }

    // Fallback: descargar archivo
    downloadRecipeFile(jsonString, fileName, r.name);
}

function downloadRecipeFile(jsonString, fileName, recipeName) {
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('"' + recipeName + '" descargada! 📥');
}

function importRecipeFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);

            if (!data.type || data.type !== 'recipe' || !data.recipe) {
                showToast('Archivo no es una receta válida', true);
                return;
            }

            const recipe = data.recipe;

            const existing = recipes.find(r => 
                r.name.toLowerCase() === recipe.name.toLowerCase() && 
                (r.recipeFolder || 'Mis Recetas') === 'Mis Recetas'
            );
            if (existing) {
                showToast('Ya tienes una receta con ese nombre', true);
                return;
            }

            const allIngredients = [...(recipe.ingredients || []), ...(recipe.decorations || [])];
            const missingMats = [];

            allIngredients.forEach(item => {
                const found = materials.find(m => 
                    m.name.toLowerCase().trim() === item.name.toLowerCase().trim()
                );
                if (!found && !missingMats.find(mm => mm.name.toLowerCase() === item.name.toLowerCase())) {
                    const isDeco = (recipe.decorations || []).some(d => 
                        d.name.toLowerCase().trim() === item.name.toLowerCase().trim()
                    );
                    missingMats.push({
                        name: item.name,
                        category: isDeco ? 'decoracion' : 'productos'
                    });
                }
            });

            recipe.ingredients = (recipe.ingredients || []).map(i => {
                const found = materials.find(m => 
                    m.name.toLowerCase().trim() === i.name.toLowerCase().trim()
                );
                if (found) {
                    return {
                        ...i,
                        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                        matId: String(found.id),
                        cost: found.pending ? 0 : calculateIngredientCost(found, i.qty, i.unit),
                        pending: found.pending || false
                    };
                }
                return { 
                    ...i, 
                    id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5), 
                    pending: true, 
                    cost: 0 
                };
            });

            recipe.decorations = (recipe.decorations || []).map(d => {
                const found = materials.find(m => 
                    m.name.toLowerCase().trim() === d.name.toLowerCase().trim()
                );
                if (found) {
                    return {
                        ...d,
                        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                        matId: String(found.id),
                        cost: found.pending ? 0 : calculateIngredientCost(found, d.qty, d.unit),
                        pending: found.pending || false
                    };
                }
                return { 
                    ...d, 
                    id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5), 
                    pending: true, 
                    cost: 0 
                };
            });

            if (missingMats.length > 0) {
                missingMats.forEach(mm => {
                    const pendingMat = createPendingMaterial(mm.name, mm.category);
                    
                    recipe.ingredients.forEach(i => {
                        if (i.name.toLowerCase().trim() === mm.name.toLowerCase().trim()) {
                            i.matId = String(pendingMat.id);
                        }
                    });
                    recipe.decorations.forEach(d => {
                        if (d.name.toLowerCase().trim() === mm.name.toLowerCase().trim()) {
                            d.matId = String(pendingMat.id);
                        }
                    });
                });
            }

            const ic = recipe.ingredients.reduce((s, i) => s + (i.cost || 0), 0);
            const dc = recipe.decorations.reduce((s, d) => s + (d.cost || 0), 0);
            const ec = recipe.extraCost || 0;

            const newRecipe = {
                id: Date.now().toString(),
                name: recipe.name,
                ingredients: recipe.ingredients,
                decorations: recipe.decorations,
                extraSubcategory: recipe.extraSubcategory || null,
                extraCost: ec,
                totalCost: ic + dc + ec,
                portions: recipe.portions || 1,
                recipeFolder: 'Mis Recetas',
                recipeSource: 'personal',
                sharedBy: data.sharedBy || null
            };

            recipes.push(newRecipe);
            saveRecipesToStorage();
            renderMaterials();
            updateMaterialSelect();
            updateDecorationSelect();
            updateRecipesView();

            if (missingMats.length > 0) {
                showToast(`"${recipe.name}" cargada! ⚠️ ${missingMats.length} material${missingMats.length > 1 ? 'es' : ''} pendiente${missingMats.length > 1 ? 's' : ''}`);
            } else {
                showToast(`"${recipe.name}" cargada! ✅`);
            }

        } catch(err) {
            console.error(err);
            showToast('Error al leer el archivo', true);
        }
    };

    reader.readAsText(file);
    event.target.value = '';
}

// === LOGIN ALUMNO ===
async function loginStudentFromScratch() {
    const inputName = document.getElementById('student-login-name-input').value.trim();
    const inputPrefix = document.getElementById('student-login-prefix-input').value.trim().toUpperCase();

    if (!inputName || !inputPrefix) {
        showToast('Completa ambos campos', true);
        return;
    }

    showToast('⏳ Verificando tus datos...', false);

    // 🔥 BUSCAR EN FIREBASE - En TODOS los cursos del módulo
    try {
        console.log('🔍 Buscando', inputName, 'en módulo', inputPrefix, 'en Firebase...');
        
        // Buscar en alumnas/{modulo}/ (todos los cursos)
        const alumnasModuloRef = firebaseDB.ref(`alumnas/${inputPrefix}`);
        const alumnasSnap = await alumnasModuloRef.once('value');
        
        if (alumnasSnap.exists()) {
            let foundStudent = null;
            let foundCursoId = null;
            
            // Recorrer todos los cursos del módulo
            alumnasSnap.forEach(cursoSnap => {
                const cursoId = cursoSnap.key;
                
                // Recorrer todas las alumnas del curso
                cursoSnap.forEach(alumnaSnap => {
                    const alumna = alumnaSnap.val();
                    
                    if (normalizeText(alumna.nombre) === normalizeText(inputName)) {
                        foundStudent = {
                            name: alumna.nombre,
                            id: alumna.id,
                            studentCode: alumnaSnap.key,
                            cursoId: alumna.cursoId,
                            cursoNombre: alumna.cursoNombre
                        };
                        foundCursoId = cursoId;
                    }
                });
            });
            
            if (foundStudent) {
                console.log('✅ Alumna encontrada en Firebase:', foundStudent.name, '| Curso:', foundStudent.cursoNombre);
                
                const newProfile = {
                    name: foundStudent.name,
                    id: foundStudent.id,
                    code: foundStudent.studentCode,
                    courseId: foundStudent.cursoId,
                    courseName: foundStudent.cursoNombre,
                    moduleId: inputPrefix,
                    modulePrefix: inputPrefix,
                    totalClassesInModule: 0
                };
                
                studentProfiles.push(newProfile);
                localStorage.setItem('mushu_student_profiles', JSON.stringify(studentProfiles));
                studentName = foundStudent.name;
                
                // Actualizar última conexión
                const alumnaRef = firebaseDB.ref(`alumnas/${inputPrefix}/${foundCursoId}/${foundStudent.studentCode}`);
                alumnaRef.update({
                    ultimaConexion: new Date().toISOString()
                }).catch(err => console.log('Error actualizando conexión:', err));
                
                updateClassesView();
                showToast('¡Hola ' + foundStudent.name + '! 👋');
                return;
            } else {
                console.log('❌ Alumna no encontrada en Firebase');
            }
        } else {
            console.log('⚠️ Módulo no encontrado en Firebase');
        }
        
    } catch (firebaseError) {
        console.log('⚠️ Firebase no disponible:', firebaseError.message);
    }

    // 🔄 FALLBACK: Buscar en JSON local
    const fileName = inputPrefix.toLowerCase() + '-module.json';
    const url = 'https://tibustyle.github.io/MushuApp/modules/' + fileName + '?v=' + Date.now();

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('No encontrado');
            return response.json();
        })
        .then(data => {
            if (!data.courses || data.courses.length === 0) {
                showToast('Módulo sin cursos activos', true);
                return;
            }

            let foundStudent = null;
            let foundCourse = null;

            for (const course of data.courses) {
                const student = (course.students || []).find(s => 
                    normalizeText(s.name) === normalizeText(inputName)
                );
                if (student) {
                    foundStudent = student;
                    foundCourse = course;
                    break;
                }
            }

            if (!foundStudent) {
                showToast('Nombre no encontrado. Contacta a tu profesor/a.', true);
                return;
            }

            const newProfile = {
                name: foundStudent.name,
                id: foundStudent.id,
                code: foundStudent.studentCode,
                courseId: foundCourse.id,
                courseName: foundCourse.name,
                moduleId: data.module.id,
                modulePrefix: data.module.prefix,
                totalClassesInModule: 0
            };

            studentProfiles.push(newProfile);
            localStorage.setItem('mushu_student_profiles', JSON.stringify(studentProfiles));
            studentName = foundStudent.name;

            updateClassesView();
            showToast('¡Hola ' + foundStudent.name + '! 👋');
        })
        .catch(err => {
            showToast('Nombre no encontrado. Contacta a tu profesor/a.', true);
        });
}

// TEMPORAL: Comentada porque estaba duplicada con línea 2433
/*
function showAddModuleModal() {
    document.getElementById('student-modal-login-prefix').value = '';
    document.getElementById('modal-add-module-student-name').textContent = studentName;
    document.getElementById('modal-student-add-module').classList.add('active');
}
*/

function addModuleForExistingStudent() {
    const inputPrefix = document.getElementById('student-modal-login-prefix').value.trim().toUpperCase();

    if (!inputPrefix) {
        showToast('Ingresa un prefijo', true);
        return;
    }

    // Verificar si ya lo tiene
    const exists = studentProfiles.find(p => p.modulePrefix.toUpperCase() === inputPrefix);
    if (exists) {
        showToast('Ya estás en este módulo', true);
        return;
    }

    const fileName = inputPrefix.toLowerCase() + '-module.json';
    const url = 'https://tibustyle.github.io/MushuApp/modules/' + fileName + '?v=' + Date.now();

    showToast('⏳ Buscando en ' + inputPrefix + '...', false);

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('No encontrado');
            return response.json();
        })
        .then(data => {
            if (!data.courses || data.courses.length === 0) {
                showToast('Módulo sin cursos activos', true);
                return;
            }

            let foundStudent = null;
            let foundCourse = null;

            // Buscar por el nombre global (studentName)
            for (const course of data.courses) {
                const student = (course.students || []).find(s => 
                    normalizeText(s.name) === normalizeText(studentName)
                );
                if (student) {
                    foundStudent = student;
                    foundCourse = course;
                    break;
                }
            }

            if (!foundStudent) {
                showToast('No te encontramos en ' + inputPrefix + '. Contacta a tu profesor/a.', true);
                return;
            }

            const totalClasses = (data.classes || []).filter(cl => cl.courseId === foundCourse.id).length;

            const newProfile = {
                name: foundStudent.name,
                id: foundStudent.id,
                code: foundStudent.studentCode,
                courseId: foundCourse.id,
                courseName: foundCourse.name,
                moduleId: data.module.id,
                modulePrefix: data.module.prefix,
                totalClassesInModule: totalClasses
            };

            studentProfiles.push(newProfile);
            localStorage.setItem('mushu_student_profiles', JSON.stringify(studentProfiles));
            
            closeModal('modal-student-add-module');
            updateClassesView();
            showToast('¡Módulo ' + inputPrefix + ' agregado! ✅');
        })
        .catch(err => {
            showToast('No se encontró el módulo "' + inputPrefix + '"', true);
        });
}

function logoutStudent() {
    showConfirmModal('Cerrar sesión', '¿Seguro? Tendrás que identificarte de nuevo.', () => {
        studentProfile = null;
        localStorage.removeItem('mushu_student_profile');
        updateClassesView();
    });
}

// === CARGAR MÓDULO EN CLASES ===
let loadModuleData = null;
let loadModuleSelectedCourses = [];

function showLoadModuleClassesModal() {
    document.getElementById('load-module-prefix-input').value = '';
    document.getElementById('load-module-status').style.display = 'none';
    document.getElementById('load-module-step1').style.display = 'block';
    document.getElementById('load-module-step2').style.display = 'none';
    loadModuleData = null;
    loadModuleSelectedCourses = [];
    document.getElementById('modal-load-module-classes').classList.add('active');
}

function goBackToStep1() {
    document.getElementById('load-module-step1').style.display = 'block';
    document.getElementById('load-module-step2').style.display = 'none';
}

function showLoadModuleStatus(text) {
    const statusDiv = document.getElementById('load-module-status');
    const statusText = document.getElementById('load-module-status-text');
    statusDiv.style.display = 'block';
    statusText.textContent = text;
}

function searchModuleInGitHub() {
    const prefix = document.getElementById('load-module-prefix-input').value.trim().toUpperCase();
    if (!prefix || prefix.length < 2) {
        showToast('Ingresa un prefijo válido', true);
        return;
    }

    const fileName = prefix.toLowerCase() + '-module.json';
    const url = 'https://tibustyle.github.io/MushuApp/modules/' + fileName + '?v=' + Date.now();

    showLoadModuleStatus('⏳ Buscando módulo ' + prefix + '...');

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('No encontrado');
            }
            return response.json();
        })
        .then(data => {
            if (!data.type || data.type !== 'module' || !data.module) {
                showLoadModuleStatus('❌ El archivo no es un módulo válido');
                showToast('Archivo no válido', true);
                return;
            }

            loadModuleData = data;
            loadModuleSelectedCourses = [];

            document.getElementById('load-module-found-name').textContent = data.module.name;
            document.getElementById('load-module-found-prefix').textContent = 'Prefijo: ' + data.module.prefix;

            renderLoadModuleCourses();

            document.getElementById('load-module-step1').style.display = 'none';
            document.getElementById('load-module-step2').style.display = 'block';
        })
        .catch(err => {
            console.error(err);
            showLoadModuleStatus('❌ No se encontró el módulo "' + prefix + '". ¿Ya lo subieron a GitHub?');
            showToast('No se encontró el módulo', true);
        });
}

function renderLoadModuleCourses() {
    const list = document.getElementById('load-module-courses-list');

    if (!loadModuleData.courses || loadModuleData.courses.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding:20px;font-size:13px;">No hay cursos en este módulo.</div>';
        return;
    }

    list.innerHTML = loadModuleData.courses.map(c => {
        const studentCount = (c.students || []).length;
        const classCount = (loadModuleData.classes || []).filter(cl => cl.courseId === c.id).length;
        const isSelected = loadModuleSelectedCourses.includes(c.id);
        const studentNames = (c.students || []).map(s => s.name).join(', ');

        const alreadyExists = courses.find(existing =>
            existing.name === c.name &&
            existing.moduleName === loadModuleData.module.name
        );

        const existsBadge = alreadyExists
            ? '<span style="font-size:11px;color:var(--warning-color);font-weight:600;">⚠️ Ya existe</span>'
            : '';

        return `
            <div class="load-course-item ${isSelected ? 'selected' : ''}" 
                 onclick="toggleLoadModuleCourse('${c.id}')">
                <div class="load-course-checkbox">
                    ${isSelected ? '<i class="bx bx-check" style="font-size:16px;"></i>' : ''}
                </div>
                <div class="load-course-info">
                    <h4>${sanitizeHTML(c.name)} ${existsBadge}</h4>
                    <p>📅 ${c.day || 'Sin día'} ${c.schedule ? '• ' + c.schedule : ''}</p>
                    <p>👥 ${studentCount} alumno${studentCount !== 1 ? 's' : ''}: ${sanitizeHTML(studentNames || 'Sin alumnos')}</p>
                    <p>📖 ${classCount} clase${classCount !== 1 ? 's' : ''}</p>
                </div>
            </div>
        `;
    }).join('');
}

function toggleLoadModuleCourse(courseId) {
    const idx = loadModuleSelectedCourses.indexOf(courseId);
    if (idx === -1) {
        loadModuleSelectedCourses.push(courseId);
    } else {
        loadModuleSelectedCourses.splice(idx, 1);
    }
    renderLoadModuleCourses();
}

function importSelectedCourses() {
    if (!loadModuleData) return;

    if (loadModuleSelectedCourses.length === 0) {
        showToast('Selecciona al menos un curso', true);
        return;
    }

    const data = loadModuleData;

    let mod = modules.find(m =>
        m.prefix.toUpperCase() === data.module.prefix.toUpperCase()
    );

    if (!mod) {
        mod = {
            id: Date.now().toString(),
            name: data.module.name,
            prefix: data.module.prefix
        };
        modules.push(mod);
        saveModules();
    }

    const existingModuleRecipes = recipes.filter(r =>
        r.recipeFolder === data.module.name &&
        (r.recipeSource === 'module' || r.recipeSource === 'class')
    );

    const allMissing = [];

    if (existingModuleRecipes.length === 0 && data.recipes && data.recipes.length > 0) {
        data.recipes.forEach(r => {
            const allItems = [...(r.ingredients || []), ...(r.decorations || [])];
            allItems.forEach(item => {
                const found = materials.find(m =>
                    m.name.toLowerCase().trim() === item.name.toLowerCase().trim()
                );
                if (!found && !allMissing.find(mm => mm.name.toLowerCase() === item.name.toLowerCase())) {
                    const isDeco = (r.decorations || []).some(d =>
                        d.name.toLowerCase().trim() === item.name.toLowerCase().trim()
                    );
                    allMissing.push({
                        name: item.name,
                        category: isDeco ? 'decoracion' : 'productos'
                    });
                }
            });
        });

        allMissing.forEach(mm => {
            createPendingMaterial(mm.name, mm.category);
        });

        data.recipes.forEach(r => {
            r.ingredients = (r.ingredients || []).map(i => {
                const found = materials.find(m =>
                    m.name.toLowerCase().trim() === i.name.toLowerCase().trim()
                );
                return {
                    ...i,
                    id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                    matId: found ? String(found.id) : '',
                    cost: (found && !found.pending) ? calculateIngredientCost(found, i.qty, i.unit) : 0,
                    pending: found ? (found.pending || false) : true
                };
            });

            r.decorations = (r.decorations || []).map(d => {
                const found = materials.find(m =>
                    m.name.toLowerCase().trim() === d.name.toLowerCase().trim()
                );
                return {
                    ...d,
                    id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                    matId: found ? String(found.id) : '',
                    cost: (found && !found.pending) ? calculateIngredientCost(found, d.qty, d.unit) : 0,
                    pending: found ? (found.pending || false) : true
                };
            });

            const ic = r.ingredients.reduce((s, i) => s + (i.cost || 0), 0);
            const dc = r.decorations.reduce((s, d) => s + (d.cost || 0), 0);
            const ec = r.extraCost || 0;

            recipes.push({
                id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                name: r.name,
                ingredients: r.ingredients,
                decorations: r.decorations,
                extraSubcategory: r.extraSubcategory || null,
                extraCost: ec,
                totalCost: ic + dc + ec,
                portions: r.portions || 1,
                recipeFolder: data.module.name,
                recipeSource: 'module',
                recipePhoto: r.recipePhoto || null,
                recipeTips: r.recipeTips || '',
                moduleClass: r.moduleClass || ''
            });
        });

        saveRecipesToStorage();
    }

    let coursesAdded = 0;
    let classesAdded = 0;

    loadModuleSelectedCourses.forEach(courseId => {
        const courseData = data.courses.find(c => c.id === courseId);
        if (!courseData) return;

        const existingCourse = courses.find(c =>
            c.name === courseData.name &&
            String(c.moduleId) === String(mod.id)
        );

        if (existingCourse) return;

        const newCourse = {
            id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
            name: courseData.name,
            moduleId: mod.id,
            moduleName: data.module.name,
            day: courseData.day || 'Lunes',
            schedule: courseData.schedule || '',
            students: (courseData.students || []).map(s => ({
                id: s.id || Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                name: s.name,
                studentCode: s.studentCode || '00'
            })),
            classes: []
        };

        (data.classes || []).forEach(cls => {
            if (cls.courseId === courseData.id) {
                newCourse.classes.push({
                    id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
                    name: cls.className,
                    date: cls.date,
                    tips: cls.tips || '',
                    photos: cls.photos || [],
                    linkedRecipe: cls.linkedRecipe || null,
                    linkedRecipe: cls.linkedRecipe || null,
                    linkedRecipes: cls.linkedRecipes || [],
                    linkedRecipeId: cls.linkedRecipe ? cls.linkedRecipe.id : null,
                    blockCode: cls.blockCode || generateClassBlockCode(),
                    codeExpiry: cls.codeExpiry || 0,
                    attendance: (cls.attendance || []).map(a => ({
                        studentId: a.studentId,
                        studentName: a.studentName,
                        studentCode: a.studentCode || '00',
                        present: a.present || false,
                        code: null,
                        shortCode: a.shortCode || '',
                        codeData: null,
                        codeUsed: false,
                        activatedAt: null
                    })),
                    codesGenerated: false
                });
                classesAdded++;
            }
        });

        courses.push(newCourse);
        coursesAdded++;
    });

    saveCourses();
    saveMaterialsToStorage();
    renderMaterials();
    updateMaterialSelect();
    updateDecorationSelect();
    updateRecipesView();
    renderCourses();
    updateClassesView();

    closeModal('modal-load-module-classes');

    if (allMissing.length > 0) {
        showSyncMissingModal(allMissing);
    }

    showToast('Importado: ' + coursesAdded + ' curso' + (coursesAdded !== 1 ? 's' : '') + ', ' + classesAdded + ' clase' + (classesAdded !== 1 ? 's' : '') + ' ✅');
}

// === SINCRONIZAR MÓDULO ===
let currentSyncModuleId = null;

function showSyncModuleModal(moduleId) {
    const mod = modules.find(m => String(m.id) === String(moduleId));
    if (!mod) return;

    currentSyncModuleId = moduleId;
    document.getElementById('sync-module-name').textContent = mod.name;
    document.getElementById('sync-module-prefix').textContent = 'Prefijo: ' + mod.prefix;
    document.getElementById('sync-status').style.display = 'none';
    document.getElementById('modal-sync-module').classList.add('active');
}

function showSyncStatus(text) {
    const statusDiv = document.getElementById('sync-status');
    const statusText = document.getElementById('sync-status-text');
    statusDiv.style.display = 'block';
    statusText.textContent = text;
}

function showSyncMissingModal(missingList) {
    const list = document.getElementById('sync-missing-list');
    list.innerHTML = missingList.map((m, i) => {
        const catLabel = m.category === 'decoracion' ? 'Decoración' : (m.category === 'extra' ? 'Extra' : 'Producto');
        
        return `
        <div class="missing-material-item">
            <h4><i class='bx bx-error-circle'></i> ${catLabel}: ${sanitizeHTML(m.name)}</h4>
            <div class="form-row">
                <div class="form-group">
                    <label>Precio (CLP)</label>
                    <input type="number" id="sync-missing-price-${i}" placeholder="990" min="0">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Cantidad Base</label>
                    <input type="number" id="sync-missing-qty-${i}" placeholder="1" min="0.01" step="0.01">
                </div>
                <div class="form-group">
                    <label>Unidad</label>
                    <select id="sync-missing-unit-${i}">
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="l">L</option>
                        <option value="cm3">mL</option>
                        <option value="u">u</option>
                    </select>
                </div>
            </div>
            <input type="hidden" id="sync-missing-name-${i}" value="${m.name}">
            <input type="hidden" id="sync-missing-category-${i}" value="${m.category}">
        </div>
        `;
    }).join('');

    document.getElementById('modal-sync-missing').classList.add('active');
}

// === SINCRONIZAR MÓDULO ===
function showGlobalSyncModal() {
    const select = document.getElementById('global-sync-module-select');
    
    // Llenar el select con los módulos disponibles (si los hay)
    if (modules.length > 0) {
        select.innerHTML = modules.map(m => 
            `<option value="${m.id}">${m.name} (${m.prefix})</option>`
        ).join('');
        select.disabled = false;
    } else {
        // Si no hay módulos, mostrar opción vacía para que igual puedan "Cargar"
        select.innerHTML = `<option value="">No hay módulos locales (Puedes Cargar)</option>`;
        select.disabled = true;
    }
    
    document.getElementById('sync-status').style.display = 'none';
    document.getElementById('modal-sync-module').classList.add('active');
}

function saveSyncMissingMaterials() {
    const items = document.querySelectorAll('[id^="sync-missing-name-"]');
    let updated = 0;

    for (let i = 0; i < items.length; i++) {
        const name = document.getElementById('sync-missing-name-' + i).value.trim();
        const category = document.getElementById('sync-missing-category-' + i).value;
        const price = parseFloat(document.getElementById('sync-missing-price-' + i).value);
        const qty = parseFloat(document.getElementById('sync-missing-qty-' + i).value);
        const unit = document.getElementById('sync-missing-unit-' + i).value;

        if (!isNaN(price) && !isNaN(qty) && qty > 0 && price >= 0) {
            const mat = materials.find(m =>
                normalizeText(m.name) === normalizeText(name) && m.category === category
            );
            if (mat) {
                mat.price = price;
                mat.qty = qty;
                mat.unit = unit;
                mat.pending = false;
                
                if (category === 'extra') {
                    mat.subcategory = name;
                }
                mat.priceHistory = [{ date: new Date().toISOString().slice(0, 10), price: price }];
                updated++;

                // Reasignar matId en todas las recetas que usen este material y recalcular
                recipes.forEach(r => {
                    let recetaCambiada = false;

                    (r.ingredients || []).forEach(ing => {
                        if (normalizeText(ing.name) === normalizeText(name)) {
                            ing.matId = String(mat.id);
                            ing.pending = false;
                            ing.cost = calculateIngredientCost(mat, ing.qty, ing.unit);
                            recetaCambiada = true;
                        }
                    });

                    (r.decorations || []).forEach(d => {
                        if (normalizeText(d.name) === normalizeText(name)) {
                            d.matId = String(mat.id);
                            d.pending = false;
                            d.cost = calculateIngredientCost(mat, d.qty, d.unit);
                            recetaCambiada = true;
                        }
                    });

                    if (r.extraSubcategory && normalizeText(r.extraSubcategory) === normalizeText(name)) {
                        const extraItems = materials.filter(m => m.category === 'extra' && normalizeText(m.subcategory) === normalizeText(name));
                        r.extraCost = extraItems.reduce((s, m) => s + m.price, 0);
                        recetaCambiada = true;
                    }

                    // ¡AQUÍ ESTABA EL ERROR! Faltaba guardar el total de la receta
                    if (recetaCambiada) {
                        const icCost = (r.ingredients || []).reduce((s, i) => s + (i.cost || 0), 0);
                        const dcCost = (r.decorations || []).reduce((s, d) => s + (d.cost || 0), 0);
                        r.totalCost = icCost + dcCost + (r.extraCost || 0);
                    }
                });
            }
        }
    }

    saveMaterialsToStorage();
    saveRecipesToStorage();
    recalculateAllRecipes();
    renderMaterials();
    updateMaterialSelect();
    updateDecorationSelect();
    updateExtraSubcategorySelect();
    updateRecipesView();

    closeModal('modal-sync-missing');

    if (updated > 0) {
        showToast(updated + ' material' + (updated > 1 ? 'es' : '') + ' actualizado' + (updated > 1 ? 's' : '') + '! ✅');
    } else {
        showToast('Materiales dejados como pendientes');
    }
}

async function syncModuleUpload() {
    const selectedId = document.getElementById('global-sync-module-select').value;
    if (!selectedId) {
        showToast('Selecciona un módulo para subir', true);
        return;
    }
    
    const mod = modules.find(m => String(m.id) === String(selectedId));
    if (!mod) return;

    closeModal('modal-sync-module');
    showToast(`⏳ Subiendo ${mod.name} a la nube...`, false);

    try {
        // 1. Juntar recetas del módulo
        const moduleRecipes = recipes.filter(r =>
            (r.recipeFolder || '') === mod.name &&
            (r.recipeSource === 'module' || r.recipeSource === 'class')
        );

        // 2. Juntar cursos del módulo
        const moduleCourses = courses.filter(c =>
            String(c.moduleId) === String(mod.id) || c.moduleName === mod.name
        );

        // 3. Estructurar para Firebase
        const firebaseData = {
            metadata: {
                codigo: mod.prefix,
                nombre: mod.name,
                activo: true,
                ultimaActualizacion: new Date().toISOString()
            },
            clases: {},
            recetas: {},
            cursos: {}
        };

        // Crear un mapa temporal de clases con sus FOTOS y TIPS
        const clasesDesdeCursos = {};
        
        moduleCourses.forEach(curso => {
            firebaseData.cursos[curso.id] = {
                id: curso.id,
                nombre: curso.name,
                dia: curso.day || '',
                horario: curso.schedule || '',
                moduloId: curso.moduleId,
                moduloNombre: curso.moduleName,
                estudiantes: (curso.students || []).map(s => ({
                    id: s.id, nombre: s.name, codigo: s.studentCode
                }))
            };

            // Extraer las fotos y tips de cada clase del curso
            (curso.classes || []).forEach(cls => {
                let cNum = 1;
                const match = (cls.name || '').match(/\d+/);
                if (match) {
                    cNum = parseInt(match[0]);
                } else if (cls.moduleClassName) {
                    const match2 = cls.moduleClassName.match(/\d+/);
                    if (match2) cNum = parseInt(match2[0]);
                }

                if (!clasesDesdeCursos[cNum]) {
                    clasesDesdeCursos[cNum] = {
                        nombre: cls.name || `Clase ${cNum}`,
                        tips: cls.tips || '',
                        fotos: cls.photos || []
                    };
                } else {
                    // Si ya existe, nos aseguramos de no perder fotos
                    if (cls.photos && cls.photos.length > 0) {
                        clasesDesdeCursos[cNum].fotos = cls.photos;
                    }
                    if (cls.tips) {
                        clasesDesdeCursos[cNum].tips = cls.tips;
                    }
                }
            });
        });

        // Asegurar que las clases existan en Firebase aunque no tengan recetas aún
        Object.keys(clasesDesdeCursos).forEach(cNum => {
            firebaseData.clases[cNum] = {
                numero: parseInt(cNum),
                nombre: clasesDesdeCursos[cNum].nombre,
                activa: true,
                tips: clasesDesdeCursos[cNum].tips || '',
                fotos: clasesDesdeCursos[cNum].fotos || [],
                recetas: {}
            };
        });

        // Agrupar recetas por clase
        moduleRecipes.forEach((receta, index) => {
            let claseNum = 1;
            if (receta.moduleClass) {
                const match = receta.moduleClass.match(/\d+/);
                claseNum = match ? parseInt(match[0]) : 1;
            }

            if (!firebaseData.clases[claseNum]) {
                firebaseData.clases[claseNum] = {
                    numero: claseNum,
                    nombre: `Clase ${claseNum}`,
                    activa: true,
                    tips: '',
                    fotos: [],
                    recetas: {}
                };
            }

            const recetaId = receta.id || `receta_${Date.now()}_${index}`;
            
            const recetaEstructurada = {
                id: recetaId,
                nombre: receta.name,
                rendimiento: receta.yield || '',
                tiempoPrep: receta.prepTime || '',
                ingredientes: receta.ingredients || [],
                decoraciones: receta.decorations || [],
                instrucciones: receta.instructions || '',
                notas: receta.notes || '',
                foto: receta.recipePhoto || null,
                tips: receta.recipeTips || '',
                costoExtra: receta.extraCost || 0,
                costoTotal: receta.totalCost || 0,
                porciones: receta.portions || 1
            };

            firebaseData.clases[claseNum].recetas[recetaId] = recetaEstructurada;
            firebaseData.recetas[recetaId] = recetaEstructurada;
        });

        // 4. Subir a Firebase
        await firebaseDB.ref(`modulos/${mod.prefix}`).update({
            metadata: firebaseData.metadata,
            clases: firebaseData.clases,
            recetas: firebaseData.recetas,
            cursos: firebaseData.cursos
        });
        
        console.log(`✅ Módulo ${mod.prefix} subido a Firebase con fotos y tips.`);
        showToast(`✅ ¡Módulo ${mod.prefix} subido a la nube correctamente!`);

    } catch (error) {
        console.error('❌ Error subiendo a Firebase:', error);
        showToast('❌ Error al subir a la nube. Revisa tu conexión.', true);
    }
}

function syncModuleDownload() {
    // Cerrar el modal principal de sincronización primero
    closeModal('modal-sync-module');
    
    // Verificar que sea profesora
    if (!teacherMode.active) {
        showToast('Solo la profesora puede sincronizar módulos', true);
        return;
    }
    
    // Abrir el modal para pedir el prefijo
    document.getElementById('sync-load-prefix-input').value = '';
    document.getElementById('modal-enter-prefix-load').classList.add('active');
}

async function confirmSyncModuleDownload() {
    const prefixInput = document.getElementById('sync-load-prefix-input').value;
    if (!prefixInput || !prefixInput.trim()) {
        showToast('Por favor, ingresa un prefijo', true);
        return;
    }
    
    closeModal('modal-enter-prefix-load');
    const cleanPrefix = prefixInput.trim().toUpperCase();
    showToast('⏳ Cargando módulo ' + cleanPrefix + ' desde Firebase...', false);
    
    try {
        const moduloRef = firebaseDB.ref(`modulos/${cleanPrefix}`);
        const moduloSnap = await moduloRef.once('value');
        
        if (!moduloSnap.exists()) {
            showToast('❌ Módulo ' + cleanPrefix + ' no encontrado en Firebase', true);
            return;
        }
        
        const data = moduloSnap.val();
        if (!data.metadata || !data.clases) {
            showToast('❌ El módulo tiene una estructura inválida', true);
            return;
        }
        
        // 1. Crear o actualizar módulo local
        let modIdx = modules.findIndex(m => m.prefix.toUpperCase() === cleanPrefix);
        let currentModId;
        if (modIdx >= 0) {
            currentModId = modules[modIdx].id;
            modules[modIdx].name = data.metadata.nombre;
        } else {
            currentModId = Date.now().toString();
            modules.push({
                id: currentModId,
                name: data.metadata.nombre,
                prefix: cleanPrefix
            });
        }
        
        // ==========================================
        // 2. REVISAR MATERIALES FALTANTES (CON NORMALIZACIÓN MEJORADA)
        // ==========================================
        const allMissing = [];
        
        for (const claseData of Object.values(data.clases || {})) {
            for (const receta of Object.values(claseData.recetas || {})) {
                // Soportar ambos formatos (inglés/español)
                const ingredientes = receta.ingredientes || receta.ingredients || [];
                const decoraciones = receta.decoraciones || receta.decorations || [];
                const allItems = [...ingredientes, ...decoraciones];
                
                allItems.forEach(item => {
                    const itemName = item.nombre || item.name || '';
                    if (!itemName.trim()) return; // Ignorar vacíos
                    
                    const normName = normalizeText(itemName);
                    
                    // Buscar en inventario local usando texto normalizado
                    const found = materials.find(m => normalizeText(m.name) === normName);
                    
                    // Si no existe localmente Y no lo hemos agregado ya a la lista de faltantes
                    if (!found && !allMissing.find(mm => normalizeText(mm.name) === normName)) {
                        
                        // Determinar si es decoración
                        const isDeco = decoraciones.some(d => normalizeText(d.nombre || d.name || '') === normName);
                        
                        allMissing.push({
                            name: itemName, // Guardar el nombre original para mostrarlo bonito
                            category: isDeco ? 'decoracion' : 'productos'
                        });
                    }
                });
            }
        }

        // Crear los materiales pendientes locales solo si no existen ya
        allMissing.forEach(mm => {
            const normName = normalizeText(mm.name);
            const alreadyPending = materials.find(m => normalizeText(m.name) === normName && m.pending === true);
            
            if (!alreadyPending) {
                createPendingMaterial(mm.name, mm.category);
            }
        });

        // ==========================================
        // 3. IMPORTAR RECETAS Y CALCULAR COSTOS LOCALES
        // ==========================================
        let recetasImportadas = 0;
        
        for (const [claseNum, claseData] of Object.entries(data.clases || {})) {
            const recetasClase = Object.values(claseData.recetas || {});
            
            recetasClase.forEach(receta => {
                const recetaName = receta.nombre || receta.name || 'Sin nombre';
                let idx = recipes.findIndex(r => r.name === recetaName && r.recipeFolder === data.metadata.nombre);
                
                // Función para adaptar ingredientes al formato de la app y calcular precios
                const procesarItems = (items) => {
                    return (items || []).map(item => {
                        const itemName = item.nombre || item.name || '';
                        const itemQty = parseFloat(item.cantidad || item.qty || 0);
                        const itemUnit = item.unidad || item.unit || '';
                        
                        if (!itemName.trim()) return null;
                        
                        // Buscar en inventario local usando texto normalizado
                        const found = materials.find(m => normalizeText(m.name) === normalizeText(itemName));
                        
                        return {
                            id: item.id || (Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5)),
                            matId: found ? String(found.id) : '',
                            name: itemName, // Mantener nombre original de la receta
                            qty: itemQty,
                            unit: itemUnit,
                            cost: (found && !found.pending) ? calculateIngredientCost(found, itemQty, itemUnit) : 0,
                            pending: found ? (found.pending || false) : true
                        };
                    }).filter(Boolean); // Quitar nulos
                };

                const processedIngredients = procesarItems(receta.ingredientes || receta.ingredients);
                const processedDecorations = procesarItems(receta.decoraciones || receta.decorations);

                const ic = processedIngredients.reduce((s, i) => s + (i.cost || 0), 0);
                const dc = processedDecorations.reduce((s, d) => s + (d.cost || 0), 0);
                const ec = parseFloat(receta.costoExtra || receta.extraCost || 0);

                const newRecipeData = {
                    id: (idx >= 0) ? recipes[idx].id : (Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9)),
                    name: recetaName,
                    ingredients: processedIngredients,
                    decorations: processedDecorations,
                    extraSubcategory: receta.subcategoriaExtra || receta.extraSubcategory || null,
                    extraCost: ec,
                    totalCost: ic + dc + ec,
                    portions: parseFloat(receta.porciones || receta.portions || 1),
                    yield: receta.rendimiento || receta.yield || '',
                    prepTime: receta.tiempoPrep || receta.prepTime || '',
                    instructions: receta.instrucciones || receta.instructions || '',
                    notes: receta.notas || receta.notes || '',
                    recipeTips: receta.tips || receta.recipeTips || '',
                    recipePhoto: receta.foto || receta.recipePhoto || null,
                    recipeFolder: data.metadata.nombre,
                    recipeSource: 'module',
                    moduleClass: claseData.nombre || `Clase ${claseNum}`,
                    isRestricted: false
                };

                if (idx >= 0) {
                    recipes[idx] = newRecipeData;
                } else {
                    recipes.push(newRecipeData);
                }
                recetasImportadas++;
            });
        }
        
        // ==========================================
        // 4. IMPORTAR CURSOS Y SUS CLASES (FOTOS Y TIPS)
        // ==========================================
        let cursosImportados = 0;
        let clasesImportadas = 0;

        // Primero, armar un array con las clases que vienen de Firebase
        const clasesFirebase = Object.values(data.clases || {}).map(claseData => ({
            id: claseData.numero ? `clase_${claseData.numero}` : Date.now().toString(),
            name: claseData.nombre,
            tips: claseData.tips || '',
            photos: claseData.fotos || [], // Aquí están las fotos
            linkedRecipes: Object.values(claseData.recetas || {}).map(r => r.nombre || r.name),
            moduleClassName: claseData.nombre
        }));

        clasesImportadas = clasesFirebase.length;

        for (const [cursoId, cursoData] of Object.entries(data.cursos || {})) {
            const existeCursoIdx = courses.findIndex(c => c.name === cursoData.nombre && String(c.moduleId) === String(currentModId));
            
            let cursoActual;

            if (existeCursoIdx >= 0) {
                // Actualizar curso existente
                courses[existeCursoIdx].day = cursoData.dia || '';
                courses[existeCursoIdx].schedule = cursoData.horario || '';
                courses[existeCursoIdx].students = (cursoData.estudiantes || []).map(est => ({
                    id: est.id,
                    name: est.nombre,
                    studentCode: est.codigo
                }));
                cursoActual = courses[existeCursoIdx];
            } else {
                // Crear nuevo curso
                cursoActual = {
                    id: cursoId,
                    name: cursoData.nombre,
                    moduleId: currentModId,
                    moduleName: data.metadata.nombre,
                    day: cursoData.dia || '',
                    schedule: cursoData.horario || '',
                    students: (cursoData.estudiantes || []).map(est => ({
                        id: est.id, name: est.nombre, studentCode: est.codigo
                    })),
                    classes: [] // Iniciar clases vacío
                };
                courses.push(cursoActual);
            }

            // === ASIGNAR FOTOS Y TIPS A LAS CLASES DEL CURSO ===
            if (!cursoActual.classes) cursoActual.classes = [];

            // Actualizar o crear clases dentro del curso basándose en la data de Firebase
            clasesFirebase.forEach(claseFB => {
                const claseExistenteIdx = cursoActual.classes.findIndex(c => c.name === claseFB.name || c.moduleClassName === claseFB.name);
                
                if (claseExistenteIdx >= 0) {
                    // Actualizar clase existente (respetando sus fechas y asistencia local)
                    cursoActual.classes[claseExistenteIdx].tips = claseFB.tips;
                    cursoActual.classes[claseExistenteIdx].photos = claseFB.photos;
                    // Vincular recetas si no las tiene
                    if (!cursoActual.classes[claseExistenteIdx].linkedRecipes || cursoActual.classes[claseExistenteIdx].linkedRecipes.length === 0) {
                        // Buscar en base de recetas locales para sacar el objeto completo
                        const recetasVinculadasObjects = recipes.filter(r => r.recipeFolder === data.metadata.nombre && claseFB.linkedRecipes.includes(r.name));
                        cursoActual.classes[claseExistenteIdx].linkedRecipes = recetasVinculadasObjects;
                    }
                } else {
                    // Crear clase nueva en el curso
                    const recetasVinculadasObjects = recipes.filter(r => r.recipeFolder === data.metadata.nombre && claseFB.linkedRecipes.includes(r.name));
                    
                    cursoActual.classes.push({
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                        name: claseFB.name,
                        moduleClassName: claseFB.name,
                        date: new Date().toISOString().split('T')[0],
                        tips: claseFB.tips,
                        photos: claseFB.photos,
                        linkedRecipes: recetasVinculadasObjects,
                        attendance: [],
                        blockCode: generateClassBlockCode ? generateClassBlockCode() : Math.random().toString(36).substr(2, 5).toUpperCase(),
                        codesGenerated: false
                    });
                }
            });

            cursosImportados++;
        }
        
        // Guardar todo
        saveModules();
        saveRecipesToStorage();
        saveCourses();
        saveMaterialsToStorage(); // Guardar los pendientes
        renderMaterials();
        updateMaterialSelect();
        updateDecorationSelect();
        updateRecipesView();
        renderCourses();
        
        // MOSTRAR MENSAJES FINALES
        if (allMissing.length > 0) {
            showSyncMissingModal(allMissing); // <- ¡AQUÍ ESTÁ LA VENTANA EMERGENTE!
            showToast(`✅ Módulo cargado! ⚠️ Faltan ${allMissing.length} materiales`);
        } else {
            showToast(`✅ ¡Módulo ${cleanPrefix} descargado!\n\n` +
                      `📝 ${recetasImportadas} recetas cargadas\n` +
                      `👥 ${cursosImportados} cursos cargados`);
        }
        
    } catch (error) {
        console.error('❌ Error descargando desde Firebase:', error);
        showToast('❌ Error al descargar. Verifica tu conexión.', true);
    }
}  
    
// === MODAL NUEVO MATERIAL NOMBRE ===
function showNewMaterialNameModal(category, callback) {
    newMaterialNameCategory = category;
    newMaterialNameCallback = callback;
    document.getElementById('new-mat-name-input').value = '';

    if (category === 'decoracion') {
        document.getElementById('new-mat-name-label').textContent = 'Nombre de la decoración';
        document.getElementById('new-mat-name-input').placeholder = 'Ej: Chispas de chocolate';
        document.querySelector('#modal-new-material-name h3').textContent = '➕ Nueva Decoración';
    } else {
        document.getElementById('new-mat-name-label').textContent = 'Nombre del material';
        document.getElementById('new-mat-name-input').placeholder = 'Ej: Ron blanco';
        document.querySelector('#modal-new-material-name h3').textContent = '➕ Nuevo Material';
    }

    document.getElementById('modal-new-material-name').classList.add('active');
}

function confirmNewMaterialName() {
    const name = document.getElementById('new-mat-name-input').value.trim();
    if (!name) {
        showToast('Ingresa un nombre', true);
        return;
    }
    closeModal('modal-new-material-name');
    if (newMaterialNameCallback) {
        newMaterialNameCallback(name);
        newMaterialNameCallback = null;
    }
}

// === MODAL MATERIAL PENDIENTE ===
function showPendingMaterialModal(name, category, callback) {
    pendingMaterialData = { name, category };
    pendingMaterialCallback = callback;
    document.getElementById('pending-mat-name-display').textContent = name;
    document.getElementById('modal-pending-material').classList.add('active');
}

function addPendingMaterialNow() {
    closeModal('modal-pending-material');
    if (pendingMaterialData) {
        showAddMaterialModal(null, pendingMaterialData.category, '');
        document.getElementById('mat-name').value = pendingMaterialData.name;
        window.pendingMaterialSaveCallback = pendingMaterialCallback;
    }
}

function addPendingMaterialLater() {
    if (pendingMaterialData) {
        const mat = createPendingMaterial(pendingMaterialData.name, pendingMaterialData.category);
        if (pendingMaterialCallback) {
            pendingMaterialCallback(mat);
        }
        renderMaterials();
        updateMaterialSelect();
        updateDecorationSelect();
    }
    closeModal('modal-pending-material');
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

// ============================================
// CARGA DE RECETAS Y CLASES DESDE FIREBASE
// ============================================

// Cargar módulo completo desde Firebase
async function cargarModuloDesdeFirebase(moduloCode = 'PA1') {
    try {
        console.log('📥 Cargando módulo', moduloCode, 'desde Firebase...');
        
        // 1. Obtener datos del módulo completo
        const moduloSnapshot = await firebaseDB.ref('modulos/' + moduloCode).once('value');
        
        if (!moduloSnapshot.exists()) {
            console.log('⚠️ Módulo no encontrado en Firebase');
            return null;
        }
        
        const moduloData = moduloSnapshot.val();
        const alumnaId = localStorage.getItem('mushu_alumna_id');
        
        // 2. Obtener clases desbloqueadas de la alumna
        let clasesDesbloqueadas = [];
        
        if (alumnaId) {
            const desbloqueadasSnapshot = await firebaseDB
                .ref('alumnas/' + alumnaId + '/clasesDesbloqueadas')
                .once('value');
            
            if (desbloqueadasSnapshot.exists()) {
                const desbloqueadasData = desbloqueadasSnapshot.val();
                clasesDesbloqueadas = Object.keys(desbloqueadasData);
            }
        }
        
        // También incluir clases guardadas localmente (offline)
        const clasesLocales = JSON.parse(localStorage.getItem('mushu_clases_desbloqueadas') || '[]');
        clasesDesbloqueadas = [...new Set([...clasesDesbloqueadas, ...clasesLocales])];
        
        console.log('🔓 Clases desbloqueadas:', clasesDesbloqueadas);
        
        // 3. Construir estructura de datos para la app
        const moduloCargado = {
            metadata: moduloData.metadata,
            clases: [],
            recetas: [],
            cursos: moduloData.cursos || []
        };
        
        // 4. Filtrar clases y recetas según desbloqueos
        for (const [claseNum, claseData] of Object.entries(moduloData.clases || {})) {
            const codigoClase = moduloCode + '-CLASE' + claseNum;
            
            // Si la clase está desbloqueada
            if (clasesDesbloqueadas.includes(codigoClase)) {
                
                // Agregar información de la clase
                moduloCargado.clases.push({
                    numero: claseData.numero,
                    nombre: claseData.nombre,
                    fecha: claseData.fecha,
                    tips: claseData.tips || '',
                    fotos: claseData.fotos || [],
                    codigoBloqueo: claseData.codigoBloqueo,
                    activa: claseData.activa
                });
                
                // Agregar recetas de esta clase
                const recetasClase = Object.values(claseData.recetas || {});
                moduloCargado.recetas.push(...recetasClase);
                
                console.log(`✅ Clase ${claseNum} desbloqueada:`, recetasClase.length, 'recetas');
                console.log(`   Tips:`, claseData.tips ? 'Sí' : 'No');
                console.log(`   Fotos:`, claseData.fotos ? claseData.fotos.length : 0);
                
            } else {
                console.log(`🔒 Clase ${claseNum} bloqueada`);
            }
        }
        
        console.log('📊 Total recetas disponibles:', moduloCargado.recetas.length);
        console.log('📚 Total clases disponibles:', moduloCargado.clases.length);
        
        // 5. Guardar en caché local
        localStorage.setItem('mushu_cache_modulo_' + moduloCode, JSON.stringify(moduloCargado));
        localStorage.setItem('mushu_cache_timestamp_' + moduloCode, Date.now().toString());
        
        console.log('✅ Módulo cargado y cacheado');
        
        return moduloCargado;
        
    } catch (error) {
        console.error('❌ Error cargando módulo desde Firebase:', error);
        
        // Intentar cargar desde caché local
        console.log('⚠️ Intentando cargar desde caché local...');
        const cached = localStorage.getItem('mushu_cache_modulo_' + moduloCode);
        
        if (cached) {
            console.log('✅ Módulo cargado desde caché (modo offline)');
            return JSON.parse(cached);
        }
        
        return null;
    }
}

// Cargar solo recetas (compatible con sistema actual)
async function cargarRecetasDesdeFirebase(moduloCode = 'PA1') {
    const modulo = await cargarModuloDesdeFirebase(moduloCode);
    return modulo ? modulo.recetas : [];
}

// Cargar solo clases
async function cargarClasesDesdeFirebase(moduloCode = 'PA1') {
    const modulo = await cargarModuloDesdeFirebase(moduloCode);
    return modulo ? modulo.clases : [];
}

// Obtener una receta específica por ID
async function obtenerRecetaPorId(moduloCode, recetaId) {
    try {
        const recetaSnapshot = await firebaseDB
            .ref(`modulos/${moduloCode}/recetas/${recetaId}`)
            .once('value');
        
        if (recetaSnapshot.exists()) {
            return recetaSnapshot.val();
        }
        
        return null;
        
    } catch (error) {
        console.error('Error obteniendo receta:', error);
        return null;
    }
}

// Verificar si hay actualizaciones
async function verificarActualizacionesModulo(moduloCode = 'PA1') {
    try {
        const ultimaActSnapshot = await firebaseDB
            .ref('modulos/' + moduloCode + '/metadata/ultimaActualizacion')
            .once('value');
        
        if (ultimaActSnapshot.exists()) {
            const ultimaActFirebase = new Date(ultimaActSnapshot.val()).getTime();
            const cacheTimestamp = parseInt(localStorage.getItem('mushu_cache_timestamp_' + moduloCode) || '0');
            
            if (ultimaActFirebase > cacheTimestamp) {
                console.log('🔄 Hay actualizaciones disponibles, recargando...');
                showToast('Nuevas recetas disponibles');
                return await cargarModuloDesdeFirebase(moduloCode);
            }
        }
        
        return null;
        
    } catch (error) {
        console.log('⚠️ No se pudo verificar actualizaciones (offline)');
        return null;
    }
}

console.log('📚 Sistema de carga de módulos Firebase listo');

// ============================================
// INTEGRACIÓN FIREBASE CON SISTEMA DE CLASES
// ============================================

// Registrar alumna en Firebase cuando se agrega al módulo
async function registrarAlumnaEnFirebase(nombre, moduloPrefix, alumnaId) {
    try {
        console.log('📝 Registrando alumna en Firebase:', nombre, moduloPrefix, alumnaId);
        
        const alumnaData = {
            id: alumnaId,
            nombre: nombre,
            modulo: moduloPrefix,
            fechaRegistro: new Date().toISOString(),
            activa: true,
            clasesDesbloqueadas: [],
            asistencia: [],
            ultimaConexion: new Date().toISOString()
        };
        
        // Guardar en Firebase: alumnas/{modulo}/{id}
        await firebaseDB.ref(`alumnas/${moduloPrefix}/${alumnaId}`).set(alumnaData);
        
        console.log('✅ Alumna registrada en Firebase');
        return true;
        
    } catch (error) {
        console.error('❌ Error registrando alumna:', error);
        return false;
    }
}

// Registrar código y desbloquear clase en Firebase
async function sincronizarAsistenciaFirebase(modulePrefix, studentId, classId, presente) {
    try {
        const moduloAlumnasRef = firebaseDB.ref(`alumnas/${modulePrefix}`);
        const moduloSnap = await moduloAlumnasRef.once('value');
        
        if (!moduloSnap.exists()) {
            console.error('❌ No existe módulo de alumnas:', modulePrefix);
            return;
        }
        
        let alumnaRef = null;
        let asistencia = [];
        
        moduloSnap.forEach(cursoSnap => {
            cursoSnap.forEach(alumnaSnap => {
                if (String(alumnaSnap.key) === String(studentId)) {
                    alumnaRef = firebaseDB.ref(`alumnas/${modulePrefix}/${cursoSnap.key}/${studentId}/asistencia`);
                    asistencia = alumnaSnap.val().asistencia || [];
                }
            });
        });
        
        if (!alumnaRef) {
            console.error('❌ No se encontró la alumna para sincronizar asistencia');
            return;
        }
        
        const existente = asistencia.findIndex(a => a.claseId === classId);
        
        if (existente >= 0) {
            asistencia[existente].presente = presente;
            asistencia[existente].fechaActualizacion = new Date().toISOString();
        } else {
            asistencia.push({
                claseId: classId,
                fecha: new Date().toISOString(),
                presente: presente
            });
        }
        
        await alumnaRef.set(asistencia);
        console.log('✅ Asistencia sincronizada');
        
    } catch (error) {
        console.error('❌ Error sincronizando asistencia:', error);
    }
}

// Cargar clases desbloqueadas desde Firebase
async function cargarClasesDesbloqueadasDesdeFirebase(modulePrefix, studentId) {
    try {
        console.log('📥 Cargando clases desbloqueadas desde Firebase...');
        
        const alumnaRef = firebaseDB.ref(`alumnas/${modulePrefix}/${studentId}`);
        const alumnaSnap = await alumnaRef.once('value');
        
        if (!alumnaSnap.exists()) {
            console.log('⚠️ Alumna no encontrada en Firebase');
            return [];
        }
        
        const alumnaData = alumnaSnap.val();
        const clasesIds = alumnaData.clasesDesbloqueadas || [];
        
        console.log('🔓 Clases desbloqueadas:', clasesIds);
        
        // Cargar datos completos de cada clase desde el módulo
        const clasesCompletas = [];
        
        for (const claseId of clasesIds) {
            const claseRef = firebaseDB.ref(`modulos/${modulePrefix}/clases/${claseId}`);
            const claseSnap = await claseRef.once('value');
            
            if (claseSnap.exists()) {
                const claseData = claseSnap.val();
                clasesCompletas.push({
                    classId: claseId,
                    className: claseData.nombre,
                    modulePrefix: modulePrefix,
                    photos: claseData.fotos || [],
                    tips: claseData.tips || '',
                    linkedRecipes: claseData.recetasVinculadas || [],
                    ...claseData
                });
                
                console.log('✅ Clase cargada:', claseData.nombre);
            }
        }
        
        return clasesCompletas;
        
    } catch (error) {
        console.error('❌ Error cargando clases:', error);
        return [];
    }
}

// Sincronizar asistencia con Firebase
async function sincronizarAsistenciaFirebase(modulePrefix, studentId, classId, presente) {
    try {
        const asistenciaRef = firebaseDB.ref(`alumnas/${modulePrefix}/${studentId}/asistencia`);
        
        // Obtener asistencia actual
        const asistenciaSnap = await asistenciaRef.once('value');
        let asistencia = asistenciaSnap.val() || [];
        
        // Buscar si ya existe registro para esta clase
        const existente = asistencia.findIndex(a => a.claseId === classId);
        
        if (existente >= 0) {
            // Actualizar
            asistencia[existente].presente = presente;
            asistencia[existente].fechaActualizacion = new Date().toISOString();
        } else {
            // Crear nuevo
            asistencia.push({
                claseId: classId,
                fecha: new Date().toISOString(),
                presente: presente
            });
        }
        
        await asistenciaRef.set(asistencia);
        console.log('✅ Asistencia sincronizada');
        
    } catch (error) {
        console.error('❌ Error sincronizando asistencia:', error);
    }
}

console.log('🔗 Integración Firebase con sistema de clases cargada');

async function procesarCodigoEnFirebase(codigoCompleto, decodedData) {
    try {
        console.log('🔓 Procesando código en Firebase:', codigoCompleto);
        
        const { modulePrefix, classId, attendance, studentId } = decodedData;
        
        // 1. Verificar si el código ya fue usado
        const codigoRef = firebaseDB.ref(`codigos/${codigoCompleto}`);
        const codigoSnap = await codigoRef.once('value');
        
        if (codigoSnap.exists()) {
            console.log('⚠️ Código ya fue usado anteriormente');
        }
        
        // 2. Registrar el código usado
        await codigoRef.set({
            codigoCompleto: codigoCompleto,
            modulo: modulePrefix,
            claseId: classId,
            alumnaId: studentId,
            asistencia: parseInt(attendance) % 2 === 1,
            fechaUso: new Date().toISOString(),
            usado: true
        });
        
        // 3. Buscar a la alumna dentro de TODOS los cursos del módulo
        const moduloAlumnasRef = firebaseDB.ref(`alumnas/${modulePrefix}`);
        const moduloSnap = await moduloAlumnasRef.once('value');
        
        if (!moduloSnap.exists()) {
            console.error('❌ No existe el módulo en alumnas:', modulePrefix);
            return false;
        }
        
        let alumnaRef = null;
        let alumnaData = null;
        let foundCursoId = null;
        
        moduloSnap.forEach(cursoSnap => {
            const cursoId = cursoSnap.key;
            cursoSnap.forEach(alumnaSnap => {
                if (String(alumnaSnap.key) === String(studentId)) {
                    alumnaRef = firebaseDB.ref(`alumnas/${modulePrefix}/${cursoId}/${studentId}`);
                    alumnaData = alumnaSnap.val();
                    foundCursoId = cursoId;
                }
            });
        });
        
        if (!alumnaRef || !alumnaData) {
            console.error('❌ No se encontró la alumna con código', studentId, 'en módulo', modulePrefix);
            return false;
        }
        
        // 4. Actualizar clases desbloqueadas
        if (!alumnaData.clasesDesbloqueadas) {
            alumnaData.clasesDesbloqueadas = [];
        }
        
        if (!alumnaData.clasesDesbloqueadas.includes(classId)) {
            alumnaData.clasesDesbloqueadas.push(classId);
        }
        
        // 5. Actualizar asistencia
        if (!alumnaData.asistencia) {
            alumnaData.asistencia = [];
        }
        
        alumnaData.asistencia.push({
            claseId: classId,
            fecha: new Date().toISOString(),
            presente: parseInt(attendance) % 2 === 1,
            codigo: codigoCompleto
        });
        
        // 6. Guardar
        await alumnaRef.update({
            clasesDesbloqueadas: alumnaData.clasesDesbloqueadas,
            asistencia: alumnaData.asistencia,
            ultimaConexion: new Date().toISOString()
        });
        
        console.log('✅ Código procesado y alumna actualizada en Firebase | Curso:', foundCursoId);
        return true;
        
    } catch (error) {
        console.error('❌ Error procesando código:', error);
        return false;
    }
}
