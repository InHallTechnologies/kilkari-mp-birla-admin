# Kilkari Admin

Admin-only console for the Kilkari (MP Birla / Asra) malnutrition programme. It sits **next to** the field-worker app
(`../kilkari-mp-birla`) and talks to the **same Firebase project / Realtime Database**, but is a completely separate
Vite build and deployment. Nothing here requires a change to the field-worker app.

| Capability | Where |
|---|---|
| Single admin login (gated on `USERS_ARCHIVE/{uid}/access === "admin"`) | `src/context/AuthContext.jsx`, `src/components/ProtectedRoute.jsx` |
| Onboard entry makers (creates Firebase Auth user + `USERS_ARCHIVE` profile) | **Entry Makers** page → `src/backend/adminOps.js#createWorker` |
| Edit name/location, mark active/inactive, send password-reset email | **Entry Makers** page |
| Analytics with filters + tabs (summary, demographics, outcomes, per-worker) | **Overview** page → `src/hooks/useAnalytics.js` |
| Browse every child / follow-up across all workers, drill-down, CSV export | **Children**, **Follow-ups** pages |
| Reassign a child (and all its follow-ups) to another entry maker, atomically, with an audit log | **Reassign** page → `src/backend/adminOps.js#reassignChild` |
| Delete a child (+ all follow-ups) or a single follow-up entry — soft delete into `ADMIN_TRASH`, restorable, with confirm + reason | **Children** / **Follow-ups** pages, Actions column; Trash tab on Children → `deleteChild`, `deleteFollowup`, `restoreFromTrash`, `purgeTrash` |

## Setup

```bash
cd kilkari-admin
yarn install
cp .env.example .env      # fill with the SAME Firebase config the field app uses (or copy ../kilkari-mp-birla/.env)
yarn dev                  # http://localhost:5174
```

### 1. Create the admin account (one time)

1. Firebase console → Authentication → **Add user** (email + password). Note the UID.
2. Realtime Database → set:
   ```json
   "USERS_ARCHIVE": {
     "<ADMIN_UID>": { "uid": "<ADMIN_UID>", "name": "Programme Admin", "emailId": "admin@…", "access": "admin", "status": "active" }
   }
   ```
   Alternatively, put the admin's email in `VITE_ADMIN_EMAILS` in `.env` to bootstrap, then set `access: "admin"` and remove the env var.

Only accounts with `access === "admin"` get past the login screen. Entry makers who try to log in here see a "not an admin" page.

### 2. Firebase Realtime Database rules

The field app only ever reads `…/{ownUid}/…`. The admin must read **whole trees** and write across workers' subtrees.
Rules along these lines (adapt to whatever you have now):

```json
{
  "rules": {
    "USERS_ARCHIVE": {
      ".read":  "auth != null && root.child('USERS_ARCHIVE').child(auth.uid).child('access').val() === 'admin'",
      "$uid": {
        ".read":  "auth != null && ($uid === auth.uid || root.child('USERS_ARCHIVE').child(auth.uid).child('access').val() === 'admin')",
        ".write": "auth != null && root.child('USERS_ARCHIVE').child(auth.uid).child('access').val() === 'admin'"
      }
    },
    "Enrollments":        { ".read": "auth != null && root.child('USERS_ARCHIVE').child(auth.uid).child('access').val() === 'admin'",
                            "$uid": { ".read": "auth != null && $uid === auth.uid", ".write": "auth != null && ($uid === auth.uid || root.child('USERS_ARCHIVE').child(auth.uid).child('access').val() === 'admin')" } },
    "Updates":            { ".read": "auth != null && root.child('USERS_ARCHIVE').child(auth.uid).child('access').val() === 'admin'",
                            "$uid": { ".read": "auth != null && $uid === auth.uid", ".write": "auth != null && ($uid === auth.uid || root.child('USERS_ARCHIVE').child(auth.uid).child('access').val() === 'admin')" } },
    "NrcFollowups":       { ".read": "auth != null && root.child('USERS_ARCHIVE').child(auth.uid).child('access').val() === 'admin'",
                            "$uid": { ".read": "auth != null && $uid === auth.uid", ".write": "auth != null && ($uid === auth.uid || root.child('USERS_ARCHIVE').child(auth.uid).child('access').val() === 'admin')" } },
    "CommunityFollowups": { ".read": "auth != null && root.child('USERS_ARCHIVE').child(auth.uid).child('access').val() === 'admin'",
                            "$uid": { ".read": "auth != null && $uid === auth.uid", ".write": "auth != null && ($uid === auth.uid || root.child('USERS_ARCHIVE').child(auth.uid).child('access').val() === 'admin')" } },
    "ADMIN_TRASH":        { ".read": "auth != null && root.child('USERS_ARCHIVE').child(auth.uid).child('access').val() === 'admin'",
                            ".write": "auth != null && root.child('USERS_ARCHIVE').child(auth.uid).child('access').val() === 'admin'" },
    "ADMIN_REASSIGN_LOG": { ".read": "auth != null && root.child('USERS_ARCHIVE').child(auth.uid).child('access').val() === 'admin'",
                            ".write": "auth != null && root.child('USERS_ARCHIVE').child(auth.uid).child('access').val() === 'admin'" }
  }
}
```

If your current rules are simply `auth != null` everywhere, the admin app already works; the rules above just tighten things.

### 3. Firebase Auth

Email/password sign-in must be enabled (it already is for the field app). Onboarding creates users with
`createUserWithEmailAndPassword` on a **secondary Firebase app instance**, so the admin stays signed in — no Cloud
Functions needed. Limitation of doing it client-side: the admin app cannot *disable/delete* an Auth user; "Deactivate"
only flags `USERS_ARCHIVE/{uid}/status`. Disable the login in the Firebase console if needed.

## How reassignment works

`reassignChild` reads `Enrollments/{from}/{child}` plus the three follow-up subtrees, then performs **one**
`update(ref(db), {...})` that writes them under `{to}` and nulls them under `{from}`, stamps
`enrolledByUid/enrolledByName/reassignedFromUid/reassignedAt` on the enrollment, and appends to `ADMIN_REASSIGN_LOG`.
The child key is preserved, so `uid`/`childUid` references stay valid. Follow-ups keep their historical
`entryByName`. From the field app's point of view the child simply appears in the new worker's lists.

## Data assumptions (must stay in sync with the field app)

- Paths: `USERS_ARCHIVE`, `Enrollments/{uid}/{childKey}`, `Updates/{uid}/{childKey}/{key}`, `NrcFollowups/…`, `CommunityFollowups/…` (`src/backend/firebase.js#PATHS`).
- Timestamps are strings `DD-MM-YYYY h:mm a`; form dates are `YYYY-MM-DD` (`src/utils/data.js`).
- Weights are strings like `3kg 250gms` (`parseWeightKg`).
- Case type heuristic is copied verbatim from the field app (`isNrcCase`).

## Mock / demo mode

`VITE_MOCK=1 yarn dev` skips Firebase entirely: fake admin session + generated data in the exact DB shape, all writes
disabled. Only active in `vite dev` (never in a production build).

## Scripts

- `yarn dev` – dev server on :5174
- `yarn build` – production build to `dist/`
- `yarn lint`
- Deploy: static SPA (Vercel config included; same env vars).
