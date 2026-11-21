/**
 * Dev/demo-only fake data in the exact tree shape the field app writes.
 * Enabled with VITE_MOCK=1 (see README). Deterministic PRNG so screenshots are stable.
 */
import moment from "moment";

let seed = 42;
const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const stamp = (m) => m.format("DD-MM-YYYY h:mm a");
const ymd = (m) => m.format("YYYY-MM-DD");
const w = (kg, g) => `${kg}kg ${g}gms`;

const WORKERS = [
    ["w1", "Sunita Verma", "sunita@kilkari.org", "Rampur Baghelan"],
    ["w2", "Ramesh Patel", "ramesh@kilkari.org", "Maihar"],
    ["w3", "Anita Singh", "anita@kilkari.org", "Nagod"],
    ["w4", "Deepak Kushwaha", "deepak@kilkari.org", "Amarpatan"],
];
const NAMES = ["Aarav", "Riya", "Kabir", "Anaya", "Vivaan", "Diya", "Arjun", "Pari", "Krishna", "Meera", "Rohan", "Sia", "Ishaan", "Kavya", "Yash", "Tara"];
const VILLAGES = ["Bhatnawara", "Kothi", "Jaitwara", "Birsinghpur", "Unchehara", "Kotar", "Semariya", "Majhgawan"];
const TEHSILS = ["Rampur Baghelan", "Maihar", "Nagod", "Amarpatan", "Raghurajnagar"];

export const buildMockTrees = () => {
    const users = {
        admin1: { uid: "admin1", name: "Programme Admin", emailId: "admin@kilkari.org", access: "admin", status: "active", addedOn: "01-01-2026 9:00 am" },
    };
    users.v1 = { uid: "v1", name: "Birla Observer", emailId: "observer@mpbirla.example", access: "viewer", status: "active", location: "Mumbai HO", addedOn: "10-01-2026 11:00 am" };
    for (const [uid, name, emailId, location] of WORKERS)
        users[uid] = { uid, name, emailId, access: "entry", status: uid === "w4" ? "inactive" : "active", location, addedOn: "05-01-2026 10:00 am" };

    const enrollments = {}, updates = {}, nrc = {}, community = {};
    let n = 0;
    for (const [uid, name] of WORKERS) {
        const count = 10 + Math.floor(rnd() * 12);
        for (let i = 0; i < count; i++) {
            n += 1;
            const enrolled = moment().subtract(Math.floor(rnd() * 240), "days");
            const sam = rnd() < 0.62 ? "SAM" : "MAM";
            const referred = sam === "SAM" && rnd() < 0.7 ? "Yes" : "No";
            const isNrc = sam === "SAM" && referred === "Yes";
            const key = `child_${uid}_${i}`;
            const kg = 5 + Math.floor(rnd() * 6), gm = Math.floor(rnd() * 900);
            enrollments[uid] ??= {};
            enrollments[uid][key] = {
                uid: key, name: `${pick(NAMES)} ${pick(["Kumar", "Devi", "Singh", "Patel", "Yadav"])}`,
                gender: pick(["Male", "Female", "Female"]), samMamStatus: sam, referredToNrc: referred,
                caseType: isNrc ? "nrc" : "community", isNrcCase: isNrc,
                fatherName: `${pick(NAMES)} Lal`, motherName: `${pick(NAMES)} Bai`, phoneNumber: `9${Math.floor(100000000 + rnd() * 899999999)}`,
                caste: pick(["General", "OBC", "OBC", "SC", "ST", ""]), jila: "Satna", tahasil: pick(TEHSILS), villageName: pick(VILLAGES),
                identificationDate: ymd(enrolled), identifyingWorkerName: name, workerRole: pick(["AWW", "ASHA", "Supervisor"]),
                ageAtIdentification: `${6 + Math.floor(rnd() * 50)} months`, heightAtIdentification: `${60 + Math.floor(rnd() * 30)}`,
                weightAtIdentification: w(kg, gm), samNumber: isNrc ? `SAM-${1000 + n}` : "",
                admitDate: isNrc ? ymd(enrolled) : ymd(enrolled), admitTimeWeight: isNrc ? w(kg, gm) : "", admitTimeHeight: isNrc ? `${60 + Math.floor(rnd() * 30)}` : "",
                admitTimeMUAC: isNrc ? (10 + rnd() * 2).toFixed(1) : "", admitTimeHB: isNrc ? (7 + rnd() * 4).toFixed(1) : "",
                enrolledByUid: uid, enrolledByName: name, enrollmentDate: stamp(enrolled), timestamp: stamp(enrolled), numberOfEntries: 0, lastEntryDate: "",
            };

            // follow-ups
            let curKg = kg + gm / 1000;
            const trend = rnd() < 0.7 ? 1 : -1;
            const fu = Math.floor(rnd() * 6);
            for (let k = 0; k < fu; k++) {
                const t = enrolled.clone().add(7 * (k + 1), "days");
                if (t.isAfter(moment())) break;
                curKg = Math.max(3, curKg + trend * rnd() * 0.3);
                const wk = Math.floor(curKg), gms = Math.round((curKg - wk) * 1000);
                const ekey = `e_${key}_${k}`;
                const yn = () => (rnd() < 0.8 ? "Yes" : "No");
                if (isNrc && k < 3) {
                    const discharging = k === 2 && rnd() < 0.6;
                    (updates[uid] ??= {})[key] ??= {};
                    updates[uid][key][ekey] = {
                        childUid: key, childName: enrollments[uid][key].name, entryKey: ekey, entryByUid: uid, entryByName: name,
                        childAdmitDate: ymd(enrolled), inClinicServiceDay: ymd(t), weight: w(wk, gms),
                        wasBabyFed: yn(), wasBabyGivenMilkFormula: yn(), wasMotherFed: yn(), homeMadeProteinFoodGiven: yn(),
                        whathomeMadeProteinFoodGiven: "", roWaterAvailable: yn(), wasBeddingClothingDone: yn(), handWashTrainingDone: yn(),
                        teethBrushed: pick(["Yes", "No", "Not Applicable"]), wasGroomingDone: yn(), washroomHygieneFollowed: yn(), sanitizationDone: yn(),
                        houseFloorCleaned: yn(), anotherFacilityReferred: rnd() < 0.08 ? "Yes" : "No", anotherFacilityName: "", dropoutDay: rnd() < 0.05 ? ymd(t) : "",
                        threeTimeDoctorVisitDone: yn(), isChildGettingDischarged: discharging, dischargeConditionAtDischarge: discharging ? pick(["MAM", "NORMAL", "SAM"]) : "",
                        entryDate: stamp(t), timestamp: stamp(t),
                    };
                } else if (isNrc) {
                    const went = rnd() < 0.7 ? "Yes" : "No";
                    (nrc[uid] ??= {})[key] ??= {};
                    nrc[uid][key][ekey] = {
                        childUid: key, childName: enrollments[uid][key].name, entryKey: ekey, isNrcFollowupRequired: went,
                        nrcFollowupExpectedDate: went === "No" ? ymd(t.clone().add(14, "days")) : "", nrcFollowUpNumber: went === "Yes" ? String(k - 2) : "",
                        wasFollowUpDone: went === "Yes" ? "Yes" : "", followUpDate: went === "Yes" ? ymd(t) : "", wasFoodProvided: went === "Yes" ? yn() : "",
                        weight: went === "Yes" ? w(wk, gms) : "", height: went === "Yes" ? `${62 + k}` : "", entryDate: stamp(t), timestamp: stamp(t),
                    };
                } else {
                    (community[uid] ??= {})[key] ??= {};
                    community[uid][key][ekey] = {
                        childUid: key, childName: enrollments[uid][key].name, entryKey: ekey, followUpWorkerName: name, followUpDate: ymd(t),
                        weight: w(wk, gms), height: `${62 + k}`, nutritionCategory: pick(["SAM", "MAM", "Normal", "mam"]), isConditionImproved: yn(),
                        anyHealthProblemAfterDischarge: rnd() < 0.2 ? "Fever" : "No", followingGuidelinesAfterDischarge: yn(), otherObservations: "",
                        entryDate: stamp(t), timestamp: stamp(t),
                    };
                }
            }
        }
    }
    return { users, enrollments, updates, nrc, community };
};
