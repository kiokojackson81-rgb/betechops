import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

function getFirebaseAdminApp() {
  if (getApps().length) {
    return getApp();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin env variables are not fully configured.");
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    projectId,
  });
}

let cachedAuth: Auth | null = null;

export function getFirebaseAdminAuth() {
  if (cachedAuth) {
    return cachedAuth;
  }
  cachedAuth = getAuth(getFirebaseAdminApp());
  return cachedAuth;
}

export function getFirebaseAdminInitializedApp(): App {
  return getFirebaseAdminApp();
}

export const adminAuth = new Proxy({} as Auth, {
  get(_target, prop) {
    const auth = getFirebaseAdminAuth() as unknown as Record<PropertyKey, unknown>;
    const value = auth[prop];
    if (typeof value === "function") {
      return value.bind(auth);
    }
    return value;
  },
});
