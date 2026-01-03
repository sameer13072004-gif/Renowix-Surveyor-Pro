
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBBn_lrDAWOt8WpfSivR3L83g5HVTZRatA",
  authDomain: "renowix-surveyor-pro.firebaseapp.com",
  projectId: "renowix-surveyor-pro",
  storageBucket: "renowix-surveyor-pro.firebasestorage.app",
  messagingSenderId: "48954158672",
  appId: "1:48954158672:web:40e53762b2db835c456b55"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
