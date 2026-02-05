import { state } from './state.js';

export function initStudents() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('student-file-input');
    const btnSave = document.getElementById('btn-save-students');
    const btnDownload = document.getElementById('btn-download-students');

    // Drag and Drop events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('bg-indigo-50', 'border-indigo-400');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('bg-indigo-50', 'border-indigo-400');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('bg-indigo-50', 'border-indigo-400');
        const files = e.dataTransfer.files;
        if (files.length > 0) processFile(files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) processFile(e.target.files[0]);
    });

    btnDownload.addEventListener('click', downloadStudentsJSON);
    btnSave.addEventListener('click', () => {
        // Here we could persist to Firestore if needed, for now we just keep it in state
        alert('Datos guardados en memoria del sistema.');
    });
}

async function processFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();

    try {
        let extractedData = [];
        if (extension === 'xlsx' || extension === 'xls') {
            extractedData = await processExcel(file);
        } else if (extension === 'pdf') {
            extractedData = await processPDF(file);
        } else {
            alert('Formato no soportado. Usa Excel (.xlsx, .xls) o PDF.');
            return;
        }

        if (extractedData.length > 0) {
            state.students = extractedData;
            renderStudentPreview(extractedData);
            document.getElementById('students-preview-container').classList.remove('hidden');
        } else {
            alert('No se pudieron extraer alumnos. Verifica el formato del archivo.');
        }

    } catch (error) {
        console.error('Error procesando archivo:', error);
        alert('Hubo un error al procesar el archivo.');
    }
}

function processExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Array of arrays

            const students = parseRawData(json);
            resolve(students);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

async function processPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + "\n";
    }

    // Heuristic parsing for PDF text (very basic implementation)
    // Looking for patterns like: 123456 LastName FirstName Group
    // This is strictly best-effort as PDF structures vary wildly.
    const lines = fullText.split('\n');
    const students = [];

    // Regex for typical matricula (digits, 5-8 chars)
    const matriculaRegex = /\b\d{5,8}\b/;

    // Simple heuristic: if line has numbers resembling matricula, treat as student line
    // This will likely need refinement based on real docs
    lines.forEach(line => {
        const match = line.match(matriculaRegex);
        if (match) {
            const matricula = match[0];
            // Name often near matricula, cleaning up digits
            let nameCandidate = line.replace(matricula, '').trim();
            // Basic cleanup of common noise
            nameCandidate = nameCandidate.replace(/[^\w\sÁÉÍÓÚÑáéíóúñ]/g, '');

            if (nameCandidate.length > 5) {
                students.push({
                    matricula: matricula,
                    nombre: nameCandidate,
                    grupo: "Desconocido (PDF)", // Group is hard to extract reliably without strict format
                    generacion: "N/A"
                });
            }
        }
    });

    return students;
}

function parseRawData(rows) {
    // Basic heuristic for Excel: find header row with keywords
    let headerRowIndex = -1;
    let map = { matricula: -1, nombre: -1, grupo: -1, lista: -1 };

    for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const row = rows[i].map(c => String(c).toLowerCase());
        if (row.some(c => c.includes('matricula') || c.includes('id'))) {
            headerRowIndex = i;
            row.forEach((cell, idx) => {
                if (cell.includes('matricula') || cell.includes('id')) map.matricula = idx;
                else if (cell.includes('nombre') || cell.includes('alumno')) map.nombre = idx;
                else if (cell.includes('grupo') || cell.includes('gpo')) map.grupo = idx;
                else if (cell.includes('lista') || cell.includes('no.')) map.lista = idx;
            });
            break;
        }
    }

    const students = [];
    if (headerRowIndex !== -1) {
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const matricula = map.matricula > -1 ? row[map.matricula] : '';
            const nombre = map.nombre > -1 ? row[map.nombre] : '';
            const grupo = map.grupo > -1 ? row[map.grupo] : '';

            if (matricula && nombre) {
                students.push({
                    matricula, nombre, grupo,
                    generacion: "N/A" // Placeholder
                });
            }
        }
    } else {
        // Fallback: assume column 0 is ID, 1 is Name if no headers found
        rows.forEach(row => {
            if (row.length >= 2 && /\d/.test(row[0])) { // If col 0 has digits
                students.push({
                    matricula: row[0],
                    nombre: row[1],
                    grupo: row[2] || 'Sin Grupo',
                    generacion: "N/A"
                });
            }
        });
    }
    return students;
}

function renderStudentPreview(students) {
    const tbody = document.getElementById('students-table-body');
    const countSpan = document.getElementById('student-count');
    tbody.innerHTML = '';
    countSpan.textContent = students.length;

    // Show first 100 for performance
    students.slice(0, 100).forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${s.matricula}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${s.nombre}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${s.grupo}</td>
        `;
        tbody.appendChild(tr);
    });
}

function downloadStudentsJSON() {
    if (!state.students || state.students.length === 0) {
        alert('No hay alumnos para descargar');
        return;
    }
    const dataStr = JSON.stringify(state.students, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    saveAs(blob, "alumnos_data_light.json");
}
