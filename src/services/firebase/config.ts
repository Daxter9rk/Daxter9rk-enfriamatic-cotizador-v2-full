import {getApp, getApps, initializeApp} from 'firebase/app';
import {connectAuthEmulator, getAuth, setPersistence, browserLocalPersistence} from 'firebase/auth';
import {connectFirestoreEmulator, getFirestore} from 'firebase/firestore';
import {connectFunctionsEmulator, getFunctions} from 'firebase/functions';
import {connectStorageEmulator, getStorage} from 'firebase/storage';

function requireEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name] as string | undefined;
  if (!value || value.includes('replace-with')) {
    throw new Error(`Falta configurar ${name} en .env.local.`);
  }
  return value;
}

const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
const emulatorFlag = import.meta.env.VITE_USE_EMULATORS === 'true';
const localHost =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const useLocalEmulators = emulatorFlag && localHost;
const app =
  getApps().length > 0
    ? getApp()
    : initializeApp({
        apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
        authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
        projectId: useLocalEmulators ? 'demo-enfriamatic' : requireEnv('VITE_FIREBASE_PROJECT_ID'),
        storageBucket: useLocalEmulators
          ? 'demo-enfriamatic.appspot.com'
          : requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
        messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
        appId: requireEnv('VITE_FIREBASE_APP_ID'),
        ...(measurementId ? {measurementId} : {}),
      });

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');
export const storage = getStorage(app);

void setPersistence(auth, browserLocalPersistence);

if (useLocalEmulators && !window.__ENFRIAMATIC_EMULATORS_CONNECTED__) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  window.__ENFRIAMATIC_EMULATORS_CONNECTED__ = true;
}

export {app};
