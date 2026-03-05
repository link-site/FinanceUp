import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAlcupbsBAVhqjl4KbRjNVFe78CnunBiZM",
  authDomain: "financeup-392ae.firebaseapp.com",
  projectId: "financeup-392ae",
  storageBucket: "financeup-392ae.firebasestorage.app",
  messagingSenderId: "299342926526",
  appId: "1:299342926526:web:593cd247b0e277bed2c4ef"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
