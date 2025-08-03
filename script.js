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
    writeBatch,
    runTransaction
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

let localState = { teachers: [], subjects: [], groups: [], schedule: [], presets: [] };
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
                    <select id="modal-subject-trimester" class="mt-1 block w-full p-2 border rounded-lg">${trimesterOptions}</select>
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

// --- Lógica principal de la aplicación ---
function startApp() {
    if (isAppStarted) return;
    isAppStarted = true;
    console.log("App iniciada.");

    dom = {
        teacherName: document.getElementById('teacher-name'), addTeacherBtn: document.getElementById('add-teacher-btn'), teachersList: document.getElementById('teachers-list'),
        subjectsByTrimester: document.getElementById('subjects-by-trimester'), openSubjectModalBtn: document.getElementById('open-subject-modal-btn'),
        groupPrefixSelect: document.getElementById('group-prefix-select'), groupNumberInput: document.getElementById('group-number-input'), addGroupBtn: document.getElementById('add-group-btn'), groupsByTrimester: document.getElementById('groups-by-trimester'),
        teacherSelect: document.getElementById('teacher-select'), subjectSelect: document.getElementById('subject-select'), groupSelect: document.getElementById('group-select'),
        daySelect: document.getElementById('day-select'), timeSelect: document.getElementById('time-select'), durationInput: document.getElementById('duration-input'),
        saveClassBtn: document.getElementById('save-class-btn'), cancelEditBtn: document.getElementById('cancel-edit-btn'),
        formTitle: document.getElementById('form-title'), editingClassId: document.getElementById('editing-class-id'),
        scheduleGrid: document.getElementById('schedule-grid'),
        filterTeacher: document.getElementById('filter-teacher'), filterGroup: document.getElementById('filter-group'),
        alertsList: document.getElementById('alerts-list'), noAlertsMessage: document.getElementById('no-alerts-message'),
        teacherWorkload: document.getElementById('teacher-workload'), groupWorkload: document.getElementById('group-workload'),
        openPresetModalBtn: document.getElementById('open-preset-modal-btn'),
        presetsList: document.getElementById('presets-list'),
        advanceTrimesterBtn: document.getElementById('advance-trimester-btn'),
    };

    generateTimeOptions();
    setupEventListeners();

    // Suscripciones a Firestore
    onSnapshot(teachersCol, s => { localState.teachers = s.docs.map(d => ({ id: d.id, ...d.data() })); renderTeachersList(); populateSelect(dom.teacherSelect, localState.teachers, 'Seleccionar Docente'); populateSelect(dom.filterTeacher, localState.teachers, 'Todos los Docentes'); updateWorkloadSummary(); });
    onSnapshot(subjectsCol, s => { localState.subjects = s.docs.map(d => ({ id: d.id, ...d.data() })); renderSubjectsByTrimester(); populateSubjectFilter(); });
    onSnapshot(groupsCol, s => { localState.groups = s.docs.map(d => ({ id: d.id, ...d.data() })); renderGroupsByTrimester(); populateSelect(dom.groupSelect, localState.groups, 'Seleccionar Grupo'); populateSelect(dom.filterGroup, localState.groups, 'Todos los Grupos'); updateWorkloadSummary(); });
    onSnapshot(scheduleCol, s => { localState.schedule = s.docs.map(d => ({ id: d.id, ...d.data() })); renderScheduleGrid(); runPedagogicalAnalysis(); updateWorkloadSummary(); });
    onSnapshot(presetsCol, s => { localState.presets = s.docs.map(d => ({ id: d.id, ...d.data() })); renderPresetsList(); });
}

function setupEventListeners() {
    dom.addTeacherBtn.onclick = () => addItem(teachersCol, { name: dom.teacherName.value }, dom.teacherName, 'Docente');
    dom.addGroupBtn.onclick = addGroup;
    dom.openSubjectModalBtn.onclick = () => modal.showSubjectForm();
    dom.saveClassBtn.onclick = saveClass;
    dom.cancelEditBtn.onclick = resetForm;
    dom.filterTeacher.onchange = renderScheduleGrid;
    dom.filterGroup.onchange = () => {
        populateSubjectFilter();
        renderScheduleGrid();
    };
    dom.openPresetModalBtn.onclick = () => modal.showPresetForm();
    dom.advanceTrimesterBtn.onclick = advanceAllGroups;
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
    
    let trimester = 1;
    if (number >= 100 && number < 200) trimester = 1;
    else if (number >= 200 && number < 300) trimester = 2;
    else if (number >= 300 && number < 400) trimester = 3;
    else if (number >= 400 && number < 500) trimester = 4;
    else if (number >= 500 && number < 600) trimester = 5;
    else if (number >= 600 && number < 700) trimester = 6;
    else if (number >= 700 && number < 800) trimester = 7;
    else if (number >= 800 && number < 900) trimester = 8;
    else if (number >= 900 && number < 1000) trimester = 9;

    const groupData = {
        name: `${prefix}-${number}`,
        trimester: trimester
    };

    try {
        await addDoc(groupsCol, groupData);
        dom.groupNumberInput.value = '';
        notification.show(`Grupo "${groupData.name}" agregado.`);
    } catch (error) {
        notification.show("No se pudo agregar el grupo.", true);
    }
}

// --- Renderizado de Paneles de Gestión ---
function createManagementItem(item, collection, type) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'management-item';
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

function renderTeachersList() {
    dom.teachersList.innerHTML = '';
    localState.teachers.forEach(teacher => {
        dom.teachersList.appendChild(createManagementItem(teacher, teachersCol, 'Docente'));
    });
}

function renderSubjectsByTrimester() {
    dom.subjectsByTrimester.innerHTML = '';
    for (let i = 1; i <= 9; i++) {
        const column = document.createElement('div');
        column.className = 'trimester-column space-y-2';
        column.innerHTML = `<h3>Cuatri ${i}</h3>`;
        const subjectsInTrimester = localState.subjects.filter(s => s.trimester == i);
        if (subjectsInTrimester.length > 0) {
            subjectsInTrimester.forEach(subject => {
                column.appendChild(createManagementItem(subject, subjectsCol, 'Materia'));
            });
        } else {
            column.innerHTML += `<p class="text-xs text-gray-400">Sin materias</p>`;
        }
        dom.subjectsByTrimester.appendChild(column);
    }
}

function renderGroupsByTrimester() {
    dom.groupsByTrimester.innerHTML = '';
     for (let i = 1; i <= 9; i++) {
        const groupsInTrimester = localState.groups.filter(g => g.trimester == i);
        if (groupsInTrimester.length > 0) {
            const block = document.createElement('div');
            block.className = 'group-trimester-block';
            block.innerHTML = `<h3>Cuatrimestre ${i}</h3>`;
            const list = document.createElement('div');
            list.className = 'space-y-2';
            groupsInTrimester.forEach(group => {
                list.appendChild(createManagementItem(group, groupsCol, 'Grupo'));
            });
            block.appendChild(list);
            dom.groupsByTrimester.appendChild(block);
        }
    }
}

// --- Lógica de Formularios y Edición ---
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
    const selectedGroupId = dom.filterGroup.value;
    const selectedGroup = localState.groups.find(g => g.id === selectedGroupId);
    
    let subjectsToShow = localState.subjects;
    if (selectedGroup) {
        subjectsToShow = localState.subjects.filter(s => s.trimester == selectedGroup.trimester);
    }
    
    populateSelect(dom.subjectSelect, subjectsToShow, 'Seleccionar Materia');
}

// --- Lógica de Plantillas (Presets) y Drag-n-Drop ---
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

// --- Lógica de Redimensionamiento de Clases ---
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
    const rowHeight = 51; // 50px height + 1px gap
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

// --- Lógica de Administración ---
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
            } else {
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

// --- Funciones de la Aplicación (Restantes) ---
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

const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const timeSlots = [];
function generateTimeOptions() {
    days.forEach(day => dom.daySelect.add(new Option(day, day)));
    for (let h = 7; h < 22; h++) {
        timeSlots.push(h);
        const time = `${String(h).padStart(2, '0')}:00`;
        dom.timeSelect.add(new Option(time, h));
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
    if (checkConflict(classData, editingId)) return notification.show("Conflicto de horario detectado.", true);
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

function checkConflict(newClass, ignoreId = null) {
    const newStart = newClass.startTime;
    const newEnd = newStart + newClass.duration;
    return localState.schedule.some(existingClass => {
        if (existingClass.id === ignoreId || existingClass.day !== newClass.day) return false;
        if (existingClass.teacherId === newClass.teacherId || existingClass.groupId === newClass.groupId) {
            const existingStart = existingClass.startTime;
            const existingEnd = existingStart + existingClass.duration;
            return newStart < existingEnd && newEnd > existingStart;
        }
        return false;
    });
}

function renderScheduleGrid() {
    dom.scheduleGrid.innerHTML = '';
    dom.scheduleGrid.appendChild(document.createElement('div'));
    days.forEach(day => { const header = document.createElement('div'); header.className = 'grid-header'; header.textContent = day; dom.scheduleGrid.appendChild(header); });
    timeSlots.forEach(time => {
        const timeSlot = document.createElement('div');
        timeSlot.className = 'grid-time-slot';
        timeSlot.textContent = `${time}:00`;
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
    const filteredSchedule = localState.schedule.filter(c => (!dom.filterTeacher.value || c.teacherId === dom.filterTeacher.value) && (!dom.filterGroup.value || c.groupId === dom.filterGroup.value));
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
            const timeColumnWidth = 60;
            const dayColumnWidth = (dom.scheduleGrid.offsetWidth - timeColumnWidth) / days.length;
            const itemWidth = dayColumnWidth / totalOverlaps;
            itemDiv.style.top = `${(timeIndex + 1) * 51}px`;
            itemDiv.style.left = `${timeColumnWidth + (dayIndex * dayColumnWidth) + (overlapIndex * itemWidth)}px`;
            itemDiv.style.width = `${itemWidth - 2}px`;
            itemDiv.style.height = `${(c.duration * 50) + ((c.duration - 1) * 1)}px`;
            let subjectName = subject.name;
            if (totalOverlaps > 1) { itemDiv.style.fontSize = '0.65rem'; subjectName = getInitials(subject.name); }
            itemDiv.innerHTML = `<div class="font-bold">${subjectName}</div><div>${teacher.name.split(' ')[0]}</div><div class="italic">${group.name}</div><div class="actions"><button title="Editar">✏️</button><button title="Eliminar">🗑️</button></div><div class="resize-handle"></div>`;
            const [editBtn, deleteBtn] = itemDiv.querySelectorAll('button');
            editBtn.onclick = (e) => { e.stopPropagation(); editClass(c); };
            deleteBtn.onclick = (e) => { e.stopPropagation(); deleteClass(c.id, `${subject.name} con ${teacher.name}`); };
            itemDiv.querySelector('.resize-handle').addEventListener('mousedown', (e) => handleResizeStart(e, c));
            dom.scheduleGrid.appendChild(itemDiv);
        });
    });
}

function editClass(classData) {
    dom.formTitle.textContent = "Editando Clase";
    dom.teacherSelect.value = classData.teacherId;
    dom.subjectSelect.value = classData.subjectId;
    dom.groupSelect.value = classData.groupId;
    dom.daySelect.value = classData.day;
    dom.timeSelect.value = classData.startTime;
    dom.durationInput.value = classData.duration;
    dom.editingClassId.value = classData.id;
    dom.cancelEditBtn.classList.remove('hidden');
    window.scrollTo({ top: dom.formTitle.offsetTop - 20, behavior: 'smooth' });
}

function resetForm() {
    dom.formTitle.textContent = "Agregar Nueva Clase";
    dom.teacherSelect.value = ""; dom.subjectSelect.value = ""; dom.groupSelect.value = "";
    dom.daySelect.value = "Lunes"; dom.timeSelect.value = "7"; dom.durationInput.value = "1";
    dom.editingClassId.value = ""; dom.cancelEditBtn.classList.add('hidden');
}

function runPedagogicalAnalysis() { /* ... Lógica de análisis ... */ }
function renderAlerts(alerts) { /* ... Lógica de renderizado de alertas ... */ }
function updateWorkloadSummary() { /* ... Lógica de resumen de carga horaria ... */ }
function handleImportClick(collectionRef) { /* ... Lógica de importación ... */ }
function processCSV(event, collectionRef) { /* ... Lógica de procesado de CSV ... */ }
function exportToCSV() { /* ... Lógica de exportación ... */ }

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
