import { db, collection, APP_ID } from './config.js';

export const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
export const timeSlots = Array.from({length: 14}, (_, i) => i + 7);

export const state = {
    teachers: [], subjects: [], groups: [], schedule: [], 
    classrooms: [], 
    // Reemplazamos 'blocks' y 'attendance' con 'external'
    external: [], 
    history: [],
    loading: { teachers: true, subjects: true, groups: true, schedule: true, classrooms: true, external: true }
};

export const cols = {
    teachers: collection(db, `artifacts/${APP_ID}/public/data/teachers`),
    subjects: collection(db, `artifacts/${APP_ID}/public/data/subjects`),
    groups: collection(db, `artifacts/${APP_ID}/public/data/groups`),
    schedule: collection(db, `artifacts/${APP_ID}/public/data/schedule`),
    classrooms: collection(db, `artifacts/${APP_ID}/public/data/classrooms`),
    // Nueva colección para STEM e Idiomas
    external: collection(db, `artifacts/${APP_ID}/public/data/external`)
};
