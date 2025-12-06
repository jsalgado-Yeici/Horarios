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

// Referencias a Colecciones
const getCol = name => collection(db, `artifacts/${APP_ID}/public/data/${name}`);
const cols = {
    teachers: getCol('teachers'), subjects: getCol('subjects'), 
    groups: getCol('groups'), schedule: getCol('schedule'),
    presets: getCol('presets'), blocks: getCol('blocks'),
    classrooms: getCol('classrooms')
};

// Configuración Visual
const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const timeSlots = Array.from({length: 14}, (_, i) => i + 7); // 7:00 a 20:00
let isMapEditing = false;

// === INICIO ===
function initApp() {
    console.log("Iniciando App...");
    setupListeners();
    setupRealtimeListeners();
}

// === ESCUCHAS EN TIEMPO REAL (FIREBASE) ===
function setupRealtimeListeners() {
    const updateState = (key, snapshot) => {
        state[key] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        state.loading[key] = false;
        checkLoading();
        
        // Renderizado inteligente
        if(key === 'schedule' || key === 'blocks') renderScheduleGrid();
        if(key === 'teachers') { renderTeachersList(); renderFilterOptions(); }
        if(key === 'subjects') { renderSubjectsList(); renderFilterOptions(); }
        if(key === 'groups') { renderGroupsList(); renderFilterOptions(); }
        if(key === 'classrooms') { renderClassroomsList(); renderClassroomMap(); renderFilterOptions(); }
        if(key === 'presets') renderPresetsList();
        
        // Actualizaciones secundarias
        if(['schedule', 'blocks'].includes(key)) {
            renderClassroomMap();
            runAnalysis();
        }
    };

    onSnapshot(cols.teachers, s => updateState('teachers', s));
    onSnapshot(cols.subjects, s => updateState('subjects', s));
    onSnapshot(cols.groups, s => updateState('groups', s));
    onSnapshot(cols.schedule, s => updateState('schedule', s));
    onSnapshot(cols.presets, s => updateState('presets', s));
    onSnapshot(cols.blocks, s => updateState('blocks', s));
    onSnapshot(cols.classrooms, s => updateState('classrooms', s));
}

function checkLoading() {
    const isLoading = Object.values(state.loading).some(v => v);
    const overlay = document.getElementById('loading-overlay');
    if (!isLoading && overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 500);
    }
}

// === RENDERIZADO DEL HORARIO (CON LÓGICA DE COLISIONES) ===
function renderScheduleGrid() {
    const grid = document.getElementById('schedule-grid');
    if (!grid) return;

    // 1. Crear Fragmento
    const frag = document.createDocumentFragment();

    // 2. Encabezados
    const corner = document.createElement('div');
    corner.className = 'grid-header sticky top-0 left-0 z-50 bg-gray-50 border-b border-gray-200';
    corner.textContent = 'HORA';
    frag.appendChild(corner);

    days.forEach(day => {
        const h = document.createElement('div');
        h.className = 'grid-header sticky top-0 z-40 bg-gray-50 border-b border-gray-200';
        h.textContent = day;
        frag.appendChild(h);
    });

    // 3. Renderizar Estructura (Celdas vacías)
    timeSlots.forEach(hour => {
        const timeCell = document.createElement('div');
        timeCell.className = 'grid-time-slot sticky left-0 z-20 shadow-sm border-r border-gray-200';
        timeCell.textContent = `${hour}:00`;
        frag.appendChild(timeCell);

        days.forEach(day => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell border-r border-b border-gray-100';
            cell.dataset.day = day;
            cell.dataset.hour = hour;
            
            cell.ondragover = e => { e.preventDefault(); cell.classList.add('droppable-hover'); };
            cell.ondragleave = () => cell.classList.remove('droppable-hover');
            cell.ondrop = e => handleDrop(e, day, hour);
            cell.onclick = (e) => {
                if(e.target === cell) showClassForm({ day, startTime: hour });
            };
            frag.appendChild(cell);
        });
    });

    // 4. Filtrado de Clases
    const filters = {
        teacher: document.getElementById('filter-teacher').value,
        group: document.getElementById('filter-group').value,
        classroom: document.getElementById('filter-classroom').value,
        trimester: document.getElementById('filter-trimester').value
    };

    const visibleClasses = state.schedule.filter(c => {
        if (filters.teacher && c.teacherId !== filters.teacher) return false;
        if (filters.group && c.groupId !== filters.group) return false;
        if (filters.classroom && c.classroomId !== filters.classroom) return false;
        if (filters.trimester) {
            const g = state.groups.find(grp => grp.id === c.groupId);
            if (!g || g.trimester != filters.trimester) return false;
        }
        return true;
    });

    // 5. CÁLCULO DE POSICIONES CON COLISIONES (Aquí está la corrección)
    days.forEach((day, dayIndex) => {
        // Obtenemos solo las clases de este día
        const dayClasses = visibleClasses.filter(c => c.day === day);
        
        // Para cada clase, calculamos cuántas chocan con ella
        dayClasses.forEach(c => {
            // Encontrar todas las clases que se superponen en tiempo con 'c'
            // (InicioA < FinB) y (FinA > InicioB)
            const overlaps = dayClasses.filter(other => 
                c.startTime < (other.startTime + other.duration) && 
                (c.startTime + c.duration) > other.startTime
            );

            // Ordenar para que siempre se pinten en el mismo orden (determinista)
            // Usamos ID o ID de materia para desempatar
            overlaps.sort((a, b) => a.id.localeCompare(b.id));

            const totalOverlaps = overlaps.length;
            const myIndex = overlaps.indexOf(c);

            // Crear el elemento visual
            const item = createScheduleItem(c, dayIndex, totalOverlaps, myIndex);
            if (item) frag.appendChild(item);
        });
    });

    // 6. Renderizar Bloqueos (Siempre al fondo)
    renderBlocks(frag, filters.trimester);

    grid.innerHTML = '';
    grid.appendChild(frag);
}

function createScheduleItem(c, dayIndex, totalOverlaps, overlapIndex) {
    const timeIndex = timeSlots.indexOf(c.startTime);
    if (timeIndex === -1) return null;

    const teacher = state.teachers.find(t => t.id === c.teacherId);
    const subject = state.subjects.find(s => s.id === c.subjectId);
    const group = state.groups.find(g => g.id === c.groupId);
    const classroom = state.classrooms.find(r => r.id === c.classroomId);

    if (!subject || !group || !teacher) return null;

    const div = document.createElement('div');
    div.className = 'schedule-item';
    
    // === MATEMÁTICAS DE POSICIONAMIENTO ===
    const rowHeight = 61; // 60px alto + 1px borde
    const headerOffset = 30; // Altura aproximada del header
    const colWidthBase = `calc((100% - 80px) / 5)`; // Ancho de 1 día completo
    
    // Top y Alto
    div.style.top = `${(timeIndex * rowHeight) + rowHeight}px`; // +rowHeight para saltar el header de día
    div.style.height = `${(c.duration * rowHeight) - 4}px`; // -4px para margen visual
    
    // Izquierda y Ancho (La magia del overlap)
    // Left = (AnchoHora) + (DíasPrevios) + (MiPosiciónEnElOverlap)
    div.style.left = `calc(80px + (${colWidthBase} * ${dayIndex}) + (${colWidthBase} / ${totalOverlaps} * ${overlapIndex}))`;
    
    // Width = (AnchoDía) / TotalOverlaps
    div.style.width = `calc((${colWidthBase} / ${totalOverlaps}) - 4px)`;
    
    div.style.marginLeft = '2px';

    // Colores
    const colorIdx = subject.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % PALETTE.length;
    div.style.borderLeftColor = PALETTE[colorIdx];
    
    // Ajuste de texto si la tarjeta es muy delgada
    const isNarrow = totalOverlaps >= 3;
    
    div.innerHTML = `
        <span class="subject-name truncate ${isNarrow ? 'text-[9px]' : ''}">${isNarrow ? subject.name.substring(0,8)+'..' : subject.name}</span>
        ${!isNarrow ? `
        <div class="item-details truncate text-[10px] leading-tight text-gray-500">
            ${teacher.name}<br>${group.name}
            ${classroom ? ` • <b>${classroom.name}</b>` : ''}
        </div>` : ''}
        <div class="actions">
            <button class="btn-edit">✎</button>
            <button class="btn-del">×</button>
        </div>
    `;

    div.querySelector('.btn-edit').onclick = (e) => { e.stopPropagation(); showClassForm(c); };
    div.querySelector('.btn-del').onclick = (e) => { e.stopPropagation(); deleteItem(cols.schedule, c.id); };

    // Tooltip nativo simple para ver info completa al pasar mouse
    div.title = `${subject.name}\n${teacher.name}\n${group.name}\n${classroom ? classroom.name : 'Sin Aula'}`;

    return div;
}

function renderBlocks(frag, filterTrimester) {
    state.blocks.forEach(block => {
        if(filterTrimester && block.trimester != filterTrimester) return;
        
        const startIdx = timeSlots.indexOf(block.startTime);
        const duration = block.endTime - block.startTime;
        const daysIndices = block.days === 'L-V' ? [0,1,2,3,4] : [0,1,2,3];

        daysIndices.forEach(dIdx => {
            const div = document.createElement('div');
            div.className = 'schedule-block flex flex-col justify-center items-center';
            // Ajuste de coordenadas igual que las celdas
            div.style.top = `${(startIdx * 61) + 61}px`;
            div.style.height = `${duration * 61 - 2}px`;
            div.style.left = `calc(80px + ((100% - 80px) / 5) * ${dIdx})`;
            div.style.width = `calc(((100% - 80px) / 5) - 2px)`;
            
            div.innerHTML = `<span>BLOQUEO</span><span class="text-xs">Cuatri ${block.trimester}</span><button class="text-red-500 font-bold ml-2">×</button>`;
            div.querySelector('button').onclick = () => deleteItem(cols.blocks, block.id);
            frag.appendChild(div);
        });
    });
}

// === GESTIÓN DE DATOS ===
async function deleteItem(colRef, id) {
    if(confirm('¿Eliminar elemento?')) {
        try { await deleteDoc(doc(colRef, id)); notify('Eliminado correctamente'); } 
        catch (e) { notify('Error al eliminar', true); }
    }
}

function notify(msg, isError = false) {
    const cont = document.getElementById('notification-container');
    const div = document.createElement('div');
    div.className = `notification ${isError ? 'error' : 'success'}`;
    div.textContent = msg;
    cont.appendChild(div);
    requestAnimationFrame(() => div.classList.add('show'));
    setTimeout(() => { div.classList.remove('show'); setTimeout(() => div.remove(), 300) }, 3000);
}

// === INTERFAZ Y EVENTOS ===
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
            
            const target = document.getElementById(`tab-content-${btn.dataset.tab}`);
            target.classList.remove('hidden');
            
            if(btn.dataset.tab === 'horario') renderScheduleGrid();
            if(btn.dataset.tab === 'mapa') renderClassroomMap();
        };
    });
    
    ['teacher', 'group', 'classroom', 'trimester'].forEach(id => {
        document.getElementById(`filter-${id}`).onchange = renderScheduleGrid;
    });

    document.getElementById('open-class-modal-btn').onclick = () => showClassForm();
    document.getElementById('open-preset-modal-btn').onclick = () => showPresetForm();
    document.getElementById('add-teacher-btn').onclick = () => showTeacherForm();
    document.getElementById('open-subject-modal-btn').onclick = () => showSubjectForm();
    document.getElementById('add-group-btn').onclick = addGroup;
    document.getElementById('add-classroom-btn').onclick = addClassroom;
    document.getElementById('add-block-btn').onclick = addBlock;
    document.getElementById('toggle-map-edit-btn').onclick = toggleMapEdit;
    
    document.getElementById('modal').onclick = (e) => {
        if(e.target.id === 'modal') document.getElementById('modal').classList.add('hidden');
    }
}

// === RENDERIZADORES ===
function renderTeachersList() {
    const list = document.getElementById('teachers-list');
    list.innerHTML = '';
    state.teachers.sort((a,b) => a.name.localeCompare(b.name)).forEach(t => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center p-2 hover:bg-gray-50 rounded border-b border-gray-100';
        div.innerHTML = `<span>${t.name}</span> <div class="space-x-2"><button class="text-xs text-blue-500 edit">Edit</button><button class="text-xs text-red-500 del">Del</button></div>`;
        div.querySelector('.del').onclick = () => deleteItem(cols.teachers, t.id);
        div.querySelector('.edit').onclick = () => showTeacherForm(t);
        list.appendChild(div);
    });
}

function renderSubjectsList() {
    const container = document.getElementById('subjects-by-trimester');
    container.innerHTML = '';
    const unassignedCont = document.getElementById('unassigned-subjects-container');
    unassignedCont.innerHTML = '';

    state.subjects.sort((a,b) => a.name.localeCompare(b.name)).forEach(s => {
        const dragItem = document.createElement('div');
        dragItem.className = 'p-2 bg-white rounded border shadow-sm cursor-grab text-sm truncate hover:bg-indigo-50';
        dragItem.draggable = true;
        dragItem.textContent = s.name;
        dragItem.ondragstart = (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'subject', id: s.id }));
        };
        unassignedCont.appendChild(dragItem);

        const manageItem = document.createElement('div');
        manageItem.className = 'flex justify-between p-2 border rounded bg-gray-50 text-sm';
        manageItem.innerHTML = `<span class="truncate">${s.name} (C${s.trimester})</span> <button class="text-red-500 font-bold">×</button>`;
        manageItem.querySelector('button').onclick = () => deleteItem(cols.subjects, s.id);
        container.appendChild(manageItem);
    });
}

// === FORMULARIOS ===
function showClassForm(defaults = {}) {
    const modal = document.getElementById('modal');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    const isEdit = defaults.id;
    const genOpts = (arr, selId) => arr.map(i => `<option value="${i.id}" ${selId===i.id?'selected':''}>${i.name}</option>`).join('');
    
    content.innerHTML = `
        <div class="p-6">
            <h2 class="text-xl font-bold mb-4">${isEdit ? 'Editar' : 'Nueva'} Clase</h2>
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div><label class="text-xs font-bold text-gray-500">Materia</label><select id="m-subject" class="w-full border p-2 rounded">${genOpts(state.subjects, defaults.subjectId)}</select></div>
                <div><label class="text-xs font-bold text-gray-500">Grupo</label><select id="m-group" class="w-full border p-2 rounded">${genOpts(state.groups, defaults.groupId)}</select></div>
                <div><label class="text-xs font-bold text-gray-500">Docente</label><select id="m-teacher" class="w-full border p-2 rounded">${genOpts(state.teachers, defaults.teacherId)}</select></div>
                <div><label class="text-xs font-bold text-gray-500">Aula</label><select id="m-classroom" class="w-full border p-2 rounded"><option value="">Ninguna</option>${genOpts(state.classrooms, defaults.classroomId)}</select></div>
                <div><label class="text-xs font-bold text-gray-500">Día</label><select id="m-day" class="w-full border p-2 rounded">${days.map(d=>`<option ${d===defaults.day?'selected':''}>${d}</option>`).join('')}</select></div>
                <div><label class="text-xs font-bold text-gray-500">Hora</label><select id="m-time" class="w-full border p-2 rounded">${timeSlots.map(t=>`<option value="${t}" ${t==defaults.startTime?'selected':''}>${t}:00</option>`).join('')}</select></div>
                <div><label class="text-xs font-bold text-gray-500">Duración</label><input type="number" id="m-dur" value="${defaults.duration||1}" class="w-full border p-2 rounded" min="1" max="5"></div>
            </div>
            <div class="flex justify-end gap-2">
                <button onclick="document.getElementById('modal').classList.add('hidden')" class="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded">Cancelar</button>
                <button id="m-save" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Guardar</button>
            </div>
        </div>
    `;
    
    document.getElementById('m-save').onclick = async () => {
        const data = {
            subjectId: document.getElementById('m-subject').value,
            groupId: document.getElementById('m-group').value,
            teacherId: document.getElementById('m-teacher').value,
            classroomId: document.getElementById('m-classroom').value,
            day: document.getElementById('m-day').value,
            startTime: parseInt(document.getElementById('m-time').value),
            duration: parseInt(document.getElementById('m-dur').value)
        };
        try {
            if(isEdit) await updateDoc(doc(cols.schedule, defaults.id), data);
            else await addDoc(cols.schedule, data);
            modal.classList.add('hidden');
            notify('Guardado con éxito');
        } catch(e) { notify('Error al guardar', true); }
    };
}

async function handleDrop(e, day, hour) {
    e.preventDefault();
    document.querySelectorAll('.droppable-hover').forEach(c => c.classList.remove('droppable-hover'));
    try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if(data.type === 'subject') {
            showClassForm({ day, startTime: hour, subjectId: data.id, duration: 2 });
        }
    } catch(err) { console.error(err); }
}

function renderFilterOptions() {
    const fill = (id, arr, label) => {
        const el = document.getElementById(id);
        const curr = el.value;
        el.innerHTML = `<option value="">${label}</option>` + arr.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
        el.value = curr;
    };
    fill('filter-teacher', state.teachers, 'Todos los Docentes');
    fill('filter-classroom', state.classrooms, 'Todas las Aulas');
    fill('filter-group', state.groups, 'Todos los Grupos');
    
    const trimSel = document.getElementById('filter-trimester');
    if(trimSel.children.length <= 1) {
        trimSel.innerHTML = '<option value="">Todos los Cuatris</option>';
        for(let i=1; i<=9; i++) trimSel.add(new Option(`Cuatrimestre ${i}`, i));
    }
}

function addGroup() { 
    const prefix = document.getElementById('group-prefix-select').value;
    const num = document.getElementById('group-number-input').value;
    const trim = document.getElementById('group-trimester-select').value;
    if(num) addDoc(cols.groups, { name: `${prefix}-${num}`, trimester: parseInt(trim||0) });
}
function addClassroom() { 
    const name = document.getElementById('classroom-name').value;
    if(name) addDoc(cols.classrooms, { name, x: 50, y: 50 });
}
function addBlock() { 
    const tri = document.getElementById('block-trimester').value;
    const time = document.getElementById('block-time').value;
    const days = document.getElementById('block-days').value;
    if(tri && time) addDoc(cols.blocks, { trimester: tri, startTime: parseInt(time), endTime: parseInt(time)+2, days });
}

function toggleMapEdit() { isMapEditing = !isMapEditing; renderClassroomMap(); }
function renderClassroomMap() { /* Mapa placeholder si no se requiere lógica compleja aquí */ }
function showTeacherForm(t) { /* Placeholder */ }
function showSubjectForm() { /* Placeholder */ }
function showPresetForm() { /* Placeholder */ }
function renderGroupsList() { 
    const l = document.getElementById('groups-by-trimester'); l.innerHTML = '';
    // Lógica simplificada de grupos para demo
    state.groups.forEach(g => {
        const d = document.createElement('div'); d.className='p-2 bg-white border rounded mb-2';
        d.innerHTML = `<b>${g.name}</b> (C${g.trimester})`;
        l.appendChild(d);
    });
}
function renderPresetsList() { }
function renderClassroomsList() { 
    const l = document.getElementById('classrooms-list'); l.innerHTML = '';
    state.classrooms.forEach(c => {
        const d = document.createElement('div'); d.textContent = c.name; d.className = 'p-2 border-b';
        l.appendChild(d);
    });
}
function runAnalysis() { 
    const list = document.getElementById('alerts-list'); list.innerHTML = '';
    // Ejemplo de análisis simple
    const alert = document.createElement('div');
    alert.className = 'text-xs text-gray-500 italic';
    alert.textContent = 'Sistema de análisis activo.';
    list.appendChild(alert);
}

// AUTO-START
auth.onAuthStateChanged(user => {
    if(user) initApp();
    else signInAnonymously(auth).catch(e => console.error(e));
});
