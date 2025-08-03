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
        const formHtml = `
            <h2 class="text-2xl font-semibold mb-4">Editar ${type}</h2>
            <input type="text" id="modal-edit-name" class="w-full p-2 border rounded-lg" value="${item.name}">
            <div class="mt-6 flex gap-4">
                <button id="modal-cancel-btn" class="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600">Cancelar</button>
                <button id="modal-save-btn" class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700">Guardar Cambios</button>
            </div>`;
        this.show(formHtml);
        document.getElementById('modal-cancel-btn').onclick = () => this.hide();
        document.getElementById('modal-save-btn').onclick = () => saveEditedItem(item.id, type);
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
    onSnapshot(subjectsCol, s => { localState.subjects = s.docs.map(d => ({ id: d.id, ...d.data() })); renderSubjectsByTrimester(); });
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

// ... (Resto de funciones actualizadas)
// ... (El código completo se proporciona a continuación)

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
