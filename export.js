// export.js - Módulo Oficial

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

export async function exportSchedule(type) {
    const originalGrid = document.getElementById('schedule-grid');
    if (!originalGrid) return alert("No hay horario.");
    updateOverlay("Exportando...");
    try {
        await new Promise(r => setTimeout(r, 200));
        const clone = originalGrid.cloneNode(true);
        clone.querySelectorAll('button, .actions').forEach(el => el.remove());
        clone.style.height = 'auto'; clone.style.overflow = 'visible'; clone.style.maxHeight = 'none';
        const blob = await generateImageBlob(clone, "Horario General", "Vista Actual");
        if (type === 'pdf') savePdf(blob, "Horario.pdf"); else window.saveAs(blob, "Horario.png");
    } catch(e){ console.error(e); } finally { hideOverlay(); }
}

export async function exportAllSchedules(state, renderFn) {
    if(!state.groups.length && !state.teachers.length) return alert("No hay datos.");
    const p = prompt("Nombre del Periodo:", "Enero-Abril 2026");
    if(!p) return;
    // Eliminamos espacios del periodo para el nombre de archivo
    const cleanP = p.replace(/\s+/g,'');

    updateOverlay("Iniciando...");
    const zip = new JSZip();
    const fG = zip.folder("Grupos");
    const fT = zip.folder("Docentes");
    
    // Contenedor temporal
    const tempContainer = document.createElement('div');
    tempContainer.className = 'schedule-grid bg-white';
    tempContainer.style.width = '1200px'; 
    tempContainer.style.position = 'absolute'; tempContainer.style.left = '-9999px';
    document.body.appendChild(tempContainer);
    
    try {
        // Grupos
        for (let i=0; i<state.groups.length; i++) {
            const g = state.groups[i];
            updateOverlay(`Grupo ${i+1}/${state.groups.length}: ${g.name}`);
            renderFn(tempContainer, { groupId: g.id });
            tempContainer.querySelectorAll('button').forEach(b=>b.remove());
            const blob = await generateImageBlob(tempContainer, `HORARIO ${p.toUpperCase()}`, `${g.name} - ${g.trimester}° Cuatrimestre`);
            // NOMBRE ARCHIVO: IAEV-41_Cuatri8_Enero-Abril2026.png
            fG.file(`${g.name}_Cuatri${g.trimester}_${cleanP}.png`, blob);
        }
        
        // Docentes
        for (let i=0; i<state.teachers.length; i++) {
            const t = state.teachers[i];
            updateOverlay(`Docente ${i+1}/${state.teachers.length}: ${t.name}`);
            renderFn(tempContainer, { teacherId: t.id });
            tempContainer.querySelectorAll('button').forEach(b=>b.remove());
            const blob = await generateImageBlob(tempContainer, `HORARIO DOCENTE ${p.toUpperCase()}`, t.fullName || t.name);
            // NOMBRE ARCHIVO: ProfeJuan_Enero-Abril2026.png
            const cleanName = t.name.replace(/\s+/g, '');
            fT.file(`Profe${cleanName}_${cleanP}.png`, blob);
        }
        
        updateOverlay("Comprimiendo...");
        const content = await zip.generateAsync({type:"blob"});
        window.saveAs(content, `Horarios_${cleanP}.zip`);
        
    } catch(e) { console.error(e); alert("Error exportando."); } 
    finally { 
        document.body.removeChild(tempContainer);
        hideOverlay(); 
    }
}

async function generateImageBlob(content, title, subtitle) {
    const tpl = document.getElementById('export-template');
    const ph = document.getElementById('export-grid-placeholder');
    
    // Encabezado Oficial Limpio
    const headerHTML = `
        <div class="official-header" style="display:flex; align-items:center; justify-content:space-between; border-bottom:4px solid #3b82f6; padding-bottom:15px; margin-bottom:20px;">
            <div style="display:flex; align-items:center; gap:20px;">
                <div style="display:flex; flex-direction:column;">
                    <h1 style="font-family:'Arial',sans-serif; font-size:32px; font-weight:900; color:#1e293b; margin:0; letter-spacing:-0.5px;">${title}</h1>
                    <h2 style="font-family:'Arial',sans-serif; font-size:18px; font-weight:600; color:#64748b; margin:5px 0 0 0; text-transform:uppercase;">${subtitle}</h2>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:12px; color:#94a3b8; font-family:'Arial',sans-serif;">FECHA DE EMISIÓN</div>
                <div style="font-size:16px; font-weight:bold; color:#334155; font-family:'Arial',sans-serif;">${new Date().toLocaleDateString()}</div>
            </div>
        </div>
    `;
    
    tpl.innerHTML = headerHTML + '<div id="temp-grid-slot"></div><div style="margin-top:20px; border-top:1px solid #e2e8f0; padding-top:10px; display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; font-family:Arial,sans-serif;"><p>Ingeniería en Animación y Efectos Visuales</p><p>Documento Oficial</p></div>';
    
    // Inyectar contenido
    const slot = tpl.querySelector('#temp-grid-slot');
    slot.innerHTML = '';
    slot.appendChild(content); // Movemos el nodo limpio aquí
    
    tpl.style.opacity = '1'; tpl.style.zIndex = '9999'; tpl.style.width = '1400px'; 
    
    const canvas = await window.html2canvas(tpl, { scale: 2, backgroundColor:'#ffffff' });
    
    tpl.style.opacity = '0'; tpl.style.zIndex = '-1';
    return new Promise(r => canvas.toBlob(r, 'image/png'));
}

function savePdf(blob, name) {
    const url = URL.createObjectURL(blob);
    const img = new Image(); img.src = url;
    img.onload = () => {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('l', 'mm', 'a4');
        const w = pdf.internal.pageSize.getWidth();
        const h = pdf.internal.pageSize.getHeight();
        const ratio = img.width/img.height;
        const printH = w/ratio;
        if (printH > h) { const printW = h*ratio; pdf.addImage(img, 'PNG', (w-printW)/2, 0, printW, h); }
        else { pdf.addImage(img, 'PNG', 0, 10, w, printH); }
        pdf.save(name);
    };
}
