import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { get, ref } from "firebase/database";
import { firebaseAuth, firebaseDatabase, IS_MOCK, PATHS } from "../backend/firebase";

const AuthContext = createContext({ user: null, profile: null, isAdmin: false, loading: true });

const bootstrapAdminEmails = String(import.meta.env.VITE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const AuthProvider = ({ children }) => {
    const [state, setState] = useState({ user: null, profile: null, isAdmin: false, loading: true });

    useEffect(() => {
        if (IS_MOCK) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- dev-only shortcut
            setState({ user: { uid: "admin1", email: "admin@kilkari.org" }, profile: { name: "Programme Admin", access: "admin" }, isAdmin: true, loading: false });
            return undefined;
        }
        const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
            if (!user) {
                setState({ user: null, profile: null, isAdmin: false, loading: false });
                return;
            }
            let profile = null;
            try {
                const snap = await get(ref(firebaseDatabase, `${PATHS.users}/${user.uid}`));
                profile = snap.exists() ? snap.val() : null;
            } catch (e) {
                console.error("Failed to read admin profile", e);
            }
            const isAdmin =
                profile?.access === "admin" ||
                bootstrapAdminEmails.includes(String(user.email ?? "").toLowerCase());
            setState({ user, profile, isAdmin, loading: false });
        });
        return () => unsub();
    }, []);

    return <AuthContext.Provider value={{ ...state, signOut: () => signOut(firebaseAuth) }}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
