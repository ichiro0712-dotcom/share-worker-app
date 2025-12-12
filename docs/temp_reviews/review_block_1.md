# Review Block 1: System Foundation & Configuration

## 1. Project Configuration
- **`package.json`**:
    - Next.js version is `14.2.18` (Recent enough).
    - `bcryptjs` matches `@types/bcryptjs`.
    - `lucide-react` version `0.554.0` is very new.
    - `react-hot-toast` is used for notifications.
    - `next-auth` is version `4.24.13` (Pages Router era mostly, but compatible with App Router. Need to check if migrating to v5 is better or if v4 usage is correct in App Router).
    - `prisma` and `@prisma/client` are consistently `5.22.0`.
    - `postcss` version `8.5.6` seems high (check compatibility with tailwind `3.4.18`).
- **`tsconfig.json`**:
    - `strict: true` is good.
    - `paths` alias `@/*` -> `./*` is standard.
    - `exclude` contains `UIbuckup_251123`, suggesting leftover backup folders in the repo. **Recommendation: Remove junk folders.**

## 2. Next.js & Build Config
- **`next.config.mjs`**:
    - `images.remotePatterns` allows `images.unsplash.com`. Good security practice.
- **`middleware.ts`**:
    - Uses `next-auth/jwt` (`getToken`).
    - **Security Risk**: The comment `// 管理者ページは別の認証システム（localStorage）を使用しているためスキップ` indicates a potential vulnerability. If admin pages rely solely on client-side `localStorage` checks, they are **unprotected** at the server/edge level. Anyone could theoretically access admin routes if the client-side check is bypassed or if the page renders sensitive data before the check.
    - `publicPaths` includes `/dev-portal` (Good).
- **`app/global-error.tsx`**:
    - Simple fallback. Inline styles are raw but acceptable for a crash screen.

## 3. Styling & UI Foundation
- **`tailwind.config.ts`**:
    - Defines `primary` (#FF3333) and `secondary` (#3895FF) colors.
    - `admin` colors defined separately.
    - Uses `satisfies Config` (Good TypeScript usage).
- **`app/globals.css`**:
    - `@tailwind` directives present.
    - `body` background is hardcoded to `#ffffff`, conflicting slightly with `tailwind.config.ts`'s `background: "#F7F7F7"`.
- **`app/layout.tsx`**:
    - Wraps `children` in `<AuthProvider>`.
    - `<Toaster position="bottom-center" />` is globally placed (Good).
    - `lang="ja"` is correct.

## Summary of Findings (Block 1)
1.  **Critical**: Admin route protection in `middleware.ts` is bypassed (`if (pathname.startsWith('/admin')) { return NextResponse.next(); }`). If admin pages don't have their own robust server-side auth check, this is a major security flaw.
2.  **Maintenance**: `UIbuckup_251123` in `tsconfig.json` exclude list suggests codebase clutter.
3.  **Consistency**: Global CSS body background (`#ffffff`) vs Tailwind config (`#F7F7F7`).
