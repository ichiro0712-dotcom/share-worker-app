# 無料LLM向け指示書: システム管理者機能 Phase 1

> **作成日**: 2025-12-09
> **目的**: システム管理者機能の基盤構築
> **参照**: `docs/system-admin-features.md`
> **前提**: Next.js 14 + TypeScript + Prisma + PostgreSQL

---

## 概要

この指示書は、システム管理者機能のPhase 1（基盤構築）を実装するためのものです。
作業量が多いため、**Task 1〜5に分割**しています。順番に実行してください。

---

## Task 1: DB拡張（既存テーブル）

### 目的
User/Facilityテーブルにstatus、deleted_at、registration_step関連のフィールドを追加する。

### 作業内容

#### 1.1 `prisma/schema.prisma` を編集

**Userモデルの末尾（`@@map("users")` の直前）に以下を追加:**

```prisma
  // ステータス管理・退会機能用
  status               UserStatus @default(ACTIVE)
  deleted_at           DateTime?  @map("deleted_at")
  // 登録離脱率トラッキング用
  registration_step    Int?       @map("registration_step")
  registration_started DateTime?  @map("registration_started")
```

**Facilityモデルの末尾（`@@map("facilities")` の直前）に以下を追加:**

```prisma
  // ステータス管理・退会機能用
  status               FacilityStatus @default(ACTIVE)
  region               String?
  deleted_at           DateTime?      @map("deleted_at")
  // 登録離脱率トラッキング用
  registration_step    Int?           @map("registration_step")
  registration_started DateTime?      @map("registration_started")
```

**enumを追加（ファイル末尾に）:**

```prisma
enum UserStatus {
  PENDING
  ACTIVE
  SUSPENDED
  DELETED

  @@map("user_status")
}

enum FacilityStatus {
  PENDING
  ACTIVE
  SUSPENDED
  DELETED

  @@map("facility_status")
}
```

#### 1.2 マイグレーション実行

```bash
npx prisma migrate dev --name add_user_facility_status
```

### 完了条件
- [ ] `npx prisma validate` がエラーなく通る
- [ ] マイグレーションが成功する

---

## Task 2: DB拡張（新規テーブル）

### 目的
SystemAdmin、AuditLog、Alertテーブルを作成する。

### 作業内容

#### 2.1 `prisma/schema.prisma` に以下を追加

```prisma
// ============================================
// システム管理者関連
// ============================================

model SystemAdmin {
  id            Int             @id @default(autoincrement())
  email         String          @unique
  password_hash String          @map("password_hash")
  name          String
  role          SystemAdminRole @default(ADMIN)
  is_active     Boolean         @default(true) @map("is_active")
  created_at    DateTime        @default(now()) @map("created_at")
  updated_at    DateTime        @updatedAt @map("updated_at")

  @@map("system_admins")
}

enum SystemAdminRole {
  SUPER_ADMIN
  ADMIN
  VIEWER

  @@map("system_admin_role")
}

model AuditLog {
  id          Int      @id @default(autoincrement())
  admin_type  String   @map("admin_type")
  admin_id    Int      @map("admin_id")
  action      String
  target_type String?  @map("target_type")
  target_id   Int?     @map("target_id")
  details     Json?
  ip_address  String?  @map("ip_address")
  user_agent  String?  @map("user_agent")
  created_at  DateTime @default(now()) @map("created_at")

  @@map("audit_logs")
}

model Alert {
  id          Int         @id @default(autoincrement())
  type        String
  severity    String
  target_type String?     @map("target_type")
  target_id   Int?        @map("target_id")
  message     String
  details     Json?
  status      AlertStatus @default(PENDING)
  resolved_by Int?        @map("resolved_by")
  resolved_at DateTime?   @map("resolved_at")
  created_at  DateTime    @default(now()) @map("created_at")

  @@map("alerts")
}

enum AlertStatus {
  PENDING
  RESOLVED
  IGNORED

  @@map("alert_status")
}
```

#### 2.2 マイグレーション実行

```bash
npx prisma migrate dev --name add_system_admin_tables
```

#### 2.3 初期システム管理者を作成するシードスクリプト

`scripts/create_system_admin.ts` を作成:

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@sworks.jp';
  const password = 'admin123'; // 本番環境では変更必須
  const name = 'システム管理者';

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.systemAdmin.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password_hash: passwordHash,
      name,
      role: 'SUPER_ADMIN',
      is_active: true,
    },
  });

  console.log('システム管理者を作成しました:', admin);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

実行:
```bash
npx tsx scripts/create_system_admin.ts
```

### 完了条件
- [ ] `npx prisma validate` がエラーなく通る
- [ ] マイグレーションが成功する
- [ ] 初期管理者が作成される

---

## Task 3: システム管理者認証

### 目的
システム管理者用のログイン機能を実装する。

### 作業内容

#### 3.1 認証用API作成

`app/api/system-admin/login/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'メールアドレスとパスワードを入力してください' },
        { status: 400 }
      );
    }

    const admin = await prisma.systemAdmin.findUnique({
      where: { email },
    });

    if (!admin || !admin.is_active) {
      return NextResponse.json(
        { error: 'メールアドレスまたはパスワードが正しくありません' },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'メールアドレスまたはパスワードが正しくありません' },
        { status: 401 }
      );
    }

    // セッションをCookieに保存
    const sessionData = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    };

    const cookieStore = await cookies();
    cookieStore.set('system_admin_session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24時間
      path: '/',
    });

    // 操作ログを記録
    await prisma.auditLog.create({
      data: {
        admin_type: 'system',
        admin_id: admin.id,
        action: 'login',
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'ログインに失敗しました' },
      { status: 500 }
    );
  }
}
```

#### 3.2 ログアウトAPI

`app/api/system-admin/logout/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('system_admin_session');
  return NextResponse.json({ success: true });
}
```

#### 3.3 セッション確認API

`app/api/system-admin/me/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('system_admin_session');

  if (!session) {
    return NextResponse.json({ admin: null }, { status: 401 });
  }

  try {
    const admin = JSON.parse(session.value);
    return NextResponse.json({ admin });
  } catch {
    return NextResponse.json({ admin: null }, { status: 401 });
  }
}
```

#### 3.4 認証フック作成

`hooks/useSystemAdmin.ts`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SystemAdmin {
  id: number;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';
}

export function useSystemAdmin() {
  const [admin, setAdmin] = useState<SystemAdmin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/system-admin/me');
        if (res.ok) {
          const data = await res.json();
          setAdmin(data.admin);
        } else {
          setAdmin(null);
        }
      } catch {
        setAdmin(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const logout = async () => {
    await fetch('/api/system-admin/logout', { method: 'POST' });
    setAdmin(null);
    router.push('/system-admin/login');
  };

  return {
    admin,
    isLoading,
    isAuthenticated: !!admin,
    isSuperAdmin: admin?.role === 'SUPER_ADMIN',
    logout,
  };
}
```

### 完了条件
- [ ] `/api/system-admin/login` でログインできる
- [ ] `/api/system-admin/me` でセッション確認できる
- [ ] `/api/system-admin/logout` でログアウトできる

---

## Task 4: ログイン画面

### 目的
システム管理者用のログイン画面を作成する。

### 作業内容

#### 4.1 ログインページ

`app/system-admin/login/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function SystemAdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/system-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('ログインしました');
        router.push('/system-admin');
      } else {
        toast.error(data.error || 'ログインに失敗しました');
      }
    } catch {
      toast.error('ログインに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
          システム管理者ログイン
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition"
          >
            {isLoading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

#### 4.2 システム管理者レイアウト

`app/system-admin/layout.tsx`:

```typescript
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSystemAdmin } from '@/hooks/useSystemAdmin';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  FileText,
  MessageSquare,
  Star,
  Settings,
  Shield,
  Bell,
  LogOut,
  ChevronDown,
} from 'lucide-react';

const menuItems = [
  { href: '/system-admin', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/system-admin/analytics', label: 'アナリティクス', icon: FileText },
  { href: '/system-admin/workers', label: 'ワーカー管理', icon: Users },
  { href: '/system-admin/facilities', label: '施設管理', icon: Building2 },
  { href: '/system-admin/jobs', label: '求人管理', icon: Briefcase },
  { href: '/system-admin/applications', label: '応募管理', icon: FileText },
  { href: '/system-admin/reviews', label: 'レビュー管理', icon: Star },
  { href: '/system-admin/messages', label: 'メッセージ管理', icon: MessageSquare },
  { href: '/system-admin/alerts', label: 'アラート', icon: Bell },
  { href: '/system-admin/settings', label: 'システム設定', icon: Settings },
  { href: '/system-admin/security', label: 'セキュリティ', icon: Shield },
];

export default function SystemAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, isLoading, isAuthenticated, logout } = useSystemAdmin();

  // ログインページは認証チェックをスキップ
  const isLoginPage = pathname === '/system-admin/login';

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isLoginPage) {
      router.push('/system-admin/login');
    }
  }, [isLoading, isAuthenticated, isLoginPage, router]);

  // ログインページの場合はシンプルなレイアウト
  if (isLoginPage) {
    return <>{children}</>;
  }

  // ローディング中
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  // 未認証
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* サイドバー */}
      <aside className="w-64 bg-gray-800 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-lg font-bold">S WORKS 管理</h1>
          <p className="text-xs text-gray-400 mt-1">{admin?.name}</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md mb-1 transition ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={logout}
            className="flex items-center gap-2 text-gray-300 hover:text-white text-sm"
          >
            <LogOut className="w-4 h-4" />
            ログアウト
          </button>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
```

### 完了条件
- [ ] `/system-admin/login` でログイン画面が表示される
- [ ] ログイン後 `/system-admin` にリダイレクトされる
- [ ] サイドバーが表示される

---

## Task 5: ダッシュボード

### 目的
統計サマリーを表示するダッシュボードを作成する。

### 作業内容

#### 5.1 統計取得API

`app/api/system-admin/stats/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  // 認証チェック
  const cookieStore = await cookies();
  const session = cookieStore.get('system_admin_session');
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    const thisMonth = new Date(today);
    thisMonth.setDate(1);

    // ワーカー統計
    const totalWorkers = await prisma.user.count();
    const todayWorkers = await prisma.user.count({
      where: { created_at: { gte: today } },
    });
    const weekWorkers = await prisma.user.count({
      where: { created_at: { gte: thisWeek } },
    });
    const monthWorkers = await prisma.user.count({
      where: { created_at: { gte: thisMonth } },
    });

    // 施設統計
    const totalFacilities = await prisma.facility.count();
    const todayFacilities = await prisma.facility.count({
      where: { created_at: { gte: today } },
    });
    const weekFacilities = await prisma.facility.count({
      where: { created_at: { gte: thisWeek } },
    });
    const monthFacilities = await prisma.facility.count({
      where: { created_at: { gte: thisMonth } },
    });

    // 求人統計
    const publishedJobs = await prisma.job.count({
      where: { status: 'PUBLISHED' },
    });
    const todayDeadlineJobs = await prisma.jobWorkDate.count({
      where: {
        deadline: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    // 応募統計
    const todayApplications = await prisma.application.count({
      where: { created_at: { gte: today } },
    });
    const todayMatched = await prisma.application.count({
      where: {
        created_at: { gte: today },
        status: { in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'] },
      },
    });
    const todayCancelled = await prisma.application.count({
      where: {
        created_at: { gte: today },
        status: 'CANCELLED',
      },
    });

    // 最近の活動
    const recentWorkers = await prisma.user.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      select: { id: true, name: true, created_at: true },
    });

    const recentFacilities = await prisma.facility.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      select: { id: true, facility_name: true, created_at: true },
    });

    const recentApplications = await prisma.application.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      include: {
        user: { select: { name: true } },
        workDate: {
          include: {
            job: { select: { title: true } },
          },
        },
      },
    });

    // アラート（未対応）
    const pendingAlerts = await prisma.alert.findMany({
      where: { status: 'PENDING' },
      take: 10,
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({
      workers: {
        total: totalWorkers,
        today: todayWorkers,
        week: weekWorkers,
        month: monthWorkers,
      },
      facilities: {
        total: totalFacilities,
        today: todayFacilities,
        week: weekFacilities,
        month: monthFacilities,
      },
      jobs: {
        published: publishedJobs,
        todayDeadline: todayDeadlineJobs,
      },
      applications: {
        today: todayApplications,
        matched: todayMatched,
        cancelled: todayCancelled,
      },
      recentActivity: {
        workers: recentWorkers,
        facilities: recentFacilities,
        applications: recentApplications,
      },
      alerts: pendingAlerts,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: '統計の取得に失敗しました' },
      { status: 500 }
    );
  }
}
```

#### 5.2 ダッシュボードページ

`app/system-admin/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Users, Building2, Briefcase, FileText, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface Stats {
  workers: { total: number; today: number; week: number; month: number };
  facilities: { total: number; today: number; week: number; month: number };
  jobs: { published: number; todayDeadline: number };
  applications: { today: number; matched: number; cancelled: number };
  recentActivity: {
    workers: { id: number; name: string; created_at: string }[];
    facilities: { id: number; facility_name: string; created_at: string }[];
    applications: { id: number; user: { name: string }; workDate: { job: { title: string } } }[];
  };
  alerts: { id: number; type: string; severity: string; message: string; created_at: string }[];
}

export default function SystemAdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/system-admin/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return <div className="text-gray-500">読み込み中...</div>;
  }

  if (!stats) {
    return <div className="text-red-500">統計の取得に失敗しました</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">ダッシュボード</h1>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="ワーカー"
          icon={<Users className="w-6 h-6 text-blue-500" />}
          total={stats.workers.total}
          today={stats.workers.today}
          week={stats.workers.week}
          month={stats.workers.month}
          href="/system-admin/workers"
        />
        <StatCard
          title="施設"
          icon={<Building2 className="w-6 h-6 text-green-500" />}
          total={stats.facilities.total}
          today={stats.facilities.today}
          week={stats.facilities.week}
          month={stats.facilities.month}
          href="/system-admin/facilities"
        />
        <StatCard
          title="公開中求人"
          icon={<Briefcase className="w-6 h-6 text-purple-500" />}
          total={stats.jobs.published}
          subtitle={`本日締切: ${stats.jobs.todayDeadline}件`}
          href="/system-admin/jobs"
        />
        <StatCard
          title="本日の応募"
          icon={<FileText className="w-6 h-6 text-orange-500" />}
          total={stats.applications.today}
          subtitle={`マッチング: ${stats.applications.matched} / キャンセル: ${stats.applications.cancelled}`}
          href="/system-admin/applications"
        />
      </div>

      {/* アラート */}
      {stats.alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            未対応アラート ({stats.alerts.length})
          </h2>
          <div className="space-y-2">
            {stats.alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-md border ${
                  alert.severity === 'critical'
                    ? 'bg-red-50 border-red-200'
                    : alert.severity === 'warning'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <p className="text-sm font-medium">{alert.message}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(alert.created_at).toLocaleString('ja-JP')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最近の活動 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RecentList
          title="新規ワーカー"
          items={stats.recentActivity.workers.map((w) => ({
            id: w.id,
            name: w.name,
            date: w.created_at,
          }))}
          href="/system-admin/workers"
        />
        <RecentList
          title="新規施設"
          items={stats.recentActivity.facilities.map((f) => ({
            id: f.id,
            name: f.facility_name,
            date: f.created_at,
          }))}
          href="/system-admin/facilities"
        />
        <RecentList
          title="最近の応募"
          items={stats.recentActivity.applications.map((a) => ({
            id: a.id,
            name: `${a.user.name} → ${a.workDate.job.title}`,
            date: '',
          }))}
          href="/system-admin/applications"
        />
      </div>
    </div>
  );
}

function StatCard({
  title,
  icon,
  total,
  today,
  week,
  month,
  subtitle,
  href,
}: {
  title: string;
  icon: React.ReactNode;
  total: number;
  today?: number;
  week?: number;
  month?: number;
  subtitle?: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition cursor-pointer">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">{title}</h3>
          {icon}
        </div>
        <p className="text-2xl font-bold text-gray-800">{total.toLocaleString()}</p>
        {today !== undefined && (
          <p className="text-xs text-gray-500 mt-2">
            今日: {today} / 今週: {week} / 今月: {month}
          </p>
        )}
        {subtitle && <p className="text-xs text-gray-500 mt-2">{subtitle}</p>}
      </div>
    </Link>
  );
}

function RecentList({
  title,
  items,
  href,
}: {
  title: string;
  items: { id: number; name: string; date: string }[];
  href: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800">{title}</h3>
        <Link href={href} className="text-sm text-blue-500 hover:underline">
          すべて見る
        </Link>
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400">データがありません</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="text-sm">
              <p className="text-gray-800 truncate">{item.name}</p>
              {item.date && (
                <p className="text-xs text-gray-400">
                  {new Date(item.date).toLocaleString('ja-JP')}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

### 完了条件
- [ ] `/system-admin` でダッシュボードが表示される
- [ ] 統計カードに数値が表示される
- [ ] 最近の活動が表示される

---

## 作業完了後チェックリスト（必須）

以下を順番に実行してください：

### 1. キャッシュクリアと再ビルド
```bash
rm -rf .next && npm run build
```

### 2. TypeScriptエラーチェック
```bash
npm run build
```
エラーがあれば修正してから次へ進む。

### 3. 開発サーバー再起動
```bash
# 既存のサーバーを停止してから
rm -rf .next && npm run dev
```

### 4. ブラウザ確認
- `/system-admin/login` でログイン画面が表示される
- 初期管理者（admin@sworks.jp / admin123）でログインできる
- `/system-admin` でダッシュボードが表示される
- サイドバーのメニューが表示される

### 5. 変更ファイルの報告
変更したファイル一覧を報告すること。

---

## 次のステップ

Phase 1完了後、Phase 2（運用機能）に進みます。
別の指示書 `LLM_TASK_SYSTEM_ADMIN_PHASE2.md` を作成予定です。
