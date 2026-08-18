import { Navigate } from "react-router";
import { Button, Spinner } from "@chakra-ui/react";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children }) => {
    const { user, isAdmin, loading, signOut } = useAuth();

    if (loading) {
        return (
            <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
                <Spinner size="xl" color="#1e8884" />
            </div>
        );
    }
    if (!user) return <Navigate to="/" replace />;

    if (!isAdmin) {
        return (
            <div style={{ display: "grid", placeItems: "center", height: "100vh", padding: 20 }}>
                <div className="card" style={{ maxWidth: 440, textAlign: "center" }}>
                    <h2 style={{ marginTop: 0 }}>Not an admin account</h2>
                    <p className="muted">
                        <b>{user.email}</b> is signed in but does not have admin access. Only the admin can use this
                        console. Field workers should use the Kilkari entry app.
                    </p>
                    <Button onClick={signOut} colorPalette="red" variant="outline">
                        Sign out
                    </Button>
                </div>
            </div>
        );
    }
    return children;
};

export default ProtectedRoute;
