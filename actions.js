import { doc, addDoc, updateDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { state, cols, days, timeSlots } from './state.js';

// === AJUSTES ===
export async function saveSettings() {
    const val = document.getElementById('setting-shift-cutoff').value;
    if (val) {
        const num = parseInt(val);
        await setDoc(doc(cols.settings, 'global'), { shiftCutoff: num });
        alert("Configuración guardada.");
    }
}

// === UNDO SYSTEM ===
function pushHistory(inverseAction) { state.history.push(inverseAction); if (state.history.length > 20) state.history.shift(); updateUndoButton(); }
export function updateUndoButton() {
    const btn = document.getElementById('btn-undo'); if (!btn) return;
    if (state.history.length > 0) { btn.disabled = false; btn.classList.remove('opacity-50', 'cursor-not-allowed'); }
    else { btn.disabled = true; btn.classList.add('opacity-50', 'cursor-not-allowed'); }
}
export async function undoLastAction() {
    if (state.history.length === 0) return;
    const action = state.history.pop(); updateUndoButton();
    const noti = (msg) => { const c = document.getElementById('notification-container'); if (c) { const el = document.createElement('div'); el.className = "bg-gray-800 text-white px-4 py-2 rounded shadow text-sm animate-bounce"; el.innerText = msg; c.appendChild(el); setTimeout(() => el.remove(), 2000); } };
    try {
        if (action.type === 'add') { await setDoc(doc(cols[action.col], action.id), action.data); noti("Restaurado"); }
        else if (action.type === 'delete') { await deleteDoc(doc(cols[action.col], action.id)); noti("Eliminado"); }
        else if (action.type === 'update') { await updateDoc(doc(cols[action.col], action.id), action.data); noti("Revertido"); }
    } catch (e) { console.error(e); alert("Error al deshacer"); }
}

// === FORMULARIOS Y ACCIONES ===
export async function handleDrop(e, day, hour) {
    e.preventDefault();
    document.querySelectorAll('.droppable-hover').forEach(c => c.classList.remove('droppable-hover'));

    try {
        const rawData = e.dataTransfer.getData('application/json');
        if (!rawData) return;
        const d = JSON.parse(rawData);

        // === MOVER CLASE EXISTENTE (SWAP O DUPLICAR) ===
        if (d.type === 'move') {
            const sourceId = d.id;
            const sourceClass = state.schedule.find(x => x.id === sourceId);
            if (!sourceClass) return;

            // Ignorar si se suelta en el mismo lugar (y no es duplicado)
            if (!e.ctrlKey && sourceClass.day === day && sourceClass.startTime === hour) return;

            // DUPLICACIÓN (CTRL + DROP)
            if (e.ctrlKey) {
                // Debug to verify detection
                console.log("Ctrl+Drop detected. Duplicating...");

                const newClass = {
                    ...sourceClass,
                    day,
                    startTime: hour,
                };
                delete newClass.id; // Remove source ID

                const ref = await addDoc(cols.schedule, newClass);
                pushHistory({ type: 'delete', col: 'schedule', id: ref.id });
                return;
            }

            // MOVIMIENTO NORMAL (SIN DUPLICAR)
            const newStart = hour;
            const newEnd = hour + sourceClass.duration;

            // Buscar conflictos
            const conflicts = state.schedule.filter(c =>
                c.id !== sourceId &&
                c.day === day &&
                c.startTime < newEnd &&
                (c.startTime + c.duration) > newStart
            );

            if (conflicts.length > 0) {
                // Caso SWAP
                if (conflicts.length === 1) {
                    const targetClass = conflicts[0];
                    const getMsg = (c) => {
                        if (c.type === 'advisory') return "Asesoría " + (state.teachers.find(t => t.id === c.teacherId)?.name || 'Docente');
                        const s = state.subjects.find(x => x.id === c.subjectId);
                        const g = state.groups.find(x => x.id === c.groupId);
                        return (s ? s.name : 'Materia') + (g ? ` (${g.name})` : '');
                    };

                    const msgA = getMsg(sourceClass);
                    const msgB = getMsg(targetClass);

                    import('./ui.js').then(({ showConfirmModal }) => {
                        showConfirmModal(
                            'Confirmar Intercambio',
                            `¿Quieres intercambiar estas dos clases de horario?\n\n"${msgA}"  ↔  "${msgB}"`,
                            async () => {
                                // Realizar SWAP
                                const dataA = { day: day, startTime: hour };
                                const dataB = { day: sourceClass.day, startTime: sourceClass.startTime };

                                // Source
                                const { id: _, ...oldDataA } = sourceClass;
                                pushHistory({ type: 'update', col: 'schedule', id: sourceId, data: oldDataA });
                                await updateDoc(doc(cols.schedule, sourceId), dataA);

                                // Target
                                const { id: __, ...oldDataB } = targetClass;
                                pushHistory({ type: 'update', col: 'schedule', id: targetClass.id, data: oldDataB });
                                await updateDoc(doc(cols.schedule, targetClass.id), dataB);
                            }
                        );
                    });

                } else {
                    alert("⚠️ Conflicto múltiple: Hay varias clases en el destino. No se puede intercambiar automáticamente.");
                }
            } else {
                // Mover libremente sin conflicto
                const { id: _, ...oldData } = sourceClass;
                pushHistory({ type: 'update', col: 'schedule', id: sourceId, data: oldData });
                await updateDoc(doc(cols.schedule, sourceId), { day, startTime: hour });
            }
        }

        // === NUEVA CLASE DESDE SIDEBAR ===
        else if (d.type === 'subject') {
            const s = state.subjects.find(x => x.id === d.id);
            if (s) showClassForm({ day, startTime: hour, subjectId: d.id, teacherId: s.defaultTeacherId || null });
        }

    } catch (err) {
        console.error(err);
    }
}

export function showClassForm(defs = {}) {
    const modal = document.getElementById('modal');
    modal.classList.remove('hidden');
    const content = document.getElementById('modal-content');

    // Auto-select Group from Filter if creating new
    if (!defs.groupId) {
        const filterGroup = document.getElementById('filter-group')?.value;
        if (filterGroup) defs.groupId = filterGroup;
    }

    // Determinar tipo inicial
    const isAdvisory = defs.type === 'advisory';
    const currentType = isAdvisory ? 'advisory' : 'class';

    const genOpts = (arr, sel) => arr.sort((a, b) => a.name.localeCompare(b.name)).map(i => `<option value="${i.id}" ${sel === i.id ? 'selected' : ''}>${i.name}</option>`).join('');

    content.innerHTML = `
        <div class="p-6 bg-white rounded-lg">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-gray-800">${defs.id ? 'Editar' : 'Nueva'} Actividad</h2>
                <div class="flex bg-gray-100 p-1 rounded-lg">
                    <button type="button" id="btn-type-class" class="px-3 py-1 text-xs font-bold rounded ${!isAdvisory ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}">Clase</button>
                    <button type="button" id="btn-type-advisory" class="px-3 py-1 text-xs font-bold rounded ${isAdvisory ? 'bg-white shadow text-amber-600' : 'text-gray-500'}">Asesoría</button>
                </div>
            </div>
            
            <input type="hidden" id="f-type" value="${currentType}">
            <div id="error-box" class="mb-4 hidden p-3 bg-red-100 border-l-4 border-red-500 text-red-700 text-xs rounded"></div>
            
            <div class="grid grid-cols-2 gap-4 text-sm">
                
                <div class="col-span-2">
                    <label class="block font-bold text-gray-500 mb-1">Docente <span class="text-red-500">*</span></label>
                    <select id="f-tch" class="w-full border p-2 rounded bg-white">
                        <option value="">-- Seleccionar Docente --</option>
                        ${genOpts(state.teachers, defs.teacherId)}
                    </select>
                </div>

                <div class="class-field">
                    <label class="block font-bold text-gray-500 mb-1">Grupo</label>
                    <select id="f-grp" class="w-full border p-2 rounded">${genOpts(state.groups, defs.groupId)}</select>
                </div>
                <div class="class-field">
                    <label class="block font-bold text-gray-500 mb-1">Materia</label>
                    <input type="text" id="f-sub-search" placeholder="Buscar materia..." class="w-full border p-2 mb-1 rounded text-sm bg-gray-50">
                    <select id="f-sub" class="w-full border p-2 rounded">${genOpts(state.subjects, defs.subjectId)}</select>
                </div>

                <div><label class="block font-bold text-gray-500 mb-1">Aula (Opcional)</label><select id="f-rm" class="w-full border p-2 rounded"><option value="">-- Sin Aula --</option>${genOpts(state.classrooms, defs.classroomId)}</select></div>
                <div><label class="block font-bold text-gray-500 mb-1">Día</label><select id="f-day" class="w-full border p-2 rounded">${days.map(d => `<option ${d === defs.day ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
                <div><label class="block font-bold text-gray-500 mb-1">Inicio</label><select id="f-time" class="w-full border p-2 rounded">${timeSlots.map(t => `<option value="${t}" ${t == defs.startTime ? 'selected' : ''}>${t}:00</option>`).join('')}</select></div>
                <div><label class="block font-bold text-gray-500 mb-1">Duración (hrs)</label><input type="number" id="f-dur" value="${defs.duration || 1}" min="1" max="6" class="w-full border p-2 rounded"></div>
            </div>
            
            <div class="flex justify-between mt-6">
                <!-- Botón Eliminar (Solo si estamos editando) -->
                <div>
                    ${defs.id ? `<button id="btn-delete" class="px-4 py-2 text-red-600 hover:bg-red-50 hover:text-red-800 rounded font-bold border border-red-200">Eliminar</button>` : ''}
                </div>
                
                <div class="flex gap-3">
                    <button id="btn-cancel" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                    <button id="btn-save" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 shadow font-bold">Guardar</button>
                </div>
            </div>
        </div>`;

    // Lógica de Toggle Tipo
    const btnClass = document.getElementById('btn-type-class');
    const btnAdv = document.getElementById('btn-type-advisory');
    const typeInput = document.getElementById('f-type');

    const toggleType = (t) => {
        typeInput.value = t;
        const isAdv = t === 'advisory';
        // Estilos botones
        btnClass.className = `px-3 py-1 text-xs font-bold rounded ${!isAdv ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:bg-gray-200'}`;
        btnAdv.className = `px-3 py-1 text-xs font-bold rounded ${isAdv ? 'bg-white shadow text-amber-600' : 'text-gray-500 hover:bg-gray-200'}`;
        // Mostrar/Ocultar campos
        document.querySelectorAll('.class-field').forEach(el => el.style.display = isAdv ? 'none' : 'block');
    };

    btnClass.onclick = () => toggleType('class');
    btnAdv.onclick = () => toggleType('advisory');

    // Filtros dinámicos (Solo para modo Clase)
    const selTch = document.getElementById('f-tch');
    const selSub = document.getElementById('f-sub');
    const selGrp = document.getElementById('f-grp');
    const inpSubSearch = document.getElementById('f-sub-search');

    const updateSubjectOptions = () => {
        if (typeInput.value === 'advisory') return;
        const selectedGrpId = selGrp.value;
        const selectedTchId = selTch.value;
        const currentSubId = selSub.value;
        const filterText = inpSubSearch.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        const grp = state.groups.find(g => g.id === selectedGrpId);
        const targetTrimester = grp ? grp.trimester : null;

        const validSubjects = state.subjects.filter(s => {
            const matchesGroup = !targetTrimester || s.trimester === targetTrimester;
            const matchesTeacher = !selectedTchId || s.defaultTeacherId === selectedTchId;

            // Search filter
            const sNameNorm = s.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const matchesSearch = !filterText || sNameNorm.includes(filterText);

            return (s.id === defs.subjectId || (matchesGroup && matchesTeacher)) && matchesSearch;
        });

        selSub.innerHTML = validSubjects.sort((a, b) => a.name.localeCompare(b.name)).map(s => `<option value="${s.id}" ${s.id === currentSubId ? 'selected' : ''}>${s.name}</option>`).join('');

        // Auto-select first if current is invalid
        if (validSubjects.length > 0 && !validSubjects.find(s => s.id === selSub.value)) {
            selSub.value = validSubjects[0].id;
        }
    };

    selGrp.onchange = updateSubjectOptions;
    selTch.onchange = updateSubjectOptions;
    inpSubSearch.oninput = updateSubjectOptions; // Trigger on typing

    selSub.onchange = () => { const sub = state.subjects.find(s => s.id === selSub.value); if (sub && sub.defaultTeacherId) selTch.value = sub.defaultTeacherId; };

    // Init state
    toggleType(currentType);
    updateSubjectOptions();

    document.getElementById('btn-cancel').onclick = () => modal.classList.add('hidden');

    // Botón Eliminar
    const btnDelete = document.getElementById('btn-delete');
    if (btnDelete) {
        btnDelete.onclick = () => {
            deleteDocWrapper('schedule', defs.id);
            modal.classList.add('hidden');
        };
    }

    document.getElementById('btn-save').onclick = async () => {
        const type = document.getElementById('f-type').value;
        const payload = {
            type: type,
            teacherId: document.getElementById('f-tch').value,
            classroomId: document.getElementById('f-rm').value,
            day: document.getElementById('f-day').value,
            startTime: parseInt(document.getElementById('f-time').value),
            duration: parseInt(document.getElementById('f-dur').value)
        };

        if (type === 'class') {
            payload.subjectId = document.getElementById('f-sub').value;
            payload.groupId = document.getElementById('f-grp').value;
        } else {
            payload.subjectId = null;
            payload.groupId = null;
        }

        // Validación Básica
        if (!payload.teacherId) { alert("Debes seleccionar un docente."); return; }
        if (type === 'class' && (!payload.subjectId || !payload.groupId)) { alert("Faltan datos de la clase."); return; }

        const conflicts = validateConflicts(payload, defs.id);
        if (conflicts.length > 0) { const errBox = document.getElementById('error-box'); errBox.innerHTML = `<strong>⚠️ Conflictos:</strong><ul class="list-disc pl-4 mt-1">${conflicts.map(c => `<li>${c}</li>`).join('')}</ul>`; errBox.classList.remove('hidden'); return; }
        await commitSave(payload, defs.id);
    };
}

async function commitSave(data, id) { try { if (id) { const old = state.schedule.find(s => s.id === id); if (old) { const { id: _, ...d } = old; pushHistory({ type: 'update', col: 'schedule', id, data: d }); } await updateDoc(doc(cols.schedule, id), data); } else { const ref = await addDoc(cols.schedule, data); pushHistory({ type: 'delete', col: 'schedule', id: ref.id }); } document.getElementById('modal').classList.add('hidden'); } catch (e) { console.error(e); } }

function validateConflicts(newClass, ignoreId) {
    const conflicts = []; const ns = newClass.startTime; const ne = ns + newClass.duration;
    state.schedule.forEach(e => {
        if (e.id === ignoreId || e.day !== newClass.day) return;
        const es = e.startTime; const ee = es + e.duration;
        if (ns < ee && ne > es) {
            // 1. Conflicto Docente (Aplica a Clases y Asesorías)
            if (e.teacherId && e.teacherId === newClass.teacherId) {
                const typeLabel = e.type === 'advisory' ? "una Asesoría" : "clase";
                conflicts.push(`El docente ya tiene ${typeLabel} asignada.`);
            }

            // 2. Conflicto Grupo (Solo si la nueva es CLASE)
            if (newClass.type === 'class' && e.type === 'class' && e.groupId === newClass.groupId) {
                conflicts.push("El grupo ya tiene clase.");
            }

            // 3. Conflicto Aula (Si se seleccionó aula)
            if (newClass.classroomId && e.classroomId && e.classroomId === newClass.classroomId) {
                conflicts.push("El aula está ocupada.");
            }
        }
    });
    return conflicts;
}

export async function addExternalRule() {
    const type = document.getElementById('ext-type').value; const groupId = document.getElementById('ext-group').value; const day = document.getElementById('ext-day').value; const start = parseInt(document.getElementById('ext-start').value); const end = parseInt(document.getElementById('ext-end').value);
    if (start >= end) { alert("Error en horas"); return; }
    const data = { type, groupId, day, start, end }; const ref = await addDoc(cols.external, data); pushHistory({ type: 'delete', col: 'external', id: ref.id });
}

export function showTeacherForm(teacher = null) {
    const modal = document.getElementById('modal'); modal.classList.remove('hidden'); const isEdit = !!teacher;
    document.getElementById('modal-content').innerHTML = `
        <div class="p-6 bg-white">
            <h2 class="font-bold mb-4 text-gray-800">${isEdit ? 'Editar' : 'Nuevo'} Docente</h2>
            <div class="mb-3">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Apodo / Nombre Corto</label>
                <input id="t-name" value="${teacher ? teacher.name : ''}" class="w-full border p-2 rounded" placeholder="Ej: Alex">
            </div>
            <div class="mb-3">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo</label>
                <input id="t-full" value="${teacher ? (teacher.fullName || '') : ''}" class="w-full border p-2 rounded" placeholder="Nombre Real">
            </div>
            <div class="mb-4">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Meta: Horas Asesoría Semanal</label>
                <input type="number" id="t-advisory" value="${teacher ? (teacher.advisoryHours || 0) : 0}" class="w-full border p-2 rounded" min="0">
                <p class="text-[10px] text-gray-400 mt-1">Define cuántas horas de asesoría *debe* cumplir este docente.</p>
            </div>
            <div class="mb-4">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Color Distintivo</label>
                <div class="flex gap-2 items-center">
                    <input type="color" id="t-color" value="${teacher ? (teacher.color || '#3b82f6') : '#3b82f6'}" class="h-9 w-16 p-0 border rounded cursor-pointer" oninput="document.getElementById('t-color-text').value = this.value">
                    <input type="text" id="t-color-text" value="${teacher ? (teacher.color || '#3b82f6') : '#3b82f6'}" class="flex-1 border p-2 rounded text-sm uppercase font-mono" 
                        oninput="document.getElementById('t-color').value = this.value"
                        onchange="document.getElementById('t-color').value = this.value">
                </div>
                <p class="text-[10px] text-gray-400 mt-1">Este color identificará al docente en el horario.</p>
            </div>
            <div class="mb-4">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Materias que imparte</label>
                <input type="text" id="search-subjects-teacher" placeholder="🔍 Buscar materia..." class="w-full border p-1 mb-2 rounded text-xs bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-200 outline-none transition-all">
                <div id="teacher-subjects-list" class="h-32 overflow-y-auto border p-2 rounded bg-gray-50 grid grid-cols-1 gap-1">
                    ${state.subjects.map(s => `
                        <label class="flex items-center gap-2 text-xs hover:bg-white p-1 rounded transition-colors" data-name="${s.name.toLowerCase()}">
                            <input type="checkbox" class="t-sub-check" value="${s.id}" ${teacher && teacher.subjectIds && teacher.subjectIds.includes(s.id) ? 'checked' : ''}>
                            <span class="truncate" title="${s.name}">${s.name}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            <div class="flex justify-end gap-2">
                <button onclick="document.getElementById('modal').classList.add('hidden')" class="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded">Cancelar</button>
                <button id="btn-t-save" class="bg-blue-600 text-white px-4 py-2 rounded font-bold shadow hover:bg-blue-700">Guardar</button>
            </div>
        </div>`;

    // Search Logic
    document.getElementById('search-subjects-teacher').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const labels = document.querySelectorAll('#teacher-subjects-list label');
        labels.forEach(lbl => {
            const name = lbl.dataset.name;
            if (name.includes(term)) {
                lbl.classList.remove('hidden');
            } else {
                lbl.classList.add('hidden');
            }
        });
    });
    document.getElementById('btn-t-save').onclick = async () => {
        const n = document.getElementById('t-name').value;
        const f = document.getElementById('t-full').value;
        const adv = parseInt(document.getElementById('t-advisory').value) || 0;
        const col = document.getElementById('t-color').value;

        // Collect checked subjects
        const checkedSubjects = Array.from(document.querySelectorAll('.t-sub-check:checked')).map(cb => cb.value);

        if (n) {
            const data = { name: n, fullName: f, advisoryHours: adv, subjectIds: checkedSubjects, color: col };
            if (isEdit) {
                const { id: _, ...d } = teacher;
                pushHistory({ type: 'update', col: 'teachers', id: teacher.id, data: d });
                await updateDoc(doc(cols.teachers, teacher.id), data);

                // SYNC: Update Subjects "defaultTeacherId"
                // 1. Find subjects that were checked but didn't have this teacher before? 
                //    Actually simpler: For ALL checked subjects, set defaultTeacherId = teacher.id
                //    For subjects REMOVED (that had this teacher), set defaultTeacherId = null

                // Helper to update without blocking UI too much (can be async background)
                const updateSubjects = async () => {
                    const batchPromises = [];

                    // A. Set this teacher for all checked
                    checkedSubjects.forEach(subId => {
                        const s = state.subjects.find(x => x.id === subId);
                        if (s && s.defaultTeacherId !== teacher.id) {
                            batchPromises.push(updateDoc(doc(cols.subjects, subId), { defaultTeacherId: teacher.id }));
                        }
                    });

                    // B. Remove this teacher from subjects that were UNCHECKED (but previously had this teacher)
                    // We need to look at ALL subjects where defaultTeacherId == teacher.id, 
                    // and if they are NOT in checkedSubjects, clear them.
                    state.subjects.filter(s => s.defaultTeacherId === teacher.id).forEach(s => {
                        if (!checkedSubjects.includes(s.id)) {
                            batchPromises.push(updateDoc(doc(cols.subjects, s.id), { defaultTeacherId: null }));
                        }
                    });

                    await Promise.all(batchPromises);
                };
                updateSubjects(); // Run in background/async

            } else {
                const ref = await addDoc(cols.teachers, data);
                pushHistory({ type: 'delete', col: 'teachers', id: ref.id });

                // For new teacher, just set the checked ones
                const updateSubjects = async () => {
                    const batchPromises = checkedSubjects.map(subId =>
                        updateDoc(doc(cols.subjects, subId), { defaultTeacherId: ref.id })
                    );
                    await Promise.all(batchPromises);
                };
                updateSubjects();
            }
            modal.classList.add('hidden');
        }
    };
}

export function showSubjectForm(sub = null) {
    const modal = document.getElementById('modal'); modal.classList.remove('hidden'); const isEdit = !!sub; const defT = sub ? sub.defaultTeacherId : ''; const genOpts = (arr) => arr.map(i => `<option value="${i.id}" ${defT === i.id ? 'selected' : ''}>${i.name}</option>`).join('');
    document.getElementById('modal-content').innerHTML = `
        <div class="p-6 bg-white">
            <h2 class="font-bold mb-4">${isEdit ? 'Editar' : 'Nueva'} Materia</h2>
            <input id="s-name" value="${sub ? sub.name : ''}" class="w-full border p-2 mb-2" placeholder="Nombre Materia">
            <div class="flex gap-2 mb-2">
                 <select id="s-trim" class="flex-1 border p-2">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `<option value="${i}" ${sub && sub.trimester == i ? 'selected' : ''}>Cuatri ${i}</option>`).join('')}</select>
                 <div class="w-12 h-10 relative overflow-hidden rounded border">
                    <input type="color" id="s-color" value="${sub && sub.color ? sub.color : '#6366f1'}" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] cursor-pointer p-0 border-0">
                 </div>
            </div>
            
            <!-- Hours Calculation Section -->
            <div class="bg-indigo-50 p-3 rounded-lg mb-4 border border-indigo-100">
                <label class="block text-xs font-bold text-indigo-800 uppercase mb-2">Calculadora de Horas</label>
                <div class="flex gap-2 mb-2">
                    <div class="flex-1">
                        <label class="text-[10px] text-gray-500 font-bold block mb-1">Total Horas Cuatri</label>
                        <input type="number" id="s-total-hours" value="${sub && sub.totalHours ? sub.totalHours : 60}" class="w-full border p-2 rounded text-sm font-bold text-gray-700">
                    </div>
                    <div class="w-20">
                        <label class="text-[10px] text-gray-500 font-bold block mb-1">Semanas</label>
                        <input type="number" id="s-weeks" value="${sub && sub.weeks ? sub.weeks : 15}" class="w-full border p-2 rounded text-sm text-center">
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400">Resultante:</span>
                    <input type="number" id="s-hours" value="${sub && sub.weeklyHours ? sub.weeklyHours : 4}" class="flex-1 border-2 border-indigo-200 p-2 rounded text-sm font-bold text-indigo-700 bg-white" min="1" max="20" readonly>
                    <span class="text-xs font-bold text-indigo-800">Hrs/Semana</span>
                </div>
            </div>

            <select id="s-def" class="w-full border p-2 mb-4"><option value="">-- Profe Default --</option>${genOpts(state.teachers)}</select>
            <button id="btn-s-save" class="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 font-bold w-full">Guardar Materia</button>
        </div>`;

    // Calculation Logic
    const calc = () => {
        const total = parseInt(document.getElementById('s-total-hours').value) || 0;
        const weeks = parseInt(document.getElementById('s-weeks').value) || 15;
        const weekly = weeks > 0 ? Math.ceil(total / weeks) : 0;
        document.getElementById('s-hours').value = weekly;
    };
    document.getElementById('s-total-hours').addEventListener('input', calc);
    document.getElementById('s-weeks').addEventListener('input', calc);

    document.getElementById('btn-s-save').onclick = async () => {
        const n = document.getElementById('s-name').value;
        const color = document.getElementById('s-color').value;
        const hours = parseInt(document.getElementById('s-hours').value) || 4;
        const total = parseInt(document.getElementById('s-total-hours').value) || 0;
        const weeks = parseInt(document.getElementById('s-weeks').value) || 15;

        const data = {
            name: n,
            trimester: parseInt(document.getElementById('s-trim').value),
            defaultTeacherId: document.getElementById('s-def').value,
            color: color,
            weeklyHours: hours,
            totalHours: total,
            weeks: weeks
        };
        if (n) {
            if (isEdit) { const { id: _, ...d } = sub; pushHistory({ type: 'update', col: 'subjects', id: sub.id, data: d }); await updateDoc(doc(cols.subjects, sub.id), data); }
            else { const ref = await addDoc(cols.subjects, data); pushHistory({ type: 'delete', col: 'subjects', id: ref.id }); }
            modal.classList.add('hidden');
        }
    };

}

export function showGroupForm(group = null) {
    const modal = document.getElementById('modal'); modal.classList.remove('hidden'); const isEdit = !!group;
    document.getElementById('modal-content').innerHTML = `<div class="p-6 bg-white"><h2 class="font-bold mb-4">${isEdit ? 'Editar' : 'Nuevo'} Grupo</h2><div class="mb-4"><label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre del Grupo</label><input id="g-name" value="${group ? group.name : ''}" class="w-full border p-2 rounded" placeholder="Ej: IAEV-10"></div><div class="mb-4"><label class="block text-xs font-bold text-gray-500 uppercase mb-1">Cuatrimestre</label><select id="g-trim" class="w-full border p-2 rounded">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => `<option value="${i}" ${group && group.trimester == i ? 'selected' : ''}>${i}° Cuatrimestre</option>`).join('')}</select></div><div class="flex justify-end gap-2"><button onclick="document.getElementById('modal').classList.add('hidden')" class="px-4 py-2 text-gray-500">Cancelar</button><button id="btn-g-save" class="bg-purple-600 text-white px-4 py-2 rounded font-bold">Guardar</button></div></div>`;
    document.getElementById('btn-g-save').onclick = async () => { const n = document.getElementById('g-name').value; const t = parseInt(document.getElementById('g-trim').value); if (n) { const data = { name: n, trimester: t }; if (isEdit) { const { id: _, ...d } = group; pushHistory({ type: 'update', col: 'groups', id: group.id, data: d }); await updateDoc(doc(cols.groups, group.id), data); } else { const ref = await addDoc(cols.groups, data); pushHistory({ type: 'delete', col: 'groups', id: ref.id }); } modal.classList.add('hidden'); } };
}

export function showClassroomForm(room = null) {
    const modal = document.getElementById('modal'); modal.classList.remove('hidden'); const isEdit = !!room;
    document.getElementById('modal-content').innerHTML = `<div class="p-6 bg-white"><h2 class="font-bold mb-4">${isEdit ? 'Editar' : 'Nueva'} Aula</h2><div class="mb-4"><label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre del Aula</label><input id="r-name" value="${room ? room.name : ''}" class="w-full border p-2 rounded" placeholder="Ej: Lab. Cómputo 1"></div><div class="flex justify-end gap-2"><button onclick="document.getElementById('modal').classList.add('hidden')" class="px-4 py-2 text-gray-500">Cancelar</button><button id="btn-r-save" class="bg-teal-600 text-white px-4 py-2 rounded font-bold">Guardar</button></div></div>`;
    document.getElementById('btn-r-save').onclick = async () => { const n = document.getElementById('r-name').value; if (n) { const data = { name: n }; if (isEdit) { const { id: _, ...d } = room; pushHistory({ type: 'update', col: 'classrooms', id: room.id, data: d }); await updateDoc(doc(cols.classrooms, room.id), data); } else { const ref = await addDoc(cols.classrooms, data); pushHistory({ type: 'delete', col: 'classrooms', id: ref.id }); } modal.classList.add('hidden'); } };
}

export async function restoreDoc(item) {
    try {
        const { id, _col, _deletedAt, ...data } = item;
        await setDoc(doc(cols[_col], id), data);
        state.deletedItems = state.deletedItems.filter(i => i.id !== id);
        alert("Elemento restaurado.");
        // Notify UI update if needed (will happen via realtime listener)
    } catch (e) {
        console.error(e);
        alert("Error al restaurar.");
    }
}

export function deleteDocWrapper(colName, id) {
    import('./ui.js').then(({ showConfirmModal }) => {
        showConfirmModal(
            'Confirmar Eliminación',
            '¿Seguro de borrar este elemento? Esta acción se enviará a la Papelera.',
            async () => {
                let old = null;
                if (colName === 'schedule') old = state.schedule.find(x => x.id === id);
                else if (colName === 'external') old = state.external.find(x => x.id === id);
                else if (colName === 'teachers') old = state.teachers.find(x => x.id === id);
                else if (colName === 'groups') old = state.groups.find(x => x.id === id);
                else if (colName === 'classrooms') old = state.classrooms.find(x => x.id === id);

                if (old) {
                    const { id: _, ...d } = old;
                    pushHistory({ type: 'add', col: colName, id, data: d }); // Keep sequential undo

                    // Add to Recycle Bin (In-Memory State)
                    if (state.deletedItems) {
                        state.deletedItems.push({ ...old, _deletedAt: new Date(), _col: colName });
                    }
                }

                await deleteDoc(doc(cols[colName], id));
            }
        );
    });
}
