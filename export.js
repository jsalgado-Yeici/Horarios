// Módulo de Exportación (PDF e Imagen)

export async function exportSchedule(type) {
    const originalGrid = document.getElementById('schedule-grid');
    const template = document.getElementById('export-template');
    const placeholder = document.getElementById('export-grid-placeholder');
    const dateField = document.getElementById('export-date');
    
    // CORRECCIÓN: Verificar si el overlay existe. Si no, lo creamos al vuelo.
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center transition-opacity duration-500';
        // Creamos la estructura interna para que no falle al buscar el h2
        overlay.innerHTML = '<div class="loader mb-4"></div><h2 class="text-xl font-semibold text-gray-700 animate-pulse">Procesando...</h2>';
        document.body.appendChild(overlay);
    }

    if (!originalGrid) return alert("No hay horario para exportar.");

    // 1. Mostrar loading
    // Usamos requestAnimationFrame para asegurar que el navegador renderice el overlay antes de congelarse procesando
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        overlay.querySelector('h2').textContent = type === 'pdf' ? "Generando PDF..." : "Generando Imagen...";
    });

    try {
        // Pequeña pausa para dar tiempo a que el overlay aparezca visualmente
        await new Promise(resolve => setTimeout(resolve, 100));

        // 2. Preparar Template
        const now = new Date();
        dateField.textContent = now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        // Clonar el grid para no afectar el original
        placeholder.innerHTML = '';
        const clone = originalGrid.cloneNode(true);
        
        // LIMPIEZA: Remover botones de editar/borrar del clon
        clone.querySelectorAll('button').forEach(btn => btn.remove());
        clone.querySelectorAll('.actions').forEach(el => el.remove());
        
        // Ajustes de estilo para la captura (quitar scroll, bordes nítidos)
        clone.style.overflow = 'visible';
        clone.style.height = 'auto';
        clone.style.maxHeight = 'none';
        clone.style.border = 'none';
        clone.style.boxShadow = 'none';
        
        placeholder.appendChild(clone);

        // Hacer visible temporalmente el template (fuera de pantalla)
        template.style.opacity = '1';
        template.style.zIndex = '9999'; 

        // 3. Capturar con html2canvas
        const canvas = await window.html2canvas(template, {
            scale: 2, // Alta calidad (Retina)
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false
        });

        // 4. Exportar según tipo
        if (type === 'pdf') {
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            
            // A4 Horizontal (Landscape)
            const pdf = new jsPDF('l', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            // Ajustar imagen al PDF manteniendo proporción
            const imgProps = pdf.getImageProperties(imgData);
            const ratio = imgProps.width / imgProps.height;
            const printHeight = pdfWidth / ratio;
            
            // Si la imagen es más alta que la hoja, ajustamos por alto en vez de ancho
            if (printHeight > pdfHeight) {
                const printWidth = pdfHeight * ratio;
                pdf.addImage(imgData, 'PNG', (pdfWidth - printWidth) / 2, 0, printWidth, pdfHeight);
            } else {
                pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, printHeight);
            }
            
            pdf.save(`Horario_IAEV_${now.getTime()}.pdf`);
        } else {
            // Descargar como imagen PNG
            const link = document.createElement('a');
            link.download = `Horario_IAEV_${now.getTime()}.png`;
            link.href = canvas.toDataURL();
            link.click();
        }

    } catch (error) {
        console.error("Error exportando:", error);
        alert("Hubo un error al generar el reporte. Revisa la consola.");
    } finally {
        // 5. Limpieza final
        template.style.opacity = '0';
        template.style.zIndex = '-1';
        placeholder.innerHTML = '';
        
        // Ocultar y remover el overlay para que no estorbe después
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 500);
    }
}
