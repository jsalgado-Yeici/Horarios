import { state, cols } from './state.js';
import { showTeacherForm, showSubjectForm, deleteDocWrapper } from './actions.js';
import { addDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// === TOOLTIPS ===
let tooltipEl = null;
export function createTooltip() { 
    tooltipEl = document.createElement('div'); 
    tooltipEl.id = 'custom-tooltip'; 
    document.body.appendChild(tooltipEl); 
    document.addEventListener('mousemove', e => { 
        if(tooltipEl.classList.contains('visible')) { 
            tooltipEl.style.left = (e.clientX + 15) + 'px'; 
            tooltipEl.style.top = (e.clientY + 15) + 'px'; 
        } 
    }); 
}
export function showTooltip(html) { tooltipEl.innerHTML = html; tooltipEl.classList.add('visible'); }
export function hideTooltip() { tooltipEl.classList.remove('visible'); }

// === SIDEBAR RENDERERS ===
export function renderTeachersList() { 
    const l = document.getElementById('teachers-list'); if(!l) return; 
    l.innerHTML = ''; 
    state.teachers.sort((a,b)=>a.name.localeCompare(b.name)).forEach(t => { 
        const full = t.fullName ? `<span class="text-[10px] text-gray-400 block">${t.fullName}</span>` : ''; 
        const div = document.createElement('div');
        div.className = "p-2 border-b text-sm flex justify-between items-center bg-white hover:bg-gray-50";
        div.innerHTML = `<div class="leading-tight"><span class="font-bold text-gray-700 cursor-pointer">${t.name}</span>${full}</div><div class="flex gap-1"><button class="btn-edit text-blue-400 px-1">✎</button><button class="btn-del text-red-400 px-1">×</button></div>`;
        div.querySelector('.btn-edit').onclick = () => showTeacherForm(t);
        div.querySelector('.btn-del').onclick = () => deleteDocWrapper('teachers', t.id);
        l.appendChild(div);
    }); 
}

export function renderSubjectsList() { 
    const c = document.getElementById('unassigned-subjects-container'); if(!c) return;
    c.innerHTML = ''; 
    const grouped = {}; 
    state.subjects.forEach(s => { 
        const t = s.trimester||0; 
        if(!grouped[t]) grouped[t]=[]; 
        grouped[t].push(s); 
    }); 
    
    Object.keys(grouped).sort((a,b)=>Number(a)-Number(b)).forEach(t => { 
        const details = document.createElement('details');
        details.className = "trimester-group";
        details.open = true;
        details.innerHTML = `<summary>Cuatri ${t}</summary><div class="content"></div>`;
        
        const contentDiv = details.querySelector('.content');
        
        grouped[t].forEach(s => {
            const el = document.createElement('div');
            el.className = "draggable-subject";
            el.draggable = true;
            el.textContent = s.name;
            // CRUCIAL: Evento Drag nativo para evitar problemas de stringificación
            el.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({type: 'subject', id: s.id}));
            });
            contentDiv.appendChild(el);
        });
        c.appendChild(details);
    });

    // Lista de gestión (segunda pestaña)
    const l2 = document.getElementById('subjects-by-trimester'); 
    if(l2) { 
        l2.innerHTML = ''; 
        Object.keys(grouped).sort((a,b)=>Number(a)-Number(b)).forEach(t => { 
            const wrapper = document.createElement('div');
            wrapper.className = "bg-gray-50 border border-gray-200 rounded-lg p-2 shadow-sm h-fit";
            let itemsHtml = `<h3 class="font-bold text-[10px] text-gray-500 uppercase mb-2 pb-1 border-b border-gray-200 sticky top-0 bg-gray-50">Cuatrimestre ${t}</h3><div class="space-y-0.5 max-h-48 overflow-y-auto">`;
            
            wrapper.innerHTML = itemsHtml;
            const listCont = document.createElement('div');
            listCont.className = "space-y-0.5 max-h-48 overflow-y-auto";
            
            grouped[t].forEach(s => {
                const item = document.createElement('div');
                item.className = "flex justify-between items-center p-1 border-b last:border-0 border-gray-100 hover:bg-white text-xs";
                item.innerHTML = `<span class="truncate" title="${s.name}">${s.name}</span><button class="text-blue-400 px-1">✎</button>`;
                item.querySelector('button').onclick = () => showSubjectForm(s);
                listCont.appendChild(item);
            });
            wrapper.appendChild(listCont);
            l2.appendChild(wrapper); 
        }); 
    } 
}

export function renderGroupsList() { const l = document.getElementById('groups-by-trimester'); if(l) l.innerHTML = state.groups.map(g => `<div class="p-2 border bg-white text-sm">${g.name}</div>`).join(''); }
export function renderClassroomsManageList() { 
    const l = document.getElementById('classrooms-list-manage'); if(!l) return;
    l.innerHTML = '';
    state.classrooms.forEach(c => {
        const d = document.createElement('div');
        d.className = "p-1 border-b text-xs flex justify-between";
        d.innerHTML = `${c.name} <button class="text-red-500">x</button>`;
        d.querySelector('button').onclick = () => deleteDocWrapper('classrooms', c.id);
        l.appendChild(d);
    });
}
export function renderBlocksList() { 
    const l = document.getElementById('blocks-list'); if(!l) return;
    l.innerHTML = '';
    state.blocks.forEach(b => {
        const d = document.createElement('div');
        d.className = "text-xs p-2 border rounded bg-slate-50 flex justify-between items-center";
        d.innerHTML = `<div><div class="font-bold">Bloqueo C${b.trimester}</div><div class="text-[10px] text-gray-500">${b.startTime}:00 - ${b.endTime}:00</div></div><button class="text-red-500 font-bold px-2">×</button>`;
        d.querySelector('button').onclick = () => deleteDocWrapper('blocks', b.id);
        l.appendChild(d);
    });
}
export function renderFilterOptions() { 
    const fill = (id, arr, l) => { 
        const el = document.getElementById(id); 
        if(el) { 
            const v = el.value; 
            el.innerHTML = `<option value="">${l}</option>` + arr.map(i=>`<option value="${i.id}">${i.name}</option>`).join(''); 
            el.value = v; 
        }
    }; 
    fill('filter-teacher', state.teachers, 'Todos los Docentes'); 
    fill('filter-group', state.groups, 'Todos los Grupos'); 
    const t = document.getElementById('filter-trimester'); 
    if(t) { 
        const val = t.value; 
        t.innerHTML = '<option value="">Todos los Cuatris</option>'; 
        for(let i=1;i<=9;i++) t.add(new Option(`C${i}`,i)); 
        t.value = val; 
    } 
}

// === QUICK ADDS ===
export function addGroup() { const n=document.getElementById('group-number-input').value; if(n) addDoc(cols.groups, {name: `IAEV-${n}`, trimester: 1}); }
export function addClassroom() { const n=document.getElementById('classroom-name-input').value; if(n) addDoc(cols.classrooms, {name: n}); }
export function addBlock() { const t=document.getElementById('block-time').value; const tr=document.getElementById('block-trimester').value; if(t&&tr) addDoc(cols.blocks, {startTime: parseInt(t), endTime: parseInt(t)+2, trimester: tr, days:'L-V'}); }

export function renderAlerts() {
    const container = document.getElementById('alerts-container');
    if(!container) return;
    
    container.innerHTML = '';

    // 1. Verificar cada grupo
    state.groups.forEach(g => {
        // ¿Qué materias debería tener este grupo según su cuatri?
        const requiredSubjects = state.subjects.filter(s => s.trimester === g.trimester);
        
        // ¿Qué materias ya tiene asignadas en el horario?
        const assignedSubjectIds = state.schedule
            .filter(c => c.groupId === g.id)
            .map(c => c.subjectId);
        
        // ¿Cuáles faltan?
        const missing = requiredSubjects.filter(s => !assignedSubjectIds.includes(s.id));

        // Si falta algo, crear tarjeta de alerta
        if (missing.length > 0) {
            const card = document.createElement('div');
            card.className = "bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r shadow-sm flex flex-col gap-2 transition-all hover:shadow-md";
            
            // Lista bonita de materias faltantes
            const missingList = missing.map(s => `<span class="inline-block bg-orange-100 text-orange-800 text-[10px] px-2 py-0.5 rounded-full font-bold border border-orange-200">${s.name}</span>`).join(' ');

            card.innerHTML = `
                <div class="flex items-center justify-between">
                    <h3 class="font-bold text-orange-800 text-sm flex items-center gap-2">
                        ⚠️ Grupo ${g.name} <span class="text-orange-600 font-normal text-xs">(Cuatri ${g.trimester})</span>
                    </h3>
                </div>
                <div class="text-xs text-orange-700">
                    <p class="mb-1 font-semibold">Faltan ${missing.length} materias:</p>
                    <div class="flex flex-wrap gap-1">${missingList}</div>
                </div>
            `;
            container.appendChild(card);
        }
    });

    // Mensaje si todo está perfecto
    if(container.children.length === 0) {
        container.innerHTML = `
            <div class="col-span-full bg-green-50 border border-green-200 rounded-lg p-6 text-center shadow-sm">
                <div class="text-2xl mb-2">🎉</div>
                <h3 class="text-green-800 font-bold">¡Todo completo!</h3>
                <p class="text-green-600 text-sm">Todos los grupos tienen sus materias asignadas.</p>
            </div>
        `;
    }
}
