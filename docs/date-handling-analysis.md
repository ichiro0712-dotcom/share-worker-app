# 日付表示のUTC/JST問題 分析レポート

最終更新: 2026-01-22

## 概要

データベースへの保存はUTCで問題ないが、表示やフィルタリングがUTCのままだと日本のユーザーにとって不具合が発生する。本レポートはその分析結果をまとめたもの。

---

## 修正済み

### activity-logs API (PR #200)

| ファイル | 問題 | 修正内容 |
|----------|------|----------|
| `app/api/system-admin/activity-logs/route.ts` | `dateFrom`/`dateTo`パラメータがUTCとして解釈されていた | JSTタイムゾーン指定を追加 (`T00:00:00+09:00`) |

**修正前:**
```typescript
where.created_at.gte = new Date(dateFrom);
```

**修正後:**
```typescript
where.created_at.gte = new Date(`${dateFrom}T00:00:00+09:00`);
```

---

## 問題なし

| カテゴリ | ファイル/箇所 | 理由 |
|----------|---------------|------|
| **クライアントサイド表示** | `toLocaleDateString('ja-JP')`, `toLocaleString('ja-JP')`, `date-fns format` | ブラウザのローカルタイムゾーン（日本のユーザーはJST）で自動変換される |
| **API: /api/jobs** | `generateDatesFromBase` | JSTベースで日付を生成している |
| **API: /api/notification-logs** | 日付フィルターなし | 問題なし |
| **API: /api/admin/workers/list** | 日付フィルターなし | 問題なし |
| **API: /api/cron/notifications** | `jstOffset`を使用してJST変換済み | 正しく実装されている |
| **Server Actions** | `toLocaleDateString('ja-JP')`, `toLocaleTimeString('ja-JP')` | 通知文面用なのでサーバータイムゾーンに依存するが、Vercelは日本リージョンなら問題なし |

---

## 確認が必要な箇所

### 1. Server Actions内の日付フォーマット

| ファイル | 行 | コード |
|----------|-----|--------|
| `src/lib/actions/attendance-admin.ts` | 750 | `toLocaleDateString('ja-JP')` |
| `src/lib/actions/attendance-admin.ts` | 825-840 | `toLocaleString('ja-JP', {...})` |

**現状**: サーバー実行時のタイムゾーンに依存する。

**推奨対応**: Vercelリージョンが日本なら問題なし。国際化対応する場合は `timeZone: 'Asia/Tokyo'` を明示的に追加。

```typescript
// 現在
new Date(workDate).toLocaleDateString('ja-JP')

// 推奨（国際化対応時）
new Date(workDate).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
```

### 2. メール送信の日時表示

| ファイル | 行 | コード |
|----------|-----|--------|
| `app/api/dev/test-email/route.ts` | 59 | `toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })` |

**現状**: 明示的にJSTを指定しており問題なし。

---

## 日付処理のベストプラクティス

### 1. 保存時（データベース）
- UTCで保存する（Prismaのデフォルト動作）
- 問題なし

### 2. クライアントサイド表示
- `date-fns`の`format`関数と`ja`ロケールを使用
- `toLocaleDateString('ja-JP')`を使用
- ブラウザのタイムゾーンで自動変換されるため問題なし

### 3. サーバーサイドでの日付フィルター
- ユーザー入力（YYYY-MM-DD形式）をJSTとして解釈する必要がある
- 必ず`+09:00`を付与して`Date`オブジェクトを作成

```typescript
// 正しい実装
const jstDate = new Date(`${dateString}T00:00:00+09:00`);
```

### 4. サーバーサイドでの日付表示
- `timeZone: 'Asia/Tokyo'`を明示的に指定

```typescript
new Date(timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
```

### 5. Cron処理
- JSTオフセット（+9時間）を計算に含める
- 参考: `app/api/cron/notifications/route.ts`の実装

```typescript
const jstOffset = 9 * 60 * 60 * 1000;
const jstNow = new Date(now.getTime() + jstOffset);
```

---

## 結論

1. **修正済み**: `activity-logs` API の日付フィルターはPR #200で修正済み
2. **問題なし**: ほとんどのクライアントサイド日付表示は `ja-JP` ロケールを使用しており、ブラウザのタイムゾーンで正しく表示される
3. **Cron処理**: JSTオフセットを明示的に計算しており問題なし
4. **潜在的リスク**: Server Actions内の `toLocaleDateString('ja-JP')` はサーバーのタイムゾーンに依存。Vercelが日本リージョンなら問題なし。将来的に国際化する場合は `timeZone: 'Asia/Tokyo'` の明示的指定を推奨
