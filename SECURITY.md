# Security & Threat Model

This document outlines the security architecture, threat model, and mitigations for TaikaiX. It follows the STRIDE methodology and documents the primary trust boundaries in our system.

## Trust Boundaries

1. **Client to Next.js API (HTTP)**: All data arriving at `/api/*` is untrusted.
2. **Client to Firebase (Firestore)**: Direct client connections to Firestore are untrusted and governed by Security Rules.
3. **Admin Actions**: Any action modifying tournament configurations, bracket data, or assigning roles must be strictly verified.

## STRIDE Threat Model

| Threat | Description | Mitigation |
|---|---|---|
| **S**poofing | Impersonating a user or staff member | Enforced Firebase Authentication. Role checks are executed server-side via `verifySession` (JWT validation) in API routes, and via `request.auth.uid` in Firestore rules. |
| **T**ampering | Modifying match scores or athlete data | Firestore Security Rules ensure that `isMatOperator` can only modify score fields (`akaScore`, `aoScore`) and cannot delete matches. Zod validation secures Next.js APIs. |
| **R**epudiation | Denying actions (e.g., scoring a match) | Actions taken via the Gateway API are tracked. Future phase: Add audit logs to `/archives` or a dedicated log collection. |
| **I**nformation Disclosure | Exposing PII or competitor details | The `PublicService` API explicitly strips emails and phone numbers from public schedules/brackets. Passwords/Secrets are never logged. |
| **D**enial of Service | Flooding the API or exhausting DB reads | Rate limiting (`@lib/rate-limiter` via Redis) is active on memory-intensive endpoints like `/api/competitions/[id]/import`. |
| **E**levation of Privilege | Users granting themselves Admin rights | Fixed via `firestore.rules` where `update` on `users/{uid}` explicitly blocks modification of the `role` field. |

## Deployment Checklist
Before pushing to production, verify:
- [ ] `firestore.rules` has been deployed using `firebase deploy --only firestore:rules`.
- [ ] The `admin` role is strictly assigned via Firebase Console or a secure bootstrapping script, not through the client.
- [ ] Environment variables (`SESSION_SECRET`, `FIREBASE_ADMIN_*`) are stored in secure environments (e.g., Vercel Secrets), not committed to version control.
