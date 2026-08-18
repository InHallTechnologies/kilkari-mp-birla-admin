import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

/* eslint-disable react-refresh/only-export-components -- palette constants live with the charts */
/* Validated categorical palette (light surface), fixed order — never cycled. */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
export const SEQ = "#2a78d6";
const GRID = "#edf2f7";
const AXIS = "#718096";
const TICK = { fill: AXIS, fontSize: 11 };

const Tip = ({ active, payload, label, seriesLabels }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="viz-tip">
            <b>{label}</b>
            {payload.map((p) => (
                <div className="row" key={p.dataKey}>
                    <span className="sw" style={{ background: p.color || p.fill }} />
                    <span className="muted">{seriesLabels?.[p.dataKey] ?? p.name ?? p.dataKey}</span>
                    <span style={{ marginLeft: "auto", fontWeight: 600 }}>{p.value}</span>
                </div>
            ))}
        </div>
    );
};

const Legend = ({ series }) =>
    series.length >= 2 ? (
        <div className="legend">
            {series.map((s, i) => (
                <span key={s.key}>
                    <span className="sw" style={{ background: s.color ?? SERIES[i] }} />
                    {s.label}
                </span>
            ))}
        </div>
    ) : null;

/** Horizontal single-series bars for a categorical breakdown: data = [{key,count}] */
export const BreakdownBars = ({ data, height, color = SEQ, max = 12 }) => {
    const rows = data.slice(0, max);
    const h = height ?? Math.max(120, rows.length * 30 + 20);
    if (!rows.length) return <div className="empty">No data</div>;
    return (
        <ResponsiveContainer width="100%" height={h}>
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 8 }} barCategoryGap={6}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="key" tick={TICK} axisLine={false} tickLine={false} width={150} interval={0} />
                <Tooltip content={<Tip seriesLabels={{ count: "Count" }} />} cursor={{ fill: "#f0f5f9" }} />
                <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false} label={{ position: "right", fill: AXIS, fontSize: 11 }} />
            </BarChart>
        </ResponsiveContainer>
    );
};

/** Vertical bars over time or ordered categories. series=[{key,label,color?}] ; stacked optional */
export const ColumnChart = ({ data, series, xKey = "label", height = 240, stacked = false }) => {
    if (!data.length) return <div className="empty">No data</div>;
    const labels = Object.fromEntries(series.map((s) => [s.key, s.label]));
    return (
        <>
            <ResponsiveContainer width="100%" height={height}>
                <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }} barCategoryGap="30%" barGap={2}>
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey={xKey} tick={TICK} axisLine={false} tickLine={false} />
                    <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<Tip seriesLabels={labels} />} cursor={{ fill: "#f0f5f9" }} />
                    {series.map((s, i) => (
                        <Bar
                            key={s.key}
                            dataKey={s.key}
                            name={s.label}
                            stackId={stacked ? "a" : undefined}
                            fill={s.color ?? SERIES[i]}
                            stroke={stacked ? "#fff" : undefined}
                            strokeWidth={stacked ? 2 : 0}
                            radius={!stacked || i === series.length - 1 ? [4, 4, 0, 0] : 0}
                            maxBarSize={36}
                            isAnimationActive={false}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
            <Legend series={series} />
        </>
    );
};

/** Multi-series line chart with crosshair tooltip. */
export const TrendChart = ({ data, series, xKey = "label", height = 240 }) => {
    if (!data.length) return <div className="empty">No data</div>;
    const labels = Object.fromEntries(series.map((s) => [s.key, s.label]));
    return (
        <>
            <ResponsiveContainer width="100%" height={height}>
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey={xKey} tick={TICK} axisLine={false} tickLine={false} />
                    <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<Tip seriesLabels={labels} />} cursor={{ stroke: "#cbd5e0", strokeDasharray: "3 3" }} />
                    {series.map((s, i) => (
                        <Line
                            key={s.key}
                            type="monotone"
                            dataKey={s.key}
                            name={s.label}
                            stroke={s.color ?? SERIES[i]}
                            strokeWidth={2}
                            dot={{ r: 3, strokeWidth: 2, fill: "#fff" }}
                            activeDot={{ r: 5 }}
                            isAnimationActive={false}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
            <Legend series={series} />
        </>
    );
};

/** Parts-of-whole as one thin horizontal stacked bar + legend with counts. data=[{key,count}] */
export const SplitBar = ({ data }) => {
    const total = data.reduce((s, d) => s + d.count, 0);
    if (!total) return <div className="empty">No data</div>;
    return (
        <div>
            <div style={{ display: "flex", height: 14, borderRadius: 4, overflow: "hidden", gap: 2 }}>
                {data.map((d, i) => (
                    <div key={d.key} title={`${d.key}: ${d.count}`} style={{ width: `${(d.count / total) * 100}%`, background: SERIES[i % SERIES.length] }} />
                ))}
            </div>
            <div className="legend">
                {data.map((d, i) => (
                    <span key={d.key}>
                        <span className="sw" style={{ background: SERIES[i % SERIES.length] }} />
                        {d.key} <b>{d.count}</b> <span className="muted">({Math.round((d.count / total) * 100)}%)</span>
                    </span>
                ))}
            </div>
        </div>
    );
};
