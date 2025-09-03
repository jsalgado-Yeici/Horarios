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
const classroomsCol = getCollectionRef('classrooms');

let localState = { teachers: [], subjects: [], groups: [], schedule: [], presets: [], blocks: [], classrooms: [] };
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
                    <button id="modal-cancel-btn" class="btn btn-secondary">Cancelar</button>
                    <button id="modal-confirm-btn" class="btn btn-danger">Confirmar</button>
                </div>
            </div>`;
        this.show(confirmHtml);
        document.getElementById('modal-cancel-btn').onclick = () => this.hide();
        document.getElementById('modal-confirm-btn').onclick = () => {
            this.hide();
            if (onConfirm) onConfirm();
        };
    },
    showTeacherForm(teacher = null) {
        const isEditing = teacher !== null;
        const title = isEditing ? 'Editar Perfil de Docente' : 'Nuevo Docente';
        const groupedSubjects = localState.subjects.reduce((acc, subject) => {
            const trimester = subject.trimester || 0;
            if (!acc[trimester]) acc[trimester] = [];
            acc[trimester].push(subject);
            return acc;
        }, {});
        const sortedTrimesters = Object.keys(groupedSubjects).sort((a, b) => a - b);
        let subjectsHtml = '';
        if (localState.subjects.length > 0) {
            sortedTrimesters.forEach(trimester => {
                const trimesterName = trimester === '0' ? 'Sin Asignar' : `Cuatrimestre ${trimester}`;
                subjectsHtml += `<div class="trimester-group"><h4 class="text-md font-semibold text-gray-600 my-2 sticky top-0 bg-gray-50 py-1">${trimesterName}</h4>`;
                const subjectsInGroup = groupedSubjects[trimester].sort(sortByName);
                subjectsInGroup.forEach(subject => {
                    const isChecked = isEditing && teacher.subjects && teacher.subjects.includes(subject.id);
                    subjectsHtml += `<label class="subject-label flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100"><input type="checkbox" class="subject-checkbox rounded" value="${subject.id}" ${isChecked ? 'checked' : ''}><span>${subject.name}</span></label>`;
                });
                subjectsHtml += `</div>`;
            });
        } else {
            subjectsHtml = '<p class="text-sm text-gray-500">No hay materias para asignar.</p>';
        }

        const formHtml = `
            <h2 class="text-2xl font-semibold mb-6">${title}</h2>
            <div class="space-y-4 text-left">
                <div><label class="block text-sm font-medium text-gray-700">Apodo / Nombre Corto</label><input type="text" id="modal-teacher-name" class="mt-1 block w-full p-2 border rounded-lg" value="${isEditing ? teacher.name : ''}" placeholder="Ej: Alex"></div>
                <div><label class="block text-sm font-medium text-gray-700">Nombre Completo</label><input type="text" id="modal-teacher-fullname" class="mt-1 block w-full p-2 border rounded-lg" value="${isEditing && teacher.fullName ? teacher.fullName : ''}" placeholder="Ej: Alejandro Hernández"></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-2">Materias que puede impartir</label><input type="text" id="modal-subject-search" class="w-full p-2 border rounded-lg mb-2" placeholder="Buscar materia..."><div id="subjects-list" class="max-h-60 overflow-y-auto border rounded-lg p-2 bg-gray-50 relative">${subjectsHtml}</div></div>
            </div>
            <div class="mt-6 flex gap-4"><button id="modal-cancel-btn" class="w-full btn btn-secondary">Cancelar</button><button id="modal-save-btn" class="w-full btn btn-primary">Guardar Cambios</button></div>`;
        this.show(formHtml);

        const searchInput = document.getElementById('modal-subject-search');
        searchInput.addEventListener('keyup', () => {
            const filter = searchInput.value.toLowerCase();
            document.querySelectorAll('.trimester-group').forEach(group => {
                let groupVisible = false;
                group.querySelectorAll('.subject-label').forEach(label => {
                    const text = label.textContent.toLowerCase();
                    if (text.includes(filter)) {
                        label.style.display = 'flex';
                        groupVisible = true;
                    } else {
                        label.style.display = 'none';
                    }
                });
                group.style.display = groupVisible ? 'block' : 'none';
            });
        });
        document.getElementById('modal-cancel-btn').onclick = () => this.hide();
        document.getElementById('modal-save-btn').onclick = () => saveTeacher(teacher ? teacher.id : null);
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
                <div><label class="block text-sm font-medium text-gray-700">Nombre de la Materia</label><input type="text" id="modal-subject-name" class="mt-1 block w-full p-2 border rounded-lg" value="${isEditing ? subject.name : ''}"></div>
                <div><label class="block text-sm font-medium text-gray-700">Cuatrimestre</label><select id="modal-subject-trimester" class="mt-1 block w-full p-2 border rounded-lg"><option value="0" ${isEditing && (!subject.trimester || subject.trimester === 0) ? 'selected' : ''}>Sin Asignar</option>${trimesterOptions}</select></div>
            </div>
            <div class="mt-6 flex gap-4"><button id="modal-cancel-btn" class="w-full btn btn-secondary">Cancelar</button><button id="modal-save-btn" class="w-full btn btn-indigo">Guardar</button></div>`;
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
                <div><label class="block text-sm font-medium text-gray-700">Nombre del Grupo</label><input type="text" id="modal-group-name" class="mt-1 block w-full p-2 border rounded-lg" value="${group.name}"></div>
                <div><label class="block text-sm font-medium text-gray-700">Cuatrimestre</label><select id="modal-group-trimester" class="mt-1 block w-full p-2 border rounded-lg"><option value="0" ${!group.trimester || group.trimester === 0 ? 'selected' : ''}>Sin Asignar</option>${trimesterOptions}</select></div>
            </div>
            <div class="mt-6 flex gap-4"><button id="modal-cancel-btn" class="w-full btn btn-secondary">Cancelar</button><button id="modal-save-btn" class="w-full btn btn-purple">Guardar</button></div>`;
        this.show(formHtml);
        document.getElementById('modal-cancel-btn').onclick = () => this.hide();
        document.getElementById('modal-save-btn').onclick = () => saveGroup(group.id);
    },
    showPresetForm() {
        const formHtml = `
            <h2 class="text-2xl font-semibold mb-4">Crear Plantilla</h2>
            <div class="space-y-3 mb-4 text-left">
                <select id="modal-preset-teacher" class="w-full p-2 border rounded-lg"></select>
                <select id="modal-preset-subject" class="w-full p-2 border rounded-lg"></select>
                <select id="modal-preset-group" class="w-full p-2 border rounded-lg"></select>
            </div>
            <div class="flex gap-4"><button id="modal-cancel-btn" class="w-full btn btn-secondary">Cancelar</button><button id="modal-save-preset-btn" class="w-full btn btn-cyan">Guardar</button></div>`;
        this.show(formHtml);
        const teacherSelect = document.getElementById('modal-preset-teacher');
        const subjectSelect = document.getElementById('modal-preset-subject');
        populateSelect(teacherSelect, localState.teachers, 'Seleccionar Docente');
        populateSelect(subjectSelect, [], 'Seleccione un docente primero');
        populateSelect(document.getElementById('modal-preset-group'), localState.groups, 'Seleccionar Grupo');
        teacherSelect.onchange = () => populateFilteredSubjects(subjectSelect, teacherSelect.value);
        document.getElementById('modal-cancel-btn').onclick = () => this.hide();
        document.getElementById('modal-save-preset-btn').onclick = savePreset;
    }
};

function getInitials(name) {
    if (!name || typeof name !== 'string') return '';
    const words = name.trim().split(/\s+/);
    if (words.length > 1) return words.map(word => word[0]).join('').toUpperCase();
    return name.substring(0, 3).toUpperCase();
}

function populateSelect(selectElement, dataArray, placeholderText, defaultOption = true) {
    const currentValue = selectElement.value;
    selectElement.innerHTML = '';
    if (defaultOption) {
        selectElement.add(new Option(placeholderText, ''));
    }
    dataArray.sort(sortByName).forEach(item => {
        selectElement.add(new Option(item.name, item.id));
    });
    selectElement.value = currentValue;
}

function populateFilteredSubjects(subjectSelectElement, teacherId) {
    const teacher = localState.teachers.find(t => t.id === teacherId);
    if (teacher && teacher.subjects && teacher.subjects.length > 0) {
        const subjectsToShow = localState.subjects.filter(s => teacher.subjects.includes(s.id));
        populateSelect(subjectSelectElement, subjectsToShow, 'Seleccionar Materia');
    } else if (teacher) {
        populateSelect(subjectSelectElement, [], 'Este docente no tiene materias');
    } else {
        populateSelect(subjectSelectElement, localState.subjects, 'Seleccionar Materia');
    }
}

// --- Lógica principal de la aplicación ---
function startApp() {
    if (isAppStarted) return;
    isAppStarted = true;
    console.log("App iniciada.");

    dom = {
        addTeacherBtn: document.getElementById('add-teacher-btn'),
        teachersList: document.getElementById('teachers-list'),
        subjectsByTrimester: document.getElementById('subjects-by-trimester'), 
        openSubjectModalBtn: document.getElementById('open-subject-modal-btn'),
        unassignedSubjectsContainer: document.getElementById('unassigned-subjects-container'),
        groupPrefixSelect: document.getElementById('group-prefix-select'), 
        groupNumberInput: document.getElementById('group-number-input'),
        groupTrimesterSelect: document.getElementById('group-trimester-select'),
        addGroupBtn: document.getElementById('add-group-btn'), 
        groupsByTrimester: document.getElementById('groups-by-trimester'),
        unassignedGroupsContainer: document.getElementById('unassigned-groups-container'),
        teacherSelect: document.getElementById('teacher-select'), 
        subjectSelect: document.getElementById('subject-select'), 
        groupSelect: document.getElementById('group-select'),
        daySelect: document.getElementById('day-select'), 
        timeSelect: document.getElementById('time-select'), 
        durationInput: document.getElementById('duration-input'),
        saveClassBtn: document.getElementById('save-class-btn'), 
        cancelEditBtn: document.getElementById('cancel-edit-btn'),
        formTitle: document.getElementById('form-title'), 
        editingClassId: document.getElementById('editing-class-id'),
        scheduleGrid: document.getElementById('schedule-grid'),
        filterTeacher: document.getElementById('filter-teacher'), 
        filterGroup: document.getElementById('filter-group'),
        filterTrimester: document.getElementById('filter-trimester'),
        alertsList: document.getElementById('alerts-list'), 
        noAlertsMessage: document.getElementById('no-alerts-message'),
        teacherWorkload: document.getElementById('teacher-workload'), 
        groupWorkload: document.getElementById('group-workload'),
        advanceTrimesterBtn: document.getElementById('advance-trimester-btn'),
        openPresetModalBtn: document.getElementById('open-preset-modal-btn'),
        presetsList: document.getElementById('presets-list'),
        blockTrimester: document.getElementById('block-trimester'),
        blockTime: document.getElementById('block-time'),
        blockDays: document.getElementById('block-days'),
        addBlockBtn: document.getElementById('add-block-btn'),
        blocksList: document.getElementById('blocks-list'),
        classroomsList: document.getElementById('classrooms-list'),
        addClassroomBtn: document.getElementById('add-classroom-btn'),
    };

    generateTimeOptions();
    setupEventListeners();
    populateBlockerForm();
    populateTrimesterFilter();

    onSnapshot(teachersCol, s => { localState.teachers = s.docs.map(d => ({ id: d.id, ...d.data() })); renderTeachersList(); populateSelect(dom.teacherSelect, localState.teachers, 'Seleccionar Docente'); populateSelect(dom.filterTeacher, localState.teachers, 'Todos los Docentes'); updateWorkloadSummary(); });
    onSnapshot(subjectsCol, s => { localState.subjects = s.docs.map(d => ({ id: d.id, ...d.data() })); renderSubjectsByTrimester(); populateFilteredSubjects(dom.subjectSelect, dom.teacherSelect.value); runPedagogicalAnalysis(); });
    onSnapshot(groupsCol, s => { localState.groups = s.docs.map(d => ({ id: d.id, ...d.data() })); renderGroupsByTrimester(); populateSelect(dom.groupSelect, localState.groups, "Seleccionar Grupo"); populateSelect(dom.filterGroup, localState.groups, "Todos los Grupos"); updateWorkloadSummary(); runPedagogicalAnalysis(); });
    onSnapshot(scheduleCol, s => { localState.schedule = s.docs.map(d => ({ id: d.id, ...d.data() })); renderScheduleGrid(); runPedagogicalAnalysis(); updateWorkloadSummary(); });
    onSnapshot(presetsCol, s => { localState.presets = s.docs.map(d => ({ id: d.id, ...d.data() })); renderPresetsList(); });
    onSnapshot(blocksCol, s => { localState.blocks = s.docs.map(d => ({ id: d.id, ...d.data() })); renderScheduleGrid(); renderBlocksList(); updateWorkloadSummary(); });
    onSnapshot(classroomsCol, s => { localState.classrooms = s.docs.map(d => ({ id: d.id, ...d.data() })); renderClassroomsList(); });
}

function setupEventListeners() {
    dom.addTeacherBtn.onclick = () => modal.showTeacherForm();
    dom.addGroupBtn.onclick = addGroup;
    dom.openSubjectModalBtn.onclick = () => modal.showSubjectForm();
    dom.saveClassBtn.onclick = saveClass;
    dom.cancelEditBtn.onclick = resetForm;
    dom.filterTeacher.onchange = renderScheduleGrid;
    dom.filterGroup.onchange = renderScheduleGrid;
    dom.filterTrimester.onchange = renderScheduleGrid;
    dom.teacherSelect.onchange = () => populateFilteredSubjects(dom.subjectSelect, dom.teacherSelect.value);
    dom.groupSelect.onchange = populateSubjectFilter;
    dom.subjectSelect.onchange = populateGroupFilter;
    dom.advanceTrimesterBtn.onclick = advanceAllGroups;
    dom.addBlockBtn.onclick = addBlock;
    dom.openPresetModalBtn.onclick = () => modal.showPresetForm();
    dom.addClassroomBtn.onclick = addClassroom;
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', () => header.parentElement.classList.toggle('collapsed'));
    });
}

// --- LÓGICA DE GESTIÓN (AULAS, DOCENTES, ETC) ---

async function addClassroom() {
    const nameInput = document.getElementById('classroom-name');
    const name = nameInput.value.trim();
    if (!name) return notification.show("El nombre del aula no puede estar vacío.", true);
    try {
        await addDoc(classroomsCol, { name });
        notification.show(`Aula "${name}" agregada.`);
        nameInput.value = '';
    } catch (e) {
        notification.show("Error al agregar el aula.", true);
        console.error(e);
    }
}

function renderClassroomsList() {
    if (!dom.classroomsList) return;
    dom.classroomsList.innerHTML = '';
    [...localState.classrooms].sort(sortByName).forEach(classroom => {
        dom.classroomsList.appendChild(createManagementItem(classroom, classroomsCol, 'Aula'));
    });
}

async function saveTeacher(teacherId) {
    const name = document.getElementById('modal-teacher-name').value;
    if (!name.trim()) return notification.show("El apodo no puede estar vacío.", true);
    const selectedSubjects = Array.from(document.querySelectorAll('.subject-checkbox:checked')).map(cb => cb.value);
    const teacherData = { name: name, fullName: document.getElementById('modal-teacher-fullname').value, subjects: selectedSubjects };
    try {
        if (teacherId) {
            await updateDoc(doc(teachersCol, teacherId), teacherData);
            notification.show("Docente actualizado.");
        } else {
            await addDoc(teachersCol, teacherData);
            notification.show("Docente agregado.");
        }
        modal.hide();
    } catch (error) {
        notification.show("Error al guardar docente.", true);
        console.error("Error saving teacher:", error);
    }
}

async function addGroup() {
    const prefix = dom.groupPrefixSelect.value;
    const number = dom.groupNumberInput.value;
    if (!number) return notification.show("Introduce un número de grupo.", true);
    const groupData = { name: `${prefix}-${number}`, trimester: parseInt(dom.groupTrimesterSelect.value) };
    try {
        await addDoc(groupsCol, groupData);
        dom.groupNumberInput.value = '';
        dom.groupTrimesterSelect.value = 0;
        notification.show(`Grupo "${groupData.name}" agregado.`);
    } catch (error) {
        notification.show("No se pudo agregar el grupo.", true);
    }
}

function createManagementItem(item, collection, type) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'management-item';
    let mainText = item.name;
    if (type === 'Docente' && item.fullName) {
        mainText = `${item.name} <span class="text-gray-500 text-xs">(${item.fullName})</span>`;
    }
    itemDiv.innerHTML = `<span class="flex-grow">${mainText}</span><div class="actions"><button class="edit-btn" title="Editar">✏️</button><button class="delete-btn" title="Eliminar">🗑️</button></div>`;
    itemDiv.querySelector('.edit-btn').onclick = () => {
        if (type === 'Docente') modal.showTeacherForm(item);
        else if (type === 'Materia') modal.showSubjectForm(item);
        else if (type === 'Grupo') modal.showGroupForm(item);
        else if (type === 'Aula') {
            const newName = prompt('Editar nombre del aula:', item.name);
            if (newName && newName.trim() !== '') {
                updateDoc(doc(collection, item.id), { name: newName.trim() });
            }
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
    if (!dom.subjectsByTrimester) return;
    dom.subjectsByTrimester.innerHTML = '';
    const sortedSubjects = [...localState.subjects].sort(sortByName);
    for (let i = 1; i <= 9; i++) {
        const column = document.createElement('div');
        column.className = 'trimester-column space-y-2';
        column.dataset.trimester = i;
        column.innerHTML = `<h3>Cuatri ${i}</h3>`;
        const subjectsInTrimester = sortedSubjects.filter(s => s.trimester == i);
        if (subjectsInTrimester.length > 0) {
            subjectsInTrimester.forEach(subject => {
                column.appendChild(createManagementItem(subject, subjectsCol, 'Materia', false));
            });
        } else {
            column.innerHTML += `<p class="text-xs text-gray-400">No hay materias en este cuatri.</p>`;
        }
        dom.subjectsByTrimester.appendChild(column);
    }
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
            groupsInTrimester.forEach(group => list.appendChild(createManagementItem(group, groupsCol, 'Grupo')));
            block.appendChild(list);
            dom.groupsByTrimester.appendChild(block);
        }
    }
    const unassignedGroups = sortedGroups.filter(g => !g.trimester || g.trimester === 0);
    if (unassignedGroups.length > 0) {
        unassignedGroups.forEach(group => dom.unassignedGroupsContainer.appendChild(createManagementItem(group, groupsCol, 'Grupo')));
    } else {
        dom.unassignedGroupsContainer.innerHTML = `<p class="text-xs text-gray-400">Todos los grupos están asignados.</p>`;
    }
}

async function saveSubject(subjectId = null) {
    const subjectData = { name: document.getElementById('modal-subject-name').value, trimester: parseInt(document.getElementById('modal-subject-trimester').value) };
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
    const groupData = { name: document.getElementById('modal-group-name').value, trimester: parseInt(document.getElementById('modal-group-trimester').value) };
    if (!groupData.name) return notification.show("El nombre no puede estar vacío.", true);
    try {
        await updateDoc(doc(groupsCol, groupId), groupData);
        notification.show("Grupo actualizado.");
        modal.hide();
    } catch (error) {
        notification.show("Error al actualizar el grupo.", true);
    }
}

function populateSubjectFilter() {
    const selectedGroupId = dom.groupSelect.value;
    const selectedGroup = localState.groups.find(g => g.id === selectedGroupId);
    const subjectsToShow = (selectedGroup && selectedGroup.trimester > 0) ? localState.subjects.filter(s => s.trimester == selectedGroup.trimester) : localState.subjects;
    populateSelect(dom.subjectSelect, subjectsToShow.sort(sortByName), 'Seleccionar Materia');
}

function populateGroupFilter() {
    const selectedSubjectId = dom.subjectSelect.value;
    const selectedSubject = localState.subjects.find(s => s.id === selectedSubjectId);
    const groupsToShow = (selectedSubject && selectedSubject.trimester > 0) ? localState.groups.filter(g => g.trimester == selectedSubject.trimester) : localState.groups;
    populateSelect(dom.groupSelect, groupsToShow.sort(sortByName), 'Seleccionar Grupo');
}

// --- LÓGICA DE BLOQUEO MANUAL ---

function populateBlockerForm() {
    for (let i = 1; i <= 9; i++) dom.blockTrimester.add(new Option(`Cuatrimestre ${i}`, i));
    for (let h = 7; h < 21; h++) dom.blockTime.add(new Option(`${h}:00 - ${h+2}:00`, h));
}

async function addBlock() {
    const blockData = { trimester: parseInt(dom.blockTrimester.value), startTime: parseInt(dom.blockTime.value), endTime: parseInt(dom.blockTime.value) + 2, days: dom.blockDays.value };
    if (localState.blocks.some(b => b.trimester === blockData.trimester && b.startTime === blockData.startTime && b.days === blockData.days)) {
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
        const affectedGroups = localState.groups.filter(g => g.trimester === block.trimester).map(g => g.name).join(', ');
        blockDiv.innerHTML = `<div><p class="font-semibold">Cuatri ${block.trimester}: ${block.startTime}:00-${block.endTime}:00 (${block.days})</p><p class="text-xs text-gray-500">Grupos: ${affectedGroups || 'Ninguno'}</p></div><div class="actions"><button class="delete-btn" title="Eliminar">🗑️</button></div>`;
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

// --- LÓGICA DEL HORARIO (DRAG & DROP, RENDERIZADO) ---

function populateTrimesterFilter() {
    dom.filterTrimester.innerHTML = '<option value="">Todos los Cuatris</option>';
    for (let i = 1; i <= 9; i++) dom.filterTrimester.add(new Option(`Cuatrimestre ${i}`, i));
}

function renderScheduleGrid() {
    if (!dom.scheduleGrid) return;
    dom.scheduleGrid.innerHTML = '';
    dom.scheduleGrid.appendChild(document.createElement('div'));
    days.forEach(day => { const header = document.createElement('div'); header.className = 'grid-header'; header.textContent = day; dom.scheduleGrid.appendChild(header); });
    timeSlots.forEach(time => {
        const timeSlot = document.createElement('div'); timeSlot.className = 'grid-time-slot'; timeSlot.textContent = `${time}:00 - ${time + 1}:00`; dom.scheduleGrid.appendChild(timeSlot);
        days.forEach(day => {
            const cell = document.createElement('div'); cell.className = 'grid-cell'; cell.dataset.day = day; cell.dataset.hour = time;
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
            const subjectColor = getSubjectColor(subject.id);
            itemDiv.style.borderColor = subjectColor;
            itemDiv.style.backgroundColor = `${subjectColor}20`;
            const timeColumnWidth = 120;
            const dayColumnWidth = (dom.scheduleGrid.offsetWidth - timeColumnWidth) / days.length;
            const gridCellHeight = 51;
            const itemWidth = (dayColumnWidth / totalOverlaps) - 4;
            const itemLeftOffsetWithinDay = (dayColumnWidth / totalOverlaps) * overlapIndex;
            itemDiv.style.top = `${(timeIndex * gridCellHeight) + gridCellHeight}px`;
            itemDiv.style.left = `${timeColumnWidth + 2 + (dayIndex * dayColumnWidth) + itemLeftOffsetWithinDay}px`;
            itemDiv.style.width = `${itemWidth}px`;
            itemDiv.style.height = `${(c.duration * gridCellHeight) - 2}px`;
            itemDiv.style.zIndex = 10 + overlapIndex;
            let subjectNameDisplay = subject.name;
            const classroom = localState.classrooms.find(cr => cr.id === c.classroomId);
            let detailsHtml = `<div class="item-details">${teacher.name.split(' ')[0]} / ${group.name}`;
            if (classroom) detailsHtml += ` / ${classroom.name}`;
            detailsHtml += `</div>`;
            if (totalOverlaps >= 3) {
                subjectNameDisplay = getInitials(subject.name);
                detailsHtml = '';
                itemDiv.style.fontSize = '0.7rem';
            }
            itemDiv.innerHTML = `<div class="item-content"><div class="subject-name">${subjectNameDisplay}</div>${detailsHtml}</div><div class="actions"><button title="Editar">✏️</button><button title="Eliminar">🗑️</button></div><div class="resize-handle"></div>`;
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
    const filteredBlocks = localState.blocks.filter(block => !selectedTrimester || block.trimester == selectedTrimester);
    filteredBlocks.forEach(block => {
        const startHour = parseInt(block.startTime), endHour = parseInt(block.endTime), duration = endHour - startHour;
        const daysToRender = [];
        if (block.days.toUpperCase() === 'L-V') daysToRender.push('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes');
        else if (block.days.toUpperCase() === 'L-J') daysToRender.push('Lunes', 'Martes', 'Miércoles', 'Jueves');
        daysToRender.forEach(day => {
            const dayIndex = days.indexOf(day), timeIndex = timeSlots.indexOf(startHour);
            if (dayIndex === -1 || timeIndex === -1) return;
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
    for (const existingClass of localState.schedule) {
        if (existingClass.id === ignoreId || existingClass.day !== newClass.day) continue;
        const existingStart = existingClass.startTime, existingEnd = existingStart + existingClass.duration;
        const timeOverlap = newStart < existingEnd && newEnd > existingStart;
        if (timeOverlap) {
            if (existingClass.teacherId === newClass.teacherId) { notification.show("Conflicto: El docente ya tiene una clase a esa hora.", true); return true; }
            if (existingClass.groupId === newClass.groupId) { notification.show("Conflicto: El grupo ya tiene una clase a esa hora.", true); return true; }
            if (existingClass.classroomId && newClass.classroomId && existingClass.classroomId === newClass.classroomId) { notification.show("Conflicto: El aula ya está ocupada a esa hora.", true); return true; }
        }
    }
    const group = localState.groups.find(g => g.id === newClass.groupId);
    if (group) {
        const blockConflict = localState.blocks.some(block => {
            if (block.trimester != group.trimester) return false;
            const daysOfBlock = block.days === 'L-V' ? ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] : ['Lunes', 'Martes', 'Miércoles', 'Jueves'];
            if (!daysOfBlock.includes(newClass.day)) return false;
            const blockStart = parseInt(block.startTime), blockEnd = parseInt(block.endTime);
            return newStart < blockEnd && newEnd > blockStart;
        });
        if (blockConflict) { notification.show("Conflicto: La clase choca con un bloqueo (ej. Inglés).", true); return true; }
    }
    return false;
}

async function createClassFromModal(subjectId, day, startTime) {
    const groupId = document.getElementById('modal-assign-group').value;
    const teacherId = document.getElementById('modal-assign-teacher').value;
    const classroomId = document.getElementById('modal-assign-classroom').value;
    const duration = parseInt(document.getElementById('modal-assign-duration').value);
    if (!groupId || !teacherId || !classroomId) return notification.show("Debes seleccionar grupo, aula y docente.", true);
    const classData = { subjectId, day, startTime, groupId, teacherId, duration, classroomId };
    if (checkConflict(classData)) return;
    try {
        await addDoc(scheduleCol, classData);
        notification.show("Clase agregada correctamente.");
        modal.hide();
    } catch (error) {
        notification.show("Error al guardar la clase.", true);
        console.error("Error creating class from modal:", error);
    }
}

function openAssignmentModal(subjectId, day, startTime) {
    const subject = localState.subjects.find(s => s.id === subjectId);
    if (!subject) return console.error("Materia no encontrada");
    const eligibleTeachers = localState.teachers.filter(teacher => teacher.subjects && teacher.subjects.includes(subjectId));
    const groupsForSubject = subject.trimester > 0 ? localState.groups.filter(g => g.trimester == subject.trimester) : localState.groups;
    const teacherOptions = eligibleTeachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    const groupOptions = groupsForSubject.sort(sortByName).map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    const classroomOptions = localState.classrooms.sort(sortByName).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const formHtml = `
        <h2 class="text-2xl font-semibold mb-2">Asignar Clase</h2>
        <p class="text-lg text-indigo-600 font-medium mb-6">${subject.name}</p>
        <div class="space-y-4 text-left">
            <div><label class="block text-sm font-medium text-gray-700">Grupo</label><select id="modal-assign-group" class="mt-1 block w-full p-2 border rounded-lg">${groupOptions}</select></div>
            <div><label class="block text-sm font-medium text-gray-700">Aula</label><select id="modal-assign-classroom" class="mt-1 block w-full p-2 border rounded-lg"><option value="">Seleccionar Aula...</option>${classroomOptions}</select></div>
            <div><label class="block text-sm font-medium text-gray-700">Docente</label><select id="modal-assign-teacher" class="mt-1 block w-full p-2 border rounded-lg">${eligibleTeachers.length > 0 ? teacherOptions : '<option value="">No hay docentes para esta materia</option>'}</select></div>
            <div><label class="block text-sm font-medium text-gray-700">Duración (horas)</label><input type="number" id="modal-assign-duration" value="2" min="1" max="8" class="mt-1 block w-full p-2 border rounded-lg"></div>
        </div>
        <div class="mt-8 flex gap-4">
            <button id="modal-cancel-btn" class="w-full btn btn-secondary">Cancelar</button>
            <button id="modal-save-class-btn" class="w-full btn btn-primary">Guardar Clase</button>
        </div>`;
    modal.show(formHtml);
    document.getElementById('modal-cancel-btn').onclick = () => modal.hide();
    document.getElementById('modal-save-class-btn').onclick = () => createClassFromModal(subjectId, day, startTime);
}

async function savePreset() {
    const presetData = { teacherId: document.getElementById('modal-preset-teacher').value, subjectId: document.getElementById('modal-preset-subject').value, groupId: document.getElementById('modal-preset-group').value };
    if (!presetData.teacherId || !presetData.subjectId || !presetData.groupId) return notification.show("Selecciona todos los campos para la plantilla.", true);
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
        presetDiv.innerHTML = `<div class="preset-item-info"><span class="subject">${subject.name}</span><span class="details">${teacher.name} / ${group.name}</span></div><button class="text-red-500 font-bold px-2">&times;</button>`;
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
    const day = cell.dataset.day;
    const startTime = parseInt(cell.dataset.hour);
    try {
        const subjectData = JSON.parse(e.dataTransfer.getData('application/json'));
        if (subjectData.type === 'Materia') {
            openAssignmentModal(subjectData.id, day, startTime);
            return;
        }
    } catch (error) {}
    try {
        const presetId = e.dataTransfer.getData('text/plain');
        if (presetId) {
            const preset = localState.presets.find(p => p.id === presetId);
            if (!preset) return;
            const classData = { teacherId: preset.teacherId, subjectId: preset.subjectId, groupId: preset.groupId, day: day, startTime: startTime, duration: 1 };
            if (checkConflict(classData)) return;
            await addDoc(scheduleCol, classData);
            notification.show("Clase agregada desde plantilla.");
        }
    } catch (error) {
        notification.show("Error al procesar el elemento soltado.", true);
        console.error("Drop error:", error);
    }
}

function handleManagementDragStart(e) { e.target.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/json', JSON.stringify({id: e.target.dataset.id, type: e.target.dataset.type})); }
function handleManagementDragEnd(e) { e.target.classList.remove('dragging'); }

let resizingClass = null, initialY = 0, initialDuration = 0;
function handleResizeStart(e, classData) {
    e.preventDefault(); e.stopPropagation();
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
    const newDuration = Math.max(1, initialDuration + Math.round(deltaY / 51));
    const classElement = document.querySelector(`.schedule-item[data-class-id="${resizingClass.id}"]`);
    if (classElement) classElement.style.height = `${(newDuration * 50) + ((newDuration - 1) * 1)}px`;
}
async function handleResizeEnd(e) {
    const classElement = document.querySelector(`.schedule-item[data-class-id="${resizingClass.id}"]`);
    classElement?.classList.remove('resizing');
    const newDuration = Math.max(1, initialDuration + Math.round((e.clientY - initialY) / 51));
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
            if (classElement) classElement.style.height = `${(initialDuration * 50) + ((initialDuration - 1) * 1)}px`;
        }
    }
    resizingClass = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
}

// --- FUNCIONES ADMINISTRATIVAS ---

async function advanceAllGroups() {
    modal.confirm("¿Avanzar Cuatrimestre?", "Esta acción incrementará en 1 el cuatrimestre de TODOS los grupos. Los del 9º serán eliminados. <b>Esta acción es irreversible.</b>", async () => {
        const batch = writeBatch(db);
        let movedCount = 0, deletedCount = 0;
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
    if (timeSlots.length === 0) {
        for (let h = 7; h < 22; h++) {
            timeSlots.push(h);
            dom.timeSelect.add(new Option(`${String(h).padStart(2, '0')}:00`, h));
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
    if (checkConflict(classData, editingId)) return;
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
    dom.teacherSelect.value = classData.teacherId;
    populateFilteredSubjects(dom.subjectSelect, classData.teacherId);
    dom.subjectSelect.value = classData.subjectId;
    populateGroupFilter();
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
    [dom.teacherSelect, dom.subjectSelect, dom.groupSelect].forEach(s => s.value = "");
    dom.daySelect.value = "Lunes"; dom.timeSelect.value = "7"; dom.durationInput.value = "1";
    dom.editingClassId.value = ""; dom.cancelEditBtn.classList.add('hidden');
    populateFilteredSubjects(dom.subjectSelect, null);
    populateGroupFilter();
}

// --- ANÁLISIS Y REPORTES ---

function runPedagogicalAnalysis() {
    if (!dom.alertsList) return;
    const alerts = [];
    const missingSubjectIds = new Set();
    localState.groups.forEach(group => {
        if (!group.trimester || group.trimester === 0) return;
        const requiredSubjects = localState.subjects.filter(s => s.trimester == group.trimester);
        const scheduledSubjectIds = localState.schedule.filter(c => c.groupId === group.id).map(c => c.subjectId);
        requiredSubjects.forEach(subject => {
            if (!scheduledSubjectIds.includes(subject.id)) {
                alerts.push({ type: 'warning', message: `Al grupo <b>${group.name}</b> le falta la materia <i>${subject.name}</i>.` });
                missingSubjectIds.add(subject.id);
            }
        });
    });
    renderAlerts(alerts);
    renderMissingSubjectsSidebar(missingSubjectIds);
}

function renderMissingSubjectsSidebar(missingSubjectIds) {
    if (!dom.unassignedSubjectsContainer) return;
    dom.unassignedSubjectsContainer.innerHTML = '';
    if (missingSubjectIds.size === 0) {
        dom.unassignedSubjectsContainer.innerHTML = `<p class="text-xs text-gray-400">¡Excelente! No faltan materias por asignar.</p>`;
        return;
    }
    const missingSubjects = Array.from(missingSubjectIds).map(id => localState.subjects.find(s => s.id === id)).filter(Boolean).sort(sortByName);
    missingSubjects.forEach(subject => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'management-item';
        itemDiv.draggable = true;
        itemDiv.dataset.id = subject.id;
        itemDiv.dataset.type = 'Materia';
        itemDiv.addEventListener('dragstart', handleManagementDragStart);
        itemDiv.addEventListener('dragend', handleManagementDragEnd);
        itemDiv.innerHTML = `<span>${subject.name}</span>`;
        dom.unassignedSubjectsContainer.appendChild(itemDiv);
    });
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
        li.innerHTML = `<svg class="w-5 h-5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.636-1.223 2.443-1.223 3.08 0l6.273 12.088c.635 1.223-.27 2.713-1.54 2.713H3.524c-1.27 0-2.175-1.49-1.54-2.713L8.257 3.099zM9 13a1 1 0 112 0 1 1 0 01-2 0zm1-6a1 1 0 00-1 1v3a1 1 0 002 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg><span>${alert.message}</span>`;
        dom.alertsList.appendChild(li);
    });
}

function updateWorkloadSummary() {
    if (!dom.teacherWorkload || !dom.groupWorkload) return;
    const teacherWorkload = {}, groupWorkload = {};
    localState.schedule.forEach(c => {
        teacherWorkload[c.teacherId] = (teacherWorkload[c.teacherId] || 0) + c.duration;
        groupWorkload[c.groupId] = (groupWorkload[c.groupId] || 0) + c.duration;
    });
    localState.blocks.forEach(block => {
        const affectedGroups = localState.groups.filter(g => g.trimester === block.trimester);
        const daysCount = block.days === 'L-V' ? 5 : 4;
        const blockHoursPerDay = block.endTime - block.startTime;
        affectedGroups.forEach(group => groupWorkload[group.id] = (groupWorkload[group.id] || 0) + (blockHoursPerDay * daysCount));
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
