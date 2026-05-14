# 給与計算式変更（深夜・残業・深夜残業）の遡及影響調査

作成日: 2026-04-28
対象ブランチ: feature/break-time-free-input（調査時点）
関連: クライアント要望「割増賃金は『時給×割増率』『×時間』の 2 段階で端数処理」

---

## 1. 背景と確定済みの方針

### 1-1. 経緯
クライアントより「現在の計算では条件によっては法定金額（厚労省通達ベースの標準公式）を下回るケースがある」との指摘。
具体的には、現状は **「分 × 時給 × 割増率 ÷ 60」を一発で計算して最後に切り上げ** している（`src/lib/salary-calculator.ts:316-322, 338, 350, 362, 374`）が、これを **「割増時給を求めて端数処理 → 時間を掛けて端数処理」の 2 段階方式** に変更したい、という要望。

### 1-2. 確定した実装方針（クライアント回答済み）

| # | 論点 | 確定内容 |
|---|------|---------|
| 1 | 端数処理の方法 | **2 段階とも `Math.ceil`（切り上げ）** |
| 2 | 深夜残業の扱い | **時給 × 1.5 を直接適用**（1.0 + 0.25 + 0.25 の積み上げではない） |
| 3 | 通常残業（1.25）・深夜（1.25）の扱い | **同じく「割増時給を切り上げ → 時間を掛けて切り上げ」方式に統一** |
| 4 | 過去データの扱い | **サービス開始時から全件遡及。確定済みは差額を集計し、別途支払いの要否を検討** |

### 1-3. 新計算式（仕様）

各時間区分（normal / night / overtime / night_overtime）について：

```
割増時給 = ceil(時給 × 割増率)         // 円未満を切り上げ
区分別給与 = ceil(割増時給 × 区分分数 / 60)  // 円未満を切り上げ
合計給与 = 全区分の合算
```

割増率は以下：

| 区分 | 割増率 |
|------|--------|
| 通常（normal） | 1.0 |
| 深夜（night、22:00〜翌5:00 JST） | 1.25 |
| 残業（overtime、8 時間超） | 1.25 |
| 深夜残業（night_overtime） | 1.5 |

休憩控除は現状ロジック（単価の高い順から控除）を維持。

---

## 2. 旧方式 vs 新方式の数値差異

### 2-1. 差が出るパターン
**「時給 × 割増率」が小数で発生し、Step 1 で円未満が切り上がる場合**に、新方式の方が **同額または高くなる**（労働者有利方向）。

### 2-2. 具体例

#### 例 A: 時給 1010 円・残業 3 時間（純粋な残業のみ）

| 方式 | 計算 | 結果 |
|------|------|------|
| 旧（現状） | `ceil(180 × 1010 × 1.25 / 60) = ceil(3787.5)` | **3788 円** |
| 新（要望） | `ceil(1010 × 1.25) = ceil(1262.5) = 1263` → `ceil(1263 × 180/60) = 3789` | **3789 円** |
| **差額** | | **+1 円** |

#### 例 B: 時給 1010 円・深夜残業 30 分（純粋な深夜残業のみ）

| 方式 | 計算 | 結果 |
|------|------|------|
| 旧（現状・合計式） | `ceil(30×1010/60) + ceil(30×1010×0.25/60) + ceil(30×1010×0.25/60)` = `505 + 127 + 127` | **759 円** |
| 旧（現状・内訳式） | `ceil(30 × 1010 × 1.5 / 60) = ceil(757.5)` | **758 円** |
| 新（要望） | `ceil(1010 × 1.5) = 1515` → `ceil(1515 × 30/60) = 758` | **758 円** |

→ 旧方式は**合計と内訳で 1 円ずれている**既存バグも内包している（合計が `basePay + 0.25 + 0.25` の積み上げ、内訳が `1.5` 直接乗じのため）。新方式では内訳と合計の整合性も取れる。

#### 例 C: 時給 1500 円・残業 1 時間（割り切れるケース）

| 方式 | 結果 |
|------|------|
| 旧 | `ceil(60 × 1500 × 1.25 / 60) = 1875` |
| 新 | `ceil(1500 × 1.25) × 1 = 1875` |
| **差額** | **0 円** |

→ 時給が 4 の倍数（× 1.25 が整数）かつ割増時給と時間の掛け算も整数になるケースは差が出ない。

### 2-3. 差額の傾向まとめ
- 新方式は **必ず旧方式以上**（労働者の取り分が増える方向）
- 差額は **1 レコードあたり 0 〜 数円程度**（時給と時間の組み合わせ次第）
- 深夜残業区分は **旧合計式 vs 新方式で −1 円ずれ** が出るケースがあり、これは既存の積み上げ式 vs 直接乗じ式の差に起因する

---

## 3. データモデル（確定済みレコードの所在）

### 3-1. 確定済み給与の保存先
`prisma/schema.prisma:1207`

```prisma
model Attendance {
  // ...
  // 給与計算結果（承認後に設定）
  calculated_wage Int? @map("calculated_wage")
  // ...
}
```

- `calculated_wage` が `null` でないレコード = **給与確定済み**
- 確定値は「定刻退勤の自動計算結果」または「修正申請の承認時の `requested_amount`」のいずれか

### 3-2. 確定フロー
1. ワーカーが QR/緊急コードで打刻 → `Attendance` 作成（`calculated_wage` は null）
2. 定刻退勤 or 修正申請承認 → `calculated_wage` がセットされる
3. 修正申請の承認は `src/lib/actions/attendance-admin.ts:297` の `approveModificationRequest`
   - `Attendance.calculated_wage ← AttendanceModificationRequest.requested_amount`
   - `Application.status ← 'COMPLETED_RATED'`

### 3-3. 関連テーブル

| テーブル | カラム | 内容 |
|---------|-------|------|
| `Attendance` | `calculated_wage` | 確定給与額（円、Int） |
| `Attendance` | `actual_start_time` / `actual_end_time` / `actual_break_time` | 給与計算の入力（実績打刻） |
| `AttendanceModificationRequest` | `original_amount` | 定刻時の旧方式計算結果 |
| `AttendanceModificationRequest` | `requested_amount` | 申請内容での旧方式計算結果 |
| `AttendanceModificationRequest` | `status` | `'APPROVED'` で確定 |
| `Application` | `status` | `'COMPLETED_RATED'` で確定 |
| `Job` | `hourly_wage` | 計算に使う時給（円） |

### 3-4. 計算式の利用箇所（影響範囲）
`calculateSalary` を import しているファイルは 4 つ：

1. `src/lib/actions/attendance.ts`（定刻退勤・申請作成・再申請）
2. `src/lib/actions/attendance-admin.ts`（管理画面承認）
3. `src/lib/actions/attendance-system-admin.ts`（システム管理者）
4. `src/lib/csv-export/attendance-info-csv.ts`（CSV 出力）

→ **計算ロジック自体は `salary-calculator.ts` に集約されており、二重実装はなし**。修正は 1 ファイルで完結する想定。

---

## 4. 差額集計の方針

### 4-1. 集計対象の絞り込み
```sql
-- 確定済みレコード = calculated_wage IS NOT NULL
SELECT COUNT(*) FROM attendances WHERE calculated_wage IS NOT NULL;
```

時間軸での内訳：
- サービス開始（最古の `created_at`）〜現在
- 月次／施設別／ワーカー別での集計が必要かは要望次第

### 4-2. 差額の算出アルゴリズム

各 `Attendance` レコードについて：

```
1. 入力を取得:
   - 時給: attendance.job.hourly_wage（または application.job.hourly_wage）
   - 開始時刻: attendance.actual_start_time
   - 終了時刻: attendance.actual_end_time
   - 休憩分数: attendance.actual_break_time

2. 旧方式で計算:
   oldAmount = calculateSalary(現状版).totalPay
   ※ DB の calculated_wage と通常一致するはずだが、
     不一致レコードがある場合は別途調査（手修正の可能性）

3. 新方式で計算:
   newAmount = calculateSalary(新版).totalPay

4. 差額:
   diff = newAmount - oldAmount   // 0 円以上のはず
```

### 4-3. 集計したい指標

| 指標 | 用途 |
|------|------|
| 確定済みレコード総数 | 影響規模の把握 |
| 差額が発生するレコード数 / 比率 | 実際に追加支給が必要なケース数 |
| 1 レコードあたりの差額分布（min / max / median / 平均） | 個別追加支給額の規模感 |
| 全体の差額合計 | 企業負担の総額 |
| ワーカー別の差額合計 | 個別精算用（追加支給する場合の振込額） |
| 月別の差額合計 | 月次調整用 |
| 施設別の差額合計 | 施設請求額への影響把握 |
| `calculated_wage` と旧方式再計算結果の不一致レコード | データ整合性チェック（手動修正の検出） |

### 4-4. 差額集計スクリプトの設計（実装イメージ）

下記のような調査スクリプトを `prisma/audit-salary-recalculation.ts` として用意し、**ユーザー手動でステージング／本番に対して実行**する。

```typescript
// prisma/audit-salary-recalculation.ts （実装イメージ・未作成）
import { PrismaClient } from '@prisma/client';
import { calculateSalary as calcOld } from '../src/lib/salary-calculator';
// 新方式は別ファイルに切り出すか、引数で方式を切り替える設計
import { calculateSalary as calcNew } from '../src/lib/salary-calculator-new';

async function main() {
  const prisma = new PrismaClient();

  const records = await prisma.attendance.findMany({
    where: { calculated_wage: { not: null } },
    include: {
      job: { select: { hourly_wage: true } },
      user: { select: { id: true, name: true } },
      facility: { select: { id: true, name: true } },
    },
    orderBy: { created_at: 'asc' },
  });

  let totalOld = 0, totalNew = 0, diffCount = 0, mismatchCount = 0;
  const perWorker = new Map<number, number>();
  const perFacility = new Map<number, number>();
  const perMonth = new Map<string, number>();
  const rows: Array<Record<string, unknown>> = [];

  for (const a of records) {
    if (!a.actual_start_time || !a.actual_end_time || !a.job) continue;
    const hourly = a.job.hourly_wage;

    const oldRes = calcOld({
      startTime: a.actual_start_time,
      endTime: a.actual_end_time,
      breakMinutes: a.actual_break_time ?? 0,
      hourlyRate: hourly,
    });
    const newRes = calcNew({ /* 同じ入力 */ });

    if (oldRes.totalPay !== a.calculated_wage) mismatchCount++;
    const diff = newRes.totalPay - oldRes.totalPay;

    totalOld += oldRes.totalPay;
    totalNew += newRes.totalPay;
    if (diff !== 0) diffCount++;

    // ワーカー別 / 施設別 / 月別に集計
    perWorker.set(a.user.id, (perWorker.get(a.user.id) ?? 0) + diff);
    perFacility.set(a.facility.id, (perFacility.get(a.facility.id) ?? 0) + diff);
    const ym = a.created_at.toISOString().slice(0, 7);
    perMonth.set(ym, (perMonth.get(ym) ?? 0) + diff);

    rows.push({
      attendanceId: a.id,
      workerId: a.user.id,
      workerName: a.user.name,
      facilityId: a.facility.id,
      hourly,
      oldAmount: oldRes.totalPay,
      newAmount: newRes.totalPay,
      diff,
    });
  }

  // 結果を CSV / JSON でファイル出力
  console.log({
    totalRecords: records.length,
    diffRecords: diffCount,
    mismatchWithDB: mismatchCount,
    totalOld, totalNew,
    totalDiff: totalNew - totalOld,
  });
  // 詳細は CSV へ
}
main();
```

### 4-5. 実行手順（ユーザー側）

> ⚠️ **本番 DB への接続情報の取り扱いは CLAUDE.md の禁止事項を厳守。Claude Code は `vercel env pull` も `.env.production.local` の作成も行わない。下記は人間が手動で実行する**。

1. **新計算式の実装**（実装ステップで完了させる）
   - `salary-calculator.ts` に新ロジックを追加 or 別ファイルとして用意
   - 既存テスト（`prisma/test-salary-calculator.ts`）の期待値を新方式に更新
2. **差額集計スクリプト作成** — 上記 4-4 をベースに実装
3. **ステージング DB で先行実行**（`.env.local` の接続情報で）
   - 数値の妥当性、出力 CSV のフォーマットを確認
4. **本番 DB の接続情報を一時取得して実行**
   - 本番接続は人間が `vercel env pull --environment=production` を実行
   - スクリプトは **READ ONLY** であること（書き込み一切なし）を必ず確認
5. **CSV をクライアントへ提出**
   - 全件の旧/新/差額
   - ワーカー別差額合計
   - 月別差額合計
   - 施設別差額合計

---

## 5. クライアント検討用に提示すべき情報

クライアントは「**別途ワーカーに支払う必要があるかどうか**」を判断したい。判断材料として以下を提示する：

### 5-1. 必須提示
1. **影響規模**
   - 確定済みレコード総数
   - うち差額が発生する件数・比率
   - 全体差額合計（企業負担総額）
2. **個別支給判断材料**
   - ワーカー別差額合計の分布（中央値・最大値）
   - 例：「差額が 100 円以下のワーカーが N 人、1000 円超が M 人」
3. **業務オペレーション**
   - 追加支給する場合の振込手段（既存の支払い経路で実施可能か）
   - 通知方法（給与明細を再発行するか、メール／お知らせで補足するか）

### 5-2. 検討フレーム
| 判断 | 想定対応 |
|------|---------|
| 「全件追加支給する」 | ワーカー別差額合計に基づき、別途振込 or 次回給与に上乗せ |
| 「閾値以下は支給しない」 | 例：1 ワーカーあたり 100 円以下は対象外、等のルール策定 |
| 「追加支給はしないが、新方式は今後適用」 | DB の `calculated_wage` は触らず、コードのみ変更（ただし社労士・労基リスクの確認が必要） |
| 「全件遡及して `calculated_wage` を上書き」 | 過去の確定レコードの数値が変わるため、施設請求額も再計算が必要 |

### 5-3. 法的リスクの注意点
- **未払い賃金は労基法 115 条により請求権 3 年（賃金は 5 年への移行中）**
- 厚労省通達の標準公式に対して下回っていた金額は、形式的には **未払い賃金** に該当しうる
- 社労士・顧問弁護士への相談を推奨

---

## 6. リスクと留意事項

### 6-1. 技術的リスク
- **施設請求額への波及**：給与が上がる = 施設請求額も上がる可能性。請求側のロジックが給与額をベースにしているか別計算かを別途確認（本調査ではスコープ外）
- **CSV 出力の整合性**：`src/lib/csv-export/attendance-info-csv.ts` の出力も新方式に切り替わる
- **過去レコードの上書き判断**：`Attendance.calculated_wage` を上書きすると、当時の修正申請承認時の値（`AttendanceModificationRequest.requested_amount`）と乖離する。差額を別カラムで管理する設計も検討可
- **テストデータの整合性**：`prisma/test-salary-calculator.ts` ほか給与関連テストの期待値を全件更新する必要あり

### 6-2. 業務リスク
- 新方式はワーカー有利方向のみ（金額が下がるケースはない）なので、ワーカーへの説明はしやすい
- 過去の不足分支給を行う場合、対象期間（サービス開始時〜）が長くなるほど集計工数・振込手数料・社労士確認コストが増える

### 6-3. 確認したい運用ポイント（クライアント / 社内）
1. 追加支給する場合の **支払い手段**（既存の振込経路で対応可能か）
2. 追加支給する場合の **税務・社会保険上の取り扱い**（過年度分の調整が必要か）
3. **施設への通知・請求額調整**の要否
4. **新方式の適用開始日**（リリース日 = 当日打刻分から、と置くのが標準的）

---

## 7-A. 差額一覧の出力方法（2026-04-29 追記）

クライアントから「**確定済み給与に対する旧/新差額一覧が欲しい**」との追加要望を受けて、出力可能性と手順を整理。

### 7-A-1. 結論
**出力可能。ただし時給のヒストリカル値の制約あり**（後述 7-A-3）。下記の手順で **READ-ONLY** スクリプトを 1 本作って人間が手動実行すれば、CSV で出せる。

### 7-A-2. 計算入力の取得経路

`calculateSalary` の入力は 4 つ。確定済み Attendance からの取得経路：

| 入力 | 取得元 | 取得可能性 |
|------|--------|----------|
| `startTime` | `Attendance.actual_start_time` | ✅ 確定時に必ず set される |
| `endTime` | `Attendance.actual_end_time` | ✅ 確定時に必ず set される |
| `breakMinutes` | `Attendance.actual_break_time` | ✅ 確定時に必ず set される |
| `hourlyRate` | `Attendance → Application → WorkDate → Job.hourly_wage` | ⚠️ **ヒストリカル値ではない**（後述） |

### 7-A-3. ⚠️ 重要な制約：時給のヒストリカル値が保存されていない

**問題:**
- `Attendance` にも `Application` にも **当時の時給スナップショットがない**
- 時給は毎回 `Job.hourly_wage`（schema:325）を参照している（`attendance.ts:291` で確認）
- `Job.hourly_wage` は `updateJob` で**事後的に書き換えが可能**な設計

**影響:**
- 確定後に Job.hourly_wage が変更されたケースでは、旧方式で再計算しても DB の `calculated_wage` と一致しない（時給が変わっているため）
- 「真の旧時給」が何だったかを完全には復元できない

**検出方法（重要）:**
スクリプトで「現在の Job.hourly_wage」を使って旧方式で再計算し、`Attendance.calculated_wage - transportation_fee` と比較する。
- **一致** → 時給は変更されていない → 差額計算は正確
- **不一致** → 時給が事後変更されている可能性 → 「要確認」フラグを立てて別出力

`AttendanceEditHistory.prev_calculated_wage` / `new_calculated_wage`（schema:1277-1305）を辿れば、時系列の変動も部分的に追跡できる可能性あり（要追加調査）。

### 7-A-4. 対象レコードの絞り込み

```sql
SELECT *
FROM attendances
WHERE calculated_wage IS NOT NULL
  AND actual_start_time IS NOT NULL
  AND actual_end_time IS NOT NULL
ORDER BY created_at ASC;
```

- `calculated_wage IS NOT NULL` だけでは `actual_*` が null のレコードが混入する可能性があるため、両方チェック
- `Application.status='COMPLETED_RATED'` は必須条件ではない（schema 上は独立、`calculated_wage` の有無が確定の真の指標）
- 修正申請が `REJECTED` のレコードも対象（`calculated_wage` は元の確定値が残っている）

### 7-A-5. エッジケース

| ケース | 対応 |
|--------|------|
| `check_out_method='EMERGENCY_CODE'`（緊急コード退勤） | 計算ロジックは打刻方式を見ない → そのまま処理可 |
| `actual_*` が null かつ `calculated_wage` あり | クエリで除外、別カウントしてレポート |
| Job 自体が削除済み（`onDelete: SetNull`、schema:1216） | hourly_wage 取得不可 → 「要確認」フラグ |
| transportation_fee（交通費）込み | `calculated_wage = totalPay + transportation_fee`。比較時は交通費を引く |
| 修正申請承認で手動調整された値 | DB の `calculated_wage` をそのまま旧値とする（再計算結果と乖離する可能性あり） |

### 7-A-6. 出力 CSV 設計案

「クライアントが追加支給可否を判断する」用途を想定。**最小列構成**：

| 列 | 内容 |
|----|------|
| `attendance_id` | Attendance.id |
| `worker_id` / `worker_name` | ワーカー識別 |
| `facility_id` / `facility_name` | 施設識別 |
| `work_date` | 勤務日（actual_start_time の日付） |
| `hourly_wage_current` | 現在の Job.hourly_wage |
| `transportation_fee` | 交通費 |
| `actual_minutes` | 実働時間（分） |
| `db_calculated_wage` | DB に保存されている確定値 |
| `recalc_old` | 旧方式で再計算（交通費除く） |
| `recalc_new` | 新方式で再計算（交通費除く） |
| `db_minus_old` | DB 値と旧再計算の差（時給変更検出） |
| `diff_new_minus_old` | **追加支給候補額** |
| `is_data_integrity_ok` | DB 値 = 旧再計算 + 交通費 ならOK、違えば要確認 |

**集計サマリ**（別シート or 別 CSV）：
- 全体: 件数・差額合計・平均・最大
- ワーカー別: 差額合計（追加支給する場合の振込額一覧）
- 月別: 差額合計
- 施設別: 差額合計（請求調整が必要な場合）
- 要確認件数（時給変動の疑いあり）

### 7-A-7. スクリプト雛形

`prisma/audit-salary-recalculation.ts` として実装するイメージ：

```typescript
// prisma/audit-salary-recalculation.ts
// READ-ONLY: 確定済み給与の旧方式 vs 新方式 差額一覧を出力
import { PrismaClient } from '@prisma/client';
import { calculateSalary as calcOld } from '../src/lib/salary-calculator';
// 新方式は別エクスポートとして実装する想定（実装は別タスク）
import { calculateSalaryNew as calcNew } from '../src/lib/salary-calculator';
import * as fs from 'fs';

async function main() {
  const prisma = new PrismaClient();

  const records = await prisma.attendance.findMany({
    where: {
      calculated_wage: { not: null },
      actual_start_time: { not: null },
      actual_end_time: { not: null },
    },
    include: {
      user: { select: { id: true, name: true } },
      facility: { select: { id: true, name: true } },
      application: {
        include: {
          workDate: {
            include: {
              job: {
                select: { hourly_wage: true, transportation_fee: true },
              },
            },
          },
        },
      },
    },
    orderBy: { created_at: 'asc' },
  });

  console.log(`対象レコード数: ${records.length}`);

  const rows: string[] = [];
  rows.push([
    'attendance_id', 'worker_id', 'worker_name',
    'facility_id', 'facility_name', 'work_date',
    'hourly_wage_current', 'transportation_fee', 'actual_minutes',
    'db_calculated_wage', 'recalc_old', 'recalc_new',
    'db_minus_old', 'diff_new_minus_old', 'is_data_integrity_ok',
  ].join(','));

  let totalDiff = 0;
  let diffCount = 0;
  let integrityNgCount = 0;
  const perWorker = new Map<number, { name: string; total: number }>();

  for (const a of records) {
    const job = a.application?.workDate?.job;
    if (!job || !a.actual_start_time || !a.actual_end_time) continue;

    const input = {
      startTime: a.actual_start_time,
      endTime: a.actual_end_time,
      breakMinutes: a.actual_break_time ?? 0,
      hourlyRate: job.hourly_wage,
    };

    const oldRes = calcOld(input);
    const newRes = calcNew(input);

    const dbWage = a.calculated_wage ?? 0;
    const recalcOld = oldRes.totalPay;            // 交通費を含まない
    const recalcNew = newRes.totalPay;
    const dbMinusOld = dbWage - (recalcOld + job.transportation_fee);
    const diffNewOld = recalcNew - recalcOld;
    const integrityOk = dbMinusOld === 0;

    if (diffNewOld !== 0) diffCount++;
    if (!integrityOk) integrityNgCount++;
    totalDiff += diffNewOld;

    const cur = perWorker.get(a.user.id) ?? { name: a.user.name, total: 0 };
    cur.total += diffNewOld;
    perWorker.set(a.user.id, cur);

    rows.push([
      a.id, a.user.id, JSON.stringify(a.user.name),
      a.facility.id, JSON.stringify(a.facility.name),
      a.actual_start_time.toISOString().slice(0, 10),
      job.hourly_wage, job.transportation_fee,
      Math.round((a.actual_end_time.getTime() - a.actual_start_time.getTime()) / 60000),
      dbWage, recalcOld, recalcNew,
      dbMinusOld, diffNewOld, integrityOk ? 'OK' : 'NG',
    ].join(','));
  }

  fs.writeFileSync('audit-salary-detail.csv', rows.join('\r\n'), 'utf-8');

  // ワーカー別サマリ
  const summaryRows: string[] = ['worker_id,worker_name,total_diff'];
  for (const [id, v] of perWorker) {
    summaryRows.push([id, JSON.stringify(v.name), v.total].join(','));
  }
  fs.writeFileSync('audit-salary-by-worker.csv', summaryRows.join('\r\n'), 'utf-8');

  console.log({
    totalRecords: records.length,
    diffRecords: diffCount,
    integrityNgRecords: integrityNgCount,
    totalDiff,
    avgDiff: diffCount > 0 ? Math.round(totalDiff / diffCount) : 0,
  });

  await prisma.$disconnect();
}

main().catch(console.error);
```

### 7-A-8. 実行ステップ（人間が手動で）

> ⚠️ Claude Code は `vercel env pull` も `.env.production.local` の作成も行わない（CLAUDE.md 厳守）

1. **新計算式の関数を `src/lib/salary-calculator.ts` に追加**（`calculateSalaryNew` として並置 or オプション引数で切り替え）
2. **`prisma/audit-salary-recalculation.ts` を実装**（上記雛形ベース）
3. **ステージング DB で先行実行**
   ```bash
   tsx prisma/audit-salary-recalculation.ts
   ```
   - 出力 CSV のフォーマット・整合性検証を確認
   - `integrityNgCount`（時給変動疑い）の件数を見る
4. **本番 DB 接続情報を取得**（人間が実行）
   ```bash
   vercel env pull --environment=production
   ```
   - 取得後 `.env.production.local` を一時利用
5. **本番 DB に対して同スクリプトを実行**
   - `DATABASE_URL` を `.env.production.local` の値に切り替えて実行
   - **READ-ONLY**（`findMany` のみ、書き込み一切なし）であることを実行前にコードレビュー
6. **生成 CSV をクライアントへ提出**
   - `audit-salary-detail.csv`（全件明細）
   - `audit-salary-by-worker.csv`（ワーカー別サマリ）
   - 必要に応じて月別・施設別サマリも追加

### 7-A-9. クライアント提出時に添える説明事項

- **差額の方向性**: 全件、新方式 ≧ 旧方式（旧方式が下回ることはない）
- **データ整合性 NG レコード**: 時給が事後変更されている可能性のあるもの。件数と原因をコメント
- **時給ヒストリカル制約**: 完全な過去復元は不可。現在の時給ベースで計算したものであることを明示
- **対象範囲**: `calculated_wage IS NOT NULL` の全件＝サービス開始時から
- **法的観点（再掲）**: 厚労省通達ベースの未払い分とみなされる可能性。社労士確認推奨

### 7-A-10. 既知のリスク・留意事項

| リスク | 対応 |
|--------|------|
| Job.hourly_wage の事後変更 | `is_data_integrity_ok` 列でフラグ。NG 件数次第で個別調査 |
| Job 削除済み（`onDelete: SetNull`） | スクリプトで `job==null` をスキップし件数を別カウント |
| 修正申請承認時の手動金額調整 | DB 値と旧再計算が乖離するため `is_data_integrity_ok` で検出 |
| 大量レコード時のメモリ | 件数が大きい場合は `findMany` をページネーション化（cursor or skip/take） |
| 本番接続後の `.env.production.local` 残置 | スクリプト実行後に削除する手順をチェックリスト化 |

---

## 7. 次のアクション

1. **本調査レポートをクライアントへ共有** → 提示すべき情報の認識合わせ
2. **新計算式の実装**（`salary-calculator.ts` の改修 + テスト更新）
3. **差額集計スクリプトの作成**（`prisma/audit-salary-recalculation.ts`）
4. **ステージング → 本番の順で集計を実行**（人間が手動で）
5. **集計結果（CSV）をクライアントへ提出 → 追加支給の要否を判断**
6. クライアント判断後、必要に応じて：
   - DB 上書きスクリプトの作成（人間が手動実行）
   - ワーカーへの通知文面準備
   - 追加振込の業務フロー実行

---

## 付録: 旧方式の関連コード位置

| 用途 | ファイル:行 |
|------|------------|
| ベース給（合計式） | `src/lib/salary-calculator.ts:316` |
| 残業手当（合計式・0.25 加算） | `src/lib/salary-calculator.ts:319` |
| 深夜手当（合計式・0.25 加算） | `src/lib/salary-calculator.ts:322` |
| 通常時間（内訳） | `src/lib/salary-calculator.ts:338` |
| 深夜時間（内訳・1.25 直接） | `src/lib/salary-calculator.ts:350` |
| 通常残業（内訳・1.25 直接） | `src/lib/salary-calculator.ts:362` |
| 深夜残業（内訳・1.5 直接） | `src/lib/salary-calculator.ts:374` |
| 休憩控除順（高単価優先） | `src/lib/salary-calculator.ts:271-297` |
| 確定給与カラム | `prisma/schema.prisma:1207`（Attendance.calculated_wage） |
| 確定処理 | `src/lib/actions/attendance-admin.ts:297`（approveModificationRequest） |
