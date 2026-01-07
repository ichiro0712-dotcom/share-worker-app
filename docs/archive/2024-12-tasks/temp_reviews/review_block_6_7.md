# Review Block 6 & 7: Public Pages, Auth UI & Shared Components

## 1. Public Job List (`app/page.tsx`)
- **`force-dynamic`**: explicitly set. Correct given the heavy use of `searchParams`.
- **Data Transformation**: Repeats the *same* manual `job` transformation logic seen in `app/jobs/[id]/page.tsx`.
    - **DRY Violation**: This transformation logic should be a shared utility function. It's copy-pasted.
- **Filtering**: Complex normalization of query params (`normalizeArray`). This is good defensive coding.
- **Suspense**: Wraps client component. Good.

## 2. Login Page (`app/login/page.tsx`)
- **Feature**: Helper button to login as Test Users.
- **Implementation**: `getTestUsers()` fetches from DB and sends to client.
- **Security Check**: Is `getTestUsers()` stripped in production?
    - I need to check `src/lib/actions.ts` again to see if `getTestUsers` is safe or if it exposes emails of real users in production if database is real.
    - If `getTestUsers` just returns `take: 3` users from DB, it's a **Privacy Leak** in production (enumerating users).
- **Client-Side Auth**: Calls `login` from `useAuth` (wrapper around `signIn` of NextAuth?).

## 3. Shared Components (`components/ui/`)
- **Minimal**: Only 5 files (`Button`, `EmptyState`, `badge`, `tag`, `LoadingSpinner`).
- **Tailwind**: Used extensively.

## Summary of Findings (Block 6 & 7)
1.  **Privacy/Security Risk**: `app/login/page.tsx` fetches and displays users via `getTestUsers`. Unless this is strictly mocked data or disabled in prod, it's a user enumeration vulnerability.
2.  **Code Maintenance**: Data transformation logic for "Jobs" is duplicated across at least 2 files (`app/page.tsx`, `app/jobs/[id]/page.tsx`). Must extract to a mapper.
