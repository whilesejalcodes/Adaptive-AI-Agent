import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

function requiredFirebaseEnv(name: string): string {
  const value = import.meta.env[name] as string | undefined;
  if (!value) {
    throw new Error(`${name} is not configured. Add the Firebase web settings to the environment.`);
  }
  return value;
}

const firebaseApp = getApps().length
  ? getApp()
  : initializeApp({
      apiKey: requiredFirebaseEnv('VITE_FIREBASE_API_KEY'),
      authDomain: requiredFirebaseEnv('VITE_FIREBASE_AUTH_DOMAIN'),
      projectId: requiredFirebaseEnv('VITE_FIREBASE_PROJECT_ID'),
      storageBucket: requiredFirebaseEnv('VITE_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: requiredFirebaseEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
      appId: requiredFirebaseEnv('VITE_FIREBASE_APP_ID'),
    });

export const firebaseAuth = getAuth(firebaseApp);
export const firebaseFirestore = getFirestore(firebaseApp);