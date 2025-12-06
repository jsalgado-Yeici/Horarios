import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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

const PALETTE = [
    '#3b82f6', '#8b5cf6', '#f43f5e', '#10b981', '#f59e0b', 
    '#06b6d4', '#ec4899', '#6366f1', '#84cc16', '#14b8a6'
];

export { app, db, auth, collection, APP_ID, PALETTE };
