# 勤務実績なしワーカーの応募求人数制限 実装計画

- 作成日: 2026-06-16
- 最終更新: 2026-06-19（先方の着手順調整完了・シンプル実装方針確定）
- ステータス: **実装着手準備完了（シンプル実装方針）**
- 担当ターミナル: 本ファイル作成ターミナル
- 関連他作業: **「N回以上勤務求人の振替キャンセル」仕様変更（別ターミナル `docs/weekly-frequency-cancel-swap-plan-2026-0616.md`）** ← 編集ファイル重複あり。本ドキュメント末尾「他作業との関係」参照。

> ⚠️ このドキュメントは複数の開発ターミナル間で状況共有するための「現状ハブ」です。
> 未確定の論点は「🔶 保留」で明示しています。確定するまで実装に入りません。

---

## 1. 背景・目的

### 報告された運用課題（クライアント要望・2026-06-16）

> アプリ化前の対応依頼で恐縮ですが、まだ勤務実績のないワーカーさんは応募できる求人数に制限をかけたいです。まだ信用がない方が5日程応募し、すべてキャンセルという事態が起きています。信用ポイント等はまだ構築前ではあるので、一旦初心者だけの部分をカイテクに合わせたいです。

### 構造的な課題
- 当方は信用スコア・ペナルティ・回避チケット等のワーカー定着制御を未実装
- 勤務実績ゼロのワーカーが大量応募→全キャンセルを繰り返しても抑止する仕組みがない
- 施設の人員計画が崩れる／運営アラート（キャンセル率20%超）は事後検知のみ

### クライアント確定要望（カイテク踏襲）
- 「勤務実績なし」=「ワーカーが施設レビューを送った時点」未到達のワーカー
- 同時応募の上限を **2件** に制限
- 1件完了で恒久解除
- オファー・限定求人は上限の対象外（カイテク同等）
- キャンセル時の追加ペナルティは別フェーズ（キャンセルポリシー草案あり）

---

## 2. 現状仕様の調査結果（コードレベル）

### 2.1 応募エントリポイント
- `src/lib/actions/application-worker.ts:197` `applyForJob(jobId, workDateId?)` … 単日応募
- `src/lib/actions/application-worker.ts:453` `applyForJobMultipleDates(jobId, workDateIds)` … 複数日まとめ応募
- `src/lib/actions/application-worker.ts:1007` `acceptOffer(jobId, workDateId)` … オファー受諾

### 2.2 既存バリデーション（applyForJob L225-293）
- アカウント停止
- メール認証
- プロフィール完成度
- 性別指定 (`canApplyByGender`)
- 資格要件 (`canApplyByQualification`)
- 同一勤務日への重複応募
- 募集人数の充足

→ **「同時応募件数」「勤務実績の有無」に基づく制限は一切なし。**

### 2.3 「勤務実績」を判定できるフィールド
- `Application.worker_review_status`（PENDING | COMPLETED）… ワーカーが施設レビューを送った時点で COMPLETED に更新
- `Application.status === 'COMPLETED_RATED'`（双方評価完了後）… これは「ワーカーが施設レビューを送った時点」より遅い
- **クライアント定義に従い `worker_review_status === 'COMPLETED'` を判定軸とする**

ワーカーレビュー送信処理: `src/lib/actions/review-worker.ts:105-123`

### 2.4 時間重複バリデーション（既存・参考）
- `components/job/JobDetailClient.tsx:58-72, 863-878, 964-978` … UI側で `isTimeOverlapping` による時間重複ブロック
- データ元: `src/lib/actions/application-worker.ts:720` `getUserScheduledJobs()`
- where 句は `status: { in: ['SCHEDULED', 'WORKING'] }` のみ（APPLIED と CANCELLED は対象外）
- サーバー側には時間重複チェックなし

### 2.5 設定値の格納先
- `prisma/schema.prisma:1366-1381` `SystemSetting` テーブル（key/value）
- System Admin 画面 `/app/system-admin/settings/system` から編集可能

---

## 3. 影響範囲

### 3.1 対象ワーカー
`Application.worker_review_status === 'COMPLETED'` の Application を1件も持たないすべてのワーカー（新規登録〜初回勤務完了の評価提出前まで）。

### 3.2 改修が必要なファイル（想定）
- サーバー: `src/lib/actions/application-worker.ts`
  - `applyForJob` / `applyForJobMultipleDates` / `acceptOffer` のバリデーション部に初心者上限チェック追加
  - 新規ヘルパー: `canApplyByBeginnerLimit(userId)` を同ファイル or `src/lib/actions/` 配下に新設
  - 任意: `getUserApplicationQuota(userId)` を新設（UI で残枠表示する場合）
- UI: `components/job/JobDetailClient.tsx`, `components/job/JobCard.tsx`
  - 応募ボタンの活性判定に「初心者上限到達」分岐を追加
  - 不可理由メッセージ表示
- UI: `app/my-jobs/MyJobsContent.tsx`（任意）
  - マイページに「応募可能件数（あと◯件）」表示
- 設定: `SystemSetting` テーブルに `BEGINNER_APPLICATION_LIMIT`（default 2）を追加
- System Admin: `/app/system-admin/settings/system/page.tsx` に編集UI追加

### 3.3 ステータス別の考慮
カウント対象は以下4ステータスを想定（CANCELLED は除外）：
- `APPLIED`（審査中）
- `SCHEDULED`（マッチ済み）
- `WORKING`（勤務中）
- `COMPLETED_PENDING`（完了待ち＝退勤後・レビュー前）

---

## 4. 修正方針

### 4.1 基本ルール
```
判定:
  isBeginnter = Application.count(user_id, worker_review_status='COMPLETED') === 0
  通常求人への応募試行時:
    if isBeginnter:
      ongoingCount = Application.count(
        user_id,
        status IN (APPLIED, SCHEDULED, WORKING, COMPLETED_PENDING)
      )
      if ongoingCount >= BEGINNER_APPLICATION_LIMIT:
        return error
```

### 4.2 例外（上限の対象外とする応募経路）
- **オファー・限定求人**: `acceptOffer` と、限定公開（LIMITED_WORKED / LIMITED_FAVORITE / ORIENTATION）に該当する求人への応募はカウントの上限判定対象外
- **🔶 weekly_frequency 求人**: 別ターミナルとの調整事項 → 詳細は §8

### 4.3 ✅ 確定: 実装方式（2026-06-19 先方調整結果）
**内部関数 `_createApplicationCore` への分離は実施しない（シンプル実装）。**

理由：
- §4.4 案B採択により、初心者が weekly_frequency 求人に応募できない → 振替シナリオは発生しない
- 先方（振替キャンセル担当）から「通常実装で OK・特別な配慮不要」「リベース時にこちらで吸収」と確認済み
- 既存コードの構造変更を最小化することでレビュー容易性・コンフリクトリスクを下げる

採用方式：

```ts
// 既存の applyForJob / applyForJobMultipleDates / acceptOffer 関数に直接ガードを追加
// 関数シグネチャ・早期return構造は維持

async function applyForJob(jobId, workDateId?) {
  // 既存バリデーション（停止/メール認証/プロフィール/性別/資格）
  ...
  // ★ 新規ガード追加（性別・資格チェックの直後）
  const beginnerCheck = await canApplyByBeginnerLimit(user.id, job);
  if (!beginnerCheck.allowed) {
    return { success: false, error: beginnerCheck.reason };
  }
  // 既存の重複応募・募集人数チェック・Application作成へ続く
  ...
}
```

**変更しないこと（先方と合意・リベース容易性のため）：**
- 関数シグネチャ
- 早期 return の位置・順序
- 既存バリデーションの順序入れ替え

**後発で先方が `applyForJobMultipleDates` に weekly_frequency サーバー検証を追加予定** → 当方の初心者ガードの「後ろ」に積まれる構造

### 4.4 ✅ 確定: weekly_frequency 求人と初心者上限の関係（2026-06-17 クライアント回答）
- **案B 採択**: 勤務実績のないワーカーは weekly_frequency 求人（N回以上勤務条件付き）には**応募不可**
- 判定: `job.weekly_frequency != null && job.weekly_frequency >= 2` の求人で、応募ユーザーが「勤務実績なし」なら即エラー
- エラーメッセージ案: 「勤務実績のあるワーカーのみ応募可能な求人です。初回勤務後にご応募ください。」
- UI: 求人カード・求人詳細でも応募ボタンを無効化し、理由を明示
- 含意: 振替（別ターミナル）との干渉が解消。初心者は weekly_frequency 求人に応募できないため、初心者の振替シナリオは発生しない

### 4.5 ✅ 確定: キャンセル後の同一時間帯への再応募の扱い（2026-06-17 クライアント回答）
- **今回スコープ外**（クライアント明言「取り急ぎ初心者上限のみ優先」）
- 将来対応として **❺将来要望**: 「キャンセル済・審査待ち中も含めて時間重複ブロックを拡大」をクライアントが希望。本実装完了後に別フェーズで対応する
- 当面は、初心者の応募→キャンセル→別求人応募の繰り返しが「同時2件」の天井で抑止される構造を維持

### 4.6 ✅ 確定: エラーメッセージ文言（2026-06-17 クライアント承認）
- 通常上限到達時:
  「勤務実績のないワーカーは同時2件まで応募可能です。1件勤務完了後（施設へのレビュー送信後）に解除されます。」
- weekly_frequency 求人への応募試行時:
  「勤務実績のあるワーカーのみ応募可能な求人です。初回勤務後にご応募ください。」
- 求人カード・求人詳細でも応募ボタン無効化と上記理由を表示

### 4.7 ✅ 確定: マイページの残枠表示（2026-06-17 クライアント承認）
- マイページに「応募可能件数 あと◯件」を表示する
- **初心者期間中のみ表示**（worker_review_status COMPLETED が1件でもあれば非表示）
- カイテク踏襲のUI

### 4.8 ✅ 確定: 既存ワーカーへの適用方法（2026-06-17 クライアント承認）
- 既存応募は強制キャンセルせず維持
- リリース直後に既に上限超過状態のワーカーは新規応募から上限適用 → 自然減衰
- マイグレーション処理は不要

---

## 5. 実装手順（シンプル実装方針・全7ステップ）

1. **`SystemSetting` への設定追加**
   - キー: `BEGINNER_APPLICATION_LIMIT` / 値: `2` / type: integer
   - `prisma/seed.ts` への追加で初期化（ステージング・本番は手動 SQL or System Admin 画面で投入）

2. **ヘルパー関数の新設**
   - 場所: `src/lib/actions/application-worker.ts` 内 or 同ディレクトリの新規ファイル
   - シグネチャ: `canApplyByBeginnerLimit(userId, job): Promise<{ allowed: boolean; reason?: string }>`
   - 処理：
     - `worker_review_status === 'COMPLETED'` カウント取得 → 0 件なら初心者判定
     - 初心者でなければ即 `{ allowed: true }`
     - 初心者かつ `job.weekly_frequency != null && >= 2` → 4.6 後者の文言でエラー
     - 初心者かつ ongoing カウント >= 上限 → 4.6 前者の文言でエラー
   - ongoing カウントの where: `status: { in: ['APPLIED', 'SCHEDULED', 'WORKING', 'COMPLETED_PENDING'] }`

3. **応募系3関数への組み込み**（既存構造を維持・ガード1ブロック追加のみ）
   - `applyForJob` (L197) 資格チェック直後（L265 付近）にガード追加
   - `applyForJobMultipleDates` (L453) 同様の位置（L504 付近）にガード追加
   - `acceptOffer` (L1007) **オファー経路は例外のためガード追加せず**（または `canApplyByBeginnerLimit` を呼ばない）
   - 関数シグネチャ・早期return構造は変更しない

4. **UI: 応募ボタン無効化と理由表示**
   - `components/job/JobDetailClient.tsx`、`components/job/JobCard.tsx`
   - 応募ボタン活性判定に「初心者上限到達」「weekly_frequency 応募不可」を追加
   - 4.6 のエラーメッセージを表示
   - サーバーから初心者判定情報を取得する必要があるため、ページ側で `getUserApplicationQuota(userId)` 相当を呼ぶ

5. **UI: マイページ残枠表示（4.7）**
   - `app/my-jobs/MyJobsContent.tsx` のヘッダー部に「応募可能件数 あと◯件」を表示
   - **初心者期間中のみ表示**（完了レビュー件数 > 0 で非表示）
   - カウントは server actions から取得

6. **System Admin: 設定編集UI追加**
   - `/app/system-admin/settings/system/page.tsx` に `BEGINNER_APPLICATION_LIMIT` の編集フォーム追加
   - 即時反映（次回応募から有効）

7. **ビルド・型チェック・テスト**: `npm run build` → §6 のテストケース実行

---

## 6. 確認方法（テスト観点）

### 手動テスト
- [ ] 新規ワーカー（worker_review_status COMPLETED 0件）が2件応募 → 3件目で上限エラー
- [ ] 上記ワーカーが1件キャンセル → 1件分の枠が回復し、再度応募可能
- [ ] 初回勤務 → 退勤 → ワーカーが施設レビュー送信 → **その時点で上限解除**
- [ ] 上限到達状態でもオファー（`acceptOffer`）は受諾可能
- [ ] 上限到達状態でも限定求人（LIMITED_*）への応募は可能
- [ ] weekly_frequency >= 2 求人に初心者が応募 → 4.6 後者の文言でエラー（応募ボタン無効化）
- [ ] 非初心者は weekly_frequency 求人にも通常応募可能
- [ ] System Admin で BEGINNER_APPLICATION_LIMIT を変更 → 即時反映
- [ ] マイページの残枠表示が初心者期間中のみ表示・1件完了後に消える

### 自動テスト
- 既存 e2e（`tests/e2e/`）に応募系シナリオがあるか確認し、初心者上限ケースを追加検討

---

## 7. デプロイ影響
- **DB変更: なし**（既存 `SystemSetting` テーブルに key/value 行を追加するだけ。スキーマ変更不要）
- 初期データ投入: `BEGINNER_APPLICATION_LIMIT=2` を本番・ステージング両方の `SystemSetting` に追加（手動 SQL or System Admin 画面）
- **既存ワーカーへの影響**: 強制キャンセルなし。リリース後の新規応募から上限適用で自然減衰（4.8）
- デプロイのみで反映可能の想定

---

## 8. 他作業との関係（調整完了・2026-06-19）

### 別ターミナルの仕様変更
**「N回以上勤務求人の振替キャンセル」**（`docs/weekly-frequency-cancel-swap-plan-2026-0616.md`、2026-06-18 仕様確定・実装着手可）

### 調整結果（2026-06-19 先方回答受領）
- **仕様の衝突は無し**（案B採択により振替シナリオが発生しない）
- **着手順は「当方先行マージ → 先方リベース追従」で確定**
- 当方は **通常の実装で OK・特別な配慮不要**
- 編集ファイル重複部分は先方がリベース時に吸収
- 内部関数分離（`_createApplicationCore`）は **不要**（§4.3 参照）

### 当方の留意点（先方依頼事項）
- **関数シグネチャを変更しない**
- **早期 return の位置・順序を入れ替えない**
- **検証順を入れ替えない**
- 上記を破る場合のみ先方へ事前共有

### 先方が後発で追加予定（参考）
- `applyForJobMultipleDates` への weekly_frequency サーバー検証
- 当方の初心者ガードの「後ろ」に積まれる構造
- 当方は applyForJobMultipleDates の構造を維持すれば、リベース時に自然に積まれる

### マージ後の通知フロー
当方の PR が develop にマージされた時点で、別ターミナルへ「マージ完了通知」を入れる（テキストは別途作成）。先方は通知を受けてリベース・実装着手。

---

## 9. 未確定事項（🔶 保留）一覧

すべて確定済み（2026-06-17）。

将来フェーズ（本実装完了後の別タスク）:
- F1: 時間重複ブロックの拡張（キャンセル済・審査待ちも対象に追加）→ クライアント希望事項

---

## 10. 現在のステータス
- [x] 現状仕様の調査完了
- [x] クライアント要望ヒアリング第1回（同時2件・1件完了で解除・オファー/限定対象外）
- [x] 実装計画ドラフト作成（本ファイル）
- [x] クライアント追加確認 ❺❻ 完了（2026-06-17、❺=現状維持＋将来拡張・❻=案B応募不可）
- [x] 実装詳細の最終確認完了（2026-06-17、4.6〜4.8）
- [x] 別ターミナルへの仕様確定共有（`docs/beginner-application-limit-handoff-to-swap-2026-0617.md` で通知）
- [x] 別ターミナルからの調整回答受領・実装方針確定（2026-06-19、シンプル実装・内部関数分離なし）
- [ ] **実装着手許可待ち**
- [ ] 実装着手
- [ ] テスト
- [ ] PR作成（→ develop）
- [ ] develop マージ後・別ターミナルへマージ完了通知
