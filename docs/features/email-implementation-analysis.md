# メール送信機能 実装分析レポート

## 概要

本プロジェクトのメール送信機能について調査した結果をまとめる。

**調査日**: 2025-12-31
**Resend API Key**: 設定済み（`.env.local`）

---

## 現状のステータス

### ⚠️ 重要な発見

| 機能 | 状態 |
|------|------|
| メール送信 | ❌ **モック状態**（DBログ記録のみ） |
| 新規登録時メール確認 | ❌ **未実装**（即座に登録完了） |
| パスワードリセットメール | ❌ **モック状態**（console.log） |

---

## 1. 新規登録フロー分析

### 現在の実装

**ファイル**: `app/api/auth/register/route.ts`

```typescript
// ワーカー新規登録API
export async function POST(request: NextRequest) {
  // バリデーション
  // メールアドレス重複チェック
  // パスワードハッシュ化
  // ユーザー作成（即座にDBに登録）

  return NextResponse.json({
    message: '登録が完了しました',
    user: { id, email, name },
  });
}
```

### 問題点

1. **メール確認なし**: 登録時にメールアドレスの所有確認が行われていない
2. **即座に有効化**: 登録完了と同時にアカウントが有効になる
3. **DBスキーマに確認フィールドなし**: `email_verified`, `verification_token` などのカラムが存在しない

### DBスキーマ（Userモデル）

```prisma
model User {
  id            Int       @id @default(autoincrement())
  email         String    @unique
  password_hash String
  name          String
  // ... その他のフィールド

  // ⚠️ 以下のフィールドが存在しない
  // email_verified    Boolean   @default(false)
  // email_verified_at DateTime?
  // verification_token String?
}
```

---

## 2. パスワードリセットフロー分析

### 現在の実装

**ファイル**: `src/lib/actions/auth.ts`

```typescript
// パスワードリセット用のトークン（メモリ内Map）
const passwordResetTokens = new Map<string, { email: string; expires: number }>();

export async function requestPasswordReset(email: string) {
  // トークン生成
  const token = crypto.randomUUID();
  passwordResetTokens.set(token, { email, expires: Date.now() + 3600000 });

  // ⚠️ メール送信なし！トークンを直接返している
  return { success: true, resetToken: token };
}
```

### 問題点

1. **メール送信なし**: トークンをクライアントに直接返している（セキュリティリスク）
2. **メモリ内保存**: サーバー再起動でトークンが消失
3. **本番運用に不適**: DBへのトークン永続化が必要

---

## 3. メール関連ファイル一覧

| ファイル | 役割 | 実装状況 |
|---------|------|----------|
| `src/lib/notification-service.ts` | 通知サービス本体 | **モック**（ログ記録のみ） |
| `src/lib/error-notification.ts` | エラー通知サービス | **TODO**（未実装） |
| `src/lib/system-actions.ts` | システム管理アクション | **モック**（console.log） |
| `src/lib/actions/notification.ts` | 通知アクション | notification-service.ts 呼び出し |
| `src/lib/actions/auth.ts` | 認証・パスワードリセット | **モック**（メール送信なし） |
| `app/api/auth/register/route.ts` | ワーカー新規登録 | **メール確認なし** |

---

## 4. Resend 実装計画

### Resend SDK 基本使用法

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// 基本的なメール送信
const { data, error } = await resend.emails.send({
  from: 'noreply@tastas.jp',
  to: 'user@example.com',
  subject: '件名',
  html: '<p>本文</p>',
  // または text: 'プレーンテキスト'
});

if (error) {
  console.error('Failed to send email:', error);
} else {
  console.log('Email sent:', data.id);
}
```

### 必要な作業

#### Phase 1: 基盤整備

1. **Resend SDK インストール**
   ```bash
   npm install resend
   ```

2. **Resendクライアント作成**
   ```typescript
   // src/lib/resend.ts
   import { Resend } from 'resend';

   export const resend = new Resend(process.env.RESEND_API_KEY);
   ```

3. **ドメイン検証**（Resendダッシュボードで設定）
   - `tastas.jp` ドメインのDNS設定

#### Phase 2: 通知メール実装

**修正ファイル**: `src/lib/notification-service.ts`

```typescript
import { resend } from './resend';

async function sendEmailNotification(params: {
  // ...existing params
}): Promise<void> {
  try {
    // Resendでメール送信
    const { data, error } = await resend.emails.send({
      from: 'noreply@tastas.jp',
      to: toAddresses,
      subject,
      html: body.replace(/\n/g, '<br>'), // 改行をHTMLに変換
    });

    if (error) throw error;

    // ログ記録（成功）
    await prisma.notificationLog.create({
      data: {
        // ...existing data
        status: 'SENT',
        external_id: data?.id, // Resend ID
      },
    });
  } catch (error: any) {
    // ログ記録（失敗）
    await prisma.notificationLog.create({
      data: {
        // ...existing data
        status: 'FAILED',
        error_message: error.message,
      },
    });
  }
}
```

#### Phase 3: パスワードリセットメール実装

**修正ファイル**: `src/lib/actions/auth.ts`

```typescript
import { resend } from '../resend';

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { success: true }; // セキュリティ上、存在有無を隠す
  }

  const token = crypto.randomUUID();
  // TODO: DBにトークン保存（PasswordResetTokenテーブル）

  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

  const { error } = await resend.emails.send({
    from: 'noreply@tastas.jp',
    to: email,
    subject: '【+TASTAS】パスワードリセットのご案内',
    html: `
      <p>${user.name}様</p>
      <p>パスワードリセットのリクエストを受け付けました。</p>
      <p>以下のリンクからパスワードを再設定してください（1時間有効）：</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
    `,
  });

  if (error) {
    console.error('Password reset email failed:', error);
    return { success: false, message: 'メール送信に失敗しました' };
  }

  return { success: true, message: 'メールを送信しました' };
}
```

#### Phase 4: 新規登録時メール確認（オプション）

**DBスキーマ変更**:

```prisma
model User {
  // 既存フィールド...

  email_verified       Boolean   @default(false)
  email_verified_at    DateTime?
  verification_token   String?
}

model PasswordResetToken {
  id         Int      @id @default(autoincrement())
  email      String
  token      String   @unique
  expires_at DateTime
  created_at DateTime @default(now())
}
```

**登録フロー変更**:

```typescript
// app/api/auth/register/route.ts
export async function POST(request: NextRequest) {
  // ...existing validation

  const verificationToken = crypto.randomUUID();

  const user = await prisma.user.create({
    data: {
      // ...existing data
      email_verified: false,
      verification_token: verificationToken,
    },
  });

  // 確認メール送信
  await resend.emails.send({
    from: 'noreply@tastas.jp',
    to: email,
    subject: '【+TASTAS】メールアドレスの確認',
    html: `
      <p>${name}様</p>
      <p>+TASTASへのご登録ありがとうございます。</p>
      <p>以下のリンクをクリックしてメールアドレスを確認してください：</p>
      <p><a href="${process.env.NEXTAUTH_URL}/verify-email?token=${verificationToken}">
        メールアドレスを確認する
      </a></p>
    `,
  });

  return NextResponse.json({
    message: '確認メールを送信しました',
    requiresVerification: true,
  });
}
```

---

## 5. 通知キー一覧

| キー | 説明 | メール送信先 |
|------|------|------------|
| `WORKER_MATCHED` | マッチング成立 | ワーカー |
| `WORKER_CANCELLED_BY_FACILITY` | キャンセル通知 | ワーカー |
| `WORKER_REVIEW_REQUEST` | レビュー依頼 | ワーカー |
| `WORKER_NEW_MESSAGE` | 新着メッセージ | ワーカー |
| `WORKER_NEARBY_NEW_JOB` | 近隣求人通知 | ワーカー |
| `WORKER_NEARBY_CANCEL_AVAILABLE` | 近隣キャンセル枠通知 | ワーカー |
| `FACILITY_NEW_APPLICATION` | 新規応募 | 施設管理者 |
| `FACILITY_OFFER_ACCEPTED` | オファー受諾 | 施設管理者 |
| `FACILITY_NEW_MESSAGE` | 新着メッセージ | 施設管理者 |

---

## 6. 修正が必要なファイル一覧

```
src/lib/
├── resend.ts                 # 新規作成: Resendクライアント
├── notification-service.ts   # 修正: sendEmailNotification実装
├── error-notification.ts     # 修正: メール送信実装
├── system-actions.ts         # 修正: sendPasswordResetEmail, sendFacilityPasswordResetEmail
└── actions/
    └── auth.ts               # 修正: requestPasswordReset

app/api/auth/
└── register/route.ts         # オプション: メール確認機能追加

prisma/
└── schema.prisma             # オプション: email_verified, PasswordResetToken追加
```

---

## 7. 送信元アドレス設定

| 用途 | アドレス | 備考 |
|------|----------|------|
| 通知メール | `noreply@tastas.jp` | 返信不可 |
| サポート | `support@tastas.jp` | 問い合わせ用 |

**Resendドメイン設定**:
- `tastas.jp` のDNSに SPF, DKIM レコードを追加
- Resendダッシュボードでドメイン検証

---

## 8. 実装優先度

| 優先度 | 機能 | 理由 |
|--------|------|------|
| **高** | 通知メール（notification-service.ts） | 既存インフラ活用、影響範囲大 |
| **高** | パスワードリセットメール | セキュリティ上必須 |
| **中** | エラー通知メール | 運用監視に必要 |
| **低** | 新規登録時メール確認 | DBスキーマ変更が必要 |

---

## 9. まとめ

| 項目 | 状況 |
|------|------|
| Resend API Key | ✅ 設定済み（`.env.local`） |
| Resend SDK | ❌ 未インストール |
| メール送信機能 | ❌ モック状態（ログ記録のみ） |
| 新規登録時メール確認 | ❌ 未実装（即座に登録完了） |
| パスワードリセットメール | ❌ モック状態 |
| 通知インフラ | ✅ 構築済み（DB、設定管理） |
| テンプレート管理 | ✅ 構築済み（NotificationSetting） |

**次のアクション**:
1. `npm install resend` 実行
2. `src/lib/resend.ts` 作成
3. `src/lib/notification-service.ts` の `sendEmailNotification` 関数を実装
4. Resendダッシュボードで `tastas.jp` ドメイン検証

---

## 関連ドキュメント

- `docs/notification-management-design.md` - 通知管理システム設計
- `docs/system-design.md` - システム設計書
