// --- LÓGICA DE GESTIÓN (AULAS, DOCENTES, ETC) ---
async function addClassroom() {
    const nameInput = document.getElementById('classroom-name');
    const name = nameInput.value.trim();
    if (!name) return notification.show("El nombre del aula no puede estar vacío.", true);
    try {
        await addDoc(classroomsCol, { name, x: 10, y: 10 }); // Posición default
        notification.show(`Aula "${name}" agregada.`);
        nameInput.value = '';
    } catch (e) {
        notification.show("Error al agregar el aula.", true);
        console.error(e);
    }
}

function renderClassroomsList() {
    if (!dom.classroomsList) return;
    dom.classroomsList.innerHTML = '';
    [...localState.classrooms].sort(sortByName).forEach(classroom => {
        dom.classroomsList.appendChild(createManagementItem(classroom, classroomsCol, 'Aula'));
    });
}

async function saveTeacher(teacherId) {
    const name = document.getElementById('modal-teacher-name').value;
    if (!name.trim()) return notification.show("El apodo no puede estar vacío.", true);
    const selectedSubjects = Array.from(document.querySelectorAll('.subject-checkbox:checked')).map(cb => cb.value);
    const teacherData = { name: name, fullName: document.getElementById('modal-teacher-fullname').value, subjects: selectedSubjects };
    try {
        if (teacherId) {
            await updateDoc(doc(teachersCol, teacherId), teacherData);
            notification.show("Docente actualizado.");
        } else {
            await addDoc(teachersCol, teacherData);
            notification.show("Docente agregado.");
        }
        modal.hide();
    } catch (error) {
        notification.show("Error al guardar docente.", true);
        console.error("Error saving teacher:", error);
    }
}

async function addGroup() {
    const prefix = dom.groupPrefixSelect.value;
    const number = dom.groupNumberInput.value;
    if (!number) return notification.show("Introduce un número de grupo.", true);
    const groupData = { name: `${prefix}-${number}`, trimester: parseInt(dom.groupTrimesterSelect.value) };
    try {
        await addDoc(groupsCol, groupData);
        dom.groupNumberInput.value = '';
        dom.groupTrimesterSelect.value = 0;
        notification.show(`Grupo "${groupData.name}" agregado.`);
    } catch (error) {
        notification.show("No se pudo agregar el grupo.", true);
    }
}

function createManagementItem(item, collection, type) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'management-item';
    let mainText = item.name;
    if (type === 'Docente' && item.fullName) {
        mainText = `${item.name} <span class="text-gray-500 text-xs">(${item.fullName})</span>`;
    }
    itemDiv.innerHTML = `<span class="flex-grow">${mainText}</span><div class="actions"><button class="edit-btn" title="Editar">✏️</button><button class="delete-btn" title="Eliminar">🗑️</button></div>`;
    itemDiv.querySelector('.edit-btn').onclick = () => {
        if (type === 'Docente') modal.showTeacherForm(item);
        else if (type === 'Materia') modal.showSubjectForm(item);
        else if (type === 'Grupo') modal.showGroupForm(item);
        else if (type === 'Aula') {
            const newName = prompt('Editar nombre del aula:', item.name);
            if (newName && newName.trim() !== '') {
                updateDoc(doc(collection, item.id), { name: newName.trim() });
            }
        }
    };
    itemDiv.querySelector('.delete-btn').onclick = () => {
        modal.confirm(`¿Eliminar ${type}?`, `Borrar "<b>${item.name}</b>".`, async () => {
            try {
                await deleteDoc(doc(collection, item.id));
                notification.show(`"${item.name}" eliminado.`);
            } catch (e) {
                notification.show("Error al eliminar.", true);
            }
        });
    };
    return itemDiv;
}

function sortByName(a, b) {
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

function renderTeachersList() {
    if(!dom.teachersList) return;
    dom.teachersList.innerHTML = '';
    [...localState.teachers].sort(sortByName).forEach(teacher => {
        dom.teachersList.appendChild(createManagementItem(teacher, teachersCol, 'Docente'));
    });
}

function renderSubjectsByTrimester() {
    if (!dom.subjectsByTrimester) return;
    dom.subjectsByTrimester.innerHTML = '';
    const sortedSubjects = [...localState.subjects].sort(sortByName);
    for (let i = 1; i <= 9; i++) {
        const column = document.createElement('div');
        column.className = 'trimester-column space-y-2';
        column.dataset.trimester = i;
        column.innerHTML = `<h3>Cuatri ${i}</h3>`;
        const subjectsInTrimester = sortedSubjects.filter(s => s.trimester == i);
        if (subjectsInTrimester.length > 0) {
            subjectsInTrimester.forEach(subject => {
                column.appendChild(createManagementItem(subject, subjectsCol, 'Materia', false));
            });
        } else {
            column.innerHTML += `<p class="text-xs text-gray-400">No hay materias en este cuatri.</p>`;
        }
        dom.subjectsByTrimester.appendChild(column);
    }
}

function renderGroupsByTrimester() {
    if(!dom.groupsByTrimester || !dom.unassignedGroupsContainer) return;
    dom.groupsByTrimester.innerHTML = '';
    dom.unassignedGroupsContainer.innerHTML = '';
    const sortedGroups = [...localState.groups].sort(sortByName);
     for (let i = 1; i <= 9; i++) {
        const groupsInTrimester = sortedGroups.filter(g => g.trimester == i);
        if (groupsInTrimester.length > 0) {
            const block = document.createElement('div');
            block.className = 'group-trimester-block trimester-column';
            block.dataset.trimester = i;
            block.innerHTML = `<h3>Cuatrimestre ${i}</h3>`;
            const list = document.createElement('div');
            list.className = 'space-y-2';
            groupsInTrimester.forEach(group => list.appendChild(createManagementItem(group, groupsCol, 'Grupo')));
            block.appendChild(list);
            dom.groupsByTrimester.appendChild(block);
        }
    }
    const unassignedGroups = sortedGroups.filter(g => !g.trimester || g.trimester === 0);
    if (unassignedGroups.length > 0) {
        unassignedGroups.forEach(group => dom.unassignedGroupsContainer.appendChild(createManagementItem(group, groupsCol, 'Grupo')));
    } else {
        dom.unassignedGroupsContainer.innerHTML = `<p class="text-xs text-gray-400">Todos los grupos están asignados.</p>`;
    }
}

async function saveSubject(subjectId = null) {
    const subjectData = { name: document.getElementById('modal-subject-name').value, trimester: parseInt(document.getElementById('modal-subject-trimester').value) };
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
    const groupData = { name: document.getElementById('modal-group-name').value, trimester: parseInt(document.getElementById('modal-group-trimester').value) };
    if (!groupData.name) return notification.show("El nombre no puede estar vacío.", true);
    try {
        await updateDoc(doc(groupsCol, groupId), groupData);
        notification.show("Grupo actualizado.");
        modal.hide();
    } catch (error) {
        notification.show("Error al actualizar el grupo.", true);
    }
}

function populateGroupFilter(subjectId, groupSelectElement) {
    const selectedSubject = localState.subjects.find(s => s.id === subjectId);
    const groupsToShow = (selectedSubject && selectedSubject.trimester > 0) ? localState.groups.filter(g => g.trimester == selectedSubject.trimester) : localState.groups;
    populateSelect(groupSelectElement, groupsToShow.sort(sortByName), 'Seleccionar Grupo');
}


// --- LÓGICA DE BLOQUEO MANUAL ---

function populateBlockerForm() {
    for (let i = 1; i <= 9; i++) dom.blockTrimester.add(new Option(`Cuatrimestre ${i}`, i));
    for (let h = 7; h < 21; h++) dom.blockTime.add(new Option(`${h}:00 - ${h+2}:00`, h));
}

async function addBlock() {
    const blockData = { trimester: parseInt(dom.blockTrimester.value), startTime: parseInt(dom.blockTime.value), endTime: parseInt(dom.blockTime.value) + 2, days: dom.blockDays.value };
    if (localState.blocks.some(b => b.trimester === blockData.trimester && b.startTime === blockData.startTime && b.days === blockData.days)) {
        return notification.show("Este bloqueo ya existe.", true);
    }
    try {
        await addDoc(blocksCol, blockData);
        notification.show("Bloqueo agregado correctamente.");
    } catch(e) {
        notification.show("Error al agregar el bloqueo.", true);
        console.error(e);
    }
}

function renderBlocksList() {
    dom.blocksList.innerHTML = '';
    if (localState.blocks.length === 0) {
        dom.blocksList.innerHTML = '<p class="text-xs text-gray-400">No hay bloqueos activos.</p>';
        return;
    }
    [...localState.blocks].sort((a,b) => a.trimester - b.trimester || a.startTime - b.startTime).forEach(block => {
        const blockDiv = document.createElement('div');
        blockDiv.className = 'management-item';
        const affectedGroups = localState.groups.filter(g => g.trimester === block.trimester).map(g => g.name).join(', ');
        blockDiv.innerHTML = `<div><p class="font-semibold">Cuatri ${block.trimester}: ${block.startTime}:00-${block.endTime}:00 (${block.days})</p><p class="text-xs text-gray-500">Grupos: ${affectedGroups || 'Ninguno'}</p></div><div class="actions"><button class="delete-btn" title="Eliminar">🗑️</button></div>`;
        blockDiv.querySelector('.delete-btn').onclick = async () => {
            modal.confirm("¿Eliminar Bloqueo?", "Esta acción es irreversible.", async () => {
                try {
                    await deleteDoc(doc(blocksCol, block.id));
                    notification.show("Bloqueo eliminado.");
                } catch (e) {
                    notification.show("Error al eliminar el bloqueo.", true);
                }
            });
        };
        dom.blocksList.appendChild(blockDiv);
    });
}

// --- LÓGICA DEL HORARIO Y MAPA (RENDERIZADO) ---

function populateTrimesterFilter() {
    dom.filterTrimester.innerHTML = '<option value="">Todos los Cuatris</option>';
    for (let i = 1; i <= 9; i++) dom.filterTrimester.add(new Option(`Cuatrimestre ${i}`, i));
}

// --- LÓGICA DEL MAPA DE AULAS ---
function toggleMapEditMode() {
    isMapEditing = !isMapEditing;
    const container = dom.classroomMapContainer;
    
    if (isMapEditing) {
        dom.toggleMapEditBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            <span>Guardar Distribución</span>`;
        dom.toggleMapEditBtn.className = "bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors";
        container.classList.add('editing');
        notification.show("Modo Edición Activado: Arrastra los salones.");
    } else {
        dom.toggleMapEditBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
            <span>Editar Distribución</span>`;
        dom.toggleMapEditBtn.className = "bg-gray-800 text-white py-2 px-4 rounded-lg hover:bg-gray-900 flex items-center gap-2 transition-colors";
        container.classList.remove('editing');
        notification.show("Distribución Guardada.");
    }
    renderClassroomMap(); // Re-renderizar para activar/desactivar listeners
}

function renderClassroomMap() {
    const container = dom.classroomMapContainer;
    if (!container) return;
    container.innerHTML = '';
    const placeholder = document.createElement('p');
    placeholder.className = 'text-center text-gray-400 mt-20 pointer-events-none select-none';
    
    if (localState.classrooms.length === 0) {
        placeholder.textContent = 'No hay aulas registradas.';
        container.appendChild(placeholder);
        return;
    }

    const selectedDay = dom.mapDaySelect.value;
    const selectedTime = parseInt(dom.mapTimeSelect.value) || 7;

    [...localState.classrooms].forEach(classroom => {
        // Posición Default si no existe
        const posX = classroom.x !== undefined ? classroom.x : 10;
        const posY = classroom.y !== undefined ? classroom.y : 10;

        // Buscar clase activa
        const activeClass = localState.schedule.find(c => 
            c.classroomId === classroom.id &&
            c.day === selectedDay &&
            c.startTime <= selectedTime &&
            (c.startTime + c.duration) > selectedTime
        );

        const card = document.createElement('div');
        card.className = `classroom-card ${activeClass ? 'occupied' : 'free'}`;
        card.style.left = `${posX}px`;
        card.style.top = `${posY}px`;
        card.dataset.id = classroom.id;

        let contentHtml = '';
        if (activeClass) {
            const teacher = localState.teachers.find(t => t.id === activeClass.teacherId);
            const subject = localState.subjects.find(s => s.id === activeClass.subjectId);
            const group = localState.groups.find(g => g.id === activeClass.groupId);
            contentHtml = `
                <div class="header">${classroom.name}</div>
                <div class="status text-red-600">● Ocupado</div>
                <div class="info">
                    <div class="font-bold">${teacher ? teacher.name : 'Desc.'}</div>
                    <div>${group ? group.name : 'Desc.'}</div>
                    <div class="text-xs truncate">${subject ? subject.name : 'Desc.'}</div>
                </div>
            `;
        } else {
            contentHtml = `
                <div class="header">${classroom.name}</div>
                <div class="status text-green-600">● Libre</div>
                <div class="info text-gray-400 italic">Disponible</div>
            `;
        }
        
        // Badge de edición
        const badge = `<div class="edit-badge">✎</div>`;
        card.innerHTML = badge + contentHtml;

        if (isMapEditing) {
            card.onmousedown = (e) => handleMapDragStart(e, card, classroom.id);
        }

        container.appendChild(card);
    });
}

// Lógica de arrastre del mapa
function handleMapDragStart(e, card, classroomId) {
    e.preventDefault();
    const container = dom.classroomMapContainer;
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = card.getBoundingClientRect();
    const offsetX = startX - rect.left;
    const offsetY = startY - rect.top;

    function onMouseMove(e) {
        const containerRect = container.getBoundingClientRect();
        let newLeft = e.clientX - containerRect.left - offsetX;
        let newTop = e.clientY - containerRect.top - offsetY;

        // Límites
        newLeft = Math.max(0, Math.min(newLeft, containerRect.width - card.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, containerRect.height - card.offsetHeight));

        card.style.left = `${newLeft}px`;
        card.style.top = `${newTop}px`;
    }

    function onMouseUp(e) {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        // Guardar nueva posición
        const containerRect = container.getBoundingClientRect();
        // Recalcular posición final relativa al contenedor
        // Nota: leemos directamente del style que actualizamos en move
        const finalX = parseInt(card.style.left); 
        const finalY = parseInt(card.style.top);

        updateDoc(doc(classroomsCol, classroomId), { x: finalX, y: finalY });
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function renderScheduleGrid() {
    if (!dom.scheduleGrid) return;
    dom.scheduleGrid.innerHTML = '';
    dom.scheduleGrid.appendChild(document.createElement('div'));
    days.forEach(day => { const header = document.createElement('div'); header.className = 'grid-header'; header.textContent = day; dom.scheduleGrid.appendChild(header); });
    
    timeSlots.forEach(time => {
        const timeSlot = document.createElement('div'); timeSlot.className = 'grid-time-slot'; timeSlot.textContent = `${time}:00 - ${time + 1}:00`; dom.scheduleGrid.appendChild(timeSlot);
        days.forEach(day => {
            const cell = document.createElement('div'); cell.className = 'grid-cell'; cell.dataset.day = day; cell.dataset.hour = time;
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('drop', handleDrop);
            cell.onclick = (e) => {
                if (e.target.classList.contains('grid-cell')) {
                    modal.showClassForm({ day: day, startTime: time });
                }
            };
            dom.scheduleGrid.appendChild(cell);
        });
    });
    
    renderScheduleBlocks();
    const selectedTeacher = dom.filterTeacher.value;
    const selectedGroup = dom.filterGroup.value;
    const selectedTrimester = dom.filterTrimester.value;
    const selectedClassroom = dom.filterClassroom.value;

    const filteredSchedule = localState.schedule.filter(c => {
        const group = localState.groups.find(g => g.id === c.groupId);
        if (!group) return false;
        const teacherMatch = !selectedTeacher || c.teacherId === selectedTeacher;
        const groupMatch = !selectedGroup || c.groupId === selectedGroup;
        const trimesterMatch = !selectedTrimester || group.trimester == selectedTrimester;
        const classroomMatch = !selectedClassroom || c.classroomId === selectedClassroom;
        return teacherMatch && groupMatch && trimesterMatch && classroomMatch;
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
            const overlaps = dayEvents.filter(e => (c.startTime < (e.startTime + e.duration)) && ((c.startTime + c.duration) > e.startTime));
            const totalOverlaps = overlaps.length;
            const overlapIndex = overlaps.sort((a,b) => a.id.localeCompare(b.id)).indexOf(c);
            const itemDiv = document.createElement('div');
            itemDiv.className = 'schedule-item';
            itemDiv.dataset.classId = c.id;
            const subjectColor = getSubjectColor(subject.id);
            itemDiv.style.borderColor = subjectColor;
            itemDiv.style.backgroundColor = `${subjectColor}20`;
            const timeColumnWidth = 120;
            const dayColumnWidth = (dom.scheduleGrid.offsetWidth - timeColumnWidth) / days.length;
            const gridCellHeight = 51;
            const itemWidth = (dayColumnWidth / totalOverlaps) - 4;
            const itemLeftOffsetWithinDay = (dayColumnWidth / totalOverlaps) * overlapIndex;
            itemDiv.style.top = `${(timeIndex * gridCellHeight) + gridCellHeight}px`;
            itemDiv.style.left = `${timeColumnWidth + 2 + (dayIndex * dayColumnWidth) + itemLeftOffsetWithinDay}px`;
            itemDiv.style.width = `${itemWidth}px`;
            itemDiv.style.height = `${(c.duration * gridCellHeight) - 2}px`;
            itemDiv.style.zIndex = 10 + overlapIndex;
            
            let subjectNameDisplay = subject.name;
            const classroom = localState.classrooms.find(cr => cr.id === c.classroomId);
            let detailsHtml = '';

            if (selectedClassroom) {
                 detailsHtml = `<div class="item-details" style="font-weight:bold; color:#000;">${teacher.name}</div><div class="item-details">${group.name}</div>`;
            } else {
                detailsHtml = `<div class="item-details">${teacher.name.split(' ')[0]} / ${group.name}`;
                if (classroom) detailsHtml += ` / <b>${classroom.name}</b>`;
                else detailsHtml += ` / <span style="color:red; font-weight:bold;">?</span>`;
                detailsHtml += `</div>`;
            }

            if (totalOverlaps >= 3) {
                subjectNameDisplay = getInitials(subject.name);
                detailsHtml = '';
                itemDiv.style.fontSize = '0.7rem';
            }
            itemDiv.innerHTML = `<div class="item-content"><div class="subject-name">${subjectNameDisplay}</div>${detailsHtml}</div><div class="actions"><button title="Editar">✏️</button><button title="Eliminar">🗑️</button></div><div class="resize-handle"></div>`;
            const [editBtn, deleteBtn] = itemDiv.querySelectorAll('button');
            editBtn.onclick = (e) => { e.stopPropagation(); editClass(c); };
            deleteBtn.onclick = (e) => { e.stopPropagation(); deleteClass(c.id, `${subject.name} con ${teacher.name}`); };
            itemDiv.querySelector('.resize-handle').addEventListener('mousedown', (e) => handleResizeStart(e, c));
            dom.scheduleGrid.appendChild(itemDiv);
        });
    });
}

function renderScheduleBlocks() {
    if (!dom.scheduleGrid) return;
    const selectedTrimester = dom.filterTrimester.value;
    const filteredBlocks = localState.blocks.filter(block => !selectedTrimester || block.trimester == selectedTrimester);
    filteredBlocks.forEach(block => {
        const startHour = parseInt(block.startTime), endHour = parseInt(block.endTime), duration = endHour - startHour;
        const daysToRender = [];
        if (block.days.toUpperCase() === 'L-V') daysToRender.push('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes');
        else if (block.days.toUpperCase() === 'L-J') daysToRender.push('Lunes', 'Martes', 'Miércoles', 'Jueves');
        daysToRender.forEach(day => {
            const dayIndex = days.indexOf(day), timeIndex = timeSlots.indexOf(startHour);
            if (dayIndex === -1 || timeIndex === -1) return;
            const blockDiv = document.createElement('div');
            blockDiv.className = 'schedule-block';
            blockDiv.textContent = `Inglés (Cuatri ${block.trimester})`;
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

function checkConflict(newClass, ignoreId = null) {
    const newStart = newClass.startTime;
    const newEnd = newStart + newClass.duration;
    for (const existingClass of localState.schedule) {
        if (existingClass.id === ignoreId || existingClass.day !== newClass.day) continue;
        const existingStart = existingClass.startTime, existingEnd = existingStart + existingClass.duration;
        const timeOverlap = newStart < existingEnd && newEnd > existingStart;
        if (timeOverlap) {
            if (existingClass.teacherId === newClass.teacherId) { notification.show("Conflicto: El docente ya tiene una clase a esa hora.", true); return true; }
            if (existingClass.groupId === newClass.groupId) { notification.show("Conflicto: El grupo ya tiene una clase a esa hora.", true); return true; }
            if (existingClass.classroomId && newClass.classroomId && existingClass.classroomId === newClass.classroomId) { notification.show("Conflicto: El aula ya está ocupada a esa hora.", true); return true; }
        }
    }
    const group = localState.groups.find(g => g.id === newClass.groupId);
    if (group) {
        const blockConflict = localState.blocks.some(block => {
            if (block.trimester != group.trimester) return false;
            const daysOfBlock = block.days === 'L-V' ? ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] : ['Lunes', 'Martes', 'Miércoles', 'Jueves'];
            if (!daysOfBlock.includes(newClass.day)) return false;
            const blockStart = parseInt(block.startTime), blockEnd = parseInt(block.endTime);
            return newStart < blockEnd && newEnd > blockStart;
        });
        if (blockConflict) { notification.show("Conflicto: La clase choca con un bloqueo (ej. Inglés).", true); return true; }
    }
    return false;
}

async function createClassFromModal(subjectId, day, startTime) {
    const groupId = document.getElementById('modal-assign-group').value;
    const teacherId = document.getElementById('modal-assign-teacher').value;
    const classroomId = document.getElementById('modal-assign-classroom').value;
    const duration = parseInt(document.getElementById('modal-assign-duration').value);
    if (!groupId || !teacherId || !classroomId) return notification.show("Debes seleccionar grupo, aula y docente.", true);
    const classData = { subjectId, day, startTime, groupId, teacherId, duration, classroomId };
    if (checkConflict(classData)) return;
    try {
        await addDoc(scheduleCol, classData);
        notification.show("Clase agregada correctamente.");
        modal.hide();
    } catch (error) {
        notification.show("Error al guardar la clase.", true);
        console.error("Error creating class from modal:", error);
    }
}

function openAssignmentModal(subjectId, day, startTime) {
    const subject = localState.subjects.find(s => s.id === subjectId);
    if (!subject) return console.error("Materia no encontrada");
    const eligibleTeachers = localState.teachers.filter(teacher => teacher.subjects && teacher.subjects.includes(subjectId));
    const groupsForSubject = subject.trimester > 0 ? localState.groups.filter(g => g.trimester == subject.trimester) : localState.groups;
    const teacherOptions = eligibleTeachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    const groupOptions = groupsForSubject.sort(sortByName).map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    const classroomOptions = localState.classrooms.sort(sortByName).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const formHtml = `
        <h2 class="text-2xl font-semibold mb-2">Asignar Clase</h2>
        <p class="text-lg text-indigo-600 font-medium mb-6">${subject.name}</p>
        <div class="space-y-4 text-left">
            <div><label class="block text-sm font-medium text-gray-700">Grupo</label><select id="modal-assign-group" class="mt-1 block w-full p-2 border rounded-lg">${groupOptions}</select></div>
            <div><label class="block text-sm font-medium text-gray-700">Aula</label><select id="modal-assign-classroom" class="mt-1 block w-full p-2 border rounded-lg"><option value="">Seleccionar Aula...</option>${classroomOptions}</select></div>
            <div><label class="block text-sm font-medium text-gray-700">Docente</label><select id="modal-assign-teacher" class="mt-1 block w-full p-2 border rounded-lg">${eligibleTeachers.length > 0 ? teacherOptions : '<option value="">No hay docentes para esta materia</option>'}</select></div>
            <div><label class="block text-sm font-medium text-gray-700">Duración (horas)</label><input type="number" id="modal-assign-duration" value="2" min="1" max="8" class="mt-1 block w-full p-2 border rounded-lg"></div>
        </div>
        <div class="mt-8 flex gap-4">
            <button id="modal-cancel-btn" class="w-full btn btn-secondary">Cancelar</button>
            <button id="modal-save-class-btn" class="w-full btn btn-primary">Guardar Clase</button>
        </div>`;
    modal.show(formHtml);
    document.getElementById('modal-cancel-btn').onclick = () => modal.hide();
    document.getElementById('modal-save-class-btn').onclick = () => createClassFromModal(subjectId, day, startTime);
}

async function savePreset() {
    const presetData = { teacherId: document.getElementById('modal-preset-teacher').value, subjectId: document.getElementById('modal-preset-subject').value, groupId: document.getElementById('modal-preset-group').value };
    if (!presetData.teacherId || !presetData.subjectId || !presetData.groupId) return notification.show("Selecciona todos loscampos para la plantilla.", true);
    try {
        await addDoc(presetsCol, presetData);
        notification.show("Plantilla guardada.");
        modal.hide();
    } catch (error) {
        notification.show("No se pudo guardar la plantilla.", true);
    }
}

function renderPresetsList() {
    if(!dom.presetsList) return;
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
        presetDiv.innerHTML = `<div class="preset-item-info"><span class="subject">${subject.name}</span><span class="details">${teacher.name} / ${group.name}</span></div><button class="text-red-500 font-bold px-2">&times;</button>`;
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
    const day = cell.dataset.day;
    const startTime = parseInt(cell.dataset.hour);
    try {
        const subjectData = JSON.parse(e.dataTransfer.getData('application/json'));
        if (subjectData.type === 'Materia') {
            openAssignmentModal(subjectData.id, day, startTime);
            return;
        }
    } catch (error) {}
    try {
        const presetId = e.dataTransfer.getData('text/plain');
        if (presetId) {
            const preset = localState.presets.find(p => p.id === presetId);
            if (!preset) return;
            const classData = { teacherId: preset.teacherId, subjectId: preset.subjectId, groupId: preset.groupId, day: day, startTime: startTime, duration: 1 };
            if (checkConflict(classData)) return;
            await addDoc(scheduleCol, classData);
            notification.show("Clase agregada desde plantilla.");
        }
    } catch (error) {
        notification.show("Error al procesar el elemento soltado.", true);
        console.error("Drop error:", error);
    }
}

function handleManagementDragStart(e) { e.target.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/json', JSON.stringify({id: e.target.dataset.id, type: e.target.dataset.type})); }
function handleManagementDragEnd(e) { e.target.classList.remove('dragging'); }

let resizingClass = null, initialY = 0, initialDuration = 0;
function handleResizeStart(e, classData) {
    e.preventDefault(); e.stopPropagation();
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
    const newDuration = Math.max(1, initialDuration + Math.round(deltaY / 51));
    const classElement = document.querySelector(`.schedule-item[data-class-id="${resizingClass.id}"]`);
    if (classElement) classElement.style.height = `${(newDuration * 50) + ((newDuration - 1) * 1)}px`;
}
async function handleResizeEnd(e) {
    const classElement = document.querySelector(`.schedule-item[data-class-id="${resizingClass.id}"]`);
    classElement?.classList.remove('resizing');
    const newDuration = Math.max(1, initialDuration + Math.round((e.clientY - initialY) / 51));
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
            if (classElement) classElement.style.height = `${(initialDuration * 50) + ((initialDuration - 1) * 1)}px`;
        }
    }
    resizingClass = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
}

// --- FUNCIONES ADMINISTRATIVAS ---

async function advanceAllGroups() {
    modal.confirm("¿Avanzar Cuatrimestre?", "Esta acción incrementará en 1 el cuatrimestre de TODOS los grupos. Los del 9º serán eliminados. <b>Esta acción es irreversible.</b>", async () => {
        const batch = writeBatch(db);
        let movedCount = 0, deletedCount = 0;
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

async function saveClass() {
    const classData = {
        teacherId: document.getElementById('teacher-select').value,
        subjectId: document.getElementById('subject-select').value,
        groupId: document.getElementById('group-select').value,
        classroomId: document.getElementById('classroom-select').value,
        day: document.getElementById('day-select').value,
        startTime: parseInt(document.getElementById('time-select').value),
        duration: parseInt(document.getElementById('duration-input').value)
    };
    if (!classData.teacherId || !classData.subjectId || !classData.groupId) return notification.show("Por favor, selecciona todos los campos.", true);
    const editingId = document.getElementById('editing-class-id').value;
    if (checkConflict(classData, editingId)) return;
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

function editClass(classData) {
    modal.showClassForm(classData);
}

function resetForm() {
    modal.hide();
}

// --- ANÁLISIS Y REPORTES ---

function runPedagogicalAnalysis() {
    if (!dom.alertsList) return;
    const alerts = [];
    const missingSubjectIds = new Set();
    localState.groups.forEach(group => {
        if (!group.trimester || group.trimester === 0) return;
        const requiredSubjects = localState.subjects.filter(s => s.trimester == group.trimester);
        const scheduledSubjectIds = localState.schedule.filter(c => c.groupId === group.id).map(c => c.subjectId);
        requiredSubjects.forEach(subject => {
            if (!scheduledSubjectIds.includes(subject.id)) {
                alerts.push({ type: 'warning', message: `Al grupo <b>${group.name}</b> le falta la materia <i>${subject.name}</i>.` });
                missingSubjectIds.add(subject.id);
            }
        });
    });
    renderAlerts(alerts);
    renderMissingSubjectsSidebar(missingSubjectIds);
}

function renderMissingSubjectsSidebar(missingSubjectIds) {
    if (!dom.unassignedSubjectsContainer) return;
    dom.unassignedSubjectsContainer.innerHTML = '';
    if (missingSubjectIds.size === 0) {
        dom.unassignedSubjectsContainer.innerHTML = `<p class="text-xs text-gray-400">¡Excelente! No faltan materias por asignar.</p>`;
        return;
    }
    const missingSubjects = Array.from(missingSubjectIds).map(id => localState.subjects.find(s => s.id === id)).filter(Boolean).sort(sortByName);
    missingSubjects.forEach(subject => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'management-item';
        itemDiv.draggable = true;
        itemDiv.dataset.id = subject.id;
        itemDiv.dataset.type = 'Materia';
        itemDiv.addEventListener('dragstart', handleManagementDragStart);
        itemDiv.addEventListener('dragend', handleManagementDragEnd);
        itemDiv.innerHTML = `<span>${subject.name}</span>`;
        dom.unassignedSubjectsContainer.appendChild(itemDiv);
    });
}

function renderAlerts(alerts) {
    if (!dom.alertsList || !dom.noAlertsMessage) return;
    dom.alertsList.innerHTML = '';
    if (alerts.length === 0) {
        dom.noAlertsMessage.classList.remove('hidden');
        return;
    }
    dom.noAlertsMessage.classList.add('hidden');
    alerts.forEach(alert => {
        const li = document.createElement('li');
        li.className = 'flex items-start gap-2 text-sm p-2 rounded-md bg-yellow-50 border border-yellow-200';
        li.innerHTML = `<svg class="w-5 h-5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.636-1.223 2.443-1.223 3.08 0l6.273 12.088c.635 1.223-.27 2.713-1.54 2.713H3.524c-1.27 0-2.175-1.49-1.54-2.713L8.257 3.099zM9 13a1 1 0 112 0 1 1 0 01-2 0zm1-6a1 1 0 00-1 1v3a1 1 0 002 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg><span>${alert.message}</span>`;
        dom.alertsList.appendChild(li);
    });
}

function updateWorkloadSummary() {
    if (!dom.teacherWorkload || !dom.groupWorkload) return;
    const teacherWorkload = {}, groupWorkload = {};
    localState.schedule.forEach(c => {
        teacherWorkload[c.teacherId] = (teacherWorkload[c.teacherId] || 0) + c.duration;
        groupWorkload[c.groupId] = (groupWorkload[c.groupId] || 0) + c.duration;
    });
    localState.blocks.forEach(block => {
        const affectedGroups = localState.groups.filter(g => g.trimester === block.trimester);
        const daysCount = block.days === 'L-V' ? 5 : 4;
        const blockHoursPerDay = block.endTime - block.startTime;
        affectedGroups.forEach(group => groupWorkload[group.id] = (groupWorkload[group.id] || 0) + (blockHoursPerDay * daysCount));
    });
    dom.teacherWorkload.innerHTML = '<h4 class="font-semibold text-gray-700">Docentes</h4>';
    [...localState.teachers].sort(sortByName).forEach(t => {
        const hours = teacherWorkload[t.id] || 0;
        const p = document.createElement('p');
        p.className = `text-sm ${hours > 20 ? 'text-red-600 font-bold' : 'text-gray-600'}`;
        p.textContent = `${t.name}: ${hours} hrs`;
        dom.teacherWorkload.appendChild(p);
    });
    dom.groupWorkload.innerHTML = '<h4 class="font-semibold text-gray-700">Grupos</h4>';
    [...localState.groups].sort(sortByName).forEach(g => {
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
