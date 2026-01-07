# LLM作業指示書: デバッグエラーバナーを全画面に追加

## 作業概要
全てのトースト通知（toast.error）が出る画面に、デバッグ用エラーバナー機能を追加する。

## 背景
保存・更新・削除等の処理でエラーが発生した際、トースト通知だけでは原因がわからない。
デバッグ用のエラーバナーを表示し、詳細なエラー情報を開発者が確認できるようにする。

## 既に対応済みのファイル（変更不要）
- `app/mypage/profile/ProfileEditClient.tsx`
- `app/register/worker/page.tsx`
- `app/admin/facility/page.tsx`
- `app/login/page.tsx`
- `components/job/JobDetailClient.tsx`

## 対象ファイル一覧（37ファイル）

### 優先度高（ユーザー向け機能）
1. ~~`app/login/page.tsx`~~ - ログイン **※対応済み**
2. ~~`components/job/JobDetailClient.tsx`~~ - 求人詳細・応募 **※対応済み**
3. `app/my-jobs/page.tsx` - マイジョブ
4. `app/password-reset/page.tsx` - パスワードリセット申請
5. `app/password-reset/[token]/page.tsx` - パスワードリセット実行
6. `app/mypage/reviews/[applicationId]/ReviewFormClient.tsx` - レビュー投稿
7. `components/facility/FacilityDetailClient.tsx` - 施設詳細
8. `components/favorite/FavoriteListClient.tsx` - お気に入り
9. `components/bookmark/BookmarkListClient.tsx` - ブックマーク
10. `app/notifications/page.tsx` - 通知一覧
11. `components/pwa/NotificationButton.tsx` - プッシュ通知設定

### 優先度中（施設管理者向け）
12. `components/admin/JobForm.tsx` - 求人作成・編集フォーム
13. `components/admin/JobTemplateForm.tsx` - 求人テンプレートフォーム
14. `app/admin/workers/page.tsx` - ワーカー一覧
15. `app/admin/applications/page.tsx` - 応募管理
16. `app/admin/workers/[id]/review/page.tsx` - ワーカーレビュー
17. `app/admin/worker-reviews/page.tsx` - ワーカーレビュー一覧
18. `app/admin/reviews/page.tsx` - レビュー管理
19. `app/admin/shifts/page.tsx` - シフト管理
20. `app/admin/messages/page.tsx` - メッセージ
21. `app/admin/notifications/page.tsx` - 通知管理
22. `app/admin/jobs/page.tsx` - 求人一覧
23. `app/admin/jobs/[id]/page.tsx` - 求人詳細
24. `app/admin/jobs/templates/page.tsx` - テンプレート一覧
25. `app/admin/jobs/templates/[id]/edit/page.tsx` - テンプレート編集
26. `app/admin/masquerade-actions/delete-facility/page.tsx` - 施設削除
27. `app/admin/masquerade-actions/password-reset/page.tsx` - パスワードリセット
28. `components/admin/AdminLayout.tsx` - 管理者レイアウト

### 優先度低（システム管理者向け）
29. `app/system-admin/content/notifications/page.tsx`
30. `app/system-admin/content/templates/page.tsx`
31. `app/system-admin/settings/admins/page.tsx`
32. `app/system-admin/workers/[id]/page.tsx`
33. `app/system-admin/facilities/new/page.tsx`
34. `app/system-admin/facilities/page.tsx`
35. `app/system-admin/jobs/page.tsx`
36. `app/system-admin/dev-portal/notification-logs/page.tsx`
37. `app/system-admin/announcements/page.tsx`
38. `app/system-admin/content/faq/page.tsx`
39. `app/system-admin/content/labor-template/page.tsx`
40. `components/system-admin/SystemAdminLayout.tsx`
41. `components/system-admin/JobDescriptionFormatManager.tsx`
42. `components/system-admin/AnnouncementForm.tsx`

## 変更手順

### 手順1: インポート追加
ファイルの先頭のインポート部分に以下を追加：

```typescript
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
```

### 手順2: フック使用
コンポーネント関数の先頭（他のフックと一緒の場所）に以下を追加：

```typescript
const { showDebugError } = useDebugError();
```

### 手順3: toast.error の箇所を修正
`toast.error()` が呼ばれる箇所を見つけ、その直前にデバッグエラー通知を追加。

#### パターンA: try-catch内のエラー
```typescript
// 変更前
} catch (error) {
  toast.error('エラーが発生しました');
}

// 変更後
} catch (error) {
  const debugInfo = extractDebugInfo(error);
  showDebugError({
    type: 'save', // 'save' | 'update' | 'delete' | 'fetch' | 'upload' | 'other'
    operation: '操作名をここに書く', // 例: 'ログイン', '求人応募', 'レビュー投稿'
    message: debugInfo.message,
    details: debugInfo.details,
    stack: debugInfo.stack,
    context: {
      // エラー原因特定に役立つ情報を追加
      // 例: userId, facilityId, jobId など
    }
  });
  toast.error('エラーが発生しました');
}
```

#### パターンB: API/アクション結果のエラー
```typescript
// 変更前
if (!result.success) {
  toast.error(result.error || 'エラーが発生しました');
}

// 変更後
if (!result.success) {
  showDebugError({
    type: 'save',
    operation: '操作名をここに書く',
    message: result.error || 'エラーが発生しました',
    context: {
      // エラー原因特定に役立つ情報
    }
  });
  toast.error(result.error || 'エラーが発生しました');
}
```

#### パターンC: バリデーションエラー（追加不要）
単純なバリデーションエラー（「パスワードが一致しません」など）にはデバッグ通知は不要。
**APIやサーバーアクションの呼び出し結果でのエラーのみ**に追加する。

## typeの選び方
| type | 使用場面 |
|------|---------|
| `save` | 新規作成、登録 |
| `update` | 更新、編集 |
| `delete` | 削除 |
| `fetch` | データ取得 |
| `upload` | ファイルアップロード |
| `other` | その他 |

## operationの命名例
- ログイン → `'ログイン'`
- 求人応募 → `'求人応募'`
- レビュー投稿 → `'レビュー投稿'`
- 求人作成 → `'求人作成'`
- 求人更新 → `'求人更新'`
- シフト承認 → `'シフト承認'`
- メッセージ送信 → `'メッセージ送信'`

## contextに含める情報の例
```typescript
context: {
  userId: user?.id,
  jobId: jobId,
  facilityId: facilityId,
  applicationId: applicationId,
  formData: { /* 送信したデータの一部 */ },
  responseStatus: response?.status,
}
```

## 実装例（app/login/page.tsx の場合）

```typescript
'use client';

import { useState } from 'react';
// ... 他のインポート
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

export default function LoginPage() {
  const router = useRouter();
  const { showDebugError } = useDebugError();
  // ... 他のステート

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        showDebugError({
          type: 'other',
          operation: 'ログイン',
          message: result.error,
          context: {
            email: email,
            errorType: result.error,
          }
        });
        toast.error('メールアドレスまたはパスワードが正しくありません');
      } else {
        router.push('/');
      }
    } catch (error) {
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'other',
        operation: 'ログイン（例外）',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { email }
      });
      toast.error('ログイン中にエラーが発生しました');
    }
  };
  // ...
}
```

## 作業完了後チェックリスト（必須）

以下を順番に実行してください：

### 1. TypeScriptエラーチェック
```bash
npx tsc --noEmit
```
エラーがあれば修正してから次へ進む。

### 2. ビルド確認
```bash
npm run build
```

### 3. 開発サーバー再起動
```bash
# 既存のサーバーを停止してから
rm -rf .next && npm run dev
```

### 4. 動作確認
- いくつかの画面でエラーを発生させてみる
- 画面上部に黒いデバッグバナーが表示されることを確認
- ×ボタンで閉じられることを確認

### 5. 変更ファイルの報告
変更したファイル一覧を報告すること。

## 注意事項
- `'use client'` ディレクティブがあるファイルのみが対象
- Server Component（`'use client'`がないファイル）では使用不可
- フックは関数コンポーネントの最上位でのみ呼び出すこと
- 条件分岐の中でフックを呼び出してはいけない
