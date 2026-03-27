// firebase-config.js
// ⚠️ REEMPLAZA las credenciales con las tuyas del paso 1.3

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, set, update, remove, onValue, off } 
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInAnonymously } 
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 🔥 CONFIGURACIÓN DE FIREBASE
// ⬇️ PEGA AQUÍ TUS CREDENCIALES QUE COPIASTE EN EL PASO 1.3
const firebaseConfig = {
  apiKey: "AIzaSyAWJo1KbaVG-E7az0WOLw6CCJv9fo1MK3U",
  authDomain: "mushuapp.firebaseapp.com",
  databaseURL: "https://mushuapp-default-rtdb.firebaseio.com",
  projectId: "mushuapp",
  storageBucket: "mushuapp.firebasestorage.app",
  messagingSenderId: "781210345910",
  appId: "1:781210345910:web:1eda2c95d9b5228571e117"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// Autenticación anónima automática
signInAnonymously(auth)
  .then(() => {
    console.log('✅ Conectado a Firebase');
  })
  .catch((error) => {
    console.error('❌ Error conectando a Firebase:', error);
  });

// Exportar para usar en otros archivos
export { database, auth, ref, get, set, update, remove, onValue, off };
