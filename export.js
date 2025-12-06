// export.js - Modulo Oficial

function createOverlay() { /* ... igual ... */ 
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
function updateOverlay(msg) { const o = createOverlay(); requestAnimationFrame(() => o.style.opacity = '1'); o.querySelector('h2').textContent = msg; }
function hideOverlay() { const o = document.getElementById('loading-overlay'); if(o) { o.style.opacity = '0'; setTimeout(()=>o.remove(),500); } }

export async function exportSchedule(type) { /* ... igual ... */ 
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
    if(!state.groups.length) return alert("No hay datos.");
    const p = prompt("Nombre del Periodo:", "Enero-Abril 2026");
    if(!p) return;
    const cleanP = p.replace(/\s+/g,'');

    updateOverlay("Iniciando...");
    const zip = new JSZip();
    const fG = zip.folder("Grupos");
    const fT = zip.folder("Docentes");
    
    // Contenedor temporal (Ancho fijo para consistencia)
    const tempContainer = document.createElement('div');
    tempContainer.className = 'schedule-grid bg-white';
    tempContainer.style.width = '1200px'; 
    
    try {
        // Grupos
        for (let i=0; i<state.groups.length; i++) {
            const g = state.groups[i];
            updateOverlay(`Grupo ${i+1}/${state.groups.length}: ${g.name}`);
            
            // Render limpio
            renderFn(tempContainer, { groupId: g.id });
            // Limpieza extra por si acaso
            tempContainer.querySelectorAll('button').forEach(b=>b.remove());
            
            const blob = await generateImageBlob(tempContainer, `HORARIO ${p.toUpperCase()}`, `${g.name} - ${g.trimester}° Cuatrimestre`);
            fG.file(`${g.name}_Cuatri${g.trimester}_${cleanP}.png`, blob);
        }
        
        // Docentes
        for (let i=0; i<state.teachers.length; i++) {
            const t = state.teachers[i];
            updateOverlay(`Docente ${i+1}/${state.teachers.length}: ${t.name}`);
            
            renderFn(tempContainer, { teacherId: t.id });
            tempContainer.querySelectorAll('button').forEach(b=>b.remove());
            
            const blob = await generateImageBlob(tempContainer, `HORARIO DOCENTE ${p.toUpperCase()}`, t.fullName || t.name);
            const n = t.name.replace(/\s+/g,'');
            fT.file(`${n}_${cleanP}.png`, blob);
        }
        
        updateOverlay("Comprimiendo...");
        const content = await zip.generateAsync({type:"blob"});
        window.saveAs(content, `Horarios_${cleanP}.zip`);
        
    } catch(e) { console.error(e); alert("Error exportando."); } 
    finally { hideOverlay(); }
}

async function generateImageBlob(content, title, subtitle) {
    const tpl = document.getElementById('export-template');
    const ph = document.getElementById('export-grid-placeholder');
    
    // Configurar encabezado oficial
    // Reconstruimos el header para que se vea como la imagen enviada
    const headerHTML = `
        <div class="official-header" style="display:flex; align-items:center; justify-content:space-between; border-bottom:3px solid #000; padding-bottom:10px; margin-bottom:15px;">
            <div style="display:flex; align-items:center; gap:15px;">
                <div style="width:50px; height:50px; background:#ccc; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#fff;">LOGO</div>
                <div>
                    <h1 style="font-size:24px; font-weight:800; margin:0; line-height:1;">${title}</h1>
                    <h2 style="font-size:16px; font-weight:600; color:#555; margin:5px 0 0 0;">${subtitle}</h2>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:12px; color:#666;">Generado:</div>
                <div style="font-size:14px; font-weight:bold;">${new Date().toLocaleDateString()}</div>
            </div>
        </div>
    `;
    
    tpl.innerHTML = headerHTML + '<div id="temp-grid-slot"></div>';
    tpl.querySelector('#temp-grid-slot').appendChild(content);
    
    tpl.style.opacity = '1'; tpl.style.zIndex = '9999'; tpl.style.width = '1400px'; // Ancho fijo HD
    
    const canvas = await window.html2canvas(tpl, { scale: 2, backgroundColor:'#fff' });
    
    tpl.style.opacity = '0'; tpl.style.zIndex = '-1';
    return new Promise(r => canvas.toBlob(r, 'image/png'));
}

function savePdf(blob, name) { /* ...igual... */ 
    const url = URL.createObjectURL(blob);
    const img = new Image(); img.src = url;
    img.onload = () => {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('l', 'mm', 'a4');
        const w = pdf.internal.pageSize.getWidth();
        const h = pdf.internal.pageSize.getHeight();
        const ratio = img.width/img.height;
        pdf.addImage(img, 'PNG', 0, 10, w, w/ratio);
        pdf.save(name);
    };
}
