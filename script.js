// Paso 1: Importar las funciones necesarias desde los SDK de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    onSnapshot,
    writeBatch
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Paso 2: Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA5jnDVPPYhSuN7D6qzcETKWW3kzkqV1zs",
  authDomain: "planificador-horarios.firebaseapp.com",
  projectId: "planificador-horarios",
  storageBucket: "planificador-horarios.appspot.com",
  messagingSenderId: "625559113082",
  appId: "1:625559113082:web:836fb0b09be2a60cf2dac3"
};

// Paso 3: Inicialización de Firebase y servicios
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- Variables y constantes globales ---
const appId = 'default-scheduler-app-v2';
const getCollectionRef = name => collection(db, `artifacts/${appId}/public/data/${name}`);
const teachersCol = getCollectionRef('teachers');
const subjectsCol = getCollectionRef('subjects');
const groupsCol = getCollectionRef('groups');
const scheduleCol = getCollectionRef('schedule');
const presetsCol = getCollectionRef('presets');
const blocksCol = getCollectionRef('blocks');

let localState = { teachers: [], subjects: [], groups: [], schedule: [], presets: [], blocks: [] };
const colorPalette = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];
let colorIndex = 0;
const assignedColors = {};
const getSubjectColor = id => assignedColors[id] || (assignedColors[id] = colorPalette[colorIndex++ % colorPalette.length]);
let dom = {};
let isAppStarted = false;

// --- Sistema de Notificaciones Emergentes ---
const notification = {
    container: document.getElementById('notification-container'),
    show(message, isError = false) {
        const notif = document.createElement('div');
        notif.className = `notification ${isError ? 'error' : 'success'}`;
        const icon = isError ? 
            `<svg class="notification-icon w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>` :
            `<svg class="notification-icon w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        notif.innerHTML = `${icon}<span class="notification-message">${message}</span>`;
        this.container.appendChild(notif);
        requestAnimationFrame(() => notif.classList.add('show'));
        setTimeout(() => {
            notif.classList.remove('show');
            notif.addEventListener('transitionend', () => notif.remove());
        }, 3000);
    }
};

// --- Sistema de Modal (Confirmaciones y Formularios) ---
const modal = {
    el: document.getElementById('modal'),
    content: document.getElementById('modal-content'),
    show(htmlContent) {
        this.content.innerHTML = htmlContent;
        this.el.classList.remove('hidden');
    },
    hide() {
        this.el.classList.add('hidden');
        this.content.innerHTML = '';
    },
    confirm(title, message, onConfirm) {
        const confirmHtml = `
            <div class="text-center">
                <div class="mx-auto mb-4 text-red-500 w-16 h-16">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <h3 class="text-xl font-bold mb-2">${title}</h3>
                <p class="text-gray-600">${message}</p>
                <div class="mt-6 flex justify-center gap-4">
                    <button id="modal-cancel-btn" class="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600">Cancelar</button>
                    <button id="modal-confirm-btn" class="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700">Confirmar</button>
                </div>
            </div>`;
        this.show(confirmHtml);
        document.getElementById('modal-cancel-btn').onclick = () => this.hide();
        document.getElementById('modal-confirm-btn').onclick = () => {
            this.hide();
            if (onConfirm) onConfirm();
        };
    },
    showSubjectForm(subject = null) {
        const isEditing = subject !== null;
        const title = isEditing ? 'Editar Materia' : 'Nueva Materia';
        let trimesterOptions = '';
        for (let i = 1; i <= 9; i++) {
            trimesterOptions += `<option value="${i}" ${isEditing && subject.trimester == i ? 'selected' : ''}>Cuatrimestre ${i}</option>`;
        }
        const formHtml = `
            <h2 class="text-2xl font-semibold mb-4">${title}</h2>
            <div class="space-y-4 text-left">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Nombre de la Materia</label>
                    <input type="text" id="modal-subject-name" class="mt-1 block w-full p-2 border rounded-lg" value="${isEditing ? subject.name : ''}">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Cuatrimestre</label>
                    <select id="modal-subject-trimester" class="mt-1 block w-full p-2 border rounded-lg">
                        <option value="0" ${isEditing && (!subject.trimester || subject.trimester === 0) ? 'selected' : ''}>Sin Asignar</option>
                        ${trimesterOptions}
                    </select>
                </div>
            </div>
            <div class="mt-6 flex gap-4">
                <button id="modal-cancel-btn" class="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600">Cancelar</button>
                <button id="modal-save-btn" class="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700">Guardar</button>
            </div>`;
        this.show(formHtml);
        document.getElementById('modal-cancel-btn').onclick = () => this.hide();
        document.getElementById('modal-save-btn').onclick = () => saveSubject(subject ? subject.id : null);
    },
    showGroupForm(group) {
        const title = 'Editar Grupo';
        let trimesterOptions = '';
        for (let i = 1; i <= 9; i++) {
            trimesterOptions += `<option value="${i}" ${group.trimester == i ? 'selected' : ''}>Cuatrimestre ${i}</option>`;
        }
        const formHtml = `
            <h2 class="text-2xl font-semibold mb-4">${title}</h2>
            <div class="space-y-4 text-left">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Nombre del Grupo</label>
                    <input type="text" id="modal-group-name" class="mt-1 block w-full p-2 border rounded-lg" value="${group.name}">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Cuatrimestre</label>
                    <select id="modal-group-trimester" class="mt-1 block w-full p-2 border rounded-lg">
                        <option value="0" ${!group.trimester || group.trimester === 0 ? 'selected' : ''}>Sin Asignar</option>
                        ${trimesterOptions}
                    </select>
                </div>
            </div>
            <div class="mt-6 flex gap-4">
                <button id="modal-cancel-btn" class="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600">Cancelar</button>
                <button id="modal-save-btn" class="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700">Guardar</button>
            </div>`;
        this.show(formHtml);
        document.getElementById('modal-cancel-btn').onclick = () => this.hide();
        document.getElementById('modal-save-btn').onclick = () => saveGroup(group.id);
    },
    showEditForm(item, type) {
        const collection = type === 'Docente' ? teachersCol : groupsCol;
        const formHtml = `
            <h2 class="text-2xl font-semibold mb-4">Editar ${type}</h2>
            <input type="text" id="modal-edit-name" class="w-full p-2 border rounded-lg" value="${item.name}">
            <div class="mt-6 flex gap-4">
                <button id="modal-cancel-btn" class="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600">Cancelar</button>
                <button id="modal-save-btn" class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700">Guardar Cambios</button>
            </div>`;
        this.show(formHtml);
        document.getElementById('modal-cancel-btn').onclick = () => this.hide();
        document.getElementById('modal-save-btn').onclick = () => saveEditedItem(item.id, collection);
    },
    showPresetForm() {
        const formHtml = `
            <h2 class="text-2xl font-semibold mb-4">Crear Plantilla</h2>
            <div class="space-y-3 mb-4 text-left">
                <select id="modal-preset-teacher" class="w-full p-2 border rounded-lg"></select>
                <select id="modal-preset-subject" class="w-full p-2 border rounded-lg"></select>
                <select id="modal-preset-group" class="w-full p-2 border rounded-lg"></select>
            </div>
            <div class="flex gap-4">
                <button id="modal-cancel-btn" class="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600">Cancelar</button>
                <button id="modal-save-preset-btn" class="w-full bg-cyan-600 text-white py-2 px-4 rounded-lg hover:bg-cyan-700">Guardar</button>
            </div>`;
        this.show(formHtml);
        
        populateSelect(document.getElementById('modal-preset-teacher'), localState.teachers, 'Seleccionar Docente');
        populateSelect(document.getElementById('modal-preset-subject'), localState.subjects, 'Seleccionar Materia');
        populateSelect(document.getElementById('modal-preset-group'), localState.groups, 'Seleccionar Grupo');

        document.getElementById('modal-cancel-btn').onclick = () => this.hide();
        document.getElementById('modal-save-preset-btn').onclick = savePreset;
    }
};

function getInitials(name) {
    if (!name || typeof name !== 'string') return '';
    const words = name.trim().split(/\s+/);
    if (words.length > 1) return words.map(word => word[0]).join('').toUpperCase();
    return name;
}

function populateSelect(selectElement, dataArray, placeholderText) {
    const currentValue = selectElement.value;
    selectElement.innerHTML = '';
    const placeholderOption = new Option(placeholderText, '');
    selectElement.add(placeholderOption);
    dataArray.forEach(item => {
        selectElement.add(new Option(item.name, item.id));
    });
    selectElement.value = currentValue;
}

// --- Lógica principal de la aplicación ---
function startApp() {
    if (isAppStarted) return;
    isAppStarted = true;
    console.log("App iniciada.");

    dom = {
        teacherName: document.getElementById('teacher-name'), addTeacherBtn: document.getElementById('add-teacher-btn'), teachersList: document.getElementById('teachers-list'),
        subjectsByTrimester: document.getElementById('subjects-by-trimester'), openSubjectModalBtn: document.getElementById('open-subject-modal-btn'),
        unassignedSubjectsContainer: document.getElementById('unassigned-subjects-container'),
        groupPrefixSelect: document.getElementById('group-prefix-select'), groupNumberInput: document.getElementById('group-number-input'), 
        groupTrimesterSelect: document.getElementById('group-trimester-select'),
        addGroupBtn: document.getElementById('add-group-btn'), groupsByTrimester: document.getElementById('groups-by-trimester'),
        unassignedGroupsContainer: document.getElementById('unassigned-groups-container'),
        teacherSelect: document.getElementById('teacher-select'), subjectSelect: document.getElementById('subject-select'), groupSelect: document.getElementById('group-select'),
        daySelect: document.getElementById('day-select'), timeSelect: document.getElementById('time-select'), durationInput: document.getElementById('duration-input'),
        saveClassBtn: document.getElementById('save-class-btn'), cancelEditBtn: document.getElementById('cancel-edit-btn'),
        formTitle: document.getElementById('form-title'), editingClassId: document.getElementById('editing-class-id'),
        scheduleGrid: document.getElementById('schedule-grid'),
        filterTeacher: document.getElementById('filter-teacher'), filterGroup: document.getElementById('filter-group'),
        filterTrimester: document.getElementById('filter-trimester'),
        alertsList: document.getElementById('alerts-list'), noAlertsMessage: document.getElementById('no-alerts-message'),
        teacherWorkload: document.getElementById('teacher-workload'), groupWorkload: document.getElementById('group-workload'),
        advanceTrimesterBtn: document.getElementById('advance-trimester-btn'),
        openPresetModalBtn: document.getElementById('open-preset-modal-btn'),
        presetsList: document.getElementById('presets-list'),
        blockTrimester: document.getElementById('block-trimester'),
        blockTime: document.getElementById('block-time'),
        blockDays: document.getElementById('block-days'),
        addBlockBtn: document.getElementById('add-block-btn'),
        blocksList: document.getElementById('blocks-list'),
    };

    generateTimeOptions();
    setupEventListeners();
    populateBlockerForm();
    populateTrimesterFilter();

    // Suscripciones a Firestore
    onSnapshot(teachersCol, s => { localState.teachers = s.docs.map(d => ({ id: d.id, ...d.data() })); renderTeachersList(); populateSelect(dom.teacherSelect, localState.teachers, 'Seleccionar Docente'); populateSelect(dom.filterTeacher, localState.teachers, 'Todos los Docentes'); updateWorkloadSummary(); });
    onSnapshot(subjectsCol, s => { localState.subjects = s.docs.map(d => ({ id: d.id, ...d.data() })); renderSubjectsByTrimester(); populateSubjectFilter(); });
    onSnapshot(groupsCol, s => { localState.groups = s.docs.map(d => ({ id: d.id, ...d.data() })); renderGroupsByTrimester(); populateGroupFilter(); updateWorkloadSummary(); });
    onSnapshot(scheduleCol, s => { localState.schedule = s.docs.map(d => ({ id: d.id, ...d.data() })); renderScheduleGrid(); runPedagogicalAnalysis(); updateWorkloadSummary(); });
    onSnapshot(presetsCol, s => { localState.presets = s.docs.map(d => ({ id: d.id, ...d.data() })); renderPresetsList(); });
    onSnapshot(blocksCol, s => { localState.blocks = s.docs.map(d => ({ id: d.id, ...d.data() })); renderScheduleGrid(); renderBlocksList(); updateWorkloadSummary(); });
}

function setupEventListeners() {
    dom.addTeacherBtn.onclick = () => addItem(teachersCol, { name: dom.teacherName.value }, dom.teacherName, 'Docente');
    dom.addGroupBtn.onclick = addGroup;
    dom.openSubjectModalBtn.onclick = () => modal.showSubjectForm();
    dom.saveClassBtn.onclick = saveClass;
    dom.cancelEditBtn.onclick = resetForm;
    dom.filterTeacher.onchange = renderScheduleGrid;
    dom.filterGroup.onchange = renderScheduleGrid;
    dom.filterTrimester.onchange = renderScheduleGrid;
    dom.groupSelect.onchange = populateSubjectFilter;
    dom.subjectSelect.onchange = populateGroupFilter;
    dom.advanceTrimesterBtn.onclick = advanceAllGroups;
    dom.addBlockBtn.onclick = addBlock;
    dom.openPresetModalBtn.onclick = () => modal.showPresetForm();

    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('collapsed');
        });
    });
}

// --- LÓGICA DE BLOQUEO MANUAL ---

function populateBlockerForm() {
    for (let i = 1; i <= 9; i++) {
        dom.blockTrimester.add(new Option(`Cuatrimestre ${i}`, i));
    }
    for (let h = 7; h < 21; h++) {
        const timeText = `${h}:00 - ${h+2}:00`;
        dom.blockTime.add(new Option(timeText, h));
    }
}

async function addBlock() {
    const blockData = {
        trimester: parseInt(dom.blockTrimester.value),
        startTime: parseInt(dom.blockTime.value),
        endTime: parseInt(dom.blockTime.value) + 2,
        days: dom.blockDays.value
    };

    const isDuplicate = localState.blocks.some(b => 
        b.trimester === blockData.trimester &&
        b.startTime === blockData.startTime &&
        b.days === blockData.days
    );

    if(isDuplicate) {
        return notification.show("Este bloqueo ya existe.", true);
    }

    try {
        await addDoc(blocksCol, blockData);
        notification.show("Bloqueo agregado correctamente.");
    } catch(e) {
        notification.show("Error al agregar el bloqueo.", true);
        console.error(e);
    }
}

function renderBlocksList() {
    dom.blocksList.innerHTML = '';
    if (localState.blocks.length === 0) {
        dom.blocksList.innerHTML = '<p class="text-xs text-gray-400">No hay bloqueos activos.</p>';
        return;
    }
    [...localState.blocks].sort((a,b) => a.trimester - b.trimester || a.startTime - b.startTime).forEach(block => {
        const blockDiv = document.createElement('div');
        blockDiv.className = 'management-item';
        
        const affectedGroups = localState.groups
            .filter(g => g.trimester === block.trimester)
            .map(g => g.name)
            .join(', ');

        blockDiv.innerHTML = `
            <div>
                <p class="font-semibold">Cuatri ${block.trimester}: ${block.startTime}:00-${block.endTime}:00 (${block.days})</p>
                <p class="text-xs text-gray-500">Grupos: ${affectedGroups || 'Ninguno'}</p>
            </div>
            <div class="actions">
                <button class="delete-btn" title="Eliminar">🗑️</button>
            </div>
        `;
        blockDiv.querySelector('.delete-btn').onclick = async () => {
            modal.confirm("¿Eliminar Bloqueo?", "Esta acción es irreversible.", async () => {
                try {
                    await deleteDoc(doc(blocksCol, block.id));
                    notification.show("Bloqueo eliminado.");
                } catch (e) {
                    notification.show("Error al eliminar el bloqueo.", true);
                }
            });
        };
        dom.blocksList.appendChild(blockDiv);
    });
}

// --- LÓGICA DE RENDERIZADO DEL HORARIO (ACTUALIZADA) ---

function populateTrimesterFilter() {
    dom.filterTrimester.innerHTML = '';
    dom.filterTrimester.add(new Option('Todos los Cuatris', ''));
    for (let i = 1; i <= 9; i++) {
        dom.filterTrimester.add(new Option(`Cuatrimestre ${i}`, i));
    }
}

function renderScheduleGrid() {
    if (!dom.scheduleGrid) return;
    dom.scheduleGrid.innerHTML = '';
    dom.scheduleGrid.appendChild(document.createElement('div'));
    days.forEach(day => { const header = document.createElement('div'); header.className = 'grid-header'; header.textContent = day; dom.scheduleGrid.appendChild(header); });
    
    timeSlots.forEach(time => {
        const timeSlot = document.createElement('div');
        timeSlot.className = 'grid-time-slot';
        timeSlot.textContent = `${time}h 00 - ${time + 1}h 00`;
        dom.scheduleGrid.appendChild(timeSlot);
        
        days.forEach(day => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.day = day; cell.dataset.hour = time;
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('drop', handleDrop);
            dom.scheduleGrid.appendChild(cell);
        });
    });

    renderScheduleBlocks();

    const selectedTeacher = dom.filterTeacher.value;
    const selectedGroup = dom.filterGroup.value;
    const selectedTrimester = dom.filterTrimester.value;

    const filteredSchedule = localState.schedule.filter(c => {
        const group = localState.groups.find(g => g.id === c.groupId);
        if (!group) return false;

        const teacherMatch = !selectedTeacher || c.teacherId === selectedTeacher;
        const groupMatch = !selectedGroup || c.groupId === selectedGroup;
        const trimesterMatch = !selectedTrimester || group.trimester == selectedTrimester;
        
        return teacherMatch && groupMatch && trimesterMatch;
    });

    days.forEach((day, dayIndex) => {
        const dayEvents = filteredSchedule.filter(e => e.day === day);
        dayEvents.forEach(c => {
            const teacher = localState.teachers.find(t => t.id === c.teacherId);
            const subject = localState.subjects.find(s => s.id === c.subjectId);
            const group = localState.groups.find(g => g.id === c.groupId);
            if (!teacher || !subject || !group) return;
            const timeIndex = timeSlots.indexOf(c.startTime);
            if (timeIndex === -1) return;
            
            const overlaps = dayEvents.filter(e => (c.startTime < (e.startTime + e.duration)) && ((c.startTime + c.duration) > e.startTime));
            const totalOverlaps = overlaps.length;
            const overlapIndex = overlaps.sort((a,b) => a.id.localeCompare(b.id)).indexOf(c);
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'schedule-item';
            itemDiv.dataset.classId = c.id;
            itemDiv.style.backgroundColor = getSubjectColor(subject.id);
            const timeColumnWidth = 120;
            const dayColumnWidth = (dom.scheduleGrid.offsetWidth - timeColumnWidth) / days.length;
            
            const itemWidth = dayColumnWidth / totalOverlaps;
            const itemLeft = (dayColumnWidth / totalOverlaps) * overlapIndex;

            itemDiv.style.top = `${(timeIndex) * 51 + 51}px`;
            itemDiv.style.left = `${timeColumnWidth + 1 + (dayIndex * dayColumnWidth) + itemLeft}px`;
            itemDiv.style.width = `${itemWidth - 2}px`;
            itemDiv.style.height = `${(c.duration * 50) + ((c.duration - 1) * 1)}px`;
            
            let subjectName = subject.name;
            if (totalOverlaps > 2) { 
                itemDiv.style.fontSize = '0.65rem';
                subjectName = getInitials(subject.name);
            }
            
            itemDiv.innerHTML = `<div class="font-bold">${subjectName}</div><div>${teacher.name.split(' ')[0]}</div><div class="italic">${group.name}</div><div class="actions"><button title="Editar">✏️</button><button title="Eliminar">🗑️</button></div><div class="resize-handle"></div>`;
            const [editBtn, deleteBtn] = itemDiv.querySelectorAll('button');
            editBtn.onclick = (e) => { e.stopPropagation(); editClass(c); };
            deleteBtn.onclick = (e) => { e.stopPropagation(); deleteClass(c.id, `${subject.name} con ${teacher.name}`); };
            itemDiv.querySelector('.resize-handle').addEventListener('mousedown', (e) => handleResizeStart(e, c));
            dom.scheduleGrid.appendChild(itemDiv);
        });
    });
}


function renderScheduleBlocks() {
    if (!dom.scheduleGrid) return;
    const selectedTrimester = dom.filterTrimester.value;

    const filteredBlocks = localState.blocks.filter(block => {
        return !selectedTrimester || block.trimester == selectedTrimester;
    });

    filteredBlocks.forEach(block => {
        const startHour = parseInt(block.startTime);
        const endHour = parseInt(block.endTime);
        const duration = endHour - startHour;
        
        const daysToRender = [];
        if (block.days.toUpperCase() === 'L-V') {
            daysToRender.push('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes');
        } else if (block.days.toUpperCase() === 'L-J') {
            daysToRender.push('Lunes', 'Martes', 'Miércoles', 'Jueves');
        }

        daysToRender.forEach(day => {
            const dayIndex = days.indexOf(day);
            if (dayIndex === -1) return;

            const timeIndex = timeSlots.indexOf(startHour);
            if (timeIndex === -1) return;
            
            const blockDiv = document.createElement('div');
            blockDiv.className = 'schedule-block';
            blockDiv.textContent = `Inglés (Cuatri ${block.trimester})`;
            
            const timeColumnWidth = 120;
            const dayColumnWidth = (dom.scheduleGrid.offsetWidth - timeColumnWidth) / days.length;
            
            blockDiv.style.top = `${(timeIndex) * 51 + 51}px`;
            blockDiv.style.left = `${timeColumnWidth + 1 + (dayIndex * dayColumnWidth)}px`;
            blockDiv.style.width = `${dayColumnWidth - 2}px`;
            blockDiv.style.height = `${(duration * 50) + ((duration - 1) * 1)}px`;
            
            dom.scheduleGrid.appendChild(blockDiv);
        });
    });
}

function checkConflict(newClass, ignoreId = null) {
    const newStart = newClass.startTime;
    const newEnd = newStart + newClass.duration;
    
    const classConflict = localState.schedule.some(existingClass => {
        if (existingClass.id === ignoreId || existingClass.day !== newClass.day) return false;
        if (existingClass.teacherId === newClass.teacherId || existingClass.groupId === newClass.groupId) {
            const existingStart = existingClass.startTime;
            const existingEnd = existingStart + existingClass.duration;
            return newStart < existingEnd && newEnd > existingStart;
        }
        return false;
    });
    if (classConflict) return true;

    const group = localState.groups.find(g => g.id === newClass.groupId);
    if (!group) return false;

    const blockConflict = localState.blocks.some(block => {
        if (block.trimester != group.trimester) return false;

        const daysOfBlock = [];
        if (block.days.toUpperCase() === 'L-V') daysOfBlock.push('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes');
        if (block.days.toUpperCase() === 'L-J') daysOfBlock.push('Lunes', 'Martes', 'Miércoles', 'Jueves');
        
        if (!daysOfBlock.includes(newClass.day)) return false;

        const blockStart = parseInt(block.startTime);
        const blockEnd = parseInt(block.endTime);
        
        return newStart < blockEnd && newEnd > blockStart;
    });
    if (blockConflict) return true;

    return false;
}

async function addItem(collectionRef, data, inputElement, type) {
    if (!inputElement.value.trim()) return;
    try {
        await addDoc(collectionRef, data);
        notification.show(`${type} "${data.name}" agregado.`);
        inputElement.value = '';
    } catch (error) {
        notification.show(`No se pudo agregar el ${type.toLowerCase()}.`, true);
    }
}

async function addGroup() {
    const prefix = dom.groupPrefixSelect.value;
    const number = dom.groupNumberInput.value;
    if (!number) return notification.show("Introduce un número de grupo.", true);
    
    const groupData = {
        name: `${prefix}-${number}`,
        trimester: parseInt(dom.groupTrimesterSelect.value)
    };

    try {
        await addDoc(groupsCol, groupData);
        dom.groupNumberInput.value = '';
        dom.groupTrimesterSelect.value = 0;
        notification.show(`Grupo "${groupData.name}" agregado.`);
    } catch (error) {
        notification.show("No se pudo agregar el grupo.", true);
    }
}

function createManagementItem(item, collection, type, draggable = false) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'management-item';
    if (draggable) {
        itemDiv.draggable = true;
        itemDiv.dataset.id = item.id;
        itemDiv.dataset.type = type;
        itemDiv.addEventListener('dragstart', handleManagementDragStart);
        itemDiv.addEventListener('dragend', handleManagementDragEnd);
    }
    itemDiv.innerHTML = `
        <span>${item.name}</span>
        <div class="actions">
            <button class="edit-btn" title="Editar">✏️</button>
            <button class="delete-btn" title="Eliminar">🗑️</button>
        </div>
    `;
    
    itemDiv.querySelector('.edit-btn').onclick = () => {
        if (type === 'Materia') {
            modal.showSubjectForm(item);
        } else if (type === 'Grupo') {
            modal.showGroupForm(item);
        } else {
            modal.showEditForm(item, type);
        }
    };
    
    itemDiv.querySelector('.delete-btn').onclick = () => {
        modal.confirm(`¿Eliminar ${type}?`, `Borrar "<b>${item.name}</b>".`, async () => {
            try {
                await deleteDoc(doc(collection, item.id));
                notification.show(`"${item.name}" eliminado.`);
            } catch (e) {
                notification.show("Error al eliminar.", true);
            }
        });
    };
    return itemDiv;
}

function sortByName(a, b) {
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

function renderTeachersList() {
    if(!dom.teachersList) return;
    dom.teachersList.innerHTML = '';
    [...localState.teachers].sort(sortByName).forEach(teacher => {
        dom.teachersList.appendChild(createManagementItem(teacher, teachersCol, 'Docente'));
    });
}

function renderSubjectsByTrimester() {
    if(!dom.subjectsByTrimester || !dom.unassignedSubjectsContainer) return;
    dom.subjectsByTrimester.innerHTML = '';
    dom.unassignedSubjectsContainer.innerHTML = '';
    const sortedSubjects = [...localState.subjects].sort(sortByName);
    for (let i = 1; i <= 9; i++) {
        const column = document.createElement('div');
        column.className = 'trimester-column space-y-2';
        column.dataset.trimester = i;
        column.innerHTML = `<h3>Cuatri ${i}</h3>`;
        const subjectsInTrimester = sortedSubjects.filter(s => s.trimester == i);
        if (subjectsInTrimester.length > 0) {
            subjectsInTrimester.forEach(subject => {
                column.appendChild(createManagementItem(subject, subjectsCol, 'Materia', true));
            });
        } else {
            column.innerHTML += `<p class="text-xs text-gray-400">Arrastra materias aquí</p>`;
        }
        column.addEventListener('dragover', handleManagementDragOver);
        column.addEventListener('drop', handleManagementDrop);
        dom.subjectsByTrimester.appendChild(column);
    }
    const unassignedSubjects = sortedSubjects.filter(s => !s.trimester || s.trimester === 0);
    if (unassignedSubjects.length > 0) {
        unassignedSubjects.forEach(subject => {
            dom.unassignedSubjectsContainer.appendChild(createManagementItem(subject, subjectsCol, 'Materia', true));
        });
    } else {
        dom.unassignedSubjectsContainer.innerHTML = `<p class="text-xs text-gray-400">Todas las materias están asignadas.</p>`;
    }
    dom.unassignedSubjectsContainer.dataset.trimester = 0;
    dom.unassignedSubjectsContainer.addEventListener('dragover', handleManagementDragOver);
    dom.unassignedSubjectsContainer.addEventListener('drop', handleManagementDrop);
}

function renderGroupsByTrimester() {
    if(!dom.groupsByTrimester || !dom.unassignedGroupsContainer) return;
    dom.groupsByTrimester.innerHTML = '';
    dom.unassignedGroupsContainer.innerHTML = '';
    const sortedGroups = [...localState.groups].sort(sortByName);
     for (let i = 1; i <= 9; i++) {
        const groupsInTrimester = sortedGroups.filter(g => g.trimester == i);
        if (groupsInTrimester.length > 0) {
            const block = document.createElement('div');
            block.className = 'group-trimester-block trimester-column';
            block.dataset.trimester = i;
            block.innerHTML = `<h3>Cuatrimestre ${i}</h3>`;
            const list = document.createElement('div');
            list.className = 'space-y-2';
            groupsInTrimester.forEach(group => {
                list.appendChild(createManagementItem(group, groupsCol, 'Grupo', true));
            });
            block.appendChild(list);
            block.addEventListener('dragover', handleManagementDragOver);
            block.addEventListener('drop', handleManagementDrop);
            dom.groupsByTrimester.appendChild(block);
        }
    }
    const unassignedGroups = sortedGroups.filter(g => !g.trimester || g.trimester === 0);
    if (unassignedGroups.length > 0) {
        unassignedGroups.forEach(group => {
            dom.unassignedGroupsContainer.appendChild(createManagementItem(group, groupsCol, 'Grupo', true));
        });
    } else {
        dom.unassignedGroupsContainer.innerHTML = `<p class="text-xs text-gray-400">Todos los grupos están asignados.</p>`;
    }
    dom.unassignedGroupsContainer.dataset.trimester = 0;
    dom.unassignedGroupsContainer.addEventListener('dragover', handleManagementDragOver);
    dom.unassignedGroupsContainer.addEventListener('drop', handleManagementDrop);
}

async function saveSubject(subjectId = null) {
    const subjectData = {
        name: document.getElementById('modal-subject-name').value,
        trimester: parseInt(document.getElementById('modal-subject-trimester').value)
    };
    if (!subjectData.name) return notification.show("El nombre no puede estar vacío.", true);
    
    try {
        if (subjectId) {
            await updateDoc(doc(subjectsCol, subjectId), subjectData);
            notification.show("Materia actualizada.");
        } else {
            await addDoc(subjectsCol, subjectData);
            notification.show("Materia agregada.");
        }
        modal.hide();
    } catch (error) {
        notification.show("Error al guardar la materia.", true);
    }
}

async function saveGroup(groupId) {
    const groupData = {
        name: document.getElementById('modal-group-name').value,
        trimester: parseInt(document.getElementById('modal-group-trimester').value)
    };
    if (!groupData.name) return notification.show("El nombre no puede estar vacío.", true);
    
    try {
        await updateDoc(doc(groupsCol, groupId), groupData);
        notification.show("Grupo actualizado.");
        modal.hide();
    } catch (error) {
        notification.show("Error al actualizar el grupo.", true);
    }
}

async function saveEditedItem(itemId, collection) {
    const newName = document.getElementById('modal-edit-name').value;
    if (!newName.trim()) return notification.show("El nombre no puede estar vacío.", true);
    try {
        await updateDoc(doc(collection, itemId), { name: newName });
        notification.show("Elemento actualizado.");
        modal.hide();
    } catch (error) {
        notification.show("Error al actualizar.", true);
    }
}

function populateSubjectFilter() {
    const selectedGroupId = dom.groupSelect.value;
    const selectedGroup = localState.groups.find(g => g.id === selectedGroupId);
    
    let subjectsToShow = localState.subjects;
    if (selectedGroup && selectedGroup.trimester > 0) {
        subjectsToShow = localState.subjects.filter(s => s.trimester == selectedGroup.trimester);
    }
    
    populateSelect(dom.subjectSelect, subjectsToShow.sort(sortByName), 'Seleccionar Materia');
}

function populateGroupFilter() {
    const selectedSubjectId = dom.subjectSelect.value;
    const selectedSubject = localState.subjects.find(s => s.id === selectedSubjectId);

    let groupsToShow = localState.groups;
    if (selectedSubject && selectedSubject.trimester > 0) {
        groupsToShow = localState.groups.filter(g => g.trimester == selectedSubject.trimester);
    }

    populateSelect(dom.groupSelect, groupsToShow.sort(sortByName), 'Seleccionar Grupo');
}

async function savePreset() {
    const presetData = {
        teacherId: document.getElementById('modal-preset-teacher').value,
        subjectId: document.getElementById('modal-preset-subject').value,
        groupId: document.getElementById('modal-preset-group').value,
    };
    if (!presetData.teacherId || !presetData.subjectId || !presetData.groupId) {
        return notification.show("Selecciona todos los campos para la plantilla.", true);
    }
    try {
        await addDoc(presetsCol, presetData);
        notification.show("Plantilla guardada.");
        modal.hide();
    } catch (error) {
        notification.show("No se pudo guardar la plantilla.", true);
    }
}

function renderPresetsList() {
    if(!dom.presetsList) return;
    dom.presetsList.innerHTML = '';
    if (localState.presets.length === 0) {
        dom.presetsList.innerHTML = '<p class="text-gray-500 text-sm">No hay plantillas guardadas.</p>';
        return;
    }
    localState.presets.forEach(preset => {
        const teacher = localState.teachers.find(t => t.id === preset.teacherId);
        const subject = localState.subjects.find(s => s.id === preset.subjectId);
        const group = localState.groups.find(g => g.id === preset.groupId);
        if (!teacher || !subject || !group) return;

        const presetDiv = document.createElement('div');
        presetDiv.className = 'preset-item';
        presetDiv.draggable = true;
        presetDiv.dataset.presetId = preset.id;
        presetDiv.innerHTML = `
            <div class="preset-item-info">
                <span class="subject">${subject.name}</span>
                <span class="details">${teacher.name} / ${group.name}</span>
            </div>
            <button class="text-red-500 font-bold px-2">&times;</button>
        `;
        presetDiv.addEventListener('dragstart', handleDragStart);
        presetDiv.addEventListener('dragend', handleDragEnd);
        presetDiv.querySelector('button').onclick = (e) => {
            e.stopPropagation();
            modal.confirm('¿Eliminar Plantilla?', `Estás a punto de borrar esta plantilla.`, async () => {
                try {
                    await deleteDoc(doc(presetsCol, preset.id));
                    notification.show("Plantilla eliminada.");
                } catch (error) {
                    notification.show("Error al eliminar la plantilla.", true);
                }
            });
        };
        dom.presetsList.appendChild(presetDiv);
    });
}

function handleDragStart(e) { e.target.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', e.target.dataset.presetId); }
function handleDragEnd(e) { e.target.classList.remove('dragging'); }
function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const cell = e.target.closest('.grid-cell'); if (cell) { document.querySelectorAll('.grid-cell.droppable-hover').forEach(c => c.classList.remove('droppable-hover')); cell.classList.add('droppable-hover'); } }
async function handleDrop(e) {
    e.preventDefault();
    document.querySelectorAll('.grid-cell.droppable-hover').forEach(c => c.classList.remove('droppable-hover'));
    const cell = e.target.closest('.grid-cell');
    if (!cell) return;
    const presetId = e.dataTransfer.getData('text/plain');
    const preset = localState.presets.find(p => p.id === presetId);
    if (!preset) return;
    const classData = { teacherId: preset.teacherId, subjectId: preset.subjectId, groupId: preset.groupId, day: cell.dataset.day, startTime: parseInt(cell.dataset.hour), duration: 1 };
    if (checkConflict(classData)) return notification.show("Conflicto de horario al soltar la plantilla.", true);
    try { await addDoc(scheduleCol, classData); notification.show("Clase agregada desde plantilla."); } catch (error) { notification.show("Error al agregar la clase.", true); }
}

function handleManagementDragStart(e) {
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({id: e.target.dataset.id, type: e.target.dataset.type}));
}
function handleManagementDragEnd(e) {
    e.target.classList.remove('dragging');
}
function handleManagementDragOver(e) {
    e.preventDefault();
    const targetColumn = e.target.closest('.trimester-column, #unassigned-subjects-container, #unassigned-groups-container');
    if (targetColumn) {
        document.querySelectorAll('.droppable-hover').forEach(c => c.classList.remove('droppable-hover'));
        targetColumn.classList.add('droppable-hover');
    }
}
async function handleManagementDrop(e) {
    e.preventDefault();
    document.querySelectorAll('.droppable-hover').forEach(c => c.classList.remove('droppable-hover'));
    const target = e.target.closest('.trimester-column, #unassigned-subjects-container, #unassigned-groups-container');
    if (!target) return;

    const data = JSON.parse(e.dataTransfer.getData('application/json'));
    const newTrimester = parseInt(target.dataset.trimester || 0);
    const collection = data.type === 'Materia' ? subjectsCol : groupsCol;

    try {
        await updateDoc(doc(collection, data.id), { trimester: newTrimester });
        notification.show(`${data.type} asignado al cuatrimestre ${newTrimester || 'Sin Asignar'}.`);
    } catch (error) {
        notification.show("Error al asignar el cuatrimestre.", true);
    }
}

let resizingClass = null;
let initialY = 0;
let initialDuration = 0;

function handleResizeStart(e, classData) {
    e.preventDefault();
    e.stopPropagation();
    resizingClass = classData;
    initialY = e.clientY;
    initialDuration = classData.duration;
    document.querySelector(`.schedule-item[data-class-id="${resizingClass.id}"]`)?.classList.add('resizing');
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
}

function handleResizeMove(e) {
    if (!resizingClass) return;
    const deltaY = e.clientY - initialY;
    const rowHeight = 51;
    const newDuration = Math.max(1, initialDuration + Math.round(deltaY / rowHeight));
    const classElement = document.querySelector(`.schedule-item[data-class-id="${resizingClass.id}"]`);
    if (classElement) {
        classElement.style.height = `${(newDuration * 50) + ((newDuration - 1) * 1)}px`;
    }
}

async function handleResizeEnd(e) {
    const classElement = document.querySelector(`.schedule-item[data-class-id="${resizingClass.id}"]`);
    classElement?.classList.remove('resizing');
    const deltaY = e.clientY - initialY;
    const rowHeight = 51;
    const newDuration = Math.max(1, initialDuration + Math.round(deltaY / rowHeight));
    if (newDuration !== resizingClass.duration) {
        const updatedData = { ...resizingClass, duration: newDuration };
        if (!checkConflict(updatedData, resizingClass.id)) {
            try {
                await updateDoc(doc(scheduleCol, resizingClass.id), { duration: newDuration });
                notification.show("Duración actualizada.");
            } catch {
                notification.show("Error al actualizar.", true);
            }
        } else {
            notification.show("Conflicto al redimensionar.", true);
            if (classElement) classElement.style.height = `${(initialDuration * 50) + ((initialDuration - 1) * 1)}px`;
        }
    }
    resizingClass = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
}

async function advanceAllGroups() {
    modal.confirm("¿Avanzar Cuatrimestre?", 
    "Esta acción incrementará en 1 el cuatrimestre de TODOS los grupos. Los grupos del 9º cuatrimestre serán eliminados. <b>Esta acción es irreversible.</b>",
    async () => {
        const batch = writeBatch(db);
        let movedCount = 0;
        let deletedCount = 0;
        localState.groups.forEach(group => {
            if (group.trimester >= 9) {
                batch.delete(doc(groupsCol, group.id));
                deletedCount++;
            } else if (group.trimester > 0) {
                batch.update(doc(groupsCol, group.id), { trimester: group.trimester + 1 });
                movedCount++;
            }
        });
        try {
            await batch.commit();
            notification.show(`${movedCount} grupos avanzados, ${deletedCount} grupos eliminados.`);
        } catch (error) {
            notification.show("Error al avanzar los cuatrimestres.", true);
        }
    });
}

async function deleteClass(classId, classInfo) {
    modal.confirm('¿Eliminar clase?', `Vas a eliminar la clase de <b>${classInfo}</b>.`, async () => {
        try {
            await deleteDoc(doc(scheduleCol, classId));
            notification.show("Clase eliminada.");
        } catch (error) {
            notification.show("Error al eliminar la clase.", true);
        }
    });
}

const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const timeSlots = [];
function generateTimeOptions() {
    dom.daySelect.innerHTML = '';
    days.forEach(day => dom.daySelect.add(new Option(day, day)));
    
    if(timeSlots.length === 0) {
        for (let h = 7; h < 22; h++) {
            timeSlots.push(h);
            const time = `${String(h).padStart(2, '0')}:00`;
            dom.timeSelect.add(new Option(time, h));
        }
    }
}

async function saveClass() {
    const classData = {
        teacherId: dom.teacherSelect.value,
        subjectId: dom.subjectSelect.value,
        groupId: dom.groupSelect.value,
        day: dom.daySelect.value,
        startTime: parseInt(dom.timeSelect.value),
        duration: parseInt(dom.durationInput.value)
    };
    if (!classData.teacherId || !classData.subjectId || !classData.groupId) return notification.show("Por favor, selecciona todos los campos.", true);
    const editingId = dom.editingClassId.value;
    if (checkConflict(classData, editingId)) {
        notification.show("Conflicto de horario detectado. La clase choca con otra o con un bloqueo.", true);
        return;
    }
    try {
        if (editingId) {
            await updateDoc(doc(scheduleCol, editingId), classData);
            notification.show("Clase actualizada.");
        } else {
            await addDoc(scheduleCol, classData);
            notification.show("Clase guardada.");
        }
        resetForm();
    } catch (error) {
        notification.show("Error al guardar la clase.", true);
    }
}

function editClass(classData) {
    dom.formTitle.textContent = "Editando Clase";
    dom.subjectSelect.value = classData.subjectId;
    populateGroupFilter();
    dom.groupSelect.value = classData.groupId;
    dom.teacherSelect.value = classData.teacherId;
    dom.daySelect.value = classData.day;
    dom.timeSelect.value = classData.startTime;
    dom.durationInput.value = classData.duration;
    dom.editingClassId.value = classData.id;
    dom.cancelEditBtn.classList.remove('hidden');
    window.scrollTo({ top: dom.formTitle.offsetTop - 20, behavior: 'smooth' });
}

function resetForm() {
    dom.formTitle.textContent = "Agregar Nueva Clase";
    [dom.teacherSelect, dom.subjectSelect, dom.groupSelect].forEach(s => s.value = "");
    dom.daySelect.value = "Lunes"; dom.timeSelect.value = "7"; dom.durationInput.value = "1";
    dom.editingClassId.value = ""; dom.cancelEditBtn.classList.add('hidden');
    populateSubjectFilter();
    populateGroupFilter();
}

function runPedagogicalAnalysis() {
    if (!dom.alertsList) return;
    const alerts = [];
    localState.groups.forEach(group => {
        if (!group.trimester || group.trimester === 0) return;

        const requiredSubjects = localState.subjects.filter(s => s.trimester == group.trimester);
        const scheduledSubjects = localState.schedule
            .filter(c => c.groupId === group.id)
            .map(c => c.subjectId);
        
        requiredSubjects.forEach(subject => {
            if (!scheduledSubjects.includes(subject.id)) {
                alerts.push({
                    type: 'warning',
                    message: `Al grupo <b>${group.name}</b> le falta la materia <i>${subject.name}</i>.`
                });
            }
        });
    });

    renderAlerts(alerts);
}

function renderAlerts(alerts) {
    if (!dom.alertsList || !dom.noAlertsMessage) return;
    dom.alertsList.innerHTML = '';
    if (alerts.length === 0) {
        dom.noAlertsMessage.classList.remove('hidden');
        return;
    }
    
    dom.noAlertsMessage.classList.add('hidden');
    alerts.forEach(alert => {
        const li = document.createElement('li');
        li.className = 'flex items-start gap-2 text-sm p-2 rounded-md bg-yellow-50 border border-yellow-200';
        li.innerHTML = `
            <svg class="w-5 h-5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.636-1.223 2.443-1.223 3.08 0l6.273 12.088c.635 1.223-.27 2.713-1.54 2.713H3.524c-1.27 0-2.175-1.49-1.54-2.713L8.257 3.099zM9 13a1 1 0 112 0 1 1 0 01-2 0zm1-6a1 1 0 00-1 1v3a1 1 0 002 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
            <span>${alert.message}</span>
        `;
        dom.alertsList.appendChild(li);
    });
}

function updateWorkloadSummary() {
    if (!dom.teacherWorkload || !dom.groupWorkload) return;
    const teacherWorkload = {};
    const groupWorkload = {};

    localState.schedule.forEach(c => {
        teacherWorkload[c.teacherId] = (teacherWorkload[c.teacherId] || 0) + c.duration;
        groupWorkload[c.groupId] = (groupWorkload[c.groupId] || 0) + c.duration;
    });

    localState.blocks.forEach(block => {
        const affectedGroups = localState.groups.filter(g => g.trimester === block.trimester);
        const daysCount = block.days === 'L-V' ? 5 : 4;
        const blockHoursPerDay = block.endTime - block.startTime;
        
        affectedGroups.forEach(group => {
            groupWorkload[group.id] = (groupWorkload[group.id] || 0) + (blockHoursPerDay * daysCount);
        });
    });

    dom.teacherWorkload.innerHTML = '<h4 class="font-semibold text-gray-700">Docentes</h4>';
    [...localState.teachers].sort(sortByName).forEach(t => {
        const hours = teacherWorkload[t.id] || 0;
        const p = document.createElement('p');
        p.className = `text-sm ${hours > 20 ? 'text-red-600 font-bold' : 'text-gray-600'}`;
        p.textContent = `${t.name}: ${hours} hrs`;
        dom.teacherWorkload.appendChild(p);
    });

    dom.groupWorkload.innerHTML = '<h4 class="font-semibold text-gray-700">Grupos</h4>';
    [...localState.groups].sort(sortByName).forEach(g => {
        const hours = groupWorkload[g.id] || 0;
        const p = document.createElement('p');
        p.className = 'text-sm text-gray-600';
        p.textContent = `${g.name}: ${hours} hrs`;
        dom.groupWorkload.appendChild(p);
    });
}


// --- AUTENTICACIÓN Y ARRANQUE ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Usuario autenticado:", user.uid);
        startApp();
    }
});

(async () => {
    if (!auth.currentUser) {
        try {
            await signInAnonymously(auth);
        } catch (error) {
            notification.show("Error Crítico de Conexión.", true);
        }
    } else {
        startApp();
    }
})();
