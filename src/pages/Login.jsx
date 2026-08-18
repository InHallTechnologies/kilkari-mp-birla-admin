import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Button } from "@chakra-ui/react";
import { MdOutlineMail, MdOutlineLock, MdVisibility, MdVisibilityOff, MdInsights, MdPeopleAlt, MdSwapHoriz, MdShield } from "react-icons/md";
import { firebaseAuth } from "../backend/firebase";
import { useAuth } from "../context/AuthContext";

const friendlyError = (code) => {
    switch (code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
            return "Incorrect email or password.";
        case "auth/too-many-requests":
            return "Too many attempts. Please wait a few minutes and try again.";
        case "auth/invalid-email":
            return "That email address is not valid.";
        case "auth/network-request-failed":
            return "Network error. Check your connection and try again.";
        default:
            return "Sign-in failed. Please try again.";
    }
};

const FEATURES = [
    { icon: MdInsights, title: "Programme analytics", text: "Enrollments, follow-ups and outcomes across every entry maker." },
    { icon: MdPeopleAlt, title: "Manage entry makers", text: "Onboard field workers, reset passwords, activate or deactivate." },
    { icon: MdSwapHoriz, title: "Reassign & clean up", text: "Move a child to another worker or fix wrong entries — safely, with a trash." },
];

const Login = () => {
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
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
        <div className="login">
            {/* Brand panel */}
            <aside className="login-brand">
                <div className="login-brand-inner">
                    <div className="login-logos">
                        <img src="/logo.jpg" alt="MP Birla" />
                        <img src="/asra.png" alt="Asra" />
                    </div>
                    <span className="login-badge">
                        <MdShield /> Admin console
                    </span>
                    <h1>
                        Kilkari
                        <span>Programme oversight for the malnutrition initiative</span>
                    </h1>
                    <ul className="login-features">
                        {FEATURES.map((f) => (
                            <li key={f.title}>
                                <span className="login-feature-icon">
                                    <f.icon size={18} />
                                </span>
                                <div>
                                    <b>{f.title}</b>
                                    <p>{f.text}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <p className="login-foot">MP Birla Group · Asra · Satna, Madhya Pradesh</p>
                </div>
            </aside>

            {/* Form panel */}
            <main className="login-form-panel">
                <form className="login-card" onSubmit={submit} noValidate>
                    <div className="login-card-head">
                        <h2>Sign in</h2>
                        <p>Use the admin account. Field workers should use the Kilkari entry app instead.</p>
                    </div>

                    {error && (
                        <div className="login-error" role="alert">
                            {error}
                        </div>
                    )}

                    <label className="login-field">
                        <span>Email</span>
                        <div className="login-input">
                            <MdOutlineMail className="login-input-icon" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@example.org"
                                autoComplete="username"
                                required
                                autoFocus
                            />
                        </div>
                    </label>

                    <label className="login-field">
                        <span>Password</span>
                        <div className="login-input">
                            <MdOutlineLock className="login-input-icon" />
                            <input
                                type={showPw ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete="current-password"
                                required
                            />
                            <button type="button" className="login-eye" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"}>
                                {showPw ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                            </button>
                        </div>
                    </label>

                    <Button type="submit" loading={busy} disabled={!email || !password} className="login-submit" width="100%" height="44px" bg="#0f6d7a" color="white" _hover={{ bg: "#0b5761" }} borderRadius="10px" fontWeight="600">
                        Sign in to console
                    </Button>

                    <p className="login-note">Forgot the password? Reset it from the Firebase console — self-service reset is disabled for the admin account.</p>
                </form>
            </main>
        </div>
    );
};

export default Login;
