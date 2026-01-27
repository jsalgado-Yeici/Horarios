import { state, cols, days, timeSlots } from './state.js';
import { showTeacherForm, showSubjectForm, deleteDocWrapper, addAttendance, deleteAttendance } from './actions.js';
import { addDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// === NUEVA FUNCIÓN: RENDERIZADO DE SÁBANA (MATRIZ GENERAL) ===
export function renderGlobalMatrix() {
    const container = document.getElementById('sabana-container');
    const dayFilter = document.getElementById('sabana-day-filter').value;
    if(!container) return;

    container.innerHTML = '';
    
    // Tabla Estructura
    const table = document.createElement('table');
    table.className = "w-full border-collapse border border-gray-300 text-xs";
    
    // Header Row: Time Slots
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `<th class="bg-gray-100 border p-2 sticky left-0 z-10 w-24">Grupo / Hora</th>`;
    
    timeSlots.forEach(t => {
        const th = document.createElement('th');
        th.className = "bg-gray-50 border p-2 min-w-[100px]";
        th.innerText = `${t}:00 - ${t+1}:00`;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body: Rows = Grupos
    const tbody = document.createElement('tbody');
    
    // Ordenar grupos por nombre
    const sortedGroups = [...state.groups].sort((a,b) => a.name.localeCompare(b.name));

    sortedGroups.forEach(grp => {
        const tr = document.createElement('tr');
        // Columna Nombre Grupo
        const tdName = document.createElement('td');
        tdName.className = "bg-gray-100 border p-2 font-bold sticky left-0 z-10";
        tdName.innerText = grp.name;
        tr.appendChild(tdName);

        // Columnas Horas
        timeSlots.forEach(t => {
            const td = document.createElement('td');
            td.className = "border p-1 h-12 align-top relative hover:bg-gray-50 transition-colors";
            
            // Buscar clase en este slot, este día, este grupo
            // Nota: Manejamos duración > 1 hora
            const cls = state.schedule.find(c => 
                c.groupId === grp.id && 
                c.day === dayFilter && 
                c.startTime <= t && 
                (c.startTime + c.duration) > t
            );

            if(cls) {
                const subj = state.subjects.find(s => s.id === cls.subjectId);
                const teach = state.teachers.find(x => x.id === cls.teacherId);
                const room = state.classrooms.find(r => r.id === cls.classroomId);

                // Si es el inicio de la clase, mostramos info completa. Si es continuación, mostramos flecha o color
                if(cls.startTime === t) {
                    td.className += " bg-indigo-50 border-l-4 border-l-indigo-500";
                    td.innerHTML = `
                        <div class="font-bold text-indigo-800 leading-tight">${subj ? subj.name : '???'}</div>
                        <div class="text-[10px] text-gray-500">${teach ? teach.name : 'Sin Profe'}</div>
                        <div class="text-[9px] font-bold text-gray-400">${room ? room.name : 'Sin Aula'}</div>
                    `;
                    // colspan visual? No, porque la grilla es fija.
                } else {
                     td.className += " bg-indigo-50 border-l border-indigo-100";
                     td.innerHTML = `<div class="text-indigo-200 text-center">⬇</div>`;
                }
            }

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);
}

// === NUEVA FUNCIÓN: RENDERIZADO CARGA DOCENTE ===
function renderTeacherWorkload() {
    const container = document.getElementById('teacher-workload-container');
    if(!container) return;
    container.innerHTML = '';

    // Calcular horas por docente
    const workload = {}; // { teacherId: { name, hours } }
    state.teachers.forEach(t => workload[t.id] = { name: t.name, hours: 0 });
    
    state.schedule.forEach(c => {
        if(workload[c.teacherId]) {
            workload[c.teacherId].hours += c.duration;
        }
    });

    // Ordenar: Mayor carga primero
    const sorted = Object.values(workload).sort((a,b) => b.hours - a.hours);

    sorted.forEach(item => {
        // Definir "Full Time" como 20 horas (ajustable) para la barra de progreso
        const maxHours = 30; 
        const pct = Math.min((item.hours / maxHours) * 100, 100);
        
        let colorClass = "bg-blue-500";
        if(item.hours > 25) colorClass = "bg-red-500"; // Sobrecarga
        else if (item.hours < 5) colorClass = "bg-gray-300"; // Poca carga

        const el = document.createElement('div');
        el.className = "flex flex-col gap-1 p-2 border rounded bg-slate-50";
        el.innerHTML = `
            <div class="flex justify-between text-xs font-bold text-gray-700">
                <span>${item.name}</span>
                <span>${item.hours} hrs</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2.5">
                <div class="${colorClass} h-2.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
            </div>
        `;
        container.appendChild(el);
    });
}

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
            el.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({type: 'subject', id: s.id}));
            });
            contentDiv.appendChild(el);
        });
        c.appendChild(details);
    });

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
    state.groups.forEach(g => {
        const requiredSubjects = state.subjects.filter(s => s.trimester === g.trimester);
        const assignedSubjectIds = state.schedule.filter(c => c.groupId === g.id).map(c => c.subjectId);
        const missing = requiredSubjects.filter(s => !assignedSubjectIds.includes(s.id));
        if (missing.length > 0) {
            const card = document.createElement('div');
            card.className = "bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r shadow-sm flex flex-col gap-2 transition-all hover:shadow-md";
            const missingList = missing.map(s => `<span class="inline-block bg-orange-100 text-orange-800 text-[10px] px-2 py-0.5 rounded-full font-bold border border-orange-200">${s.name}</span>`).join(' ');
            card.innerHTML = `<div class="flex items-center justify-between"><h3 class="font-bold text-orange-800 text-sm flex items-center gap-2">⚠️ Grupo ${g.name} <span class="text-orange-600 font-normal text-xs">(Cuatri ${g.trimester})</span></h3></div><div class="text-xs text-orange-700"><p class="mb-1 font-semibold">Faltan ${missing.length} materias:</p><div class="flex flex-wrap gap-1">${missingList}</div></div>`;
            container.appendChild(card);
        }
    });
    if(container.children.length === 0) {
        container.innerHTML = `<div class="col-span-full bg-green-50 border border-green-200 rounded-lg p-6 text-center shadow-sm"><div class="text-2xl mb-2">🎉</div><h3 class="text-green-800 font-bold">¡Todo completo!</h3><p class="text-green-600 text-sm">Todos los grupos tienen sus materias asignadas.</p></div>`;
    }
}

// === ESTADÍSTICAS ===
function getWeekdayCountInMonth(monthIndex, year, dayName) {
    const dayMap = { "Domingo":0, "Lunes":1, "Martes":2, "Miércoles":3, "Jueves":4, "Viernes":5, "Sábado":6 };
    const targetDay = dayMap[dayName];
    if(targetDay === undefined) return 0;
    
    let count = 0;
    const date = new Date(year, monthIndex, 1);
    while (date.getMonth() === monthIndex) {
        if (date.getDay() === targetDay) count++;
        date.setDate(date.getDate() + 1);
    }
    return count;
}

export function renderStatistics() {
    renderTeacherWorkload(); // LLAMADA A LA NUEVA FUNCIÓN
    
    const container = document.getElementById('stats-content');
    if (!container) return;
    
    const monthSel = document.getElementById('stats-month');
    const yearSel = document.getElementById('stats-year');
    const month = parseInt(monthSel ? monthSel.value : new Date().getMonth());
    const year = parseInt(yearSel ? yearSel.value : new Date().getFullYear());

    const absences = state.attendance.filter(a => {
        const parts = a.date.split('-'); 
        return (parseInt(parts[1])-1) === month && parseInt(parts[0]) === year;
    });

    const groupStats = {};
    
    state.groups.forEach(g => {
        groupStats[g.id] = { name: g.name, expected: 0, realAbsences: 0 };
    });

    state.schedule.forEach(sched => {
        if (groupStats[sched.groupId]) {
            const occurrences = getWeekdayCountInMonth(month, year, sched.day);
            groupStats[sched.groupId].expected += occurrences;
        }
    });

    absences.forEach(abs => {
        if (groupStats[abs.groupId]) {
            groupStats[abs.groupId].realAbsences++;
        }
    });

    const totalAbsences = absences.length;
    let totalExpected = 0;
    Object.values(groupStats).forEach(gs => totalExpected += gs.expected);
    
    const globalAttendance = totalExpected > 0 
        ? ((1 - (totalAbsences / totalExpected)) * 100).toFixed(1) 
        : "100";

    document.getElementById('stat-total-absences').textContent = totalAbsences;
    document.getElementById('stat-global-pct').textContent = `${globalAttendance}%`;

    const tbody = document.getElementById('stats-table-body');
    if(tbody) {
        tbody.innerHTML = '';
        Object.values(groupStats).sort((a,b)=>a.name.localeCompare(b.name)).forEach(gs => {
            const absPct = gs.expected > 0 ? ((gs.realAbsences / gs.expected)*100).toFixed(1) : "0.0";
            const attPct = gs.expected > 0 ? (100 - parseFloat(absPct)).toFixed(1) : "100.0";
            
            const tr = document.createElement('tr');
            tr.className = "border-b hover:bg-gray-50 text-sm";
            tr.innerHTML = `
                <td class="px-4 py-3 font-medium text-gray-800">${gs.name}</td>
                <td class="px-4 py-3 text-center text-red-600 font-bold">${gs.realAbsences}</td>
                <td class="px-4 py-3 text-center text-green-700 font-bold">${attPct}%</td>
                <td class="px-4 py-3 text-center text-gray-500">${absPct}%</td>
            `;
            tbody.appendChild(tr);
        });
    }

    const logBody = document.getElementById('stats-log-body');
    if(logBody) {
        logBody.innerHTML = '';
        absences.sort((a,b) => b.date.localeCompare(a.date)).forEach(abs => {
            const g = state.groups.find(x=>x.id===abs.groupId)?.name || '???';
            const t = state.teachers.find(x=>x.id===abs.teacherId)?.name || '???';
            const s = state.subjects.find(x=>x.id===abs.subjectId)?.name || '???';
            
            const row = document.createElement('tr');
            row.className = "border-b text-xs text-gray-600";
            row.innerHTML = `
                <td class="px-2 py-2">${abs.date}</td>
                <td class="px-2 py-2 font-bold">${g}</td>
                <td class="px-2 py-2">${t}</td>
                <td class="px-2 py-2 truncate max-w-[100px]" title="${s}">${s}</td>
                <td class="px-2 py-2 text-right"><button class="text-red-500 hover:text-red-700 font-bold">×</button></td>
            `;
            row.querySelector('button').onclick = () => {
                deleteAttendance(abs.id).then(() => renderStatistics());
            };
            logBody.appendChild(row);
        });
    }
}

export function showAddAbsenceModal() {
    const modal = document.getElementById('modal');
    modal.classList.remove('hidden');
    const content = document.getElementById('modal-content');
    
    const grpOpts = state.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    const teachOpts = state.teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    const subjOpts = state.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    const today = new Date().toISOString().split('T')[0];

    content.innerHTML = `
        <div class="p-6 bg-white rounded-lg">
            <h2 class="text-xl font-bold mb-4 text-red-600">Registrar Falta Real</h2>
            <div class="space-y-3 text-sm">
                <div><label class="block font-bold text-gray-500">Fecha</label><input type="date" id="abs-date" value="${today}" class="w-full border p-2 rounded"></div>
                <div><label class="block font-bold text-gray-500">Grupo</label><select id="abs-grp" class="w-full border p-2 rounded">${grpOpts}</select></div>
                <div><label class="block font-bold text-gray-500">Docente</label><select id="abs-tch" class="w-full border p-2 rounded">${teachOpts}</select></div>
                <div><label class="block font-bold text-gray-500">Materia</label><select id="abs-sub" class="w-full border p-2 rounded">${subjOpts}</select></div>
            </div>
            <div class="flex justify-end gap-3 mt-6">
                <button id="btn-abs-cancel" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                <button id="btn-abs-save" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 shadow">Registrar</button>
            </div>
        </div>
    `;

    document.getElementById('btn-abs-cancel').onclick = () => modal.classList.add('hidden');
    document.getElementById('btn-abs-save').onclick = async () => {
        const payload = {
            date: document.getElementById('abs-date').value,
            groupId: document.getElementById('abs-grp').value,
            teacherId: document.getElementById('abs-tch').value,
            subjectId: document.getElementById('abs-sub').value,
            type: 'falta'
        };
        await addAttendance(payload);
        modal.classList.add('hidden');
        renderStatistics(); 
    };
}
