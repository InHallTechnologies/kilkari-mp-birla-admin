import { useState } from "react";
import { Button } from "@chakra-ui/react";
import { displayValue } from "../utils/data";

export const StatTile = ({ label, value, hint }) => (
    <div className="stat-tile">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
);

export const Card = ({ title, sub, children, right, style }) => (
    <div className="card" style={style}>
        {(title || right) && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                    {title && <h3 className="card-title">{title}</h3>}
                    {sub && <p className="card-sub">{sub}</p>}
                </div>
                {right}
            </div>
        )}
        {children}
    </div>
);

export const Tabs = ({ tabs, active, onChange }) => (
    <div className="tabs">
        {tabs.map((t) => (
            <button key={t.key} className={`tab${active === t.key ? " active" : ""}`} onClick={() => onChange(t.key)} type="button">
                {t.label}
                {t.count !== undefined && <span className="badge">{t.count}</span>}
            </button>
        ))}
    </div>
);

export const CasePill = ({ isNrc }) => <span className={`pill ${isNrc ? "nrc" : "community"}`}>{isNrc ? "NRC" : "Community"}</span>;

/**
 * Generic table. columns: [{key,label,render?(row),width?}]
 * Simple client-side pagination so a big tree doesn't lock the DOM.
 */
export const DataTable = ({ columns, rows, rowKey = (r) => r.id, onRowClick, pageSize = 50, empty = "No rows." }) => {
    const [page, setPage] = useState(0);
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    const safePage = Math.min(page, pages - 1);
    const slice = rows.slice(safePage * pageSize, (safePage + 1) * pageSize);

    if (rows.length === 0) return <div className="empty">{empty}</div>;

    return (
        <>
            <div className="table-wrap">
                <table className="data">
                    <thead>
                        <tr>
                            {columns.map((c) => (
                                <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                                    {c.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {slice.map((r) => (
                            <tr key={rowKey(r)} className={onRowClick ? "clickable" : undefined} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                                {columns.map((c) => (
                                    <td key={c.key}>{c.render ? c.render(r) : displayValue(r[c.key])}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {pages > 1 && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", marginTop: 10, fontSize: "0.85rem" }}>
                    <span className="muted">
                        {safePage * pageSize + 1}–{Math.min(rows.length, (safePage + 1) * pageSize)} of {rows.length}
                    </span>
                    <Button size="xs" variant="outline" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                        Prev
                    </Button>
                    <Button size="xs" variant="outline" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>
                        Next
                    </Button>
                </div>
            )}
        </>
    );
};
