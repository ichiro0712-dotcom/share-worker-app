# ユーザー操作ログ（Activity Log）の使用方法

## 概要

ユーザーの操作をデータベースに記録し、デバッグや調査、セキュリティ監査に活用します。
デバイス情報（OS、ブラウザ、端末種別）とIPアドレスを**自動的に取得・保存**します。

**重要:** `lib/logger.ts`の`logActivity()`関数を使用してください。Server Actions/Route Handlers内では、User-AgentとIPアドレスを自動取得します。

## 取得される情報

### 自動取得される情報

| 項目 | 説明 | 例 |
|------|------|-----|
| **user_agent** | User-Agent文字列（生データ） | `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...` |
| **ip_address** | クライアントIPアドレス | `203.0.113.42` |
| **app_version** | Git Commit SHA（短縮7桁） | `abc1234` |
| **deployment_id** | Vercel Deployment ID | `dpl_xyz789` |

### User-Agentから解析される情報（request_dataに保存）

```json
{
  "device": {
    "browser": "Chrome 120.0",
    "os": "Windows 10",
    "device": "desktop",
    "model": null
  }
}
```

| フィールド | 説明 | 取り得る値 |
|-----------|------|-----------|
| `browser` | ブラウザ名とバージョン | `Chrome 120.0`, `Safari 17.2`, `Firefox 121.0` |
| `os` | OS名とバージョン | `Windows 10`, `macOS 14.2`, `iOS 17.2`, `Android 13` |
| `device` | デバイス種別 | `desktop`, `mobile`, `tablet` |
| `model` | 端末モデル名 | `iPhone`, `iPad`, `SM-G991B`（Androidの場合） |

## 使用方法

### 基本的な使い方

```typescript
import { logActivity } from '@/lib/logger';

// 基本的なログ保存（デバイス情報・IPアドレスを自動取得）
await logActivity({
  userType: 'WORKER',
  userId: 123,
  userEmail: 'user@example.com',
  action: 'JOB_VIEW',
  targetType: 'Job',
  targetId: 456,
  result: 'SUCCESS',
});
```

### ログインの記録

```typescript
import { logActivity } from '@/lib/logger';

// ログイン成功時
await logActivity({
  userType: 'WORKER',
  userId: user.id,
  userEmail: user.email,
  action: 'LOGIN',
  result: 'SUCCESS',
});
```

### プロフィール更新の記録

```typescript
import { logActivity } from '@/lib/logger';

// プロフィール更新時
await logActivity({
  userType: 'WORKER',
  userId: user.id,
  userEmail: user.email,
  action: 'PROFILE_UPDATE',
  targetType: 'User',
  targetId: user.id,
  requestData: {
    name: '新しい名前',
    phone_number: '090-1234-5678',
  },
  result: 'SUCCESS',
});
```

### 求人応募の記録

```typescript
import { logActivity } from '@/lib/logger';

// 求人応募時
await logActivity({
  userType: 'WORKER',
  userId: user.id,
  userEmail: user.email,
  action: 'JOB_APPLY',
  targetType: 'Job',
  targetId: job.id,
  requestData: {
    work_date_id: workDate.id,
  },
  result: 'SUCCESS',
});
```

### エラーの記録

```typescript
import { logActivity, getErrorMessage, getErrorStack } from '@/lib/logger';

try {
  // 何か処理
} catch (error) {
  await logActivity({
    userType: 'WORKER',
    userId: user.id,
    userEmail: user.email,
    action: 'JOB_APPLY_FAILED',
    targetType: 'Job',
    targetId: job.id,
    result: 'ERROR',
    errorMessage: getErrorMessage(error),
    errorStack: getErrorStack(error),
    url: '/api/jobs/apply',
  });
  throw error;
}
```

### 保存される情報の例

```json
{
  "id": 1,
  "user_type": "WORKER",
  "user_id": 123,
  "user_email": "worker@example.com",
  "action": "JOB_APPLY",
  "target_type": "Job",
  "target_id": 456,
  "request_data": {
    "work_date_id": 789,
    "device": {
      "browser": "Chrome 120.0",
      "os": "macOS 14.2",
      "device": "desktop",
      "model": null
    }
  },
  "response_data": null,
  "result": "SUCCESS",
  "error_message": null,
  "error_stack": null,
  "url": null,
  "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "ip_address": "203.0.113.42",
  "app_version": "abc1234",
  "deployment_id": "dpl_xyz789",
  "created_at": "2026-02-10T12:34:56.789Z"
}
```

## 軽量トレースログ（DB保存不要）

頻繁に発生する操作（ページ閲覧、検索など）はDB保存せず、Vercel Logsのみに記録します：

```typescript
import { logTrace } from '@/lib/logger';

// ページ閲覧（Vercel Logsのみ、DBには保存しない）
logTrace({
  action: 'PAGE_VIEW',
  url: '/jobs/123',
  userId: user.id,
  userType: 'WORKER',
});

// 検索実行
logTrace({
  action: 'SEARCH',
  data: { keyword: '介護', prefecture: '東京都' },
  userId: user.id,
});
```

**使い分け:**
- `logActivity()`: 重要な操作（ログイン、応募、更新など）→ DB保存
- `logTrace()`: 軽量な追跡（ページ閲覧、検索など）→ Vercel Logsのみ

## デバイス情報のみを取得する場合

ログ保存とは別に、デバイス情報だけを取得したい場合：

```typescript
import { getDeviceInfo, formatDeviceInfo, simplifyDeviceInfo } from '@/src/lib/device-info';

// デバイス情報を取得（Server Actions/Route Handlers内のみ）
const deviceInfo = await getDeviceInfo();

// 人間が読みやすい形式に変換
const formatted = formatDeviceInfo(deviceInfo);
// => "Chrome 120.0 on Windows 10 (Desktop)"

// 簡略化されたオブジェクト
const simplified = simplifyDeviceInfo(deviceInfo);
// => { browser: "Chrome 120.0", os: "Windows 10", device: "desktop", model: null }
```

## プライバシーとセキュリティの考慮事項

### 個人情報保護

**IPアドレスとUser-Agentは個人情報に該当する可能性があります。**

- 日本の個人情報保護法：単独では個人を特定できないが、他の情報と組み合わせると特定可能
- GDPR（EU一般データ保護規則）：IPアドレスは個人データとして扱われる

### 必須対応

1. **プライバシーポリシーへの記載**
   - 収集する情報の種類を明記
   - 利用目的を明記（サービス改善、セキュリティ、デバッグ）
   - 保存期間を明記

2. **データの最小化**
   - 必要な情報のみを収集
   - 不要な詳細情報は保存しない

3. **アクセス制御**
   - システム管理者のみがアクセス可能
   - 不正アクセスの監視

4. **保存期間の設定**
   ```sql
   -- 例：90日以上前のログを削除（定期実行）
   DELETE FROM user_activity_logs
   WHERE created_at < NOW() - INTERVAL '90 days';
   ```

### データ保持ポリシーの例

| ログ種別 | 保存期間 | 理由 |
|---------|---------|------|
| 通常操作ログ | 90日 | サービス改善・デバッグ |
| セキュリティイベント | 1年 | セキュリティ監査 |
| エラーログ | 180日 | 問題調査・再発防止 |

## よくあるユースケース

### 1. 不正アクセスの検知

```typescript
// 複数のIPアドレスから同時ログイン試行を検出
const recentLogins = await prisma.userActivityLog.findMany({
  where: {
    user_id: userId,
    action: 'LOGIN',
    created_at: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // 1時間以内
  },
  select: {
    ip_address: true,
    user_agent: true,
    created_at: true,
  },
});

const uniqueIps = new Set(recentLogins.map(log => log.ip_address));
if (uniqueIps.size > 3) {
  // アラート: 不審な活動の可能性
}
```

### 2. デバイス別の利用統計

```typescript
// モバイル vs デスクトップの利用率
const logs = await prisma.userActivityLog.findMany({
  where: {
    action: 'LOGIN',
    created_at: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // 30日間
  },
  select: {
    request_data: true,
  },
});

const deviceCounts = logs.reduce((acc, log) => {
  const device = (log.request_data as any)?.device?.device || 'unknown';
  acc[device] = (acc[device] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

console.log(deviceCounts);
// => { mobile: 450, desktop: 320, tablet: 30 }
```

### 3. エラー調査

```typescript
// 特定のエラーが発生したときのデバイス・環境情報を確認
const errorLogs = await prisma.userActivityLog.findMany({
  where: {
    result: 'ERROR',
    action: 'JOB_APPLY',
    created_at: { gte: new Date('2026-02-10') },
  },
  orderBy: { created_at: 'desc' },
  take: 50,
});

// どのブラウザで多く発生しているか分析
const browserErrors = errorLogs.reduce((acc, log) => {
  const browser = (log.request_data as any)?.device?.browser || 'unknown';
  acc[browser] = (acc[browser] || 0) + 1;
  return acc;
}, {} as Record<string, number>);
```

### 4. バージョン別エラー率

```typescript
// デプロイバージョンごとのエラー率を確認
const versionStats = await prisma.userActivityLog.groupBy({
  by: ['app_version', 'result'],
  where: {
    created_at: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  },
  _count: true,
});

// エラー率が高いバージョンを特定してロールバック判断
```

## 注意事項

### パフォーマンスへの影響

- ログ保存は非同期で行い、エラーが発生してもアプリケーションの動作に影響を与えない
- `logUserActivity` 内部で try-catch されており、ログ保存失敗は無視される

### ストレージコストの管理

- 大量のログが蓄積されるため、定期的なクリーンアップが必要
- インデックスを適切に設定（既にスキーマで設定済み）
- 古いログのアーカイブまたは削除を定期実行

### セキュリティ

- IPアドレスやUser-Agentをログに表示する際は、管理者権限を確認
- ログ閲覧画面は認証必須
- 外部からの直接アクセスを防ぐ

## まとめ

操作ログにデバイス情報とIPアドレスを記録することで：

- ✅ 不正アクセスの検知が可能
- ✅ デバイス別の利用状況を把握
- ✅ バグの環境依存性を特定
- ✅ サービス改善のためのデータ収集

ただし、プライバシー保護とデータ保持ポリシーの遵守が必須です。
