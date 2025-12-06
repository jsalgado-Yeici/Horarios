// Módulo de Exportación (PDF e Imagen)

export async function exportSchedule(type) {
    const originalGrid = document.getElementById('schedule-grid');
    const template = document.getElementById('export-template');
    const placeholder = document.getElementById('export-grid-placeholder');
    const dateField = document.getElementById('export-date');
    const overlay = document.getElementById('loading-overlay');

    if (!originalGrid) return alert("No hay horario para exportar.");

    // 1. Mostrar loading
    overlay.style.opacity = '1';
    overlay.querySelector('h2').textContent = "Generando Documento...";
    document.body.appendChild(overlay); // Asegurar que esté visible

    try {
        // 2. Preparar Template
        const now = new Date();
        dateField.textContent = now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        // Clonar el grid para no afectar el original
        placeholder.innerHTML = '';
        const clone = originalGrid.cloneNode(true);
        
        // LIMPIEZA: Remover botones de editar/borrar del clon
        clone.querySelectorAll('button').forEach(btn => btn.remove());
        clone.querySelectorAll('.actions').forEach(el => el.remove());
        
        // Ajustes de estilo para impresión (quitar scroll, bordes nítidos)
        clone.style.overflow = 'visible';
        clone.style.height = 'auto';
        clone.style.maxHeight = 'none';
        clone.style.border = 'none';
        clone.style.boxShadow = 'none';
        
        placeholder.appendChild(clone);

        // Hacer visible temporalmente el template (fuera de pantalla) para que html2canvas pueda leerlo
        template.style.opacity = '1';
        template.style.zIndex = '9999'; 
        // Nota: z-index -1 a veces falla con html2canvas, mejor lo ponemos encima con fondo blanco pero instantaneo

        // 3. Capturar con html2canvas
        const canvas = await window.html2canvas(template, {
            scale: 2, // Alta calidad
            useCORS: true,
            backgroundColor: '#ffffff'
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
            
            pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, printHeight);
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
        alert("Hubo un error al generar el reporte.");
    } finally {
        // 5. Limpieza final
        template.style.opacity = '0';
        template.style.zIndex = '-1';
        placeholder.innerHTML = '';
        
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 500);
    }
}
