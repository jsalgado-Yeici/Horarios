// CONFIGURACIÓN DE PISOS (Basado en tus planos)
export const MAP_DATA = {
    // === PLANTA ALTA ===
    pa: [
        { id: 'render1', name: 'Lab Render 1', type: 'lab', x: 2, y: 5, w: 12, h: 15 },
        { id: 'render2', name: 'Lab Render 2', type: 'lab', x: 2, y: 22, w: 12, h: 15 },
        { id: 'audio', name: 'Cabina Audio', type: 'lab', x: 2, y: 39, w: 8, h: 10 },
        { id: 'cine', name: 'Lab Cine', type: 'lab', x: 2, y: 55, w: 12, h: 18 },
        
        { id: 'biblioteca', name: 'Biblioteca', type: 'office', x: 25, y: 5, w: 20, h: 45 },
        { id: 'coworking', name: 'Co-Working', type: 'office', x: 47, y: 5, w: 20, h: 45 },

        { id: 'salon4', name: 'Salón 4', type: 'classroom', x: 80, y: 5, w: 15, h: 12 },
        { id: 'salon3', name: 'Salón 3', type: 'classroom', x: 80, y: 20, w: 15, h: 12 },
        { id: 'salon2', name: 'Salón 2', type: 'classroom', x: 80, y: 35, w: 15, h: 12 },
        { id: 'salon1', name: 'Salón 1', type: 'classroom', x: 80, y: 50, w: 15, h: 12 },
        
        { id: 'baile', name: 'Salón Baile', type: 'classroom', x: 78, y: 80, w: 18, h: 15 },
        { id: 'stairs_up', name: 'Escaleras', type: 'stairs', x: 20, y: 80, w: 10, h: 15 }
    ],

    // === PLANTA BAJA ===
    pb: [
        { id: 'idiomas', name: 'Coord. Idiomas', type: 'office', x: 10, y: 5, w: 15, h: 12 },
        { id: 'juntas', name: 'Sala Juntas', type: 'office', x: 10, y: 20, w: 15, h: 15 },
        
        { id: 'cert', name: 'Centro Cert.', type: 'lab', x: 30, y: 5, w: 18, h: 45 },
        { id: 'arte', name: 'Lab. Arte', type: 'lab', x: 50, y: 5, w: 18, h: 45 },

        { id: 'oficinas_div', name: 'Oficinas Admin', type: 'office', x: 75, y: 5, w: 20, h: 40 },
        { id: 'modelado', name: 'Lab. Modelado', type: 'lab', x: 80, y: 55, w: 15, h: 20 },
        
        { id: 'stairs_down', name: 'Escaleras', type: 'stairs', x: 20, y: 70, w: 10, h: 12 }
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
        el.textContent = item.name;

        if (item.type === 'classroom' || item.type === 'lab') {
            el.onclick = () => onRoomClick(item);
        }
        container.appendChild(el);
    });
}
