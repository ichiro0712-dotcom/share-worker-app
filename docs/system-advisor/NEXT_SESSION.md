# 次セッションへのメッセージ

**最終更新**: 2026-05-17 セッション末尾 → 2026-05-17 後続セッションで METRIC_CATALOG 完遂 → 2026-05-18 セッションで Auto-fill 改良 + execute_sql ショートカット問題を確認 → **2026-05-18 末尾: ショートカット撤廃はユーザー判断で見送り**
**対象**: 次セッションで System Advisor を引き継ぐ Claude

---

## ⚠️ 既知の制約事項: execute_sql ショートサーキットによる「会話打ち切り」(2026-05-18 確認)

### 症状

通常チャット (Sonnet) で `execute_sql` を呼ぶと、サーバーが「**表 T-XXX を取得しました**」という固定文だけ返して会話を打ち切る。具体的には:

- 会話を続けようとしているのに、データを取った瞬間に止まる
- 「表を作らないで」と言っても作ってしまう (ツール呼出 = 強制で表作成)
- 「表を 2 つ出して」と言っても 1 つ目で止まる

### 原因

[src/lib/advisor/orchestrator.ts:895-1010](../../src/lib/advisor/orchestrator.ts#L895) のサーバー側ショートサーキット:

```
execute_sql 呼び出し
  ↓
ツール実行 → 表 T-XXX を DB に保存
  ↓
🚀 サーバー側で「表 T-XXX を取得しました」固定文 + return;  ← ココ
  ↓
loop=1 (Claude による会話継続) を実行せずに会話終了
```

`add_tables_to_report` も同じパターン ([orchestrator.ts:1013](../../src/lib/advisor/orchestrator.ts#L1013))。

### なぜ入れられたか (撤廃すると再発するリスク)

コードコメント: 「loop=1 で Anthropic 側 TTFB が 100 秒級になる事象を構造的に回避」。

過去に表ツール後の整形応答で Anthropic 側 TTFB が 100 秒級になる事象があり、それを構造的に避けるために**ツール結果を Claude に返さずサーバー固定文で打ち切る**設計にした。

### 2026-05-18 セッションでのユーザー判断

ユーザーに以下 4 案を提示:
1. ショートカット完全撤廃 (会話継続できるが TTFB 100 秒問題が再発する可能性)
2. クエリパラメータで切り替え (`continue_reasoning: true`)
3. 複数 execute_sql だけスキップ
4. ログを詳しく見てから決める

→ **「諦める」(現状維持)** を選択。

### 次セッションで再検討する場合のヒント

- Anthropic Sonnet 4.6 で本当に今も TTFB 100 秒問題が出るか **実測** してから判断する
- 出ないなら撤廃可。出るなら案 2 (フラグ切り替え) が落としどころ
- 関連: Claude prompt caching が効いている場合 (cacheRead > 0) は TTFB が改善している可能性
- 撤廃する場合の最小変更: `if (executeSqlSuccess && input.sqlAutoApprove) { ... return; }` の `return;` を `continue;` に変えてループを継続させる (ただし固定文の text event を流すかどうかは別途設計)

---

## ✅ 完了 (2026-05-18 セッション): Auto-fill が 0 を "-" にしてしまう問題を修正

### やったこと
[src/lib/advisor/reports/auto-fill.ts](../../src/lib/advisor/reports/auto-fill.ts) の system prompt の「ルール (厳守)」セクションを書き換え:

- **新ルール 6**: `query_metric` が `total=0` / `rows=[]` を返したら **「0」と書く** ("-" にしない)
- **新ルール 7**: `-` を残してよいのは「ツール実行が失敗した / 計測対象外」の場合のみ
- **新ルール 8**: 元の表の `-` を固定値扱いしない (再取得して 0 含む数値が取れたら必ず上書き)

### 背景 (前セッションでの誤判断を訂正)
前回「DB が 0 件だから "-" のままで正しい」と説明したが、これは間違い。ユーザーの仕様は:
- **取れた 0 は「0」と書く** (有用な事実)
- **`-` は計測対象外のときだけ** (`cta_register` のように LP に CTA ボタン自体が無いケースで、本当に取れない場合)

実際 LP5 では `lp_click_events` テーブルに `cta_register` / `register_*` の button_id が 0 件 (LP の HTML に該当ボタン無し) で、これは「**期間内 0 件**」が正しい答え。今後は auto-fill が「0」を表に書く。

### 検証で判明したこと (誤解しやすいので注記)
- `ADVISOR_DATA_DATABASE_URL` は本番 Supabase の READ ONLY 接続。
- ローカルで `npx tsx` から `queryMetricTool` を直接呼ぶと、`.env.local` が自動読込されず **ローカル Docker DB にフォールバック**してしまう。本番データで検証したいときは `dotenv` を明示 import すること:
  ```ts
  import { config } from 'dotenv'
  config({ path: '.env.local', override: true })
  // その後に動的 import で db.ts を読み込む
  const { queryMetricTool } = await import('...')
  ```

### Sonnet の挙動と auto-fill のロジックは完全一致
ユーザーが Sonnet に「LP_TO_REGISTER_CONV はどう計算する?」と聞いたら、`lp_click_events` + `button_id='cta_register' OR startsWith 'register_'` と説明 (これは [query-metric.ts:396-449](../../src/lib/advisor/tools/tastas-data/query-metric.ts#L396) と完全一致)。両者は同じツールを同じ args で叩いている。違いは「結果の表現」だけだった。

---

## 🔴 旧最優先タスク (2026-05-18 開始時): Auto-fill が "0 件 = "-"" で諦める問題を直す

### 問題のサマリ (誤解しないで読むこと)

**ユーザーが指摘していること**:
1. **「GA4 から取れるはずだ」** — レポートの LP5 表の「新規登録クリック数」等の空セルは、本番 DB に該当 button_id が無いだけで、**GA4 のイベントトラッキングには記録されている可能性が高い**。Auto-fill が query_metric で 0 件取れた後、**`query_ga4` にフォールバックしていない**のが本質的な問題。
2. **「通常チャット (Claude Sonnet) に依頼すべき」** — Auto-fill は Haiku 4.5 単発で動いているが、判断に迷うケースは通常チャット側 (Sonnet) のような賢いモデルにエスカレすべき、というユーザーの設計思想。
3. **「DB が 0 だから正しいはおかしい」** — 私 (前セッション) は「DB に 0 件だから "-" のままで正しい」と説明したが、これは間違い。**0 件かどうか以前に、他のデータソース (GA4) を試していない**ことが問題。

### 重要な事実の整理 (前セッションで見落とした) 

- `ADVISOR_DATA_DATABASE_URL` は**本番 Supabase の READ ONLY 接続**を指す。Advisor の `query_metric` は**ローカル Docker DB ではなく本番 DB**を読む。
- ローカル開発でも本番データが返るため、「ローカル DB が空だから」という説明は的外れ。
- 前回 v5 で表が埋まったのは**本番 DB に本物の LP5 5 月データがあったから**。今回の v6 で空セルが残ったのは「本番 DB の `lp_click_events` に LP5 の `cta_register`/`register_*` button_id 規約のレコードが無かった」だけ。GA4 ならクリック計測されている可能性が高い (TASTAS は GTM/GA4 イベント計測も並行で動かしている)。

### ログから読み取れる動作 (2026-05-18 セッションのリトライ)

```
[auto-fill:claude] query_metric LP_PV          ✅ 取得
[auto-fill:claude] query_metric LP_TO_LINE_CONV ✅ 取得 (一部日が rows に無い = 0 件)
[auto-fill:claude] query_metric LP_TO_REGISTER_CONV ✅ 取得 total=0 (本番 DB に該当 button_id 無し)
[auto-fill:claude] query_metric LP_REGISTRATIONS ✅ 取得
[auto-fill:claude] final text → 取れなかったセルは "-" のまま放置
```

**問題**: total=0 が返ってきた時点で Claude が諦めて、`query_ga4` を試さなかった。

### 期待する改良

**A. システムプロンプト改良 (auto-fill.ts)**

現状のプロンプトは「query_metric → query_ga4 にフォールバック」とは書いてあるが、**「query_metric が空応答 / total=0 を返した場合の具体的な対処」が弱い**。以下を明示:

```
## 0 件応答 (rows=[] / total=0) の扱い (重要)

query_metric が rows=[] や total=0 を返しても、**それは「DB に該当データが無い」だけで、
他のデータソースには存在する可能性がある**。次の手順で必ずフォールバックすること:

1. LP 系のボタンクリック / イベント系の指標が 0 だった
   → query_ga4(report_type='pageTraffic', page_path_prefix='/lp/<id>') を試す
   → GA4 のイベント計測 (gtag('event','click',...)) は DB と独立に記録されている可能性

2. それでも取れなければ「データなし」と注釈 (※ 1 行) を付けて表は元のまま

❌ いきなり "-" のまま諦めるのは禁止。最低 1 回は別ソースを試すこと。
```

**B. 5/15・5/16 のような末端日が "-" のまま残る問題**

本来は「LP_PV は 17/7 と取れているので、その日付の他の指標も並行に query_metric で取れているはず」。なのに Claude が「元の表の "-" を尊重する」と誤判断している。
プロンプトに以下を追加:

```
## 末端日が "-" のまま残る誤判断を防ぐ

元の表の "-" は「データが取れなかった」だけで、最新版で取得し直したらデータがあるかもしれない。
**取れたセルは必ず数値で埋め直すこと**。元の表の "-" を「固定値」として扱わない。
取れなかった場合のみ "-" を維持。
```

**C. GA4 への明示的なフォールバック**

system prompt の「表ヘッダのよくある列名と対応 metric」テーブルに以下を追加:

```
| 列名 | 第一候補 (query_metric) | 第二候補 (query_ga4) |
|---|---|---|
| LINE登録クリック数 | LP_TO_LINE_CONV | query_ga4(pageTraffic, page_path_prefix="/lp/N") + event_name='line_register' |
| 新規登録クリック数 | LP_TO_REGISTER_CONV | query_ga4(pageTraffic) + event_name='register' / 'cta_register' |
| 各 LP イベント | LP_EVENTS | query_ga4(pageTraffic) のイベント計測 |
```

ただし `query_ga4` の現状実装は event_name フィルタを直接サポートしてない可能性あり (要確認: `src/lib/ga-client.ts` / `query-ga4.ts`)。
**もしサポートしてないなら、query_ga4 を event 取得可能なように拡張する必要がある** (この場合作業が大きくなるため、ユーザーに「GA4 イベント取得機能の追加」是非を確認すること)。

**D. 通常チャットへのエスカレ (オプション)**

ユーザーは「Sonnet 通常チャットに相談する」案を提案している。実装案:
- Auto-fill の Haiku が **N 回フォールバックしても取れなかった**場合、Claude Sonnet (= 通常チャットと同じモデル) を 1 回呼び出して判断を委ねる
- Sonnet は execute_sql も含む全ツールを使えるので、ボタン名規約のずれなどを動的に解決できる

ただし**コスト的に重い**ので「最初は Haiku で試す → 不足分だけ Sonnet」の段階的設計が良い。

### 着手前に確認すべきこと

1. **`query_ga4` が現状でイベント別取得をサポートしているか** (`src/lib/advisor/tools/external/query-ga4.ts` / `src/lib/ga-client.ts` を読む)
2. **本番 GA4 で LP5 の登録ボタンクリックがイベントとして記録されているか** (GA4 Explorer で確認はユーザー側作業)
3. **TASTAS の LP に gtag による click イベント送信があるか** (`grep -r "gtag.*event" app/` で確認)

### 補足: 直前セッションで間違って言ったこと (訂正)

私 (前々セッション末尾) は「**5/15・5/16 が "-" なのは GA4 集計の遅延仕様**」と説明したが、これも誤り。
**真因は「LP_PV は取れたのに同じ日の LP_TO_LINE_CONV が rows に含まれず、Claude が "-" を維持した」というプロンプト解釈の問題**。GA4 関係ない。混乱を招いて申し訳ない。

---

## ✅ 完了: METRIC_CATALOG 完全網羅 (2026-05-17 後続セッション)

**実装結果**: B 群 40 + D 群 10 = **新規 50 個追加完了**。
CATALOG 規模: 48 → **92 個** (available 89 + future 3)。
全 89 metric を直近 90 日で smoke test → **89/89 成功** (`scripts/smoke-test-metrics.ts`)。
`npm run build` パス。`scripts/check-metrics-consistency.ts` パス。

### 追加した metric の内訳
- 応募派生 (8): APPLICATION_CLICK_UU / APPLICATION_DAYS / APPLICATION_CONVERSION_RATE / APPLICATIONS_PER_WORKER / AVG_APPLICATION_DAYS / AVG_APPLICATION_MATCHING_HOURS / AVG_REGISTRATION_TO_APPLICATION_DAYS / AVG_JOB_MATCHING_HOURS
- 登録→認証 (1): AVG_REGISTRATION_TO_VERIFY_HOURS
- 求人詳細 (6): JOB_DETAIL_PV / JOB_DETAIL_USERS / JOB_DETAIL_APPLICATION_COUNT / JOB_DETAIL_APPLICATION_USERS / JOB_DETAIL_APPLICATION_RATE / JOB_DETAIL_AVG_APPLICATION_DAYS
- Funnel拡張 (2): FUNNEL_JOB_VIEWED_PV / FUNNEL_SEARCH_PV
- 求人構造 (5): PARENT_JOB_COUNT / PARENT_JOB_INTERVIEW_COUNT / PARENT_JOBS_PER_FACILITY / CHILD_JOB_INTERVIEW_COUNT / CHILD_JOBS_PER_FACILITY
- 単位指標 (4): MATCHINGS_PER_WORKER / MATCHINGS_PER_FACILITY / REVIEWS_PER_WORKER / REVIEWS_PER_FACILITY
- LP帰属 (5): PARENT_JOB_PV / PARENT_JOB_SESSIONS / LP_APPLICATION_COUNT / LP_JOB_DETAIL_PV / LP_AVG_DWELL_TIME
- 限定/離脱/低評価 (3): LIMITED_JOB_APPLICATION_RATE / CONSECUTIVE_LOW_RATING_WORKER_COUNT / WORKER_DROPOUT_RATE
- Attendance (3): ATTENDANCE_CHECK_RATE / ATTENDANCE_COMPLETION_RATE / EARLY_CHECKOUT_RATE
- Bookmark/Message/Review分布 (4): BOOKMARK_REMOVAL_RATE (常0) / MESSAGE_RESPONSE_TIME_AVG / FACILITY_RATING_DISTRIBUTION / WORKER_RATING_DISTRIBUTION
- Repeat/LaborDoc (3): REPEAT_WORKER_RATE / AVG_ATTENDANCE_HOURLY_WAGE / LABOR_DOC_SUBMISSION_RATE

### 変更ファイル
- `src/lib/advisor/tools/tastas-data/metrics-catalog.ts` — 50 個のエントリ追加
- `src/lib/advisor/tools/tastas-data/query-metric.ts` — 50 個の switch case 追加
- `scripts/smoke-test-metrics.ts` — 全件 smoke test (新規)
- `docs/system-advisor/tools-spec.md` — METRIC_CATALOG 一覧を 89 個に更新
- `src/lib/advisor/reports/auto-fill.ts` — 表ヘッダ⇔metric の対応ヒント追加

### 注意点 (次セッション向け)
- `BOOKMARK_REMOVAL_RATE`: Bookmark を物理削除する設計のため解除イベント追跡不可、常 0 を返す参考指標 (catalog の description に明記済)
- `CONSECUTIVE_LOW_RATING_WORKER_COUNT`: 期間内レビューのうち各ユーザー直近 3 件すべて rating <= 2 のユーザー数
- `WORKER_DROPOUT_RATE`: 期間内登録で「応募 0 件」のユーザー比率 (analytics-actions.ts の -1 スタブとは異なる新ロジック)
- `MESSAGE_RESPONSE_TIME_AVG`: thread_id 優先 / 旧形式は application_id でグループ化
- `AVG_ATTENDANCE_HOURLY_WAGE`: actual_break_time は分単位 (時間換算済)

---

## 📋 旧タスク (参考、上記で達成済): METRIC_CATALOG 完全網羅

**背景**: 2026-05-17 セッションで CATALOG を 12 → 48 個 (うち available 45 個) に拡張したが、UI 側 (`app/system-admin/analytics/tabs/MetricDefinitions.tsx`) は **76 個** ある。差分の **40 個が未実装**。
さらに DB スキーマから取れるのに UI にも CATALOG にも無い指標が **10 個** ある (Attendance / Bookmark / Repeat 率など)。

**目的 (ユーザー意思確認済 2026-05-17)**: 「メトリクスを完璧に網羅」=
**B 群 40 個 + D 群 10 個 = 合計 50 個すべてを CATALOG に追加してフル網羅する**。
時間切れ時の優先順位は安全弁であって最終ゴールではない。最終ゴールは「全部入る」。

**規模感**:
- B 群 (UI → CATALOG 移植): 40 個 / 推定 7〜11 時間
- D 群 (DB → CATALOG 新規): 10 個 / 推定 3〜4 時間
- ドキュメント同期 (tools-spec.md など): 30 分
- **完了状態の CATALOG 規模**: available 95 個 + future 3 個 = 約 98 個

### B 群 (UI にあるが CATALOG にない 40 個、追加実装候補)

| UI key | 推奨 CATALOG key | 計算ロジック位置 |
|---|---|---|
| applicationClickUU | `APPLICATION_CLICK_UU` | `app/api/funnel-analytics/route.ts:140-148` |
| applicationDays | `APPLICATION_DAYS` | `src/lib/analytics-actions.ts` (= applicationCount と同値) |
| applicationRate | `APPLICATION_CONVERSION_RATE` | `app/api/job-analytics/route.ts` |
| applicationsPerWorker | `APPLICATIONS_PER_WORKER` | `src/lib/analytics-actions.ts:74` |
| avgApplicationDays | `AVG_APPLICATION_DAYS` | `src/lib/analytics-actions.ts:57-59` |
| avgApplicationMatchingPeriod | `AVG_APPLICATION_MATCHING_HOURS` | `src/lib/analytics-actions.ts` |
| avgDaysToApplication | `AVG_REGISTRATION_TO_APPLICATION_DAYS` | `src/lib/analytics-actions.ts` |
| avgJobMatchingPeriod | `AVG_JOB_MATCHING_HOURS` | `src/lib/analytics-actions.ts` |
| avgRegistrationToVerifyHours | `AVG_REGISTRATION_TO_VERIFY_HOURS` | `app/api/funnel-analytics/route.ts:163-170` |
| jobAnalyticsTotalPV | `JOB_DETAIL_PV` | `app/api/job-analytics/route.ts:46` |
| jobAnalyticsTotalUsers | `JOB_DETAIL_USERS` | `app/api/job-analytics/route.ts:47` |
| jobAnalyticsApplicationCount | `JOB_DETAIL_APPLICATION_COUNT` | `app/api/job-analytics/route.ts:55` |
| jobAnalyticsApplicationRate | `JOB_DETAIL_APPLICATION_RATE` | `app/api/job-analytics/route.ts` |
| jobAnalyticsApplicationUserCount | `JOB_DETAIL_APPLICATION_USERS` | `app/api/job-analytics/route.ts:56` |
| jobAnalyticsAvgApplicationDays | `JOB_DETAIL_AVG_APPLICATION_DAYS` | `app/api/job-analytics/route.ts:57-59` |
| jobViewedPV | `FUNNEL_JOB_VIEWED_PV` | `app/api/funnel-analytics/route.ts:115-123` |
| searchPV | `FUNNEL_SEARCH_PV` | `app/api/funnel-analytics/route.ts:104-111` |
| parentJobCount | `PARENT_JOB_COUNT` | `src/lib/analytics-actions.ts` (status=PUBLISHED) |
| parentJobInterviewCount | `PARENT_JOB_INTERVIEW_COUNT` | `src/lib/analytics-actions.ts` (requires_interview=true) |
| parentJobsPerFacility | `PARENT_JOBS_PER_FACILITY` | `src/lib/analytics-actions.ts:77` |
| parentJobPV | `PARENT_JOB_PV` | `app/api/lp-tracking/route.ts:376-417` (LP帰属) |
| parentJobSessions | `PARENT_JOB_SESSIONS` | 同上 |
| childJobInterviewCount | `CHILD_JOB_INTERVIEW_COUNT` | `src/lib/analytics-actions.ts:62` |
| childJobsPerFacility | `CHILD_JOBS_PER_FACILITY` | `src/lib/analytics-actions.ts:78` |
| matchingsPerWorker | `MATCHINGS_PER_WORKER` | `src/lib/analytics-actions.ts:75` |
| matchingsPerFacility | `MATCHINGS_PER_FACILITY` | `src/lib/analytics-actions.ts:80` |
| reviewsPerWorker | `REVIEWS_PER_WORKER` | `src/lib/analytics-actions.ts:76` |
| reviewsPerFacility | `REVIEWS_PER_FACILITY` | `src/lib/analytics-actions.ts:80` |
| lpApplicationCount | `LP_APPLICATION_COUNT` | `app/api/lp-tracking/route.ts:419-460` (LP帰属応募) |
| lpJobDetailPV | `LP_JOB_DETAIL_PV` | `app/api/lp-tracking/route.ts:376-417` |
| lpAvgDwellTime | `LP_AVG_DWELL_TIME` | `app/api/lp-tracking/route.ts` (lp_engagement_summaries) |
| limitedJobApplicationRate | `LIMITED_JOB_APPLICATION_RATE` | `src/lib/analytics-actions.ts:87` |
| consecutiveLowRatingCount | `CONSECUTIVE_LOW_RATING_WORKER_COUNT` | `src/lib/analytics-actions.ts` |
| dropoutRate | `WORKER_DROPOUT_RATE` | `src/lib/analytics-actions.ts:46` (現状 -1 を返す未実装スタブ。要新規実装) |

**(設定値の閾値、CATALOG 化不要)**: `avgRatingThreshold` `cancelRateThreshold` は集計値ではなく管理者設定値。CATALOG に入れず Admin Settings として扱う。

**(重複)**: `applicationCount` / `applicationTotal` / `registrationRate` は既存の `NEW_APPLICATIONS` / `LP_REGISTRATION_RATE` で代替可能 (新規不要)。

### D 群 (DB から追加で取れる、UI にも未実装の指標 10 個)

| 推奨 CATALOG key | 説明 | 元テーブル / カラム | 優先度 |
|---|---|---|---|
| `ATTENDANCE_CHECK_RATE` | 出勤確認率 (実勤務 / 確定応募) | Attendance / Application | 高 |
| `ATTENDANCE_COMPLETION_RATE` | 勤務完了率 (status='WORKED') | Attendance.status | 高 |
| `EARLY_CHECKOUT_RATE` | 早期退勤率 | Attendance.checkout_at | 中 |
| `BOOKMARK_REMOVAL_RATE` | お気に入り解除率 | Bookmark | 低 |
| `MESSAGE_RESPONSE_TIME_AVG` | メッセージ平均応答時間 | Message | 中 |
| `FACILITY_RATING_DISTRIBUTION` | 施設評価分布 (1〜5 点別件数) | Review.rating | 中 |
| `WORKER_RATING_DISTRIBUTION` | ワーカー評価分布 | Review.rating | 中 |
| `REPEAT_WORKER_RATE` | リピートワーカー率 (2 回以上マッチ) | Application | 高 |
| `AVG_ATTENDANCE_HOURLY_WAGE` | 実績時給平均 | LaborDocument | 中 |
| `LABOR_DOC_SUBMISSION_RATE` | 勤務報告書提出率 | LaborDocument / Application | 中 |

### 実装手順 (次セッション用)

1. `src/lib/advisor/tools/tastas-data/metrics-catalog.ts` に B 群 30+ + D 群 10 個のエントリ追加
2. `src/lib/advisor/tools/tastas-data/query-metric.ts` の switch に case 追加
   - **既存ロジック流用**: `src/lib/analytics-actions.ts` の関数を直接呼ぶか、同等の Prisma クエリを書き写す
   - **新規実装**: D 群はゼロから書く
3. smoke test: `scripts/` に一括テストを作って 50+ 全 metric を直近 90 日で叩いて 0 fail を確認
4. ドキュメント同期: `tools-spec.md` の METRIC_CATALOG 一覧を更新
5. auto-fill のヒント表 (auto-fill.ts の system prompt) も対応列名を追記

### 補足: 緊急時の安全弁 (フォールバック、最終ゴールではない)

**⚠️ 最終ゴールは B 群 40 個 + D 群 10 個 全部の実装。下記は「セッションが切れそうな時にここまで進めれば致命傷ではない」というセーフティライン**。

1. JOB_DETAIL_PV / JOB_DETAIL_USERS / JOB_DETAIL_APPLICATION_COUNT (求人詳細系 3 個)
2. APPLICATIONS_PER_WORKER / MATCHINGS_PER_WORKER (生産性 2 個)
3. PARENT_JOB_COUNT / PARENT_JOB_INTERVIEW_COUNT / CHILD_JOB_INTERVIEW_COUNT (求人構造 3 個)
4. AVG_REGISTRATION_TO_APPLICATION_DAYS / AVG_REGISTRATION_TO_VERIFY_HOURS (時間メトリクス 2 個)
5. LP_APPLICATION_COUNT / LP_JOB_DETAIL_PV (LP帰属 2 個)
6. REPEAT_WORKER_RATE / ATTENDANCE_COMPLETION_RATE / LABOR_DOC_SUBMISSION_RATE (D 群高優先 3 個)

ここで止まった場合でも、残り **35 個** を引き継いで次々セッションで完了させる。それまで「メトリクス網羅完了」とは呼ばない。

---

## 🚨 PR 作成時にユーザーがシステム管理者へ依頼する事項 (絶対忘れない)

**ブランチ `feature/advisor-sql-tool` の PR をユーザーが切る直前に、以下を `DEPLOY_CHECKLIST.md` ベースで「システム管理者への依頼書」として添付する**。Claude Code が自動で本番 DB / Vercel env を触ることは禁止 (CLAUDE.md ルール) なので、必ず人間が手作業で実施する必要がある。

### A. ステージング / 本番 DB スキーマ反映 (システム管理者作業)
新規テーブル 2 個を追加する `npx prisma db push` をユーザーが手動で実行:
- `advisor_chat_tables` (T-XXX 表データ、共有 URL)
- `advisor_sql_audit_logs` (execute_sql 監査ログ)

事前に dry-run (`prisma migrate diff`) で `CREATE TABLE` 2 個だけが出ることを確認。`DROP/ALTER` が混じってたら即中止 → Claude に相談。

### B. Vercel 環境変数の追加・更新 (システム管理者作業 / Vercel ダッシュボード手動)

**新規追加が必要なもの**:
| 変数 | 値 | 環境 |
|---|---|---|
| `ADVISOR_AUTO_FILL_ENABLED` | `true` | Preview + Production |
| `ADVISOR_AUTO_FILL_DEBUG` | `false` (本番) / `true` (Preview) | Preview + Production |

**値の更新が必要なもの**:
| 変数 | 新しい値 | 理由 |
|---|---|---|
| `SEARCH_CONSOLE_SITE_URL` | `sc-domain:tastas.work` | URL プレフィックス版より過去データが豊富 (2026-05-17 検証済) |

**確認だけで OK (既存と同じ)**:
- `GA_CREDENTIALS_JSON` (本番に既設定の想定、GA4 サービスアカウント JSON 全文)
- `GA4_PROPERTY_ID` (既存値: 522574288)
- `ANTHROPIC_API_KEY` (auto-fill が Claude Haiku 4.5 を呼ぶので必須、既存キーで OK)

### C. ✅ 新規発行・取得は一切不要

- 新しい API キーの発行依頼なし
- 新しい OAuth 認証なし
- 新しい第三者サービスの契約なし
- サービスアカウント / DNS レコード / DB ロール の新規作成なし

→ **既存の環境変数の追加 (値は固定) と値更新のみで足りる**。

### D. PR 本文に貼る雛形 (システム管理者宛)

```markdown
## システム管理者への作業依頼 (マージ前 / 直後)

このブランチには System Advisor の以下機能が含まれます:
- execute_sql / get_table / add_tables_to_report の新規ツール
- 表 T-XXX 採番 + 共有 URL (`/advisor/t/[token]`)
- レポート自動補完 (Claude Haiku 4.5)
- METRIC_CATALOG 拡張 (12 → 27 個)

### 1. DB スキーマ反映 (ステージング → 本番)
```bash
# 事前に dry-run で CREATE TABLE 2 個だけが出ることを確認
DATABASE_URL=<対象環境> npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-url "$DATABASE_URL" --script

# 確認後に本コマンド
DATABASE_URL=<対象環境> DIRECT_URL=<対象環境> npx prisma db push
```

### 2. Vercel 環境変数 (ダッシュボードから手動)
- 追加: `ADVISOR_AUTO_FILL_ENABLED=true`
- 追加: `ADVISOR_AUTO_FILL_DEBUG=false`
- 更新: `SEARCH_CONSOLE_SITE_URL=sc-domain:tastas.work`
- 既存確認: `GA_CREDENTIALS_JSON` / `GA4_PROPERTY_ID` / `ANTHROPIC_API_KEY`

### 3. 反映後の Redeploy
Vercel ダッシュボード → Deployments → Redeploy
```

詳細手順は `docs/system-advisor/DEPLOY_CHECKLIST.md` の §1-1 / §1-2 / §2 を参照。

---

## 0. まず読むべき順序

1. **このファイル** (NEXT_SESSION.md) — 全体の方向性を把握、🚨 PR 時依頼物を確認
2. **[HANDOFF_2026-05-16.md](./HANDOFF_2026-05-16.md)** — 直近 2 セッション (2026-05-16 / 17) の作業ログ、特に「追記: 2026-05-17 セッション」末尾節
3. [HANDOFF.md](./HANDOFF.md) — 中期セッションログ
4. [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md) — デプロイ時の詳細手順
5. [tools-spec.md](./tools-spec.md) / [data-model.md](./data-model.md) / [architecture.md](./architecture.md) — 2026-05-17 同期済みの正本
6. [KNOWLEDGE.md](./KNOWLEDGE.md) — 累積した設計知見
7. [FEATURE_ADDITION_CHECKLIST.md](./FEATURE_ADDITION_CHECKLIST.md) — 新機能追加時の SoT 反映漏れ防止チェックリスト
8. ユーザーから現在の意図を聞く

---

## 1. 直近の状況 (2026-05-06 時点)

System Advisor は **ローカル動作確認済み + ステージング展開準備完了 + hub-platform 連携継続中**。

### 主要マイルストーン

| 項目 | 状態 |
|---|---|
| TASTAS Advisor 機能 | ローカル安定動作 |
| Antigravity 監査 (1 次, 2 次) | 完了、本物バグはすべて修正 |
| hub-platform 移送パッケージ | 完成 (`docs/system-advisor/handoff-bundle/`、122 ファイル / 1.3MB)、ユーザー手動で hub-platform/scratch にコピー済 |
| hub-platform 側機械変換 + バグ報告 | 1 次 8 件 + 2 次 11 件 受領済、TASTAS 側で該当バグ全修正 |
| ステージング展開 | 未 (DEPLOY_CHECKLIST.md / STAGING_DEPLOY_REQUEST.md は最新) |
| 本番展開 | 未 |

### 2026-05-06 セッションで完了したもの

#### バグ修正 (4 件)
- バグ 1+3: status='generating' 張り付き / `[object Object]` エラー → `generate.ts` を全体 try/catch でラップ + Error クラスでラップ
- バグ 4: Markdown table 表崩れ → `normalizeMarkdown` 共通ヘルパー新設、4 ファイルで使用
- バグ 9: GitHub repo env silent fail → default 値 + anonymous fallback、`getGithubAccessLevel()` 公開
- バグ 10: `process.env.X!` non-null 強制 → 削除 + null チェック

#### 機能追加 (3 件採用)
- 機能 8: [FEATURE_ADDITION_CHECKLIST.md](./FEATURE_ADDITION_CHECKLIST.md) (13 章、新機能追加時の SoT 反映漏れ防止)
- 機能 1: 将来 TODO に追記 (本ファイル §7.1)
- **機能 3: semantic_memory cron** ← 大型機能
  - 新規スキーマ `AdvisorSemanticMemory`
  - `app/api/cron/advisor-semantic-ingest/route.ts` 毎日 04:30 JST
  - dynamic system prompt にしおり付き最新 5 件のレポート要約を埋め込み
  - 「先月のレポートで言ってた○○」のような文脈依存質問に LLM が答えられる

#### ドキュメント
- STAGING_DEPLOY_REQUEST.md 全体最新化 (テーブル数 11、cron 3 種、トラブルシューティング追加)
- handoff-bundle/ 完成 (hub-platform 側へ手動コピー済)
- FEATURE_ADDITION_CHECKLIST.md 新規作成

---

## 2. 未解決事項

### 2.1 🔴 Anthropic API キー同期問題 (要ユーザー手動対応)

**症状**: hub-platform 側で `401 invalid x-api-key` エラー
**真因**: TASTAS と hub-platform でキーが完全に別物
- TASTAS (動作中): len:108 head:`sk-ant-api03-y` tail:`dobwAA`
- hub-platform (401): len:108 head:`sk-ant-api03-v` tail:`_29AAA`

**ユーザー側のアクション**:
TASTAS の現役キーを hub-platform の `.env.local` および本番 Vercel env に手動同期。
詳細手順は hub-platform 側 LLM が提示済 (`read -s` で安全投入)。

**運用課題**:
キー共有 (§15「A. 共有継続」) には自動同期メカニズムなし。
今後 TASTAS 側でローテートしたら、hub-platform 側も手動で更新する運用が必須。

### 2.2 🟡 ステージング / 本番展開 (未着手)

[DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md) のチェックリスト未消化。
[STAGING_DEPLOY_REQUEST.md](./STAGING_DEPLOY_REQUEST.md) はシステム責任者向けに完成しているので、ユーザーが Go サインを出せば即着手可能。

**新規追加要素** (前回展開時から):
- DB テーブル `advisor_semantic_memory` 追加 (11 個目)
- Vercel cron `advisor-semantic-ingest` 追加 (毎日 04:30 JST)
- (環境変数の追加は無し)

### 2.3 🟡 Phase 3 着手判断 (hub-platform 統合)

[HUB_PLATFORM_MIGRATION_TODO.md](./HUB_PLATFORM_MIGRATION_TODO.md) の Phase 3 開始 Go サインフロー:
```
ステージング展開 → 2 週間運用 → 本番展開 → 2 週間運用 → 「Phase 3 開始」明示
```

→ 今は **handoff-bundle で「相談材料」を渡した段階**。hub-platform 側 LLM が `INTEGRATION_QUESTIONS.md` に回答するのを待つ + ステージング / 本番運用待ち。

---

## 3. 次セッションでやることの選択肢

ユーザーが優先度を決める。

### 🎯 オプション A: ステージング展開を進める (推奨)

[STAGING_DEPLOY_REQUEST.md](./STAGING_DEPLOY_REQUEST.md) はシステム責任者向けに最新化済み。
Anthropic キー同期問題が解決したら、Go サインで即着手可能。

DB スキーマには `advisor_semantic_memory` 追加が含まれるので、システム責任者の dry-run で
「11 個の CREATE TABLE + 4 個の CREATE INDEX」が想定通りであることを確認してもらう。

### 🎯 オプション B: hub-platform 側 LLM の回答が来たら統合方針議論

`hub-platform/scratch/advisor-import-2026-05-04/INTEGRATION_QUESTIONS.md` に
hub-platform 側 LLM が回答を書く想定。
回答を見て統合方針 (案 a: advisor-core 抽出 / 案 b: agent-hub 統合 / 案 c: MCP 化) を決定。

### 🎯 オプション C: ユーザー指摘の追加バグ / 機能追加に対応

運用中に発見される問題、ユーザーから別途 hub-platform 側経由で報告される問題、等。

### 🎯 オプション D: 残タスクの消化

- TASTAS 側で `architecture.md` / `tools-spec.md` / `data-model.md` の 2026-05-06 変更分の再反映 (handoff-bundle/docs/ は別途 build スクリプトで再生成可能だが、TASTAS 側 docs はまだ反映していない可能性あり要確認)
- `security-cost.md` / `system-prompt.md` の最新化

---

## 4. 新セッション開始時のおすすめ会話

```
HANDOFF.md (2026-05-06 節) / KNOWLEDGE.md / FEATURE_ADDITION_CHECKLIST.md を読みました。

【現状】
- バグ 1, 3, 4, 9, 10 修正済み
- 機能 3 (semantic_memory cron) + 機能 8 (チェックリスト) 実装済み
- 機能 1 (Gemini Tool Use) は将来 TODO
- handoff-bundle で hub-platform 側 LLM に相談材料を渡した
- ステージング展開は未着手 (システム責任者依頼資料は最新)

【未解決】
- Anthropic キー同期問題 (ユーザー手動対応待ち)
- ステージング展開
- hub-platform 側 LLM の回答待ち

【次のオプション】
  A. ステージング展開を進める (推奨、キー問題解決後)
  B. hub-platform 側 LLM の回答受領 → 統合方針議論
  C. ユーザー指摘の追加対応
  D. 残タスク消化 (architecture.md / tools-spec.md / data-model.md の再反映)

どれから進めますか?
```

---

## 5. 触ってはいけないもの

- TASTAS Advisor 本体は **動作中**。次の修正前に必ずユーザーに確認
- hub-platform (`/Users/kawashimaichirou/Desktop/バイブコーディング/hub-platform`) は **触らない** (Phase 3 着手前 + Claude Code は別リポジトリを直接編集しない方針)
- 本番 / ステージング DB / Vercel 環境変数 (CLAUDE.md の禁止事項を厳守)
- Anthropic API キーの**実値**は読み出さない (指紋テスト = length + head + tail のみで照合する手法を確立済、本ファイル §7.2 参照)

---

## 6. 重要な設計判断 (引き継ぎ済み)

詳細は [KNOWLEDGE.md](./KNOWLEDGE.md) と [handoff-bundle/knowledge/DESIGN_DECISIONS.md](./handoff-bundle/knowledge/DESIGN_DECISIONS.md) 参照。

本セッションで追加された設計判断:

- **指紋テストでキー同期確認**: 実値露出ゼロで秘密値の同一性判定 (length + head 14 + tail 6)
- **Prisma upsert は構造的に安全**: `update: {}` に空オブジェクト + 条件 spread が正しい部分更新。Supabase の `.upsert()` API とは別物 (機械変換注意)
- **JST 境界処理は SQL 化しない**: 数値ズレ事故リスク > パフォーマンス改善効果。take=100k OOM ガードのみで対処
- **handoff-bundle のような物理パッケージは LLM 越境連携で有効**: 再生成スクリプトで陳腐化防止
- **semantic memory は最新 5 件・8000 字 truncate**: token 量制御 + LLM が文脈で参照できる粒度

---

## 7. 将来 TODO (Future Backlog)

機能候補や改善案で、現時点では着手しない / 保留したものを記録する。
着手する時はユーザーが指示する。

### 7.1 Gemini Tool Use 対応 (Anthropic コスト削減)

**提案元**: hub-platform 側 Project Agent (`docs/TASTAS_BUG_REPORT_2026_05_05.md` 機能 1)

**何が嬉しいか**:
- Anthropic Sonnet 4.6 と同じ Tool Use 機能を **Gemini 2.5 Flash で実現** = 約 1/10 のコスト
- 雑談 / 要約 / 添付分析だけでなく、 **DB 参照を伴う質問でも Gemini で完結**できる

**保留理由 (2026-05-06 ユーザー判断)**:
- TASTAS では Anthropic は「一般チャット」のみで、レポート系 (重い処理) は既に Gemini バイパス済み
- Anthropic 使用量がそもそも少ないので、コスト削減効果が**限定的**
- 月コストが今後増えてきたら再検討

**実装ヒント** (将来着手時):
- `models.ts` に Gemini モデル追加 (`provider: 'gemini'`)
- `tools/gemini-adapter.ts` で Anthropic ↔ Gemini 型変換 (`parametersJsonSchema` フィールドが Anthropic JSON Schema をそのまま受け取る)
- `gemini-chat.ts` で Function Calling ループ (Anthropic と同様 `MAX_TOOL_LOOPS` で制御)
- `orchestrator.ts` で `provider==='gemini'` 早期分岐
- 工数: 1〜2 日
- 詳細: `/Users/kawashimaichirou/Desktop/バイブコーディング/hub-platform/docs/TASTAS_BUG_REPORT_2026_05_05.md` 機能 1
- 参考実装: hub-platform commit `9bd4851` (`feat(advisor): Gemini Tool Use 対応 (Function Calling ループ)`)

**着手の trigger**:
- Anthropic API の月使用額が $200+ になったら
- または Gemini モデルが Sonnet 4.6 と同等以上の品質と確認できたら

### 7.2 指紋テスト手法 (秘密値同一性判定)

**用途**: API キー / トークン / シークレットの同一性を、**実値を一切露出させずに**比較する手法。

**実行例**:
```bash
grep "^ANTHROPIC_API_KEY=" .env.local | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\n' | \
  awk '{print "len:" length($0), "head:" substr($0,1,14), "tail:" substr($0, length($0)-5)}'
```

**出力例**: `len:108 head:sk-ant-api03-y tail:dobwAA`

length / head / tail の 3 要素が完全一致 = ほぼ同一値。
2026-05-06 セッションで TASTAS と hub-platform のキー食い違いを判定するのに使用。

### 7.3 共有 vault (1Password / Vercel team env) 導入検討

TASTAS と hub-platform の Anthropic キー共有運用 (§15 A 案) には自動同期メカニズム無し。
将来的に共有 vault 導入で「TASTAS 側でローテートしたら hub-platform 側も自動追従」できるようにする。

**選択肢**:
- 1Password Connect (組織共有 vault + dotenv 連携)
- Vercel チーム共有 environment variables (両プロジェクトで同じスコープ参照)
- AWS Secrets Manager 等の専用 vault

着手 trigger: 次回キー食い違い事故が起きたとき / SaaS 化が進んでテナント数が増えたとき

### 7.4 ステージング 2 週間運用後の Phase 3 着手判断

[HUB_PLATFORM_MIGRATION_TODO.md](./HUB_PLATFORM_MIGRATION_TODO.md) の Go サインフロー通り、
ステージング → 本番 → 2 週間ずつ運用してエラー率 < 1% を確認後、
ユーザーが Phase 3 (advisor-core 抽出) 開始を明示するまで動かない。

それまでは hub-platform 側 LLM が `INTEGRATION_QUESTIONS.md` に回答するのを待つ。

---

## 8. ユーザーの最後の言葉

> ちなみに、セッションが終わりそうです。次のセッションへの引き継ぎ資料をアップデートして、次セッションへのメッセージをつくってください

→ 本ファイルがその応答。
HANDOFF.md に 2026-05-06 セッションログを追加 + NEXT_SESSION.md を全面最新化。

次セッションは Anthropic キー同期解決 → ステージング展開、または hub-platform 側回答待ちの議論から始められる。
