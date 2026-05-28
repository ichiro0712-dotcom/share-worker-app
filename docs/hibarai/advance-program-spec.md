# 日払い advance_program 強制 仕様 (P0-5)

> 作成日: 2026-05-28
> 対象: 前払いプログラム種別(advance_program)による チャージ/出金 の許可制御
> ステータス: 実装済（P0-5、TDD）
> 関連: [wage-adjustment-spec.md](./wage-adjustment-spec.md), [gmo-submit-recovery-spec.md](./gmo-submit-recovery-spec.md)

## 1. 背景

`advance_payment_policies.advance_program`（HIBARAI / LEGACY_CARRYBARAI / DISABLED）の enum はあったが、
実ロジックは rate / limit / is_suspended しか見ておらず、**LEGACY_CARRYBARAI や DISABLED のワーカーでも
残高加算（チャージ）・出金できてしまう**状態だった（Architect P0-5 指摘）。

## 2. 仕様

有効ポリシーの `advance_program` が **HIBARAI 以外なら、チャージも出金も拒否**する。

| 経路 | HIBARAI（または policy なし=デフォルト） | LEGACY_CARRYBARAI / DISABLED |
|---|---|---|
| 初回チャージ（reconcile） | チャージする | **チャージしない**（return） |
| 出金申請（createWithdrawalRequest） | 許可 | **拒否**（`ProgramNotAllowedError`、引当しない） |
| 既存チャージの差額調整（reconcile adjustment） | 調整する | 調整する（既存データの補正は継続） |

- **policy が存在しない場合はデフォルト HIBARAI 扱い**で許可（現行どおり）。
  非HIBARAIは「policy が存在し、かつ program≠HIBARAI」のときのみ拒否する。
- 差額調整（既に ATTENDANCE_CONFIRMED がある勤怠の wage 変更）は、プログラムに関係なく継続する
  （残高整合の補正であり新規前払いではないため）。

## 3. 実装ファイル（P0-5）

| ファイル | 変更 |
|---|---|
| `lib/actions/hibarai/withdrawal-errors.ts` | `ProgramNotAllowedError` 追加 |
| `lib/actions/hibarai/withdrawal.ts` | createWithdrawalRequest の policy 検査に `advance_program !== 'HIBARAI'` 拒否を追加 |
| `lib/actions/hibarai/review-trigger.ts` | 初回チャージ branch で `advance_program !== 'HIBARAI'` なら return |
| `__tests__/withdrawal.test.ts` / `review-trigger.test.ts` | DISABLED / LEGACY_CARRYBARAI で出金拒否・チャージ無しの4テスト |

DB変更なし（enum・列は既存）。

## 4. スコープ外 / フォローアップ

- 「既存キャリ払いとの同一勤怠排他」（同じ勤怠が日払いとキャリ払いの両方で前払いされない制御）は、
  キャリ払い側システムの実装詳細に依存するため本対応のスコープ外。キャリ払い連携時に別途設計する。
- 本対応は**申請作成時の拒否**。作成済みの PENDING 出金は、後から policy が非HIBARAIへ変わっても
  submit 側で再検査しない（作成時点では正当だった）。policy変更後の未送信PENDINGも止めたい場合は、
  初回送信前の再検査で revert/cancel する設計が別途必要（P0-3の口座再検査と同じ層に追加可能）。
