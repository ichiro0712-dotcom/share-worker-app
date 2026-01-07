# Codebase Review Plan

This document outlines the strategy for a comprehensive audit of the project.
The goal is to evaluate System Quality, UI/UX consistency, and Performance opportunities without altering the code.

## Review Architecture (Logical Blocks)

We will proceed in the following order:

### Block 1: System Foundation & Configuration
**Focus:** Project setup, dependencies, global styles, and build configuration.
- `package.json`
- `tsconfig.json`
- `next.config.mjs`
- `middleware.ts`
- `tailwind.config.ts`
- `postcss.config.js`
- `app/globals.css`
- `app/layout.tsx` (Root Layout)
- `app/global-error.tsx`

### Block 2: Database & Data Modeling
**Focus:** Schema design, data integrity, and relationships.
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/migrations/`
- `types/` (Global Type Definitions)

### Block 3: Core Logic, Authentication & API
**Focus:** Backend logic, security, and reusable utilities.
- `lib/` (Auth, Prisma Client, Session Management)
- `app/api/` (API Routes: Auth, Cron, Maps, Upload)
- `utils/`
- `contexts/`
- `hooks/` (Custom Hooks)

### Block 4: Feature: Admin Dashboard
**Focus:** Management functionalities, data tables, and checking flows.
- `app/admin/` (All Admin Routes)
- `components/admin/` (If applicable/separable)

### Block 5: Feature: Worker Interface (Main App)
**Focus:** User-facing features, job search, and application flows.
- `app/mypage/` (Profile, Settings)
- `app/jobs/` (Job Search & Details)
- `app/applications/` (Application Status)
- `app/messages/` (Chat/Communication)
- `app/my-jobs/`
- `components/job/`

### Block 6: Public Pages & Auth UI
**Focus:** Onboarding experience and public-facing content.
- `app/page.tsx` (Landing Page)
- `app/login/`
- `app/register/`
- `app/style-guide/`
- `app/dev/` (Dev tools)

### Block 7: Shared Components & Design System
**Focus:** Reusability, component architecture, and styling consistency.
- `components/` (Generic/Shared components: UI primitives, Layouts)

---

## Review Process (Per Block)

For each block, we will assess:
1.  **System Quality**: Bugs, security risks, code structure, variable naming, strict type usage.
2.  **UI/UX**: (Where applicable) Usage flow, responsiveness, feedback mechanisms.
3.  **Performance (Speed)**:
    - **Plan A**: Quick wins (query optimization, caching, memoization).
    - **Plan B**: Architectural changes (if necessary).

## Output

- Findings will be aggregated into `docs/FINAL_REVIEW_REPORT.md`.
