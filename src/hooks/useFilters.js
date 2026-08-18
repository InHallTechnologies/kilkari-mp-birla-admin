import { useCallback, useMemo, useState } from "react";
import moment from "moment";
import { isNrcCase, parseAppDate } from "../utils/data";

export const EMPTY_FILTERS = {
    search: "",
    workerUid: "",
    caseType: "",
    gender: "",
    caste: "",
    samMamStatus: "",
    tahasil: "",
    from: "",
    to: "",
};

/**
 * One filter state shared by every analytics page. `applyToChildren` filters
 * enrollments; `applyToFollowups` keeps follow-ups whose child survived the
 * child filter AND whose own timestamp is inside the date range.
 */
export const useFilters = () => {
    const [filters, setFilters] = useState(EMPTY_FILTERS);

    const set = useCallback((key, value) => setFilters((f) => ({ ...f, [key]: value })), []);
    const reset = useCallback(() => setFilters(EMPTY_FILTERS), []);
    const isActive = useMemo(() => Object.values(filters).some(Boolean), [filters]);

    const from = filters.from ? moment(filters.from, "YYYY-MM-DD").startOf("day") : null;
    const to = filters.to ? moment(filters.to, "YYYY-MM-DD").endOf("day") : null;

    const inRange = useCallback(
        (dateStr) => {
            if (!from && !to) return true;
            const m = parseAppDate(dateStr);
            if (!m) return false;
            if (from && m.isBefore(from)) return false;
            if (to && m.isAfter(to)) return false;
            return true;
        },
        [from, to]
    );

    const applyToChildren = useCallback(
        (children, { ignoreDate = false } = {}) => {
            const q = filters.search.trim().toLowerCase();
            return children.filter((c) => {
                if (filters.workerUid && c.workerUid !== filters.workerUid) return false;
                if (filters.caseType === "nrc" && !isNrcCase(c)) return false;
                if (filters.caseType === "community" && isNrcCase(c)) return false;
                if (filters.gender && (c.gender ?? "") !== filters.gender) return false;
                if (filters.caste && (c.caste ?? "") !== filters.caste) return false;
                if (filters.samMamStatus && (c.samMamStatus ?? "") !== filters.samMamStatus) return false;
                if (filters.tahasil && (c.tahasil ?? "") !== filters.tahasil) return false;
                if (!ignoreDate && !inRange(c.enrollmentDate || c.timestamp)) return false;
                if (q) {
                    const hay = [c.name, c.samNumber, c.fatherName, c.motherName, c.villageName, c.phoneNumber]
                        .map((v) => String(v ?? "").toLowerCase())
                        .join(" ");
                    if (!hay.includes(q)) return false;
                }
                return true;
            });
        },
        [filters, inRange]
    );

    const applyToFollowups = useCallback(
        (followups, allowedChildIds) =>
            followups.filter((f) => allowedChildIds.has(f.childId) && inRange(f.timestamp || f.entryDate)),
        [inRange]
    );

    return { filters, set, reset, isActive, applyToChildren, applyToFollowups };
};
