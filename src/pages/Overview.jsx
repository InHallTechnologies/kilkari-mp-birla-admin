import { useState } from "react";
import { Spinner } from "@chakra-ui/react";
import { MdVerified } from "react-icons/md";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useFilters } from "../hooks/useFilters";
import { useAnalytics } from "../hooks/useAnalytics";
import FilterBar from "../components/FilterBar";
import { Card, StatTile, Tabs, DataTable } from "../components/ui";
import { BreakdownBars, ColumnChart, SplitBar, TrendChart } from "../components/charts";

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : "-");

const Overview = () => {
    const { isViewer, profile } = useAuth();
    const { loading, error, loadedAt } = useData();
    const f = useFilters();
    const a = useAnalytics(f);
    const [tab, setTab] = useState("summary");

    if (loading) return <div style={{ display: "grid", placeItems: "center", height: "60vh" }}><Spinner size="xl" color="#1e8884" /></div>;
    if (error) return <div className="card" style={{ color: "#b42323" }}>Failed to load data: {error}. Check Firebase rules allow the admin to read the root paths.</div>;

    const activeWorkers = a.workerRows.filter((w) => w.status !== "inactive").length;

    return (
        <>
            {isViewer ? (
                <div className="viewer-hero">
                    <div>
                        <span className="hero-badge">
                            <MdVerified /> MP Birla · Programme Insights
                        </span>
                        <h1>Kilkari Dashboard</h1>
                        <p className="sub">
                            Welcome{profile?.name ? `, ${profile.name}` : ""} — live analytics from the malnutrition initiative in Satna, Madhya Pradesh.
                            {loadedAt ? ` Data as of ${loadedAt.toLocaleString()}.` : ""}
                        </p>
                    </div>
                    <div className="hero-logos">
                        <img src="/logo.jpg" alt="MP Birla" />
                        <img src="/asra.png" alt="Asra" />
                    </div>
                </div>
            ) : (
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Overview</h1>
                        <p className="page-subtitle">Programme-wide analytics across all entry makers. Filters apply to every tab.</p>
                    </div>
                </div>
            )}

            <FilterBar f={f} />

            <div className="grid grid-4" style={{ marginBottom: 16 }}>
                <StatTile label="Children enrolled" value={a.children.length} hint={`${a.nrcChildren.length} NRC · ${a.communityChildren.length} Community`} />
                <StatTile label="Follow-ups logged" value={a.allFollowups.length} hint={`${a.weekly.length} weekly · ${a.nrc.length} NRC · ${a.community.length} community`} />
                <StatTile label="Discharged from NRC" value={a.dischargedChildIds.size} hint={`${pct(a.dischargedChildIds.size, a.nrcChildren.length)} of NRC children`} />
                <StatTile label="Entry makers" value={a.workerRows.length} hint={`${activeWorkers} active`} />
            </div>

            <Tabs
                active={tab}
                onChange={setTab}
                tabs={[
                    { key: "summary", label: "Summary" },
                    { key: "demographics", label: "Demographics" },
                    { key: "outcomes", label: "Outcomes" },
                    { key: "status", label: "SAM ↔ MAM changes" },
                    { key: "workers", label: "Entry makers" },
                ]}
            />

            {tab === "summary" && (
                <>
                    <div className="grid grid-2">
                        <Card title="Enrollments per month" sub="By case type at enrollment date">
                            <ColumnChart
                                data={a.enrollmentsByMonth}
                                stacked
                                series={[
                                    { key: "nrc", label: "NRC" },
                                    { key: "community", label: "Community" },
                                ]}
                            />
                        </Card>
                        <Card title="Follow-ups per month" sub="All three follow-up forms">
                            <TrendChart
                                data={a.followupsByMonth}
                                series={[
                                    { key: "weekly", label: "Weekly (in NRC)" },
                                    { key: "nrc", label: "NRC follow-up" },
                                    { key: "community", label: "Community" },
                                ]}
                            />
                        </Card>
                    </div>
                    <div className="grid grid-3" style={{ marginTop: 16 }}>
                        <Card title="Case type">
                            <SplitBar data={a.by.caseType} />
                        </Card>
                        <Card title="SAM / MAM at identification">
                            <SplitBar data={a.by.samMam} />
                        </Card>
                        <Card title="SAM children referred to NRC">
                            <SplitBar data={a.by.referred} />
                        </Card>
                    </div>
                    <div className="grid grid-2" style={{ marginTop: 16 }}>
                        <Card title="Children by entry maker">
                            <BreakdownBars data={a.by.worker} />
                        </Card>
                        <Card title="Attention needed">
                            <div className="grid grid-2">
                                <StatTile label="No follow-up yet" value={a.noFollowup.length} hint="Enrolled but never followed up" />
                                <StatTile label="Dropouts recorded" value={a.dropouts.length} hint="Weekly entries with a dropout day" />
                                <StatTile label="Referred elsewhere" value={a.referredOut.length} hint="Weekly entries referred to another facility" />
                                <StatTile label="Orphaned records" value={a.orphanChildren.length} hint="Enrolled by a uid not in USERS_ARCHIVE" />
                            </div>
                        </Card>
                    </div>
                </>
            )}

            {tab === "demographics" && (
                <>
                    <div className="grid grid-3">
                        <Card title="Gender">
                            <SplitBar data={a.by.gender} />
                        </Card>
                        <Card title="Caste">
                            <BreakdownBars data={a.by.caste} />
                        </Card>
                        <Card title="Tehsil">
                            <BreakdownBars data={a.by.tahasil} />
                        </Card>
                    </div>
                    <div className="grid grid-2" style={{ marginTop: 16 }}>
                        <Card title="Top villages" sub="Top 15 by enrollments">
                            <BreakdownBars data={a.by.village} max={15} />
                        </Card>
                        <Card title="Gender × case type">
                            <ColumnChart
                                data={["Male", "Female", "Other", "Not set"].map((g) => ({
                                    label: g,
                                    nrc: a.nrcChildren.filter((c) => (c.gender || "Not set") === g).length,
                                    community: a.communityChildren.filter((c) => (c.gender || "Not set") === g).length,
                                }))}
                                series={[
                                    { key: "nrc", label: "NRC" },
                                    { key: "community", label: "Community" },
                                ]}
                            />
                        </Card>
                    </div>
                </>
            )}

            {tab === "outcomes" && (
                <>
                    <div className="grid grid-4" style={{ marginBottom: 16 }}>
                        <StatTile label="Children with ≥2 weights" value={a.weight.measured} hint="Weight trend measurable" />
                        <StatTile label="Gained weight" value={a.weight.gained} hint={pct(a.weight.gained, a.weight.measured)} />
                        <StatTile label="Lost weight" value={a.weight.lost} hint={pct(a.weight.lost, a.weight.measured)} />
                        <StatTile label="Discharges" value={a.discharges.length} hint="Weekly entries marked discharged" />
                    </div>
                    <div className="grid grid-3">
                        <Card title="Weight change (first → latest)">
                            <SplitBar data={a.by.weightChange} />
                        </Card>
                        <Card title="Condition at discharge">
                            <SplitBar data={a.by.dischargeCondition} />
                        </Card>
                        <Card title="Community: condition improved?">
                            <SplitBar data={a.by.conditionImproved} />
                        </Card>
                    </div>
                    <div className="grid grid-3" style={{ marginTop: 16 }}>
                        <Card title="Community: nutrition category">
                            <BreakdownBars data={a.by.nutritionCategory} />
                        </Card>
                        <Card title="Community: following guidelines?">
                            <SplitBar data={a.by.guidelinesFollowed} />
                        </Card>
                        <Card title="NRC: went for follow-up?">
                            <SplitBar data={a.by.nrcWent} />
                            <div style={{ height: 14 }} />
                            <h3 className="card-title">NRC: food provided after follow-up</h3>
                            <SplitBar data={a.by.nrcFoodProvided} />
                        </Card>
                    </div>
                </>
            )}

            {tab === "status" && (() => {
                const s = a.statusTransitions;
                const cell = (n, tone) => (
                    <td style={{ textAlign: "center", fontWeight: 700, fontSize: "1.05rem", background: tone === "good" ? "#e6f6ee" : tone === "bad" ? "#fdecec" : "#f7fafc", color: tone === "good" ? "#1f7a52" : tone === "bad" ? "#b42323" : "#2d3748" }}>
                        {n}
                    </td>
                );
                const changeCols = [
                    { key: "name", label: "Child", render: (r) => <b>{r.name || "-"}</b> },
                    { key: "initial", label: "At identification" },
                    { key: "latest", label: "Latest status" },
                    {
                        key: "change",
                        label: "Change",
                        render: (r) => (
                            <span className={`pill ${r.change === "improved" ? "active" : r.change === "deteriorated" ? "inactive" : ""}`} style={r.change === "unchanged" ? { background: "#edf2f7", color: "#4a5568" } : undefined}>
                                {r.change}
                            </span>
                        ),
                    },
                    { key: "latestDate", label: "Assessed on" },
                    { key: "latestSource", label: "Source" },
                    { key: "assessments", label: "# assessments" },
                    { key: "caseType", label: "Case" },
                    { key: "villageName", label: "Village" },
                    { key: "workerName", label: "Entry maker" },
                ];
                const [changed, others] = [s.rows.filter((r) => r.change !== "unchanged"), s.rows.filter((r) => r.change === "unchanged")];
                return (
                    <>
                        <div className="grid grid-4" style={{ marginBottom: 16 }}>
                            <StatTile label="SAM → MAM (improved)" value={s.samToMam} hint={`${pct(s.samToMam, s.reassessed)} of reassessed`} />
                            <StatTile label="MAM → SAM (deteriorated)" value={s.mamToSam} hint={`${pct(s.mamToSam, s.reassessed)} of reassessed`} />
                            <StatTile label="Recovered to Normal" value={s.samToNormal + s.mamToNormal} hint={`${s.samToNormal} from SAM · ${s.mamToNormal} from MAM`} />
                            <StatTile label="Not reassessed yet" value={s.notReassessed} hint="No discharge condition or community category recorded" />
                        </div>
                        <div className="grid grid-2">
                            <Card title="Transition matrix" sub="Rows: status at SAM/MAM identification · Columns: latest assessed status">
                                <div className="table-wrap">
                                    <table className="data">
                                        <thead>
                                            <tr>
                                                <th>Identified as ↓ / Now →</th>
                                                <th style={{ textAlign: "center" }}>SAM</th>
                                                <th style={{ textAlign: "center" }}>MAM</th>
                                                <th style={{ textAlign: "center" }}>Normal</th>
                                                <th style={{ textAlign: "center" }}>Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td><b>SAM</b></td>
                                                {cell(s.matrix.SAM.SAM, "neutral")}
                                                {cell(s.matrix.SAM.MAM, "good")}
                                                {cell(s.matrix.SAM.Normal, "good")}
                                                <td style={{ textAlign: "center" }}>{s.matrix.SAM.SAM + s.matrix.SAM.MAM + s.matrix.SAM.Normal}</td>
                                            </tr>
                                            <tr>
                                                <td><b>MAM</b></td>
                                                {cell(s.matrix.MAM.SAM, "bad")}
                                                {cell(s.matrix.MAM.MAM, "neutral")}
                                                {cell(s.matrix.MAM.Normal, "good")}
                                                <td style={{ textAlign: "center" }}>{s.matrix.MAM.SAM + s.matrix.MAM.MAM + s.matrix.MAM.Normal}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <p className="muted" style={{ fontSize: "0.78rem", marginTop: 10, marginBottom: 0 }}>
                                    Latest status comes from the most recent of: NRC discharge condition (weekly update) or community follow-up nutrition
                                    category. {s.reassessed} of {a.children.length} children have at least one later assessment
                                    {s.unknownInitial ? `; ${s.unknownInitial} have no SAM/MAM status at identification and are excluded` : ""}.
                                </p>
                            </Card>
                            <Card title="Overall direction" sub="Among reassessed children">
                                <SplitBar
                                    data={[
                                        { key: "Improved", count: s.improved },
                                        { key: "Unchanged", count: s.unchanged },
                                        { key: "Deteriorated", count: s.deteriorated },
                                    ]}
                                />
                                <div className="grid grid-3" style={{ marginTop: 16, gap: 10 }}>
                                    <StatTile label="Improved" value={s.improved} hint={pct(s.improved, s.reassessed)} />
                                    <StatTile label="Unchanged" value={s.unchanged} hint={pct(s.unchanged, s.reassessed)} />
                                    <StatTile label="Deteriorated" value={s.deteriorated} hint={pct(s.deteriorated, s.reassessed)} />
                                </div>
                            </Card>
                        </div>
                        <Card title="Children whose status changed" sub="Improved and deteriorated cases — deteriorated first" style={{ marginTop: 16 }}>
                            <DataTable
                                rows={[...changed].sort((x, y) => (x.change === "deteriorated" ? -1 : 1) - (y.change === "deteriorated" ? -1 : 1))}
                                columns={changeCols}
                                empty="No status changes recorded yet."
                            />
                        </Card>
                        <Card title="Reassessed but unchanged" style={{ marginTop: 16 }}>
                            <DataTable rows={others} columns={changeCols} empty="—" pageSize={25} />
                        </Card>
                    </>
                );
            })()}

            {tab === "workers" && (
                <Card title="Entry maker activity" sub="Children and follow-ups within the current filters">
                    <DataTable
                        rows={a.workerRows}
                        rowKey={(r) => r.uid}
                        columns={[
                            { key: "name", label: "Name", render: (r) => r.name || <span className="muted">{r.emailId}</span> },
                            { key: "emailId", label: "Email" },
                            { key: "status", label: "Status", render: (r) => <span className={`pill ${r.status === "inactive" ? "inactive" : "active"}`}>{r.status || "active"}</span> },
                            { key: "children", label: "Children" },
                            { key: "nrcChildren", label: "NRC" },
                            { key: "communityChildren", label: "Community" },
                            { key: "weekly", label: "Weekly upd." },
                            { key: "nrc", label: "NRC f/u" },
                            { key: "community", label: "Community f/u" },
                            { key: "total", label: "Total entries" },
                            { key: "lastEntry", label: "Last entry" },
                        ]}
                    />
                </Card>
            )}
        </>
    );
};

export default Overview;
