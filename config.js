// IMPORTACIÓN DE FIREBASE (Versión modular para mejor rendimiento)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Configuración de tu Proyecto
const firebaseConfig = {
    apiKey: "AIzaSyA5jnDVPPYhSuN7D6qzcETKWW3kzkqV1zs",
    authDomain: "planificador-horarios.firebaseapp.com",
    projectId: "planificador-horarios",
    storageBucket: "planificador-horarios.appspot.com",
    messagingSenderId: "625559113082",
    appId: "1:625559113082:web:836fb0b09be2a60cf2dac3"
};

// Inicializar
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Constantes Globales
const APP_ID = 'default-scheduler-app-v2';

// Paleta de colores PROFESIONAL (Tonos pastel fuertes para bordes)
// Cada objeto tiene: { border: colorFuerte, bg: colorSuave }
const PALETTE = [
    '#0ea5e9', // Azul Cielo
    '#f59e0b', // Ambar
    '#10b981', // Esmeralda
    '#8b5cf6', // Violeta
    '#f43f5e', // Rosa
    '#6366f1', // Índigo
    '#84cc16', // Lima
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#d946ef', // Fucsia
];

export { app, db, auth, collection, APP_ID, PALETTE };
