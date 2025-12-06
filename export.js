import { PALETTE } from './config.js';

// UI Helpers
function createOverlay() {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center transition-opacity duration-500';
        overlay.innerHTML = '<div class="loader mb-4"></div><h2 class="text-xl font-semibold text-gray-700 animate-pulse">Procesando...</h2><p id="loading-text" class="text-sm text-gray-500 mt-2"></p>';
        document.body.appendChild(overlay);
    }
    return overlay;
}

function updateOverlay(msg) { 
    const o = createOverlay(); 
    requestAnimationFrame(() => o.style.opacity = '1'); 
    const t = o.querySelector('#loading-text') || o.querySelector('h2'); 
    if(t) t.textContent = msg; 
}

function hideOverlay() { 
    const o = document.getElementById('loading-overlay'); 
    if(o) { 
        o.style.opacity = '0'; 
        setTimeout(()=>o.remove(),500); 
    } 
}

// Exportación Masiva
export async function exportAllSchedules(state, renderFn) {
    if(!state.groups.length && !state.teachers.length) {
        alert("No hay datos para exportar.");
        return;
    }
    
    const p = prompt("Nombre del Periodo:", "Enero-Abril 2026");
    if(!p) return;
    const cleanP = p.replace(/\s+/g,'');

    updateOverlay("Iniciando exportación...");
    const zip = new JSZip();
    const fG = zip.folder("Grupos");
    const fT = zip.folder("Docentes");
    
    // Contenedor temporal para renderizado
    const tempContainer = document.createElement('div');
    tempContainer.className = 'schedule-grid bg-white';
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.width = '900px';
    document.body.appendChild(tempContainer);
    
    try {
        // === EXPORTAR GRUPOS ===
        for (let i = 0; i < state.groups.length; i++) {
            const g = state.groups[i];
            updateOverlay(`Generando Grupo ${i+1}/${state.groups.length}: ${g.name}`);
            
            // Renderizar horario del grupo
            renderFn(tempContainer, { groupId: g.id });
            
            // Limpiar botones de interacción
            tempContainer.querySelectorAll('button').forEach(b => b.remove());
            
            // Recolectar info para tabla lateral (Materias -> Docentes)
            const groupClasses = state.schedule.filter(c => c.groupId === g.id);
            const teacherMap = {};
            
            groupClasses.forEach(c => {
                const s = state.subjects.find(x => x.id === c.subjectId);
                const t = state.teachers.find(x => x.id === c.teacherId);
                if(s && t) {
                    const cIdx = s.id.split('').reduce((a,x) => a + x.charCodeAt(0), 0) % PALETTE.length;
                    teacherMap[s.name] = { 
                        name: t.fullName || t.name, 
                        color: PALETTE[cIdx] + '99'
                    };
                }
            });

            // Generar imagen oficial
            const blob = await generateOfficialImage(
                tempContainer, 
                `HORARIO ${p.toUpperCase()}`, 
                `${g.name} - ${g.trimester}° Cuatrimestre`,
                teacherMap,
                "DOCENTES"
            );
            
            fG.file(`${g.name}_Cuatri${g.trimester}_${cleanP}.png`, blob);
        }
        
        // === EXPORTAR DOCENTES ===
        for (let i = 0; i < state.teachers.length; i++) {
            const t = state.teachers[i];
            updateOverlay(`Generando Docente ${i+1}/${state.teachers.length}: ${t.name}`);
            
            // Renderizar horario del docente
            renderFn(tempContainer, { teacherId: t.id });
            
            // Limpiar botones
            tempContainer.querySelectorAll('button').forEach(b => b.remove());
            
            // Recolectar info para tabla lateral (Materias -> Grupos)
            const teachClasses = state.schedule.filter(c => c.teacherId === t.id);
            const subMap = {};
            
            teachClasses.forEach(c => {
                const s = state.subjects.find(x => x.id === c.subjectId);
                const g = state.groups.find(x => x.id === c.groupId);
                if(s && g) {
                    const cIdx = s.id.split('').reduce((a,x) => a + x.charCodeAt(0), 0) % PALETTE.length;
                    subMap[s.name] = { 
                        name: g.name, 
                        color: PALETTE[cIdx] + '99' 
                    };
                }
            });

            const blob = await generateOfficialImage(
                tempContainer, 
                `HORARIO DOCENTE ${p.toUpperCase()}`, 
                t.fullName || t.name,
                subMap,
                "GRUPOS"
            );
            
            const n = (t.fullName || t.name).replace(/\s+/g, '_');
            fT.file(`${n}_${cleanP}.png`, blob);
        }
        
        // Comprimir y descargar
        updateOverlay("Comprimiendo archivos...");
        const content = await zip.generateAsync({type: "blob"});
        window.saveAs(content, `Horarios_${cleanP}.zip`);
        
        alert(`✓ Exportación completada!\n\n${state.groups.length} grupos y ${state.teachers.length} docentes exportados.`);
        
    } catch(e) { 
        console.error(e); 
        alert("Error durante la exportación: " + e.message); 
    } finally { 
        // Limpiar contenedor temporal
        document.body.removeChild(tempContainer);
        hideOverlay(); 
    }
}

async function generateOfficialImage(contentNode, title, subtitle, infoMap = {}, rightColTitle = "DOCENTES") {
    const tpl = document.getElementById('export-template');
    
    // Generar tabla lateral con colores
    const rows = Object.entries(infoMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([leftText, data]) => 
            `<tr>
                <td class="subject-col" style="background-color: ${data.color}; border:1px solid #000; padding: 4px; font-weight: bold;">${leftText}</td>
                <td class="teacher-col" style="border:1px solid #000; padding: 4px;">${data.name}</td>
             </tr>`
        ).join('');

    const sideTableHTML = rows ? `
        <table class="teachers-table">
            <thead>
                <tr><th colspan="2" style="background:#d1d5db; border:1px solid #000; padding:6px; text-align:center;">${rightColTitle}</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    ` : '<div style="color:#999; font-style:italic; text-align:center; padding:20px;">Sin asignaciones</div>';

    // Header con logos
    const headerHTML = `
        <div class="official-header" style="display:flex; align-items:center; justify-content:space-between; border-bottom:4px solid #3b82f6; padding-bottom:15px; margin-bottom:20px;">
            <div style="display:flex; align-items:center; gap:20px;">
                <div style="font-weight:bold; color:#000; font-size:24px;">
                    POLITÉCNICA <span style="color:#0ea5e9">SANTA ROSA</span>
                </div>
                <div>
                    <h1 style="font-size:22px; font-weight:900; margin:0; color:#000;">${title}</h1>
                    <h2 style="font-size:14px; margin:0; color:#444;">${subtitle}</h2>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:30px; font-weight:900; line-height:1;">
                    <span style="color:#3b82f6">I</span><span style="color:#22c55e">A</span><span style="color:#ef4444">E</span><span style="color:#eab308">V</span>
                </div>
                <div style="font-size:10px; font-weight:bold; color:#666;">INGENIERÍA EN ANIMACIÓN</div>
            </div>
        </div>
    `;
    
    tpl.innerHTML = `
        ${headerHTML}
        <div style="display:flex; gap:15px; align-items:start;">
            <div id="grid-slot" style="flex:1;"></div>
            <div style="width: 300px;">${sideTableHTML}</div>
        </div>
        <div style="margin-top:20px; text-align:center; font-size:10px; color:#666; border-top:1px solid #ccc; padding-top:5px;">
            Documento generado automáticamente por Planificador IAEV | ${new Date().toLocaleDateString('es-MX')}
        </div>
    `;
    
    // Insertar grid clonado
    const clonedGrid = contentNode.cloneNode(true);
    tpl.querySelector('#grid-slot').appendChild(clonedGrid);
    
    // Mostrar template temporalmente
    tpl.style.opacity = '1'; 
    tpl.style.zIndex = '9999'; 
    tpl.style.width = '1400px';
    tpl.style.position = 'fixed';
    tpl.style.top = '0';
    tpl.style.left = '0';
    
    // Esperar renderizado
    await new Promise(r => setTimeout(r, 200));
    
    // Capturar con html2canvas
    const canvas = await window.html2canvas(tpl, { 
        scale: 2, 
        backgroundColor: '#fff',
        logging: false,
        useCORS: true
    });
    
    // Ocultar template
    tpl.style.opacity = '0'; 
    tpl.style.zIndex = '-1';
    
    // Retornar blob
    return new Promise(r => canvas.toBlob(r, 'image/png'));
}

// Exportación Individual (simplificada)
export async function exportSchedule(type) {
    alert("Por favor usa la Exportación Masiva (ZIP) para obtener el formato oficial completo con todos los horarios.");
}
