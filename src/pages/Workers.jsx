import { useMemo, useState } from "react";
import { Button, Dialog, Input, Spinner } from "@chakra-ui/react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { createWorker, sendWorkerPasswordReset, updateWorkerProfile } from "../backend/adminOps";
import { Card, DataTable } from "../components/ui";
import { fmtDate } from "../utils/data";

const friendlyAuthError = (code) => {
    switch (code) {
        case "auth/email-already-in-use":
            return "An account with that email already exists.";
        case "auth/invalid-email":
            return "That email address is not valid.";
        case "auth/weak-password":
            return "Password must be at least 6 characters.";
        case "auth/operation-not-allowed":
            return "Email/password sign-in is disabled in Firebase Auth settings.";
        default:
            return "Could not create the account.";
    }
};

const EMPTY = { name: "", emailId: "", password: "", location: "" };

const Workers = () => {
    const { user } = useAuth();
    const { loading, workers, children, weekly, nrcFollowups, communityFollowups, refresh } = useData();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(null); // {uid, name, location}

    const rows = useMemo(() => {
        const entryCount = {};
        for (const e of [...weekly, ...nrcFollowups, ...communityFollowups]) entryCount[e.workerUid] = (entryCount[e.workerUid] ?? 0) + 1;
        return workers
            .map((w) => ({
                ...w,
                childCount: children.filter((c) => c.workerUid === w.uid).length,
                entryCount: entryCount[w.uid] ?? 0,
            }))
            .sort((a, b) => (a.access === "admin" ? -1 : b.access === "admin" ? 1 : String(a.name ?? "").localeCompare(String(b.name ?? ""))));
    }, [workers, children, weekly, nrcFollowups, communityFollowups]);

    if (loading) return <div style={{ display: "grid", placeItems: "center", height: "60vh" }}><Spinner size="xl" color="#1e8884" /></div>;

    const submitCreate = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await createWorker({ ...form, adminUid: user.uid });
            toast.success(`Entry maker "${form.name}" created`);
            setForm(EMPTY);
            setOpen(false);
            refresh();
        } catch (err) {
            console.error(err);
            toast.error(friendlyAuthError(err?.code));
        } finally {
            setBusy(false);
        }
    };

    const toggleStatus = async (w) => {
        const next = w.status === "inactive" ? "active" : "inactive";
        try {
            await updateWorkerProfile(w.uid, { status: next });
            toast.success(`${w.name || w.emailId} marked ${next}`);
            refresh();
        } catch (err) {
            console.error(err);
            toast.error("Failed to update status");
        }
    };

    const reset = async (w) => {
        if (!w.emailId) return toast.error("No email on record");
        try {
            await sendWorkerPasswordReset(w.emailId);
            toast.success(`Password reset email sent to ${w.emailId}`);
        } catch (err) {
            console.error(err);
            toast.error("Failed to send reset email");
        }
    };

    const saveEdit = async () => {
        setBusy(true);
        try {
            await updateWorkerProfile(editing.uid, { name: editing.name.trim(), location: editing.location ?? "" });
            toast.success("Profile updated");
            setEditing(null);
            refresh();
        } catch (err) {
            console.error(err);
            toast.error("Failed to update profile");
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Entry makers</h1>
                    <p className="page-subtitle">Field workers who use the Kilkari entry app. Only you (admin) can add them.</p>
                </div>
                <Button bg="#1470a4" color="white" _hover={{ bg: "#105a85" }} onClick={() => setOpen(true)}>
                    + Onboard entry maker
                </Button>
            </div>

            <Card>
                <DataTable
                    rows={rows}
                    rowKey={(r) => r.uid}
                    columns={[
                        { key: "name", label: "Name", render: (r) => <b>{r.name || "-"}</b> },
                        { key: "emailId", label: "Email" },
                        { key: "access", label: "Role", render: (r) => (r.access === "admin" ? <span className="pill admin">admin</span> : <span className="muted">entry</span>) },
                        { key: "status", label: "Status", render: (r) => <span className={`pill ${r.status === "inactive" ? "inactive" : "active"}`}>{r.status || "active"}</span> },
                        { key: "location", label: "Location" },
                        { key: "childCount", label: "Children" },
                        { key: "entryCount", label: "Entries" },
                        { key: "addedOn", label: "Added", render: (r) => fmtDate(r.addedOn) },
                        {
                            key: "actions",
                            label: "",
                            render: (r) =>
                                r.access === "admin" ? null : (
                                    <div style={{ display: "flex", gap: 6 }}>
                                        <Button size="xs" variant="outline" onClick={() => setEditing({ uid: r.uid, name: r.name ?? "", location: r.location ?? "" })}>
                                            Edit
                                        </Button>
                                        <Button size="xs" variant="outline" onClick={() => reset(r)}>
                                            Reset password
                                        </Button>
                                        <Button size="xs" variant="outline" colorPalette={r.status === "inactive" ? "green" : "red"} onClick={() => toggleStatus(r)}>
                                            {r.status === "inactive" ? "Activate" : "Deactivate"}
                                        </Button>
                                    </div>
                                ),
                        },
                    ]}
                    empty="No users found in USERS_ARCHIVE."
                />
                <p className="muted" style={{ fontSize: "0.78rem", marginTop: 10 }}>
                    Note: “Deactivate” flags the profile in the database; it does not disable the Firebase Auth login itself (that needs the Firebase console or a
                    Cloud Function). Reassign an inactive worker's children before deactivating.
                </p>
            </Card>

            {/* Create dialog */}
            <Dialog.Root open={open} onOpenChange={(e) => !busy && setOpen(e.open)}>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content p={6} borderRadius="xl" maxW="520px">
                        <Dialog.CloseTrigger />
                        <Dialog.Header mb={3}>
                            <Dialog.Title fontSize="lg" fontWeight="bold">Onboard entry maker</Dialog.Title>
                        </Dialog.Header>
                        <form onSubmit={submitCreate}>
                            <Dialog.Body>
                                <div className="form-grid">
                                    <div className="field full">
                                        <label>Full name</label>
                                        <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                                    </div>
                                    <div className="field full">
                                        <label>Email (login)</label>
                                        <Input required type="email" value={form.emailId} onChange={(e) => setForm({ ...form, emailId: e.target.value })} />
                                    </div>
                                    <div className="field">
                                        <label>Temporary password</label>
                                        <Input required type="text" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                                    </div>
                                    <div className="field">
                                        <label>Location / block</label>
                                        <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                                    </div>
                                </div>
                                <p className="muted" style={{ fontSize: "0.8rem", marginTop: 10 }}>
                                    Share the temporary password with the worker; they can change it via “Reset password”. You stay signed in as admin.
                                </p>
                            </Dialog.Body>
                            <Dialog.Footer mt={4} gap={2}>
                                <Button variant="outline" onClick={() => setOpen(false)} disabled={busy} type="button">
                                    Cancel
                                </Button>
                                <Button type="submit" loading={busy} bg="#1470a4" color="white" _hover={{ bg: "#105a85" }}>
                                    Create account
                                </Button>
                            </Dialog.Footer>
                        </form>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>

            {/* Edit dialog */}
            <Dialog.Root open={!!editing} onOpenChange={(e) => !busy && !e.open && setEditing(null)}>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content p={6} borderRadius="xl" maxW="460px">
                        <Dialog.CloseTrigger />
                        <Dialog.Header mb={3}>
                            <Dialog.Title fontSize="lg" fontWeight="bold">Edit entry maker</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <div className="field" style={{ marginBottom: 12 }}>
                                <label>Full name</label>
                                <Input value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                            </div>
                            <div className="field">
                                <label>Location / block</label>
                                <Input value={editing?.location ?? ""} onChange={(e) => setEditing({ ...editing, location: e.target.value })} />
                            </div>
                            <p className="muted" style={{ fontSize: "0.78rem", marginTop: 10 }}>
                                Name is what the entry app stamps on new enrollments/updates (enrolledByName / entryByName). Existing entries keep the old name.
                            </p>
                        </Dialog.Body>
                        <Dialog.Footer mt={4} gap={2}>
                            <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>
                                Cancel
                            </Button>
                            <Button onClick={saveEdit} loading={busy} bg="#1470a4" color="white" _hover={{ bg: "#105a85" }}>
                                Save
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>
        </>
    );
};

export default Workers;
