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

let localState = { teachers: [], subjects: [], groups: [], schedule: [], presets: [] };
const colorPalette = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];
let colorIndex = 0;
const assignedColors = {};
const getSubjectColor = id => assignedColors[id] || (assignedColors[id] = colorPalette[colorIndex++ % colorPalette.length]);
let dom = {};
let isAppStarted = false;

// --- NUEVO SISTEMA DE NOTIFICACIONES EMERGENTES ---
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

        // Forzar reflow para que la animación funcione
        requestAnimationFrame(() => {
            notif.classList.add('show');
        });

        setTimeout(() => {
            notif.classList.remove('show');
            notif.addEventListener('transitionend', () => notif.remove());
        }, 3000);
    }
};

// --- Sistema de Modal (Ahora para confirmaciones y formularios) ---
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
        
        // Poblar los selectores del modal
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
        subjectName: document.getElementById('subject-name'), addSubjectBtn: document.getElementById('add-subject-btn'), subjectsList: document.getElementById('subjects-list'),
        groupPrefixSelect: document.getElementById('group-prefix-select'), groupNumberInput: document.getElementById('group-number-input'), addGroupBtn: document.getElementById('add-group-btn'), groupsList: document.getElementById('groups-list'),
        teacherSelect: document.getElementById('teacher-select'), subjectSelect: document.getElementById('subject-select'), groupSelect: document.getElementById('group-select'),
        daySelect: document.getElementById('day-select'), timeSelect: document.getElementById('time-select'), durationInput: document.getElementById('duration-input'),
        saveClassBtn: document.getElementById('save-class-btn'), cancelEditBtn: document.getElementById('cancel-edit-btn'),
        formTitle: document.getElementById('form-title'), editingClassId: document.getElementById('editing-class-id'),
        scheduleGrid: document.getElementById('schedule-grid'),
        filterTeacher: document.getElementById('filter-teacher'), filterGroup: document.getElementById('filter-group'),
        alertsList: document.getElementById('alerts-list'), noAlertsMessage: document.getElementById('no-alerts-message'),
        teacherWorkload: document.getElementById('teacher-workload'), groupWorkload: document.getElementById('group-workload'),
        importTeachersBtn: document.getElementById('import-teachers-btn'), importSubjectsBtn: document.getElementById('import-subjects-btn'), importGroupsBtn: document.getElementById('import-groups-btn'),
        csvFileInput: document.getElementById('csv-file-input'), exportCsvBtn: document.getElementById('export-csv-btn'),
        openPresetModalBtn: document.getElementById('open-preset-modal-btn'),
        presetsList: document.getElementById('presets-list'),
    };

    generateTimeOptions();
    setupEventListeners();

    // Suscripciones a Firestore
    onSnapshot(teachersCol, s => {
        localState.teachers = s.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSimpleList(localState.teachers, dom.teachersList, teachersCol);
        populateSelect(dom.teacherSelect, localState.teachers, 'Seleccionar Docente');
        populateSelect(dom.filterTeacher, localState.teachers, 'Todos los Docentes');
        updateWorkloadSummary();
    });
    onSnapshot(subjectsCol, s => {
        localState.subjects = s.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSimpleList(localState.subjects, dom.subjectsList, subjectsCol);
        populateSelect(dom.subjectSelect, localState.subjects, 'Seleccionar Materia');
    });
    onSnapshot(groupsCol, s => {
        localState.groups = s.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSimpleList(localState.groups, dom.groupsList, groupsCol);
        populateSelect(dom.groupSelect, localState.groups, 'Seleccionar Grupo');
        populateSelect(dom.filterGroup, localState.groups, 'Todos los Grupos');
        updateWorkloadSummary();
    });
    onSnapshot(scheduleCol, s => {
        localState.schedule = s.docs.map(d => ({ id: d.id, ...d.data() }));
        renderScheduleGrid();
        runPedagogicalAnalysis();
        updateWorkloadSummary();
    });
    onSnapshot(presetsCol, s => {
        localState.presets = s.docs.map(d => ({ id: d.id, ...d.data() }));
        renderPresetsList();
    });
}

function setupEventListeners() {
    dom.addTeacherBtn.onclick = () => addItem(teachersCol, { name: dom.teacherName.value }, dom.teacherName);
    dom.addSubjectBtn.onclick = () => addItem(subjectsCol, { name: dom.subjectName.value }, dom.subjectName);
    dom.addGroupBtn.onclick = addGroup;
    dom.saveClassBtn.onclick = saveClass;
    dom.cancelEditBtn.onclick = resetForm;
    dom.filterTeacher.onchange = renderScheduleGrid;
    dom.filterGroup.onchange = renderScheduleGrid;
    dom.exportCsvBtn.onclick = exportToCSV;
    dom.importTeachersBtn.onclick = () => handleImportClick(teachersCol);
    dom.importSubjectsBtn.onclick = () => handleImportClick(subjectsCol);
    dom.importGroupsBtn.onclick = () => handleImportClick(groupsCol);
    dom.openPresetModalBtn.onclick = () => modal.showPresetForm();
}

async function addGroup() {
    const prefix = dom.groupPrefixSelect.value;
    const number = dom.groupNumberInput.value;
    if (!number) return notification.show("Por favor, introduce un número de grupo.", true);
    const groupName = `${prefix}-${number}`;
    try {
        await addDoc(groupsCol, { name: groupName });
        dom.groupNumberInput.value = '';
        notification.show(`Grupo "${groupName}" agregado.`);
    } catch (error) {
        notification.show("No se pudo agregar el grupo.", true);
    }
}

async function addItem(collectionRef, data, inputElement) {
    if (!inputElement.value.trim()) return;
    try {
        await addDoc(collectionRef, data);
        notification.show(`"${data.name}" agregado correctamente.`);
        inputElement.value = '';
    } catch (error) {
        notification.show("No se pudo agregar el elemento.", true);
    }
}

function renderSimpleList(items, listDiv, collectionRef) {
    listDiv.innerHTML = '';
    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex justify-between items-center bg-gray-100 p-2 rounded-lg';
        itemDiv.textContent = item.name;
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&times;';
        deleteBtn.className = 'text-red-500 font-bold px-2';
        deleteBtn.onclick = () => {
            modal.confirm('¿Eliminar elemento?', `Estás a punto de borrar "<b>${item.name}</b>".`, async () => {
                try {
                    await deleteDoc(doc(collectionRef, item.id));
                    notification.show(`"${item.name}" eliminado.`);
                } catch (e) {
                    notification.show("Error al eliminar.", true);
                }
            });
        };
        itemDiv.appendChild(deleteBtn);
        listDiv.appendChild(itemDiv);
    });
}

// --- Lógica de Plantillas (Presets) ---
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
        presetDiv.draggable = true; // Hacer el elemento arrastrable
        presetDiv.dataset.presetId = preset.id; // Guardar el ID para el drop

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

// --- Lógica de Arrastrar y Soltar (Drag and Drop) ---
function handleDragStart(e) {
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.target.dataset.presetId);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function handleDragOver(e) {
    e.preventDefault(); // Necesario para permitir el drop
    e.dataTransfer.dropEffect = 'move';
    const cell = e.target.closest('.grid-cell');
    if (cell) {
        // Limpiar hover previo
        document.querySelectorAll('.grid-cell.droppable-hover').forEach(c => c.classList.remove('droppable-hover'));
        cell.classList.add('droppable-hover');
    }
}

function handleDrop(e) {
    e.preventDefault();
    document.querySelectorAll('.grid-cell.droppable-hover').forEach(c => c.classList.remove('droppable-hover'));
    
    const cell = e.target.closest('.grid-cell');
    if (!cell) return;

    const presetId = e.dataTransfer.getData('text/plain');
    const preset = localState.presets.find(p => p.id === presetId);
    if (!preset) return;

    const classData = {
        ...preset,
        day: cell.dataset.day,
        startTime: parseInt(cell.dataset.hour),
        duration: 1 // Por defecto, las plantillas arrastradas duran 1 hora
    };

    if (checkConflict(classData)) {
        return notification.show("Conflicto de horario al soltar la plantilla.", true);
    }
    
    addDoc(scheduleCol, classData)
        .then(() => notification.show("Clase agregada desde plantilla."))
        .catch(() => notification.show("Error al agregar la clase.", true));
}

// ... (El resto de funciones se mantiene igual, con pequeños ajustes para usar el nuevo sistema de notificaciones)
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

function populateSelect(selectElement, items, placeholder) {
    const currentValue = selectElement.value;
    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        selectElement.appendChild(option);
    });
    selectElement.value = currentValue;
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

    if (!classData.teacherId || !classData.subjectId || !classData.groupId) {
        return notification.show("Por favor, selecciona todos los campos.", true);
    }

    const editingId = dom.editingClassId.value;
    if (checkConflict(classData, editingId)) {
        return notification.show("Conflicto de horario detectado.", true);
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

function checkConflict(newClass, ignoreId = null) {
    const newStart = newClass.startTime;
    const newEnd = newStart + newClass.duration;

    return localState.schedule.some(existingClass => {
        if (existingClass.id === ignoreId || existingClass.day !== newClass.day) {
            return false;
        }
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
    days.forEach(day => {
        const header = document.createElement('div');
        header.className = 'grid-header';
        header.textContent = day;
        dom.scheduleGrid.appendChild(header);
    });
    timeSlots.forEach(time => {
        const timeSlot = document.createElement('div');
        timeSlot.className = 'grid-time-slot';
        timeSlot.textContent = `${time}:00`;
        dom.scheduleGrid.appendChild(timeSlot);
        days.forEach(day => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.day = day; // Guardar datos para el drop
            cell.dataset.hour = time;
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('drop', handleDrop);
            dom.scheduleGrid.appendChild(cell);
        });
    });

    const filteredSchedule = localState.schedule.filter(c => {
        const teacherFilter = dom.filterTeacher.value;
        const groupFilter = dom.filterGroup.value;
        const teacherMatch = !teacherFilter || c.teacherId === teacherFilter;
        const groupMatch = !groupFilter || c.groupId === groupFilter;
        return teacherMatch && groupMatch;
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

            const overlaps = dayEvents.filter(e => {
                const cEnd = c.startTime + c.duration;
                const eEnd = e.startTime + e.duration;
                return c.startTime < eEnd && cEnd > e.startTime;
            });
            
            const totalOverlaps = overlaps.length;
            const overlapIndex = overlaps.sort((a,b) => a.id.localeCompare(b.id)).indexOf(c);

            const itemDiv = document.createElement('div');
            itemDiv.className = 'schedule-item';
            itemDiv.style.backgroundColor = getSubjectColor(subject.id);
            
            const timeColumnWidth = 60;
            const dayColumnWidth = (dom.scheduleGrid.offsetWidth - timeColumnWidth) / days.length;
            const itemWidth = dayColumnWidth / totalOverlaps;

            itemDiv.style.top = `${(timeIndex + 1) * 51}px`;
            itemDiv.style.left = `${timeColumnWidth + (dayIndex * dayColumnWidth) + (overlapIndex * itemWidth)}px`;
            itemDiv.style.width = `${itemWidth - 2}px`;
            
            const rowHeight = 50;
            const rowGap = 1;
            itemDiv.style.height = `${(c.duration * rowHeight) + ((c.duration - 1) * rowGap)}px`;

            let subjectName = subject.name;
            if (totalOverlaps > 1) {
                itemDiv.style.fontSize = '0.65rem'; 
                subjectName = getInitials(subject.name);
            }

            itemDiv.innerHTML = `
                <div class="font-bold">${subjectName}</div>
                <div>${teacher.name.split(' ')[0]}</div>
                <div class="italic">${group.name}</div>
                <div class="actions">
                    <button title="Editar">✏️</button>
                    <button title="Eliminar">🗑️</button>
                </div>
            `;
            
            const [editBtn, deleteBtn] = itemDiv.querySelectorAll('button');
            editBtn.onclick = (e) => { e.stopPropagation(); editClass(c); };
            deleteBtn.onclick = (e) => { e.stopPropagation(); deleteClass(c.id, `${subject.name} con ${teacher.name}`); };

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
    document.getElementById('teacher-select').value = "";
    document.getElementById('subject-select').value = "";
    document.getElementById('group-select').value = "";
    document.getElementById('day-select').value = "Lunes";
    document.getElementById('time-select').value = "7";
    document.getElementById('duration-input').value = "1";
    document.getElementById('editing-class-id').value = "";
    document.getElementById('cancel-edit-btn').classList.add('hidden');
}

function runPedagogicalAnalysis() {
    const alerts = [];
    const englishSubject = localState.subjects.find(s => s.name.toLowerCase().includes('inglés'));
    const extracurricularSubject = localState.subjects.find(s => s.name.toLowerCase().includes('extracurricular'));

    localState.groups.forEach(group => {
        const groupSchedule = localState.schedule.filter(c => c.groupId === group.id);

        if (englishSubject) {
            const englishClasses = groupSchedule.filter(c => c.subjectId === englishSubject.id).reduce((sum, c) => sum + c.duration, 0);
            if (englishClasses < 3) {
                alerts.push({ type: 'warning', message: `El grupo <b>${group.name}</b> tiene menos de 3 horas de Inglés.` });
            }
        }

        if (extracurricularSubject) {
            const extraClasses = groupSchedule.filter(c => c.subjectId === extracurricularSubject.id).length;
            if (extraClasses < 1) {
                alerts.push({ type: 'info', message: `El grupo <b>${group.name}</b> no tiene Actividad Extracurricular.` });
            }
        }

        days.forEach(day => {
            const dayClasses = groupSchedule.filter(c => c.day === day).sort((a, b) => a.startTime - b.startTime);
            for (let i = 0; i < dayClasses.length - 1; i++) {
                const classA_end = dayClasses[i].startTime + dayClasses[i].duration;
                const classB_start = dayClasses[i+1].startTime;
                const gap = classB_start - classA_end;
                if (gap >= 2) {
                    alerts.push({ type: 'error', message: `El grupo <b>${group.name}</b> tiene ${gap} horas muertas el <b>${day}</b>.` });
                }
            }
        });
    });

    renderAlerts(alerts);
}

function renderAlerts(alerts) {
    dom.alertsList.innerHTML = '';
    if (alerts.length === 0) {
        dom.alertsList.innerHTML = '<li class="text-gray-500">No hay alertas por el momento.</li>';
        return;
    }

    const icons = {
        error: `<svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
        warning: `<svg class="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`,
        info: `<svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
    };
    
    alerts.forEach(alert => {
        const li = document.createElement('li');
        li.className = 'flex items-center gap-3 p-2 bg-gray-50 rounded-lg alert-item';
        li.innerHTML = `${icons[alert.type]} <span>${alert.message}</span>`;
        dom.alertsList.appendChild(li);
    });
}

function updateWorkloadSummary() {
    dom.teacherWorkload.innerHTML = '<strong>Docentes:</strong>';
    localState.teachers.forEach(teacher => {
        const totalHours = localState.schedule
            .filter(c => c.teacherId === teacher.id)
            .reduce((sum, c) => sum + c.duration, 0);
        const p = document.createElement('p');
        p.className = 'text-sm';
        p.textContent = `${teacher.name}: ${totalHours} hrs`;
        dom.teacherWorkload.appendChild(p);
    });

    dom.groupWorkload.innerHTML = '<strong>Grupos:</strong>';
    localState.groups.forEach(group => {
        const totalHours = localState.schedule
            .filter(c => c.groupId === group.id)
            .reduce((sum, c) => sum + c.duration, 0);
        const p = document.createElement('p');
        p.className = 'text-sm';
        p.textContent = `${group.name}: ${totalHours} hrs`;
        dom.groupWorkload.appendChild(p);
    });
}

function handleImportClick(collectionRef) {
    dom.csvFileInput.onchange = (e) => processCSV(e, collectionRef);
    dom.csvFileInput.click();
}

function processCSV(event, collectionRef) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split(/\r\n|\n/);
        if (lines.length < 2 || lines[0].trim().toLowerCase() !== 'name') {
            return notification.show("El archivo CSV debe tener una columna 'name'.", true);
        }

        const names = lines.slice(1).map(line => line.trim()).filter(Boolean);
        if (names.length === 0) return;

        const batch = writeBatch(db);
        names.forEach(name => {
            const newDocRef = doc(collectionRef); 
            batch.set(newDocRef, { name });
        });

        try {
            await batch.commit();
            notification.show(`${names.length} elementos importados.`);
        } catch (error) {
            notification.show("Error al importar los datos.", true);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function exportToCSV() {
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = ["Docente", "Materia", "Grupo", "Día", "Hora Inicio", "Hora Fin", "Duración (hrs)"];
    csvContent += headers.join(",") + "\r\n";

    const sortedSchedule = [...localState.schedule].sort((a, b) => {
        const dayCompare = days.indexOf(a.day) - days.indexOf(b.day);
        if (dayCompare !== 0) return dayCompare;
        return a.startTime - b.startTime;
    });

    sortedSchedule.forEach(c => {
        const teacher = localState.teachers.find(t => t.id === c.teacherId)?.name || '';
        const subject = localState.subjects.find(s => s.id === c.subjectId)?.name || '';
        const group = localState.groups.find(g => g.id === c.groupId)?.name || '';
        const startTime = `${String(c.startTime).padStart(2, '0')}:00`;
        const endTime = `${String(c.startTime + c.duration).padStart(2, '0')}:00`;
        
        const row = [teacher, subject, group, c.day, startTime, endTime, c.duration];
        csvContent += row.map(val => `"${val}"`).join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "horario.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Autenticación y arranque de la aplicación ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Usuario autenticado:", user.uid);
        startApp();
    }
});

(async () => {
    if (!auth.currentUser) {
        console.log("No hay usuario actual. Intentando signInAnonymously...");
        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error("Fallo la autenticación anónima:", error);
            notification.show("Error Crítico de Conexión.", true);
        }
    } else {
        startApp();
    }
})();
