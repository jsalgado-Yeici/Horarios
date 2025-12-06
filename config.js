import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA5jnDVPPYhSuN7D6qzcETKWW3kzkqV1zs",
    authDomain: "planificador-horarios.firebaseapp.com",
    projectId: "planificador-horarios",
    storageBucket: "planificador-horarios.appspot.com",
    messagingSenderId: "625559113082",
    appId: "1:625559113082:web:836fb0b09be2a60cf2dac3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const APP_ID = 'default-scheduler-app-v2';

// Paleta de Colores Profesional
const PALETTE = [
    '#3b82f6', // Azul Real
    '#8b5cf6', // Violeta Suave
    '#f43f5e', // Rosa Coral
    '#10b981', // Verde Esmeralda
    '#f59e0b', // Ámbar Profundo
    '#06b6d4', // Cian Océano
    '#ec4899', // Rosa Fucsia
    '#6366f1', // Índigo
    '#84cc16', // Lima
    '#14b8a6', // Turquesa
];

export { app, db, auth, collection, APP_ID, PALETTE };
