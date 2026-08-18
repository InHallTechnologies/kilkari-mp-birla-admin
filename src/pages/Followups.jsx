import { useState } from "react";
import { Button, Spinner } from "@chakra-ui/react";
import moment from "moment";
import { useData } from "../context/DataContext";
import { useFilters } from "../hooks/useFilters";
import { useAnalytics } from "../hooks/useAnalytics";
import FilterBar from "../components/FilterBar";
import ChildDetailDialog from "../components/ChildDetailDialog";
import { Card, DataTable, StatTile, Tabs } from "../components/ui";
import { BreakdownBars, ColumnChart } from "../components/charts";
import { downloadText, fmtDate, toCsv } from "../utils/data";
import { useDeleter } from "../hooks/useDeleter";

const WEEKLY_CHECKS = [
    ["wasBabyFed", "Porridge/khichdi fed"],
    ["wasBabyGivenMilkFormula", "Milk/formula given"],
    ["wasMotherFed", "Mother fed"],
    ["homeMadeProteinFoodGiven", "Nutritional food"],
    ["roWaterAvailable", "Clean water"],
    ["wasBeddingClothingDone", "Bedding/clothing"],
    ["handWashTrainingDone", "Handwash training"],
    ["teethBrushed", "Teeth brushed"],
    ["wasGroomingDone", "Grooming"],
    ["washroomHygieneFollowed", "Toilet hygiene"],
    ["sanitizationDone", "Sanitization"],
    ["houseFloorCleaned", "Floor cleaned"],
    ["threeTimeDoctorVisitDone", "3× doctor visit"],
];

const yesRate = (rows, key) => {
    const answered = rows.filter((r) => r[key] === "Yes" || r[key] === "No");
    const yes = answered.filter((r) => r[key] === "Yes").length;
    return { key, answered: answered.length, yes, pct: answered.length ? Math.round((yes / answered.length) * 100) : null };
};

const Followups = () => {
    const { loading, childById } = useData();
    const f = useFilters();
    const a = useAnalytics(f);
    const [tab, setTab] = useState("weekly");
    const [selected, setSelected] = useState(null);
    const { requestDeleteFollowup, dialog: deleteDialog } = useDeleter();

    if (loading) return <div style={{ display: "grid", placeItems: "center", height: "60vh" }}><Spinner size="xl" color="#1e8884" /></div>;

    const childCol = { key: "childName", label: "Child", render: (r) => <b>{r.childName || childById[r.childId]?.name || "-"}</b> };
    const workerCol = { key: "workerUid", label: "Entry maker", render: (r) => childById[r.childId]?.workerName ?? r.workerUid };
    const entryCol = { key: "timestamp", label: "Entered", render: (r) => fmtDate(r.timestamp, "DD MMM YYYY, h:mm a") };
    const actionsCol = {
        key: "_actions",
        label: "Actions",
        render: (r) => (
            <div style={{ display: "flex", gap: 6 }}>
                <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); setSelected(childById[r.childId] ?? null); }}>
                    Child
                </Button>
                <Button size="xs" variant="outline" colorPalette="red" onClick={(e) => { e.stopPropagation(); requestDeleteFollowup(r); }}>
                    Delete
                </Button>
            </div>
        ),
    };

    const tables = {
        weekly: {
            rows: a.weekly,
            cols: [
                actionsCol, entryCol, childCol, workerCol, { key: "entryByName", label: "By" },
                { key: "inClinicServiceDay", label: "Clinic day", render: (r) => fmtDate(r.inClinicServiceDay) },
                { key: "weight", label: "Weight" }, { key: "wasBabyFed", label: "Fed" }, { key: "wasMotherFed", label: "Mother fed" },
                { key: "homeMadeProteinFoodGiven", label: "Nutrition food" }, { key: "whathomeMadeProteinFoodGiven", label: "What" },
                { key: "anotherFacilityReferred", label: "Referred" }, { key: "anotherFacilityName", label: "Facility" },
                { key: "dropoutDay", label: "Dropout", render: (r) => fmtDate(r.dropoutDay) },
                { key: "isChildGettingDischarged", label: "Discharged" }, { key: "dischargeConditionAtDischarge", label: "Condition" },
            ],
        },
        nrc: {
            rows: a.nrc,
            cols: [
                actionsCol, entryCol, childCol, workerCol, { key: "isNrcFollowupRequired", label: "Went?" },
                { key: "nrcFollowupExpectedDate", label: "Expected", render: (r) => fmtDate(r.nrcFollowupExpectedDate) },
                { key: "nrcFollowUpNumber", label: "F/u no." }, { key: "wasFollowUpDone", label: "Came?" },
                { key: "followUpDate", label: "Date", render: (r) => fmtDate(r.followUpDate) },
                { key: "wasFoodProvided", label: "Food" }, { key: "weight", label: "Weight" }, { key: "height", label: "Height" },
            ],
        },
        community: {
            rows: a.community,
            cols: [
                actionsCol, entryCol, childCol, workerCol, { key: "followUpWorkerName", label: "F/u worker" },
                { key: "followUpDate", label: "Date", render: (r) => fmtDate(r.followUpDate) },
                { key: "weight", label: "Weight" }, { key: "height", label: "Height" }, { key: "nutritionCategory", label: "Category" },
                { key: "isConditionImproved", label: "Improved" }, { key: "anyHealthProblemAfterDischarge", label: "Health problems" },
                { key: "followingGuidelinesAfterDischarge", label: "Guidelines" }, { key: "otherObservations", label: "Observations" },
            ],
        },
    };
    const t = tables[tab];

    const exportCsv = () => {
        const cols = [
            ...t.cols.filter((c) => c.key !== "_actions").map((c) => ({ key: c.key, label: c.label, render: c.key === "childName" ? (r) => r.childName || childById[r.childId]?.name || "" : c.key === "workerUid" ? (r) => childById[r.childId]?.workerName ?? r.workerUid : undefined })),
            { key: "childId", label: "Child key" },
        ];
        downloadText(`kilkari_${tab}_followups_${moment().format("YYYY-MM-DD")}.csv`, toCsv(cols, t.rows));
    };

    const weeklyRates = WEEKLY_CHECKS.map(([key, label]) => ({ ...yesRate(a.weekly, key), label })).filter((r) => r.answered > 0);
    const upcomingNrc = a.nrc
        .filter((r) => r.isNrcFollowupRequired === "No" && r.nrcFollowupExpectedDate)
        .map((r) => ({ ...r, due: moment(r.nrcFollowupExpectedDate, "YYYY-MM-DD") }))
        .filter((r) => r.due.isValid())
        .sort((x, y) => x.due.valueOf() - y.due.valueOf());
    const overdue = upcomingNrc.filter((r) => r.due.isBefore(moment(), "day"));

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Follow-ups</h1>
                    <p className="page-subtitle">All follow-up entries across entry makers. Date filter applies to the entry timestamp.</p>
                </div>
                <Button onClick={exportCsv} variant="outline">
                    Export CSV ({t.rows.length})
                </Button>
            </div>
            <FilterBar f={f} />
            <Tabs
                active={tab}
                onChange={setTab}
                tabs={[
                    { key: "weekly", label: "Weekly (in NRC)", count: a.weekly.length },
                    { key: "nrc", label: "NRC follow-ups", count: a.nrc.length },
                    { key: "community", label: "Community follow-ups", count: a.community.length },
                ]}
            />

            {tab === "weekly" && (
                <div className="grid grid-2" style={{ marginBottom: 16 }}>
                    <Card title="NRC checklist compliance" sub="% of answered entries marked Yes">
                        <BreakdownBars data={weeklyRates.map((r) => ({ key: r.label, count: r.pct })).sort((x, y) => y.count - x.count)} max={13} />
                    </Card>
                    <Card title="Discharges & referrals per month">
                        <ColumnChart
                            data={a.followupsByMonth.map((m) => ({
                                label: m.label,
                                discharged: a.discharges.filter((d) => a.monthKey(d.timestamp) === m.month).length,
                                referred: a.referredOut.filter((d) => a.monthKey(d.timestamp) === m.month).length,
                                dropout: a.dropouts.filter((d) => a.monthKey(d.timestamp) === m.month).length,
                            }))}
                            series={[
                                { key: "discharged", label: "Discharged" },
                                { key: "referred", label: "Referred elsewhere" },
                                { key: "dropout", label: "Dropout" },
                            ]}
                        />
                    </Card>
                </div>
            )}

            {tab === "nrc" && (
                <div className="grid grid-4" style={{ marginBottom: 16 }}>
                    <StatTile label="Went for follow-up" value={a.nrc.filter((r) => r.isNrcFollowupRequired === "Yes").length} />
                    <StatTile label="Did not go (expected later)" value={a.nrc.filter((r) => r.isNrcFollowupRequired === "No").length} />
                    <StatTile label="Expected follow-ups overdue" value={overdue.length} hint="Expected date has passed" />
                    <StatTile label="Food provided" value={a.nrc.filter((r) => r.wasFoodProvided === "Yes").length} />
                </div>
            )}

            {tab === "community" && (
                <div className="grid grid-4" style={{ marginBottom: 16 }}>
                    <StatTile label="Condition improved" value={a.community.filter((r) => r.isConditionImproved === "Yes").length} />
                    <StatTile label="Not improved" value={a.community.filter((r) => r.isConditionImproved === "No").length} />
                    <StatTile label="Following guidelines" value={a.community.filter((r) => r.followingGuidelinesAfterDischarge === "Yes").length} />
                    <StatTile label="Health problems noted" value={a.community.filter((r) => String(r.anyHealthProblemAfterDischarge ?? "").trim() && !/^(no|nahi|नहीं)$/i.test(String(r.anyHealthProblemAfterDischarge).trim())).length} />
                </div>
            )}

            <Card>
                <DataTable rows={t.rows} columns={t.cols} onRowClick={(r) => setSelected(childById[r.childId] ?? null)} empty="No entries match the current filters." />
            </Card>

            <ChildDetailDialog child={selected} onClose={() => setSelected(null)} />
            {deleteDialog}
        </>
    );
};

export default Followups;
