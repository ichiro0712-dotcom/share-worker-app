# 日払い機能 公開前チェックリスト（金銭リスク観点）

> 作成日: 2026-05-28
> 目的: 「何が分からないか分からない」を有限の TODO に変える。本番公開（実送金）の前提条件。
> 背景: Claude 3エージェント＋Codex による金銭リスクレビューの結論を運用タスク化したもの。
> 関連: [gmo-submit-recovery-spec.md](./gmo-submit-recovery-spec.md), [bank-snapshot-spec.md](./bank-snapshot-spec.md), [settlement-month-spec.md](./settlement-month-spec.md)

## レビュー結論（コードレベル）

- 運営者が損する確定的な金銭経路は、status=26修正後は **発見されていない**。
- 残高ロック(FOR UPDATE + Serializable)、引当と残高減算の原子性、完了の delta:0、返却の冪等、
  二重送金防御(idempotency-key + claim原子性 + UNIQUE制約)はコードで確認済み。
- 残る不安は **運用・外部連携**であり、下記の有限リストに尽きる。

## 🔴 公開前に必須（1〜3。これが済むまで実送金を有効化しない）

- [ ] **1. GMO Idempotency-Key の仕様確認 + 実機テスト**
  - 保持期間 / スコープ / 同一キー・同一bodyの再送挙動 / 同一キー・別bodyの拒否挙動 を GMO に確認
  - GMOテスト環境(sunabar)で「初回送信→応答前にプロセス停止→同一キー再送」で二重送金されない（同一applyNo回収）ことを実機確認
  - 理由: 完全クラッシュ時の二重送金の最後の砦が GMO 側のキー重複検知。`getTransferRequestResult` は applyNo 必須で不明時は使えない
- [ ] **2. 月末スイープの実装（または前月残高の凍結）**
  - 月末に前月の残額＋1割プールを給与口座へ振替する処理が未実装
  - 給与システムと並行公開すると「日払いで受取 + 給与でも支払」の**二重受領**リスク（運営者損失）
  - 最低でも「前月 settlement_month 残高は当月出金不可」の凍結を入れること
- [ ] **3. DB バックアップ強化（PITR 有効化）**
  - 現状 1日1回だと最大24h分消失しうる。金銭データには不足
  - Supabase の Point-in-Time Recovery を有効化（復旧地点を数分単位に）
  - 緩和材料: 台帳append-only + 監査ハッシュチェーン + transfer_attempts + GMO明細(正本)で突合復元は可能だが、保険として必須

## 🟡 公開後に段階対応可（4〜8）

- [ ] **4. 監視・アラート**
  - `PROCESSING かつ gmo_apply_no IS NULL` の滞留検知
  - `WITHDRAWAL_SUBMIT_UNKNOWN` / `WITHDRAWAL_RECALL_FAILED`(組戻不成立) / `WITHDRAWAL_APPLY_NO_CONFLICT` 監査の発生頻度
  - GMO振込明細との日次突合（applyNo / 金額）
- [ ] **5. 緊急停止手順の整備**
  - `emergency_stop_states` の管理画面操作手順、誰が・どの条件で止めるか
- [ ] **6. 口座編集フロー(W3/W4)の実装条件**
  - 振込先変更時に `lastChangedAt = now()` 設定、`isVerified=false` リセット、必要なら `cooldownUntil`
  - **active な PENDING/PROCESSING 出金がある間は口座変更を拒否**（送信直前TOCTOUを源流で塞ぐ）
- [ ] **7. 勤怠/Application 取消時のクローバック**
  - チャージ済勤怠の取消で負残高になった分の回収運用（手動調整 or 次回相殺）の整備
- [ ] **8. 経理・法務確認**
  - 精算月の帰属ルール（失敗でも申請月=requested_at の JST 月、で確定してよいか）
  - 手数料本人負担の法的根拠、前払いの会計的性質

## 修正済み（このレビューで対応）

- ✅ GMO status=26(組戻不成立) を残高復元から除外（二重支払い修正）。`isBalanceRestorableFailureStatus` + ユニットテスト
- ✅ P0-1〜P0-5（精算月 / 過払い調整 / 口座snapshot / GMO不明復旧・resultCode=2 / advance_program強制）

## GMO 振込ステータスの扱い（参考）

`GET /transfer/status` で取得・poll cron が分岐:
- 20 手続済(成功) → 完了（残高そのまま）
- 40 手続不成立(口座不明等で失敗) → 残高を戻す（資金未流出）
- 22 資金返却 / 25 組戻済 → 残高を戻す
- 26 組戻不成立 → 残高を戻さない（資金が受取人側に残る）＋要調査
- 2/11/12/13/24 中間状態 → ポーリング継続
