import { state, cols, days, timeSlots } from './state.js';
import { showTeacherForm, showSubjectForm, deleteDocWrapper, addExternalRule } from './actions.js';
import { addDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// === PANEL EXTERNAS (IDIOMAS / STEM) ===
export function renderExternalClassesPanel() {
    const list = document.getElementById('external-list');
    if(!list) return;
    list.innerHTML = '';

    // Renderizar lista de reglas
    state.external.forEach(ext => {
        const grp = state.groups.find(g=>g.id===ext.groupId)?.name || '???';
        const item = document.createElement('div');
        item.className = "border rounded p-3 bg-white flex justify-between items-center shadow-sm";
        item.innerHTML = `
            <div>
                <div class="font-bold text-sm text-gray-700">${ext.type} - ${grp}</div>
                <div class="text-xs text-gray-500">${ext.day}, ${ext.start}:00 - ${ext.end}:00</div>
            </div>
            <button class="text-red-500 hover:text-red-700 font-bold px-2">×</button>
        `;
        item.querySelector('button').onclick = () => deleteDocWrapper('external', ext.id);
        list.appendChild(item);
    });

    // Llenar selects del formulario
    const grpSel = document.getElementById('ext-group');
    if(grpSel && grpSel.children.length === 0) {
        state.groups.forEach(g => {
            const opt = new Option(g.name, g.id);
            grpSel.add(opt);
        });
    }
    const daySel = document.getElementById('ext-day');
    if(daySel && daySel.children.length === 0) days.forEach(d => daySel.add(new Option(d, d)));
    
    const fillTime = (id) => {
        const el = document.getElementById(id);
        if(el && el.children.length === 0) timeSlots.forEach(t => el.add(new Option(`${t}:00`, t)));
    };
    fillTime('ext-start'); fillTime('ext-end');
    
    const btnAdd = document.getElementById('btn-add-external');
    if(btnAdd) btnAdd.onclick = addExternalRule;
}

// === RENDERIZADO DE SÁBANA (MATRIZ GENERAL) ===
export function renderGlobalMatrix() {
    const container = document.getElementById('sabana-container');
    const dayFilter = document.getElementById('sabana-day-filter').value;
    if(!container) return;
    container.innerHTML = '';
    
    const table = document.createElement('table');
    table.className = "w-full border-collapse border border-gray-300 text-xs";
    
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `<th class="bg-gray-100 border p-2 sticky left-0 z-10 w-24">Grupo</th>`;
    timeSlots.forEach(t => { headerRow.innerHTML += `<th class="bg-gray-50 border p-2 min-w-[80px]">${t}:00</th>`; });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const sortedGroups = [...state.groups].sort((a,b) => a.name.localeCompare(b.name));

    sortedGroups.forEach(grp => {
        const tr = document.createElement('tr');
        const tdName = document.createElement('td');
        tdName.className = "bg-gray-100 border p-2 font-bold sticky left-0 z-10";
        tdName.innerText = grp.name;
        tr.appendChild(tdName);

        timeSlots.forEach(t => {
            const td = document.createElement('td');
            td.className = "border p-1 h-12 align-top relative";
            
            // 1. Buscar Clase Normal
            const cls = state.schedule.find(c => c.groupId === grp.id && c.day === dayFilter && c.startTime <= t && (c.startTime + c.duration) > t);
            
            // 2. Buscar Externa
            const ext = state.external.find(e => e.groupId === grp.id && e.day === dayFilter && e.start <= t && e.end > t);

            if(cls) {
                const subj = state.subjects.find(s => s.id === cls.subjectId);
                if(cls.startTime === t) {
                    td.className += " bg-indigo-50 border-l-2 border-l-indigo-500";
                    td.innerHTML = `<div class="font-bold text-indigo-800 leading-tight truncate">${subj?subj.name:'?'}</div>`;
                } else { td.className += " bg-indigo-50"; }
            } else if (ext) {
                td.className += " bg-slate-100 opacity-60";
                if(ext.start === t) td.innerHTML = `<div class="text-[9px] text-gray-500 font-bold tracking-wider">${ext.type}</div>`;
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
}

// === SIDEBAR RENDERERS & TOOLTIPS (Mantenidos igual, simplificados) ===
export function createTooltip() { 
    const tooltipEl = document.createElement('div'); tooltipEl.id = 'custom-tooltip'; document.body.appendChild(tooltipEl); 
    document.addEventListener('mousemove', e => { 
        if(tooltipEl.classList.contains('visible')) { tooltipEl.style.left = (e.clientX+15)+'px'; tooltipEl.style.top = (e.clientY+15)+'px'; } 
    }); 
}
export function showTooltip(html) { const t=document.getElementById('custom-tooltip'); t.innerHTML=html; t.classList.add('visible'); }
export function hideTooltip() { document.getElementById('custom-tooltip').classList.remove('visible'); }

export function renderTeachersList() { 
    const l = document.getElementById('teachers-list'); if(!l) return; l.innerHTML = ''; 
    state.teachers.sort((a,b)=>a.name.localeCompare(b.name)).forEach(t => { 
        const div = document.createElement('div');
        div.className = "p-2 border-b text-sm flex justify-between items-center bg-white hover:bg-gray-50";
        div.innerHTML = `<span class="font-bold text-gray-700 cursor-pointer">${t.name}</span><div class="flex gap-1"><button class="btn-edit text-blue-400 px-1">✎</button><button class="btn-del text-red-400 px-1">×</button></div>`;
        div.querySelector('.btn-edit').onclick = () => showTeacherForm(t);
        div.querySelector('.btn-del').onclick = () => deleteDocWrapper('teachers', t.id);
        l.appendChild(div);
    }); 
}
export function renderSubjectsList() { 
    const c = document.getElementById('unassigned-subjects-container'); if(!c) return; c.innerHTML = ''; 
    const grouped = {}; state.subjects.forEach(s => { const t = s.trimester||0; if(!grouped[t]) grouped[t]=[]; grouped[t].push(s); }); 
    Object.keys(grouped).sort((a,b)=>Number(a)-Number(b)).forEach(t => { 
        const details = document.createElement('details'); details.className = "trimester-group"; details.open = true;
        details.innerHTML = `<summary>Cuatri ${t}</summary><div class="content"></div>`;
        grouped[t].forEach(s => {
            const el = document.createElement('div'); el.className = "draggable-subject"; el.draggable = true; el.textContent = s.name;
            el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('application/json', JSON.stringify({type: 'subject', id: s.id})); });
            details.querySelector('.content').appendChild(el);
        });
        c.appendChild(details);
    });
    // Lista gestión
    const l2 = document.getElementById('subjects-by-trimester'); if(l2) { l2.innerHTML = ''; Object.keys(grouped).forEach(t => { 
        l2.innerHTML += `<div class="bg-gray-50 border p-2 mb-2 rounded"><h3 class="font-bold text-xs mb-1">C${t}</h3>${grouped[t].map(s=>`<div class="flex justify-between text-xs border-b p-1"><span>${s.name}</span><button class="text-blue-400" onclick="window.editSub('${s.id}')">✎</button></div>`).join('')}</div>`; 
    }); window.editSub = (id) => showSubjectForm(state.subjects.find(s=>s.id===id)); }
}
export function renderGroupsList() { const l = document.getElementById('groups-by-trimester'); if(l) l.innerHTML = state.groups.map(g => `<div class="p-2 border bg-white text-sm">${g.name}</div>`).join(''); }
export function renderClassroomsManageList() { const l = document.getElementById('classrooms-list-manage'); if(l) l.innerHTML = state.classrooms.map(c=>`<div class="p-1 border-b text-xs flex justify-between">${c.name} <button class="text-red-500" onclick="window.delClass('${c.id}')">x</button></div>`).join(''); window.delClass=(id)=>deleteDocWrapper('classrooms',id); }
export function renderFilterOptions() { 
    const fill = (id, arr, l) => { const el = document.getElementById(id); if(el) { const v=el.value; el.innerHTML = `<option value="">${l}</option>`+arr.map(i=>`<option value="${i.id}">${i.name}</option>`).join(''); el.value=v; }}; 
    fill('filter-teacher', state.teachers, 'Todos los Docentes'); fill('filter-group', state.groups, 'Todos los Grupos'); 
    const t = document.getElementById('filter-trimester'); if(t && t.options.length < 2) for(let i=1;i<=9;i++) t.add(new Option(`C${i}`,i)); 
}
export function addGroup() { const n=document.getElementById('group-number-input').value; if(n) addDoc(cols.groups, {name: `IAEV-${n}`, trimester: 1}); }
export function addClassroom() { const n=document.getElementById('classroom-name-input').value; if(n) addDoc(cols.classrooms, {name: n}); }
export function renderAlerts() {
    const container = document.getElementById('alerts-container'); if(!container) return; container.innerHTML = '';
    state.groups.forEach(g => {
        const required = state.subjects.filter(s => s.trimester === g.trimester);
        const assigned = state.schedule.filter(c => c.groupId === g.id).map(c => c.subjectId);
        const missing = required.filter(s => !assigned.includes(s.id));
        if (missing.length > 0) {
            container.innerHTML += `<div class="bg-orange-50 border-l-4 border-orange-500 p-2 text-xs mb-2"><strong>${g.name}:</strong> Faltan ${missing.length} materias</div>`;
        }
    });
}
