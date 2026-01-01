# レビューテストの前提条件マトリクス

## 前提の考え方
- レビュー機能は「勤務完了」や「レビュー未完了/完了」の状態に依存する
- E2Eでは前提データを事前作成し、空状態ではなく実データの表示を検証する

## 画面/機能ごとの前提
### /mypage/reviews（レビュー一覧）
- 評価待ち一覧（pending）
  - application.status が `COMPLETED_PENDING` または `COMPLETED_RATED`
  - application.worker_review_status が `PENDING`
- 投稿済み一覧（completed）
  - reviews テーブルに reviewer_type = `WORKER` が存在

### /mypage/reviews/[applicationId]（レビュー投稿フォーム）
- application.id が存在し、user_id がログインユーザーと一致
- application.worker_review_status が `COMPLETED` ではない
  - `COMPLETED` の場合は /mypage/reviews にリダイレクト
- status は submitReview 側で `SCHEDULED` / `WORKING` / `COMPLETED_PENDING` / `COMPLETED_RATED` が許容

### /mypage/reviews/received（受け取ったレビュー）
- reviews テーブルに reviewer_type = `FACILITY` が存在
- AuthContext でログイン済み（未ログインは /login へ）

## データ作成の目安
- `tests/e2e/fixtures/review-setup.ts` で以下を作成する
  - 評価待ち用の求人・勤務日・応募（COMPLETED_PENDING + worker_review_status=PENDING）
  - 投稿済み/受け取ったレビュー用の求人・勤務日・応募（COMPLETED_RATED + 両レビューCOMPLETED）
  - reviews（WORKER, FACILITY）を各1件作成

## テスト上の扱い
- 「評価待ち」「投稿済み」「受け取ったレビュー」は、fixtureで用意したデータの表示を確認する
- レビュー投稿フォームは applicationId が存在しないと notFound になるため、fixtureの pending 応募を必ず使用する
