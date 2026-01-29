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
        { id: 'idiomas', name: 'C. Idiomas', type: 'office', icon: '🗣️', door: 'right', x: 5, y: 15, w: 18, h: 45 },

        // Centro: Certificación y Arte (Bloques centrales)
        { id: 'cert', name: 'Certific.', type: 'office', icon: '📜', door: 'left', x: 30, y: 15, w: 18, h: 30 },
        { id: 'arte', name: 'Lab. Arte', type: 'lab', icon: '🎨', door: 'right', x: 52, y: 15, w: 18, h: 30 },

        // Derecha Superior: Oficinas
        { id: 'admin1', name: 'Coord.', type: 'office', icon: '📋', door: 'left', x: 78, y: 5, w: 15, h: 10 },
        { id: 'admin2', name: 'Of. 1', type: 'office', icon: '👔', door: 'left', x: 78, y: 17, w: 15, h: 10 },
        { id: 'admin3', name: 'Of. 2', type: 'office', icon: '📂', door: 'left', x: 78, y: 29, w: 15, h: 10 },
        { id: 'admin4', name: 'Of. Yeici', type: 'office', icon: '📇', door: 'left', x: 78, y: 41, w: 15, h: 10 },

        // Derecha Inferior: Modelado (Separado por pasillo horizontal)
        { id: 'modelado', name: 'L. Modelado', type: 'lab', icon: '🗿', door: 'top', x: 78, y: 65, w: 15, h: 25 },

        // Extras
        { id: 'stairs_down', name: 'Bajar', type: 'stairs', icon: '⬇️', x: 94, y: 5, w: 5, h: 10 }
    ]
};

export function renderMap(floorId, container, scheduleData, catalog, onRoomClick) {
    container.innerHTML = '';
    const items = MAP_DATA[floorId] || [];

    // Calcular hora actual para estado "En Uso"
    const now = new Date();
    const currentDay = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][now.getDay()];
    const currentHour = now.getHours();

    // Total horas semanales posibles (7am - 9pm = 14h * 5 días = 70h)
    const TOTAL_WEEKLY_HOURS = 70;

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

        // Door Indicator
        if (item.door) {
            const door = document.createElement('div');
            door.className = `door-indicator door-${item.door}`;
            el.appendChild(door);
        }

        // Logic for Classrooms, Labs, and Offices
        if (item.type === 'classroom' || item.type === 'lab' || item.type === 'office') {

            // 1. Catalog Sync Check
            // Si pasamos catálogo, verificamos que el ID exista
            if (catalog) {
                const inCatalog = catalog.find(c => c.id === item.id);
                if (!inCatalog) {
                    el.classList.add('not-in-catalog');
                    el.title = "No registrado en Catálogo";
                    nameSpan.textContent += " (?)"; // Warning visual
                }
            }

            // 2. In-Use Check (Realtime)
            const inUse = scheduleData.some(c =>
                c.classroomId === item.id &&
                c.day === currentDay &&
                c.startTime <= currentHour &&
                (c.startTime + c.duration) > currentHour
            );

            if (inUse) {
                el.classList.add('occupied');
                // el.title will be updated below
            } else {
                el.classList.add('free');
            }

            // 3. Weekly Usage Heatmap (Gradient Fill)
            const hoursUsed = scheduleData
                .filter(c => c.classroomId === item.id)
                .reduce((acc, c) => acc + c.duration, 0);

            const usagePct = Math.min((hoursUsed / TOTAL_WEEKLY_HOURS) * 100, 100).toFixed(0);

            // Definir color de relleno según intensidad (Blue -> Orange -> Red)
            let fillColor = 'rgba(59, 130, 246, 0.2)'; // Blue tint default
            if (usagePct > 30) fillColor = 'rgba(249, 115, 22, 0.3)'; // Orange tint
            if (usagePct > 60) fillColor = 'rgba(239, 68, 68, 0.3)'; // Red tint

            // Aplicar gradiente: De abajo hacia arriba
            // El resto (arriba del %) se queda transparente o blanco
            el.style.background = `linear-gradient(to top, ${fillColor} ${usagePct}%, white ${usagePct}%)`;

            // Tooltip info
            el.title = `${item.name}\nUso Semanal: ${usagePct}% (${hoursUsed}h)\nEstado: ${inUse ? "OCUPADO AHORA" : "Libre"}`;

            // Interaction
            el.onclick = () => onRoomClick(item);
            el.style.cursor = "pointer";

        } else {
            el.style.cursor = "default";
        }

        container.appendChild(el);
    });
}
