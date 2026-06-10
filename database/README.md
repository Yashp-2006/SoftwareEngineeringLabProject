# Database — Firebase Firestore + RTDB Schemas & Rules

Complete database design for TaikaiX: Firestore collections, RTDB structure, security rules, and composite indexes.

## Architecture

TaikaiX uses **two Firebase databases** with distinct roles:

| Database | Role | Reason |
|---|---|---|
| **Firestore** | All persistent data | Structured, queryable, strong consistency |
| **RTDB** | Live scoring only | Sub-100ms latency for real-time score updates |

## Firestore Collections

```
/competitions/{competitionId}
/competitions/{competitionId}/categories/{categoryId}
/competitions/{competitionId}/categories/{categoryId}/matches/{matchId}
/competitions/{competitionId}/athletes/{athleteId}
/competitions/{competitionId}/mats/{matId}
/competitions/{competitionId}/staff/{assignmentId}
/competitions/{competitionId}/medals/{medalistId}
/competitions/{competitionId}/schedule/{rowId}
/users/{uid}
```

### Competition Document
```json
{
  "id": "string",
  "name": "string",
  "startDate": "ISO date string",
  "endDate": "ISO date string",
  "location": "string",
  "venue": "string",
  "type": "national | international",
  "ruleSet": "WKF | custom",
  "status": "live | upcoming | done",
  "matsCount": "number",
  "createdAt": "ISO timestamp",
  "createdBy": "uid string"
}
```

### Category Document
```json
{
  "id": "string",
  "competitionId": "string",
  "name": "string",
  "ageGroup": "string",
  "weightRange": "string",
  "type": "standard | special",
  "rules": "string",
  "status": "live | upcoming | done",
  "assignedMat": "string | null",
  "startTime": "string | null",
  "endTime": "string | null"
}
```

### Match Document (Full scoring)
```json
{
  "id": "string",
  "competitionId": "string",
  "categoryId": "string",
  "matId": "string",
  "round": "Quarter-Finals | Semi-Finals | Finals",
  "status": "upcoming | ongoing | paused | finished",
  "aka": {
    "athleteId": "string",
    "name": "string",
    "academy": "string",
    "score": 0,
    "yuko": 0,
    "wazaAri": 0,
    "ippon": 0,
    "penalties": { "C1": 0, "C2": 0, "C3": 0, "HC": 0, "H": 0 },
    "senshu": false
  },
  "ao": { "...same as aka..." },
  "timerSeconds": 120,
  "winnerId": "string | null",
  "bracketPosition": "R1-M3 | null"
}
```

### Athlete Document
```json
{
  "id": "string",
  "competitionId": "string",
  "categoryId": "string",
  "name": "string",
  "academy": "string",
  "country": "string",
  "attendance": "present | absent",
  "readiness": "ready | not-ready",
  "disqualified": false,
  "importedAt": "ISO timestamp"
}
```

### Mat Document
```json
{
  "id": "string",
  "competitionId": "string",
  "number": 1,
  "status": "live | standby",
  "assignedCategoryId": "string | null",
  "currentMatchId": "string | null",
  "operatorId": "string | null",
  "password": "hashed string"
}
```

### Medalist Document
```json
{
  "id": "string",
  "competitionId": "string",
  "categoryId": "string",
  "athleteId": "string",
  "athleteName": "string",
  "academy": "string",
  "medalType": "Gold | Silver | Bronze",
  "received": false,
  "awardedAt": "ISO timestamp"
}
```

### Staff Assignment Document
```json
{
  "id": "string",
  "competitionId": "string",
  "userId": "string",
  "userName": "string",
  "role": "Admin | Tournament Director | Mat Operator | Attendance Volunteer | Medal Distributor | Viewer | Coach | Guest Viewer | Judge",
  "scope": "mat | category | medals | global",
  "scopeId": "string | null",
  "status": "assigned | unassigned"
}
```

### User Document
```json
{
  "uid": "string",
  "name": "string",
  "email": "string",
  "role": "Admin | Tournament Director | Mat Operator | Attendance Volunteer | Medal Distributor | Viewer | Coach | Guest Viewer | Judge",
  "academy": "string",
  "photoURL": "string | null",
  "createdAt": "ISO timestamp"
}
```

## Firebase Realtime Database (RTDB) — Live Scoring Only

RTDB is **exclusively** for sub-second score updates. Firestore handles everything else.

```json
{
  "liveMatches": {
    "{matchId}": {
      "status": "ongoing",
      "timerSeconds": 120,
      "timerRunning": true,
      "aka": {
        "score": 4,
        "yuko": 2,
        "wazaAri": 1,
        "ippon": 0,
        "senshu": false,
        "penalties": { "C1": 0, "C2": 0, "C3": 0, "HC": 0, "H": 0 }
      },
      "ao": {
        "score": 2,
        "yuko": 1,
        "wazaAri": 0,
        "ippon": 0,
        "senshu": true,
        "penalties": {}
      },
      "updatedAt": 1716300000000
    }
  },
  "matStatus": {
    "{matId}": {
      "status": "live",
      "currentMatchId": "{matchId}",
      "updatedAt": 1716300000000
    }
  }
}
```

**Lifecycle**: When match finishes → write final result to Firestore → clear RTDB entry → advance bracket in Firestore.

## Firestore Security Rules

```
// firestore.rules

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can read their own profile; Admin can read all
    match /users/{uid} {
      allow read: if request.auth != null && (request.auth.uid == uid || isAdmin());
      allow write: if request.auth != null && (request.auth.uid == uid || isAdmin());
    }

    // Competitions: all authenticated users can read; only Admin can create/update
    match /competitions/{competitionId} {
      allow read: if request.auth != null;
      allow create, update: if isAdmin();
      allow delete: if isAdmin();

      // Categories: read all authenticated; write Admin only
      match /categories/{categoryId} {
        allow read: if request.auth != null;
        allow write: if isAdmin();

        // Matches: Mat Operator can update score fields only
        match /matches/{matchId} {
          allow read: if request.auth != null;
          allow create: if isAdmin();
          allow update: if isAdmin() || isMatOperator();
        }
      }

      // Athletes: Admin full access; Attendance Volunteer can update attendance/readiness
      match /athletes/{athleteId} {
        allow read: if request.auth != null;
        allow create, delete: if isAdmin();
        allow update: if isAdmin() || isAttendanceVolunteer();
      }

      // Medals: Admin full access; Medal Distributor can update 'received' only
      match /medals/{medalistId} {
        allow read: if request.auth != null;
        allow create, delete: if isAdmin();
        allow update: if isAdmin() || isMedalDistributor();
      }

      // Staff, Mats, Schedule: Admin only write
      match /staff/{assignmentId} {
        allow read: if request.auth != null;
        allow write: if isAdmin();
      }
      match /mats/{matId} {
        allow read: if request.auth != null;
        allow write: if isAdmin();
      }
      match /schedule/{rowId} {
        allow read: if request.auth != null;
        allow write: if isAdmin();
      }
    }

    // Helper functions
    function isAdmin() {
      return request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Admin';
    }
    function isMatOperator() {
      return request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Mat Operator';
    }
    function isAttendanceVolunteer() {
      return request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Attendance Volunteer';
    }
    function isMedalDistributor() {
      return request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Medal Distributor';
    }
  }
}
```

## RTDB Security Rules

```json
{
  "rules": {
    "liveMatches": {
      "$matchId": {
        ".read": true,
        ".write": "auth != null"
      }
    },
    "matStatus": {
      "$matId": {
        ".read": true,
        ".write": "auth != null"
      }
    }
  }
}
```

> **Note**: Public broadcast screens (`/live/mat/` and `/live/scoreboard/`) read RTDB without auth. RTDB rules allow unauthenticated reads for these paths. Firestore rules always require auth.

## Composite Indexes Required

Create these in Firebase Console → Firestore → Indexes:

| Collection | Field 1 | Field 2 | Order |
|---|---|---|---|
| competitions | status ASC | createdAt DESC | — |
| categories | competitionId ASC | status ASC | — |
| matches | competitionId ASC | categoryId ASC | status ASC |
| athletes | competitionId ASC | categoryId ASC | — |
| staff | competitionId ASC | userId ASC | — |
| medals | competitionId ASC | categoryId ASC | — |
| schedule | competitionId ASC | startTime ASC | — |
