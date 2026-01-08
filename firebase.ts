import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBBn_lrDAWOt8WpfSivR3L83g5HVTZRatA",
  authDomain: "renowix-surveyor-pro.firebaseapp.com",
  projectId: "renowix-surveyor-pro",
  storageBucket: "renowix-surveyor-pro.firebasestorage.app",
  messagingSenderId: "48954158672",
  appId: "1:48954158672:web:40e53762b2db835c456b55"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);