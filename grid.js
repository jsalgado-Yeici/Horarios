import { state, cols, days, timeSlots } from './state.js';
import { PALETTE } from './config.js';
import { showClassForm, handleDrop, deleteDocWrapper } from './actions.js';
import { showTooltip, hideTooltip } from './ui.js';

export function renderScheduleGrid(targetElement = document.getElementById('schedule-grid'), customFilters = null) {
    if (!targetElement) return;
    if (customFilters) { targetElement.style.border = "none"; targetElement.style.boxShadow = "none"; }

    targetElement.innerHTML = '';
    const frag = document.createDocumentFragment();

    const corner = document.createElement('div'); corner.className = 'grid-header sticky top-0 left-0 bg-gray-50'; corner.innerText = 'HORA'; frag.appendChild(corner);
    days.forEach(d => { const h = document.createElement('div'); h.className = 'grid-header sticky top-0 bg-gray-50'; h.innerText = d; frag.appendChild(h); });
    timeSlots.forEach(h => {
        const tc = document.createElement('div'); tc.className = 'grid-time-slot sticky left-0 bg-white'; tc.innerText = `${h}:00`; frag.appendChild(tc);
        days.forEach(d => {
            const cell = document.createElement('div'); cell.className = 'grid-cell'; cell.dataset.day = d; cell.dataset.hour = h;
            if (!customFilters && targetElement.id === 'schedule-grid') {
                cell.ondragover = e => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
                    const dragging = window.currentDrag;

                    if (dragging) {
                        const newStart = parseInt(h);
                        const newEnd = newStart + dragging.duration;

                        // 1. Identify Target Context
                        const targetGroup = customFilters ? customFilters.groupId : document.getElementById('filter-group')?.value;
                        const targetTeacherFilter = customFilters ? customFilters.teacherId : document.getElementById('filter-teacher')?.value;

                        let targetTeacherId = null;
                        if (dragging.type === 'move') targetTeacherId = dragging.teacherId;
                        else if (dragging.type === 'subject') {
                            const sub = state.subjects.find(s => s.id === dragging.id);
                            targetTeacherId = sub ? sub.defaultTeacherId : null;
                        }

                        // 2. Check Conflicts
                        let hasConflict = false;

                        // Check Group Conflict (Only if we know the group)
                        if (targetGroup) {
                            const groupBusy = state.schedule.some(c =>
                                c.id !== dragging.id &&
                                c.groupId === targetGroup &&
                                c.day === d &&
                                c.startTime < newEnd && (c.startTime + c.duration) > newStart
                            );
                            if (groupBusy) hasConflict = true;
                        }

                        // Check Teacher Conflict (Only if we know the teacher)
                        const finalTeacher = targetTeacherFilter || targetTeacherId;
                        if (finalTeacher && !hasConflict) {
                            const teacherBusy = state.schedule.some(c =>
                                c.id !== dragging.id &&
                                c.teacherId === finalTeacher &&
                                c.day === d &&
                                c.startTime < newEnd && (c.startTime + c.duration) > newStart
                            );
                            if (teacherBusy) hasConflict = true;
                        }

                        // 3. Visual Feedback
                        cell.classList.remove('droppable-hover', 'bg-green-100', 'bg-red-100');
                        if (hasConflict) {
                            cell.classList.add('bg-red-100');
                            cell.title = "⚠️ Conflicto detectado";
                        } else {
                            cell.classList.add('bg-green-100');
                            cell.title = "✅ Disponible";
                        }

                    } else {
                        cell.classList.add('droppable-hover');
                    }
                };
                cell.ondragleave = () => cell.classList.remove('droppable-hover', 'drag-allow', 'drag-conflict');
                cell.ondrop = e => {
                    cell.classList.remove('droppable-hover', 'drag-allow', 'drag-conflict');
                    handleDrop(e, d, h);
                };
                cell.onclick = (e) => { if (e.target === cell) showClassForm({ day: d, startTime: h }); };
            }
            frag.appendChild(cell);
        });
    });

    const fTch = customFilters ? customFilters.teacherId : document.getElementById('filter-teacher')?.value;
    const fGrp = customFilters ? customFilters.groupId : document.getElementById('filter-group')?.value;
    const fTrim = customFilters ? null : document.getElementById('filter-trimester')?.value;
    const fShift = customFilters ? null : document.getElementById('filter-shift')?.value;

    const cutoff = state.settings.shiftCutoff || 4;

    const visible = state.schedule.filter(c => {
        // === FILTRADO ASESORÍAS ===
        if (c.type === 'advisory') {
            // Si hay filtro de grupo o cuatri, la asesoría NO se muestra (porque no pertenece a ningún grupo)
            // EXCEPCIÓN: Si estamos filtrando por DOCENTE, sí se muestra.
            if ((fGrp || fTrim || fShift) && !fTch) return false;
            if (fTch && c.teacherId !== fTch) return false;
            return true;
        }

        // === FILTRADO CLASES ===
        const g = state.groups.find(x => x.id === c.groupId);
        if (!g) return false;
        if (fShift === 'matutino' && g.trimester >= cutoff) return false;
        if (fShift === 'vespertino' && g.trimester < cutoff) return false;
        if (fTch && c.teacherId !== fTch) return false;
        if (fGrp && c.groupId !== fGrp) return false;
        if (fTrim && g.trimester != fTrim) return false;
        return true;
    });

    // EXTERNAS (Sin cambios)
    if (!customFilters) {
        state.external.forEach(ext => {
            const g = state.groups.find(x => x.id === ext.groupId); if (!g) return;
            if (fShift === 'matutino' && g.trimester >= cutoff) return;
            if (fShift === 'vespertino' && g.trimester < cutoff) return;
            if (fGrp && ext.groupId !== fGrp) return;
            if (fTrim && g.trimester != fTrim) return;
            if (fTch) return;
            const dIdx = days.indexOf(ext.day); if (dIdx === -1) return;
            const el = document.createElement('div'); el.className = 'external-block';
            const startIdx = timeSlots.indexOf(ext.start); if (startIdx === -1) return;
            el.style.top = `${(startIdx * 60) + 60}px`; el.style.height = `${(ext.end - ext.start) * 60}px`;
            el.style.left = `calc(60px + ((100% - 60px)/5)*${dIdx})`; el.style.width = `calc(((100% - 60px)/5) - 2px)`;
            el.innerHTML = `<span>${ext.type}</span><span style="font-size:9px; font-weight:normal;">${g.name}</span>`;
            frag.appendChild(el);
        });
    }

    days.forEach((day, dIdx) => {
        const items = visible.filter(c => c.day === day);
        items.forEach(c => {
            const overlaps = items.filter(o => c.startTime < (o.startTime + o.duration) && (c.startTime + c.duration) > o.startTime);
            overlaps.sort((a, b) => a.id.localeCompare(b.id));
            const el = createItem(c, dIdx, overlaps.length, overlaps.indexOf(c), !!customFilters);
            if (el) frag.appendChild(el);
        });
    });

    targetElement.appendChild(frag);
}

function createItem(c, dayIdx, totalOverlaps, overlapIdx, isExporting) {
    const tIdx = timeSlots.indexOf(c.startTime); if (tIdx === -1) return null;
    const teach = state.teachers.find(t => t.id === c.teacherId);

    // Validar datos básicos
    if (!teach) return null;

    // Si es clase, requerimos materia y grupo
    let subj = null, grp = null;
    if (c.type !== 'advisory') {
        subj = state.subjects.find(s => s.id === c.subjectId);
        grp = state.groups.find(g => g.id === c.groupId);
        if (!subj || !grp) return null;
    }

    const room = state.classrooms.find(r => r.id === c.classroomId);
    const teacherName = (isExporting && teach.fullName) ? teach.fullName : teach.name;
    const roomName = room ? room.name : "Sin Aula";

    const el = document.createElement('div'); el.className = 'schedule-item';

    // CORRECCIÓN ALINEACIÓN (Final):
    // .schedule-grid tiene padding-left: 0. 
    // Grid columns: 60px ...
    // Border is 1px on container.
    // Absolute position left=0 is inside the border.
    // Col 1 is 60px wide. Ends at 60px.
    // Col 2 starts at 60px.
    const leftOffset = 60;

    // Use calc for precise sub-pixel rendering allowed by CSS
    const colW = `((100% - ${leftOffset}px)/5)`;

    el.style.top = `${(tIdx * rowH) + rowH}px`;
    // Height: Full rowH (60) minus internal borders/margins. 
    // If we want it to look like it fits IN the cell:
    // Cell is 60px. Border bottom 1px. Content 59px.
    // We want 2px margin top/bottom. 60 - 4 = 56px.
    el.style.height = `${(c.duration * rowH) - (isExporting ? 1 : 4)}px`;

    // Left: offset + (width * day) + sub-index offset
    el.style.left = `calc(${leftOffset}px + (${colW} * ${dayIdx}) + (${colW} / ${totalOverlaps} * ${overlapIdx}))`;

    // Width: colW / overlaps - margins
    // If overlaps, share space.
    // Margin: 2px each side? Or just total reduction?
    // Let's subtract 4px total for margins (2px left, 2px right)
    el.style.width = `calc((${colW} / ${totalOverlaps}) - ${isExporting ? 1 : 4}px)`;

    // === RENDERIZADO ASESORÍA ===
    if (c.type === 'advisory') {
        el.style.backgroundColor = '#fef3c7'; // Amber-100
        el.style.borderLeftColor = '#d97706'; // Amber-600
        if (isExporting) { el.style.border = '1px solid #d97706'; el.style.zIndex = '20'; }

        el.innerHTML = `
            <div class="font-bold text-amber-700 text-xs tracking-wider">ASESORÍA</div>
            <div class="item-details text-amber-900">${teacherName}</div>
            <div class="item-details text-amber-600 text-[9px]">${roomName}</div>
        `;
    }
    // === RENDERIZADO CLASE NORMAL ===
    else {
        // Color Logic: Custom or Palette
        let bgColor, borderColor;
        if (subj.color) {
            bgColor = subj.color;
            borderColor = subj.color;
        } else {
            const cIdx = subj.id.split('').reduce((a, x) => a + x.charCodeAt(0), 0) % PALETTE.length;
            bgColor = PALETTE[cIdx];
            borderColor = PALETTE[cIdx];
        }

        // Teacher Color Override (Border)
        if (teach.color) {
            borderColor = teach.color;
        }

        if (isExporting) {
            el.style.backgroundColor = bgColor + (bgColor.length === 7 ? '99' : ''); // Try to add alpha if hex
            el.style.border = '1px solid #000';
            el.style.zIndex = '20';
        }
        else {
            el.style.borderLeftColor = borderColor;

            // If teacher color is used, make border thicker for visibility
            if (teach.color) {
                el.style.borderLeftWidth = "5px";
            }
        }

        const isNarrow = totalOverlaps >= 3 && !isExporting;
        el.innerHTML = `<div class="subject-name" style="${isNarrow ? 'font-size:0.6rem' : ''}">${subj.name}</div>${!isNarrow ? `<div class="item-details">${teacherName} • ${grp.name}</div>` : ''}`;
    }

    if (!isExporting) {
        el.onclick = (e) => { e.stopPropagation(); showClassForm(c); };
        el.ondragover = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
        };
        el.ondrop = (e) => handleDrop(e, c.day, c.startTime);

        // Make draggable
        el.draggable = true;
        el.ondragstart = (e) => {
            hideTooltip();
            const draggingInfo = {
                type: 'move',
                id: c.id,
                day: c.day,
                startTime: c.startTime,
                duration: c.duration,
                teacherId: c.teacherId,
                groupId: c.groupId,
                classroomId: c.classroomId
            };
            window.currentDrag = draggingInfo; // Global state for drag visual feedback
            e.dataTransfer.setData('application/json', JSON.stringify(draggingInfo));
            e.dataTransfer.effectAllowed = 'copyMove';
            el.style.opacity = '0.4';
        };
        el.ondragend = () => { el.style.opacity = '1'; window.currentDrag = null; };

        // Tooltip adaptativo
        let tooltipHTML = '';
        if (c.type === 'advisory') {
            tooltipHTML = `
                <div class="font-bold text-sm mb-2 text-white border-b border-gray-600 pb-1 text-amber-400">ASESORÍA / ADM</div>
                <div class="text-xs text-gray-200 space-y-1">
                    <div><span class="text-gray-400 font-bold">Docente:</span> ${teach.fullName || teach.name}</div>
                    <div><span class="text-gray-400 font-bold">Aula:</span> ${roomName}</div>
                    <div><span class="text-gray-400 font-bold">Horario:</span> ${c.startTime}:00 - ${c.startTime + c.duration}:00</div>
                </div>`;
        } else {
            tooltipHTML = `<div class="font-bold text-sm mb-2 text-white border-b border-gray-600 pb-1">${subj.name}</div><div class="text-xs text-gray-200 space-y-1"><div><span class="text-gray-400 font-bold">Aula:</span> ${roomName}</div><div><span class="text-gray-400 font-bold">Docente:</span> ${teach.fullName || teach.name}</div><div><span class="text-gray-400 font-bold">Grupo:</span> ${grp.name}</div></div>`;
        }

        el.onmouseenter = () => showTooltip(tooltipHTML);
        el.onmouseleave = hideTooltip;
    }
    return el;
}
