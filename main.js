import { auth } from './config.js';
import { onSnapshot } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { state, cols } from './state.js';
import { renderScheduleGrid } from './grid.js';
import { 
    createTooltip, renderTeachersList, renderSubjectsList, renderGroupsList, 
    renderClassroomsManageList, renderFilterOptions, renderAlerts, 
    addGroup, addClassroom, renderGlobalMatrix, renderExternalClassesPanel, renderSettings 
} from './ui.js';
import { showClassForm, showTeacherForm, showSubjectForm, undoLastAction } from './actions.js';
import { renderMap } from './maps.js';
import { exportSchedule, exportAllSchedules } from './export.js';

function initApp() {
    console.log("IAEV Planner vSmartFilters");
    createTooltip();
    setupListeners();
    setupRealtimeListeners();
}

function setupListeners() {
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
            if(btn.dataset.tab === 'sabana') renderGlobalMatrix();
            if(btn.dataset.tab === 'externas') renderExternalClassesPanel();
            if(btn.dataset.tab === 'gestion') renderSettings();
        };
    });

    // === LISTENER ESPECIAL PARA TURNO ===
    const shiftEl = document.getElementById('filter-shift');
    if (shiftEl) {
        shiftEl.onchange = () => {
            // 1. Resetear el filtro de cuatrimestre a "Todos" para mostrar todo el bloque
            const trimEl = document.getElementById('filter-trimester');
            if(trimEl) trimEl.value = "";
            
            // 2. Actualizar las opciones disponibles en el select de Cuatrimestre
            renderFilterOptions(); 
            
            // 3. Renderizar el grid con el nuevo turno completo
            renderScheduleGrid();
        };
    }

    // Listeners genéricos para los otros filtros
    ['teacher', 'group', 'classroom', 'trimester'].forEach(id => {
        const el = document.getElementById(`filter-${id}`);
        if(el) el.onchange = () => renderScheduleGrid();
    });

    const sabanaDay = document.getElementById('sabana-day-filter');
    if(sabanaDay) sabanaDay.onchange = () => renderGlobalMatrix();

    const bind = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };
    bind('open-class-modal-btn', () => showClassForm());
    bind('add-teacher-btn', () => showTeacherForm()); 
    bind('open-subject-modal-btn', () => showSubjectForm());
    bind('add-group-btn', addGroup);
    bind('add-classroom-btn', addClassroom);
    bind('floor-btn-pb', () => switchFloor('pb'));
    bind('floor-btn-pa', () => switchFloor('pa'));
    bind('btn-undo', undoLastAction);
    bind('btn-export-pdf', () => exportSchedule('pdf'));
    bind('btn-export-img', () => exportSchedule('img'));
    bind('btn-export-all', () => exportAllSchedules(state, renderScheduleGrid));

    const modal = document.getElementById('modal');
    if(modal) modal.onclick = (e) => { if(e.target.id === 'modal') modal.classList.add('hidden'); };
}

function initMapTab() { switchFloor('pa'); }
function switchFloor(floor) {
    const btnPb = document.getElementById('floor-btn-pb'); const btnPa = document.getElementById('floor-btn-pa');
    const active = "px-4 py-2 rounded-md text-sm font-bold bg-white shadow text-indigo-600 transition-all";
    const inactive = "px-4 py-2 rounded-md text-sm font-bold text-gray-500 hover:bg-white hover:shadow transition-all";
    if(floor === 'pb') { btnPb.className = active; btnPa.className = inactive; } else { btnPa.className = active; btnPb.className = inactive; }
    const container = document.getElementById('map-viewport'); renderMap(floor, container, state.schedule, (room) => showRoomDetails(room));
}
function showRoomDetails(room) { /* Sin cambios */ }

function setupRealtimeListeners() {
    const update = (k, s) => {
        state[k] = s.docs.map(d => ({ id: d.id, ...d.data() }));
        
        if (k === 'settings') {
            const globalConf = state.settings.find(d => d.id === 'global');
            if(globalConf) state.settings = globalConf;
            else state.settings = { shiftCutoff: 4 };
        }

        state.loading[k] = false;
        checkLoading();
        
        if(k === 'schedule' || k === 'external' || k === 'settings') renderScheduleGrid();
        
        // Cuando cambian los grupos o settings, hay que refrescar las opciones de filtro (por si cambiaron turnos)
        if(['teachers','subjects','groups','classrooms','settings'].includes(k)) renderFilterOptions();
        
        if(k === 'teachers' || k === 'schedule') renderTeachersList();
        if(k === 'subjects') renderSubjectsList();
        if(k === 'groups') renderGroupsList();
        if(k === 'classrooms') renderClassroomsManageList();
        if(k === 'schedule' || k === 'groups' || k === 'external') renderGlobalMatrix();
        if(k === 'groups' || k === 'external') renderExternalClassesPanel();
        if(['schedule', 'groups', 'subjects'].includes(k)) renderAlerts();
    };
    Object.keys(cols).forEach(k => onSnapshot(cols[k], s => update(k, s)));
}

function checkLoading() { if (!Object.values(state.loading).some(v => v)) { const o = document.getElementById('loading-overlay'); if(o) { o.style.opacity = '0'; setTimeout(() => o.remove(), 500); } } }
auth.onAuthStateChanged(u => { if(u) initApp(); else signInAnonymously(auth).catch(console.error); });
