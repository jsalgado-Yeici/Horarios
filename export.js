import { PALETTE } from './config.js';

// UI Helpers (Overlay de carga)
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

// === EXPORTACIÓN MASIVA (ZIP) ===
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
    
    // Contenedor temporal: Ancho 1000px fijo para coincidir con CSS
    const tempContainer = document.createElement('div');
    tempContainer.className = 'schedule-grid'; 
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.width = '1000px'; 
    document.body.appendChild(tempContainer);
    
    try {
        // --- GRUPOS ---
        for (let i = 0; i < state.groups.length; i++) {
            const g = state.groups[i];
            updateOverlay(`Generando Grupo ${i+1}/${state.groups.length}: ${g.name}`);
            
            // Renderizar en contenedor temporal
            renderFn(tempContainer, { groupId: g.id });
            tempContainer.querySelectorAll('button').forEach(b => b.remove());
            
            // Recolectar datos tabla lateral
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
        
        // --- DOCENTES ---
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
        if(document.body.contains(tempContainer)) document.body.removeChild(tempContainer);
        hideOverlay(); 
    }
}

// === GENERADOR DE IMAGEN ===
async function generateOfficialImage(contentNode, title, subtitle, infoMap = {}, rightColTitle = "DOCENTES") {
    const tpl = document.getElementById('export-template');
    
    // Generar filas de la tabla lateral con estilos INLINE para asegurar renderizado
    const rows = Object.entries(infoMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([leftText, data]) => 
            `<tr>
                <td style="background-color: ${data.color}; border: 1px solid #000; padding: 6px; width: 60%; font-weight: bold; font-size: 11px;">${leftText}</td>
                <td style="background-color: white; border: 1px solid #000; padding: 6px; width: 40%; font-size: 11px;">${data.name}</td>
             </tr>`
        ).join('');

    // Si no hay datos, mostrar mensaje
    const tbodyContent = rows || `<tr><td colspan="2" style="padding: 20px; text-align: center; color: #666; font-style: italic; border: 1px solid #000;">Sin asignaciones registradas</td></tr>`;

    // Tabla lateral completa con estilos explícitos
    const sideTableHTML = `
        <table style="width: 100%; border-collapse: collapse; border: 2px solid #000; font-family: Arial, sans-serif; background: white;">
            <thead>
                <tr><th colspan="2" style="background:#d1d5db; border:1px solid #000; padding:8px; text-align:center; font-weight:900; font-size: 12px;">${rightColTitle}</th></tr>
            </thead>
            <tbody>
                ${tbodyContent}
            </tbody>
        </table>
    `;

    const headerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:4px solid #3b82f6; padding-bottom:15px; margin-bottom:20px;">
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
    
    // LAYOUT MAESTRO USANDO TABLA HTML (Evita problemas de flexbox en canvas)
    tpl.innerHTML = `
        ${headerHTML}
        <table style="width: 100%; border-collapse: separate; border-spacing: 0;">
            <tr>
                <td style="width: 1000px; vertical-align: top; padding: 0;">
                    <div id="grid-slot" style="width: 1000px;"></div>
                </td>
                
                <td style="width: 20px;"></td>
                
                <td style="vertical-align: top; padding: 0;">
                    ${sideTableHTML}
                </td>
            </tr>
        </table>
        
        <div style="margin-top:20px; text-align:center; font-size:10px; color:#666; border-top:1px solid #ccc; padding-top:5px;">
            Documento generado automáticamente por Planificador IAEV | ${new Date().toLocaleDateString('es-MX')}
        </div>
    `;
    
    // Insertar el horario
    const clonedGrid = contentNode.cloneNode(true);
    // Asegurar que el grid clonado se comporte bien
    clonedGrid.style.position = 'relative';
    clonedGrid.style.left = '0';
    clonedGrid.style.top = '0';
    clonedGrid.style.width = '1000px';
    tpl.querySelector('#grid-slot').appendChild(clonedGrid);
    
    // Hacer visible temporalmente para la captura
    tpl.style.opacity = '1'; 
    tpl.style.zIndex = '9999';
    
    // Pequeño delay para asegurar renderizado de fuentes
    await new Promise(r => setTimeout(r, 150));
    
    // Capturar
    const canvas = await window.html2canvas(tpl, { 
        scale: 2, // Calidad alta
        backgroundColor: '#fff',
        logging: false,
        useCORS: true,
        width: 1500, // Forzar ancho total
        windowWidth: 1500
    });
    
    // Ocultar de nuevo
    tpl.style.opacity = '0'; 
    tpl.style.zIndex = '-1';
    
    return new Promise(r => canvas.toBlob(r, 'image/png'));
}

export async function exportSchedule(type) {
    alert("Por favor usa la Exportación Masiva (ZIP) para obtener el formato oficial completo.");
}
