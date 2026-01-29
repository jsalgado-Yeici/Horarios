// CONFIGURACIÓN DE PISOS (Basado en tus planos)
export const MAP_DATA = {
    // === PLANTA ALTA ===
    pa: [
        { id: 'render1', name: 'Lab Render 1', type: 'lab', icon: '🖥️', x: 2, y: 5, w: 12, h: 15 },
        { id: 'render2', name: 'Lab Render 2', type: 'lab', icon: '🖥️', x: 2, y: 22, w: 12, h: 15 },
        { id: 'audio', name: 'Cabina Audio', type: 'lab', icon: '🎙️', x: 2, y: 39, w: 8, h: 10 },
        { id: 'cine', name: 'Lab Cine', type: 'lab', icon: '🎬', x: 2, y: 55, w: 12, h: 18 },

        // Biblioteca (Sin cambios)
        { id: 'biblioteca', name: 'Biblioteca', type: 'office', icon: '📚', x: 25, y: 5, w: 20, h: 45 },

        // SPLIT: Co-Working dividido en 2 zonas
        { id: 'coworking_a', name: 'Co-Work A', type: 'office', icon: '💼', x: 47, y: 5, w: 20, h: 22 },
        { id: 'coworking_b', name: 'Co-Work B', type: 'office', icon: '💼', x: 47, y: 28, w: 20, h: 22 },

        { id: 'salon4', name: 'Salón 4', type: 'classroom', icon: '🎓', x: 80, y: 5, w: 15, h: 12 },
        { id: 'salon3', name: 'Salón 3', type: 'classroom', icon: '🎓', x: 80, y: 20, w: 15, h: 12 },
        { id: 'salon2', name: 'Salón 2', type: 'classroom', icon: '🎓', x: 80, y: 35, w: 15, h: 12 },
        { id: 'salon1', name: 'Salón 1', type: 'classroom', icon: '🎓', x: 80, y: 50, w: 15, h: 12 },

        // Baile (Inactivo)
        { id: 'baile', name: 'S. Baile', type: 'office', icon: '💃', x: 78, y: 80, w: 18, h: 15 },
        { id: 'stairs_up', name: 'Subir', type: 'stairs', icon: '⬆️', x: 20, y: 80, w: 10, h: 15 }
    ],

    // === PLANTA BAJA ===
    pb: [
        // Izquierda: Idiomas (Bloque grande vertical)
        { id: 'idiomas', name: 'C. Idiomas', type: 'office', icon: '🗣️', x: 5, y: 15, w: 18, h: 45 },

        // Centro: Certificación y Arte (Bloques centrales)
        { id: 'cert', name: 'Certific.', type: 'office', icon: '📜', x: 30, y: 15, w: 18, h: 30 },
        { id: 'arte', name: 'Lab. Arte', type: 'lab', icon: '🎨', x: 52, y: 15, w: 18, h: 30 },

        // Derecha Superior: Pila de Oficinas (4)
        { id: 'admin1', name: 'Coord.', type: 'office', icon: '📋', x: 78, y: 5, w: 15, h: 10 },
        { id: 'admin2', name: 'Of. 1', type: 'office', icon: '👔', x: 78, y: 17, w: 15, h: 10 },
        { id: 'admin3', name: 'Of. 2', type: 'office', icon: '📂', x: 78, y: 29, w: 15, h: 10 },
        { id: 'admin4', name: 'Of. Yeici', type: 'office', icon: '📇', x: 78, y: 41, w: 15, h: 10 },

        // Derecha Inferior: Modelado (Debajo de oficinas, separado por pasillo)
        { id: 'modelado', name: 'L. Modelado', type: 'lab', icon: '🗿', x: 78, y: 65, w: 15, h: 25 },

        // Extras
        { id: 'juntas', name: 'Juntas', type: 'office', icon: '🤝', x: 5, y: 5, w: 18, h: 8 }, // Arriba de idiomas? o removido? Lo dejo pequeño arriba
        { id: 'stairs_down', name: 'Bajar', type: 'stairs', icon: '⬇️', x: 94, y: 5, w: 5, h: 10 } // Círculo gris top-right?
    ]
};

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

        // Icon rendering
        const iconSpan = document.createElement('span');
        iconSpan.className = 'room-icon';
        iconSpan.textContent = item.icon || '';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = item.name;

        el.appendChild(iconSpan);
        el.appendChild(nameSpan);

        // Solo permitir clic si es classroom o lab
        if (item.type === 'classroom' || item.type === 'lab') {
            el.onclick = () => onRoomClick(item);
            el.style.cursor = "pointer";
        } else {
            el.style.cursor = "default";
        }

        container.appendChild(el);
    });
}
