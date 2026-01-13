# Review Block 3: Core Logic, Authentication & API

## 1. Authentication (`lib/auth.ts`)
- **`next-auth` Configuration**:
    - Uses `CredentialsProvider` with `bcrypt` comparison. Standard and correct.
    - `session` strategy is `jwt`.
    - **Session Callback**: Fetches fresh user data from DB on every session check (`async session({ session, token })`). This is good for data freshness but adds a DB query overhead on every request that checks the session.
    - **Dev Backdoor?**: In `src/lib/actions.ts`: `getAuthenticatedUser()` has a "DEV MODE" fallback that creates/returns a test user (ID=1) if no session exists. This is dangerous if deployed to production without `process.env.NODE_ENV === 'production'` stripping it, although there is a check `if (process.env.NODE_ENV === 'production')`. **Risk**: If the `NODE_ENV` variable is misconfigured or missing in production, this backdoor opens.

## 2. Admin Authentication (`lib/admin-session.ts`)
- **Critical Security Flaw**:
    - The entire admin session management is **Client-Side Only** using `localStorage`.
    - `isAdminSessionValid()` checks `localStorage`.
    - There is **NO server-side verification** for admin actions in `middleware.ts` (as noted in Block 1) or likely in Server Actions (needs check).
    - `createAdminSession` stores `role` and `facilityId` in `localStorage`. A malicious user can manually edit `localStorage` to impersonate an admin or change their facility ID, provided the API trusts these values blindly.
    - **Action Item**: We must check if Admin APIs verify the session on the server side using a secure token, or if they just trust the parameters sent from the client.

## 3. Server Actions (`src/lib/actions.ts`)
- **File Size**: Giant file (>200KB, 6000+ lines).
- **Structure**: Contains a mix of highly specific logic (Job search with multiple filters) and generic utilities.
- **Job Search (`getJobs`)**:
    - Builds complex `where` clause dynamically.
    - Logic seems sound but complex to maintain.
    - **Performance**: Does `findMany` then maps results in memory to calculate `totalAppliedCount`, `totalMatchedCount` etc. This is **N+1** problem capability if `include` is not carefully managed (here it includes `workDates` efficiently, so memory mapping is okay for now, but pagination is not obvious).
- **Application Logic (`applyForJob`)**:
    - Transactional (`prisma.$transaction`). Good.
    - Checks `profileCheck` before applying. Good.
    - **Concurrency**: Checks `recruitment_count` inside the function, then updates. Race condition possible? It uses `increment` inside transaction, which is atomic for the counter, but the *check* `if (targetWorkDate.matched_count >= ...)` is done *outside* the transaction or before the increment. **Race Condition Risk**: Two users applying simultaneously for the last spot might both pass the "read" check before one "increments". Prisma transaction should wrap the *read* and *write* or use optimistic locking/database constraints.
- **Rating Logic**:
    - Heavily manual calculation of averages in memory (`actions.ts`).
    - Recalculates `rating` on the fly in some getters? Or updates it?
    - `updateFacilityRating` (inferred existence from grep results): seems to aggregations.

## Summary of Findings (Block 3)
1.  **Critical Security Vulnerability**: Admin authentication is weak (Client-side localStorage + Middleware bypass).
2.  **Code Structure**: `src/lib/actions.ts` is a "God Object" file, too large and doing too much.
3.  **Concurrency Risk**: Job application logic has a potential race condition on the last seat (Read-then-Write non-atomically regarding the limit check).
4.  **Performance**: In-memory aggregation of counts/ratings instead of DB-level aggregation (e.g. `groupBy`, `aggregate`) or cached columns.
