import { state, cols, days, timeSlots } from './state.js';
import {
    showTeacherForm, showSubjectForm, deleteDocWrapper, addExternalRule,
    saveSettings, showGroupForm, showClassroomForm, restoreDoc
} from './actions.js';
import { addDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { cols as collections } from './state.js';

// === AJUSTES DE TURNO ===
export function renderSettings() {
    const input = document.getElementById('setting-shift-cutoff');
    if (input && state.settings.shiftCutoff) input.value = state.settings.shiftCutoff;
    const btn = document.getElementById('btn-save-settings');
    if (btn) btn.onclick = saveSettings;
}

// === HERRAMIENTAS UI ===
function renderStickyToolbar(container, searchPlaceholder, onSearch, onAdd, addLabel) {
    let toolbar = container.querySelector('.sticky-toolbar');
    if (!toolbar) {
        toolbar = document.createElement('div');
        toolbar.className = "sticky-toolbar sticky top-0 bg-white/95 backdrop-blur z-10 pb-4 pt-1 mb-2 border-b flex gap-2 items-center";
        toolbar.innerHTML = `
            <div class="relative flex-1">
                <span class="absolute left-3 top-2.5 text-gray-400">🔍</span>
                <input type="text" class="w-full pl-9 pr-3 py-2 bg-gray-50 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all" placeholder="${searchPlaceholder}">
            </div>
            <button class="btn-recycle text-gray-400 hover:text-gray-600 p-2 rounded hover:bg-gray-100 transition" title="Papelera">🗑️</button>
            <button class="btn-add bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-indigo-700 transition flex items-center gap-2 text-sm whitespace-nowrap">
                <span>+ ${addLabel}</span>
            </button>
        `;
        container.prepend(toolbar);

        const input = toolbar.querySelector('input');
        input.addEventListener('input', (e) => onSearch(e.target.value));
        toolbar.querySelector('.btn-add').onclick = onAdd;
        toolbar.querySelector('.btn-recycle').onclick = showRecycleBin;
    }
}

function showRecycleBin() {
    const modal = document.getElementById('modal');
    modal.classList.remove('hidden');
    const content = document.getElementById('modal-content');

    if (state.deletedItems.length === 0) {
        content.innerHTML = `<div class="p-6 text-center"><h2 class="text-xl font-bold text-gray-400 mb-4">Papelera Vacía</h2><button onclick="document.getElementById('modal').classList.add('hidden')" class="bg-gray-200 px-4 py-2 rounded">Cerrar</button></div>`;
        return;
    }

    content.innerHTML = `
        <div class="p-6 bg-white max-h-[80vh] overflow-y-auto">
            <h2 class="text-xl font-bold mb-4 flex items-center gap-2">🗑️ Papelera de Reciclaje (${state.deletedItems.length})</h2>
            <div class="space-y-2">
                ${state.deletedItems.map(item => `
                    <div class="border p-3 rounded flex justify-between items-center bg-gray-50">
                        <div>
                            <p class="font-bold text-sm text-gray-800">${item.name || 'Sin Nombre'}</p>
                            <p class="text-[10px] text-gray-500 uppercase">${item._col} • Eliminado: ${item._deletedAt?.toLocaleTimeString() || ''}</p>
                        </div>
                        <button class="text-green-600 hover:text-green-800 font-bold text-sm bg-green-50 px-3 py-1 rounded border border-green-200" onclick='restoreItemWrapper("${item.id}")'>Restaurar</button>
                    </div>
                `).join('')}
            </div>
            <div class="mt-4 text-right">
                <button onclick="document.getElementById('modal').classList.add('hidden')" class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded font-bold">Cerrar</button>
            </div>
        </div>
    `;

    // Global helper for the button onclick string (or attach listeners distinct way, but this is quick)
    window.restoreItemWrapper = (id) => {
        const item = state.deletedItems.find(i => i.id === id);
        if (item) restoreDoc(item);
        showRecycleBin(); // Refresh
    };
}


// === LISTA DOCENTES (CARDS) ===
export function renderTeachersList() {
    const l = document.getElementById('teachers-list'); if (!l) return;
    const container = l.parentElement;

    // Hide legacy add button if exists
    const oldBtn = document.getElementById('add-teacher-btn');
    if (oldBtn) oldBtn.closest('.absolute')?.classList.add('hidden'); // Hide container

    // Setup Toolbar
    renderStickyToolbar(container, "Buscar docente...", (term) => {
        // Simple search filter
        const cards = l.querySelectorAll('.teacher-card');
        term = term.toLowerCase();
        cards.forEach(c => {
            const name = c.dataset.name.toLowerCase();
            if (name.includes(term)) c.classList.remove('hidden');
            else c.classList.add('hidden');
        });
    }, () => showTeacherForm(), "Nuevo Docente");

    // Grid Setup
    l.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1 pb-20 overflow-y-auto h-full content-start";
    l.innerHTML = '';

    // Clear Content but Keep Toolbar (or re-render it)
    // Actually, simpler to just clear and re-add for now to avoid state complexity, 
    // or better: checking if toolbar exists inside element is tricky if we clear innerHTML.
    // Strategy: The container for the list in HTML is just the list. The Add button was outside in HTML.
    // We will HIDE the old "Add" button in HTML via CSS or logic and inject our own.

    // Let's assume we empty it and rebuild.
    l.innerHTML = '';

    // Render Toolbar (Injected into list container? better in parent, but let's put it at top of list for now)
    // NOTE: HTML structure has a parent with relative positioning. Let's put toolbar there?
    // Current HTML: #subtab-teachers > div.relative > #teachers-list
    // We'll stick to rendering cards inside #teachers-list.

    state.teachers.sort((a, b) => a.name.localeCompare(b.name)).forEach(t => {
        const classHours = state.schedule.filter(c => c.teacherId === t.id && c.type !== 'advisory').reduce((acc, c) => acc + c.duration, 0);
        const advisoryScheduled = state.schedule.filter(c => c.teacherId === t.id && c.type === 'advisory').reduce((acc, c) => acc + c.duration, 0);
        const advisoryGoal = t.advisoryHours || 0;
        const totalScheduled = classHours + advisoryScheduled;
        const pct = Math.min((totalScheduled / 40) * 100, 100);

        let color = "bg-green-500";
        if (totalScheduled > 20) color = "bg-yellow-500";
        if (totalScheduled > 30) color = "bg-orange-500";
        if (totalScheduled > 35) color = "bg-red-500";

        const card = document.createElement('div');
        card.className = "teacher-card bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group relative";
        card.dataset.name = t.name + " " + (t.fullName || "");

        card.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-lg font-bold text-indigo-600">
                        ${t.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h3 class="font-bold text-gray-800 text-sm leading-tight">${t.name}</h3>
                        <p class="text-[10px] text-gray-500 uppercase font-bold">${t.fullName || 'Sin nombre completo'}</p>
                    </div>
                </div>
                <button class="btn-edit opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-indigo-600">✏️</button>
            </div>
            
            <div class="space-y-2">
                <div class="flex justify-between items-end text-xs">
                    <span class="text-gray-500 font-bold">Carga Total</span>
                    <span class="font-mono font-bold text-gray-700">${totalScheduled}h</span>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div class="${color} h-full rounded-full" style="width: ${pct}%"></div>
                </div>
                
                <div class="flex justify-between items-center pt-2 border-t border-dashed">
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Asesorías</span>
                    <div class="flex items-center gap-1 text-xs">
                        <span class="${advisoryScheduled >= advisoryGoal ? 'text-green-600' : 'text-orange-500'} font-bold">${advisoryScheduled}h</span>
                        <span class="text-gray-300">/</span>
                        <span class="text-gray-400">${advisoryGoal}h</span>
                    </div>
                </div>
            </div>

            <button class="absolute -top-2 -right-2 bg-white text-red-500 rounded-full w-6 h-6 shadow border opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-red-50 transition-all btn-del scale-75 hover:scale-100">×</button>
        `;

        card.querySelector('.btn-edit').onclick = () => showTeacherForm(t);
        card.querySelector('.btn-del').onclick = () => deleteDocWrapper('teachers', t.id);
        l.appendChild(card);
    });
}

// === LISTA GRUPOS (CARDS) ===
export function renderGroupsList() {
    const l = document.getElementById('groups-by-trimester'); if (!l) return;
    const container = l.parentElement; // #subtab-groups .bg-white...

    // Hide legacy inputs
    const oldInput = document.getElementById('group-number-input');
    if (oldInput) oldInput.parentElement.classList.add('hidden');

    renderStickyToolbar(container, "Buscar grupo...", (term) => {
        const cards = l.querySelectorAll('.group-card');
        term = term.toLowerCase();
        cards.forEach(c => {
            if (c.dataset.name.toLowerCase().includes(term)) c.classList.remove('hidden');
            else c.classList.add('hidden');
        });
    }, () => showGroupForm(), "Nuevo Grupo");

    l.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-1 pb-20 overflow-y-auto h-full content-start";
    l.innerHTML = '';

    state.groups.sort((a, b) => a.name.localeCompare(b.name)).forEach(g => {
        const hasStudents = state.students?.some(s => s.grupo === g.name); // Simple check

        const card = document.createElement('div');
        card.className = "group-card bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between h-32";
        card.dataset.name = g.name;

        card.innerHTML = `
            <div class="flex justify-between items-start">
                <h3 class="font-bold text-lg text-gray-800">${g.name}</h3>
                <span class="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-1 rounded">C${g.trimester}</span>
            </div>
            
            <div class="flex gap-2 mt-2">
                <button class="btn-view-std flex-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 py-1.5 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1">
                    👥 Alumnos
                </button>
                <div class="flex ml-auto">
                    <button class="btn-edit-grp w-8 flex items-center justify-center bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-indigo-600 rounded transition-colors rounded-r-none border-r border-white">✏️</button>
                    <button class="btn-del-grp w-8 flex items-center justify-center bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 rounded rounded-l-none">×</button>
                </div>
            </div>
        `;

        card.querySelector('.btn-view-std').onclick = () => showGroupStudents(g);
        card.querySelector('.btn-edit-grp').onclick = () => showGroupForm(g);
        card.querySelector('.btn-del-grp').onclick = () => deleteDocWrapper('groups', g.id);
        l.appendChild(card);
    });
}

export function renderClassroomsManageList() {
    const l = document.getElementById('classrooms-list-manage'); if (!l) return;
    const container = l.parentElement;

    // Hide legacy
    const oldInput = document.getElementById('classroom-name-input');
    if (oldInput) oldInput.parentElement.classList.add('hidden');

    renderStickyToolbar(container, "Buscar aula...", (term) => {
        const cards = l.querySelectorAll('.room-card');
        term = term.toLowerCase();
        cards.forEach(c => {
            if (c.dataset.name.toLowerCase().includes(term)) c.classList.remove('hidden');
            else c.classList.add('hidden');
        });
    }, () => showClassroomForm(), "Nueva Aula");

    l.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto pr-2 content-start p-1";
    l.innerHTML = state.classrooms.map(c => `
        <div class="room-card bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all group relative flex items-center gap-4" data-name="${c.name}">
            <div class="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center text-2xl">
                ${c.icon || '🏫'}
            </div>
            <div class="flex-1">
                <h3 class="font-bold text-gray-800 leading-tight">${c.name}</h3>
                <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">${c.type === 'office' ? 'Oficina' : 'Aula'}</p>
            </div>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 bg-white/90 backdrop-blur rounded p-1 shadow-sm">
                <button class="btn-edit-room w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded text-xs">✏️</button>
                <button class="btn-del-room w-6 h-6 flex items-center justify-center hover:bg-red-100 text-red-500 rounded text-xs">×</button>
            </div>
        </div>
    `).join('');

    l.querySelectorAll('.btn-edit-room').forEach((btn, i) => btn.onclick = () => showClassroomForm(state.classrooms[i]));
    l.querySelectorAll('.btn-del-room').forEach((btn, i) => btn.onclick = () => deleteDocWrapper('classrooms', state.classrooms[i].id));
}

// === AUDITORÍA INTELIGENTE ===
export function renderAlerts() {
    const container = document.getElementById('alerts-container'); if (!container) return;
    container.innerHTML = ''; container.className = "flex flex-wrap gap-2";
    state.groups.forEach(g => {
        const required = state.subjects.filter(s => s.trimester === g.trimester);
        const assigned = state.schedule.filter(c => c.groupId === g.id && c.type !== 'advisory').map(c => c.subjectId);
        const missing = required.filter(s => !assigned.includes(s.id));
        if (missing.length > 0) {
            const el = document.createElement('div');
            el.className = "cursor-pointer hover:bg-orange-100 transition-colors border border-orange-200 bg-white rounded-full px-3 py-1 text-xs flex items-center gap-2 shadow-sm select-none";
            el.innerHTML = `<span class="font-bold text-gray-700">${g.name}</span><span class="bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold text-[10px] min-w-[20px] text-center">${missing.length}</span>`;
            el.onclick = () => showAuditModal(g, missing);
            container.appendChild(el);
        }
    });
    if (container.children.length === 0) container.innerHTML = `<div class="w-full text-center text-xs text-gray-400 italic py-4">🎉 Todo perfecto. No faltan materias.</div>`;
}

function showAuditModal(group, missingSubjects) {
    const modal = document.getElementById('modal'); const content = document.getElementById('modal-content'); modal.classList.remove('hidden');
    let html = `<div class="p-6 bg-white max-h-[80vh] overflow-y-auto"><div class="flex justify-between items-center mb-4"><h2 class="text-xl font-bold text-gray-800">Materias Faltantes: <span class="text-indigo-600">${group.name}</span></h2><button id="close-audit" class="text-gray-400 hover:text-gray-600 font-bold text-xl">×</button></div><p class="text-sm text-gray-500 mb-6">Sugerencias inteligentes:</p><div class="space-y-4">`;
    missingSubjects.forEach(sub => {
        const suggestions = findSmartSlots(sub, group);
        html += `<div class="border rounded-lg p-4 bg-gray-50"><div class="flex justify-between items-center mb-2"><h3 class="font-bold text-gray-700">${sub.name}</h3><span class="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">${state.teachers.find(t => t.id === sub.defaultTeacherId)?.name || 'Sin Docente'}</span></div>${suggestions.length > 0 ? `<div class="grid grid-cols-1 gap-2">${suggestions.map(s => `<div class="flex justify-between items-center bg-white border px-3 py-2 rounded text-sm hover:border-green-400 transition-colors group"><div class="flex items-center gap-2"><span class="font-bold text-gray-600 w-20">${s.day}</span><span class="text-gray-500 bg-gray-100 px-2 rounded">${s.start}:00 - ${s.end}:00</span><span class="text-xs text-gray-400 ml-2">(${s.room?.name || 'Cualquier Aula'})</span></div><button class="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-bold hover:bg-green-600 hover:text-white transition-colors" onclick='window.applySuggestion("${sub.id}", "${group.id}", "${s.teacherId || ""}", "${s.room?.id || ""}", "${s.day}", ${s.start}, ${s.end})'>Agendar</button></div>`).join('')}</div>` : `<div class="text-xs text-red-400 italic">No hay huecos compatibles.</div>`}</div>`;
    });
    html += `</div></div>`; content.innerHTML = html; document.getElementById('close-audit').onclick = () => modal.classList.add('hidden');
}

window.applySuggestion = async (subId, grpId, teachId, roomId, day, start, dur) => {
    try {
        const payload = { type: 'class', subjectId: subId, groupId: grpId, teacherId: teachId || null, classroomId: roomId || null, day: day, startTime: parseInt(start), duration: parseInt(dur - start) };
        await addDoc(collections.schedule, payload); document.getElementById('modal').classList.add('hidden');
    } catch (e) { console.error(e); alert("Error al agendar."); }
};

function findSmartSlots(subject, group) {
    const suggestions = []; const teacherId = subject.defaultTeacherId; const duration = 2;
    for (const d of days) {
        for (const h of timeSlots) {
            if (h + duration > Math.max(...timeSlots) + 1) continue;
            const groupBusy = state.schedule.some(c => c.groupId === group.id && c.day === d && !(c.startTime >= h + duration || c.startTime + c.duration <= h));
            const extBusy = state.external.some(e => e.groupId === group.id && e.day === d && !(e.start >= h + duration || e.end <= h));
            if (!groupBusy && !extBusy) {
                let teacherFree = true;
                if (teacherId) teacherFree = !state.schedule.some(c => c.teacherId === teacherId && c.day === d && !(c.startTime >= h + duration || c.startTime + c.duration <= h));
                if (teacherFree) {
                    const freeRoom = state.classrooms.find(r => !state.schedule.some(c => c.classroomId === r.id && c.day === d && !(c.startTime >= h + duration || c.startTime + c.duration <= h)));
                    if (freeRoom) { suggestions.push({ day: d, start: h, end: h + duration, teacherId: teacherId, room: freeRoom }); if (suggestions.length >= 3) return suggestions; }
                }
            }
        }
    }
    return suggestions;
}

// === MAPA DE CALOR DE AULAS (NUEVO) ===
export function renderRoomHeatmap() {
    const container = document.getElementById('room-heatmap-container');
    if (!container) return;
    container.innerHTML = '';

    // Configuración: 14 horas * 5 días = 70 horas semanales disponibles por aula
    const TOTAL_HOURS_WEEK = 70;

    const data = state.classrooms.map(room => {
        // Sumar duración de todas las clases en esta aula
        const hoursUsed = state.schedule
            .filter(c => c.classroomId === room.id)
            .reduce((acc, c) => acc + c.duration, 0);

        const pct = Math.min((hoursUsed / TOTAL_HOURS_WEEK) * 100, 100).toFixed(1);
        return { ...room, hoursUsed, pct };
    }).sort((a, b) => b.hoursUsed - a.hoursUsed); // Ordenar por ocupación

    // Renderizar
    const wrapper = document.createElement('div');
    wrapper.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";

    data.forEach(d => {
        let color = "bg-green-500";
        let status = "Libre";
        let textCol = "text-green-600";

        if (d.hoursUsed > 20) { color = "bg-blue-500"; status = "Estable"; textCol = "text-blue-600"; }
        if (d.hoursUsed > 40) { color = "bg-orange-500"; status = "Alto"; textCol = "text-orange-600"; }
        if (d.hoursUsed > 55) { color = "bg-red-500"; status = "Saturado"; textCol = "text-red-600"; }

        const card = document.createElement('div');
        card.className = "bg-white border rounded-lg p-4 shadow-sm flex flex-col gap-2";
        card.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <h3 class="font-bold text-gray-700">${d.name}</h3>
                <span class="text-xs font-bold ${textCol} bg-gray-50 px-2 py-1 rounded border">${status}</span>
            </div>
            <div class="flex justify-between text-xs text-gray-500">
                <span>${d.hoursUsed} hrs ocupadas</span>
                <span>${d.pct}%</span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div class="${color} h-full rounded-full transition-all" style="width: ${d.pct}%"></div>
            </div>
        `;
        wrapper.appendChild(card);
    });

    container.appendChild(wrapper);
}

// === PANELES Y OTROS ===
export function renderExternalClassesPanel() {
    const list = document.getElementById('external-list'); if (!list) return; list.innerHTML = '';
    state.external.forEach(ext => {
        const grp = state.groups.find(g => g.id === ext.groupId)?.name || '???';
        const item = document.createElement('div'); item.className = "border rounded p-3 bg-white flex justify-between items-center shadow-sm"; item.innerHTML = `<div><div class="font-bold text-sm text-gray-700">${ext.type} - ${grp}</div><div class="text-xs text-gray-500">${ext.day}, ${ext.start}:00 - ${ext.end}:00</div></div><button class="text-red-500 hover:text-red-700 font-bold px-2">×</button>`; item.querySelector('button').onclick = () => deleteDocWrapper('external', ext.id); list.appendChild(item);
    });
    const grpSel = document.getElementById('ext-group'); if (grpSel && grpSel.children.length === 0) state.groups.forEach(g => grpSel.add(new Option(g.name, g.id)));
    const daySel = document.getElementById('ext-day'); if (daySel && daySel.children.length === 0) days.forEach(d => daySel.add(new Option(d, d)));
    const fillTime = (id) => { const el = document.getElementById(id); if (el && el.children.length === 0) timeSlots.forEach(t => el.add(new Option(`${t}:00`, t))); }; fillTime('ext-start'); fillTime('ext-end');
    const btnAdd = document.getElementById('btn-add-external'); if (btnAdd) btnAdd.onclick = addExternalRule;
}

export function renderGlobalMatrix() {
    const container = document.getElementById('sabana-container');
    const filterEl = document.getElementById('sabana-day-filter');
    if (!container || !filterEl) return;
    const dayFilter = filterEl.value;
    container.innerHTML = '';
    const table = document.createElement('table'); table.className = "w-full border-collapse border border-gray-300 text-xs";
    const thead = document.createElement('thead'); const headerRow = document.createElement('tr'); headerRow.innerHTML = `<th class="bg-gray-100 border p-2 sticky left-0 z-10 w-24">Grupo</th>`; timeSlots.forEach(t => { headerRow.innerHTML += `<th class="bg-gray-50 border p-2 min-w-[80px]">${t}:00</th>`; }); thead.appendChild(headerRow); table.appendChild(thead);
    const tbody = document.createElement('tbody');
    [...state.groups].sort((a, b) => a.name.localeCompare(b.name)).forEach(grp => {
        const tr = document.createElement('tr'); const tdName = document.createElement('td'); tdName.className = "bg-gray-100 border p-2 font-bold sticky left-0 z-10"; tdName.innerText = grp.name; tr.appendChild(tdName);
        timeSlots.forEach(t => {
            const td = document.createElement('td'); td.className = "border p-1 h-12 align-top relative";
            const cls = state.schedule.find(c => c.groupId === grp.id && c.day === dayFilter && c.startTime <= t && (c.startTime + c.duration) > t && c.type !== 'advisory');
            const ext = state.external.find(e => e.groupId === grp.id && e.day === dayFilter && e.start <= t && e.end > t);
            if (cls) { const subj = state.subjects.find(s => s.id === cls.subjectId); if (cls.startTime === t) { td.className += " bg-indigo-50 border-l-2 border-l-indigo-500"; td.innerHTML = `<div class="font-bold text-indigo-800 leading-tight truncate">${subj ? subj.name : '?'}</div>`; } else { td.className += " bg-indigo-50"; } }
            else if (ext) { td.className += " bg-slate-100 opacity-60"; if (ext.start === t) td.innerHTML = `<div class="text-[9px] text-gray-500 font-bold tracking-wider">${ext.type}</div>`; } tr.appendChild(td);
        }); tbody.appendChild(tr);
    }); table.appendChild(tbody); container.appendChild(table);
}

export function renderFilterOptions() {
    const fill = (id, arr, l) => { const el = document.getElementById(id); if (el) { const v = el.value; el.innerHTML = `<option value="">${l}</option>` + arr.map(i => `<option value="${i.id}">${i.name}</option>`).join(''); el.value = v; } };
    fill('filter-teacher', state.teachers, 'Todos los Docentes'); fill('filter-group', state.groups, 'Todos los Grupos');
    const tSelect = document.getElementById('filter-trimester'); const sSelect = document.getElementById('filter-shift');
    if (tSelect) {
        const currentVal = tSelect.value; const shiftVal = sSelect ? sSelect.value : ""; const cutoff = state.settings.shiftCutoff || 4;
        tSelect.innerHTML = '<option value="">Todos los Cuatris</option>';
        for (let i = 1; i <= 10; i++) { let shouldShow = true; if (shiftVal === 'matutino' && i >= cutoff) shouldShow = false; if (shiftVal === 'vespertino' && i < cutoff) shouldShow = false; if (shouldShow) tSelect.add(new Option(`C${i}`, i)); }
        if ([...tSelect.options].some(o => o.value == currentVal)) tSelect.value = currentVal; else tSelect.value = "";
    }
}

export function renderVersion() {
    const v = document.createElement('div');
    v.className = "fixed bottom-1 left-1 text-[10px] text-gray-300 pointer-events-none z-50 font-mono";
    v.innerText = "v1.4.0 (Colors + UI)";
    document.body.appendChild(v);
}
export function createTooltip() { const tooltipEl = document.createElement('div'); tooltipEl.id = 'custom-tooltip'; document.body.appendChild(tooltipEl); document.addEventListener('mousemove', e => { if (tooltipEl.classList.contains('visible')) { tooltipEl.style.left = (e.clientX + 15) + 'px'; tooltipEl.style.top = (e.clientY + 15) + 'px'; } }); }
export function showTooltip(html) { const t = document.getElementById('custom-tooltip'); t.innerHTML = html; t.classList.add('visible'); }
export function hideTooltip() { document.getElementById('custom-tooltip').classList.remove('visible'); }
export function renderSubjectsList() {
    // 2. Sidebar Link (Drag & Drop Mode) - unassigned-subjects-container
    const sidebarC = document.getElementById('unassigned-subjects-container');
    if (sidebarC) {
        // Ensure Header (Search + Toggle) exists
        if (!document.getElementById('sidebar-controls')) {
            sidebarC.parentElement.querySelector('.bg-gray-50').insertAdjacentHTML('afterend', `
                <div id="sidebar-controls" class="px-2 py-2 border-b border-gray-100 bg-white">
                    <input id="sidebar-search" placeholder="🔍 Filtrar materias..." class="w-full border p-1.5 rounded text-xs bg-gray-50 mb-2 focus:ring-1 focus:ring-indigo-200 outline-none">
                    <label class="flex items-center gap-2 text-xs font-bold text-gray-500 cursor-pointer select-none">
                        <input type="checkbox" id="toggle-completed" class="rounded text-indigo-600 focus:ring-0">
                        Ocultar completas
                    </label>
                </div>
            `);

            // Bind events
            document.getElementById('sidebar-search').addEventListener('input', () => renderSubjectsList());
            document.getElementById('toggle-completed').addEventListener('change', () => renderSubjectsList());
        }

        sidebarC.innerHTML = '';
        const filterGroup = document.getElementById('filter-group')?.value;
        const filterTerm = document.getElementById('sidebar-search')?.value.toLowerCase();
        const hideCompleted = document.getElementById('toggle-completed')?.checked;

        // Group Subjects by Trimester
        const grouped = {};
        state.subjects.forEach(s => {
            const t = s.trimester || 0;
            if (!grouped[t]) grouped[t] = [];
            grouped[t].push(s);
        });

        Object.keys(grouped).sort((a, b) => Number(a) - Number(b)).forEach(t => {
            const subjectsInTrim = grouped[t];

            // Logic to check visibility based on search & completion
            const visibleSubjects = subjectsInTrim.filter(s => {
                // 1. Search Filter
                if (filterTerm && !s.name.toLowerCase().includes(filterTerm)) return false;

                // 2. Hour Calculation
                const weeklyTarget = s.weeklyHours || 4; // Default to 4 if not set
                let assignedHours = 0;

                if (filterGroup) {
                    // Count hours for this subject AND this specific group
                    assignedHours = state.schedule
                        .filter(c => c.subjectId === s.id && c.groupId === filterGroup && c.type === 'class')
                        .reduce((acc, c) => acc + c.duration, 0);
                } else {
                    // If no group selected, maybe show total? Or just 0?
                    // Decision: Show 0 or global total. Let's show global total for "general overview" 
                    // but it might be confusing. Let's stick to 0 if no group is selected to encourage selecting a group.
                    // ACTUALLY: The user usually selects a group to work.
                    // Providing a "Generic" view:
                    assignedHours = 0; // Reset
                }

                s._tempHours = assignedHours; // Store for rendering
                s._tempTarget = weeklyTarget;
                s._isComplete = assignedHours >= weeklyTarget;

                // 3. Hide Completed Filter
                if (hideCompleted && s._isComplete) return false;

                return true;
            });

            if (visibleSubjects.length === 0) return; // Skip empty trimesters

            const details = document.createElement('details');
            details.className = "trimester-group";
            details.open = true;
            details.innerHTML = `<summary>Cuatri ${t} <span class="text-[10px] text-gray-400 font-normal ml-auto mr-2">${visibleSubjects.length} mat.</span></summary><div class="content"></div>`;

            visibleSubjects.forEach(s => {
                const el = document.createElement('div');
                const isComplete = s._isComplete && filterGroup; // Only visually complete if we are in a group context

                el.className = `draggable-subject ${isComplete ? 'completed' : ''}`;
                el.draggable = true;
                el.style.borderLeftColor = s.color || '#6366f1';

                // Progress Bar Width
                const pct = Math.min((s._tempHours / s._tempTarget) * 100, 100);
                let barClass = "subject-progress-fill";
                if (s._tempHours >= s._tempTarget) barClass += " complete";
                if (s._tempHours > s._tempTarget) barClass += " over";

                el.innerHTML = `
                    <div class="font-bold relative z-10">${s.name}</div>
                    ${filterGroup ? `
                        <div class="subject-meta relative z-10">
                            <span>${s._tempHours} / ${s._tempTarget} hrs</span>
                            ${isComplete ? '<span>✅</span>' : ''}
                        </div>
                        <div class="subject-progress-bg">
                            <div class="${barClass}" style="width: ${pct}%"></div>
                        </div>
                    ` : '<div class="text-[10px] text-gray-400 mt-1">Selecciona un grupo</div>'}
                `;

                el.addEventListener('dragstart', (e) => {
                    hideTooltip();
                    window.currentDrag = { type: 'subject', id: s.id, duration: 2 };
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'subject', id: s.id }));
                });
                el.addEventListener('dragend', () => { window.currentDrag = null; });
                details.querySelector('.content').appendChild(el);
            });
            sidebarC.appendChild(details);
        });
    }

    // 2. Management List (Edit Mode) - subjects-by-trimester
    const manageC = document.getElementById('subjects-by-trimester');
    if (manageC) {
        // Ensure Search Input Exists
        let searchInput = document.getElementById('sub-manage-search');
        let listContent = document.getElementById('sub-manage-content');

        // If the container was cleared or doesn't have our structure yet
        if (!searchInput || !manageC.contains(searchInput)) {
            manageC.innerHTML = `
                <div class="sticky top-0 bg-white z-10 pb-2 border-b mb-2 pt-1">
                    <input type="text" id="sub-manage-search" placeholder="🔍 Buscar materia..." class="w-full border p-2 rounded text-xs bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-200 outline-none transition-all">
                </div>
                <div id="sub-manage-content" class="space-y-2"></div>
            `;
            searchInput = document.getElementById('sub-manage-search');
            listContent = document.getElementById('sub-manage-content');

            searchInput.addEventListener('input', (e) => {
                renderManagerSubjects(listContent, e.target.value);
            });
        }

        // Render with current filter
        renderManagerSubjects(listContent, searchInput.value);
    }
}

function renderManagerSubjects(container, filterText) {
    if (!container) return;
    container.innerHTML = '';
    const norm = (str) => (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const term = norm(filterText);

    const grouped = {};
    state.subjects.forEach(s => {
        if (term && !norm(s.name).includes(term)) return;
        const t = s.trimester || 0;
        if (!grouped[t]) grouped[t] = [];
        grouped[t].push(s);
    });

    if (Object.keys(grouped).length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 text-xs py-4 italic">No se encontraron materias.</div>`;
        return;
    }

    Object.keys(grouped).sort((a, b) => Number(a) - Number(b)).forEach(t => {
        const div = document.createElement('div');
        div.className = "bg-gray-50 border p-2 rounded";
        div.innerHTML = `<h3 class="font-bold text-xs mb-1 text-gray-500 uppercase tracking-wider">C${t}</h3>`;
        grouped[t].forEach(s => {
            const row = document.createElement('div');
            row.className = "flex justify-between items-center text-xs border-b p-1 hover:bg-white transition-colors group";
            row.innerHTML = `<span class="truncate pr-1" title="${s.name}">${s.name}</span><button class="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold px-1" onclick="window.editSub('${s.id}')">✎</button>`;
            div.appendChild(row);
        });
        container.appendChild(div);
    });
    window.editSub = (id) => showSubjectForm(state.subjects.find(s => s.id === id));
}
function showGroupStudents(group) {
    const modal = document.getElementById('modal');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');

    // Filter students by normalized group name
    const targetName = group.name.replace(/-/g, '').replace(/\s/g, '').toUpperCase();
    const groupStudents = state.students.filter(s =>
        (s.grupo && s.grupo.replace(/-/g, '').replace(/\s/g, '').toUpperCase() === targetName) ||
        (s.grupoId === group.id) // Fallback if we start using IDs
    ).sort((a, b) => a.nombre.localeCompare(b.nombre));

    // Form HTML for adding student
    const addFormHtml = `
        <div id="add-student-form" class="mb-4 bg-gray-50 p-3 rounded border hidden">
            <h3 class="text-xs font-bold text-gray-500 uppercase mb-2">Agregar Alumno Manualmente</h3>
            <div class="flex gap-2">
                <input id="new-std-mat" placeholder="Matrícula" class="border p-2 rounded text-sm w-1/3">
                <input id="new-std-name" placeholder="Nombre Completo" class="border p-2 rounded text-sm flex-1">
                <button id="btn-save-new-std" class="bg-indigo-600 text-white px-3 py-2 rounded text-sm font-bold">Guardar</button>
            </div>
        </div>
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold">Grupo: ${group.name} <span class="text-sm font-normal text-gray-500">(${groupStudents.length} alumnos)</span></h2>
            <button id="btn-toggle-add-std" class="bg-green-600 text-white px-3 py-1 rounded text-sm font-bold hover:bg-green-700 transition">Reference + Alumno</button>
        </div>
    `;

    // Table HTML
    const tableHtml = `
        <div class="max-h-[60vh] overflow-y-auto border rounded">
            <table class="w-full text-left text-sm">
                <thead class="bg-gray-100 sticky top-0">
                    <tr>
                        <th class="p-2 border-b">Matrícula</th>
                        <th class="p-2 border-b">Nombre</th>
                    </tr>
                </thead>
                <tbody class="divide-y">
                    ${groupStudents.length > 0 ? groupStudents.map(s => `
                        <tr class="hover:bg-gray-50 group">
                            <td class="p-2 font-mono text-gray-600">${s.matricula}</td>
                            <td class="p-2 text-gray-800 font-medium flex justify-between items-center bg-transparent">
                                <span>${s.nombre}</span>
                                <button class="btn-del-std opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 px-2 font-bold transition-opacity" data-id="${s.matricula}">×</button>
                            </td>
                        </tr>
                    `).join('') : `<tr><td colspan="2" class="p-8 text-center text-gray-400">No hay alumnos en la lista actual.</td></tr>`}
                </tbody>
            </table>
        </div>
    `;

    content.innerHTML = `<div class="p-6 bg-white">${addFormHtml}${tableHtml}<div class="mt-4 text-right"><button onclick="document.getElementById('modal').classList.add('hidden')" class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded font-bold">Cerrar</button></div></div>`;

    // Event Listeners
    setTimeout(() => {
        const toggleBtn = document.getElementById('btn-toggle-add-std');
        const formDiv = document.getElementById('add-student-form');
        const saveBtn = document.getElementById('btn-save-new-std');

        // Delete Handler
        content.querySelectorAll('.btn-del-std').forEach(btn => {
            btn.onclick = () => {
                const mat = btn.dataset.id;

                showConfirmModal(
                    'Eliminar Alumno',
                    `¿Seguro que deseas eliminar al alumno con matrícula ${mat}?`,
                    async () => {
                        try {
                            // 1. Update State
                            state.students = state.students.filter(s => s.matricula !== mat);

                            // 2. Persist to Firestore Group
                            const currentGroupDocs = group.students || [];
                            const updatedStudents = currentGroupDocs.filter(s => s.matricula !== mat && s.id !== mat);

                            // Update Group in Firestore
                            const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js");
                            await updateDoc(doc(collections.groups, group.id), { students: updatedStudents });

                            // Update Local Group State
                            group.students = updatedStudents;

                            showGroupStudents(group); // Reload modal
                        } catch (e) {
                            console.error(e);
                            alert("Error al eliminar alumno.");
                        }
                    }
                );
            };
        });

        if (toggleBtn) toggleBtn.onclick = () => formDiv.classList.toggle('hidden');

        if (saveBtn) saveBtn.onclick = async () => {
            const mat = document.getElementById('new-std-mat').value.trim();
            const nom = document.getElementById('new-std-name').value.trim();

            if (!mat || !nom) return alert("Ingresa matrícula y nombre.");

            try {
                // 1. Update State
                const newStudent = { matricula: mat, nombre: nom.toUpperCase(), grupo: group.name, grupoId: group.id };
                state.students.push(newStudent);

                // 2. Persist to Firestore Group
                const currentGroupDocs = group.students || [];
                const updatedStudents = [...currentGroupDocs, { id: mat, matricula: mat, name: nom.toUpperCase() }]; // Align with TestListasv2 format if needed

                // Update Group in Firestore
                const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js");
                await updateDoc(doc(collections.groups, group.id), { students: updatedStudents });

                // Update Local Group State
                group.students = updatedStudents;

                alert("Alumno agregado correctamente.");
                showGroupStudents(group); // Reload modal
            } catch (e) {
                console.error(e);
                alert("Error al guardar alumno.");
            }
        };
    }, 0);
}

// === COMMAND PALETTE (CTRL+K) ===
export function renderCommandPalette() {
    if (document.getElementById('cmd-palette-overlay')) return;

    // 1. Create UI
    const overlay = document.createElement('div');
    overlay.id = 'cmd-palette-overlay';
    overlay.className = "fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] hidden flex items-start justify-center pt-20 transition-all opacity-0";
    overlay.innerHTML = `
        <div class="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden transform scale-95 transition-all" id="cmd-palette-box">
            <div class="border-b p-4 flex items-center gap-3">
                <span class="text-xl">🔍</span>
                <input id="cmd-input" type="text" placeholder="Buscar materia, docente, grupo o comando... (Esc para salir)" 
                    class="w-full text-lg outline-none text-gray-700 placeholder-gray-400">
                <span class="text-xs text-gray-400 font-mono border px-2 py-1 rounded">ESC</span>
            </div>
            <div id="cmd-results" class="max-h-[60vh] overflow-y-auto p-2 space-y-1">
                <div class="text-center text-gray-400 py-8 text-sm">Empieza a escribir para buscar...</div>
            </div>
            <div class="bg-gray-50 px-4 py-2 text-[10px] text-gray-400 border-t flex justify-between">
                <span><strong>↑↓</strong> para navegar</span>
                <span><strong>Enter</strong> para seleccionar</span>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // 2. Logic
    const input = document.getElementById('cmd-input');
    const resultsContainer = document.getElementById('cmd-results');
    const box = document.getElementById('cmd-palette-box');

    const toggle = (show) => {
        if (show) {
            overlay.classList.remove('hidden');
            // Small timeout to allow removing hidden before transition
            setTimeout(() => {
                overlay.classList.remove('opacity-0');
                box.classList.remove('scale-95');
                input.focus();
            }, 10);
        } else {
            overlay.classList.add('opacity-0');
            box.classList.add('scale-95');
            setTimeout(() => overlay.classList.add('hidden'), 200);
            input.value = '';
            resultsContainer.innerHTML = '<div class="text-center text-gray-400 py-8 text-sm">Empieza a escribir para buscar...</div>';
        }
    };

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'k' || e.code === 'KeyK')) {
            e.preventDefault();
            const overlay = document.getElementById('cmd-palette-overlay');
            toggle(overlay.classList.contains('hidden')); // Pass true if hidden (to show it)
        }
        if (e.key === 'Escape' && !document.getElementById('cmd-palette-overlay').classList.contains('hidden')) {
            toggle(false);
        }
    });

    overlay.onclick = (e) => { if (e.target === overlay) toggle(false); };

    // Search Logic
    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (!term) {
            resultsContainer.innerHTML = '<div class="text-center text-gray-400 py-8 text-sm">Empieza a escribir para buscar...</div>';
            return;
        }

        const matches = [];

        // Search Teachers
        state.teachers.forEach(t => {
            if (t.name.toLowerCase().includes(term) || (t.fullName && t.fullName.toLowerCase().includes(term))) {
                matches.push({ type: 'Docente', icon: '👨‍🏫', name: t.name, sub: t.fullName, action: () => showTeacherForm(t) });
            }
        });

        // Search Subjects
        state.subjects.forEach(s => {
            if (s.name.toLowerCase().includes(term)) {
                matches.push({ type: 'Materia', icon: '📚', name: s.name, sub: `Cuatri ${s.trimester}`, action: () => showSubjectForm(s) });
            }
        });

        // Search Groups
        state.groups.forEach(g => {
            if (g.name.toLowerCase().includes(term)) {
                matches.push({ type: 'Grupo', icon: '👥', name: g.name, sub: `C${g.trimester}`, action: () => showGroupForm(g) });
            }
        });

        // Search Classrooms
        state.classrooms.forEach(c => {
            if (c.name.toLowerCase().includes(term)) {
                matches.push({ type: 'Aula', icon: '🏫', name: c.name, sub: 'Espacio físico', action: () => showClassroomForm(c) });
            }
        });

        renderResults(matches);
    });

    function renderResults(items) {
        if (items.length === 0) {
            resultsContainer.innerHTML = '<div class="text-center text-gray-400 py-4 text-sm">No se encontraron resultados.</div>';
            return;
        }

        resultsContainer.innerHTML = items.map((item, idx) => `
            <div class="cmd-item p-3 rounded-lg hover:bg-indigo-50 cursor-pointer flex items-center justify-between border border-transparent hover:border-indigo-100 transition-all group" data-idx="${idx}">
                <div class="flex items-center gap-3">
                    <span class="text-xl bg-gray-100 p-2 rounded-md group-hover:bg-white transition-colors">${item.icon}</span>
                    <div class="flex flex-col">
                        <span class="font-bold text-gray-800 text-sm">${item.name}</span>
                        <span class="text-xs text-gray-400">${item.type} • ${item.sub || ''}</span>
                    </div>
                </div>
                <span class="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 font-bold">↵ Enter</span>
            </div>
        `).join('');

        // Click Handling
        resultsContainer.querySelectorAll('.cmd-item').forEach((el, idx) => {
            el.onclick = () => {
                items[idx].action();
                toggle(false);
            };
        });
    }
}


export function addGroup() { const n = document.getElementById('group-number-input').value; if (n) addDoc(collections.groups, { name: `IAEV-${n}`, trimester: 1 }); }
export function addClassroom() { const n = document.getElementById('classroom-name-input').value; if (n) addDoc(collections.classrooms, { name: n }); }
