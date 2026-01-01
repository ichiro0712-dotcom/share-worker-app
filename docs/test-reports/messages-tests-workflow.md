# メッセージ系テスト修正ワークフロー

## 目的
- ステージング環境でメッセージ系E2Eの失敗を小さな粒度で修正する
- 途中で中断しても再開できるように手順を固定化する

## 前提
- ステージングURL: `https://stg-share-worker.vercel.app`
- ログインアカウントは `tests/e2e/.auth/test-accounts.json` を使用
- レポート出力先: `reports/playwright`

## 作業手順
1. 作業ブランチ作成
   - 例: `git checkout -b fix/messages-tests`
2. 対象テストを最小単位で実行
   - 施設側メッセージ
     - `PLAYWRIGHT_BASE_URL=https://stg-share-worker.vercel.app PLAYWRIGHT_USE_EXISTING_SERVER=1 npx playwright test tests/e2e/facility/messages.spec.ts --headed`
   - ワーカー側メッセージ
     - `PLAYWRIGHT_BASE_URL=https://stg-share-worker.vercel.app PLAYWRIGHT_USE_EXISTING_SERVER=1 npx playwright test tests/e2e/worker/messages.spec.ts --headed`
3. 失敗の確認
   - HTMLレポート: `npx playwright show-report reports/playwright`
   - 失敗スクショ: `test-results/`
4. 修正→再実行
   - 1ファイル/1〜2テスト単位で修正
   - 修正後に該当specのみ再実行
5. 完了条件
   - `facility/messages.spec.ts` と `worker/messages.spec.ts` が単独実行でPASS

## メモ
- データ不足の可能性がある場合は空状態の許容を優先
- 画面が遅い場合は `TIMEOUTS` の拡張を検討
