import { doc, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { state, cols, days, timeSlots } from './state.js';

// === DRAG & DROP LOGIC ===
export function handleDrop(e, day, hour) {
    e.preventDefault();
    document.querySelectorAll('.droppable-hover').forEach(c => c.classList.remove('droppable-hover'));
    
    try {
        const rawData = e.dataTransfer.getData('application/json');
        if (!rawData) return;
        
        const d = JSON.parse(rawData);
        if(d.type === 'subject') {
            const s = state.subjects.find(x => x.id === d.id);
            if(s) {
                // Abrir formulario prellenado
                showClassForm({
                    day, 
                    startTime: hour, 
                    subjectId: d.id, 
                    teacherId: s.defaultTeacherId || null
                });
            }
        }
    } catch(err){
        console.error("Error en Drop:", err);
    }
}

// === FORMULARIOS Y ACCIONES ===
export function showClassForm(defs = {}) {
    const modal = document.getElementById('modal'); 
    modal.classList.remove('hidden'); 
    const content = document.getElementById('modal-content');
    
    // Helper para generar opciones
    const genOpts = (arr, sel) => arr.sort((a,b)=>a.name.localeCompare(b.name)).map(i => `<option value="${i.id}" ${sel===i.id?'selected':''}>${i.name}</option>`).join('');
    
    content.innerHTML = `
        <div class="p-6 bg-white rounded-lg">
            <h2 class="text-xl font-bold mb-4 text-gray-800">${defs.id ? 'Editar' : 'Nueva'} Clase</h2>
            <div id="conflict-warnings" class="mb-4 hidden"></div>
            <div class="grid grid-cols-2 gap-4 text-sm">
                
                <div>
                    <label class="block font-bold text-gray-500 mb-1">Grupo</label>
                    <select id="f-grp" class="w-full border p-2 rounded">
                        ${genOpts(state.groups, defs.groupId)}
                    </select>
                </div>

                <div>
                    <label class="block font-bold text-gray-500 mb-1">Docente</label>
                    <select id="f-tch" class="w-full border p-2 rounded">
                        <option value="">-- Cualquiera --</option>
                        ${genOpts(state.teachers, defs.teacherId)}
                    </select>
                </div>

                <div>
                    <label class="block font-bold text-gray-500 mb-1">Materia</label>
                    <select id="f-sub" class="w-full border p-2 rounded">
                        ${genOpts(state.subjects, defs.subjectId)}
                    </select>
                </div>

                <div><label class="block font-bold text-gray-500 mb-1">Aula</label><select id="f-rm" class="w-full border p-2 rounded"><option value="">-- Sin Aula --</option>${genOpts(state.classrooms, defs.classroomId)}</select></div>
                <div><label class="block font-bold text-gray-500 mb-1">Día</label><select id="f-day" class="w-full border p-2 rounded">${days.map(d=>`<option ${d===defs.day?'selected':''}>${d}</option>`).join('')}</select></div>
                <div><label class="block font-bold text-gray-500 mb-1">Inicio</label><select id="f-time" class="w-full border p-2 rounded">${timeSlots.map(t=>`<option value="${t}" ${t==defs.startTime?'selected':''}>${t}:00</option>`).join('')}</select></div>
                <div><label class="block font-bold text-gray-500 mb-1">Duración (hrs)</label><input type="number" id="f-dur" value="${defs.duration||2}" min="1" max="6" class="w-full border p-2 rounded"></div>
            </div>
            <div class="flex justify-end gap-3 mt-6">
                <button id="btn-cancel" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                <button id="btn-save" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 shadow">Guardar</button>
            </div>
        </div>`;

    // === LÓGICA DE FILTRADO DINÁMICO ===
    const selTch = document.getElementById('f-tch');
    const selSub = document.getElementById('f-sub');
    const selGrp = document.getElementById('f-grp');

    // Función Central de Filtrado
    const updateSubjectOptions = () => {
        const selectedGrpId = selGrp.value;
        const selectedTchId = selTch.value;
        const currentSubId = selSub.value; 

        // 1. Obtener Cuatrimestre del Grupo Seleccionado
        const grp = state.groups.find(g => g.id === selectedGrpId);
        const targetTrimester = grp ? grp.trimester : null;

        // 2. Filtrar Materias
        const validSubjects = state.subjects.filter(s => {
            // A. Coincide con el Cuatri del Grupo (si hay grupo seleccionado)
            const matchesGroup = !targetTrimester || s.trimester === targetTrimester;

            // B. Coincide con el Docente (si hay docente seleccionado)
            const matchesTeacher = !selectedTchId || s.defaultTeacherId === selectedTchId;

            // C. Excepción: Siempre mostrar la materia que ya estaba seleccionada (para no romper ediciones)
            const isCurrent = s.id === defs.subjectId;

            if (isCurrent) return true;
            return matchesGroup && matchesTeacher;
        });

        // 3. Renderizar
        selSub.innerHTML = validSubjects
            .sort((a,b) => a.name.localeCompare(b.name))
            .map(s => `<option value="${s.id}" ${s.id === currentSubId ? 'selected' : ''}>${s.name}</option>`)
            .join('');
        
        // Si la lista cambió y la selección actual ya no es válida, seleccionar la primera
        if (validSubjects.length > 0 && !validSubjects.find(s => s.id === selSub.value)) {
            selSub.value = validSubjects[0].id;
        }
    };

    // Listeners
    selGrp.onchange = () => updateSubjectOptions(); // Cambio de grupo -> Filtra materias por cuatri
    selTch.onchange = () => updateSubjectOptions(); // Cambio de docente -> Filtra materias por profe

    // Lógica inversa: Al cambiar materia manual, sugerir el docente default
    selSub.onchange = () => {
        const sub = state.subjects.find(s => s.id === selSub.value);
        if(sub && sub.defaultTeacherId) {
            selTch.value = sub.defaultTeacherId;
        }
    };

    // Inicializar filtros
    updateSubjectOptions();
    // ======================================

    document.getElementById('btn-cancel').onclick = () => modal.classList.add('hidden');
    document.getElementById('btn-save').onclick = async () => {
        const payload = { 
            subjectId: document.getElementById('f-sub').value, 
            groupId: document.getElementById('f-grp').value, 
            teacherId: document.getElementById('f-tch').value, 
            classroomId: document.getElementById('f-rm').value, 
            day: document.getElementById('f-day').value, 
            startTime: parseInt(document.getElementById('f-time').value), 
            duration: parseInt(document.getElementById('f-dur').value) 
        };
        
        const conflicts = validateConflicts(payload, defs.id);
        if (conflicts.length > 0) {
            const div = document.getElementById('conflict-warnings'); 
            div.innerHTML = `<div class="bg-red-50 border-l-4 border-red-500 p-3 text-red-700 font-bold mb-2">Conflictos:</div><ul class="list-disc pl-5 text-red-600 text-xs">${conflicts.map(c=>`<li>${c}</li>`).join('')}</ul><button id="btn-force" class="mt-2 text-red-800 underline text-xs font-bold">Guardar Igual</button>`; 
            div.classList.remove('hidden'); 
            document.getElementById('btn-force').onclick = async () => { await commitSave(payload, defs.id); }; 
            return;
        }
        await commitSave(payload, defs.id);
    };
}

async function commitSave(data, id) { 
    try { 
        if(id) await updateDoc(doc(cols.schedule, id), data); 
        else await addDoc(cols.schedule, data); 
        document.getElementById('modal').classList.add('hidden'); 
    } catch(e){ console.error(e); } 
}

function validateConflicts(newClass, ignoreId) { 
    const conflicts = []; 
    const ns = newClass.startTime; 
    const ne = ns + newClass.duration; 
    state.schedule.forEach(e => { 
        if(e.id === ignoreId || e.day !== newClass.day) return; 
        const es = e.startTime; 
        const ee = es + e.duration; 
        if(ns < ee && ne > es) { 
            if(e.teacherId === newClass.teacherId) conflicts.push("El docente ya tiene clase"); 
            if(e.groupId === newClass.groupId) conflicts.push("El grupo ya tiene clase"); 
            if(newClass.classroomId && e.classroomId === newClass.classroomId) conflicts.push("El aula está ocupada"); 
        } 
    }); 
    return conflicts; 
}

export function showTeacherForm(teacher = null) { 
    const modal = document.getElementById('modal'); 
    modal.classList.remove('hidden'); 
    const isEdit = !!teacher; 
    document.getElementById('modal-content').innerHTML = `<div class="p-6 bg-white"><h2 class="font-bold mb-4">${isEdit ? 'Editar' : 'Nuevo'} Docente</h2><input id="t-name" value="${teacher ? teacher.name : ''}" class="w-full border p-2 mb-2" placeholder="Apodo (Ej: Alex)"><input id="t-full" value="${teacher ? (teacher.fullName || '') : ''}" class="w-full border p-2 mb-4" placeholder="Nombre Completo Real"><button id="btn-t-save" class="bg-blue-600 text-white px-4 py-2 rounded">Guardar</button></div>`; 
    document.getElementById('btn-t-save').onclick = async () => { 
        const n = document.getElementById('t-name').value; 
        const f = document.getElementById('t-full').value; 
        if(n) { 
            const data = {name: n, fullName: f}; 
            if(isEdit) await updateDoc(doc(cols.teachers, teacher.id), data); 
            else await addDoc(cols.teachers, data); 
            modal.classList.add('hidden'); 
        } 
    }; 
}

export function showSubjectForm(sub = null) { 
    const modal = document.getElementById('modal'); 
    modal.classList.remove('hidden'); 
    const isEdit = !!sub; 
    const defT = sub ? sub.defaultTeacherId : ''; 
    const genOpts = (arr) => arr.map(i => `<option value="${i.id}" ${defT===i.id?'selected':''}>${i.name}</option>`).join(''); 
    document.getElementById('modal-content').innerHTML = `<div class="p-6 bg-white"><h2 class="font-bold mb-4">${isEdit?'Editar':'Nueva'} Materia</h2><input id="s-name" value="${sub?sub.name:''}" class="w-full border p-2 mb-2" placeholder="Nombre Materia"><select id="s-trim" class="w-full border p-2 mb-2">${[1,2,3,4,5,6,7,8,9].map(i=>`<option value="${i}" ${sub&&sub.trimester==i?'selected':''}>Cuatri ${i}</option>`).join('')}</select><select id="s-def" class="w-full border p-2 mb-4"><option value="">-- Profe Default --</option>${genOpts(state.teachers)}</select><button id="btn-s-save" class="bg-indigo-600 text-white px-4 py-2 rounded">Guardar</button></div>`; 
    document.getElementById('btn-s-save').onclick = async () => { 
        const n = document.getElementById('s-name').value; 
        const data = { name: n, trimester: parseInt(document.getElementById('s-trim').value), defaultTeacherId: document.getElementById('s-def').value }; 
        if(n) { 
            if(isEdit) await updateDoc(doc(cols.subjects, sub.id), data); 
            else await addDoc(cols.subjects, data); 
            modal.classList.add('hidden'); 
        } 
    }; 
}

// === GESTIÓN DE ASISTENCIA ===
export async function addAttendance(data) {
    try {
        await addDoc(cols.attendance, data);
        alert("Falta registrada correctamente");
    } catch(e) { console.error(e); alert("Error al registrar falta"); }
}

export async function deleteAttendance(id) {
    if(confirm("¿Eliminar este registro de inasistencia?")) {
        try {
            await deleteDoc(doc(cols.attendance, id));
        } catch(e) { console.error(e); }
    }
}

export function deleteDocWrapper(colName, id) {
    if(confirm('¿Seguro de borrar?')) deleteDoc(doc(cols[colName], id));
}
