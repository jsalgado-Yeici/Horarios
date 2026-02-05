import { state, cols, days, timeSlots } from './state.js';
import {
    showTeacherForm, showSubjectForm, deleteDocWrapper, addExternalRule,
    saveSettings, showGroupForm, showClassroomForm
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

// === LISTA DOCENTES ===
export function renderTeachersList() {
    const l = document.getElementById('teachers-list'); if (!l) return; l.innerHTML = '';
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

        const advStatusColor = advisoryScheduled >= advisoryGoal ? "text-green-600" : "text-red-500";
        const advText = advisoryGoal > 0 ? `<span class="text-[9px] ${advStatusColor} font-bold ml-1" title="Asesorías: Programadas ${advisoryScheduled} / Meta ${advisoryGoal}">(Ases. ${advisoryScheduled}/${advisoryGoal}h)</span>` : '';
        const breakdownTitle = `Clases: ${classHours}h + Asesoría: ${advisoryScheduled}h (Meta Ases: ${advisoryGoal}h)`;

        const div = document.createElement('div');
        div.className = "p-2 border-b text-sm bg-white hover:bg-gray-50 flex flex-col gap-1";
        div.innerHTML = `<div class="flex justify-between items-center"><span class="font-bold text-gray-700 cursor-pointer truncate mr-2" title="${t.fullName || ''}">${t.name}</span><div class="flex gap-1 items-center"><div class="flex flex-col items-end leading-none mr-2"><span class="text-xs font-mono font-bold text-gray-700" title="${breakdownTitle}">${totalScheduled}h Totales</span>${advText}</div><button class="btn-edit text-blue-400 px-1 hover:text-blue-600">✎</button><button class="btn-del text-red-400 px-1 hover:text-red-600">×</button></div></div><div class="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden" title="${breakdownTitle}"><div class="${color} h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div></div>`;
        div.querySelector('.btn-edit').onclick = () => showTeacherForm(t);
        div.querySelector('.btn-del').onclick = () => deleteDocWrapper('teachers', t.id);
        l.appendChild(div);
    });
}

// === LISTAS GESTIÓN ===
export function renderGroupsList() {
    const l = document.getElementById('groups-by-trimester'); if (!l) return;
    l.innerHTML = state.groups.map(g => `<div class="p-2 border bg-white text-sm flex justify-between items-center group-item" data-id="${g.id}"><span>${g.name}</span><div class="flex gap-1"><button class="text-indigo-500 px-1 hover:text-indigo-700 btn-view-std" title="Ver Alumnos">👥</button><button class="text-blue-400 px-1 hover:text-blue-600 btn-edit-grp">✎</button><button class="text-red-400 px-1 hover:text-red-600 btn-del-grp">×</button></div></div>`).join('');
    l.querySelectorAll('.group-item').forEach(el => { const id = el.dataset.id; const g = state.groups.find(x => x.id === id); el.querySelector('.btn-view-std').onclick = () => showGroupStudents(g); el.querySelector('.btn-edit-grp').onclick = () => showGroupForm(g); el.querySelector('.btn-del-grp').onclick = () => deleteDocWrapper('groups', id); });
}

export function renderClassroomsManageList() {
    const l = document.getElementById('classrooms-list-manage'); if (!l) return;
    l.innerHTML = state.classrooms.map(c => `<div class="p-1 border-b text-xs flex justify-between items-center classroom-item" data-id="${c.id}"><span>${c.name}</span> <div class="flex gap-1"><button class="text-blue-400 hover:text-blue-600 btn-edit-room">✎</button><button class="text-red-500 hover:text-red-700 btn-del-room">x</button></div></div>`).join('');
    l.querySelectorAll('.classroom-item').forEach(el => { const id = el.dataset.id; const c = state.classrooms.find(x => x.id === id); el.querySelector('.btn-edit-room').onclick = () => showClassroomForm(c); el.querySelector('.btn-del-room').onclick = () => deleteDocWrapper('classrooms', id); });
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
    v.innerText = "v1.2.0 (Drag-Swap)";
    document.body.appendChild(v);
}
export function createTooltip() { const tooltipEl = document.createElement('div'); tooltipEl.id = 'custom-tooltip'; document.body.appendChild(tooltipEl); document.addEventListener('mousemove', e => { if (tooltipEl.classList.contains('visible')) { tooltipEl.style.left = (e.clientX + 15) + 'px'; tooltipEl.style.top = (e.clientY + 15) + 'px'; } }); }
export function showTooltip(html) { const t = document.getElementById('custom-tooltip'); t.innerHTML = html; t.classList.add('visible'); }
export function hideTooltip() { document.getElementById('custom-tooltip').classList.remove('visible'); }
export function renderSubjectsList() {
    // 1. Sidebar Link (Drag & Drop Mode) - unassigned-subjects-container
    const sidebarC = document.getElementById('unassigned-subjects-container');
    if (sidebarC) {
        sidebarC.innerHTML = '';
        const grouped = {};
        state.subjects.forEach(s => { const t = s.trimester || 0; if (!grouped[t]) grouped[t] = []; grouped[t].push(s); });
        Object.keys(grouped).sort((a, b) => Number(a) - Number(b)).forEach(t => {
            const details = document.createElement('details'); details.className = "trimester-group"; details.open = true;
            details.innerHTML = `<summary>Cuatri ${t}</summary><div class="content"></div>`;
            grouped[t].forEach(s => {
                const el = document.createElement('div'); el.className = "draggable-subject"; el.draggable = true; el.textContent = s.name;
                if (s.color) el.style.borderLeftColor = s.color;
                el.addEventListener('dragstart', (e) => {
                    hideTooltip();
                    // Populate global drag state for real-time validation in grid.js
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

    if (!state.students || state.students.length === 0) {
        content.innerHTML = `<div class="p-6 text-center"><h2 class="text-xl font-bold mb-4">Grupo: ${group.name}</h2><p class="text-gray-500">No hay alumnos cargados en el sistema (Memoria temporal vacía).</p><button onclick="document.getElementById('modal').classList.add('hidden')" class="mt-4 bg-gray-200 px-4 py-2 rounded">Cerrar</button></div>`;
        return;
    }

    // Filter students by normalized group name
    const targetName = group.name.replace(/-/g, '').replace(/\s/g, '').toUpperCase();
    const studentsInGroup = state.students.filter(s => {
        const sGroup = (s.grupo || '').replace(/-/g, '').replace(/\s/g, '').toUpperCase();
        return sGroup.includes(targetName) || targetName.includes(sGroup);
    });

    content.innerHTML = `
        <div class="p-6 bg-white flex flex-col h-[80vh]">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-gray-800">Grupo: <span class="text-indigo-600">${group.name}</span></h2>
                <div class="flex gap-2">
                    <span class="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                        👥 ${studentsInGroup.length}
                    </span>
                    <button onclick="document.getElementById('modal').classList.add('hidden')" class="text-gray-400 hover:text-gray-600 font-bold text-xl px-2">×</button>
                </div>
            </div>
            
            <div class="flex-1 overflow-y-auto border rounded-xl bg-gray-50 shadow-inner p-1">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-100 sticky top-0">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Matrícula</th>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${studentsInGroup.length > 0 ? studentsInGroup.map(s => `
                            <tr class="hover:bg-indigo-50 transition-colors">
                                <td class="px-4 py-2 whitespace-nowrap text-xs font-mono text-gray-500">${s.matricula || 'N/A'}</td>
                                <td class="px-4 py-2 whitespace-nowrap text-sm font-bold text-gray-700">${s.nombre}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="2" class="p-4 text-center text-gray-500 italic">No se encontraron alumnos coincidentes.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
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
