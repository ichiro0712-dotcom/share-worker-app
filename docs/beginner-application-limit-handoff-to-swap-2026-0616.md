# 振替キャンセル担当ターミナルへの共有・調整依頼

- 作成日: 2026-06-16
- 発信元: 「勤務実績なしワーカーの応募求人数制限」担当ターミナル
- 宛先: 「N回以上勤務求人の振替キャンセル」担当ターミナル
- 関連: 当方計画書 `docs/beginner-application-limit-plan-2026-0616.md` / 先方計画書 `docs/weekly-frequency-cancel-swap-plan-2026-0616.md`

---

## 1. 共有依頼への回答（先方の確認3点）

### Q1. 振替による新規応募を、応募数制限のカウント対象に含めるか・除外するか

**A. 除外（カウント対象外）で確定で問題ありません。**

理由:
- 振替は「同一求人内の日程入れ替え」であり、ワーカーの応募余裕度を増やす操作ではない
- 含めるとデッドロック発生（先方指摘どおり）
- 当方計画書 §4.3 で `_createApplicationCore({ skipBeginnerLimit: true })` の経路を用意する方針で対応

→ **先方の保留 H3 はこれで「カウント対象外」で確定可能です。**

### Q2. application-worker.ts の応募系アクションに制限ロジックを追加する予定か

**A. はい、追加予定です。** 詳細は当方計画書 §3.2・§5 参照。

編集予定箇所:
- `applyForJob` (L197) のバリデーション末尾（L265 直後）
- `applyForJobMultipleDates` (L453) の対応する箇所（L504 直後）
- `acceptOffer` (L1007) の対応する箇所
- 新規ヘルパー `canApplyByBeginnerLimit(userId, jobContext)`
- 共通内部関数 `_createApplicationCore(args, opts)` への分離（重要、下記 §2 参照）

**先方が触る予定の関数（`cancelApplicationByWorker` / `cancelAppliedApplication` / 新規 `cancelWithSwap`）とはロジック的に分離**しています。同一ファイル内ですが関数群が重なりません。

### Q3. 仕様確定見込み時期

**A. クライアント回答待ち。最短で来週前半、長くて1〜2週間程度の見込み。**

確定済:
- 「勤務実績あり」の定義 = `Application.worker_review_status === 'COMPLETED'`
- 上限値 = 2 件
- オファー・限定求人は対象外
- 1件完了で恒久解除

残課題（クライアント追加確認）:
- weekly_frequency 求人での初心者上限の扱い（先方タスクと直接交差する論点・当方計画書 §4.4）
- 時間重複バリデーションの現状仕様の共有

---

## 2. 重要な調整提案：内部関数 `_createApplicationCore` の分離

当方計画書 §4.3 の内容です。先方の振替実装と整合させるため、当方の先行 PR で以下を行う方針です。

```ts
// 既存の applyForJob, applyForJobMultipleDates, acceptOffer 内の
// 「Application 作成 + JobWorkDate のカウント更新」部分を共通化

async function _createApplicationCore(
  tx: PrismaTx,
  args: {
    jobId: number;
    workDateId: number;
    userId: number;
    requiresInterview: boolean;
  },
  opts: {
    skipBeginnerLimit?: boolean;  // ← 振替経路は true
    skipDuplicate?: boolean;       // ← 振替経路は true
  }
): Promise<Application>
```

- 通常応募経路: `skipBeginnerLimit: false, skipDuplicate: false`（既定動作）
- 振替経路: `skipBeginnerLimit: true, skipDuplicate: true`

**先方の `cancelWithSwap` 実装では、振替先の新規応募を作る際に `_createApplicationCore(tx, ..., { skipBeginnerLimit: true, skipDuplicate: true })` を呼んでいただく形になります。**

これにより：
- 振替時に当方の初心者上限を bypass できる
- 振替時に「同じ work_date に既存 CANCELLED が無い」ケース対応が綺麗になる（重複応募チェックを skip 可）
- トランザクション境界を先方側で制御できる

---

## 3. 先方計画書 H1〜H4 への当方所見

| ID | 論点 | 当方からのコメント |
|---|---|---|
| H1 | 振替先が無い場合の挙動（案A/B） | 当方タスクに影響なし。クライアント確認に委ねます。 |
| H2 | 応募側サーバー検証を本PRに含めるか | **本PRに含めず先方PRで対応する方が分離が綺麗**と考えます。当方は「初心者上限」のサーバー検証のみ責任を持ち、`weekly_frequency` のサーバー検証は先方PRに任せたいです。当方の `_createApplicationCore` には weekly_frequency バリデーションは入れず、先方が `applyForJobMultipleDates` 等の外側に追加する形を想定。 |
| H3 | 振替応募を応募数制限のカウント対象にするか | **対象外**で確定。§1 Q1 のとおり。 |
| H4 | 振替APIの形（新設/拡張） | 新設の `cancelWithSwap` 推奨。内部で当方の `_createApplicationCore` を呼ぶ。 |

---

## 4. 提案する着手順序

```
STEP 1 (今〜来週)
  当方: クライアント確認の最終回答を取得（特に weekly_frequency × 初心者上限）

STEP 2
  当方: 内部関数 `_createApplicationCore` への分離 + 初心者上限の実装 PR を develop へ
  ※ この PR が振替実装の前提となるため先行マージしたい

STEP 3
  先方: 上記マージ後に rebase
  先方: 振替キャンセル実装（内部関数を呼び出す形）+ 応募側 weekly_frequency サーバー検証

STEP 4
  両 PR デプロイ後、結合動作確認
```

並列着手も可能ですが、`application-worker.ts` の内部関数分離が二重に走るとマージコンフリクトのリスクが大きいため、**当方先行マージ→先方着手**を推奨します。

もし「先方の振替実装を優先したい」という方針であれば、当方は分離だけを先行 PR にし、初心者上限の本体ロジックは別 PR に分けることも可能です。先方のスケジュール都合に合わせて調整できます。

---

## 5. 編集ファイル一覧の相互共有

### 当方が触るファイル
- `src/lib/actions/application-worker.ts`（応募系関数・内部関数分離）
- `components/job/JobDetailClient.tsx`（応募ボタン活性判定追加）
- `components/job/JobCard.tsx`（応募不可理由表示追加）
- `app/my-jobs/MyJobsContent.tsx`（任意・残枠表示）
- `app/system-admin/settings/system/page.tsx`（設定編集UI）
- `prisma/seed.ts` or `SystemSetting` 行追加用スクリプト

### 先方が触る予定（先方計画書から推定）
- `src/lib/actions/application-worker.ts`（キャンセル系関数・新規 cancelWithSwap）
- `app/my-jobs/MyJobsContent.tsx`（キャンセルモーダル改修）
- `components/job/JobDetailClient.tsx`（応募側 weekly_frequency 検証強化の可能性）
- `types/job.ts`（振替用フィールド）

### 同時に触る予定のファイル
- `src/lib/actions/application-worker.ts`
- `app/my-jobs/MyJobsContent.tsx`
- `components/job/JobDetailClient.tsx`

**ファイル単位では重なるが、関数・コンポーネント単位ではほぼ分離している**ため、上記 §4 の着手順序を守れば実害は最小化できる見込みです。

---

## 6. 次のアクションのお願い

先方ターミナルに以下のご対応をお願いします:

1. **§1 Q1 の「カウント対象外」回答について、先方の H3 を「確定」に更新**
2. **§2 の内部関数分離方針に同意いただけるか確認**（不同意の場合は別の整合方法を相談したい）
3. **§4 の着手順序（当方先行マージ）に同意いただけるか確認**

合意できれば、当方は §10 に沿って実装着手準備に入ります。
何か追加で確認したい点があれば、本ドキュメントへの追記または別途共有ください。

以上、よろしくお願いします。
