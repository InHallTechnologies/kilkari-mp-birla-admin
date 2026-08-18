import { useState } from "react";
import { Spinner } from "@chakra-ui/react";
import { useData } from "../context/DataContext";
import { useFilters } from "../hooks/useFilters";
import { useAnalytics } from "../hooks/useAnalytics";
import FilterBar from "../components/FilterBar";
import { Card, StatTile, Tabs, DataTable } from "../components/ui";
import { BreakdownBars, ColumnChart, SplitBar, TrendChart } from "../components/charts";

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : "-");

const Overview = () => {
    const { loading, error } = useData();
    const f = useFilters();
    const a = useAnalytics(f);
    const [tab, setTab] = useState("summary");

    if (loading) return <div style={{ display: "grid", placeItems: "center", height: "60vh" }}><Spinner size="xl" color="#1e8884" /></div>;
    if (error) return <div className="card" style={{ color: "#b42323" }}>Failed to load data: {error}. Check Firebase rules allow the admin to read the root paths.</div>;

    const activeWorkers = a.workerRows.filter((w) => w.status !== "inactive").length;

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Overview</h1>
                    <p className="page-subtitle">Programme-wide analytics across all entry makers. Filters apply to every tab.</p>
                </div>
            </div>

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
