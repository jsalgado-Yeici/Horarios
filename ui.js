import { state, cols, days, timeSlots } from './state.js';
import { showTeacherForm, showSubjectForm, deleteDocWrapper, addExternalRule, saveSettings } from './actions.js';
import { addDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { cols as collections } from './state.js'; // Alias para uso interno

// === AJUSTES DE TURNO ===
export function renderSettings() {
    const input = document.getElementById('setting-shift-cutoff');
    if(input && state.settings.shiftCutoff) input.value = state.settings.shiftCutoff;
    const btn = document.getElementById('btn-save-settings');
    if(btn) btn.onclick = saveSettings;
}

// === LISTA DOCENTES (BARRA DE PROGRESO) ===
export function renderTeachersList() { 
    const l = document.getElementById('teachers-list'); if(!l) return; l.innerHTML = ''; 
    state.teachers.sort((a,b)=>a.name.localeCompare(b.name)).forEach(t => { 
        const hours = state.schedule.filter(c => c.teacherId === t.id).reduce((acc, c) => acc + c.duration, 0);
        const pct = Math.min((hours / 40) * 100, 100);
        let color = "bg-green-500"; if(hours > 20) color = "bg-yellow-500"; if(hours > 30) color = "bg-orange-500"; if(hours > 35) color = "bg-red-500";
        const div = document.createElement('div');
        div.className = "p-2 border-b text-sm bg-white hover:bg-gray-50 flex flex-col gap-1";
        div.innerHTML = `<div class="flex justify-between items-center"><span class="font-bold text-gray-700 cursor-pointer truncate mr-2" title="${t.fullName || ''}">${t.name}</span><div class="flex gap-1 items-center"><span class="text-xs font-mono font-bold text-gray-500 mr-2">${hours}h</span><button class="btn-edit text-blue-400 px-1">✎</button><button class="btn-del text-red-400 px-1">×</button></div></div><div class="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden"><div class="${color} h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div></div>`;
        div.querySelector('.btn-edit').onclick = () => showTeacherForm(t);
        div.querySelector('.btn-del').onclick = () => deleteDocWrapper('teachers', t.id);
        l.appendChild(div);
    }); 
}

// === AUDITORÍA INTELIGENTE ===
export function renderAlerts() {
    const container = document.getElementById('alerts-container'); 
    if(!container) return; 
    container.innerHTML = '';
    
    // Cambiamos a flex-wrap para que los elementos sean compactos
    container.className = "flex flex-wrap gap-2"; 

    state.groups.forEach(g => {
        const required = state.subjects.filter(s => s.trimester === g.trimester);
        const assigned = state.schedule.filter(c => c.groupId === g.id).map(c => c.subjectId);
        const missing = required.filter(s => !assigned.includes(s.id));
        
        if (missing.length > 0) {
            const el = document.createElement('div');
            // Diseño "Chip" compacto y clicable
            el.className = "cursor-pointer hover:bg-orange-100 transition-colors border border-orange-200 bg-white rounded-full px-3 py-1 text-xs flex items-center gap-2 shadow-sm select-none";
            el.innerHTML = `
                <span class="font-bold text-gray-700">${g.name}</span>
                <span class="bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold text-[10px] min-w-[20px] text-center">${missing.length}</span>
            `;
            el.onclick = () => showAuditModal(g, missing);
            container.appendChild(el);
        }
    });

    if(container.children.length === 0) {
        container.innerHTML = `<div class="w-full text-center text-xs text-gray-400 italic py-4">🎉 Todo perfecto. No faltan materias.</div>`;
    }
}

// === MODAL DE SUGERENCIAS ===
function showAuditModal(group, missingSubjects) {
    const modal = document.getElementById('modal');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');

    let html = `
        <div class="p-6 bg-white max-h-[80vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-gray-800">Materias Faltantes: <span class="text-indigo-600">${group.name}</span></h2>
                <button id="close-audit" class="text-gray-400 hover:text-gray-600 font-bold text-xl">×</button>
            </div>
            <p class="text-sm text-gray-500 mb-6">El sistema ha analizado los huecos disponibles para el grupo, el docente y las aulas.</p>
            <div class="space-y-4">
    `;

    missingSubjects.forEach(sub => {
        // Algoritmo de Sugerencia
        const suggestions = findSmartSlots(sub, group);
        
        html += `
            <div class="border rounded-lg p-4 bg-gray-50">
                <div class="flex justify-between items-center mb-2">
                    <h3 class="font-bold text-gray-700">${sub.name}</h3>
                    <span class="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">${state.teachers.find(t=>t.id===sub.defaultTeacherId)?.name || 'Sin Docente Default'}</span>
                </div>
                
                ${suggestions.length > 0 ? `
                    <div class="grid grid-cols-1 gap-2">
                        ${suggestions.map(s => `
                            <div class="flex justify-between items-center bg-white border px-3 py-2 rounded text-sm hover:border-green-400 transition-colors group">
                                <div class="flex items-center gap-2">
                                    <span class="font-bold text-gray-600 w-20">${s.day}</span>
                                    <span class="text-gray-500 bg-gray-100 px-2 rounded">${s.start}:00 - ${s.end}:00</span>
                                    <span class="text-xs text-gray-400 ml-2">(${s.room?.name || 'Cualquier Aula'})</span>
                                </div>
                                <button class="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-bold hover:bg-green-600 hover:text-white transition-colors"
                                    onclick='window.applySuggestion("${sub.id}", "${group.id}", "${s.teacherId || ""}", "${s.room?.id || ""}", "${s.day}", ${s.start}, ${s.end})'>
                                    Agendar
                                </button>
                            </div>
                        `).join('')}
                    </div>
                ` : `<div class="text-xs text-red-400 italic">No se encontraron huecos compatibles (Conflicto total de Docente/Grupo).</div>`}
            </div>
        `;
    });

    html += `</div></div>`;
    content.innerHTML = html;

    document.getElementById('close-audit').onclick = () => modal.classList.add('hidden');
}

// Función global para que el botón generado en HTML string funcione
window.applySuggestion = async (subId, grpId, teachId, roomId, day, start, dur) => {
    try {
        const payload = {
            subjectId: subId, groupId: grpId, teacherId: teachId || null, classroomId: roomId || null,
            day: day, startTime: parseInt(start), duration: parseInt(dur - start)
        };
        await addDoc(collections.schedule, payload);
        
        // Feedback visual rápido
        const modal = document.getElementById('modal');
        const countBadge = document.querySelector(`span[class*="bg-orange-500"]`); // Hack visual simple
        if(countBadge) countBadge.innerText = parseInt(countBadge.innerText) - 1;
        
        // Cerrar si era el último? Mejor refrescar la vista.
        // Forzamos cierre para ver cambios
        modal.classList.add('hidden');
    } catch(e) { console.error(e); alert("Error al agendar."); }
};

function findSmartSlots(subject, group) {
    const suggestions = [];
    const teacherId = subject.defaultTeacherId;
    const duration = 2; // Asumimos bloques de 2 horas por defecto para sugerencias

    // Recorremos todos los días y horas
    for (const d of days) {
        for (const h of timeSlots) {
            if (h + duration > Math.max(...timeSlots) + 1) continue; // No exceder fin del día

            // 1. Verificar si GRUPO está libre
            const groupBusy = state.schedule.some(c => c.groupId === group.id && c.day === d && !(c.startTime >= h + duration || c.startTime + c.duration <= h));
            const extBusy = state.external.some(e => e.groupId === group.id && e.day === d && !(e.start >= h + duration || e.end <= h));
            
            if (!groupBusy && !extBusy) {
                // 2. Verificar si DOCENTE (si existe default) está libre
                let teacherFree = true;
                if (teacherId) {
                    teacherFree = !state.schedule.some(c => c.teacherId === teacherId && c.day === d && !(c.startTime >= h + duration || c.startTime + c.duration <= h));
                }

                if (teacherFree) {
                    // 3. Buscar UN AULA libre (Cualquiera sirve para sugerir)
                    const freeRoom = state.classrooms.find(r => {
                         return !state.schedule.some(c => c.classroomId === r.id && c.day === d && !(c.startTime >= h + duration || c.startTime + c.duration <= h));
                    });

                    if (freeRoom) {
                        suggestions.push({
                            day: d, start: h, end: h + duration,
                            teacherId: teacherId, room: freeRoom
                        });
                        if (suggestions.length >= 3) return suggestions; // Max 3 sugerencias por materia
                    }
                }
            }
        }
    }
    return suggestions;
}

// === FILTROS INTELIGENTES ===
export function renderFilterOptions() { 
    const fill = (id, arr, l) => { const el = document.getElementById(id); if(el) { const v=el.value; el.innerHTML = `<option value="">${l}</option>`+arr.map(i=>`<option value="${i.id}">${i.name}</option>`).join(''); el.value=v; }}; 
    fill('filter-teacher', state.teachers, 'Todos los Docentes'); 
    fill('filter-group', state.groups, 'Todos los Grupos'); 

    const tSelect = document.getElementById('filter-trimester'); 
    const sSelect = document.getElementById('filter-shift');
    
    if(tSelect) { 
        const currentVal = tSelect.value; 
        const shiftVal = sSelect ? sSelect.value : "";
        const cutoff = state.settings.shiftCutoff || 4; 

        tSelect.innerHTML = '<option value="">Todos los Cuatris</option>';
        for(let i=1; i<=10; i++) {
            let shouldShow = true;
            if (shiftVal === 'matutino' && i >= cutoff) shouldShow = false; 
            if (shiftVal === 'vespertino' && i < cutoff) shouldShow = false; 
            if (shouldShow) tSelect.add(new Option(`C${i}`, i));
        }
        if ([...tSelect.options].some(o => o.value == currentVal)) tSelect.value = currentVal; else tSelect.value = "";
    } 
}

// === PANELES Y OTROS ===
export function renderExternalClassesPanel() {
    const list = document.getElementById('external-list'); if(!list) return; list.innerHTML = '';
    state.external.forEach(ext => {
        const grp = state.groups.find(g=>g.id===ext.groupId)?.name || '???';
        const item = document.createElement('div');
        item.className = "border rounded p-3 bg-white flex justify-between items-center shadow-sm";
        item.innerHTML = `<div><div class="font-bold text-sm text-gray-700">${ext.type} - ${grp}</div><div class="text-xs text-gray-500">${ext.day}, ${ext.start}:00 - ${ext.end}:00</div></div><button class="text-red-500 hover:text-red-700 font-bold px-2">×</button>`;
        item.querySelector('button').onclick = () => deleteDocWrapper('external', ext.id);
        list.appendChild(item);
    });
    const grpSel = document.getElementById('ext-group'); if(grpSel && grpSel.children.length === 0) state.groups.forEach(g => grpSel.add(new Option(g.name, g.id)));
    const daySel = document.getElementById('ext-day'); if(daySel && daySel.children.length === 0) days.forEach(d => daySel.add(new Option(d, d)));
    const fillTime = (id) => { const el = document.getElementById(id); if(el && el.children.length === 0) timeSlots.forEach(t => el.add(new Option(`${t}:00`, t))); };
    fillTime('ext-start'); fillTime('ext-end');
    const btnAdd = document.getElementById('btn-add-external'); if(btnAdd) btnAdd.onclick = addExternalRule;
}

export function renderGlobalMatrix() {
    const container = document.getElementById('sabana-container'); const dayFilter = document.getElementById('sabana-day-filter').value; if(!container) return; container.innerHTML = '';
    const table = document.createElement('table'); table.className = "w-full border-collapse border border-gray-300 text-xs";
    const thead = document.createElement('thead'); const headerRow = document.createElement('tr'); headerRow.innerHTML = `<th class="bg-gray-100 border p-2 sticky left-0 z-10 w-24">Grupo</th>`;
    timeSlots.forEach(t => { headerRow.innerHTML += `<th class="bg-gray-50 border p-2 min-w-[80px]">${t}:00</th>`; });
    thead.appendChild(headerRow); table.appendChild(thead);
    const tbody = document.createElement('tbody');
    [...state.groups].sort((a,b) => a.name.localeCompare(b.name)).forEach(grp => {
        const tr = document.createElement('tr');
        const tdName = document.createElement('td'); tdName.className = "bg-gray-100 border p-2 font-bold sticky left-0 z-10"; tdName.innerText = grp.name; tr.appendChild(tdName);
        timeSlots.forEach(t => {
            const td = document.createElement('td'); td.className = "border p-1 h-12 align-top relative";
            const cls = state.schedule.find(c => c.groupId === grp.id && c.day === dayFilter && c.startTime <= t && (c.startTime + c.duration) > t);
            const ext = state.external.find(e => e.groupId === grp.id && e.day === dayFilter && e.start <= t && e.end > t);
            if(cls) { const subj = state.subjects.find(s => s.id === cls.subjectId); if(cls.startTime === t) { td.className += " bg-indigo-50 border-l-2 border-l-indigo-500"; td.innerHTML = `<div class="font-bold text-indigo-800 leading-tight truncate">${subj?subj.name:'?'}</div>`; } else { td.className += " bg-indigo-50"; } } 
            else if (ext) { td.className += " bg-slate-100 opacity-60"; if(ext.start === t) td.innerHTML = `<div class="text-[9px] text-gray-500 font-bold tracking-wider">${ext.type}</div>`; }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody); container.appendChild(table);
}

export function createTooltip() { const tooltipEl = document.createElement('div'); tooltipEl.id = 'custom-tooltip'; document.body.appendChild(tooltipEl); document.addEventListener('mousemove', e => { if(tooltipEl.classList.contains('visible')) { tooltipEl.style.left = (e.clientX+15)+'px'; tooltipEl.style.top = (e.clientY+15)+'px'; } }); }
export function showTooltip(html) { const t=document.getElementById('custom-tooltip'); t.innerHTML=html; t.classList.add('visible'); }
export function hideTooltip() { document.getElementById('custom-tooltip').classList.remove('visible'); }
export function renderSubjectsList() { 
    const c = document.getElementById('unassigned-subjects-container'); if(!c) return; c.innerHTML = ''; 
    const grouped = {}; state.subjects.forEach(s => { const t = s.trimester||0; if(!grouped[t]) grouped[t]=[]; grouped[t].push(s); }); 
    Object.keys(grouped).sort((a,b)=>Number(a)-Number(b)).forEach(t => { 
        const details = document.createElement('details'); details.className = "trimester-group"; details.open = true;
        details.innerHTML = `<summary>Cuatri ${t}</summary><div class="content"></div>`;
        grouped[t].forEach(s => { const el = document.createElement('div'); el.className = "draggable-subject"; el.draggable = true; el.textContent = s.name; el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('application/json', JSON.stringify({type: 'subject', id: s.id})); }); details.querySelector('.content').appendChild(el); });
        c.appendChild(details);
    });
    const l2 = document.getElementById('subjects-by-trimester'); if(l2) { l2.innerHTML = ''; Object.keys(grouped).forEach(t => { l2.innerHTML += `<div class="bg-gray-50 border p-2 mb-2 rounded"><h3 class="font-bold text-xs mb-1">C${t}</h3>${grouped[t].map(s=>`<div class="flex justify-between text-xs border-b p-1"><span>${s.name}</span><button class="text-blue-400" onclick="window.editSub('${s.id}')">✎</button></div>`).join('')}</div>`; }); window.editSub = (id) => showSubjectForm(state.subjects.find(s=>s.id===id)); }
}
export function renderGroupsList() { const l = document.getElementById('groups-by-trimester'); if(l) l.innerHTML = state.groups.map(g => `<div class="p-2 border bg-white text-sm">${g.name}</div>`).join(''); }
export function renderClassroomsManageList() { const l = document.getElementById('classrooms-list-manage'); if(l) l.innerHTML = state.classrooms.map(c=>`<div class="p-1 border-b text-xs flex justify-between">${c.name} <button class="text-red-500" onclick="window.delClass('${c.id}')">x</button></div>`).join(''); window.delClass=(id)=>deleteDocWrapper('classrooms',id); }
export function addGroup() { const n=document.getElementById('group-number-input').value; if(n) addDoc(cols.groups, {name: `IAEV-${n}`, trimester: 1}); }
export function addClassroom() { const n=document.getElementById('classroom-name-input').value; if(n) addDoc(cols.classrooms, {name: n}); }
