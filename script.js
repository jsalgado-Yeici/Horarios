import { db, auth, collection, APP_ID, PALETTE } from './config.js';
import { renderMap } from './maps.js';
import { exportSchedule, exportAllSchedules } from './export.js';
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { doc, addDoc, updateDoc, deleteDoc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// === ESTADO GLOBAL ===
const state = {
    teachers: [], subjects: [], groups: [], schedule: [], 
    presets: [], blocks: [], classrooms: [],
    loading: { teachers: true, subjects: true, groups: true, schedule: true, classrooms: true }
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
const timeSlots = Array.from({length: 14}, (_, i) => i + 7);

// === INIT ===
let tooltipEl = null;
function initApp() {
    console.log("App v10.0 (Final Stable)");
    createTooltip();
    setupListeners();
    setupRealtimeListeners();
}

// === LISTENERS ===
function setupListeners() {
    // Tabs
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-button').forEach(b => {
                b.classList.remove('active', 'bg-white', 'text-indigo-600', 'shadow-sm');
                b.classList.add('text-gray-600');
            });
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            
            btn.classList.add('active', 'bg-white', 'text-indigo-600', 'shadow-sm');
            btn.classList.remove('text-gray-600');
            document.getElementById(`tab-content-${btn.dataset.tab}`).classList.remove('hidden');
            
            if(btn.dataset.tab === 'horario') renderScheduleGrid();
            if(btn.dataset.tab === 'mapa') initMapTab();
        };
    });

    // Filtros
    ['teacher', 'group', 'classroom', 'trimester'].forEach(id => {
        const el = document.getElementById(`filter-${id}`);
        if(el) el.onchange = () => renderScheduleGrid();
    });

    // Botones
    const bind = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };
    bind('open-class-modal-btn', () => showClassForm());
    bind('add-teacher-btn', () => showTeacherForm()); 
    bind('open-subject-modal-btn', () => showSubjectForm());
    bind('add-group-btn', addGroup);
    bind('add-block-btn', addBlock);
    bind('add-classroom-btn', addClassroom);
    bind('floor-btn-pb', () => switchFloor('pb'));
    bind('floor-btn-pa', () => switchFloor('pa'));
    
    // EXPORTACIÓN
    bind('btn-export-pdf', () => exportSchedule('pdf'));
    bind('btn-export-img', () => exportSchedule('img'));
    bind('btn-export-all', () => exportAllSchedules(state, renderScheduleGrid));

    const modal = document.getElementById('modal');
    if(modal) modal.onclick = (e) => { if(e.target.id === 'modal') modal.classList.add('hidden'); };
}

// === MAPA ===
function initMapTab() { switchFloor('pa'); }
function switchFloor(floor) {
    const btnPb = document.getElementById('floor-btn-pb');
    const btnPa = document.getElementById('floor-btn-pa');
    const active = "px-4 py-2 rounded-md text-sm font-bold bg-white shadow text-indigo-600 transition-all";
    const inactive = "px-4 py-2 rounded-md text-sm font-bold text-gray-500 hover:bg-white hover:shadow transition-all";
    if(floor === 'pb') { btnPb.className = active; btnPa.className = inactive; } 
    else { btnPa.className = active; btnPb.className = inactive; }
    const container = document.getElementById('map-viewport');
    renderMap(floor, container, state.schedule, (room) => showRoomDetails(room));
}
function showRoomDetails(room) {
    const modal = document.getElementById('modal'); modal.classList.remove('hidden');
    const content = document.getElementById('modal-content');
    const classes = state.schedule.filter(c => c.classroomId === room.id || (state.classrooms.find(cr => cr.name === room.name)?.id === c.classroomId));
    const dayOrder = { "Lunes": 1, "Martes": 2, "Miércoles": 3, "Jueves": 4, "Viernes": 5 };
    classes.sort((a,b) => (dayOrder[a.day] - dayOrder[b.day]) || (a.startTime - b.startTime));
    let html = `<div class="p-6 bg-white"><h2 class="text-2xl font-bold mb-1 text-gray-800">${room.name}</h2><div class="border-t border-gray-100 pt-4 max-h-[60vh] overflow-y-auto">`;
    if(classes.length === 0) html += `<div class="text-center py-8 text-gray-400 italic">No hay clases asignadas.</div>`;
    else {
        html += `<table class="w-full text-sm text-left"><thead class="text-xs text-gray-500 uppercase bg-gray-50"><tr><th class="px-2 py-2">Día</th><th class="px-2 py-2">Hora</th><th class="px-2 py-2">Materia</th><th class="px-2 py-2">Docente</th></tr></thead><tbody class="divide-y divide-gray-100">`;
        classes.forEach(c => {
            const subj = state.subjects.find(s => s.id === c.subjectId)?.name || '???';
            const teach = state.teachers.find(t => t.id === c.teacherId)?.name || '???';
            html += `<tr class="hover:bg-gray-50"><td class="px-2 py-3 font-medium">${c.day}</td><td class="px-2 py-3">${c.startTime}:00 - ${c.startTime + c.duration}:00</td><td class="px-2 py-3 font-semibold">${subj}</td><td class="px-2 py-3 text-gray-500">${teach}</td></tr>`;
        });
        html += `</tbody></table>`;
    }
    html += `</div><div class="mt-6 flex justify-end"><button onclick="document.getElementById('modal').classList.add('hidden')" class="px-4 py-2 bg-gray-800 text-white rounded">Cerrar</button></div></div>`;
    content.innerHTML = html;
}

// === FIREBASE ===
function setupRealtimeListeners() {
    const update = (k, s) => {
        state[k] = s.docs.map(d => ({ id: d.id, ...d.data() }));
        state.loading[k] = false;
        checkLoading();
        if(k === 'schedule' || k === 'blocks') renderScheduleGrid();
        if(['teachers','subjects','groups','classrooms'].includes(k)) renderFilterOptions();
        if(k === 'teachers') renderTeachersList();
        if(k === 'subjects') renderSubjectsList();
        if(k === 'groups') renderGroupsList();
        if(k === 'blocks') renderBlocksList();
        if(k === 'classrooms') renderClassroomsManageList();
    };
    Object.keys(cols).forEach(k => onSnapshot(cols[k], s => update(k, s)));
}
function checkLoading() { if (!Object.values(state.loading).some(v => v)) { const o = document.getElementById('loading-overlay'); if(o) { o.style.opacity = '0'; setTimeout(() => o.remove(), 500); }}}

// === RENDER GRID (EXPORT VERSION) ===
export function renderScheduleGrid(targetElement = document.getElementById('schedule-grid'), customFilters = null) {
    if (!targetElement) return;
    
    // Limpieza de estilos para exportación
    if(customFilters) {
        targetElement.style.border = "none";
        targetElement.style.boxShadow = "none";
    }

    targetElement.innerHTML = '';
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

    // Grid
    timeSlots.forEach(h => {
        const tc = document.createElement('div'); 
        tc.className = 'grid-time-slot sticky left-0 bg-white'; 
        tc.innerText = `${h}:00 - ${h+1}:00`; 
        frag.appendChild(tc);
        
        days.forEach(d => {
            const cell = document.createElement('div'); 
            cell.className = 'grid-cell'; 
            cell.dataset.day = d; 
            cell.dataset.hour = h;
            
            // Interacción solo si NO es exportación
            if(!customFilters && targetElement.id === 'schedule-grid') { 
                cell.ondragover = e => { e.preventDefault(); cell.classList.add('droppable-hover'); };
                cell.ondragleave = () => cell.classList.remove('droppable-hover');
                cell.ondrop = e => handleDrop(e, d, h);
                cell.onclick = (e) => { if(e.target===cell) showClassForm({day: d, startTime: h}); };
            }
            frag.appendChild(cell);
        });
    });

    const fTch = customFilters ? customFilters.teacherId : document.getElementById('filter-teacher')?.value;
    const fGrp = customFilters ? customFilters.groupId : document.getElementById('filter-group')?.value;
    const fTrim = customFilters ? null : document.getElementById('filter-trimester')?.value;

    const visible = state.schedule.filter(c => {
        if(fTch && c.teacherId !== fTch) return false;
        if(fGrp && c.groupId !== fGrp) return false;
        if(fTrim) { const g = state.groups.find(x => x.id === c.groupId); if(!g || g.trimester != fTrim) return false; }
        return true;
    });

    // Items
    days.forEach((day, dIdx) => {
        const items = visible.filter(c => c.day === day);
        items.forEach(c => {
            const overlaps = items.filter(o => c.startTime < (o.startTime + o.duration) && (c.startTime + c.duration) > o.startTime);
            overlaps.sort((a,b) => a.id.localeCompare(b.id)); 
            const el = createItem(c, dIdx, overlaps.length, overlaps.indexOf(c), !!customFilters);
            if(el) frag.appendChild(el);
        });
    });

    // Render Blocks (Ocultar o simplificar en exportación si se desea)
    // En este caso, los ocultamos en exportación para limpiar la vista
    if(!customFilters) {
        state.blocks.forEach(b => {
            if(fTrim && b.trimester != fTrim) return;
            const dIndices = b.days==='L-V' ? [0,1,2,3,4] : [0,1,2,3];
            dIndices.forEach(di => {
                const el = document.createElement('div'); el.className = 'schedule-block';
                el.style.top = `${(timeSlots.indexOf(b.startTime)+1)*60}px`; el.style.height = `${(b.endTime - b.startTime)*60}px`;
                el.style.left = `calc(60px + ((100% - 60px)/5)*${di})`; el.style.width = `calc(((100% - 60px)/5) - 2px)`;
                el.innerHTML = `<span>BLOQ C${b.trimester}</span><button class="ml-2 text-red-500 font-bold" onclick="delDoc('blocks','${b.id}')">×</button>`;
                if(el.children[1]) el.children[1].style.pointerEvents = "auto";
                frag.appendChild(el);
            });
        });
    }

    targetElement.appendChild(frag);
}

function createItem(c, dayIdx, totalOverlaps, overlapIdx, isExporting) {
    const tIdx = timeSlots.indexOf(c.startTime); if(tIdx === -1) return null;
    const subj = state.subjects.find(s => s.id === c.subjectId);
    const teach = state.teachers.find(t => t.id === c.teacherId);
    const grp = state.groups.find(g => g.id === c.groupId);
    const room = state.classrooms.find(r => r.id === c.classroomId);
    
    if(!subj || !grp || !teach) return null;

    const el = document.createElement('div'); el.className = 'schedule-item';
    const rowH = isExporting ? 55 : 60; 
    const colW = `((100% - ${isExporting?80:60}px)/5)`;
    
    el.style.top = `${(tIdx + 1) * rowH}px`;
    el.style.height = `${(c.duration * rowH) - (isExporting?0:4)}px`;
    el.style.left = `calc(${isExporting?80:60}px + (${colW} * ${dayIdx}) + (${colW} / ${totalOverlaps} * ${overlapIdx}))`;
    el.style.width = `calc((${colW} / ${totalOverlaps}) - ${isExporting?0:4}px)`;
    
    const cIdx = subj.id.split('').reduce((a,x)=>a+x.charCodeAt(0),0) % PALETTE.length;
    
    // FORMATO DE EXPORTACIÓN (Sólido y limpio)
    if(isExporting) {
        el.style.backgroundColor = PALETTE[cIdx] + '99'; // Color pastel sólido
        el.style.border = '1px solid #000';
        el.style.borderLeft = '1px solid #000'; 
    } else {
        el.style.borderLeftColor = PALETTE[cIdx];
    }

    // DATOS DE TEXTO
    const teacherName = (isExporting && teach.fullName) ? teach.fullName : teach.name;
    const roomName = room ? room.name : "N/A"; // Mostrar "N/A" si no hay salón
    const isNarrow = totalOverlaps >= 3 && !isExporting;

    el.innerHTML = `
        <div class="subject-name" style="${isNarrow?'font-size:0.6rem':''}">${subj.name}</div>
        ${!isNarrow ? `
            <div class="item-details" ${isExporting?'style="font-size:9px;"':''}>
                <div style="font-weight:normal;">${teacherName}</div>
                ${isExporting ? `<div style="margin-top:2px; font-weight:bold;">${roomName}</div>` : `<div>${grp.name}</div>`}
            </div>` : ''}
        ${!isExporting ? `<div class="actions"><button class="btn-edt">✎</button><button class="btn-del">×</button></div>` : ''}
    `;

    if(!isExporting) {
        el.querySelector('.btn-edt').onclick = (e) => { e.stopPropagation(); showClassForm(c); }; 
        el.querySelector('.btn-del').onclick = (e) => { e.stopPropagation(); deleteDoc(doc(cols.schedule, c.id)); };
        el.onmouseenter = () => showTooltip(`<strong>${subj.name}</strong><br>👨‍🏫 ${teacherName}<br>🏫 ${roomName}`);
        el.onmouseleave = hideTooltip; 
        el.onclick = () => showClassForm(c);
    }
    return el;
}

// === FORMULARIOS ===
function showClassForm(defs = {}) {
    const modal = document.getElementById('modal'); modal.classList.remove('hidden'); const content = document.getElementById('modal-content');
    const genOpts = (arr, sel) => arr.sort((a,b)=>a.name.localeCompare(b.name)).map(i => `<option value="${i.id}" ${sel===i.id?'selected':''}>${i.name}</option>`).join('');
    content.innerHTML = `<div class="p-6 bg-white rounded-lg"><h2 class="text-xl font-bold mb-4 text-gray-800">${defs.id ? 'Editar' : 'Nueva'} Clase</h2><div id="conflict-warnings" class="mb-4 hidden"></div><div class="grid grid-cols-2 gap-4 text-sm"><div><label class="block font-bold text-gray-500 mb-1">Materia</label><select id="f-sub" class="w-full border p-2 rounded">${genOpts(state.subjects, defs.subjectId)}</select></div><div><label class="block font-bold text-gray-500 mb-1">Grupo</label><select id="f-grp" class="w-full border p-2 rounded">${genOpts(state.groups, defs.groupId)}</select></div><div><label class="block font-bold text-gray-500 mb-1">Docente</label><select id="f-tch" class="w-full border p-2 rounded">${genOpts(state.teachers, defs.teacherId)}</select></div><div><label class="block font-bold text-gray-500 mb-1">Aula</label><select id="f-rm" class="w-full border p-2 rounded"><option value="">-- Sin Aula --</option>${genOpts(state.classrooms, defs.classroomId)}</select></div><div><label class="block font-bold text-gray-500 mb-1">Día</label><select id="f-day" class="w-full border p-2 rounded">${days.map(d=>`<option ${d===defs.day?'selected':''}>${d}</option>`).join('')}</select></div><div><label class="block font-bold text-gray-500 mb-1">Inicio</label><select id="f-time" class="w-full border p-2 rounded">${timeSlots.map(t=>`<option value="${t}" ${t==defs.startTime?'selected':''}>${t}:00</option>`).join('')}</select></div><div><label class="block font-bold text-gray-500 mb-1">Duración (hrs)</label><input type="number" id="f-dur" value="${defs.duration||2}" min="1" max="6" class="w-full border p-2 rounded"></div></div><div class="flex justify-end gap-3 mt-6"><button id="btn-cancel" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button><button id="btn-save" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 shadow">Guardar</button></div></div>`;
    document.getElementById('btn-cancel').onclick = () => modal.classList.add('hidden');
    document.getElementById('btn-save').onclick = async () => {
        const payload = { subjectId: document.getElementById('f-sub').value, groupId: document.getElementById('f-grp').value, teacherId: document.getElementById('f-tch').value, classroomId: document.getElementById('f-rm').value, day: document.getElementById('f-day').value, startTime: parseInt(document.getElementById('f-time').value), duration: parseInt(document.getElementById('f-dur').value) };
        const conflicts = validateConflicts(payload, defs.id);
        if (conflicts.length > 0) {
            const div = document.getElementById('conflict-warnings'); div.innerHTML = `<div class="bg-red-50 border-l-4 border-red-500 p-3 text-red-700 font-bold mb-2">Conflictos:</div><ul class="list-disc pl-5 text-red-600 text-xs">${conflicts.map(c=>`<li>${c}</li>`).join('')}</ul><button id="btn-force" class="mt-2 text-red-800 underline text-xs font-bold">Guardar Igual</button>`; div.classList.remove('hidden'); document.getElementById('btn-force').onclick = async () => { await commitSave(payload, defs.id); }; return;
        }
        await commitSave(payload, defs.id);
    };
}
async function commitSave(data, id) { try { if(id) await updateDoc(doc(cols.schedule, id), data); else await addDoc(cols.schedule, data); document.getElementById('modal').classList.add('hidden'); } catch(e){ console.error(e); } }
function showTeacherForm(teacher = null) { const modal = document.getElementById('modal'); modal.classList.remove('hidden'); const isEdit = !!teacher; document.getElementById('modal-content').innerHTML = `<div class="p-6 bg-white"><h2 class="font-bold mb-4">${isEdit ? 'Editar' : 'Nuevo'} Docente</h2><input id="t-name" value="${teacher ? teacher.name : ''}" class="w-full border p-2 mb-2" placeholder="Apodo (Ej: Alex)"><input id="t-full" value="${teacher ? (teacher.fullName || '') : ''}" class="w-full border p-2 mb-4" placeholder="Nombre Completo Real"><button id="btn-t-save" class="bg-blue-600 text-white px-4 py-2 rounded">Guardar</button></div>`; document.getElementById('btn-t-save').onclick = async () => { const n = document.getElementById('t-name').value; const f = document.getElementById('t-full').value; if(n) { const data = {name: n, fullName: f}; if(isEdit) await updateDoc(doc(cols.teachers, teacher.id), data); else await addDoc(cols.teachers, data); modal.classList.add('hidden'); } }; }
function showSubjectForm(sub = null) { const modal = document.getElementById('modal'); modal.classList.remove('hidden'); const isEdit = !!sub; const defT = sub ? sub.defaultTeacherId : ''; const genOpts = (arr) => arr.map(i => `<option value="${i.id}" ${defT===i.id?'selected':''}>${i.name}</option>`).join(''); document.getElementById('modal-content').innerHTML = `<div class="p-6 bg-white"><h2 class="font-bold mb-4">${isEdit?'Editar':'Nueva'} Materia</h2><input id="s-name" value="${sub?sub.name:''}" class="w-full border p-2 mb-2" placeholder="Nombre Materia"><select id="s-trim" class="w-full border p-2 mb-2">${[1,2,3,4,5,6,7,8,9].map(i=>`<option value="${i}" ${sub&&sub.trimester==i?'selected':''}>Cuatri ${i}</option>`).join('')}</select><select id="s-def" class="w-full border p-2 mb-4"><option value="">-- Profe Default --</option>${genOpts(state.teachers)}</select><button id="btn-s-save" class="bg-indigo-600 text-white px-4 py-2 rounded">Guardar</button></div>`; document.getElementById('btn-s-save').onclick = async () => { const n = document.getElementById('s-name').value; const data = { name: n, trimester: parseInt(document.getElementById('s-trim').value), defaultTeacherId: document.getElementById('s-def').value }; if(n) { if(isEdit) await updateDoc(doc(cols.subjects, sub.id), data); else await addDoc(cols.subjects, data); modal.classList.add('hidden'); } }; }
async function handleDrop(e, day, hour) { e.preventDefault(); document.querySelectorAll('.droppable-hover').forEach(c => c.classList.remove('droppable-hover')); try { const d = JSON.parse(e.dataTransfer.getData('application/json')); if(d.type === 'subject') { const s = state.subjects.find(x => x.id === d.id); showClassForm({day, startTime: hour, subjectId: d.id, teacherId: s ? s.defaultTeacherId : null}); } } catch(err){} }
function validateConflicts(newClass, ignoreId) { const conflicts = []; const ns = newClass.startTime; const ne = ns + newClass.duration; state.schedule.forEach(e => { if(e.id === ignoreId || e.day !== newClass.day) return; const es = e.startTime; const ee = es + e.duration; if(ns < ee && ne > es) { if(e.teacherId === newClass.teacherId) conflicts.push("El docente ya tiene clase"); if(e.groupId === newClass.groupId) conflicts.push("El grupo ya tiene clase"); if(newClass.classroomId && e.classroomId === newClass.classroomId) conflicts.push("El aula está ocupada"); } }); return conflicts; }
function createTooltip() { tooltipEl = document.createElement('div'); tooltipEl.id = 'custom-tooltip'; document.body.appendChild(tooltipEl); document.addEventListener('mousemove', e => { if(tooltipEl.classList.contains('visible')) { tooltipEl.style.left = (e.clientX + 15) + 'px'; tooltipEl.style.top = (e.clientY + 15) + 'px'; } }); }
function showTooltip(html) { tooltipEl.innerHTML = html; tooltipEl.classList.add('visible'); }
function hideTooltip() { tooltipEl.classList.remove('visible'); }
function renderFilterOptions() { const fill = (id, arr, l) => { const el = document.getElementById(id); if(el) { const v = el.value; el.innerHTML = `<option value="">${l}</option>` + arr.map(i=>`<option value="${i.id}">${i.name}</option>`).join(''); el.value = v; }}; fill('filter-teacher', state.teachers, 'Todos los Docentes'); fill('filter-group', state.groups, 'Todos los Grupos'); const t = document.getElementById('filter-trimester'); if(t) { const val = t.value; t.innerHTML = '<option value="">Todos los Cuatris</option>'; for(let i=1;i<=9;i++) t.add(new Option(`C${i}`,i)); t.value = val; } }
function renderTeachersList() { const l = document.getElementById('teachers-list'); if(!l) return; l.innerHTML = ''; state.teachers.sort((a,b)=>a.name.localeCompare(b.name)).forEach(t => { const full = t.fullName ? `<span class="text-[10px] text-gray-400 block">${t.fullName}</span>` : ''; l.innerHTML += `<div class="p-2 border-b text-sm flex justify-between items-center bg-white hover:bg-gray-50"><div class="leading-tight"><span class="font-bold text-gray-700 cursor-pointer" onclick="window.editTeacher('${t.id}')">${t.name}</span>${full}</div><div class="flex gap-1"><button class="text-blue-400 px-1" onclick="window.editTeacher('${t.id}')">✎</button><button class="text-red-400 px-1" onclick="delDoc('teachers','${t.id}')">×</button></div></div>`; }); }
function renderSubjectsList() { const c = document.getElementById('unassigned-subjects-container'); if(c) { c.innerHTML = ''; const grouped = {}; state.subjects.forEach(s => { const t = s.trimester||0; if(!grouped[t]) grouped[t]=[]; grouped[t].push(s); }); Object.keys(grouped).sort((a,b)=>Number(a)-Number(b)).forEach(t => { c.innerHTML += `<details class="trimester-group" open><summary>Cuatri ${t}</summary><div class="content">${grouped[t].map(s => `<div class="draggable-subject" draggable="true" ondragstart="event.dataTransfer.setData('application/json', '{\\'type\\':\\'subject\\',\\'id\\':\\'${s.id}\\'}')">${s.name}</div>`).join('')}</div></details>`; }); } const l2 = document.getElementById('subjects-by-trimester'); if(l2) { l2.innerHTML = ''; const grouped = {}; state.subjects.forEach(s => { const t = s.trimester||0; if(!grouped[t]) grouped[t]=[]; grouped[t].push(s); }); Object.keys(grouped).sort((a,b)=>Number(a)-Number(b)).forEach(t => { const items = grouped[t].map(s => `<div class="flex justify-between items-center p-1 border-b last:border-0 border-gray-100 hover:bg-white text-xs"><span class="truncate" title="${s.name}">${s.name}</span><button onclick="window.editSub('${s.id}')" class="text-blue-400 px-1">✎</button></div>`).join(''); l2.innerHTML += `<div class="bg-gray-50 border border-gray-200 rounded-lg p-2 shadow-sm h-fit"><h3 class="font-bold text-[10px] text-gray-500 uppercase mb-2 pb-1 border-b border-gray-200 sticky top-0 bg-gray-50">Cuatrimestre ${t}</h3><div class="space-y-0.5 max-h-48 overflow-y-auto">${items}</div></div>`; }); } }
function renderGroupsList() { const l = document.getElementById('groups-by-trimester'); if(l) l.innerHTML = state.groups.map(g => `<div class="p-2 border bg-white text-sm">${g.name}</div>`).join(''); }
function renderClassroomsManageList() { const l = document.getElementById('classrooms-list-manage'); if(l) l.innerHTML = state.classrooms.map(c => `<div class="p-1 border-b text-xs flex justify-between">${c.name} <button class="text-red-500" onclick="delDoc('classrooms','${c.id}')">x</button></div>`).join(''); }
function renderBlocksList() { const l = document.getElementById('blocks-list'); if(l) l.innerHTML = state.blocks.map(b => `<div class="text-xs p-2 border rounded bg-slate-50 flex justify-between items-center"><div><div class="font-bold">Bloqueo C${b.trimester}</div><div class="text-[10px] text-gray-500">${b.startTime}:00 - ${b.endTime}:00</div></div><button class="text-red-500 font-bold px-2" onclick="delDoc('blocks','${b.id}')">×</button></div>`).join(''); }
window.delDoc = (c, id) => { if(confirm('¿Seguro de borrar?')) deleteDoc(doc(cols[c], id)); };
window.editSub = (id) => showSubjectForm(state.subjects.find(s=>s.id===id));
window.editTeacher = (id) => showTeacherForm(state.teachers.find(t=>t.id===id));
function addGroup() { const n=document.getElementById('group-number-input').value; if(n) addDoc(cols.groups, {name: `IAEV-${n}`, trimester: 1}); }
function addClassroom() { const n=document.getElementById('classroom-name-input').value; if(n) addDoc(cols.classrooms, {name: n}); }
function addBlock() { const t=document.getElementById('block-time').value; const tr=document.getElementById('block-trimester').value; if(t&&tr) addDoc(cols.blocks, {startTime: parseInt(t), endTime: parseInt(t)+2, trimester: tr, days:'L-V'}); }
auth.onAuthStateChanged(u => { if(u) initApp(); else signInAnonymously(auth).catch(console.error); });
