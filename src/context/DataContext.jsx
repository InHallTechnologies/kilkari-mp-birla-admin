import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { get, ref } from "firebase/database";
import { firebaseDatabase, PATHS } from "../backend/firebase";
import { useAuth } from "./AuthContext";
import { IS_MOCK } from "../backend/firebase";

const DataContext = createContext(null);

const readTree = async (path) => {
    const snap = await get(ref(firebaseDatabase, path));
    return snap.exists() ? snap.val() : {};
};

/** {workerUid: {childId: {entryKey: entry}}} -> flat rows */
const flattenFollowups = (tree, kind) => {
    const rows = [];
    for (const workerUid of Object.keys(tree ?? {})) {
        const byChild = tree[workerUid] ?? {};
        for (const childId of Object.keys(byChild)) {
            const entries = byChild[childId] ?? {};
            for (const entryKey of Object.keys(entries)) {
                rows.push({ id: entryKey, kind, workerUid, childId, ...entries[entryKey] });
            }
        }
    }
    return rows;
};

export const DataProvider = ({ children }) => {
    const { isAdmin } = useAuth();
    const [raw, setRaw] = useState({ users: {}, enrollments: {}, updates: {}, nrc: {}, community: {} });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [loadedAt, setLoadedAt] = useState(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            if (IS_MOCK) {
                const { buildMockTrees } = await import("../backend/mockData");
                setRaw(buildMockTrees());
                setLoadedAt(new Date());
                return;
            }
            const [users, enrollments, updates, nrc, community] = await Promise.all([
                readTree(PATHS.users),
                readTree(PATHS.enrollments),
                readTree(PATHS.updates),
                readTree(PATHS.nrcFollowups),
                readTree(PATHS.communityFollowups),
            ]);
            setRaw({ users, enrollments, updates, nrc, community });
            setLoadedAt(new Date());
        } catch (e) {
            console.error(e);
            setError(e?.message ?? "Failed to load data");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Initial load once the admin is verified. `refresh` is stable (useCallback).
        // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch; state is set in its callbacks
        if (isAdmin) refresh();
    }, [isAdmin, refresh]);

    const value = useMemo(() => {
        const workers = Object.keys(raw.users).map((uid) => ({ uid, ...raw.users[uid] }));
        const workerByUid = Object.fromEntries(workers.map((w) => [w.uid, w]));
        const workerName = (uid) => workerByUid[uid]?.name || workerByUid[uid]?.emailId || uid || "-";

        const children = [];
        for (const workerUid of Object.keys(raw.enrollments)) {
            const byChild = raw.enrollments[workerUid] ?? {};
            for (const childId of Object.keys(byChild)) {
                children.push({
                    id: childId,
                    workerUid,
                    workerName: workerName(workerUid),
                    ...byChild[childId],
                });
            }
        }
        const childById = Object.fromEntries(children.map((c) => [c.id, c]));

        const weekly = flattenFollowups(raw.updates, "weekly");
        const nrcFollowups = flattenFollowups(raw.nrc, "nrc");
        const communityFollowups = flattenFollowups(raw.community, "community");

        // Follow-up counts per child (the field app never maintains numberOfEntries, so compute here)
        const followupCounts = {};
        for (const list of [weekly, nrcFollowups, communityFollowups]) {
            for (const f of list) {
                const c = (followupCounts[f.childId] ??= { weekly: 0, nrc: 0, community: 0, total: 0, last: null });
                c[f.kind] += 1;
                c.total += 1;
                if (!c.last || String(f.timestamp ?? "") > String(c.last)) c.last = f.timestamp ?? c.last;
            }
        }

        return {
            loading,
            error,
            loadedAt,
            refresh,
            workers,
            workerByUid,
            workerName,
            children,
            childById,
            weekly,
            nrcFollowups,
            communityFollowups,
            followupCounts,
        };
    }, [raw, loading, error, loadedAt, refresh]);

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useData = () => useContext(DataContext);
