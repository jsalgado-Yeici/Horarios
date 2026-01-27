import { db, collection, APP_ID } from './config.js';

export const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
export const timeSlots = Array.from({length: 14}, (_, i) => i + 7);

export const state = {
    teachers: [], subjects: [], groups: [], schedule: [], 
    presets: [], blocks: [], classrooms: [], attendance: [],
    // Historial para Deshacer
    history: [],
    loading: { teachers: true, subjects: true, groups: true, schedule: true, classrooms: true, attendance: true }
};

export const cols = {
    teachers: collection(db, `artifacts/${APP_ID}/public/data/teachers`),
    subjects: collection(db, `artifacts/${APP_ID}/public/data/subjects`),
    groups: collection(db, `artifacts/${APP_ID}/public/data/groups`),
    schedule: collection(db, `artifacts/${APP_ID}/public/data/schedule`),
    presets: collection(db, `artifacts/${APP_ID}/public/data/presets`),
    blocks: collection(db, `artifacts/${APP_ID}/public/data/blocks`),
    classrooms: collection(db, `artifacts/${APP_ID}/public/data/classrooms`),
    attendance: collection(db, `artifacts/${APP_ID}/public/data/attendance`)
};
