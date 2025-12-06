// export.js - Modulo Oficial con Layout Complejo

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
function updateOverlay(msg) { const o = createOverlay(); requestAnimationFrame(() => o.style.opacity = '1'); const t = o.querySelector('#loading-text') || o.querySelector('h2'); if(t) t.textContent = msg; }
function hideOverlay() { const o = document.getElementById('loading-overlay'); if(o) { o.style.opacity = '0'; setTimeout(()=>o.remove(),500); } }

// --- EXPORTACIÓN MASIVA (ZIP) ---
export async function exportAllSchedules(state, renderFn) {
    if(!state.groups.length && !state.teachers.length) return alert("No hay datos.");
    const p = prompt("Nombre del Periodo:", "Enero-Abril 2026");
    if(!p) return;
    const cleanP = p.replace(/\s+/g,'');

    updateOverlay("Iniciando...");
    const zip = new JSZip();
    const fG = zip.folder("Grupos");
    const fT = zip.folder("Docentes");
    
    const tempContainer = document.createElement('div');
    tempContainer.className = 'schedule-grid bg-white';
    tempContainer.style.width = '900px'; // Un poco menos ancho para dejar espacio a la tabla lateral
    
    try {
        // GRUPOS
        for (let i=0; i<state.groups.length; i++) {
            const g = state.groups[i];
            updateOverlay(`Grupo ${i+1}/${state.groups.length}: ${g.name}`);
            
            // 1. Renderizar horario
            renderFn(tempContainer, { groupId: g.id });
            tempContainer.querySelectorAll('button').forEach(b=>b.remove());
            
            // 2. Extraer lista de materias/profes para la tabla lateral
            const groupClasses = state.schedule.filter(c => c.groupId === g.id);
            const teacherMap = {}; // Mapa para no repetir
            groupClasses.forEach(c => {
                const s = state.subjects.find(x => x.id === c.subjectId);
                const t = state.teachers.find(x => x.id === c.teacherId);
                if(s && t) teacherMap[s.name] = t.fullName || t.name;
            });

            const blob = await generateOfficialImage(
                tempContainer, 
                `HORARIO ${p.toUpperCase()}`, 
                `${g.name} - ${g.trimester}° Cuatrimestre`,
                teacherMap, // Pasamos el mapa de profes
                "IAEV-PA-01 (BIS 27)" // Room placeholder (podrías sacarlo del state si quisieras)
            );
            fG.file(`${g.name}_Cuatri${g.trimester}_${cleanP}.png`, blob);
        }
        
        // DOCENTES (Formato simplificado sin tabla lateral, o con tabla vacía)
        for (let i=0; i<state.teachers.length; i++) {
            const t = state.teachers[i];
            updateOverlay(`Docente ${i+1}/${state.teachers.length}: ${t.name}`);
            
            renderFn(tempContainer, { teacherId: t.id });
            tempContainer.querySelectorAll('button').forEach(b=>b.remove());
            
            const blob = await generateOfficialImage(
                tempContainer, 
                `HORARIO DOCENTE ${p.toUpperCase()}`, 
                t.fullName || t.name,
                {} // Sin tabla lateral para profes
            );
            const n = t.name.replace(/\s+/g,'');
            fT.file(`${n}_${cleanP}.png`, blob);
        }
        
        updateOverlay("Comprimiendo...");
        const content = await zip.generateAsync({type:"blob"});
        window.saveAs(content, `Horarios_${cleanP}.zip`);
        
    } catch(e) { console.error(e); alert("Error exportando."); } 
    finally { hideOverlay(); }
}

// --- GENERADOR DE IMAGEN OFICIAL ---
async function generateOfficialImage(contentNode, title, subtitle, teacherMap = {}, roomInfo = "") {
    const tpl = document.getElementById('export-template');
    
    // Generar filas de la tabla de profesores
    const teacherRows = Object.entries(teacherMap).map(([materia, profe]) => 
        `<tr><td class="subject-col">${materia}</td><td class="teacher-col">${profe}</td></tr>`
    ).join('');

    const teacherTableHTML = teacherRows ? `
        <table class="teachers-table">
            <thead><tr><th colspan="2" style="background:#e0e0e0; border:1px solid #000;">DOCENTES</th></tr></thead>
            <tbody>${teacherRows}</tbody>
        </table>
    ` : '';

    // HTML ESTRUCTURA COMPLETA (Grid + Sidebar)
    tpl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #000; padding-bottom:10px; margin-bottom:10px;">
            <div style="display:flex; gap:20px; align-items:center;">
                <div style="font-weight:bold; color:#000; font-size:24px;">POLITÉCNICA <span style="color:#0ea5e9">SANTA ROSA</span></div>
                <div>
                    <h1 style="font-size:22px; font-weight:900; margin:0;">${title}</h1>
                    <h2 style="font-size:14px; margin:0; color:#444;">${subtitle}</h2>
                    <div style="font-size:12px; margin-top:2px;">${roomInfo}</div>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:30px; font-weight:900; color:#facc15;"><span style="color:#3b82f6">I</span><span style="color:#22c55e">A</span><span style="color:#ef4444">E</span><span style="color:#eab308">V</span></div>
                <div style="font-size:10px; font-weight:bold;">INGENIERÍA EN ANIMACIÓN</div>
            </div>
        </div>

        <div style="display:flex; gap:15px; align-items:start;">
            <div id="grid-slot" style="flex:1;"></div>
            <div style="width: 300px;">
                ${teacherTableHTML}
            </div>
        </div>
        
        <div style="margin-top:20px; text-align:center; font-size:10px; color:#666; border-top:1px solid #ccc; padding-top:5px;">
            Documento generado automáticamente por Planificador IAEV | ${new Date().toLocaleDateString()}
        </div>
    `;
    
    // Inyectar el grid renderizado
    tpl.querySelector('#grid-slot').appendChild(contentNode.cloneNode(true));
    
    tpl.style.opacity = '1'; tpl.style.zIndex = '9999';
    
    // Esperar a que renderice bien (importante para estilos)
    await new Promise(r => setTimeout(r, 100));

    const canvas = await window.html2canvas(tpl, { scale: 2, backgroundColor:'#fff' });
    
    tpl.style.opacity = '0'; tpl.style.zIndex = '-1';
    return new Promise(r => canvas.toBlob(r, 'image/png'));
}

// Single Export (Adaptado para usar la misma lógica visual si quieres, o dejarlo simple)
export async function exportSchedule(type) {
    alert("Para el formato oficial completo, por favor usa la Exportación Masiva (ZIP).");
}
