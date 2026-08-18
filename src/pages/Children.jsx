import { useEffect, useState } from "react";
import { Button, Spinner } from "@chakra-ui/react";
import moment from "moment";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import { useData } from "../context/DataContext";
import { useFilters } from "../hooks/useFilters";
import { useAnalytics } from "../hooks/useAnalytics";
import { useDeleter } from "../hooks/useDeleter";
import { fetchTrash, purgeTrash, restoreFromTrash } from "../backend/adminOps";
import FilterBar from "../components/FilterBar";
import ChildDetailDialog from "../components/ChildDetailDialog";
import ConfirmDialog from "../components/ConfirmDialog";
import { Card, CasePill, DataTable, Tabs } from "../components/ui";
import { downloadText, fmtDate, isNrcCase, toCsv } from "../utils/data";

const KIND_LABEL = { weekly: "Weekly update", nrc: "NRC follow-up", community: "Community follow-up" };

const Children = () => {
    const { loading, followupCounts, workerName, refresh } = useData();
    const navigate = useNavigate();
    const f = useFilters();
    const a = useAnalytics(f);
    const [tab, setTab] = useState("all");
    const [selected, setSelected] = useState(null);

    // Trash
    const [trash, setTrash] = useState([]);
    const [trashVersion, setTrashVersion] = useState(0);
    const [trashLoadedVersion, setTrashLoadedVersion] = useState(-1);
    const [purging, setPurging] = useState(null);
    const trashLoading = tab === "trash" && trashLoadedVersion !== trashVersion;
    useEffect(() => {
        if (tab !== "trash" || trashLoadedVersion === trashVersion) return undefined;
        let cancelled = false;
        fetchTrash()
            .then((rows) => {
                if (cancelled) return;
                setTrash(rows);
                setTrashLoadedVersion(trashVersion);
            })
            .catch((e) => console.error(e));
        return () => {
            cancelled = true;
        };
    }, [tab, trashVersion, trashLoadedVersion]);

    const { requestDeleteChild, dialog: deleteDialog } = useDeleter({
        onDone: (p) => {
            if (p.type === "child" && selected?.id === p.child.id) setSelected(null);
            setTrashVersion((v) => v + 1);
        },
    });

    if (loading) return <div style={{ display: "grid", placeItems: "center", height: "60vh" }}><Spinner size="xl" color="#1e8884" /></div>;

    const rowsByTab = {
        all: a.children,
        nrc: a.nrcChildren,
        community: a.communityChildren,
        discharged: a.children.filter((c) => a.dischargedChildIds.has(c.id)),
        nofollowup: a.noFollowup,
    };
    const rows = rowsByTab[tab] ?? a.children;

    const columns = [
        {
            key: "_actions",
            label: "Actions",
            render: (r) => (
                <div style={{ display: "flex", gap: 6 }}>
                    <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>
                        View
                    </Button>
                    <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/admin/reassign?child=${r.id}`); }}>
                        Reassign
                    </Button>
                    <Button size="xs" variant="outline" colorPalette="red" onClick={(e) => { e.stopPropagation(); requestDeleteChild(r); }}>
                        Delete
                    </Button>
                </div>
            ),
        },
        { key: "name", label: "Child", render: (r) => <b>{r.name || "-"}</b> },
        { key: "case", label: "Case", render: (r) => <CasePill isNrc={isNrcCase(r)} /> },
        { key: "samMamStatus", label: "SAM/MAM" },
        { key: "referredToNrc", label: "Referred" },
        { key: "gender", label: "Gender" },
        { key: "ageAtIdentification", label: "Age" },
        { key: "villageName", label: "Village" },
        { key: "tahasil", label: "Tehsil" },
        { key: "caste", label: "Caste" },
        { key: "workerName", label: "Entry maker" },
        { key: "enrollmentDate", label: "Enrolled", render: (r) => fmtDate(r.enrollmentDate || r.timestamp) },
        { key: "fu", label: "Follow-ups", render: (r) => followupCounts[r.id]?.total ?? 0 },
        { key: "last", label: "Last follow-up", render: (r) => fmtDate(followupCounts[r.id]?.last) },
        { key: "weightAtIdentification", label: "Weight (ident.)" },
        { key: "phoneNumber", label: "Phone" },
    ];

    const exportCsv = () => {
        const cols = [
            ...columns.filter((c) => !["_actions", "case", "fu", "last"].includes(c.key)).map((c) => ({ key: c.key, label: c.label })),
            { key: "case", label: "Case type", render: (r) => (isNrcCase(r) ? "NRC" : "Community") },
            { key: "fu", label: "Follow-ups", render: (r) => followupCounts[r.id]?.total ?? 0 },
            { key: "last", label: "Last follow-up", render: (r) => followupCounts[r.id]?.last ?? "" },
            { key: "id", label: "Child key" },
            { key: "workerUid", label: "Entry maker uid" },
        ];
        downloadText(`kilkari_children_${tab}_${moment().format("YYYY-MM-DD")}.csv`, toCsv(cols, rows));
    };

    const restore = async (item) => {
        try {
            await restoreFromTrash(item.id);
            toast.success("Restored");
            refresh();
            setTrashVersion((v) => v + 1);
        } catch (err) {
            console.error(err);
            toast.error(err?.message ?? "Restore failed");
        }
    };

    const trashColumns = [
        {
            key: "_actions",
            label: "Actions",
            render: (r) => (
                <div style={{ display: "flex", gap: 6 }}>
                    <Button size="xs" colorPalette="green" variant="outline" onClick={() => restore(r)}>
                        Restore
                    </Button>
                    <Button size="xs" colorPalette="red" variant="outline" onClick={() => setPurging(r)}>
                        Delete permanently
                    </Button>
                </div>
            ),
        },
        { key: "type", label: "Type", render: (r) => (r.type === "child" ? "Child (+ follow-ups)" : KIND_LABEL[r.kind] ?? "Follow-up") },
        { key: "childName", label: "Child", render: (r) => <b>{r.childName || r.childId}</b> },
        { key: "workerUid", label: "Entry maker", render: (r) => workerName(r.workerUid) },
        { key: "counts", label: "Follow-ups", render: (r) => (r.type === "child" ? `${r.counts?.weekly ?? 0} weekly · ${r.counts?.nrc ?? 0} NRC · ${r.counts?.community ?? 0} community` : r.data?.timestamp || "-") },
        { key: "deletedAt", label: "Deleted at" },
        { key: "reason", label: "Reason" },
    ];

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Children</h1>
                    <p className="page-subtitle">Every enrollment across all entry makers. Use the Actions column to view, reassign or delete; deleted items can be restored from Trash.</p>
                </div>
                {tab !== "trash" && (
                    <Button onClick={exportCsv} variant="outline">
                        Export CSV ({rows.length})
                    </Button>
                )}
            </div>
            {tab !== "trash" && <FilterBar f={f} />}
            <Tabs
                active={tab}
                onChange={setTab}
                tabs={[
                    { key: "all", label: "All", count: a.children.length },
                    { key: "nrc", label: "NRC", count: a.nrcChildren.length },
                    { key: "community", label: "Community", count: a.communityChildren.length },
                    { key: "discharged", label: "Discharged", count: rowsByTab.discharged.length },
                    { key: "nofollowup", label: "No follow-up yet", count: a.noFollowup.length },
                    { key: "trash", label: "Trash" },
                ]}
            />
            <Card>
                {tab === "trash" ? (
                    trashLoading ? (
                        <div className="empty"><Spinner /></div>
                    ) : (
                        <>
                            <DataTable rows={trash} columns={trashColumns} empty="Trash is empty." />
                            <p className="muted" style={{ fontSize: "0.78rem", marginTop: 10 }}>
                                Deleted items are held in <code>ADMIN_TRASH</code> and are invisible to the entry app. “Restore” puts them back exactly where they were.
                            </p>
                        </>
                    )
                ) : (
                    <DataTable rows={rows} columns={columns} onRowClick={setSelected} empty="No children match the current filters." />
                )}
            </Card>

            <ChildDetailDialog
                child={selected}
                onClose={() => setSelected(null)}
                onDeleteChild={requestDeleteChild}
                actions={
                    <Button size="sm" variant="outline" onClick={() => navigate(`/admin/reassign?child=${selected?.id}`)}>
                        Reassign…
                    </Button>
                }
            />
            {deleteDialog}

            <ConfirmDialog
                key={purging?.id ?? "none"}
                open={!!purging}
                title="Delete permanently?"
                confirmText="Delete forever"
                confirmWord="DELETE"
                askReason={false}
                onClose={() => setPurging(null)}
                onConfirm={async () => {
                    try {
                        await purgeTrash(purging.id);
                        toast.success("Permanently deleted");
                        setTrashVersion((v) => v + 1);
                    } catch (err) {
                        console.error(err);
                        toast.error(err?.message ?? "Failed");
                        throw err;
                    }
                }}
                body={
                    <p style={{ margin: 0 }}>
                        <b>{purging?.childName || purging?.childId}</b> ({purging?.type === "child" ? "child and all follow-ups" : KIND_LABEL[purging?.kind]}) will be removed
                        from the trash. <b>This cannot be undone.</b>
                    </p>
                }
            />
        </>
    );
};

export default Children;
