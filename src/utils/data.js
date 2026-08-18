import moment from "moment";

/** Formats the field app writes. Keep in sync with kilkari-mp-birla. */
export const APP_TIMESTAMP_FORMAT = "DD-MM-YYYY h:mm a";
export const DATE_PARSE_FORMATS = [APP_TIMESTAMP_FORMAT, "DD-MM-YYYY", "YYYY-MM-DD"];

/** Same heuristic the field app uses everywhere (handles legacy rows w/o caseType). */
export const isNrcCase = (row) =>
    row?.caseType === "nrc" ||
    row?.isNrcCase === true ||
    (row?.caseType === undefined && row?.isNrcCase !== false);

export const caseTypeOf = (row) => (isNrcCase(row) ? "nrc" : "community");
export const caseTypeLabel = (row) => (isNrcCase(row) ? "NRC" : "Community");

/** Parse a moment out of any of the app's date strings; returns null if invalid. */
export const parseAppDate = (value) => {
    if (!value) return null;
    const m = moment(String(value), DATE_PARSE_FORMATS, true);
    if (m.isValid()) return m;
    const loose = moment(String(value), DATE_PARSE_FORMATS);
    return loose.isValid() ? loose : null;
};

export const fmtDate = (value, fmt = "DD MMM YYYY") => {
    const m = parseAppDate(value);
    return m ? m.format(fmt) : "-";
};

/** "3kg 250gms" -> 3.25 (kg). Also accepts bare numbers / decimals. Returns null if unparseable. */
export const parseWeightKg = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const s = String(value).trim().toLowerCase();
    const m = s.match(/^([\d.]+)\s*kg\s*([\d.]+)?\s*(?:gms|gm|g)?$/);
    if (m) {
        const kg = parseFloat(m[1]) || 0;
        const gm = parseFloat(m[2] || "0") || 0;
        return +(kg + gm / 1000).toFixed(3);
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
};

export const parseNumber = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const n = parseFloat(String(value).replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
};

export const displayValue = (v) => {
    if (v === undefined || v === null || v === "") return "-";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return String(v);
};

/** Group an array by a key function -> [{ key, count }] sorted desc. */
export const countBy = (rows, keyFn, { emptyLabel = "Not set" } = {}) => {
    const map = new Map();
    for (const r of rows) {
        const k = keyFn(r);
        const key = k === undefined || k === null || k === "" ? emptyLabel : String(k);
        map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
};

/** Re-order a countBy() result to a fixed key order (unknown keys appended, zero-count keys kept) so colors stay bound to entities. */
export const fixedOrder = (counts, order) => {
    const map = new Map(counts.map((c) => [c.key, c.count]));
    const out = order.map((k) => ({ key: k, count: map.get(k) ?? 0 }));
    for (const c of counts) if (!order.includes(c.key)) out.push(c);
    return out.filter((c) => c.count > 0 || order.includes(c.key));
};

/** Bucket rows by month of a date field -> [{ month: 'YYYY-MM', label, count }] ascending. */
export const countByMonth = (rows, dateFn) => {
    const map = new Map();
    for (const r of rows) {
        const m = parseAppDate(dateFn(r));
        if (!m) continue;
        const key = m.format("YYYY-MM");
        map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, label: moment(month, "YYYY-MM").format("MMM YY"), count }));
};

export const toCsv = (columns, rows) => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [columns.map((c) => esc(c.label)).join(",")];
    for (const r of rows) {
        lines.push(columns.map((c) => esc(c.render ? c.render(r) : displayValue(r[c.key]))).join(","));
    }
    return "\uFEFF" + lines.join("\n");
};

export const downloadText = (filename, text, mime = "text/csv;charset=utf-8;") => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
