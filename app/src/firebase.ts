import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  connectAuthEmulator,
} from "@firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Placeholder config for the demo project. With USE_EMULATORS the values are
// ignored; fill in real values when pointing at a staging/production project.
const firebaseConfig = {
  apiKey: "demo-api-key",
  authDomain: "demo-diabetes-care.firebaseapp.com",
  projectId: "demo-diabetes-care",
  storageBucket: "demo-diabetes-care.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createAuth() {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // auth already initialized (hot reload)
    return getAuth(app);
  }
}

export const auth = createAuth();
export const db = getFirestore(app);
export const fns = getFunctions(app);

const USE_EMULATORS = true;
if (USE_EMULATORS) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(fns, "127.0.0.1", 5001);
}
