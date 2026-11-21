import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { get, ref, update } from "firebase/database";
import { firebaseAuth, firebaseDatabase, IS_MOCK, PATHS } from "../backend/firebase";

const AuthContext = createContext({ user: null, profile: null, isAdmin: false, isViewer: false, loading: true });

const bootstrapAdminEmails = String(import.meta.env.VITE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/**
 * Fallback for recreated Auth accounts: if USERS_ARCHIVE/{uid} is missing but a
 * profile with the SAME email exists under an old uid (the Auth account was
 * deleted and re-created, so the uid changed), adopt that profile and move it
 * to the current uid so everything works again on the next load too.
 * Only admin/viewer profiles are migrated automatically — an entry worker's
 * data trees are keyed by uid and must be moved deliberately (Reassign page).
 */
const recoverProfileByEmail = async (user) => {
    const email = String(user.email ?? "").trim().toLowerCase();
    if (!email) return null;
    const snap = await get(ref(firebaseDatabase, PATHS.users));
    if (!snap.exists()) return null;
    const all = snap.val();
    const oldUid = Object.keys(all).find(
        (k) => k !== user.uid && String(all[k]?.emailId ?? "").trim().toLowerCase() === email
    );
    if (!oldUid) return null;
    const found = all[oldUid];
    if (found?.access !== "admin" && found?.access !== "viewer") return null;

    const migrated = { ...found, uid: user.uid, migratedFromUid: oldUid };
    try {
        await update(ref(firebaseDatabase), {
            [`${PATHS.users}/${user.uid}`]: migrated,
            [`${PATHS.users}/${oldUid}`]: null,
        });
    } catch (e) {
        // Rules may forbid the write; still honor the role for this session.
        console.warn("Profile found by email but could not be migrated to the new uid", e);
    }
    return migrated;
};

export const AuthProvider = ({ children }) => {
    const [state, setState] = useState({ user: null, profile: null, isAdmin: false, isViewer: false, loading: true });

    useEffect(() => {
        if (IS_MOCK) {
            const asViewer = import.meta.env.VITE_MOCK_ROLE === "viewer";
            // eslint-disable-next-line react-hooks/set-state-in-effect -- dev-only shortcut
            setState(
                asViewer
                    ? { user: { uid: "viewer1", email: "observer@mpbirla.example" }, profile: { name: "Birla Observer", access: "viewer" }, isAdmin: false, isViewer: true, loading: false }
                    : { user: { uid: "admin1", email: "admin@kilkari.org" }, profile: { name: "Programme Admin", access: "admin" }, isAdmin: true, isViewer: false, loading: false }
            );
            return undefined;
        }
        const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
            if (!user) {
                setState({ user: null, profile: null, isAdmin: false, isViewer: false, loading: false });
                return;
            }
            let profile = null;
            try {
                const snap = await get(ref(firebaseDatabase, `${PATHS.users}/${user.uid}`));
                profile = snap.exists() ? snap.val() : null;
                if (!profile?.access) {
                    profile = (await recoverProfileByEmail(user)) ?? profile;
                }
            } catch (e) {
                console.error("Failed to read profile", e);
            }
            const isAdmin =
                profile?.access === "admin" ||
                bootstrapAdminEmails.includes(String(user.email ?? "").toLowerCase());
            const isViewer = !isAdmin && profile?.access === "viewer";
            setState({ user, profile, isAdmin, isViewer, loading: false });
        });
        return () => unsub();
    }, []);

    return <AuthContext.Provider value={{ ...state, signOut: () => signOut(firebaseAuth) }}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
