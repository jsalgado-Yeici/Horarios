import { state, cols, days, timeSlots } from './state.js';
import { PALETTE } from './config.js';
import { showClassForm, handleDrop, deleteDocWrapper } from './actions.js';
import { showTooltip, hideTooltip } from './ui.js';
import { doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

export function renderScheduleGrid(targetElement = document.getElementById('schedule-grid'), customFilters = null) {
    if (!targetElement) return;
    
    if(customFilters) {
        targetElement.style.border = "none";
        targetElement.style.boxShadow = "none";
    }

    targetElement.innerHTML = '';
    const frag = document.createDocumentFragment();

    const corner = document.createElement('div'); 
    corner.className = 'grid-header sticky top-0 left-0 bg-gray-50'; 
    corner.innerText = 'HORA'; 
    frag.appendChild(corner);
    
    days.forEach(d => { 
        const h = document.createElement('div'); 
        h.className = 'grid-header sticky top-0 bg-gray-50'; 
        h.innerText = d; 
        frag.appendChild(h); 
    });

    timeSlots.forEach(h => {
        const tc = document.createElement('div'); 
        tc.className = 'grid-time-slot sticky left-0 bg-white'; 
        tc.innerText = `${h}:00 - ${h+1}:00`; 
        frag.appendChild(tc);
        
        days.forEach(d => {
            const cell = document.createElement('div'); 
            cell.className = 'grid-cell'; 
            cell.dataset.day = d; 
            cell.dataset.hour = h;
            
            if(!customFilters && targetElement.id === 'schedule-grid') { 
                cell.ondragover = e => { e.preventDefault(); cell.classList.add('droppable-hover'); };
                cell.ondragleave = () => cell.classList.remove('droppable-hover');
                cell.ondrop = e => handleDrop(e, d, h); 
                cell.onclick = (e) => { if(e.target===cell) showClassForm({day: d, startTime: h}); };
            }
            frag.appendChild(cell);
        });
    });

    const fTch = customFilters ? customFilters.teacherId : document.getElementById('filter-teacher')?.value;
    const fGrp = customFilters ? customFilters.groupId : document.getElementById('filter-group')?.value;
    const fTrim = customFilters ? null : document.getElementById('filter-trimester')?.value;

    const visible = state.schedule.filter(c => {
        if(fTch && c.teacherId !== fTch) return false;
        if(fGrp && c.groupId !== fGrp) return false;
        if(fTrim) { const g = state.groups.find(x => x.id === c.groupId); if(!g || g.trimester != fTrim) return false; }
        return true;
    });

    days.forEach((day, dIdx) => {
        const items = visible.filter(c => c.day === day);
        items.forEach(c => {
            const overlaps = items.filter(o => c.startTime < (o.startTime + o.duration) && (c.startTime + c.duration) > o.startTime);
            overlaps.sort((a,b) => a.id.localeCompare(b.id)); 
            const el = createItem(c, dIdx, overlaps.length, overlaps.indexOf(c), !!customFilters);
            if(el) frag.appendChild(el);
        });
    });

    if(!customFilters) {
        state.blocks.forEach(b => {
            if(fTrim && b.trimester != fTrim) return;
            const dIndices = b.days==='L-V' ? [0,1,2,3,4] : [0,1,2,3];
            dIndices.forEach(di => {
                const el = document.createElement('div'); el.className = 'schedule-block';
                el.style.top = `${(timeSlots.indexOf(b.startTime)+1)*60}px`; el.style.height = `${(b.endTime - b.startTime)*60}px`;
                el.style.left = `calc(60px + ((100% - 60px)/5)*${di})`; el.style.width = `calc(((100% - 60px)/5) - 2px)`;
                el.innerHTML = `<span>BLOQ C${b.trimester}</span><button class="ml-2 text-red-500 font-bold">×</button>`;
                if(el.children[1]) el.children[1].onclick = () => deleteDocWrapper('blocks', b.id);
                frag.appendChild(el);
            });
        });
    }

    targetElement.appendChild(frag);
}

function createItem(c, dayIdx, totalOverlaps, overlapIdx, isExporting) {
    const tIdx = timeSlots.indexOf(c.startTime); if(tIdx === -1) return null;
    const subj = state.subjects.find(s => s.id === c.subjectId);
    const teach = state.teachers.find(t => t.id === c.teacherId);
    const grp = state.groups.find(g => g.id === c.groupId);
    const room = state.classrooms.find(r => r.id === c.classroomId);
    
    if(!subj || !grp || !teach) return null;

    const el = document.createElement('div'); el.className = 'schedule-item';
    
    // Matematicas exactas exportación vs web
    const rowH = isExporting ? 55 : 60; 
    const leftOffset = isExporting ? 80 : 60;
    const colW = `((100% - ${leftOffset}px)/5)`;
    
    el.style.top = `${(tIdx * rowH) + rowH}px`; 
    el.style.height = `${(c.duration * rowH) - (isExporting ? 1 : 4)}px`;
    el.style.left = `calc(${leftOffset}px + (${colW} * ${dayIdx}) + (${colW} / ${totalOverlaps} * ${overlapIdx}))`;
    el.style.width = `calc((${colW} / ${totalOverlaps}) - ${isExporting ? 1 : 4}px)`;
    
    const cIdx = subj.id.split('').reduce((a,x)=>a+x.charCodeAt(0),0) % PALETTE.length;
    
    if(isExporting) {
        el.style.backgroundColor = PALETTE[cIdx] + '99'; 
        el.style.border = '1px solid #000';
        el.style.zIndex = '20'; 
    } else {
        el.style.borderLeftColor = PALETTE[cIdx];
    }

    const teacherName = (isExporting && teach.fullName) ? teach.fullName : teach.name;
    const roomName = room ? room.name : "Sin Aula"; // Texto por defecto si no hay aula
    const isNarrow = totalOverlaps >= 3 && !isExporting;

    el.innerHTML = `
        <div class="subject-name" style="${isNarrow?'font-size:0.6rem':''}">${subj.name}</div>
        ${!isNarrow ? `
            <div class="item-details" ${isExporting?'style="font-size:9px;"':''}>
                ${isExporting ? `<div style="margin-bottom:2px; font-weight:normal;">${teacherName}</div>` : `<div>${teacherName}</div>`}
                ${isExporting ? `<div style="font-weight:bold; border-top:1px solid #000; display:inline-block; padding-top:2px;">Aula: ${roomName}</div>` : `<div>${grp.name}</div>`}
            </div>` : ''}
        ${!isExporting ? `<div class="actions"><button class="btn-edt">✎</button><button class="btn-del">×</button></div>` : ''}
    `;

    if(!isExporting) {
        el.querySelector('.btn-edt').onclick = (e) => { e.stopPropagation(); showClassForm(c); }; 
        el.querySelector('.btn-del').onclick = (e) => { e.stopPropagation(); deleteDocWrapper('schedule', c.id); };
        
        el.ondragover = (e) => { e.preventDefault(); e.stopPropagation(); };
        el.ondrop = (e) => handleDrop(e, c.day, c.startTime);

        // === TOOLTIP MEJORADO ===
        // Aquí definimos qué se ve al pasar el mouse
        el.onmouseenter = () => showTooltip(`
            <div class="font-bold text-sm mb-2 text-white border-b border-gray-600 pb-1">
                ${subj.name}
            </div>
            <div class="text-xs text-gray-200 space-y-2">
                <div class="flex items-center gap-2">
                    <span class="text-lg">🏫</span> 
                    <div>
                        <span class="block text-[10px] text-gray-400 uppercase font-bold">Aula / Salón</span>
                        <span class="text-sm font-semibold text-white">${roomName}</span>
                    </div>
                </div>
                
                <div class="flex items-center gap-2">
                    <span class="text-lg">🕒</span> 
                    <div>
                        <span class="block text-[10px] text-gray-400 uppercase font-bold">Horario</span>
                        <span class="text-white">${c.startTime}:00 - ${c.startTime + c.duration}:00</span>
                    </div>
                </div>

                <div class="border-t border-gray-700 pt-1 mt-1 flex justify-between">
                    <div>
                        <span class="text-[10px] text-gray-400 block">Docente</span>
                        <span>${teacherName}</span>
                    </div>
                    <div class="text-right">
                        <span class="text-[10px] text-gray-400 block">Grupo</span>
                        <span>${grp.name}</span>
                    </div>
                </div>
            </div>
        `);
        el.onmouseleave = hideTooltip; 
        el.onclick = () => showClassForm(c);
    }
    return el;
}
