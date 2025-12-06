// export.js - Módulo de Exportación Robusto

// --- HELPERS DE UI ---
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
    const overlay = createOverlay();
    // Forzamos un reflow para asegurar que se muestre
    requestAnimationFrame(() => overlay.style.opacity = '1');
    const txt = overlay.querySelector('#loading-text') || overlay.querySelector('h2');
    if(txt) txt.textContent = msg;
}

function hideOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if(overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 500);
    }
}

// --- EXPORTACIÓN INDIVIDUAL (Lo que ves en pantalla) ---
export async function exportSchedule(type) {
    const originalGrid = document.getElementById('schedule-grid');
    if (!originalGrid || originalGrid.children.length === 0) return alert("No hay horario visible para exportar.");
    
    updateOverlay("Preparando documento...");

    try {
        // Esperamos un momento para que la UI respire
        await new Promise(r => setTimeout(r, 200)); 
        
        // Clonamos el grid actual para la foto
        const clone = originalGrid.cloneNode(true);
        // Limpiamos botones del clon
        clone.querySelectorAll('button, .actions').forEach(el => el.remove());
        // Forzamos estilos para que se vea completo
        clone.style.height = 'auto';
        clone.style.overflow = 'visible';
        clone.style.maxHeight = 'none';

        const blob = await generateImageBlob(clone, "Horario Actual", "Vista Previa");
        
        if (type === 'pdf') savePdf(blob, "Horario_Vista_Actual.pdf");
        else window.saveAs(blob, "Horario_Vista_Actual.png");
        
    } catch (e) {
        console.error(e);
        alert("Error al exportar. Revisa la consola.");
    } finally {
        hideOverlay();
    }
}

// --- EXPORTACIÓN MASIVA (ZIP) ---
export async function exportAllSchedules(state, renderFunction) {
    if(!state.groups.length && !state.teachers.length) return alert("No hay datos para exportar.");
    if(!window.JSZip) return alert("Error: Librería JSZip no cargada.");

    // 1. Pedir el Periodo para los nombres de archivo
    const periodoRaw = prompt("Ingresa el nombre del periodo para los archivos:", "Enero-Abril2026");
    if(!periodoRaw) return; // Cancelado por usuario
    const periodo = periodoRaw.replace(/\s+/g, ''); // Quitamos espacios para el nombre de archivo (Opcional)

    updateOverlay("Iniciando motor de exportación...");
    const zip = new JSZip();
    const folderGroups = zip.folder("Grupos");
    const folderTeachers = zip.folder("Docentes");

    // Usamos el template que ya existe en el HTML
    const template = document.getElementById('export-template');
    const placeholder = document.getElementById('export-grid-placeholder');
    const title = document.getElementById('export-subtitle');
    const dateField = document.getElementById('export-date');

    // Configurar template para captura
    dateField.textContent = new Date().toLocaleDateString();
    template.style.position = 'fixed';
    template.style.top = '0';
    template.style.left = '0'; // Lo ponemos visible (pero tapado por el overlay) para que html2canvas no falle
    template.style.zIndex = '50'; // Debajo del overlay (100) pero encima del resto
    template.style.opacity = '1';

    try {
        // --- PROCESAR GRUPOS ---
        for (let i = 0; i < state.groups.length; i++) {
            const g = state.groups[i];
            updateOverlay(`Generando Grupo (${i+1}/${state.groups.length}): ${g.name}`);
            
            // 1. Limpiar contenedor
            placeholder.innerHTML = '';
            
            // 2. Crear un div limpio para renderizar
            const tempGrid = document.createElement('div');
            tempGrid.className = 'schedule-grid bg-white';
            tempGrid.style.border = 'none'; // Estilos limpios
            
            // 3. LLAMAR A LA FUNCIÓN DE SCRIPT.JS PARA DIBUJAR EL HORARIO
            // Esto genera las cajas de colores desde cero
            renderFunction(tempGrid, { groupId: g.id });
            
            // 4. Limpiar botones del grid generado
            tempGrid.querySelectorAll('button').forEach(b => b.remove());
            
            // 5. Pegarlo en el template
            placeholder.appendChild(tempGrid);
            
            // 6. Actualizar Título del Template
            title.textContent = `Horario Grupo: ${g.name}`;

            // 7. Esperar a que el navegador dibuje (Crucial)
            await new Promise(r => setTimeout(r, 150)); 

            // 8. FOTO
            const canvas = await window.html2canvas(template, { scale: 1.5, useCORS: true, logging: false });
            const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
            
            // 9. NOMBRE DEL ARCHIVO: "IAEV-41_Cuatri8_Enero-Abril2026.png"
            const filename = `${g.name}_Cuatri${g.trimester}_${periodo}.png`;
            folderGroups.file(filename, blob);
        }

        // --- PROCESAR DOCENTES ---
        for (let i = 0; i < state.teachers.length; i++) {
            const t = state.teachers[i];
            updateOverlay(`Generando Docente (${i+1}/${state.teachers.length}): ${t.name}`);
            
            placeholder.innerHTML = '';
            const tempGrid = document.createElement('div');
            tempGrid.className = 'schedule-grid bg-white';
            
            renderFunction(tempGrid, { teacherId: t.id });
            
            tempGrid.querySelectorAll('button').forEach(b => b.remove());
            placeholder.appendChild(tempGrid);
            
            title.textContent = `Horario Docente: ${t.name}`;
            await new Promise(r => setTimeout(r, 150));

            const canvas = await window.html2canvas(template, { scale: 1.5, useCORS: true, logging: false });
            const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
            
            // NOMBRE DEL ARCHIVO: "ProfeJuan_Enero-Abril2026.png"
            const saneName = t.name.replace(/\s+/g, '');
            const filename = `${saneName}_${periodo}.png`;
            folderTeachers.file(filename, blob);
        }

        updateOverlay("Comprimiendo ZIP...");
        const content = await zip.generateAsync({type:"blob"});
        window.saveAs(content, `Horarios_IAEV_${periodo}.zip`);

    } catch (e) {
        console.error(e);
        alert("Hubo un error en la generación masiva. Revisa la consola (F12).");
    } finally {
        // Restaurar estado
        template.style.opacity = '0';
        template.style.zIndex = '-1';
        placeholder.innerHTML = '';
        hideOverlay();
    }
}

// --- UTILIDAD INTERNA PARA SINGLE EXPORT ---
async function generateImageBlob(contentNode, titleText, subtitleText) {
    const template = document.getElementById('export-template');
    const placeholder = document.getElementById('export-grid-placeholder');
    const title = document.querySelector('#export-template h1');
    const subtitle = document.getElementById('export-subtitle');
    
    // Configurar
    placeholder.innerHTML = '';
    placeholder.appendChild(contentNode);
    if(titleText) title.textContent = titleText;
    if(subtitleText) subtitle.textContent = subtitleText;

    // Mostrar
    template.style.opacity = '1';
    template.style.zIndex = '9999';

    const canvas = await window.html2canvas(template, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    
    // Ocultar
    template.style.opacity = '0';
    template.style.zIndex = '-1';
    placeholder.innerHTML = '';
    
    // Resetear título por si acaso
    title.textContent = "Horario Académico"; 

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

function savePdf(imgBlob, filename) {
    const url = URL.createObjectURL(imgBlob);
    const img = new Image();
    img.src = url;
    img.onload = () => {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('l', 'mm', 'a4');
        const w = pdf.internal.pageSize.getWidth();
        const h = pdf.internal.pageSize.getHeight();
        const ratio = img.width / img.height;
        
        let printW = w;
        let printH = w / ratio;
        
        if (printH > h) {
             printH = h;
             printW = h * ratio;
        }
        
        pdf.addImage(img, 'PNG', (w - printW)/2, (h-printH)/2, printW, printH);
        pdf.save(filename);
        URL.revokeObjectURL(url);
    };
}
