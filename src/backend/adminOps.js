import { createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from "firebase/auth";
import { get, push, ref, update } from "firebase/database";
import moment from "moment";
import { firebaseAuth, firebaseDatabase, getSecondaryAuth, IS_MOCK, PATHS } from "./firebase";

const guardMock = () => {
    if (IS_MOCK) throw new Error("Disabled in mock mode (VITE_MOCK=1)");
};

const nowStamp = () => moment().format("DD-MM-YYYY h:mm a");

/**
 * Create a field-worker (entry maker) account.
 * Writes USERS_ARCHIVE/{uid} in the exact shape the field app's `user` entity expects,
 * so the field app can read `.name` for enrolledByName / entryByName.
 */
export const createWorker = async ({ name, emailId, password, location = "", adminUid }) => {
    guardMock();
    const secondaryAuth = getSecondaryAuth();
    const cred = await createUserWithEmailAndPassword(secondaryAuth, emailId.trim(), password);
    const uid = cred.user.uid;
    try {
        await update(ref(firebaseDatabase, `${PATHS.users}/${uid}`), {
            uid,
            name: name.trim(),
            emailId: emailId.trim(),
            access: "entry",
            addedOn: nowStamp(),
            addedBy: adminUid ?? "",
            location,
            status: "active",
        });
    } finally {
        // Never leave the provisioned worker signed in on the secondary app.
        await signOut(secondaryAuth).catch(() => {});
    }
    return uid;
};

export const updateWorkerProfile = async (uid, patch) => {
    guardMock();
    await update(ref(firebaseDatabase, `${PATHS.users}/${uid}`), patch);
};

export const sendWorkerPasswordReset = async (emailId) => {
    guardMock();
    await sendPasswordResetEmail(firebaseAuth, emailId);
};

/**
 * Move one child (enrollment + all its follow-ups) from one worker to another
 * with a single atomic multi-path update. The child key is preserved, so
 * `uid`/`childUid` references stay valid. Follow-up `entryBy*` fields are left
 * untouched — they record who actually made the entry.
 */
export const reassignChild = async ({ childId, fromUid, toUid, toName, adminUid, note = "" }) => {
    guardMock();
    if (!childId || !fromUid || !toUid) throw new Error("childId, fromUid and toUid are required");
    if (fromUid === toUid) throw new Error("Child is already assigned to that worker");

    const [enrollSnap, weeklySnap, nrcSnap, communitySnap, existsAtTarget] = await Promise.all([
        get(ref(firebaseDatabase, `${PATHS.enrollments}/${fromUid}/${childId}`)),
        get(ref(firebaseDatabase, `${PATHS.updates}/${fromUid}/${childId}`)),
        get(ref(firebaseDatabase, `${PATHS.nrcFollowups}/${fromUid}/${childId}`)),
        get(ref(firebaseDatabase, `${PATHS.communityFollowups}/${fromUid}/${childId}`)),
        get(ref(firebaseDatabase, `${PATHS.enrollments}/${toUid}/${childId}`)),
    ]);

    if (!enrollSnap.exists()) throw new Error("Enrollment not found under the current worker");
    if (existsAtTarget.exists()) throw new Error("Target worker already has a child with this key");

    const enrollment = enrollSnap.val();
    const updates = {};

    updates[`${PATHS.enrollments}/${toUid}/${childId}`] = {
        ...enrollment,
        enrolledByUid: toUid,
        enrolledByName: toName ?? enrollment.enrolledByName ?? "",
        reassignedFromUid: fromUid,
        reassignedAt: nowStamp(),
    };
    updates[`${PATHS.enrollments}/${fromUid}/${childId}`] = null;

    for (const [snap, path] of [
        [weeklySnap, PATHS.updates],
        [nrcSnap, PATHS.nrcFollowups],
        [communitySnap, PATHS.communityFollowups],
    ]) {
        if (snap.exists()) {
            updates[`${path}/${toUid}/${childId}`] = snap.val();
            updates[`${path}/${fromUid}/${childId}`] = null;
        }
    }

    const logKey = push(ref(firebaseDatabase, PATHS.reassignLog)).key;
    updates[`${PATHS.reassignLog}/${logKey}`] = {
        childId,
        childName: enrollment.name ?? "",
        fromUid,
        toUid,
        byUid: adminUid ?? "",
        note,
        at: nowStamp(),
        counts: {
            weekly: weeklySnap.exists() ? Object.keys(weeklySnap.val()).length : 0,
            nrc: nrcSnap.exists() ? Object.keys(nrcSnap.val()).length : 0,
            community: communitySnap.exists() ? Object.keys(communitySnap.val()).length : 0,
        },
    };

    await update(ref(firebaseDatabase), updates);
    return updates[`${PATHS.reassignLog}/${logKey}`];
};

export const fetchReassignLog = async () => {
    if (IS_MOCK) return [];
    const snap = await get(ref(firebaseDatabase, PATHS.reassignLog));
    if (!snap.exists()) return [];
    const v = snap.val();
    return Object.keys(v)
        .map((k) => ({ id: k, ...v[k] }))
        .reverse();
};

const KIND_PATH = { weekly: PATHS.updates, nrc: PATHS.nrcFollowups, community: PATHS.communityFollowups };

/**
 * Soft-delete a child: enrollment + all follow-ups are moved to ADMIN_TRASH/{key}
 * in one atomic update, so the field app stops seeing it immediately and the
 * admin can restore it later.
 */
export const deleteChild = async ({ childId, workerUid, adminUid, reason = "" }) => {
    guardMock();
    if (!childId || !workerUid) throw new Error("childId and workerUid are required");
    const [enrollSnap, weeklySnap, nrcSnap, communitySnap] = await Promise.all([
        get(ref(firebaseDatabase, `${PATHS.enrollments}/${workerUid}/${childId}`)),
        get(ref(firebaseDatabase, `${PATHS.updates}/${workerUid}/${childId}`)),
        get(ref(firebaseDatabase, `${PATHS.nrcFollowups}/${workerUid}/${childId}`)),
        get(ref(firebaseDatabase, `${PATHS.communityFollowups}/${workerUid}/${childId}`)),
    ]);
    if (!enrollSnap.exists()) throw new Error("Enrollment not found");

    const trashKey = push(ref(firebaseDatabase, PATHS.trash)).key;
    const updates = {};
    updates[`${PATHS.enrollments}/${workerUid}/${childId}`] = null;
    updates[`${PATHS.updates}/${workerUid}/${childId}`] = null;
    updates[`${PATHS.nrcFollowups}/${workerUid}/${childId}`] = null;
    updates[`${PATHS.communityFollowups}/${workerUid}/${childId}`] = null;
    updates[`${PATHS.trash}/${trashKey}`] = {
        type: "child",
        childId,
        workerUid,
        childName: enrollSnap.val()?.name ?? "",
        deletedAt: nowStamp(),
        deletedBy: adminUid ?? "",
        reason,
        counts: {
            weekly: weeklySnap.exists() ? Object.keys(weeklySnap.val()).length : 0,
            nrc: nrcSnap.exists() ? Object.keys(nrcSnap.val()).length : 0,
            community: communitySnap.exists() ? Object.keys(communitySnap.val()).length : 0,
        },
        data: {
            enrollment: enrollSnap.val(),
            weekly: weeklySnap.exists() ? weeklySnap.val() : null,
            nrc: nrcSnap.exists() ? nrcSnap.val() : null,
            community: communitySnap.exists() ? communitySnap.val() : null,
        },
    };
    await update(ref(firebaseDatabase), updates);
    return trashKey;
};

/** Soft-delete one follow-up entry (kind: weekly | nrc | community). */
export const deleteFollowup = async ({ kind, workerUid, childId, entryKey, childName = "", adminUid, reason = "" }) => {
    guardMock();
    const base = KIND_PATH[kind];
    if (!base || !workerUid || !childId || !entryKey) throw new Error("kind, workerUid, childId and entryKey are required");
    const path = `${base}/${workerUid}/${childId}/${entryKey}`;
    const snap = await get(ref(firebaseDatabase, path));
    if (!snap.exists()) throw new Error("Entry not found");

    const trashKey = push(ref(firebaseDatabase, PATHS.trash)).key;
    await update(ref(firebaseDatabase), {
        [path]: null,
        [`${PATHS.trash}/${trashKey}`]: {
            type: "followup",
            kind,
            childId,
            childName,
            workerUid,
            entryKey,
            deletedAt: nowStamp(),
            deletedBy: adminUid ?? "",
            reason,
            data: snap.val(),
        },
    });
    return trashKey;
};

/** Put a trashed item back exactly where it came from. Fails if something now occupies that path. */
export const restoreFromTrash = async (trashKey) => {
    guardMock();
    const snap = await get(ref(firebaseDatabase, `${PATHS.trash}/${trashKey}`));
    if (!snap.exists()) throw new Error("Trash item not found");
    const item = snap.val();
    const updates = { [`${PATHS.trash}/${trashKey}`]: null };

    if (item.type === "child") {
        const target = `${PATHS.enrollments}/${item.workerUid}/${item.childId}`;
        if ((await get(ref(firebaseDatabase, target))).exists()) throw new Error("A child with this key already exists again — cannot restore over it");
        updates[target] = item.data.enrollment;
        if (item.data.weekly) updates[`${PATHS.updates}/${item.workerUid}/${item.childId}`] = item.data.weekly;
        if (item.data.nrc) updates[`${PATHS.nrcFollowups}/${item.workerUid}/${item.childId}`] = item.data.nrc;
        if (item.data.community) updates[`${PATHS.communityFollowups}/${item.workerUid}/${item.childId}`] = item.data.community;
    } else if (item.type === "followup") {
        const target = `${KIND_PATH[item.kind]}/${item.workerUid}/${item.childId}/${item.entryKey}`;
        if ((await get(ref(firebaseDatabase, target))).exists()) throw new Error("An entry with this key already exists — cannot restore over it");
        updates[target] = item.data;
    } else {
        throw new Error("Unknown trash item type");
    }
    await update(ref(firebaseDatabase), updates);
};

/** Permanently remove a trashed item. */
export const purgeTrash = async (trashKey) => {
    guardMock();
    await update(ref(firebaseDatabase), { [`${PATHS.trash}/${trashKey}`]: null });
};

export const fetchTrash = async () => {
    if (IS_MOCK) return [];
    const snap = await get(ref(firebaseDatabase, PATHS.trash));
    if (!snap.exists()) return [];
    const v = snap.val();
    return Object.keys(v)
        .map((k) => ({ id: k, ...v[k] }))
        .reverse();
};
