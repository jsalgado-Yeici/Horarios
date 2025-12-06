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
    
    // Contenedor temporal (invisible)
    const tempContainer = document.createElement('div');
    tempContainer.className = 'schedule-grid'; 
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.width = '1000px'; 
    document.body.appendChild(tempContainer);
    
    try {
        // === EXPORTAR GRUPOS ===
        for (let i = 0; i < state.groups.length; i++) {
            const g = state.groups[i];
            updateOverlay(`Generando Grupo ${i+1}/${state.groups.length}: ${g.name}`);
            
            renderFn(tempContainer, { groupId: g.id });
            tempContainer.querySelectorAll('button').forEach(b => b.remove());
            
            // Datos Tabla Lateral
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
            
            renderFn(tempContainer, { teacherId: t.id });
            tempContainer.querySelectorAll('button').forEach(b => b.remove());
            
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
        
        updateOverlay("Comprimiendo archivos...");
        const content = await zip.generateAsync({type: "blob"});
        window.saveAs(content, `Horarios_${cleanP}.zip`);
        
        alert(`✓ Exportación completada!\n\n${state.groups.length} grupos y ${state.teachers.length} docentes exportados.`);
        
    } catch(e) { 
        console.error(e); 
        alert("Error durante la exportación: " + e.message); 
    } finally { 
        document.body.removeChild(tempContainer);
        hideOverlay(); 
    }
}

async function generateOfficialImage(contentNode, title, subtitle, infoMap = {}, rightColTitle = "DOCENTES") {
    const tpl = document.getElementById('export-template');
    
    // Generar Filas Tabla
    const rows = Object.entries(infoMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([leftText, data]) => 
            `<tr>
                <td class="subject-col" style="background-color: ${data.color};">${leftText}</td>
                <td class="teacher-col">${data.name}</td>
             </tr>`
        ).join('');

    const sideTableHTML = rows ? `
        <table class="teachers-table">
            <thead>
                <tr><th colspan="2">${rightColTitle}</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    ` : '<div style="color:#999; text-align:center; padding:20px; border:1px solid #000;">Sin asignaciones</div>';

    // === HEADER CON LOGOS ===
    // IMPORTANTE: Asegúrate de tener las imágenes 'logo_upsrj.png' y 'logo_iaev.png' en tu carpeta
    // O cambia los src="" por tus rutas correctas.
    const headerHTML = `
        <div class="official-header" style="display: flex; align-items: center; justify-content: space-between; padding: 0 40px;">
            
            <div style="width: 200px; display:flex; align-items:center;">
                <img src="logo_upsrj.png" alt="Logo UPSRJ" style="max-height: 80px; max-width: 100%; object-fit: contain;" onerror="this.style.display='none'; this.parentNode.innerHTML='LOGO UPSRJ';"/>
            </div>

            <div style="text-align: center; flex: 1;">
                <h1 style="font-size: 28px; font-weight: 900; margin: 0; color: #000; line-height: 1.2;">${title}</h1>
                <h2 style="font-size: 16px; margin: 5px 0 0 0; color: #444; font-weight: bold; text-transform: uppercase;">${subtitle}</h2>
                <div style="font-size: 11px; font-weight: bold; color: #0ea5e9; margin-top: 5px; letter-spacing: 1px;">INGENIERÍA EN ANIMACIÓN Y EFECTOS VISUALES</div>
            </div>

            <div style="width: 200px; display:flex; align-items:center; justify-content: flex-end;">
                 <img src="logo_iaev.png" alt="Logo IAEV" style="max-height: 80px; max-width: 100%; object-fit: contain;" onerror="this.style.display='none'; this.parentNode.innerHTML='LOGO IAEV';"/>
            </div>

        </div>
    `;
    
    // USAMOS CONTENEDORES ABSOLUTOS
    tpl.innerHTML = `
        ${headerHTML}
        <div id="export-grid-container"></div>
        <div id="export-table-container">${sideTableHTML}</div>
        <div id="export-footer">
            Documento generado automáticamente por Planificador IAEV | ${new Date().toLocaleDateString('es-MX')}
        </div>
    `;
    
    // Clonar e insertar grid
    const clonedGrid = contentNode.cloneNode(true);
    clonedGrid.style.width = '1000px'; 
    clonedGrid.style.border = 'none'; 
    clonedGrid.style.position = 'relative'; 
    clonedGrid.style.left = '0';
    clonedGrid.style.top = '0';
    
    tpl.querySelector('#export-grid-container').appendChild(clonedGrid);
    
    // Renderizado
    tpl.style.opacity = '1'; 
    tpl.style.zIndex = '9999'; 
    
    // Espera un poco más larga para asegurar que las imágenes carguen
    await new Promise(r => setTimeout(r, 300));
    
    // Capturar
    const canvas = await window.html2canvas(tpl, { 
        scale: 2, 
        backgroundColor: '#fff',
        logging: false,
        useCORS: true, // Importante para imágenes locales/externas
        width: 1500, 
        height: 1200, 
        windowWidth: 1500,
        windowHeight: 1200
    });
    
    tpl.style.opacity = '0'; 
    tpl.style.zIndex = '-1';
    
    return new Promise(r => canvas.toBlob(r, 'image/png'));
}

export async function exportSchedule(type) {
    alert("Por favor usa la Exportación Masiva (ZIP) para obtener el formato oficial completo.");
}
