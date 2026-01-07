# Review Block 4: Feature: Admin Dashboard

## 1. Structure & Layout
- **`app/admin/layout.tsx`**:
    - Checks `pathname` to exclude layout for login/terms.
    - Uses client-side checks for showing layout. `useAuth` handles redirect.
    - **Security**: As noted before, `layout.tsx` is client-side. The *content* of the admin pages is fetched via client-side `useEffect` calling Server Actions. If those Server Actions don't verify session *securely* (server-side), data is exposed.
    - **Note**: `src/lib/actions.ts` methods like `getAdminJobsList` *do not* seem to have an explicit `getAuthenticatedUser` or admin session check inside them in the snippet I saw (I need to verify if they are protected). If `getAdminJobsList(facilityId)` takes `facilityId` as a plain argument and returns data without checking if the *current user* is admin of that *facility*, it is a **IDOR (Insecure Direct Object Reference) vulnerability**.
        - *Correction*: I need to re-verify `getAdminJobsList` in `actions.ts`. It takes `facilityId`. Does it check `getServerSession`?
        - If `getJobs` uses `getAuthenticatedUser`, maybe admin actions do too? *Wait*, the admin session is `localStorage` based. So `getServerSession` (next-auth) is for *Users* (Workers). Admin likely has *no* server session. This means `actions.ts` functions for admin might be completely unprotected or rely on the "User" session which is wrong, or simply trust the `facilityId` passed from the client! **This is a massive Critical vulnerability.**

## 2. Job Management (`app/admin/jobs/page.tsx`)
- **State Management**: Complex local state (`jobs`, `searchQuery`, `statusFilter`, `selectedJobIds`).
- **Data Fetching**: Calls `getAdminJobsList`, `getAdminJobTemplates`, `getFacilityInfo` in `useEffect`. Client-side data fetching pattern.
- **UI/UX**:
    - **Good**: Bulk actions, filtering, pagination, "Recruiting" rate visualization.
    - **Bad**: `getAdminJobsList` returns *all* jobs for a facility? If a facility has 1000s of jobs, this will be slow (Pagination is done on *client key* `filteredJobs.slice`). **Performance Risk**: Initial load drags down all history. Should paginate on server.
- **Filtering**: All filtering (Status, Date, Search) is done **Client-Side**. This confirms the "Fetch All" strategy. Not scalable.

## 3. Application Management (`app/admin/applications/page.tsx`)
- **Complexity**: Handles both "By Job" and "By Worker" views.
- **N+1 Risk**: `getJobsWithApplications` and `getApplicationsByWorker` likely fetch deep trees.
- **UX**: "Optimistic UI" updates for Favorite/Block (`setWorkerStates`). Good for responsiveness.
- **Features**: Detailed filtering, worker profile modal, approval flow. Feature-rich.

## Summary of Findings (Block 4)
1.  **Critical Security (re-confirmed risk)**: Admin pages use client-side auth. Data fetching (`getAdminJobsList`) likely trusts client-provided `facilityId` without server-side validation of "Admin-ship", because Admin Session is localStorage-only.
2.  **Performance**: Admin lists (Jobs, Applications) fetch **everything** and paginate/filter on the client. This will break as data grows (Scalability issue).
3.  **Architecture**: Heavy logic in Client Components (`useEffect` -> Server Action -> Set State). Modern Next.js App Router patterns often prefer Server Components fetching data directly (but requires Server-side session, which is missing for Admins). The architecture choices (Client-side admin session) forced this "Client-fetch" pattern.
