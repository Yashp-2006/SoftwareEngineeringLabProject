# TaikaiX - Project Handover & Current State

## 1. What's Done
- **Next.js 14 App Router Migration**: The static HTML prototype has been successfully ported into a dynamic Next.js application (`client/src/app`).
- **Design System Implementation**: Global CSS variables, fonts, component classes (buttons, cards, inputs), and responsive layouts have been implemented and match the design specifications (~95% coverage).
- **Authentication**: 
  - Firebase Auth is wired up (`/login`, `AuthProvider.tsx`).
  - Added a `PasswordGateway` for domain-level access control (e.g., to protect the operator portal using the competition's unique password).
- **Setup Wizard & Excel Import**: 
  - 5-phase tournament setup wizard is fully functional (`/setup/[id]`).
  - Excel/CSV drag-and-drop import automatically parses athletes, creates categories based on WKF age and weight rules, and seeds them into Firestore via server-side Admin SDK.
  - Setup UI strictly enforces step-by-step progression and persists phase state/Excel results across sessions.
  - Implemented debounced autosync to Firestore drafts to prevent data loss during configuration.
- **Competition Directory**:
  - Live stats updates accurately reflect deployed `mats` counts from the setup process.
  - Gracefully displays "N/A" for uninitialized stats instead of misleading zeros.
- **Mat Capacity Logic Fix**:
  - Fixed an input bug in Phase 2 where clearing the mat capacity input incorrectly reset to `1`, causing subsequent keystrokes to append erroneously (e.g., typing `5` would yield `15`).
  - Added strict min/max clamping (1 to 20) in both the Create Modal and Setup Wizard.
  - The "Apply Capacity" button now returns visual feedback.
- **Bracket Viewer UI Improvements**:
  - Mat assignment has been moved from the individual match level to the Category header in the `FullscreenBracketModal`. This allows assigning a single mat to the entire category, which properly syncs to Firestore.
  - Removed explicit names like "Quarter-Finals", "Semi-Finals", and "Finals". All rounds now uniformly display as "Round 1", "Round 2", etc.
- **Excel Import Fixes**:
  - Fixed an issue where the Excel importer would incorrectly extract the "Club ID" or "Team ID" instead of the Academy name. The parser now explicitly ignores columns containing "id" when extracting the academy.
- **Setup Wizard Bug Fixes**:
  - Fixed an issue where the Setup Wizard and Review Phase had a hardcoded competition name (`Kyoto 2026 Finals`) or incorrectly loaded `'Loading...'` from stale drafts. It now properly synchronizes the `compName` state with Firestore, displaying the real competition name in the header and allowing edits in Phase 5 to be saved.
  - Corrected `isDataLoaded` logic to prevent immediate autosync from wiping draft data on initial page load.
  - Updated Excel import logic in Setup Wizard to **merge** imported categories into the existing standard WKF category list, allowing users to see the full list of standard categories and precisely how many entries fell into each one.
  - Fixed a major string-mapping mismatch in `determineCategory` (`tiesheet-generator.ts`) where the parsed category names from Excel imports did not match the names in `WKF_CATEGORIES` (e.g., `Senior Male 18+` vs `Senior (18+) Male`), causing Excel imports to duplicate categories instead of updating the standard ones.
- **Tiesheet Viewer Improvements**:
  - Added a "Pool Select" dropdown to the `FullscreenBracketModal` (`BracketViewer`). When a category has more athletes than the designated pool size, it keeps all athletes in a single unified category list (rather than splitting them into separate database documents), but allows the user to browse individual pools (Pool A, Pool B, etc.) dynamically within the tiesheet preview modal.
- **Schedule Sync Bug Fixes**:
  - The Sync button on the schedule page was a dummy button (`onClick={() => {}}`). It has been replaced with actual Firestore re-fetch logic and properly updates the `lastSync` timestamp.
- **UX Improvements**:
  - Replaced all ugly native browser `alert()` and `confirm()` calls across the entire application (Setup Wizard, Competition Directory, Bracket Viewer, Operator Panel, and Scoreboard) with a custom `react-hot-toast` notifications system and a polished custom `<ConfirmModal>` component. This provides a clean, premium, and unified user experience without halting the main thread.
- **Dynamic Tiesheet / Bracket Generation**:
  - `lib/tiesheet-generator.ts` supports a greedy algorithm to separate athletes by country, state, and district/academy.
  - Bracket sizes adapt to a user-defined `poolSize` (4, 8, 16, 32), padding with byes as necessary.
  - Special Category generation reads medalist data from finalized standard categories and generates seeded brackets.
- **Live Bracket Advancement**:
  - `PATCH /api/competitions/{id}/brackets/{catId}` atomically completes matches and propagates winners to the next round.
  - `FullscreenBracketModal.tsx` and `BracketViewer.tsx` are fully wired to Firestore `onSnapshot` for real-time interactive updates.
- **Live Scoring Hub (Operator Portal)**: 
  - Operator page (`/competitions/[id]/operator`) is implemented and writes real-time scores to Firebase RTDB.
  - Connected to the Live Mat broadcast view (`/live/mat/[matId]`).
- **Entity Management**: CRUD UI for Competitions, Categories, Athletes, and Medals is implemented and wired to Firestore.

## 2. What's Not Done
- **RTDB Read/Write Mismatches**: While the operator writes to RTDB and the live mat reads from it, there may still be minor path sync issues or missing subscriptions for specific features (like the fullscreen scoreboard view).
- **Staff and Schedule CRUD**: The UI for Staff (`/competitions/[id]/staff`) and Schedule (`/competitions/[id]/schedule`) exists, but the Firestore wiring for direct CRUD operations is not fully completed or verified.
- **User Roles & Academy Assignment**: The `/users` directory exists but role/academy assignments need firmer integration with the Firebase `users` collection.
- **Analytics & Archiving Aggregations**: The `/archives/[id]` page has Chart.js UI, but the Firestore aggregations to feed those charts real data are pending.
- **GSAP Animations**: Some of the more complex GSAP animations from the HTML prototype were dialed back or omitted due to Next.js SSR constraints.

## 3. What Is To Be Done (Future Implementations)
- **Dashboard Aggregations**: The main dashboard (`/page.tsx`) needs to replace static mock data with actual aggregation queries across the `competitions` collection.
- **Dark Mode**: Dark mode tokens were deferred to v1.1.
- **Routing Cleanup**: The empty `/operator`, `/medals`, and legacy `/archive` (vs `/archives`) directories need to be deleted from the `app` directory.
- **Printable Tiesheets**: Add functionality to export the generated SVG tiesheets to high-quality PDF for physical printing.
- **Accessibility (a11y) Pass**: Systematic pass for WCAG AA compliance (focus rings, ARIA labels).

## 4. Vulnerabilities & Security Concerns
- **Plaintext Passwords in Firestore**: Currently, the competition `password` (used by the `PasswordGateway` for the operator portal) is saved to Firestore in plaintext during the Setup Wizard. **CRITICAL**: This must be updated to hash the password server-side before storing it, and verify it via a secure API route.
- **Dual Auth Systems**: The app relies on Firebase Auth (identity-based) for general access, but uses the Competition Password (credential-based) for the Operator portal. This dual-system creates complexity and potential bypass risks if route middleware is not strictly applied.
- **Firestore Security Rules**: Currently relying heavily on client-side logic. Comprehensive Firebase Security Rules (for both Firestore and RTDB) must be written and deployed to prevent unauthorized writes, especially for match advancement and scoring.
- **API Route Protections**: The server-side API routes (`/api/competitions/...`) must verify the user's Firebase Auth token (via `firebase-admin` auth checks) to ensure the requester is an Admin before executing imports or bracket patches.
- **`/debug` Route**: Ensure the `/debug` route is strictly stripped or guarded in production environments. (Currently protected by a `NODE_ENV` check, but should be double-checked).
