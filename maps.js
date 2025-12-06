
// CONFIGURACIÓN DE PISOS Y AULAS
// Coordenadas en porcentajes (%) para ser responsivo: top, left, width, height

export const MAP_DATA = {
    // === PLANTA ALTA (Basado en imagen rosa/verde) ===
    pa: [
        // COLUMNA IZQUIERDA (Laboratorios)
        { id: 'render1', name: 'Lab Render 1', type: 'lab', x: 2, y: 5, w: 12, h: 15 },
        { id: 'render2', name: 'Lab Render 2', type: 'lab', x: 2, y: 22, w: 12, h: 15 },
        { id: 'audio', name: 'Cabina Audio', type: 'lab', x: 2, y: 39, w: 8, h: 10 },
        { id: 'cine', name: 'Lab Cine', type: 'lab', x: 2, y: 55, w: 12, h: 18 },
        
        // CENTRO (Biblioteca y Co-Working)
        { id: 'biblioteca', name: 'Biblioteca', type: 'office', x: 25, y: 5, w: 20, h: 45 },
        { id: 'coworking', name: 'Co-Working', type: 'office', x: 47, y: 5, w: 20, h: 45 },

        // COLUMNA DERECHA (Salones)
        { id: 'salon4', name: 'Salón 4', type: 'classroom', x: 80, y: 5, w: 15, h: 12 },
        { id: 'salon3', name: 'Salón 3', type: 'classroom', x: 80, y: 20, w: 15, h: 12 },
        { id: 'salon2', name: 'Salón 2', type: 'classroom', x: 80, y: 35, w: 15, h: 12 },
        { id: 'salon1', name: 'Salón 1', type: 'classroom', x: 80, y: 50, w: 15, h: 12 },
        
        // EXTAS
        { id: 'baile', name: 'Salón Baile', type: 'classroom', x: 78, y: 80, w: 18, h: 15 },
        { id: 'stairs_up', name: 'Escaleras', type: 'stairs', x: 2, y: 80, w: 12, h: 15 },
        
        // OFICINAS (Visuales, no clickeables por defecto)
        { id: 'dh', name: 'Des. Humano', type: 'office', x: 75, y: 65, w: 8, h: 12 },
        { id: 'coord', name: 'Coordinación', type: 'office', x: 85, y: 65, w: 8, h: 10 }
    ],

    // === PLANTA BAJA (Basado en imagen azul/verde) ===
    pb: [
        // IZQUIERDA (Idiomas)
        { id: 'idiomas', name: 'Coord. Idiomas', type: 'office', x: 2, y: 5, w: 15, h: 12 },
        { id: 'juntas', name: 'Sala Juntas', type: 'office', x: 2, y: 20, w: 15, h: 15 },
        { id: 'cubiculos', name: 'Cubículos', type: 'office', x: 2, y: 40, w: 12, h: 10 },
        { id: 'psico', name: 'Psicólogo', type: 'office', x: 2, y: 55, w: 8, h: 5 },
        { id: 'medico', name: 'Médico', type: 'office', x: 2, y: 62, w: 8, h: 5 },
        { id: 'lactancia', name: 'Maternidad', type: 'office', x: 12, y: 70, w: 15, h: 10 },

        // CENTRO
        { id: 'cert', name: 'Centro Cert.', type: 'lab', x: 25, y: 5, w: 18, h: 45 },
        { id: 'arte', name: 'Lab. Arte', type: 'lab', x: 45, y: 5, w: 18, h: 45 },

        // DERECHA (Oficinas y Modelado)
        { id: 'oficinas_div', name: 'Oficinas Admin', type: 'office', x: 70, y: 5, w: 25, h: 40 }, // Bloque oficinas simplificado
        { id: 'modelado', name: 'Lab. Modelado', type: 'lab', x: 75, y: 55, w: 15, h: 20 },
        
        // OTROS
        { id: 'maestros', name: 'Sala Maestros', type: 'office', x: 5, y: 85, w: 15, h: 12 },
        { id: 'stairs_down', name: 'Escaleras', type: 'stairs', x: 5, y: 70, w: 10, h: 12 }
    ]
};

// Función para dibujar el mapa
export function renderMap(floorId, container, scheduleData, onRoomClick) {
    container.innerHTML = '';
    const items = MAP_DATA[floorId] || [];

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = `map-room ${item.type}`;
        el.style.left = `${item.x}%`;
        el.style.top = `${item.y}%`;
        el.style.width = `${item.w}%`;
        el.style.height = `${item.h}%`;
        el.textContent = item.name;

        // Si es un salón activo, permitir interacción
        if (item.type === 'classroom' || item.type === 'lab') {
            el.onclick = () => onRoomClick(item);
            
            // Verificar si está ocupado AHORA MISMO
            // (Esta lógica requiere pasar la hora actual al renderMap, por simplicidad solo marcamos estilo)
        }

        container.appendChild(el);
    });
}
