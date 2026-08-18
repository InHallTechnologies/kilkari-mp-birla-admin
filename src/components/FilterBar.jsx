import { useMemo } from "react";
import { Button, Input } from "@chakra-ui/react";
import { useData } from "../context/DataContext";

const Select = ({ value, onChange, placeholder, options }) => (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
            <option key={o.value} value={o.value}>
                {o.label}
            </option>
        ))}
    </select>
);

/**
 * `show` picks which controls render. Defaults to all.
 */
const FilterBar = ({ f, show = {} }) => {
    const { workers, children } = useData();
    const s = { search: true, worker: true, caseType: true, gender: true, caste: true, status: true, tahasil: true, date: true, ...show };

    const tahasils = useMemo(
        () => [...new Set(children.map((c) => (c.tahasil ?? "").trim()).filter(Boolean))].sort().map((t) => ({ value: t, label: t })),
        [children]
    );
    const workerOpts = useMemo(
        () =>
            workers
                .filter((w) => w.access !== "admin")
                .map((w) => ({ value: w.uid, label: w.name || w.emailId || w.uid }))
                .sort((a, b) => a.label.localeCompare(b.label)),
        [workers]
    );

    return (
        <div className="filter-bar">
            {s.search && (
                <Input
                    className="grow"
                    placeholder="Search name, SAM no., parent, village, phone…"
                    value={f.filters.search}
                    onChange={(e) => f.set("search", e.target.value)}
                    height="38px"
                    bg="white"
                    maxW="320px"
                />
            )}
            {s.worker && <Select value={f.filters.workerUid} onChange={(v) => f.set("workerUid", v)} placeholder="All entry makers" options={workerOpts} />}
            {s.caseType && (
                <Select
                    value={f.filters.caseType}
                    onChange={(v) => f.set("caseType", v)}
                    placeholder="All case types"
                    options={[
                        { value: "nrc", label: "NRC" },
                        { value: "community", label: "Community" },
                    ]}
                />
            )}
            {s.status && (
                <Select
                    value={f.filters.samMamStatus}
                    onChange={(v) => f.set("samMamStatus", v)}
                    placeholder="SAM / MAM"
                    options={[
                        { value: "SAM", label: "SAM" },
                        { value: "MAM", label: "MAM" },
                    ]}
                />
            )}
            {s.gender && (
                <Select
                    value={f.filters.gender}
                    onChange={(v) => f.set("gender", v)}
                    placeholder="All genders"
                    options={[
                        { value: "Male", label: "Male" },
                        { value: "Female", label: "Female" },
                        { value: "Other", label: "Other" },
                    ]}
                />
            )}
            {s.caste && (
                <Select
                    value={f.filters.caste}
                    onChange={(v) => f.set("caste", v)}
                    placeholder="All castes"
                    options={["General", "OBC", "SC", "ST", "Others"].map((c) => ({ value: c, label: c }))}
                />
            )}
            {s.tahasil && tahasils.length > 0 && <Select value={f.filters.tahasil} onChange={(v) => f.set("tahasil", v)} placeholder="All tehsils" options={tahasils} />}
            {s.date && (
                <>
                    <input className="date-input" type="date" value={f.filters.from} onChange={(e) => f.set("from", e.target.value)} title="From" />
                    <span className="muted">to</span>
                    <input className="date-input" type="date" value={f.filters.to} onChange={(e) => f.set("to", e.target.value)} title="To" />
                </>
            )}
            {f.isActive && (
                <Button size="sm" variant="outline" onClick={f.reset}>
                    Clear
                </Button>
            )}
        </div>
    );
};

export default FilterBar;
