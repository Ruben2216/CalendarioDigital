import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD2WdeY2QhsgHEvNiM79n-_yXqGd7RFhGw",
  authDomain: "calendariodigital-cobach-798bd.firebaseapp.com",
  projectId: "calendariodigital-cobach-798bd",
  storageBucket: "calendariodigital-cobach-798bd.firebasestorage.app",
  messagingSenderId: "983342998954",
  appId: "1:983342998954:web:0a1de260790e4aa66cf7d3"
};

const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);