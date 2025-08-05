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
    query,
    getDocs
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
const blocksCol = getCollectionRef('blocks'); // NUEVA COLECCIÓN para los bloqueos

let localState = { teachers: [], subjects: [], groups: [], schedule: [], presets: [], blocks: [] }; // Se añade 'blocks' al estado local
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
    // ... (código del modal sin cambios)
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
        // ... (resto de los elementos del DOM)
        // NUEVOS ELEMENTOS PARA LA IA
        imageUploadInput: document.getElementById('image-upload-input'),
        analyzeImageBtn: document.getElementById('analyze-image-btn'),
        analyzeBtnIcon: document.getElementById('analyze-btn-icon'),
        analyzeBtnSpinner: document.getElementById('analyze-btn-spinner'),
        analyzeBtnText: document.getElementById('analyze-btn-text'),
        aiResultsContainer: document.getElementById('ai-results-container'),
    };

    generateTimeOptions();
    setupEventListeners();

    // Suscripciones a Firestore
    onSnapshot(teachersCol, s => { localState.teachers = s.docs.map(d => ({ id: d.id, ...d.data() })); renderTeachersList(); populateSelect(dom.teacherSelect, localState.teachers, 'Seleccionar Docente'); populateSelect(dom.filterTeacher, localState.teachers, 'Todos los Docentes'); updateWorkloadSummary(); });
    onSnapshot(subjectsCol, s => { localState.subjects = s.docs.map(d => ({ id: d.id, ...d.data() })); renderSubjectsByTrimester(); populateSubjectFilter(); });
    onSnapshot(groupsCol, s => { localState.groups = s.docs.map(d => ({ id: d.id, ...d.data() })); renderGroupsByTrimester(); populateSelect(dom.groupSelect, localState.groups, 'Seleccionar Grupo'); populateSelect(dom.filterGroup, localState.groups, 'Todos los Grupos'); updateWorkloadSummary(); });
    onSnapshot(scheduleCol, s => { localState.schedule = s.docs.map(d => ({ id: d.id, ...d.data() })); renderScheduleGrid(); runPedagogicalAnalysis(); updateWorkloadSummary(); });
    onSnapshot(presetsCol, s => { localState.presets = s.docs.map(d => ({ id: d.id, ...d.data() })); renderPresetsList(); });
    // NUEVA SUSCRIPCIÓN para los bloqueos
    onSnapshot(blocksCol, s => { localState.blocks = s.docs.map(d => ({ id: d.id, ...d.data() })); renderScheduleGrid(); });
}

function setupEventListeners() {
    // ... (resto de los event listeners)
    // NUEVO EVENT LISTENER para el botón de analizar imagen
    dom.analyzeImageBtn.onclick = analyzeImage;
}

// --- LÓGICA DE IA PARA ANALIZAR IMÁGENES ---

// Convierte un archivo de imagen a formato base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

// Función principal que se activa al hacer clic en "Analizar"
async function analyzeImage() {
    const file = dom.imageUploadInput.files[0];
    if (!file) {
        notification.show("Por favor, selecciona una imagen primero.", true);
        return;
    }

    // Cambiar estado del botón a "cargando"
    dom.analyzeImageBtn.disabled = true;
    dom.analyzeBtnIcon.classList.add('hidden');
    dom.analyzeBtnSpinner.classList.remove('hidden');
    dom.analyzeBtnText.textContent = "Analizando...";
    dom.aiResultsContainer.innerHTML = '';

    try {
        const base64ImageData = await fileToBase64(file);
        const apiKey = ""; // La API Key se gestiona automáticamente

        const payload = {
            contents: [{
                parts: [
                    { text: "Analiza la siguiente imagen, que es un horario. Extrae cada fila como un objeto JSON. Cada objeto debe tener 'startTime' (hora de inicio en formato HH), 'endTime' (hora de fin en formato HH), 'days' (un string como 'L-V' o 'L-J'), y 'trimester' (el número del cuatrimestre). Ignora las filas que no tengan un cuatrimestre claro. Devuelve un array de estos objetos." },
                    { inlineData: { mimeType: file.type, data: base64ImageData } }
                ]
            }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            startTime: { type: "STRING" },
                            endTime: { type: "STRING" },
                            days: { type: "STRING" },
                            trimester: { type: "NUMBER" }
                        },
                        required: ["startTime", "endTime", "days", "trimester"]
                    }
                }
            }
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Error de la API: ${response.statusText}`);
        }

        const result = await response.json();
        const jsonText = result.candidates[0].content.parts[0].text;
        const extractedData = JSON.parse(jsonText);
        
        notification.show("Análisis completado. Revisa los resultados y guarda los bloqueos.");
        renderAIResults(extractedData);

    } catch (error) {
        console.error("Error en el análisis de IA:", error);
        notification.show("No se pudo analizar la imagen. Inténtalo de nuevo.", true);
    } finally {
        // Restaurar estado del botón
        dom.analyzeImageBtn.disabled = false;
        dom.analyzeBtnIcon.classList.remove('hidden');
        dom.analyzeBtnSpinner.classList.add('hidden');
        dom.analyzeBtnText.textContent = "Analizar";
    }
}

// Muestra los resultados de la IA para confirmación del usuario
function renderAIResults(data) {
    if (!data || data.length === 0) {
        dom.aiResultsContainer.innerHTML = `<p class="text-sm text-gray-500">La IA no encontró horarios para extraer.</p>`;
        return;
    }

    let html = `<h3 class="font-semibold text-lg mb-2">Resultados del Análisis:</h3>`;
    data.forEach((item, index) => {
        html += `
            <div class="bg-gray-100 p-3 rounded-lg text-sm">
                Bloqueo para <b>Cuatrimestre ${item.trimester}</b>: 
                de ${item.startTime}:00 a ${item.endTime}:00, 
                días ${item.days}.
            </div>
        `;
    });

    html += `
        <div class="flex gap-4 mt-4">
            <button id="cancel-ai-btn" class="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600">Cancelar</button>
            <button id="save-ai-btn" class="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700">Guardar Bloqueos</button>
        </div>
    `;

    dom.aiResultsContainer.innerHTML = html;
    document.getElementById('cancel-ai-btn').onclick = () => dom.aiResultsContainer.innerHTML = '';
    document.getElementById('save-ai-btn').onclick = () => saveBlocks(data);
}

// Guarda los bloqueos confirmados en Firestore
async function saveBlocks(data) {
    const batch = writeBatch(db);
    
    // Opcional: Borrar todos los bloqueos anteriores antes de añadir los nuevos
    const existingBlocks = await getDocs(query(blocksCol));
    existingBlocks.forEach(doc => batch.delete(doc.ref));

    data.forEach(item => {
        const newBlockRef = doc(blocksCol); // Crea una referencia con ID automático
        batch.set(newBlockRef, item);
    });

    try {
        await batch.commit();
        notification.show(`${data.length} bloqueos de horario guardados.`);
        dom.aiResultsContainer.innerHTML = '';
        dom.imageUploadInput.value = ''; // Limpia el input de archivo
    } catch (error) {
        console.error("Error al guardar los bloqueos:", error);
        notification.show("No se pudieron guardar los bloqueos.", true);
    }
}

// --- LÓGICA DE RENDERIZADO DEL HORARIO (ACTUALIZADA) ---

function renderScheduleGrid() {
    dom.scheduleGrid.innerHTML = '';
    // ... (código para generar encabezados y celdas de la rejilla)

    // Primero, renderizar los bloqueos (capa inferior)
    renderScheduleBlocks();

    // Luego, renderizar las clases normales (capa superior)
    // ... (código existente para renderizar las clases .schedule-item)
}

// NUEVA FUNCIÓN: Dibuja los bloques de horario en la rejilla
function renderScheduleBlocks() {
    const selectedGroupId = dom.filterGroup.value;
    const selectedGroup = localState.groups.find(g => g.id === selectedGroupId);
    
    localState.blocks.forEach(block => {
        // Si hay un grupo filtrado, solo mostrar los bloques de su cuatrimestre
        if (selectedGroup && selectedGroup.trimester != block.trimester) {
            return;
        }

        const startHour = parseInt(block.startTime);
        const endHour = parseInt(block.endTime);
        const duration = endHour - startHour;
        
        const daysToRender = [];
        if (block.days.toUpperCase() === 'L-V') {
            daysToRender.push('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes');
        } else if (block.days.toUpperCase() === 'L-J') {
            daysToRender.push('Lunes', 'Martes', 'Miércoles', 'Jueves');
        }
        // Puedes añadir más casos como 'L-M', etc. si es necesario

        daysToRender.forEach(day => {
            const dayIndex = days.indexOf(day);
            if (dayIndex === -1) return;

            const timeIndex = timeSlots.indexOf(startHour);
            if (timeIndex === -1) return;
            
            const blockDiv = document.createElement('div');
            blockDiv.className = 'schedule-block';
            blockDiv.textContent = `Bloqueado (Cuatri ${block.trimester})`;
            
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

// --- LÓGICA DE CONFLICTOS (ACTUALIZADA) ---

function checkConflict(newClass, ignoreId = null) {
    const newStart = newClass.startTime;
    const newEnd = newStart + newClass.duration;
    
    // 1. Conflicto con otras clases
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

    // 2. Conflicto con bloqueos de horario
    const group = localState.groups.find(g => g.id === newClass.groupId);
    if (!group) return false; // No se puede verificar si no se encuentra el grupo

    const blockConflict = localState.blocks.some(block => {
        if (block.trimester != group.trimester) return false; // El bloqueo no aplica a este cuatri

        const daysOfBlock = [];
        if (block.days.toUpperCase() === 'L-V') daysOfBlock.push('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes');
        if (block.days.toUpperCase() === 'L-J') daysOfBlock.push('Lunes', 'Martes', 'Miércoles', 'Jueves');
        
        if (!daysOfBlock.includes(newClass.day)) return false; // El bloqueo no aplica a este día

        const blockStart = parseInt(block.startTime);
        const blockEnd = parseInt(block.endTime);
        
        return newStart < blockEnd && newEnd > blockStart;
    });
    if (blockConflict) return true;

    return false; // No hay conflictos
}
function renderTeachersList() {
    dom.teachersList.innerHTML = '';
    localState.teachers.forEach(teacher => {
        dom.teachersList.appendChild(createManagementItem(teacher, teachersCol, 'Docente'));
    });
}

function renderSubjectsByTrimester() {
    dom.subjectsByTrimester.innerHTML = '';
    dom.unassignedSubjectsContainer.innerHTML = '';
    for (let i = 1; i <= 9; i++) {
        const column = document.createElement('div');
        column.className = 'trimester-column space-y-2';
        column.dataset.trimester = i;
        column.innerHTML = `<h3>Cuatri ${i}</h3>`;
        const subjectsInTrimester = localState.subjects.filter(s => s.trimester == i);
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
    const unassignedSubjects = localState.subjects.filter(s => !s.trimester || s.trimester === 0);
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
    dom.groupsByTrimester.innerHTML = '';
    dom.unassignedGroupsContainer.innerHTML = '';
     for (let i = 1; i <= 9; i++) {
        const groupsInTrimester = localState.groups.filter(g => g.trimester == i);
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
    const unassignedGroups = localState.groups.filter(g => !g.trimester || g.trimester === 0);
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

// --- Lógica de Arrastrar y Soltar para Gestión ---
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
        // CAMBIO: Se ajusta el formato de la hora para mostrar el rango
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
            const overlaps = dayEvents.filter(e => e.id !== c.id && (c.startTime < (e.startTime + e.duration)) && ((c.startTime + c.duration) > e.startTime));
            const totalOverlaps = overlaps.length + 1;
            const overlapIndex = overlaps.sort((a,b) => a.id.localeCompare(b.id)).findIndex(i => i.id > c.id) + 1;
            const itemDiv = document.createElement('div');
            itemDiv.className = 'schedule-item';
            itemDiv.dataset.classId = c.id;
            itemDiv.style.backgroundColor = getSubjectColor(subject.id);
            const timeColumnWidth = 120; // Se ajusta este valor en el CSS también
            const dayColumnWidth = (dom.scheduleGrid.offsetWidth - timeColumnWidth) / days.length;
            const itemWidth = (dayColumnWidth / totalOverlaps);
            itemDiv.style.top = `${(timeIndex) * 51 + 51}px`;
            itemDiv.style.left = `${timeColumnWidth + 1 + (dayIndex * (dayColumnWidth)) + (overlapIndex * itemWidth)}px`;
            itemDiv.style.width = `${itemWidth - 3}px`;
            itemDiv.style.height = `${(c.duration * 50) + ((c.duration - 1) * 1)}px`;
            let subjectName = subject.name;
            if (totalOverlaps > 2) { itemDiv.style.fontSize = '0.65rem'; subjectName = getInitials(subject.name); }
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
    dom.groupSelect.value = classData.groupId;
    
    populateSubjectFilter();
    
    dom.subjectSelect.value = classData.subjectId;
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
}

function runPedagogicalAnalysis() {
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
    const teacherWorkload = {};
    const groupWorkload = {};

    localState.schedule.forEach(c => {
        teacherWorkload[c.teacherId] = (teacherWorkload[c.teacherId] || 0) + c.duration;
        groupWorkload[c.groupId] = (groupWorkload[c.groupId] || 0) + c.duration;
    });

    dom.teacherWorkload.innerHTML = '<h4 class="font-semibold text-gray-700">Docentes</h4>';
    localState.teachers.forEach(t => {
        const hours = teacherWorkload[t.id] || 0;
        const p = document.createElement('p');
        p.className = `text-sm ${hours > 20 ? 'text-red-600 font-bold' : 'text-gray-600'}`;
        p.textContent = `${t.name}: ${hours} hrs`;
        dom.teacherWorkload.appendChild(p);
    });

    dom.groupWorkload.innerHTML = '<h4 class="font-semibold text-gray-700">Grupos</h4>';
    localState.groups.forEach(g => {
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
