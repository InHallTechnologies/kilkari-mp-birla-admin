import { useMemo } from "react";
import moment from "moment";
import { useData } from "../context/DataContext";
import { countBy, countByMonth, fixedOrder, isNrcCase, parseAppDate, parseWeightKg } from "../utils/data";

const monthKey = (d) => {
    const m = parseAppDate(d);
    return m ? m.format("YYYY-MM") : null;
};

/** Merge several [{month,count}] series into [{month,label,<key>...}] */
const mergeMonthly = (seriesMap) => {
    const months = new Set();
    for (const list of Object.values(seriesMap)) for (const r of list) months.add(r.month);
    return [...months].sort().map((month) => {
        const row = { month, label: moment(month, "YYYY-MM").format("MMM YY") };
        for (const [k, list] of Object.entries(seriesMap)) row[k] = list.find((r) => r.month === month)?.count ?? 0;
        return row;
    });
};

export const useAnalytics = (f) => {
    const data = useData();

    return useMemo(() => {
        const children = f.applyToChildren(data.children);
        const ids = new Set(children.map((c) => c.id));
        const weekly = f.applyToFollowups(data.weekly, ids);
        const nrc = f.applyToFollowups(data.nrcFollowups, ids);
        const community = f.applyToFollowups(data.communityFollowups, ids);

        const nrcChildren = children.filter(isNrcCase);
        const communityChildren = children.filter((c) => !isNrcCase(c));

        const discharges = weekly.filter((w) => w.isChildGettingDischarged === true);
        const dischargedChildIds = new Set(discharges.map((d) => d.childId));
        const dropouts = weekly.filter((w) => w.dropoutDay);
        const referredOut = weekly.filter((w) => w.anotherFacilityReferred === "Yes");

        // Weight change per child: first vs latest recorded weight across all follow-ups (fallback to identification weight)
        const weightSeriesByChild = {};
        for (const list of [weekly, nrc, community]) {
            for (const e of list) {
                const kg = parseWeightKg(e.weight);
                const m = parseAppDate(e.followUpDate || e.inClinicServiceDay || e.timestamp);
                if (kg === null || !m) continue;
                (weightSeriesByChild[e.childId] ??= []).push({ t: m.valueOf(), kg });
            }
        }
        let gained = 0, lost = 0, same = 0, measured = 0;
        for (const c of children) {
            const pts = (weightSeriesByChild[c.id] ?? []).sort((a, b) => a.t - b.t);
            const base = parseWeightKg(c.weightAtIdentification) ?? parseWeightKg(c.admitTimeWeight);
            if (base !== null) pts.unshift({ t: 0, kg: base });
            if (pts.length < 2) continue;
            measured += 1;
            const delta = pts[pts.length - 1].kg - pts[0].kg;
            if (delta > 0.05) gained += 1;
            else if (delta < -0.05) lost += 1;
            else same += 1;
        }

        // Children with no follow-up at all
        const anyFollowup = new Set([...weekly, ...nrc, ...community].map((e) => e.childId));
        const noFollowup = children.filter((c) => !anyFollowup.has(c.id));

        // Per-worker rollup
        const workerRows = data.workers
            .filter((w) => w.access !== "admin" && w.access !== "viewer")
            .map((w) => {
                const kids = children.filter((c) => c.workerUid === w.uid);
                const kidIds = new Set(kids.map((k) => k.id));
                const wk = weekly.filter((e) => e.workerUid === w.uid || kidIds.has(e.childId)).length;
                const nr = nrc.filter((e) => e.workerUid === w.uid || kidIds.has(e.childId)).length;
                const cm = community.filter((e) => e.workerUid === w.uid || kidIds.has(e.childId)).length;
                const lastEntry = [...weekly, ...nrc, ...community]
                    .filter((e) => e.workerUid === w.uid)
                    .map((e) => parseAppDate(e.timestamp))
                    .filter(Boolean)
                    .sort((a, b) => b.valueOf() - a.valueOf())[0];
                return {
                    ...w,
                    children: kids.length,
                    nrcChildren: kids.filter(isNrcCase).length,
                    communityChildren: kids.filter((k) => !isNrcCase(k)).length,
                    weekly: wk,
                    nrc: nr,
                    community: cm,
                    total: wk + nr + cm,
                    lastEntry: lastEntry ? lastEntry.format("DD MMM YYYY") : "-",
                    lastEntryTs: lastEntry ? lastEntry.valueOf() : 0,
                };
            })
            .sort((a, b) => b.children - a.children);

        // Enrollments whose workerUid is not a known user (orphan / deleted worker)
        const knownUids = new Set(data.workers.map((w) => w.uid));
        const orphanChildren = children.filter((c) => !knownUids.has(c.workerUid));

        // ---- Nutritional status transitions (SAM <-> MAM <-> Normal) ----
        // Initial = samMamStatus at identification. Later assessments come from
        // weekly discharge condition (SAM/MAM/NORMAL) and community follow-up
        // nutritionCategory (free text). Latest dated assessment wins.
        const normStatus = (v) => {
            const s = String(v ?? "").trim().toUpperCase();
            if (!s) return null;
            if (s.startsWith("SAM")) return "SAM";
            if (s.startsWith("MAM")) return "MAM";
            if (s.startsWith("NORM") || s === "सामान्य" || s.startsWith("SAMANYA")) return "Normal";
            return null;
        };
        const assessments = {}; // childId -> [{t, status, source, date}]
        for (const w of weekly) {
            const st = normStatus(w.dischargeConditionAtDischarge);
            const m = parseAppDate(w.inClinicServiceDay || w.timestamp);
            if (st && m) (assessments[w.childId] ??= []).push({ t: m.valueOf(), status: st, source: "NRC discharge", date: m.format("DD MMM YYYY") });
        }
        for (const e of community) {
            const st = normStatus(e.nutritionCategory);
            const m = parseAppDate(e.followUpDate || e.timestamp);
            if (st && m) (assessments[e.childId] ??= []).push({ t: m.valueOf(), status: st, source: "Community follow-up", date: m.format("DD MMM YYYY") });
        }
        const STATUSES = ["SAM", "MAM", "Normal"];
        const matrix = { SAM: { SAM: 0, MAM: 0, Normal: 0 }, MAM: { SAM: 0, MAM: 0, Normal: 0 } };
        const transitionRows = []; // one per reassessed child
        let notReassessed = 0, unknownInitial = 0;
        for (const c of children) {
            const initial = normStatus(c.samMamStatus);
            if (!initial || initial === "Normal") { unknownInitial += 1; continue; }
            const list = (assessments[c.id] ?? []).sort((a, b) => a.t - b.t);
            if (!list.length) { notReassessed += 1; continue; }
            const latest = list[list.length - 1];
            matrix[initial][latest.status] += 1;
            transitionRows.push({
                id: c.id,
                name: c.name,
                workerName: c.workerName,
                villageName: c.villageName,
                caseType: isNrcCase(c) ? "NRC" : "Community",
                initial,
                latest: latest.status,
                latestDate: latest.date,
                latestSource: latest.source,
                assessments: list.length,
                change: initial === latest.status ? "unchanged" : STATUSES.indexOf(latest.status) > STATUSES.indexOf(initial) ? "improved" : "deteriorated",
            });
        }
        const statusTransitions = {
            matrix,
            rows: transitionRows,
            samToMam: matrix.SAM.MAM,
            samToNormal: matrix.SAM.Normal,
            samUnchanged: matrix.SAM.SAM,
            mamToSam: matrix.MAM.SAM,
            mamToNormal: matrix.MAM.Normal,
            mamUnchanged: matrix.MAM.MAM,
            improved: transitionRows.filter((r) => r.change === "improved").length,
            deteriorated: transitionRows.filter((r) => r.change === "deteriorated").length,
            unchanged: transitionRows.filter((r) => r.change === "unchanged").length,
            reassessed: transitionRows.length,
            notReassessed,
            unknownInitial,
        };

        return {
            children,
            nrcChildren,
            communityChildren,
            weekly,
            nrc,
            community,
            allFollowups: [...weekly, ...nrc, ...community],
            discharges,
            dischargedChildIds,
            dropouts,
            referredOut,
            noFollowup,
            orphanChildren,
            statusTransitions,
            weight: { gained, lost, same, measured },
            workerRows,
            enrollmentsByMonth: mergeMonthly({
                nrc: countByMonth(nrcChildren, (c) => c.enrollmentDate || c.timestamp),
                community: countByMonth(communityChildren, (c) => c.enrollmentDate || c.timestamp),
            }),
            followupsByMonth: mergeMonthly({
                weekly: countByMonth(weekly, (e) => e.timestamp),
                nrc: countByMonth(nrc, (e) => e.timestamp),
                community: countByMonth(community, (e) => e.timestamp),
            }),
            by: {
                caseType: fixedOrder(countBy(children, (c) => (isNrcCase(c) ? "NRC" : "Community")), ["NRC", "Community"]),
                samMam: fixedOrder(countBy(children, (c) => c.samMamStatus), ["SAM", "MAM"]),
                referred: fixedOrder(countBy(children.filter((c) => c.samMamStatus === "SAM"), (c) => c.referredToNrc), ["Yes", "No"]),
                gender: fixedOrder(countBy(children, (c) => c.gender), ["Male", "Female", "Other"]),
                caste: countBy(children, (c) => c.caste),
                tahasil: countBy(children, (c) => c.tahasil),
                village: countBy(children, (c) => c.villageName),
                worker: countBy(children, (c) => c.workerName),
                dischargeCondition: fixedOrder(countBy(discharges, (d) => d.dischargeConditionAtDischarge), ["NORMAL", "MAM", "SAM"]),
                nutritionCategory: countBy(community, (e) => String(e.nutritionCategory ?? "").trim().toUpperCase()),
                conditionImproved: fixedOrder(countBy(community, (e) => e.isConditionImproved), ["Yes", "No"]),
                guidelinesFollowed: fixedOrder(countBy(community, (e) => e.followingGuidelinesAfterDischarge), ["Yes", "No"]),
                nrcWent: fixedOrder(countBy(nrc, (e) => e.isNrcFollowupRequired), ["Yes", "No"]),
                nrcFoodProvided: fixedOrder(countBy(nrc.filter((e) => e.isNrcFollowupRequired === "Yes"), (e) => e.wasFoodProvided), ["Yes", "No"]),
                weightChange: [
                    { key: "Gained", count: gained },
                    { key: "No change", count: same },
                    { key: "Lost", count: lost },
                ],
            },
            monthKey,
        };
    }, [data, f]);
};
