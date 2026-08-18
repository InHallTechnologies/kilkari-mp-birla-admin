import { useState } from "react";
import { toast } from "react-toastify";
import { deleteChild, deleteFollowup } from "../backend/adminOps";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import ConfirmDialog from "../components/ConfirmDialog";

const KIND_LABEL = { weekly: "weekly update", nrc: "NRC follow-up", community: "community follow-up" };

/**
 * Returns { requestDeleteChild(child), requestDeleteFollowup(entry), dialog }.
 * Render `dialog` once in the page. Deleted items go to ADMIN_TRASH (restorable).
 */
export const useDeleter = ({ onDone } = {}) => {
    const { user } = useAuth();
    const { refresh, followupCounts, childById } = useData();
    const [pending, setPending] = useState(null); // {type:'child', child} | {type:'followup', entry}

    const requestDeleteChild = (child) => setPending({ type: "child", child });
    const requestDeleteFollowup = (entry) => setPending({ type: "followup", entry });
    const close = () => setPending(null);

    const confirm = async (reason) => {
        try {
            if (pending.type === "child") {
                await deleteChild({ childId: pending.child.id, workerUid: pending.child.workerUid, adminUid: user.uid, reason });
                toast.success(`${pending.child.name || "Child"} moved to trash`);
            } else {
                const e = pending.entry;
                await deleteFollowup({
                    kind: e.kind,
                    workerUid: e.workerUid,
                    childId: e.childId,
                    entryKey: e.id,
                    childName: e.childName || childById[e.childId]?.name || "",
                    adminUid: user.uid,
                    reason,
                });
                toast.success(`${KIND_LABEL[e.kind]} moved to trash`);
            }
            refresh();
            onDone?.(pending);
        } catch (err) {
            console.error(err);
            toast.error(err?.message ?? "Delete failed");
            throw err;
        }
    };

    let dialog = null;
    if (pending?.type === "child") {
        const c = pending.child;
        const n = followupCounts[c.id] ?? { weekly: 0, nrc: 0, community: 0, total: 0 };
        dialog = (
            <ConfirmDialog
                open
                title="Delete this child?"
                confirmText="Delete child"
                confirmWord="DELETE"
                onConfirm={confirm}
                onClose={close}
                body={
                    <>
                        <p style={{ margin: 0 }}>
                            <b>{c.name || "This child"}</b> ({c.villageName || "-"}, entry maker <b>{c.workerName}</b>) will be removed from the entry app
                            along with <b>{n.total}</b> follow-up entr{n.total === 1 ? "y" : "ies"} ({n.weekly} weekly · {n.nrc} NRC · {n.community} community).
                        </p>
                        <p className="muted" style={{ margin: "8px 0 0" }}>
                            It goes to the admin trash and can be restored from the Children → Trash tab.
                        </p>
                    </>
                }
            />
        );
    } else if (pending?.type === "followup") {
        const e = pending.entry;
        dialog = (
            <ConfirmDialog
                open
                title={`Delete this ${KIND_LABEL[e.kind]}?`}
                confirmText="Delete entry"
                onConfirm={confirm}
                onClose={close}
                body={
                    <>
                        <p style={{ margin: 0 }}>
                            Entry dated <b>{e.timestamp || e.entryDate || "-"}</b> for <b>{e.childName || childById[e.childId]?.name || "child"}</b>
                            {e.entryByName ? <> (entered by {e.entryByName})</> : null} will be removed.
                        </p>
                        <p className="muted" style={{ margin: "8px 0 0" }}>It goes to the admin trash and can be restored.</p>
                    </>
                }
            />
        );
    }

    return { requestDeleteChild, requestDeleteFollowup, dialog };
};
