// MAP_DATA: Definición de las áreas del mapa (x, y, w, h en porcentajes)
export const MAP_DATA = {
    // === PLANTA ALTA ===
    pa: [
        // IZQUIERDA (Laboratorios)
        { id: 'render1', name: 'Lab Render 1', type: 'lab', x: 2, y: 5, w: 12, h: 15 },
        { id: 'render2', name: 'Lab Render 2', type: 'lab', x: 2, y: 22, w: 12, h: 15 },
        { id: 'audio', name: 'Cabina Audio', type: 'lab', x: 2, y: 39, w: 8, h: 10 },
        { id: 'almacen_audio', name: 'Almacén Audio', type: 'office', x: 2, y: 50, w: 8, h: 8 },
        { id: 'cine', name: 'Lab Cine', type: 'lab', x: 2, y: 60, w: 12, h: 18 },
        
        // CENTRO
        { id: 'biblioteca', name: 'Biblioteca', type: 'office', x: 25, y: 5, w: 20, h: 45 },
        { id: 'coworking', name: 'Co-Working', type: 'office', x: 47, y: 5, w: 20, h: 45 },

        // DERECHA (Salones)
        { id: 'salon4', name: 'Salón 4', type: 'classroom', x: 80, y: 5, w: 15, h: 12 },
        { id: 'salon3', name: 'Salón 3', type: 'classroom', x: 80, y: 20, w: 15, h: 12 },
        { id: 'salon2', name: 'Salón 2', type: 'classroom', x: 80, y: 35, w: 15, h: 12 },
        { id: 'salon1', name: 'Salón 1', type: 'classroom', x: 80, y: 50, w: 15, h: 12 },
        
        // EXTRAS DERECHA ABAJO
        { id: 'dh', name: 'Des. Humano', type: 'office', x: 75, y: 65, w: 8, h: 12 },
        { id: 'coord_stem', name: 'Coord. STEM', type: 'office', x: 85, y: 65, w: 8, h: 10 },
        { id: 'impresiones', name: 'Impresiones', type: 'office', x: 85, y: 76, w: 8, h: 10 },
        { id: 'baile', name: 'Salón Baile', type: 'classroom', x: 78, y: 88, w: 18, h: 10 },
        
        // ESCALERAS
        { id: 'stairs_up', name: 'Escaleras', type: 'stairs', x: 20, y: 80, w: 10, h: 15 }
    ],

    // === PLANTA BAJA ===
    pb: [
        // IZQUIERDA SUPERIOR (Idiomas)
        { id: 'idiomas', name: 'Coord. Idiomas', type: 'office', x: 10, y: 15, w: 12, h: 10 },
        { id: 'juntas', name: 'Sala Juntas', type: 'office', x: 10, y: 27, w: 12, h: 12 },
        { id: 'cubiculos', name: 'Cubículos', type: 'office', x: 5, y: 42, w: 15, h: 8 },
        
        // IZQUIERDA INFERIOR (Salud)
        { id: 'psico', name: 'Psicólogo', type: 'office', x: 2, y: 55, w: 6, h: 5 },
        { id: 'medico', name: 'Médico', type: 'office', x: 2, y: 62, w: 6, h: 5 },
        { id: 'lactancia', name: 'Maternidad', type: 'office', x: 15, y: 65, w: 15, h: 10 },

        // CENTRO
        { id: 'cert', name: 'Centro Cert.', type: 'lab', x: 30, y: 15, w: 18, h: 40 },
        { id: 'arte', name: 'Lab. Arte', type: 'lab', x: 50, y: 15, w: 18, h: 40 },

        // DERECHA (Oficinas)
        { id: 'of_elia', name: 'Of. Elia', type: 'office', x: 72, y: 15, w: 6, h: 6 },
        { id: 'of_german', name: 'Of. Germán', type: 'office', x: 72, y: 23, w: 6, h: 6 },
        { id: 'of_varios', name: 'Of. Varios', type: 'office', x: 72, y: 31, w: 6, h: 10 },
        { id: 'of_mario', name: 'Dir. IAEV', type: 'office', x: 72, y: 43, w: 6, h: 6 },
        { id: 'interpretes', name: 'Intérpretes', type: 'office', x: 85, y: 15, w: 8, h: 25 },

        // DERECHA ABAJO (Modelado y Maestros)
        { id: 'modelado', name: 'Lab. Modelado', type: 'lab', x: 80, y: 55, w: 15, h: 18 },
        { id: 'maestros', name: 'Sala Maestros', type: 'office', x: 20, y: 82, w: 12, h: 12 },
        
        // ESCALERAS
        { id: 'stairs_down', name: 'Escaleras', type: 'stairs', x: 20, y: 70, w: 10, h: 10 }
    ]
};

// Función para renderizar el mapa
export function renderMap(floorId, container, scheduleData, onRoomClick) {
    container.innerHTML = '';
    const items = MAP_DATA[floorId] || [];

    // Filtramos las clases que están ocurriendo AHORA MISMO (Demo visual)
    const now = new Date();
    const currentHour = now.getHours();
    // Aquí podrías agregar lógica para saber qué día es hoy en texto ("Lunes", etc.)

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = `map-room ${item.type}`;
        el.style.left = `${item.x}%`;
        el.style.top = `${item.y}%`;
        el.style.width = `${item.w}%`;
        el.style.height = `${item.h}%`;
        el.textContent = item.name;

        // Verificar si está ocupado (Lógica simple basada en datos pasados)
        // Buscamos si hay alguna clase en este salón en este momento (hora actual)
        // Nota: Esto requiere que 'scheduleData' tenga todas las clases cargadas
        // const isOccupied = scheduleData.some(c => c.classroomId === item.id && c.startTime <= currentHour && (c.startTime + c.duration) > currentHour);
        // if (isOccupied) el.classList.add('occupied');

        // Eventos solo para aulas interactivas
        if (item.type === 'classroom' || item.type === 'lab') {
            el.onclick = () => onRoomClick(item);
        }

        container.appendChild(el);
    });
}
