# 利用明細 給与計算・勤怠時刻バグ修正

**修正日**: 2026-02-07
**ブランチ**: `fix/salary-attendance-bugs`
**報告内容**: 利用明細ページで給与が正しく計算されない、出退勤時刻が契約時刻と一致しない

---

## 修正概要

3つの独立したバグを特定・修正。

| # | バグ | 影響 | 重大度 |
|---|------|------|--------|
| 1 | 給与計算の浮動小数点精度エラー | 給与が+1円ずれる | 中 |
| 2 | 利用明細の交通費二重計上 | 合計金額が交通費分多い | 高 |
| 3 | 定刻退勤時の出退勤時刻が9時間ずれる | 時刻表示が完全に不正 | 高 |

---

## Bug 1: 給与計算の浮動小数点精度エラー（+1円）

### 症状
- 時給1,000円 x 8時間 = 8,000円のはずが **8,001円** になる
- 時給1,000円 x 7.5時間 = 7,500円のはずが正しく計算されないケースがある

### 原因
`src/lib/salary-calculator.ts` で `hourlyRate / 60` を先に計算していたため、浮動小数点誤差が発生。

```typescript
// 修正前（バグあり）
const hourlyRatePerMinute = hourlyRate / 60;  // 1000/60 = 16.666666666666668
const basePay = Math.ceil(workedMinutes * hourlyRatePerMinute);
// 480 * 16.666666666666668 = 8000.000000000001
// Math.ceil(8000.000000000001) = 8001  ← 本来8000
```

### 修正内容
整数同士の乗算を先に行い、最後に60で割る方式に変更（7箇所）。

```typescript
// 修正後
const basePay = Math.ceil((workedMinutes * hourlyRate) / 60);
// (480 * 1000) / 60 = 480000 / 60 = 8000.0
// Math.ceil(8000.0) = 8000  ← 正しい
```

### 修正箇所（`src/lib/salary-calculator.ts`）

| 行 | 計算内容 | 修正前 | 修正後 |
|----|----------|--------|--------|
| 316 | ベース給与 | `Math.ceil(workedMinutes * hourlyRatePerMinute)` | `Math.ceil((workedMinutes * hourlyRate) / 60)` |
| 319 | 残業手当 | `Math.ceil(totalOvertimeMinutes * hourlyRatePerMinute * 0.25)` | `Math.ceil((totalOvertimeMinutes * hourlyRate * 0.25) / 60)` |
| 322 | 深夜手当 | `Math.ceil(totalNightMinutes * hourlyRatePerMinute * 0.25)` | `Math.ceil((totalNightMinutes * hourlyRate * 0.25) / 60)` |
| 338 | 通常内訳 | `Math.ceil(adjustedNormalMinutes * hourlyRatePerMinute)` | `Math.ceil((adjustedNormalMinutes * hourlyRate) / 60)` |
| 350 | 深夜内訳 | `Math.ceil(adjustedNightMinutes * hourlyRatePerMinute * 1.25)` | `Math.ceil((adjustedNightMinutes * hourlyRate * 1.25) / 60)` |
| 362 | 残業内訳 | `Math.ceil(adjustedOvertimeMinutes * hourlyRatePerMinute * 1.25)` | `Math.ceil((adjustedOvertimeMinutes * hourlyRate * 1.25) / 60)` |
| 374 | 深夜残業内訳 | `Math.ceil(adjustedNightOvertimeMinutes * hourlyRatePerMinute * 1.5)` | `Math.ceil((adjustedNightOvertimeMinutes * hourlyRate * 1.5) / 60)` |

### 検証結果

```
480分 x 時給1,000円 → 8,000円（修正前: 8,001円）
450分 x 時給1,000円 → 7,500円
390分 x 時給1,000円 → 6,500円
480分 x 時給1,300円 → 10,400円
```

---

## Bug 2: 利用明細の交通費二重計上

### 症状
- 利用明細の合計金額が実際より交通費分多く表示される

### 原因
`attendance.ts`で`calculated_wage`にDBへ保存する際に交通費が加算済み:

```typescript
// attendance.ts (checkout時)
calculatedWage = salaryResult.totalPay + job.transportation_fee;
```

しかし `attendance-admin.ts` の `getUsageDetails` で再度交通費を加算:

```typescript
// 修正前（バグあり）
const wage = att.calculated_wage ?? 0;           // 交通費込みの値
const transportationFee = att.job?.transportation_fee ?? 0;
const totalAmount = wage + transportationFee + platformFee + tax;  // 二重計上
```

### 修正内容

`src/lib/actions/attendance-admin.ts` の `getUsageDetails` 関数内:

```typescript
// 修正後
const calculatedWageWithTransport = att.calculated_wage ?? 0;
const transportationFee = att.job?.transportation_fee ?? 0;
const wage = att.calculated_wage != null
  ? calculatedWageWithTransport - transportationFee
  : 0;  // 未承認（null）の場合は0
const platformFee = Math.floor(calculatedWageWithTransport * PLATFORM_FEE_RATE);
const tax = Math.floor(platformFee * TAX_RATE);
const totalAmount = calculatedWageWithTransport + platformFee + tax;
```

**ビジネスルール確認済み**: プラットフォーム手数料（30%）は給与+交通費ベースで計算（現行通り）。

### Null安全性
Codexレビューで指摘: `calculated_wage`がnull（未承認レコード）の場合、`0 - transportationFee`で負の給与になるリスク。`att.calculated_wage != null`チェックを追加。

---

## Bug 3: 定刻退勤時の出退勤時刻が9時間ずれる（JSTオフセット問題）

### 症状
- 契約通り勤務しても出勤・退勤時刻が契約時刻と一致しない
- 例: 契約09:30開始 → 利用明細で18:30と表示される（9時間ずれ）

### 原因
DBの`work_date`はUTC midnightで保存されている（例: `2026-02-06T00:00:00.000Z`）。

サーバーサイドで定刻時刻を計算する際、UTC midnightにJSTの時刻（時間分）をそのまま加算:

```typescript
// 修正前（バグあり）
const workDateMs = new Date(workDate).getTime();  // UTC midnight: 2026-02-06T00:00:00Z
actualStartTime = new Date(workDateMs + (startHour * 60 + startMinute) * 60 * 1000);
// startHour=9, startMinute=30 の場合:
// = 2026-02-06T00:00:00Z + 9.5h = 2026-02-06T09:30:00Z
// UTC 09:30 = JST 18:30 ← 9時間ずれ！
```

本来、JST 09:30 = UTC 00:30 になるべき。

### 修正内容
UTC midnightからJSTオフセット（9時間）を引いてから、JSTの時刻を加算:

```typescript
// 修正後
const workDateMs = new Date(workDate).getTime();
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
actualStartTime = new Date(workDateMs - JST_OFFSET_MS + (startHour * 60 + startMinute) * 60 * 1000);
// = 2026-02-06T00:00:00Z - 9h + 9.5h = 2026-02-06T00:30:00Z
// UTC 00:30 = JST 09:30 ← 正しい！
```

### 修正箇所（全8箇所）

| ファイル | 行 | 用途 |
|---------|-----|------|
| `src/lib/actions/attendance.ts` | ~112 | チェックイン遅刻判定 |
| `src/lib/actions/attendance.ts` | ~225 | チェックアウト遅刻判定 |
| `src/lib/actions/attendance.ts` | ~258 | 定刻退勤のactual_start/end_time |
| `src/lib/actions/attendance.ts` | ~398 | 修正申請の契約金額計算 |
| `src/lib/actions/attendance.ts` | ~745 | 出勤ステータス取得の遅刻判定 |
| `src/lib/actions/attendance.ts` | ~1008 | ワーカー勤怠詳細の遅刻判定 |
| `src/lib/actions/application-admin.ts` | ~143 | 管理者キャンセル期限判定 |
| `src/lib/actions/application-worker.ts` | ~782 | ワーカーキャンセル期限判定 |

### 追加修正: 利用明細の日付表示（JST対応）

`attendance-admin.ts` の `getUsageDetails` で曜日・日付表示にもタイムゾーンを指定:

```typescript
// 修正前: サーバーTZに依存
const weekday = weekdays[dateObj.getDay()];
const dateStr = dateObj.toLocaleDateString('ja-JP');

// 修正後: 明示的にJST指定
const jstDateStr = dateObj.toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo' });
const jstDate = new Date(jstDateStr);
const weekday = weekdays[jstDate.getDay()];
const dateStr = dateObj.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
```

### DB実証データ

```
attendance id=2（定刻退勤）:
  actual_start = 2026-02-04T09:30:00Z  ← JST 18:30（9時間ずれ）

attendance id=3（修正申請による承認）:
  actual_start = 2026-02-06T00:30:00Z  ← JST 09:30（正しい）
```

修正申請はクライアントサイドの`setHours()`でJSTが正しく処理されていたため、定刻退勤のサーバーサイドコードのみバグがあった。

---

## 修正対象ファイル一覧

| ファイル | 変更量 | 修正内容 |
|---------|--------|----------|
| `src/lib/salary-calculator.ts` | +8 -7 | Bug 1: 浮動小数点精度修正（7箇所） |
| `src/lib/actions/attendance.ts` | +27 -18 | Bug 3: JSTオフセット修正（6箇所） |
| `src/lib/actions/attendance-admin.ts` | +13 -6 | Bug 2: 交通費二重計上修正 + 日付TZ修正 |
| `src/lib/actions/application-admin.ts` | +3 -2 | Bug 3: JSTオフセット修正（1箇所） |
| `src/lib/actions/application-worker.ts` | +3 -2 | Bug 3: JSTオフセット修正（1箇所） |

---

## 既存データへの影響

- **今後の新規勤怠**: 自動的に正しい値で計算・保存される
- **既存の`calculated_wage`**: DB内の値は変わらない（必要に応じて再計算スクリプトの実行を検討）
- **既存の`actual_start_time`/`actual_end_time`**: DB内の値は変わらない（定刻退勤で作成された過去データは9時間ずれたまま）
- **利用明細表示**: Bug 2の修正により、表示上の合計金額は即座に正しくなる

## デプロイ前確認

- DB変更: **なし**（Prismaスキーマ変更なし）
- 環境変数追加: **なし**
- 必要な作業: デプロイのみで本番環境に反映される
