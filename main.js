import { auth } from './config.js';
import { onSnapshot } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { state, cols } from './state.js';
import { renderScheduleGrid } from './grid.js';
import {
    createTooltip, renderTeachersList, renderSubjectsList, renderGroupsList,
    renderClassroomsManageList, renderFilterOptions, renderAlerts,
    addGroup, addClassroom, renderGlobalMatrix, renderExternalClassesPanel, renderSettings,
    renderRoomHeatmap, renderVersion // Nueva Importación
} from './ui.js';
import { showClassForm, showTeacherForm, showSubjectForm, undoLastAction } from './actions.js';
import { renderMap } from './maps.js';
import { exportSchedule, exportAllSchedules } from './export.js';

function initApp() {
    console.log("IAEV Planner vPro (Hotkeys + Heatmap)");
    createTooltip();
    renderVersion();
    setupListeners();
    setupRealtimeListeners();
}

function setupListeners() {
    // === ATAJOS DE TECLADO ===
    document.addEventListener('keydown', (e) => {
        // Ctrl + Z (Deshacer)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undoLastAction();
        }
        // Esc (Cerrar Modales)
        if (e.key === 'Escape') {
            document.getElementById('modal').classList.add('hidden');
        }
    });

    // TABS
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

            // Renderizado condicional por pestaña
            const tab = btn.dataset.tab;
            if (tab === 'horario') renderScheduleGrid();
            if (tab === 'mapa') initMapTab();
            if (tab === 'sabana') renderGlobalMatrix();
            if (tab === 'externas') renderExternalClassesPanel();
            if (tab === 'gestion') renderSettings();
            if (tab === 'reportes') renderRoomHeatmap(); // Renderizar mapa de calor
        };
    });

    // Listeners Filtros
    const shiftEl = document.getElementById('filter-shift');
    if (shiftEl) {
        shiftEl.onchange = () => {
            const trimEl = document.getElementById('filter-trimester');
            if (trimEl) trimEl.value = "";
            renderFilterOptions();
            renderScheduleGrid();
        };
    }
    ['teacher', 'group', 'classroom', 'trimester'].forEach(id => {
        const el = document.getElementById(`filter-${id}`);
        if (el) el.onchange = () => renderScheduleGrid();
    });

    const sabanaDay = document.getElementById('sabana-day-filter');
    if (sabanaDay) sabanaDay.onchange = () => renderGlobalMatrix();

    const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
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
    if (modal) modal.onclick = (e) => { if (e.target.id === 'modal') modal.classList.add('hidden'); };
}

function initMapTab() { switchFloor('pa'); }
function switchFloor(floor) {
    const btnPb = document.getElementById('floor-btn-pb'); const btnPa = document.getElementById('floor-btn-pa');
    const active = "px-4 py-2 rounded-md text-sm font-bold bg-white shadow text-indigo-600 transition-all";
    const inactive = "px-4 py-2 rounded-md text-sm font-bold text-gray-500 hover:bg-white hover:shadow transition-all";
    if (floor === 'pb') { btnPb.className = active; btnPa.className = inactive; } else { btnPa.className = active; btnPb.className = inactive; }
    const container = document.getElementById('map-viewport'); renderMap(floor, container, state.schedule, state.classrooms, (room) => showRoomDetails(room));
}
function showRoomDetails(room) {
    const modal = document.getElementById('modal');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');

    // 1. Filtrar clases de este salón
    const roomClasses = state.schedule.filter(c => c.classroomId === room.id);

    // 2. Calcular estadísticas
    const totalHours = roomClasses.reduce((acc, c) => acc + c.duration, 0);
    const capacity = 70; // 14h * 5 días
    const usagePct = Math.min((totalHours / capacity) * 100, 100).toFixed(0);

    // 3. Ordenar por día y hora
    const dayOrder = { 'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5 };
    roomClasses.sort((a, b) => {
        const d = dayOrder[a.day] - dayOrder[b.day];
        if (d !== 0) return d;
        return a.startTime - b.startTime;
    });

    // 4. Generar HTML
    let html = `
        <div class="p-6 bg-white relative">
            <button id="close-room-details" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-xl">×</button>
            
            <div class="flex items-center gap-3 mb-4">
                <div class="text-3xl">${room.icon || '📍'}</div>
                <div>
                    <h2 class="text-2xl font-bold text-gray-800">${room.name}</h2>
                    <p class="text-sm text-gray-500 uppercase tracking-wide font-bold">${room.type === 'office' ? 'Oficina Administrativa' : 'Espacio Académico'}</p>
                </div>
            </div>

            <div class="mb-6 bg-slate-50 p-4 rounded-xl border border-gray-200">
                <div class="flex justify-between items-end mb-2">
                    <span class="text-sm font-bold text-gray-600">Uso Semanal</span>
                    <span class="text-2xl font-bold ${usagePct > 60 ? 'text-red-500' : 'text-indigo-600'}">${usagePct}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div class="h-full transition-all duration-1000 ${usagePct > 60 ? 'bg-red-500' : (usagePct > 30 ? 'bg-orange-500' : 'bg-blue-500')}" style="width: ${usagePct}%"></div>
                </div>
                <p class="text-xs text-right text-gray-400 mt-1">${totalHours} horas ocupadas de ${capacity} disponibles.</p>
            </div>

            <h3 class="font-bold text-gray-700 mb-3 border-b pb-2">📅 Horario Asignado</h3>
            <div class="overflow-y-auto max-h-[400px] space-y-2 pr-1">
    `;

    if (roomClasses.length === 0) {
        html += `<div class="text-center py-8 text-gray-400 italic">No hay clases asignadas a este espacio.</div>`;
    } else {
        roomClasses.forEach(c => {
            const subject = state.subjects.find(s => s.id === c.subjectId);
            const group = state.groups.find(g => g.id === c.groupId);
            const teacher = state.teachers.find(t => t.id === c.teacherId);

            html += `
                <div class="flex items-center gap-3 p-3 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-indigo-500">
                    <div class="flex flex-col items-center justify-center bg-gray-100 rounded p-2 min-w-[60px]">
                        <span class="text-xs font-bold text-gray-500 uppercase">${c.day.substring(0, 3)}</span>
                        <span class="text-lg font-bold text-indigo-700">${c.startTime}:00</span>
                    </div>
                    <div>
                        <h4 class="font-bold text-gray-800 text-sm">${subject ? subject.name : 'Materia Desconocida'}</h4>
                        <div class="text-xs text-gray-500 flex gap-2">
                            <span class="bg-gray-100 px-1.5 rounded text-gray-600">👥 ${group ? group.name : 'S/G'}</span>
                            <span class="bg-gray-100 px-1.5 rounded text-gray-600">👨‍🏫 ${teacher ? teacher.name : 'S/D'}</span>
                        </div>
                    </div>
                    <div class="ml-auto text-xs font-bold text-gray-400">
                        ${c.duration}h
                    </div>
                </div>
            `;
        });
    }

    html += `
            </div>
            <div class="mt-6 flex justify-between">
                <button id="btn-quick-schedule" class="px-4 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg font-bold flex items-center gap-2">
                    <span>➕ Programar Clase Aquí</span>
                </button>
                <button onclick="document.getElementById('modal').classList.add('hidden')" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg transition-colors">Cerrar</button>
            </div>
        </div>
    `;

    content.innerHTML = html;

    // Bind buttons
    const closeBtn = document.getElementById('close-room-details');
    if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');

    const scheduleBtn = document.getElementById('btn-quick-schedule');
    if (scheduleBtn) scheduleBtn.onclick = () => {
        // Close details modal first? Or just swap content?
        // showClassForm replaces innerHTML of modal-content, so it works.
        showClassForm({ classroomId: room.id });
    };
}

function setupRealtimeListeners() {
    const update = (k, s) => {
        state[k] = s.docs.map(d => ({ id: d.id, ...d.data() }));

        if (k === 'settings') {
            const globalConf = state.settings.find(d => d.id === 'global');
            if (globalConf) state.settings = globalConf;
            else state.settings = { shiftCutoff: 4 };
        }

        state.loading[k] = false;
        checkLoading();

        if (k === 'schedule' || k === 'external' || k === 'settings') renderScheduleGrid();

        if (['teachers', 'subjects', 'groups', 'classrooms', 'settings'].includes(k)) renderFilterOptions();

        if (k === 'teachers' || k === 'schedule') renderTeachersList();
        if (k === 'subjects') renderSubjectsList();
        if (k === 'groups') renderGroupsList();
        if (k === 'classrooms') { renderClassroomsManageList(); renderRoomHeatmap(); }
        if (k === 'schedule' || k === 'groups' || k === 'external') renderGlobalMatrix();
        if (k === 'groups' || k === 'external') renderExternalClassesPanel();
        if (['schedule', 'groups', 'subjects'].includes(k)) renderAlerts();
    };
    Object.keys(cols).forEach(k => onSnapshot(cols[k], s => update(k, s)));
}

function checkLoading() { if (!Object.values(state.loading).some(v => v)) { const o = document.getElementById('loading-overlay'); if (o) { o.style.opacity = '0'; setTimeout(() => o.remove(), 500); } } }
auth.onAuthStateChanged(u => { if (u) initApp(); else signInAnonymously(auth).catch(console.error); });
