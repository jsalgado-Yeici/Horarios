import { state } from './state.js';
import { addDoc, updateDoc, doc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { cols } from './state.js'; // Assuming cols provides collection refs including 'groups'

export function initStudents() {
    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) {
        console.warn('Elements for student upload not found. Skipping initStudents.');
        return;
    }

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
    btnSave.addEventListener('click', async () => {
        if (!state.students || state.students.length === 0) {
            alert('No hay alumnos cargados para guardar.');
            return;
        }

        const studentsByGroup = {};

        // 1. Agrupar alumnos por grupo
        state.students.forEach(s => {
            if (s.grupo && s.grupo !== "Desconocido") {
                const standardizedName = s.grupo.trim().toUpperCase().replace(/\s+/g, '-');
                if (!studentsByGroup[standardizedName]) {
                    studentsByGroup[standardizedName] = [];
                }

                // Mapear al formato que espera TestListasv2
                studentsByGroup[standardizedName].push({
                    id: s.matricula, // Usamos matrícula como ID estable
                    name: s.nombre,
                    matricula: s.matricula,
                    // Campos opcionales para TestListasv2
                    team: null,
                    isRepeating: false
                });
            }
        });

        const groupsToProcess = Object.keys(studentsByGroup);
        if (groupsToProcess.length > 0) {
            const confirmCreate = confirm(`Se van a actualizar/crear ${groupsToProcess.length} grupos con sus alumnos. ¿Continuar?`);
            if (confirmCreate) {
                try {
                    let createdCount = 0;
                    let updatedCount = 0;

                    for (const groupName of groupsToProcess) {
                        // Buscar si el grupo ya existe en el state (lectura optimizada)
                        // AVISO: Idealmente deberíamos buscar en Firestore para estar 100% seguros, 
                        // pero usamos state.groups que se sincroniza al inicio.
                        const existingGroup = state.groups.find(g => g.name.trim().toUpperCase() === groupName);

                        if (existingGroup) {
                            // Actualizar grupo existente
                            await updateDoc(doc(cols.groups, existingGroup.id), {
                                students: studentsByGroup[groupName]
                            });
                            updatedCount++;
                        } else {
                            // Crear nuevo grupo
                            await addDoc(cols.groups, {
                                name: groupName,
                                trimester: 1, // Default
                                students: studentsByGroup[groupName],
                                classDays: [], // Campos extra para compatibilidad
                                evaluationTypes: { // Estructura por defecto para TestListasv2
                                    partial1: [{ id: crypto.randomUUID(), name: 'General', weight: 100 }],
                                    partial2: [{ id: crypto.randomUUID(), name: 'General', weight: 100 }]
                                }
                            });
                            createdCount++;
                        }
                    }

                    alert(`Proceso finalizado:\n- Grupos actualizados: ${updatedCount}\n- Grupos nuevos creados: ${createdCount}`);
                } catch (error) {
                    console.error("Error guardando alumnos en Firebase:", error);
                    alert("Hubo un error al guardar los datos en la nube.");
                }
            }
        } else {
            alert('No se encontraron grupos válidos en la lista.');
        }
    });
}

// Función para recargar alumnos desde los grupos cargados (Persistencia)
export function loadStudentsFromGroups(groups) {
    if (!groups) return;

    const allStudents = [];
    groups.forEach(g => {
        if (g.students && Array.isArray(g.students)) {
            g.students.forEach(s => {
                // Reconstruir objeto alumno plano para la UI
                allStudents.push({
                    matricula: s.matricula || s.id,
                    nombre: s.name,
                    grupo: g.name // Asignar grupo actual
                });
            });
        }
    });

    // Actualizar estado si encontramos alumnos
    if (allStudents.length > 0) {
        state.students = allStudents;
        // Actualizar contador visual si estamos en la pestaña
        const countSpan = document.getElementById('student-count');
        if (countSpan) countSpan.innerText = allStudents.length;

        // Mostrar alerta discreta o log
        console.log(`[Persistencia] ${allStudents.length} alumnos cargados desde grupos.`);
    }
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

    // Improve text concatenation to try to preserve some separation
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // Join with double spaces to ensure we don't accidentally merge words across items
        const pageText = textContent.items.map(item => item.str).join('  ');
        fullText += " " + pageText;
    }

    console.log("PDF Raw Text Preview:", fullText.substring(0, 500));

    if (!fullText || fullText.trim().length === 0) {
        alert("El PDF no contiene texto legible. Es probable que sea una imagen o escaneo. Por favor use un archivo Excel o un PDF con texto seleccionable.");
        return [];
    }

    const students = [];

    // STRATEGY: Find all matriculas (6-10 digits) and split the text based on them.
    // We assume the structure: ... Index Matricula Name ... NextIndex NextMatricula ...
    const matriculaRegex = /\b(\d{6,10})\b/g;
    const matches = [...fullText.matchAll(matriculaRegex)];

    console.log(`Found ${matches.length} potential matriculas.`);

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const matricula = match[1]; // The captured digits

        // Define the text range for this student:
        // From the end of this matricula to the start of the next matricula (or end of text)
        const startIdx = match.index + match[0].length;
        const endIdx = (i < matches.length - 1) ? matches[i + 1].index : fullText.length;

        // Extract raw data segment for this student
        let segment = fullText.substring(startIdx, endIdx).trim();

        // CLEANUP: 
        // 1. Remove the "Next Index" number that might be at the end of the segment (e.g. "... IAEV-42 2")
        //    Looking for a single or double digit number at the very end of the string.
        segment = segment.replace(/\s+\d{1,3}\s*$/, '');

        // 2. Extract Group (e.g. "IAEV-42", "IAEV 42", "GPO 1")
        //    Looking for typical group patterns at the end of the name string
        let grupo = "Desconocido";
        const groupRegex = /\b(IAEV[-\s]?(?:[A-Z]{1,4}[-\s]?)?\d+|GPO\s?\d+|[A-Z]{2,5}-\d{2,3})\b/i;
        const groupMatch = segment.match(groupRegex);

        if (groupMatch) {
            grupo = groupMatch[0].replace(/\s/g, '-').toUpperCase(); // Normalize: IAEV 42 -> IAEV-42
            // Remove group from the name string to clean it up
            segment = segment.replace(groupMatch[0], '');
        }

        // 3. Extract Generation (e.g. "29BIS", "26INM")
        let generacion = "N/A";
        // Matches: 2 digits followed by 2-4 uppercase letters (e.g. 29BIS, 26INM)
        const genRegex = /\b(\d{2}[A-Z]{2,4})\b/;
        const genMatch = segment.match(genRegex);

        if (genMatch) {
            generacion = genMatch[0];
            segment = segment.replace(generacion, ''); // Remove from name
        }

        // 4. Clean up Name
        // Remove common words that might remain, including the stray "IAEV" at the end
        let nombre = segment
            .replace(/\bIAEV\b/g, '') // Explicitly remove stray IAEV
            .replace(/UNIVERSIDAD POLITECNICA DE SANTA ROSA JAUREGUI/gi, '') // Remove full university name
            .replace(/INGENIERIA EN [A-Z\s]+/gi, '') // Remove degree names like "INGENIERIA EN SOFTWARE"
            .replace(/LICENCIATURA EN [A-Z\s]+/gi, '') // Remove degree names
            .replace(/Página\s+\d+/gi, '') // Remove "Página X"
            .replace(/[^\w\sÁÉÍÓÚÑáéíóúñ]/g, '') // Remove weird chars
            .replace(/\s+/g, ' ') // Collapse spaces
            .trim();

        if (nombre.length > 3) {
            students.push({
                matricula: matricula,
                nombre: nombre,
                grupo: grupo,
                generacion: generacion
            });
        }
    }

    console.log(`Extracted ${students.length} students from PDF via stream parsing.`);
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
