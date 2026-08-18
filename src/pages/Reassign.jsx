import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Button, Input, Spinner, Textarea } from "@chakra-ui/react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { fetchReassignLog, reassignChild } from "../backend/adminOps";
import ChildDetailDialog from "../components/ChildDetailDialog";
import { Card, CasePill, DataTable } from "../components/ui";
import { fmtDate, isNrcCase } from "../utils/data";

const Reassign = () => {
    const { user } = useAuth();
    const { loading, children, workers, workerName, followupCounts, refresh } = useData();
    const [params, setParams] = useSearchParams();
    const [query, setQuery] = useState("");
    const [childId, setChildId] = useState(params.get("child") ?? "");
    const [toUid, setToUid] = useState("");
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState(null);
    const [log, setLog] = useState([]);
    const [logLoading, setLogLoading] = useState(true);
    const [logVersion, setLogVersion] = useState(0);
    const loadLog = () => setLogVersion((v) => v + 1);

    useEffect(() => {
        let cancelled = false;
        fetchReassignLog()
            .then((rows) => {
                if (!cancelled) setLog(rows);
            })
            .catch((e) => console.error(e))
            .finally(() => {
                if (!cancelled) setLogLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [logVersion]);

    const child = useMemo(() => children.find((c) => c.id === childId) ?? null, [children, childId]);
    const candidates = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return children
            .filter((c) => [c.name, c.samNumber, c.fatherName, c.motherName, c.villageName].some((v) => String(v ?? "").toLowerCase().includes(q)))
            .slice(0, 12);
    }, [children, query]);

    const targets = workers
        .filter((w) => w.access !== "admin" && w.uid !== child?.workerUid)
        .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));

    const counts = child ? followupCounts[child.id] ?? { weekly: 0, nrc: 0, community: 0, total: 0 } : null;

    const pick = (c) => {
        setChildId(c.id);
        setParams({ child: c.id });
        setQuery("");
        setToUid("");
    };

    const doReassign = async () => {
        if (!child || !toUid) return;
        setBusy(true);
        try {
            const target = workers.find((w) => w.uid === toUid);
            await reassignChild({
                childId: child.id,
                fromUid: child.workerUid,
                toUid,
                toName: target?.name ?? "",
                adminUid: user.uid,
                note,
            });
            toast.success(`${child.name || "Child"} moved to ${target?.name || target?.emailId}`);
            setToUid("");
            setNote("");
            setChildId("");
            setParams({});
            refresh();
            loadLog();
        } catch (err) {
            console.error(err);
            toast.error(err?.message ?? "Reassignment failed");
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <div style={{ display: "grid", placeItems: "center", height: "60vh" }}><Spinner size="xl" color="#1e8884" /></div>;

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Reassign a child</h1>
                    <p className="page-subtitle">
                        Moves the enrollment and every follow-up to another entry maker in one atomic write. The entry app needs no change — the new
                        worker simply sees the child in their lists; the old one no longer does.
                    </p>
                </div>
            </div>

            <div className="grid grid-2">
                <Card title="1. Pick the child">
                    <Input placeholder="Search by name, SAM no., parent or village…" value={query} onChange={(e) => setQuery(e.target.value)} />
                    {candidates.length > 0 && (
                        <div style={{ marginTop: 8, border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                            {candidates.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => pick(c)}
                                    style={{ display: "flex", width: "100%", justifyContent: "space-between", gap: 8, padding: "8px 12px", background: "#fff", border: 0, borderBottom: "1px solid #edf2f7", cursor: "pointer", font: "inherit", textAlign: "left" }}
                                >
                                    <span>
                                        <b>{c.name || "-"}</b> <span className="muted">· {c.villageName || "-"} · SAM {c.samNumber || "-"}</span>
                                    </span>
                                    <span className="muted">{c.workerName}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {child && (
                        <div style={{ marginTop: 14, padding: 14, background: "#f7fafc", borderRadius: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <div>
                                    <b style={{ fontSize: "1.05rem" }}>{child.name || "-"}</b> <CasePill isNrc={isNrcCase(child)} />
                                    <div className="muted" style={{ fontSize: "0.85rem" }}>
                                        {child.fatherName ? `S/o ${child.fatherName} · ` : ""}
                                        {child.villageName || "-"} · Enrolled {fmtDate(child.enrollmentDate || child.timestamp)}
                                    </div>
                                </div>
                                <Button size="xs" variant="outline" onClick={() => setPreview(child)}>
                                    View details
                                </Button>
                            </div>
                            <div className="grid grid-4" style={{ marginTop: 12, gap: 8 }}>
                                <div><div className="stat-label">Current worker</div><b>{child.workerName}</b></div>
                                <div><div className="stat-label">Weekly</div><b>{counts.weekly}</b></div>
                                <div><div className="stat-label">NRC f/u</div><b>{counts.nrc}</b></div>
                                <div><div className="stat-label">Community f/u</div><b>{counts.community}</b></div>
                            </div>
                        </div>
                    )}
                </Card>

                <Card title="2. Choose the new entry maker">
                    <select className="select" style={{ width: "100%" }} value={toUid} onChange={(e) => setToUid(e.target.value)} disabled={!child}>
                        <option value="">{child ? "Select entry maker…" : "Pick a child first"}</option>
                        {targets.map((w) => (
                            <option key={w.uid} value={w.uid}>
                                {w.name || w.emailId} {w.status === "inactive" ? "(inactive)" : ""}
                            </option>
                        ))}
                    </select>
                    <div className="field" style={{ marginTop: 12 }}>
                        <label>Reason / note (optional)</label>
                        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={!child} placeholder="e.g. Worker transferred to another block" />
                    </div>

                    {child && toUid && (
                        <div style={{ marginTop: 12, padding: 12, background: "#fff8e6", border: "1px solid #f6d58a", borderRadius: 10, fontSize: "0.86rem" }}>
                            This will move <b>{child.name || "this child"}</b> and <b>{counts.total}</b> follow-up entr{counts.total === 1 ? "y" : "ies"} from{" "}
                            <b>{child.workerName}</b> to <b>{workerName(toUid)}</b>. Follow-ups keep their original “entered by” names. This is logged and can be
                            reversed by reassigning back.
                        </div>
                    )}

                    <Button mt={4} width="100%" disabled={!child || !toUid} loading={busy} onClick={doReassign} bg="#1470a4" color="white" _hover={{ bg: "#105a85" }}>
                        Reassign child
                    </Button>
                </Card>
            </div>

            <Card title="Reassignment history" style={{ marginTop: 16 }}>
                {logLoading ? (
                    <Spinner />
                ) : (
                    <DataTable
                        rows={log}
                        columns={[
                            { key: "at", label: "When" },
                            { key: "childName", label: "Child", render: (r) => <b>{r.childName || r.childId}</b> },
                            { key: "fromUid", label: "From", render: (r) => workerName(r.fromUid) },
                            { key: "toUid", label: "To", render: (r) => workerName(r.toUid) },
                            { key: "counts", label: "Follow-ups moved", render: (r) => `${r.counts?.weekly ?? 0} weekly · ${r.counts?.nrc ?? 0} NRC · ${r.counts?.community ?? 0} community` },
                            { key: "note", label: "Note" },
                        ]}
                        empty="No reassignments yet."
                        pageSize={20}
                    />
                )}
            </Card>

            <ChildDetailDialog child={preview} onClose={() => setPreview(null)} />
        </>
    );
};

export default Reassign;
