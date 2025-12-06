// export.js - Módulo de Exportación Individual y Masiva

// HELPERS
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
    overlay.style.opacity = '1';
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

// EXPORTACIÓN INDIVIDUAL (Lo que ves en pantalla)
export async function exportSchedule(type) {
    const originalGrid = document.getElementById('schedule-grid');
    if (!originalGrid) return alert("No hay horario para exportar.");
    
    updateOverlay(type === 'pdf' ? "Generando PDF..." : "Generando Imagen...");
    
    try {
        await new Promise(r => setTimeout(r, 100)); // UI refresh
        const blob = await generateImageBlob(originalGrid, "Horario Actual");
        
        if (type === 'pdf') savePdf(blob, "Horario_Actual.pdf");
        else window.saveAs(blob, "Horario_Actual.png");
        
    } catch (e) { console.error(e); alert("Error al exportar."); } 
    finally { hideOverlay(); }
}

// EXPORTACIÓN MASIVA (ZIP)
export async function exportAllSchedules(state, renderFunction) {
    if(!state.groups.length && !state.teachers.length) return alert("No hay datos para exportar.");
    if(!window.JSZip) return alert("Error: Librería JSZip no cargada.");

    updateOverlay("Iniciando exportación masiva...");
    const zip = new JSZip();
    const folderGroups = zip.folder("Grupos");
    const folderTeachers = zip.folder("Docentes");

    // Contenedor temporal fuera de pantalla
    const tempContainer = document.createElement('div');
    tempContainer.style.width = "1200px"; 
    tempContainer.style.position = "absolute";
    tempContainer.style.left = "-9999px";
    tempContainer.className = "schedule-grid bg-white"; // Estilos base
    document.body.appendChild(tempContainer);

    try {
        // 1. Exportar Grupos
        for (let i = 0; i < state.groups.length; i++) {
            const g = state.groups[i];
            updateOverlay(`Procesando Grupo (${i+1}/${state.groups.length}): ${g.name}`);
            
            // Renderizar en contenedor oculto usando la función de script.js
            renderFunction(tempContainer, { groupId: g.id });
            
            // Generar Blob
            const blob = await generateImageBlob(tempContainer, `Horario: ${g.name}`);
            folderGroups.file(`${g.name}.png`, blob);
        }

        // 2. Exportar Docentes
        for (let i = 0; i < state.teachers.length; i++) {
            const t = state.teachers[i];
            updateOverlay(`Procesando Docente (${i+1}/${state.teachers.length}): ${t.name}`);
            
            renderFunction(tempContainer, { teacherId: t.id });
            const blob = await generateImageBlob(tempContainer, `Horario: ${t.name}`);
            folderTeachers.file(`${t.name}.png`, blob);
        }

        updateOverlay("Comprimiendo archivos...");
        const content = await zip.generateAsync({type:"blob"});
        window.saveAs(content, "Horarios_Completos_IAEV.zip");

    } catch (e) {
        console.error(e);
        alert("Hubo un error en la exportación masiva.");
    } finally {
        document.body.removeChild(tempContainer);
        hideOverlay();
    }
}

// LÓGICA COMÚN DE CAPTURA
async function generateImageBlob(element, titleText) {
    const template = document.getElementById('export-template');
    const placeholder = document.getElementById('export-grid-placeholder');
    const title = document.getElementById('export-subtitle'); // Usamos el subtítulo para nombre dinámico
    const dateField = document.getElementById('export-date');

    // Preparar template
    title.textContent = titleText || "Ingeniería en Animación";
    dateField.textContent = new Date().toLocaleDateString();
    
    placeholder.innerHTML = '';
    const clone = element.cloneNode(true);
    
    // Limpieza visual
    clone.style.border = 'none';
    clone.style.boxShadow = 'none';
    clone.querySelectorAll('.actions, button').forEach(e => e.remove());
    
    placeholder.appendChild(clone);
    
    // Mostrar template para captura
    template.style.opacity = '1';
    template.style.zIndex = '9999';

    const canvas = await window.html2canvas(template, {
        scale: 1.5, // Calidad media-alta para velocidad
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
    });

    // Ocultar template
    template.style.opacity = '0';
    template.style.zIndex = '-1';
    placeholder.innerHTML = '';

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
        const printH = w / ratio;
        
        if (printH > h) { // Si es muy alto, ajustar por alto
             const printW = h * ratio;
             pdf.addImage(img, 'PNG', (w - printW)/2, 0, printW, h);
        } else {
             pdf.addImage(img, 'PNG', 0, 10, w, printH);
        }
        pdf.save(filename);
        URL.revokeObjectURL(url);
    };
}
