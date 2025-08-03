// Paso 1: Importar las funciones necesarias desde los SDK de Firebase
// Usamos la sintaxis de importación de módulos de ES6, que es posible gracias a type="module" en la etiqueta <script>
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

let localState = { teachers: [], subjects: [], groups: [], schedule: [] };
const colorPalette = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];
let colorIndex = 0;
const assignedColors = {};
const getSubjectColor = id => assignedColors[id] || (assignedColors[id] = colorPalette[colorIndex++ % colorPalette.length]);
let dom = {}; // Objeto para guardar referencias al DOM
let isAppStarted = false;

// --- Funciones del Modal (Notificaciones y Confirmaciones) ---
const modal = {
    el: document.getElementById('modal'),
    icon: document.getElementById('modal-icon'),
    title: document.getElementById('modal-title'),
    message: document.getElementById('modal-message'),
    buttons: document.getElementById('modal-buttons'),

    show(config) {
        this.title.textContent = config.title;
        this.message.innerHTML = config.message;
        this.icon.innerHTML = config.isError ?
            `<svg class="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>` :
            `<svg class="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

        this.buttons.innerHTML = '';
        config.buttons.forEach(btnConfig => {
            const button = document.createElement('button');
            button.textContent = btnConfig.text;
            button.className = btnConfig.class;
            button.onclick = () => {
                this.hide();
                if (btnConfig.action) btnConfig.action();
            };
            this.buttons.appendChild(button);
        });
        this.el.classList.remove('hidden');
    },
    hide() {
        this.el.classList.add('hidden');
    },
    notify(title, message, isError = true) {
        this.show({
            title, message, isError,
            buttons: [{ text: 'Cerrar', class: 'bg-gray-600 text-white py-2 px-6 rounded-lg hover:bg-gray-700' }]
        });
    },
    confirm(title, message, onConfirm) {
        this.show({
            title, message, isError: true,
            buttons: [
                { text: 'Cancelar', class: 'bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600' },
                { text: 'Confirmar', class: 'bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700', action: onConfirm }
            ]
        });
    }
};

/**
 * NEW: Helper function to get initials from a multi-word string.
 * @param {string} name - The full name of the subject.
 * @returns {string} The initials or the original name if it's a single word.
 */
function getInitials(name) {
    if (!name || typeof name !== 'string') return '';
    const words = name.trim().split(/\s+/);
    if (words.length > 1) {
        return words.map(word => word[0]).join('').toUpperCase();
    }
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
        groupName: document.getElementById('group-name'), addGroupBtn: document.getElementById('add-group-btn'), groupsList: document.getElementById('groups-list'),
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
    };

    generateTimeOptions();
    setupEventListeners();

    // Suscripciones a Firestore
    onSnapshot(teachersCol, snapshot => {
        localState.teachers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSimpleList(localState.teachers, dom.teachersList, teachersCol);
        populateSelect(dom.teacherSelect, localState.teachers, 'Seleccionar Docente');
        populateSelect(dom.filterTeacher, localState.teachers, 'Todos los Docentes');
        updateWorkloadSummary();
    });
    onSnapshot(subjectsCol, snapshot => {
        localState.subjects = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSimpleList(localState.subjects, dom.subjectsList, subjectsCol);
        populateSelect(dom.subjectSelect, localState.subjects, 'Seleccionar Materia');
    });
    onSnapshot(groupsCol, snapshot => {
        localState.groups = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSimpleList(localState.groups, dom.groupsList, groupsCol);
        populateSelect(dom.groupSelect, localState.groups, 'Seleccionar Grupo');
        populateSelect(dom.filterGroup, localState.groups, 'Todos los Grupos');
        updateWorkloadSummary();
    });
    onSnapshot(scheduleCol, snapshot => {
        localState.schedule = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderScheduleGrid();
        runPedagogicalAnalysis();
        updateWorkloadSummary();
    });
}

function setupEventListeners() {
    dom.addTeacherBtn.onclick = () => addItem(teachersCol, { name: dom.teacherName.value }, dom.teacherName);
    dom.addSubjectBtn.onclick = () => addItem(subjectsCol, { name: dom.subjectName.value }, dom.subjectName);
    dom.addGroupBtn.onclick = () => addItem(groupsCol, { name: dom.groupName.value }, dom.groupName);
    dom.saveClassBtn.onclick = saveClass;
    dom.cancelEditBtn.onclick = resetForm;
    dom.filterTeacher.onchange = renderScheduleGrid;
    dom.filterGroup.onchange = renderScheduleGrid;
    dom.exportCsvBtn.onclick = exportToCSV;
    dom.importTeachersBtn.onclick = () => handleImportClick(teachersCol);
    dom.importSubjectsBtn.onclick = () => handleImportClick(subjectsCol);
    dom.importGroupsBtn.onclick = () => handleImportClick(groupsCol);
}

async function addItem(collectionRef, data, inputElement) {
    if (!inputElement.value.trim()) return;
    try {
        await addDoc(collectionRef, data);
        inputElement.value = '';
    } catch (error) {
        modal.notify("Error de Guardado", "No se pudo agregar el elemento.");
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
            modal.confirm('¿Eliminar elemento?', `Estás a punto de borrar "<b>${item.name}</b>". Esta acción no se puede deshacer.`, async () => {
                try {
                    await deleteDoc(doc(collectionRef, item.id));
                } catch (e) {
                    modal.notify("Error", "No se pudo eliminar.");
                }
            });
        };
        itemDiv.appendChild(deleteBtn);
        listDiv.appendChild(itemDiv);
    });
}

async function deleteClass(classId, classInfo) {
    modal.confirm('¿Eliminar clase?', `Vas a eliminar la clase de <b>${classInfo}</b>. ¿Continuar?`, async () => {
        try {
            await deleteDoc(doc(scheduleCol, classId));
            modal.notify("Éxito", "Clase eliminada.", false);
        } catch (error) {
            modal.notify("Error", "No se pudo eliminar la clase.");
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
        return modal.notify("Campos Incompletos", "Por favor, selecciona docente, materia y grupo.");
    }

    const editingId = dom.editingClassId.value;
    if (checkConflict(classData, editingId)) {
        return modal.notify("Conflicto de Horario", "El docente o el grupo ya tienen una clase en este rango de tiempo.");
    }

    try {
        if (editingId) {
            await updateDoc(doc(scheduleCol, editingId), classData);
            modal.notify("Éxito", "Clase actualizada correctamente.", false);
        } else {
            await addDoc(scheduleCol, classData);
            modal.notify("Éxito", "Clase agregada correctamente.", false);
        }
        resetForm();
    } catch (error) {
        modal.notify("Error de Guardado", "No se pudo guardar la clase.");
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

/**
 * UPDATED: Renders the entire schedule grid, including handling for overlapping events.
 */
function renderScheduleGrid() {
    dom.scheduleGrid.innerHTML = '';
    
    // Render background grid (headers, time labels, empty cells)
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
        days.forEach(() => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
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

    // --- NEW: Overlap Calculation and Rendering Logic ---
    days.forEach(day => {
        const dayEvents = filteredSchedule.filter(e => e.day === day);

        dayEvents.forEach(c => {
            const teacher = localState.teachers.find(t => t.id === c.teacherId);
            const subject = localState.subjects.find(s => s.id === c.subjectId);
            const group = localState.groups.find(g => g.id === c.groupId);
            if (!teacher || !subject || !group) return;

            const dayIndex = days.indexOf(c.day);
            const timeIndex = timeSlots.indexOf(c.startTime);
            if (dayIndex === -1 || timeIndex === -1) return;

            // Find all other events that overlap with the current event 'c'
            const overlaps = dayEvents.filter(e => {
                const cEnd = c.startTime + c.duration;
                const eEnd = e.startTime + e.duration;
                return c.startTime < eEnd && cEnd > e.startTime;
            });
            
            const totalOverlaps = overlaps.length;
            // Determine the horizontal position of the current event within its overlap group
            const overlapIndex = overlaps.sort((a,b) => a.id.localeCompare(b.id)).indexOf(c);

            const itemDiv = document.createElement('div');
            itemDiv.className = 'schedule-item';
            itemDiv.style.backgroundColor = getSubjectColor(subject.id);
            
            itemDiv.style.gridColumn = dayIndex + 2;
            itemDiv.style.gridRow = `${timeIndex + 2} / span ${c.duration}`;
            
            const rowHeight = 50;
            const rowGap = 1;
            itemDiv.style.height = `${(c.duration * rowHeight) + ((c.duration - 1) * rowGap)}px`;

            // Dynamically adjust width and horizontal position for overlaps
            const width = 100 / totalOverlaps;
            itemDiv.style.width = `calc(${width}% - 2px)`; // Subtract a small gap
            itemDiv.style.left = `${overlapIndex * width}%`;

            let subjectName = subject.name;
            // Use initials and smaller font for crowded slots
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
            return modal.notify("Error de Formato", "El archivo CSV debe tener una columna con el encabezado 'name'.");
        }

        const names = lines.slice(1).map(line => line.trim()).filter(Boolean);
        if (names.length === 0) return;

        const batch = writeBatch(db);
        names.forEach(name => {
            const newDocRef = doc(collectionRef); // Creates a new doc with a random ID
            batch.set(newDocRef, { name });
        });

        try {
            await batch.commit();
            modal.notify("Éxito", `${names.length} elementos importados correctamente.`, false);
        } catch (error) {
            modal.notify("Error de Importación", "No se pudieron guardar los datos.");
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
            modal.notify(
                "Error Crítico de Conexión", 
                `No se pudo conectar con Firebase. Causa probable: <b>La API Key no tiene permisos para este dominio.</b> Por favor, revisa la configuración en la Google Cloud Console. <br><small>Código: ${error.code}</small>`
            );
        }
    } else {
        startApp();
    }
})();
