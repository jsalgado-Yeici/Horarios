// This script uses the older, namespaced syntax (e.g., firebase.auth()) which is compatible with the compat libraries.
// This is often more stable for simple projects deployed on platforms like GitHub Pages.

// --- Tus claves de Firebase ya están aquí ---
const firebaseConfig = {
  apiKey: "AIzaSyCEcsfD6lNBJN3_VaZObUOZfDi7UFDU7Q",
  authDomain: "planificador-horarios.firebaseapp.com",
  projectId: "planificador-horarios",
  storageBucket: "planificador-horarios.appspot.com",
  messagingSenderId: "625559113082",
  appId: "1:625559113082:web:836fb0b09be2a60cf2dac3"
};
// --- Fin de la configuración ---

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const appId = 'default-scheduler-app-v2';
const getCollectionRef = name => db.collection(`artifacts/${appId}/public/data/${name}`);
const teachersCol = getCollectionRef('teachers'), subjectsCol = getCollectionRef('subjects'), groupsCol = getCollectionRef('groups'), scheduleCol = getCollectionRef('schedule');

let localState = { teachers: [], subjects: [], groups: [], schedule: [] };
const colorPalette = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];
let colorIndex = 0;
const assignedColors = {};
const getSubjectColor = id => assignedColors[id] || (assignedColors[id] = colorPalette[colorIndex++ % colorPalette.length]);
let dom = {};

function showNotification(title, message, isError = true) {
    dom.notificationTitle.textContent = title;
    dom.notificationMessage.textContent = message;
    dom.notificationIcon.innerHTML = isError ? `<svg class="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>` : `<svg class="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    dom.notificationModal.classList.remove('hidden');
}

function startApp() {
    dom = {
        teacherName: document.getElementById('teacher-name'), addTeacherBtn: document.getElementById('add-teacher-btn'), teachersList: document.getElementById('teachers-list'),
        subjectName: document.getElementById('subject-name'), addSubjectBtn: document.getElementById('add-subject-btn'), subjectsList: document.getElementById('subjects-list'),
        groupName: document.getElementById('group-name'), addGroupBtn: document.getElementById('add-group-btn'), groupsList: document.getElementById('groups-list'),
        teacherSelect: document.getElementById('teacher-select'), subjectSelect: document.getElementById('subject-select'), groupSelect: document.getElementById('group-select'),
        daySelect: document.getElementById('day-select'), timeSelect: document.getElementById('time-select'), durationInput: document.getElementById('duration-input'),
        saveClassBtn: document.getElementById('save-class-btn'), cancelEditBtn: document.getElementById('cancel-edit-btn'),
        formTitle: document.getElementById('form-title'), editingClassId: document.getElementById('editing-class-id'),
        scheduleGrid: document.getElementById('schedule-grid'),
        notificationModal: document.getElementById('notification-modal'), notificationTitle: document.getElementById('notification-title'), notificationMessage: document.getElementById('notification-message'), notificationIcon: document.getElementById('notification-icon'), notificationCloseBtn: document.getElementById('notification-close-btn'),
        filterTeacher: document.getElementById('filter-teacher'), filterGroup: document.getElementById('filter-group'),
        alertsList: document.getElementById('alerts-list'), noAlertsMessage: document.getElementById('no-alerts-message'),
        teacherWorkload: document.getElementById('teacher-workload'), groupWorkload: document.getElementById('group-workload'),
        importTeachersBtn: document.getElementById('import-teachers-btn'), importSubjectsBtn: document.getElementById('import-subjects-btn'), importGroupsBtn: document.getElementById('import-groups-btn'),
        csvFileInput: document.getElementById('csv-file-input'), exportCsvBtn: document.getElementById('export-csv-btn'),
    };

    generateTimeOptions();
    setupEventListeners();
    
    teachersCol.onSnapshot(s => {
        localState.teachers = s.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSimpleList(localState.teachers, dom.teachersList, teachersCol);
        populateSelect(dom.teacherSelect, localState.teachers, 'Seleccionar Docente');
        populateSelect(dom.filterTeacher, localState.teachers, 'Todos los Docentes');
        updateWorkloadSummary();
    });
    subjectsCol.onSnapshot(s => {
        localState.subjects = s.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSimpleList(localState.subjects, dom.subjectsList, subjectsCol);
        populateSelect(dom.subjectSelect, localState.subjects, 'Seleccionar Materia');
    });
    groupsCol.onSnapshot(s => {
        localState.groups = s.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSimpleList(localState.groups, dom.groupsList, groupsCol);
        populateSelect(dom.groupSelect, localState.groups, 'Seleccionar Grupo');
        populateSelect(dom.filterGroup, localState.groups, 'Todos los Grupos');
        updateWorkloadSummary();
    });
    scheduleCol.onSnapshot(s => {
        localState.schedule = s.docs.map(d => ({ id: d.id, ...d.data() }));
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
    dom.notificationCloseBtn.onclick = () => dom.notificationModal.classList.add('hidden');
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
        await collectionRef.add(data);
        inputElement.value = '';
    } catch (error) {
        showNotification("Error de Guardado", "No se pudo agregar el elemento.");
    }
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

function renderSimpleList(items, listDiv, collectionRef) {
    listDiv.innerHTML = '';
    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex justify-between items-center bg-gray-100 p-2 rounded-lg';
        itemDiv.textContent = item.name;
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&times;';
        deleteBtn.className = 'text-red-500 font-bold';
        deleteBtn.onclick = async () => {
            if (window.confirm('¿Eliminar este elemento?')) {
                try {
                    await collectionRef.doc(item.id).delete();
                } catch (e) {
                    showNotification("Error", "No se pudo eliminar.");
                }
            }
        };
        itemDiv.appendChild(deleteBtn);
        listDiv.appendChild(itemDiv);
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

    if (!classData.teacherId || !classData.subjectId || !classData.groupId) {
        return showNotification("Campos Incompletos", "Por favor, selecciona docente, materia y grupo.");
    }
    
    const editingId = dom.editingClassId.value;
    if (checkConflict(classData, editingId)) {
        return showNotification("Conflicto de Horario", "El docente o el grupo ya tienen una clase en este rango de tiempo.");
    }

    try {
        if (editingId) {
            await scheduleCol.doc(editingId).update(classData);
            showNotification("Éxito", "Clase actualizada correctamente.", false);
        } else {
            await scheduleCol.add(classData);
            showNotification("Éxito", "Clase agregada correctamente.", false);
        }
        resetForm();
    } catch (error) {
        showNotification("Error de Guardado", "No se pudo guardar la clase.");
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
    // Headers and Cells
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
        days.forEach(() => dom.scheduleGrid.appendChild(document.createElement('div')));
    });

    const filteredSchedule = localState.schedule.filter(c => {
        const teacherFilter = dom.filterTeacher.value;
        const groupFilter = dom.filterGroup.value;
        const teacherMatch = !teacherFilter || c.teacherId === teacherFilter;
        const groupMatch = !groupFilter || c.groupId === groupFilter;
        return teacherMatch && groupMatch;
    });

    filteredSchedule.forEach(c => {
        const teacher = localState.teachers.find(t => t.id === c.teacherId);
        const subject = localState.subjects.find(s => s.id === c.subjectId);
        const group = localState.groups.find(g => g.id === c.groupId);
        if (!teacher || !subject || !group) return;

        const dayIndex = days.indexOf(c.day);
        const timeIndex = timeSlots.indexOf(c.startTime);
        if (dayIndex === -1 || timeIndex === -1) return;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'schedule-item';
        itemDiv.style.backgroundColor = getSubjectColor(subject.id);
        itemDiv.style.gridColumn = dayIndex + 2;
        itemDiv.style.gridRow = `${timeIndex + 2} / span ${c.duration}`;
        
        itemDiv.innerHTML = `
            <div class="font-bold">${subject.name}</div>
            <div>${teacher.name}</div>
            <div class="italic">${group.name}</div>
            <div class="actions">
                <button title="Editar">✏️</button>
                <button title="Eliminar">🗑️</button>
            </div>
        `;
        
        const [editBtn, deleteBtn] = itemDiv.querySelectorAll('button');
        editBtn.onclick = () => editClass(c);
        deleteBtn.onclick = () => deleteClass(c.id);

        dom.scheduleGrid.appendChild(itemDiv);
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

async function deleteClass(classId) {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta clase?')) {
        try {
            await scheduleCol.doc(classId).delete();
            showNotification("Éxito", "Clase eliminada.", false);
        } catch (error) {
            showNotification("Error", "No se pudo eliminar la clase.");
        }
    }
}

function resetForm() {
    dom.formTitle.textContent = "Agregar Nueva Clase";
    dom.teacherSelect.value = "";
    dom.subjectSelect.value = "";
    dom.groupSelect.value = "";
    dom.daySelect.value = "Lunes";
    dom.timeSelect.value = "7";
    dom.durationInput.value = "1";
    dom.editingClassId.value = "";
    dom.cancelEditBtn.classList.add('hidden');
}

function runPedagogicalAnalysis() {
    const alerts = [];
    const englishSubject = localState.subjects.find(s => s.name.toLowerCase() === 'inglés');
    const extracurricularSubject = localState.subjects.find(s => s.name.toLowerCase() === 'actividad extracurricular');

    localState.groups.forEach(group => {
        const groupSchedule = localState.schedule.filter(c => c.groupId === group.id);

        if (englishSubject) {
            const englishClasses = groupSchedule.filter(c => c.subjectId === englishSubject.id).length;
            if (englishClasses < 3) {
                alerts.push({ type: 'warning', message: `El grupo <b>${group.name}</b> tiene menos de 3 clases de Inglés por semana.` });
            }
        }

        if (extracurricularSubject) {
            const extraClasses = groupSchedule.filter(c => c.subjectId === extracurricularSubject.id).length;
            if (extraClasses < 1) {
                alerts.push({ type: 'info', message: `El grupo <b>${group.name}</b> no tiene actividades extracurriculares asignadas.` });
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
        if (dom.noAlertsMessage) {
            dom.alertsList.appendChild(dom.noAlertsMessage);
        }
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
            return showNotification("Error de Formato", "El archivo CSV debe tener una columna con el encabezado 'name'.");
        }

        const names = lines.slice(1).map(line => line.trim()).filter(Boolean);
        if (names.length === 0) return;

        const batch = db.batch();
        names.forEach(name => {
            const newDocRef = collectionRef.doc();
            batch.set(newDocRef, { name });
        });

        try {
            await batch.commit();
            showNotification("Éxito", `${names.length} elementos importados correctamente.`, false);
        } catch (error) {
            showNotification("Error de Importación", "No se pudieron guardar los datos.");
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
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

window.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user && !userId) {
            userId = user.uid;
            startApp();
        }
    });

    (async () => {
        if (!auth.currentUser) {
            try {
                await auth.signInAnonymously();
            } catch (error) {
                console.error("Authentication failed:", error);
                showNotification("Error de Autenticación", "No se pudo conectar con el servidor.");
            }
        }
    })();
});
