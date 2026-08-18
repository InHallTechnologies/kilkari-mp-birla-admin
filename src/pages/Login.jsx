import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Button, Input } from "@chakra-ui/react";
import { firebaseAuth } from "../backend/firebase";
import { useAuth } from "../context/AuthContext";

const friendlyError = (code) => {
    switch (code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
            return "Incorrect email or password.";
        case "auth/too-many-requests":
            return "Too many attempts. Try again later.";
        case "auth/invalid-email":
            return "That email address is not valid.";
        default:
            return "Sign-in failed. Please try again.";
    }
};

const Login = () => {
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!loading && user) navigate("/admin", { replace: true });
    }, [user, loading, navigate]);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
            await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
        } catch (err) {
            setError(friendlyError(err?.code));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="auth">
            <div className="img">
                <img src="/auth_page_1.jpg" alt="" />
            </div>
            <div className="form">
                <form className="box" onSubmit={submit}>
                    <div className="logos">
                        <img src="/logo.jpg" alt="MP Birla" />
                        <img src="/asra.png" alt="Asra" />
                    </div>
                    <h1>Kilkari Admin</h1>
                    <p>Sign in with the admin account to manage entry makers and view analytics.</p>
                    {error && <div className="err">{error}</div>}
                    <div className="field">
                        <label htmlFor="email">Email</label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
                    </div>
                    <div className="field">
                        <label htmlFor="password">Password</label>
                        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                    </div>
                    <Button type="submit" loading={busy} width="100%" bg="#1470a4" color="white" _hover={{ bg: "#105a85" }}>
                        Sign in
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default Login;
