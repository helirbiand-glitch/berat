import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';

// Use config from file as the primary source of truth
const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
};

console.log("Firebase Config Initialization (Manual JSON):", {
  projectId: firebaseConfig.projectId,
  hasApiKey: !!firebaseConfig.apiKey
});

const missingKeys = Object.entries(firebaseConfig)
  .filter(([key, value]) => !value && key !== 'measurementId')
  .map(([key]) => key);

export const firebaseConfigMissing = missingKeys.length > 0;
export const missingFirebaseKeys = missingKeys;

// Helper to detect if app is running in an iframe
export const isIframe = () => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
};

// Initialize Firebase
let app;
console.log("🔥 Initializing Firebase with Config:", firebaseConfig);
try {
  if (getApps().length > 0) {
    app = getApp();
  } else {
    // If keys are missing, we still try to initialize with placeholder to prevent app crash,
    // but the UI will show the configuration error.
    const finalConfig = firebaseConfigMissing 
      ? { apiKey: "missing", authDomain: "missing", projectId: "missing", appId: "missing" } 
      : firebaseConfig;
    app = initializeApp(finalConfig);
    console.log("✅ Firebase App Initialized Successfully");
  }
} catch (e) {
  console.error("❌ Firebase App initialization failed:", e);
  app = initializeApp({ apiKey: "error" }, "fallback");
}

const dbId = firebaseConfigData.firestoreDatabaseId || "(default)";
export const db = getFirestore(app, dbId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Custom sign-in with better logging
export const signIn = async () => {
  console.log("Initiating Google Sign-In with Popup...");
  try {
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, googleProvider);
    console.log("Sign-in successful:", result.user.email);
    return result;
  } catch (error: any) {
    console.error("Auth Error Code:", error.code);
    console.error("Auth Error Message:", error.message);
    throw error;
  }
};

export const signInRedirect = async () => {
  console.log("Initiating Google Sign-In with Redirect...");
  try {
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    return await signInWithRedirect(auth, googleProvider);
  } catch (error: any) {
    console.error("Auth Redirect Error:", error);
    throw error;
  }
};

export const handleRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      console.log("Redirect result successful:", result.user.email);
    }
    return result;
  } catch (error: any) {
    console.error("Redirect Result Error:", error);
    throw error;
  }
};

export const signOut = () => auth.signOut();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  
  const errInfo = {
    error: errMessage,
    operationType,
    path,
    userId: auth.currentUser?.uid,
    timestamp: new Date().toISOString()
  };

  console.error('Firestore Error:', JSON.stringify(errInfo, null, 2));
  
  // Re-throw with descriptive error for App.tsx to catch
  throw new Error(`Veritabanı hatası (${operationType} @ ${path}): ${errMessage}`);
}
