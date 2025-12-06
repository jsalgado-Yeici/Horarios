import { db, auth, collection, APP_ID, PALETTE } from './config.js';
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
    doc, addDoc, updateDoc, deleteDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// === ESTADO GLOBAL ===
const state = {
    teachers: [], subjects: [], groups: [], schedule: [], 
    presets: [], blocks: [], classrooms: [],
    loading: { teachers: true, subjects: true, groups: true, schedule: true }
};

const cols = {
    teachers: collection(db, `artifacts/${APP_ID}/public/data/teachers`),
    subjects: collection(db, `artifacts/${APP_ID}/public/data/subjects`),
    groups: collection(db, `artifacts/${APP_ID}/public/data/groups`),
    schedule: collection(db, `artifacts/${APP_ID}/public/data/schedule`),
    presets: collection(db, `artifacts/${APP_ID}/public/data/presets`),
    blocks: collection(db, `artifacts/${APP_ID}/public/data/blocks`),
    classrooms: collection(db, `artifacts/${APP_ID}/public/data/classrooms`)
};

const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const timeSlots = Array.from({length: 14}, (_, i) => i + 7); // 7:00 a 20:00

// === TOOLTIP LOGIC ===
let tooltipEl = null;

function initTooltip() {
    // Evitar duplicados
    const existing = document.getElementById('custom-tooltip');
    if (existing) existing.remove();

    tooltipEl = document.createElement('div');
    tooltipEl.id = 'custom-tooltip';
    document.body.appendChild(tooltipEl);
    
    document.addEventListener('mousemove', (e) => {
        if (tooltipEl.classList.contains('visible')) {
            const x = e.clientX + 15;
            const y = e.clientY + 15;
            // Ajuste para que no se salga de la pantalla
            tooltipEl.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
            tooltipEl.style.top = `${Math.min(y, window.innerHeight - 100)}px`;
        }
    });
}

function showTooltip(html) {
    if(!tooltipEl) return;
    tooltipEl.innerHTML = html;
    tooltipEl.classList.add('visible');
}

function hideTooltip() {
    if(tooltipEl) tooltipEl.classList.remove('visible');
}

// === INICIO APP ===
function initApp() {
    console.log("App Iniciada v3.1 (Fixed)");
    initTooltip();
    setupListeners(); // ¡Ahora sí existe!
    setupRealtimeListeners();
}

// === LISTENERS DE INTERFAZ (ESTA FUE LA QUE FALTÓ) ===
function setupListeners() {
    // Navegación de Pestañas (Tabs)
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.onclick = () => {
            // Desactivar todos
            document.querySelectorAll('.tab-button').forEach(b => {
                b.classList.remove('active', 'bg-white', 'text-indigo-600', 'shadow-sm');
                b.classList.add('text-gray-600');
            });
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            
            // Activar actual
            btn.classList.add('active', 'bg-white', 'text-indigo-600', 'shadow-sm');
            btn.classList.remove('text-gray-600');
            
            const target = document.getElementById(`tab-content-${btn.dataset.tab}`);
            if(target) target.classList.remove('hidden');
            
            // Renderizado bajo demanda
            if(btn.dataset.tab === 'horario') renderScheduleGrid();
        };
    });

    // Filtros del Horario
    ['teacher', 'group', 'classroom', 'trimester'].forEach(id => {
        const el = document.getElementById(`filter-${id}`);
        if(el) el.onchange = renderScheduleGrid;
    });

    // Botones de Acción
    const bindClick = (id, fn) => {
        const el = document.getElementById(id);
        if(el) el.onclick = fn;
    };

    bindClick('open-class-modal-btn', () => showClassForm());
    bindClick('add-teacher-btn', showTeacherForm);
    bindClick('open-subject-modal-btn', showSubjectForm);
    bindClick('add-group-btn', addGroup);
    bindClick('add-classroom-btn', addClassroom);
    bindClick('add-block-btn', addBlock);
    bindClick('toggle-map-edit-btn', toggleMapEdit);
    bindClick('open-preset-modal-btn', showPresetForm);
    
    // Peligro
    bindClick('advance-trimester-btn', () => {
        if(confirm('¿Seguro? Esto avanzará todos los grupos.')) {
            // Lógica simple de avance
            alert('Funcionalidad de avance pendiente de implementación segura.');
        }
    });

    // Cerrar Modal al hacer clic fuera
    const modal = document.getElementById('modal');
    if(modal) {
        modal.onclick = (e) => {
            if(e.target.id === 'modal') modal.classList.add('hidden');
        };
    }
}

// === LISTENERS FIREBASE ===
function setupRealtimeListeners() {
    const update = (k, s) => {
        state[k] = s.docs.map(d => ({ id: d.id, ...d.data() }));
        state.loading[k] = false;
        checkLoading();
        if(k === 'schedule' || k === 'blocks') renderScheduleGrid();
        if(['teachers','subjects','groups','classrooms'].includes(k)) renderFilterOptions();
        if(k === 'classrooms') renderClassroomsList();
        if(k === 'teachers') renderTeachersList();
        if(k === 'subjects') renderSubjectsList();
        if(k === 'groups') renderGroupsList();
        // Presets y bloques
        if(k === 'presets') renderPresetsList();
        if(k === 'blocks') renderBlocksList();
    };

    Object.keys(cols).forEach(k => onSnapshot(cols[k], s => update(k, s)));
}

function checkLoading() {
    if (!Object.values(state.loading).some(v => v)) {
        const overlay = document.getElementById('loading-overlay');
        if(overlay) { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 500); }
    }
}

// === CONFLICT DETECTION ===
function validateConflicts(newClass, ignoreId = null) {
    const conflicts = [];
    
    const ncStart = newClass.startTime;
    const ncEnd = newClass.startTime + newClass.duration;

    state.schedule.forEach(existing => {
        if (existing.id === ignoreId) return; // Ignorar si es la misma
        if (existing.day !== newClass.day) return; // Ignorar otro día

        const exStart = existing.startTime;
        const exEnd = existing.startTime + existing.duration;

        // Verificar superposición
        const overlap = (ncStart < exEnd) && (ncEnd > exStart);
        
        if (overlap) {
            if (existing.teacherId === newClass.teacherId) {
                const t = state.teachers.find(x => x.id === existing.teacherId);
                conflicts.push(`El docente <b>${t?.name}</b> ya tiene clase.`);
            }
            if (existing.groupId === newClass.groupId) {
                const g = state.groups.find(x => x.id === existing.groupId);
                conflicts.push(`El grupo <b>${g?.name}</b> ya tiene clase.`);
            }
            if (newClass.classroomId && existing.classroomId && existing.classroomId === newClass.classroomId) {
                const r = state.classrooms.find(x => x.id === existing.classroomId);
                conflicts.push(`El aula <b>${r?.name}</b> está ocupada.`);
            }
        }
    });
    
    // Bloqueos
    const group = state.groups.find(g => g.id === newClass.groupId);
    if(group) {
        state.blocks.forEach(block => {
            if(block.trimester != group.trimester) return;
            const daysArr = block.days === 'L-V' ? days : days.slice(0,4);
            if(!daysArr.includes(newClass.day)) return;

            const bStart = block.startTime;
            const bEnd = block.endTime;
            if ((ncStart < bEnd) && (ncEnd > bStart)) {
                conflicts.push(`Choque con Bloqueo Administrativo (C${block.trimester}).`);
            }
        });
    }

    return conflicts;
}

// === RENDER GRID ===
function renderScheduleGrid() {
    const grid = document.getElementById('schedule-grid');
    if (!grid) return;
    
    const frag = document.createDocumentFragment();

    // Headers
    const corner = document.createElement('div');
    corner.className = 'grid-header sticky top-0 left-0 bg-gray-50';
    corner.innerText = 'HORA';
    frag.appendChild(corner);

    days.forEach(d => {
        const h = document.createElement('div');
        h.className = 'grid-header sticky top-0 bg-gray-50';
        h.innerText = d;
        frag.appendChild(h);
    });

    // Grid Slots
    timeSlots.forEach(h => {
        const tc = document.createElement('div');
        tc.className = 'grid-time-slot sticky left-0 bg-white';
        tc.innerText = `${h}:00`;
        frag.appendChild(tc);

        days.forEach(d => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.day = d;
            cell.dataset.hour = h;
            // Drag
            cell.ondragover = e => { e.preventDefault(); cell.classList.add('droppable-hover'); };
            cell.ondragleave = () => cell.classList.remove('droppable-hover');
            cell.ondrop = e => handleDrop(e, d, h);
            cell.onclick = (e) => { if(e.target===cell) showClassForm({day: d, startTime: h}); };
            frag.appendChild(cell);
        });
    });

    // Filters
    const fTeacher = document.getElementById('filter-teacher')?.value;
    const fGroup = document.getElementById('filter-group')?.value;
    const fRoom = document.getElementById('filter-classroom')?.value;
    const fTrim = document.getElementById('filter-trimester')?.value;

    const visible = state.schedule.filter(c => {
        if(fTeacher && c.teacherId !== fTeacher) return false;
        if(fGroup && c.groupId !== fGroup) return false;
        if(fRoom && c.classroomId !== fRoom) return false;
        if(fTrim) {
            const g = state.groups.find(x => x.id === c.groupId);
            if(!g || g.trimester != fTrim) return false;
        }
        return true;
    });

    // Items
    days.forEach((day, dIdx) => {
        const dayItems = visible.filter(c => c.day === day);
        dayItems.forEach(c => {
            const overlaps = dayItems.filter(o => c.startTime < (o.startTime + o.duration) && (c.startTime + c.duration) > o.startTime);
            overlaps.sort((a,b) => a.id.localeCompare(b.id)); 
            
            const item = createItem(c, dIdx, overlaps.length, overlaps.indexOf(c));
            if(item) frag.appendChild(item);
        });
    });

    // Blocks
    state.blocks.forEach(b => {
        if(fTrim && b.trimester != fTrim) return;
        const dIndices = b.days==='L-V' ? [0,1,2,3,4] : [0,1,2,3];
        dIndices.forEach(di => {
            const el = document.createElement('div');
            el.className = 'schedule-block';
            el.style.top = `${(timeSlots.indexOf(b.startTime)+1)*60}px`;
            el.style.height = `${(b.endTime - b.startTime)*60}px`;
            el.style.left = `calc(60px + ((100% - 60px)/5)*${di})`;
            el.style.width = `calc(((100% - 60px)/5) - 2px)`;
            el.innerHTML = `<span>BLOQ C${b.trimester}</span><button class="ml-2 text-red-500 font-bold" onclick="delDoc('blocks','${b.id}')">×</button>`;
            // Hack pointer events
            if(el.children[1]) el.children[1].style.pointerEvents = "auto";
            frag.appendChild(el);
        });
    });

    grid.innerHTML = '';
    grid.appendChild(frag);
}

function createItem(c, dayIdx, totalOverlaps, overlapIdx) {
    const tIdx = timeSlots.indexOf(c.startTime);
    if(tIdx === -1) return null;

    const subj = state.subjects.find(s => s.id === c.subjectId);
    const teach = state.teachers.find(t => t.id === c.teacherId);
    const grp = state.groups.find(g => g.id === c.groupId);
    const room = state.classrooms.find(r => r.id === c.classroomId);
    
    if(!subj || !grp || !teach) return null;

    const el = document.createElement('div');
    el.className = 'schedule-item';
    
    const rowH = 60;
    const colW = `((100% - 60px)/5)`;
    
    el.style.top = `${(tIdx + 1) * rowH}px`;
    el.style.height = `${(c.duration * rowH) - 4}px`;
    el.style.left = `calc(60px + (${colW} * ${dayIdx}) + (${colW} / ${totalOverlaps} * ${overlapIdx}))`;
    el.style.width = `calc((${colW} / ${totalOverlaps}) - 4px)`;
    
    const cIdx = subj.id.split('').reduce((a,x)=>a+x.charCodeAt(0),0) % PALETTE.length;
    el.style.borderLeftColor = PALETTE[cIdx];

    const isNarrow = totalOverlaps >= 3;
    el.innerHTML = `
        <div class="subject-name" style="${isNarrow?'font-size:0.6rem':''}">${subj.name}</div>
        ${!isNarrow ? `<div class="item-details">${teach.name}<br>${grp.name} ${room ? `• ${room.name}` : ''}</div>` : ''}
        <div class="actions">
            <button class="edt">✎</button>
            <button class="del">×</button>
        </div>
    `;

    el.querySelector('.edt').onclick = (e) => { e.stopPropagation(); showClassForm(c); };
    el.querySelector('.del').onclick = (e) => { e.stopPropagation(); deleteDoc(doc(cols.schedule, c.id)); };
    
    el.onmouseenter = () => {
        showTooltip(`
            <strong>${subj.name}</strong>
            <div class="mb-1">${c.startTime}:00 - ${c.startTime + c.duration}:00</div>
            <div>👨‍🏫 ${teach.name}</div>
            <div>👥 ${grp.name}</div>
            <div>🏫 ${room ? room.name : '<span class="text-red-300">Sin Aula</span>'}</div>
            <div class="meta">Clic para editar</div>
        `);
    };
    el.onmouseleave = hideTooltip;
    el.onclick = () => showClassForm(c);

    return el;
}

// === FORMULARIO ===
function showClassForm(defs = {}) {
    const modal = document.getElementById('modal');
    modal.classList.remove('hidden');
    const content = document.getElementById('modal-content');
    
    const genOpts = (arr, sel) => arr.sort((a,b)=>a.name.localeCompare(b.name)).map(i => `<option value="${i.id}" ${sel===i.id?'selected':''}>${i.name}</option>`).join('');

    content.innerHTML = `
        <div class="p-6 bg-white rounded-lg">
            <h2 class="text-xl font-bold mb-4 text-gray-800">${defs.id ? 'Editar' : 'Nueva'} Clase</h2>
            <div id="conflict-warnings" class="mb-4 hidden"></div>
            
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div><label class="block font-bold text-gray-500 mb-1">Materia</label><select id="f-sub" class="w-full border p-2 rounded">${genOpts(state.subjects, defs.subjectId)}</select></div>
                <div><label class="block font-bold text-gray-500 mb-1">Grupo</label><select id="f-grp" class="w-full border p-2 rounded">${genOpts(state.groups, defs.groupId)}</select></div>
                <div><label class="block font-bold text-gray-500 mb-1">Docente</label><select id="f-tch" class="w-full border p-2 rounded">${genOpts(state.teachers, defs.teacherId)}</select></div>
                <div><label class="block font-bold text-gray-500 mb-1">Aula</label><select id="f-rm" class="w-full border p-2 rounded"><option value="">-- Sin Aula --</option>${genOpts(state.classrooms, defs.classroomId)}</select></div>
                <div><label class="block font-bold text-gray-500 mb-1">Día</label><select id="f-day" class="w-full border p-2 rounded">${days.map(d=>`<option ${d===defs.day?'selected':''}>${d}</option>`).join('')}</select></div>
                <div><label class="block font-bold text-gray-500 mb-1">Inicio</label><select id="f-time" class="w-full border p-2 rounded">${timeSlots.map(t=>`<option value="${t}" ${t==defs.startTime?'selected':''}>${t}:00</option>`).join('')}</select></div>
                <div><label class="block font-bold text-gray-500 mb-1">Duración (hrs)</label><input type="number" id="f-dur" value="${defs.duration||2}" min="1" max="6" class="w-full border p-2 rounded"></div>
            </div>

            <div class="flex justify-end gap-3 mt-6">
                <button id="btn-cancel" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                <button id="btn-save" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 shadow">Guardar Clase</button>
            </div>
        </div>
    `;

    document.getElementById('btn-cancel').onclick = () => modal.classList.add('hidden');
    
    document.getElementById('btn-save').onclick = async () => {
        const payload = {
            subjectId: document.getElementById('f-sub').value,
            groupId: document.getElementById('f-grp').value,
            teacherId: document.getElementById('f-tch').value,
            classroomId: document.getElementById('f-rm').value,
            day: document.getElementById('f-day').value,
            startTime: parseInt(document.getElementById('f-time').value),
            duration: parseInt(document.getElementById('f-dur').value)
        };

        const conflicts = validateConflicts(payload, defs.id);
        
        if (conflicts.length > 0) {
            const warningDiv = document.getElementById('conflict-warnings');
            warningDiv.innerHTML = `<div class="bg-red-50 border-l-4 border-red-500 p-3 text-red-700"><p class="font-bold">¡Conflicto Detectado!</p><ul class="list-disc pl-4 mt-1">${conflicts.map(c=>`<li>${c}</li>`).join('')}</ul><div class="mt-2 text-xs text-right"><button id="btn-force" class="text-red-800 underline font-bold">Guardar de todos modos</button></div></div>`;
            warningDiv.classList.remove('hidden');
            
            document.getElementById('btn-force').onclick = async () => {
                await commitSave(payload, defs.id);
            };
            return;
        }

        await commitSave(payload, defs.id);
    };
}

async function commitSave(data, id) {
    try {
        if(id) await updateDoc(doc(cols.schedule, id), data);
        else await addDoc(cols.schedule, data);
        document.getElementById('modal').classList.add('hidden');
        notify("Clase guardada exitosamente", false);
    } catch(e) {
        notify("Error al guardar", true);
        console.error(e);
    }
}

async function handleDrop(e, day, hour) {
    e.preventDefault();
    document.querySelectorAll('.droppable-hover').forEach(c => c.classList.remove('droppable-hover'));
    try {
        const d = JSON.parse(e.dataTransfer.getData('application/json'));
        if(d.type === 'subject') showClassForm({day, startTime: hour, subjectId: d.id});
    } catch(err){}
}

function notify(msg, err) {
    const box = document.getElementById('notification-container');
    if(!box) return;
    const n = document.createElement('div');
    n.className = `notification ${err?'error':'success'} show`;
    n.textContent = msg;
    box.appendChild(n);
    setTimeout(()=>n.remove(), 3000);
}

// === UTILS RENDER ===
function renderFilterOptions() {
    const fill = (id, arr, lbl) => {
        const el = document.getElementById(id); 
        if(!el) return;
        const val = el.value;
        el.innerHTML = `<option value="">${lbl}</option>` + arr.sort((a,b)=>a.name.localeCompare(b.name)).map(i=>`<option value="${i.id}">${i.name}</option>`).join('');
        el.value = val;
    };
    fill('filter-teacher', state.teachers, 'Todos los Docentes');
    fill('filter-group', state.groups, 'Todos los Grupos');
    fill('filter-classroom', state.classrooms, 'Todas las Aulas');
    
    const t = document.getElementById('filter-trimester');
    if(t && t.children.length < 2) { t.innerHTML='<option value="">Todos los Cuatris</option>'; for(let i=1;i<=9;i++) t.add(new Option(`C${i}`,i)); }
}

function renderSubjectsList() {
    const c = document.getElementById('unassigned-subjects-container'); 
    if(c) {
        c.innerHTML='';
        state.subjects.sort((a,b)=>a.name.localeCompare(b.name)).forEach(s => {
            const d = document.createElement('div');
            d.className = 'p-2 bg-white border rounded shadow-sm text-xs cursor-grab hover:bg-indigo-50 truncate';
            d.draggable = true; d.textContent = s.name;
            d.ondragstart = e => e.dataTransfer.setData('application/json', JSON.stringify({type:'subject', id:s.id}));
            c.appendChild(d);
        });
    }
    // Lista completa
    const list = document.getElementById('subjects-by-trimester'); 
    if(list) {
        list.innerHTML='';
        state.subjects.forEach(s => {
            const el = document.createElement('div'); el.className='text-xs p-1 border rounded bg-gray-50 mb-1 flex justify-between';
            el.innerHTML = `<span class="truncate w-3/4">${s.name}</span><button class="text-red-500 font-bold" onclick="delDoc('subjects','${s.id}')">×</button>`;
            list.appendChild(el);
        });
    }
}

// Helpers globales para gestión (se inyectan en window para los onclicks de HTML plano)
window.delDoc = (col, id) => { if(confirm('¿Eliminar?')) deleteDoc(doc(cols[col], id)); };

function renderTeachersList() { 
    const l = document.getElementById('teachers-list'); if(!l) return;
    l.innerHTML='';
    state.teachers.forEach(t => {
        const d = document.createElement('div'); d.className='flex justify-between p-2 border-b text-sm';
        d.innerHTML=`${t.name} <button onclick="delDoc('teachers','${t.id}')" class="text-red-500">×</button>`;
        l.appendChild(d);
    });
}
function renderGroupsList() {
    const l = document.getElementById('groups-by-trimester'); if(!l) return;
    l.innerHTML='';
    state.groups.forEach(g => {
        const d = document.createElement('div'); d.className='text-sm p-2 border rounded bg-white mb-2';
        d.innerHTML = `<b>${g.name}</b> (C${g.trimester})`;
        l.appendChild(d);
    });
}
function renderClassroomsList() {
    const l = document.getElementById('classrooms-list'); if(!l) return;
    l.innerHTML='';
    state.classrooms.forEach(c => {
        const d = document.createElement('div'); d.className='p-2 border-b text-sm flex justify-between';
        d.innerHTML=`${c.name} <button onclick="delDoc('classrooms','${c.id}')" class="text-red-500">×</button>`;
        l.appendChild(d);
    });
}
function renderPresetsList() {
    const l = document.getElementById('presets-list'); if(!l) return;
    l.innerHTML = '';
    // Placeholder de presets
}
function renderBlocksList() {
    const l = document.getElementById('blocks-list'); if(!l) return;
    l.innerHTML = '';
    state.blocks.forEach(b => {
        const d = document.createElement('div');
        d.className='text-xs p-2 border rounded mb-1 flex justify-between';
        d.innerHTML = `Bloqueo C${b.trimester} (${b.days})`;
        l.appendChild(d);
    });
}

// Actions
function addGroup() { const n = document.getElementById('group-number-input').value; if(n) addDoc(cols.groups, {name: `IAEV-${n}`, trimester: 1}); }
function addClassroom() { const n = document.getElementById('classroom-name').value; if(n) addDoc(cols.classrooms, {name: n}); }
function addBlock() { 
    const t = document.getElementById('block-time')?.value;
    const tri = document.getElementById('block-trimester')?.value;
    if(t && tri) addDoc(cols.blocks, {startTime: parseInt(t), endTime: parseInt(t)+2, trimester: tri, days:'L-V'}); 
}
function showTeacherForm() { const n = prompt('Nombre docente:'); if(n) addDoc(cols.teachers, {name: n}); }
function showSubjectForm() { const n = prompt('Materia:'); if(n) addDoc(cols.subjects, {name: n, trimester: 1}); }
function showPresetForm() { alert('Función de presets en construcción'); }
function toggleMapEdit() { alert('Mapa en construcción'); }

// START
auth.onAuthStateChanged(u => { 
    if(u) initApp(); 
    else signInAnonymously(auth).catch(console.error); 
});
