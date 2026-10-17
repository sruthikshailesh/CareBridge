import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

// Placeholder config for the demo project. When connecting emulators the
// values are ignored; fill in real values for staging/production.
const firebaseConfig = {
  apiKey: "demo-api-key",
  authDomain: "demo-diabetes-care.firebaseapp.com",
  projectId: "demo-diabetes-care",
  storageBucket: "demo-diabetes-care.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

if (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
