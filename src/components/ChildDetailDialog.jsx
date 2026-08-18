import { useState } from "react";
import { Button, Dialog } from "@chakra-ui/react";
import { useData } from "../context/DataContext";
import { displayValue, fmtDate, isNrcCase } from "../utils/data";
import { CasePill, DataTable, Tabs } from "./ui";
import { useDeleter } from "../hooks/useDeleter";

const ENROLL_FIELDS = [
    ["name", "Child"], ["gender", "Gender"], ["samMamStatus", "SAM/MAM"], ["referredToNrc", "Referred to NRC"],
    ["samNumber", "SAM No."], ["fatherName", "Father"], ["motherName", "Mother"], ["phoneNumber", "Family phone"],
    ["caste", "Caste"], ["villageName", "Village"], ["tahasil", "Tehsil"], ["jila", "District"], ["address", "Address"],
    ["identificationDate", "Identified on"], ["identifyingWorkerName", "Identified by"], ["workerRole", "Role"], ["workerMobileNumber", "Worker phone"],
    ["ageAtIdentification", "Age at ident."], ["heightAtIdentification", "Height at ident."], ["weightAtIdentification", "Weight at ident."],
    ["admitDate", "Admit date"], ["admitTimeHeight", "Height at admit"], ["admitTimeWeight", "Weight at admit"], ["admitTimeSD", "SD"], ["standardDiviation", "Std. deviation"],
    ["admitTimeHB", "HB"], ["admitTimeMUAC", "MUAC"], ["anganwadiWorkerName", "AWW"], ["anganwadiWorkerNumber", "AWW phone"],
    ["ashaWorkerName", "ASHA"], ["ashaWorkerNumber", "ASHA phone"], ["anganwadiSupervisorName", "Supervisor"], ["anganwadiSupervisorNumber", "Supervisor phone"],
    ["enrolledByName", "Enrolled by"], ["enrollmentDate", "Enrolled on"], ["reassignedAt", "Reassigned at"],
];

const WEEKLY_COLS = [
    { key: "timestamp", label: "Entry" }, { key: "entryByName", label: "By" }, { key: "inClinicServiceDay", label: "Clinic day", render: (r) => fmtDate(r.inClinicServiceDay) },
    { key: "weight", label: "Weight" }, { key: "wasBabyFed", label: "Fed" }, { key: "wasBabyGivenMilkFormula", label: "Milk/formula" }, { key: "wasMotherFed", label: "Mother fed" },
    { key: "homeMadeProteinFoodGiven", label: "Nutrition food" }, { key: "roWaterAvailable", label: "RO water" }, { key: "handWashTrainingDone", label: "Handwash" },
    { key: "threeTimeDoctorVisitDone", label: "Doctor visit" }, { key: "anotherFacilityReferred", label: "Referred" }, { key: "dropoutDay", label: "Dropout", render: (r) => fmtDate(r.dropoutDay) },
    { key: "isChildGettingDischarged", label: "Discharged" }, { key: "dischargeConditionAtDischarge", label: "Condition" },
];
const NRC_COLS = [
    { key: "timestamp", label: "Entry" }, { key: "isNrcFollowupRequired", label: "Went?" }, { key: "nrcFollowupExpectedDate", label: "Expected", render: (r) => fmtDate(r.nrcFollowupExpectedDate) },
    { key: "nrcFollowUpNumber", label: "F/u no." }, { key: "wasFollowUpDone", label: "Came?" }, { key: "followUpDate", label: "Date", render: (r) => fmtDate(r.followUpDate) },
    { key: "wasFoodProvided", label: "Food" }, { key: "weight", label: "Weight" }, { key: "height", label: "Height" },
];
const COMM_COLS = [
    { key: "timestamp", label: "Entry" }, { key: "followUpWorkerName", label: "Worker" }, { key: "followUpDate", label: "Date", render: (r) => fmtDate(r.followUpDate) },
    { key: "weight", label: "Weight" }, { key: "height", label: "Height" }, { key: "nutritionCategory", label: "Category" }, { key: "isConditionImproved", label: "Improved" },
    { key: "anyHealthProblemAfterDischarge", label: "Health problems" }, { key: "followingGuidelinesAfterDischarge", label: "Guidelines" }, { key: "otherObservations", label: "Observations" },
];

const ChildDetailDialog = ({ child, onClose, actions, onDeleteChild }) => {
    const { weekly, nrcFollowups, communityFollowups } = useData();
    const [tab, setTab] = useState("enroll");
    const { requestDeleteFollowup, dialog: deleteDialog } = useDeleter();
    if (!child) return null;

    const delCol = {
        key: "_del",
        label: "",
        render: (r) => (
            <Button size="xs" variant="ghost" colorPalette="red" onClick={(e) => { e.stopPropagation(); requestDeleteFollowup(r); }}>
                Delete
            </Button>
        ),
    };

    const w = weekly.filter((e) => e.childId === child.id);
    const n = nrcFollowups.filter((e) => e.childId === child.id);
    const c = communityFollowups.filter((e) => e.childId === child.id);

    return (
        <Dialog.Root open={!!child} onOpenChange={(e) => !e.open && onClose()} size="xl" scrollBehavior="inside">
            <Dialog.Backdrop />
            <Dialog.Positioner>
                <Dialog.Content p={6} borderRadius="xl" maxW="1200px" w="95vw" maxH="90vh">
                    <Dialog.CloseTrigger />
                    <Dialog.Header mb={2} display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={3}>
                        <Dialog.Title fontSize="xl" fontWeight="bold">
                            {child.name || "Child"} <CasePill isNrc={isNrcCase(child)} />
                            <span className="muted" style={{ fontSize: "0.85rem", marginLeft: 10, fontWeight: 400 }}>
                                Entry maker: <b>{child.workerName}</b>
                            </span>
                        </Dialog.Title>
                        <div style={{ display: "flex", gap: 8, marginRight: 32 }}>
                            {actions}
                            {onDeleteChild && (
                                <Button size="sm" variant="outline" colorPalette="red" onClick={() => onDeleteChild(child)}>
                                    Delete child
                                </Button>
                            )}
                        </div>
                    </Dialog.Header>
                    <Dialog.Body>
                        <Tabs
                            active={tab}
                            onChange={setTab}
                            tabs={[
                                { key: "enroll", label: "Enrollment" },
                                { key: "weekly", label: "Weekly updates", count: w.length },
                                { key: "nrc", label: "NRC follow-ups", count: n.length },
                                { key: "community", label: "Community follow-ups", count: c.length },
                            ]}
                        />
                        {tab === "enroll" && (
                            <div className="grid grid-4">
                                {ENROLL_FIELDS.map(([k, label]) => (
                                    <div key={k}>
                                        <div className="stat-label">{label}</div>
                                        <div style={{ fontSize: "0.9rem", fontWeight: 500 }}>{displayValue(child[k])}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {tab === "weekly" && <DataTable rows={w} columns={[...WEEKLY_COLS, delCol]} empty="No weekly updates." />}
                        {tab === "nrc" && <DataTable rows={n} columns={[...NRC_COLS, delCol]} empty="No NRC follow-ups." />}
                        {tab === "community" && <DataTable rows={c} columns={[...COMM_COLS, delCol]} empty="No community follow-ups." />}
                    </Dialog.Body>
                    <Dialog.Footer mt={4}>
                        <Button variant="outline" onClick={onClose}>
                            Close
                        </Button>
                    </Dialog.Footer>
                </Dialog.Content>
            </Dialog.Positioner>
            {deleteDialog}
        </Dialog.Root>
    );
};

export default ChildDetailDialog;
