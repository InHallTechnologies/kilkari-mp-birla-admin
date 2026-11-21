import { Navigate } from "react-router";
import { Button, Spinner } from "@chakra-ui/react";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children }) => {
    const { user, isAdmin, isViewer, loading, signOut } = useAuth();

    if (loading) {
        return (
            <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
                <Spinner size="xl" color="#1e8884" />
            </div>
        );
    }
    if (!user) return <Navigate to="/" replace />;

    if (!isAdmin && !isViewer) {
        return (
            <div style={{ display: "grid", placeItems: "center", height: "100vh", padding: 20 }}>
                <div className="card" style={{ maxWidth: 520 }}>
                    <h2 style={{ marginTop: 0, textAlign: "center" }}>No console access</h2>
                    <p className="muted">
                        <b>{user.email}</b> is signed in, but no admin or viewer profile was found for it. Field workers
                        should use the Kilkari entry app instead.
                    </p>
                    <p className="muted" style={{ fontSize: "0.8rem" }}>
                        Technical detail for the admin — the console looked for
                        <code style={{ display: "block", margin: "6px 0", background: "#f7fafc", padding: "6px 8px", borderRadius: 6, wordBreak: "break-all" }}>
                            USERS_ARCHIVE/{user.uid} → access: "admin" | "viewer"
                        </code>
                        and also searched USERS_ARCHIVE for a profile with this email. If this account was deleted and
                        re-created in Firebase Authentication, its uid changed; set <code>access</code> on the path above
                        in the Realtime Database (or fix the <code>emailId</code> on the old profile so it can be
                        adopted automatically).
                    </p>
                    <div style={{ textAlign: "center" }}>
                        <Button onClick={signOut} colorPalette="red" variant="outline">
                            Sign out
                        </Button>
                    </div>
                </div>
            </div>
        );
    }
    return children;
};

/** Wrap admin-only pages. Viewers are sent back to the dashboard. */
export const AdminRoute = ({ children }) => {
    const { isAdmin, loading } = useAuth();
    if (loading) return null;
    if (!isAdmin) return <Navigate to="/admin" replace />;
    return children;
};

export default ProtectedRoute;
