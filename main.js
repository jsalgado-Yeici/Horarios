import { auth, collection } from './config.js';
import { onSnapshot } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { state, cols } from './state.js';
import { renderScheduleGrid } from './grid.js';
import { 
    createTooltip, renderTeachersList, renderSubjectsList, renderGroupsList, 
    renderBlocksList, renderClassroomsManageList, renderFilterOptions, renderAlerts, 
    addGroup, addClassroom, addBlock, renderStatistics, showAddAbsenceModal,
    renderGlobalMatrix // Importado
} from './ui.js';
import { showClassForm, showTeacherForm, showSubjectForm, undoLastAction } from './actions.js'; // Importado undo
import { renderMap } from './maps.js';
import { exportSchedule, exportAllSchedules } from './export.js';

function initApp() {
    console.log("App v14.0 (Undo + Sabana)");
    createTooltip();
    setupListeners();
    setupRealtimeListeners();
}

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
            document.getElementById(`tab-content-${btn.dataset.tab}`).classList.remove('hidden');
            
            if(btn.dataset.tab === 'horario') renderScheduleGrid();
            if(btn.dataset.tab === 'mapa') initMapTab();
            if(btn.dataset.tab === 'estadisticas') renderStatistics();
            if(btn.dataset.tab === 'sabana') renderGlobalMatrix(); // Renderizar Sábana
        };
    });

    // Filtros
    ['teacher', 'group', 'classroom', 'trimester'].forEach(id => {
        const el = document.getElementById(`filter-${id}`);
        if(el) el.onchange = () => renderScheduleGrid();
    });
    
    // Selectores de Estadísticas y Sábana
    ['stats-month', 'stats-year'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.onchange = () => renderStatistics();
    });

    // Selector Día Sábana
    const sabanaDay = document.getElementById('sabana-day-filter');
    if(sabanaDay) sabanaDay.onchange = () => renderGlobalMatrix();

    // Botones
    const bind = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };
    bind('open-class-modal-btn', () => showClassForm());
    bind('add-teacher-btn', () => showTeacherForm()); 
    bind('open-subject-modal-btn', () => showSubjectForm());
    bind('add-group-btn', addGroup);
    bind('add-block-btn', addBlock);
    bind('add-classroom-btn', addClassroom);
    bind('floor-btn-pb', () => switchFloor('pb'));
    bind('floor-btn-pa', () => switchFloor('pa'));
    bind('btn-undo', undoLastAction); // Botón Undo
    
    // Estadísticas
    bind('btn-add-absence', showAddAbsenceModal);
    
    bind('btn-export-pdf', () => exportSchedule('pdf'));
    bind('btn-export-img', () => exportSchedule('img'));
    bind('btn-export-all', () => exportAllSchedules(state, renderScheduleGrid));

    const modal = document.getElementById('modal');
    if(modal) modal.onclick = (e) => { if(e.target.id === 'modal') modal.classList.add('hidden'); };
}

// === LÓGICA DEL MAPA ===
function initMapTab() { switchFloor('pa'); }
function switchFloor(floor) {
    const btnPb = document.getElementById('floor-btn-pb');
    const btnPa = document.getElementById('floor-btn-pa');
    const active = "px-4 py-2 rounded-md text-sm font-bold bg-white shadow text-indigo-600 transition-all";
    const inactive = "px-4 py-2 rounded-md text-sm font-bold text-gray-500 hover:bg-white hover:shadow transition-all";
    if(floor === 'pb') { btnPb.className = active; btnPa.className = inactive; } 
    else { btnPa.className = active; btnPb.className = inactive; }
    const container = document.getElementById('map-viewport');
    renderMap(floor, container, state.schedule, (room) => showRoomDetails(room));
}
function showRoomDetails(room) {
    const modal = document.getElementById('modal'); modal.classList.remove('hidden');
    const content = document.getElementById('modal-content');
    const classes = state.schedule.filter(c => c.classroomId === room.id || (state.classrooms.find(cr => cr.name === room.name)?.id === c.classroomId));
    const dayOrder = { "Lunes": 1, "Martes": 2, "Miércoles": 3, "Jueves": 4, "Viernes": 5 };
    classes.sort((a,b) => (dayOrder[a.day] - dayOrder[b.day]) || (a.startTime - b.startTime));
    let html = `<div class="p-6 bg-white"><h2 class="text-2xl font-bold mb-1 text-gray-800">${room.name}</h2><div class="border-t border-gray-100 pt-4 max-h-[60vh] overflow-y-auto">`;
    if(classes.length === 0) html += `<div class="text-center py-8 text-gray-400 italic">No hay clases asignadas.</div>`;
    else {
        html += `<table class="w-full text-sm text-left"><thead class="text-xs text-gray-500 uppercase bg-gray-50"><tr><th class="px-2 py-2">Día</th><th class="px-2 py-2">Hora</th><th class="px-2 py-2">Materia</th><th class="px-2 py-2">Docente</th></tr></thead><tbody class="divide-y divide-gray-100">`;
        classes.forEach(c => {
            const subj = state.subjects.find(s => s.id === c.subjectId)?.name || '???';
            const teach = state.teachers.find(t => t.id === c.teacherId)?.name || '???';
            html += `<tr class="hover:bg-gray-50"><td class="px-2 py-3 font-medium">${c.day}</td><td class="px-2 py-3">${c.startTime}:00 - ${c.startTime + c.duration}:00</td><td class="px-2 py-3 font-semibold">${subj}</td><td class="px-2 py-3 text-gray-500">${teach}</td></tr>`;
        });
        html += `</tbody></table>`;
    }
    html += `</div><div class="mt-6 flex justify-end"><button id="close-room-btn" class="px-4 py-2 bg-gray-800 text-white rounded">Cerrar</button></div></div>`;
    content.innerHTML = html;
    document.getElementById('close-room-btn').onclick = () => modal.classList.add('hidden');
}

// === FIREBASE LISTENERS ===
function setupRealtimeListeners() {
    const update = (k, s) => {
        state[k] = s.docs.map(d => ({ id: d.id, ...d.data() }));
        state.loading[k] = false;
        checkLoading();
        
        // Re-renders automáticos
        if(k === 'schedule' || k === 'blocks') renderScheduleGrid();
        if(['teachers','subjects','groups','classrooms'].includes(k)) renderFilterOptions();
        if(k === 'teachers') renderTeachersList();
        if(k === 'subjects') renderSubjectsList();
        if(k === 'groups') renderGroupsList();
        if(k === 'blocks') renderBlocksList();
        if(k === 'classrooms') renderClassroomsManageList();
        if(k === 'attendance' || k === 'schedule' || k === 'groups') renderStatistics();
        
        // Renderizar Sábana si hay cambios en schedule
        if(k === 'schedule' || k === 'groups') renderGlobalMatrix();

        // Actualizar alertas de auditoría
        if(['schedule', 'groups', 'subjects'].includes(k)) renderAlerts();
    };
    Object.keys(cols).forEach(k => onSnapshot(cols[k], s => update(k, s)));
}

function checkLoading() { 
    if (!Object.values(state.loading).some(v => v)) { 
        const o = document.getElementById('loading-overlay'); 
        if(o) { 
            o.style.opacity = '0'; 
            setTimeout(() => o.remove(), 500); 
        }
    }
}

auth.onAuthStateChanged(u => { if(u) initApp(); else signInAnonymously(auth).catch(console.error); });
