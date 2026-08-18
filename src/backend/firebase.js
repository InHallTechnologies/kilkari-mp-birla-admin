import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

/** VITE_MOCK=1 -> no Firebase calls; fake admin + generated data (dev/demo only). */
export const IS_MOCK = import.meta.env.DEV && import.meta.env.VITE_MOCK === "1";

export const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Primary app: the admin's own session.
const app = getApps().find((a) => a.name === "[DEFAULT]") ?? initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
export const firebaseDatabase = getDatabase(app);

/**
 * Secondary app: used ONLY to create new worker accounts.
 * `createUserWithEmailAndPassword` signs the *created* user in on whichever
 * Auth instance it runs against — running it on a throwaway app keeps the
 * admin logged in on the primary app.
 */
export const getSecondaryAuth = () => {
    const existing = getApps().find((a) => a.name === "worker-provisioning");
    const secondary = existing ?? initializeApp(firebaseConfig, "worker-provisioning");
    return getAuth(secondary);
};

// Database paths shared with the field-worker app. Keep in sync with kilkari-mp-birla.
export const PATHS = {
    users: "USERS_ARCHIVE",
    enrollments: "Enrollments",
    updates: "Updates",
    nrcFollowups: "NrcFollowups",
    communityFollowups: "CommunityFollowups",
    reassignLog: "ADMIN_REASSIGN_LOG",
    trash: "ADMIN_TRASH",
};
