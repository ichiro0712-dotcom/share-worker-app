import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const notificationSettings = [
    // ワーカー向け
    {
        notification_key: 'WORKER_MATCHED',
        name: 'マッチング成立',
        description: '応募が承認され、マッチングが成立した時に送信',
        target_type: 'WORKER',
        chat_enabled: true,
        email_enabled: true,
        push_enabled: true,
        chat_message: `{{worker_name}}さん、マッチングが成立しました！

勤務先: {{facility_name}}
日時: {{work_date}} {{start_time}}〜{{end_time}}
報酬: {{wage}}円

▼ 勤務詳細・労働条件通知書はこちら
{{my_job_url}}

※労働条件通知書は労働基準法第15条に基づき、労働条件を明示するものです。

当日はよろしくお願いいたします。`,
        email_subject: '【+TASTAS】マッチング成立のお知らせ',
        email_body: `{{worker_name}}様

お仕事のマッチングが成立しました。

━━━━━━━━━━━━━━━━━━━━━━
■ 勤務詳細
━━━━━━━━━━━━━━━━━━━━━━
勤務先: {{facility_name}}
日時: {{work_date}} {{start_time}}〜{{end_time}}
報酬: {{wage}}円

▼ 勤務詳細・労働条件通知書はこちら
{{my_job_url}}

──────────────────────────
+TASTAS 運営
──────────────────────────`,
        push_title: 'マッチング成立',
        push_body: '{{facility_name}}の勤務が確定しました',
    },
    {
        notification_key: 'WORKER_INTERVIEW_ACCEPTED',
        name: '面接あり求人：採用決定',
        description: '面接後に採用が決定した時に送信',
        target_type: 'WORKER',
        chat_enabled: true,
        email_enabled: true,
        push_enabled: true,
        chat_message: `{{worker_name}}さん、採用が決定しました！

勤務先: {{facility_name}}
日時: {{work_date}} {{start_time}}〜{{end_time}}

▼ 勤務詳細・労働条件通知書はこちら
{{my_job_url}}

※労働条件通知書は労働基準法第15条に基づき、労働条件を明示するものです。

当日はよろしくお願いいたします。`,
        email_subject: '【+TASTAS】採用決定のお知らせ',
        email_body: `{{worker_name}}様

{{facility_name}}への応募が承認され、採用が決定しました。

━━━━━━━━━━━━━━━━━━━━━━
■ 勤務詳細
━━━━━━━━━━━━━━━━━━━━━━
勤務先: {{facility_name}}
日時: {{work_date}} {{start_time}}〜{{end_time}}
報酬: {{wage}}円

▼ 勤務詳細・労働条件通知書はこちら
{{my_job_url}}

──────────────────────────
+TASTAS 運営
──────────────────────────`,
        push_title: '採用決定',
        push_body: '{{facility_name}}への応募が承認されました',
    },
    {
        notification_key: 'WORKER_INTERVIEW_REJECTED',
        name: '面接あり求人：不採用',
        description: '面接後に不採用となった時に送信',
        target_type: 'WORKER',
        chat_enabled: true,
        email_enabled: true,
        push_enabled: false,
        chat_message: `{{worker_name}}さん、この度は{{facility_name}}へのご応募ありがとうございました。

選考の結果、今回はご縁がありませんでした。
また別の求人でお会いできることを楽しみにしております。`,
        email_subject: '【+TASTAS】選考結果のお知らせ',
        email_body: `{{worker_name}}様

この度は{{facility_name}}へのご応募ありがとうございました。

選考の結果、今回はご縁がありませんでした。
また別の求人でお会いできることを楽しみにしております。

引き続き+TASTASをよろしくお願いいたします。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
        push_title: null,
        push_body: null,
    },
    {
        notification_key: 'WORKER_CANCELLED_BY_FACILITY',
        name: '施設からのキャンセル',
        description: '施設が予約をキャンセルした時に送信',
        target_type: 'WORKER',
        chat_enabled: true,
        email_enabled: true,
        push_enabled: true,
        chat_message: `{{worker_name}}さん、残念なお知らせです。

{{facility_name}}の{{work_date}}の勤務がキャンセルされました。

ご不便をおかけして申し訳ございません。
他の求人をお探しください。`,
        email_subject: '【+TASTAS】勤務キャンセルのお知らせ',
        email_body: `{{worker_name}}様

ご予約いただいていた勤務がキャンセルされました。

━━━━━━━━━━━━━━━━━━━━━━
■ キャンセルされた勤務
━━━━━━━━━━━━━━━━━━━━━━
勤務先: {{facility_name}}
日時: {{work_date}} {{start_time}}〜{{end_time}}

ご不便をおかけして申し訳ございません。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
        push_title: '勤務キャンセル',
        push_body: '{{facility_name}}の勤務がキャンセルされました',
    },
    {
        notification_key: 'WORKER_REMINDER_DAY_BEFORE',
        name: '勤務前日リマインド',
        description: '勤務前日に送信するリマインダー',
        target_type: 'WORKER',
        chat_enabled: true,
        email_enabled: true,
        push_enabled: true,
        chat_message: `{{worker_name}}さん、明日の勤務リマインドです。

勤務先: {{facility_name}}
日時: {{work_date}} {{start_time}}〜{{end_time}}

持ち物や服装をご確認の上、お気をつけてお越しください。`,
        email_subject: '【+TASTAS】明日の勤務リマインド',
        email_body: `{{worker_name}}様

明日の勤務についてお知らせいたします。

━━━━━━━━━━━━━━━━━━━━━━
■ 勤務詳細
━━━━━━━━━━━━━━━━━━━━━━
勤務先: {{facility_name}}
日時: {{work_date}} {{start_time}}〜{{end_time}}

持ち物や服装をご確認の上、お気をつけてお越しください。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
        push_title: '明日の勤務',
        push_body: '{{facility_name}} {{start_time}}〜',
    },
    {
        notification_key: 'WORKER_REMINDER_SAME_DAY',
        name: '勤務当日リマインド',
        description: '勤務当日朝に送信するリマインダー',
        target_type: 'WORKER',
        chat_enabled: false,
        email_enabled: false,
        push_enabled: true,
        chat_message: null,
        email_subject: null,
        email_body: null,
        push_title: '本日の勤務',
        push_body: '{{facility_name}} {{start_time}}〜 お気をつけて！',
    },
    {
        notification_key: 'WORKER_REVIEW_REQUEST',
        name: 'レビュー依頼',
        description: '勤務終了後にレビュー投稿を依頼',
        target_type: 'WORKER',
        chat_enabled: true,
        email_enabled: true,
        push_enabled: false,
        chat_message: `{{worker_name}}さん、お疲れ様でした！

{{facility_name}}での勤務はいかがでしたか？
ぜひレビューを投稿してください。

{{review_url}}`,
        email_subject: '【+TASTAS】レビューのお願い',
        email_body: `{{worker_name}}様

{{facility_name}}での勤務お疲れ様でした。

勤務の感想をぜひレビューとしてお寄せください。
{{review_url}}

──────────────────────────
+TASTAS 運営
──────────────────────────`,
        push_title: null,
        push_body: null,
    },
    {
        notification_key: 'WORKER_REVIEW_REMINDER',
        name: 'レビュー催促',
        description: '未投稿のレビューがある場合に催促',
        target_type: 'WORKER',
        chat_enabled: true,
        email_enabled: true,
        push_enabled: false,
        chat_message: `{{worker_name}}さん、レビューの投稿はお済みですか？

{{facility_name}}でのお仕事について、ぜひご感想をお聞かせください。

{{review_url}}`,
        email_subject: '【+TASTAS】レビュー投稿のリマインド',
        email_body: `{{worker_name}}様

{{facility_name}}でのお仕事のレビューはお済みですか？

ご感想をお寄せいただくことで、サービスの向上に役立てさせていただきます。
{{review_url}}

──────────────────────────
+TASTAS 運営
──────────────────────────`,
        push_title: null,
        push_body: null,
    },
    {
        notification_key: 'WORKER_REVIEW_RECEIVED',
        name: '施設からレビューが届いた',
        description: '施設からレビューが投稿された時に送信',
        target_type: 'WORKER',
        chat_enabled: true,
        email_enabled: true,
        push_enabled: false,
        chat_message: `{{worker_name}}さん、{{facility_name}}からレビューが届きました！

マイページでご確認ください。`,
        email_subject: '【+TASTAS】レビューが届きました',
        email_body: `{{worker_name}}様

{{facility_name}}からレビューが届きました。

マイページよりご確認ください。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
        push_title: null,
        push_body: null,
    },
    {
        notification_key: 'WORKER_ANNOUNCEMENT',
        name: 'お知らせ（運営から）',
        description: '運営からのお知らせを送信',
        target_type: 'WORKER',
        chat_enabled: false,
        email_enabled: false,
        push_enabled: true,
        chat_message: null,
        email_subject: null,
        email_body: null,
        push_title: '+TASTASからのお知らせ',
        push_body: '{{announcement_title}}',
    },
    {
        notification_key: 'WORKER_FAVORITE_DEADLINE',
        name: '応募締切間近のお気に入り求人',
        description: 'お気に入り求人の締切が近い時に送信',
        target_type: 'WORKER',
        chat_enabled: false,
        email_enabled: false,
        push_enabled: true,
        chat_message: null,
        email_subject: null,
        email_body: null,
        push_title: '締切間近',
        push_body: '{{facility_name}}の求人があと{{remaining_hours}}時間で締切です',
    },
    {
        notification_key: 'WORKER_FAVORITE_NEW_JOB',
        name: 'お気に入り施設の新着求人',
        description: 'お気に入り施設に新しい求人が出た時に送信',
        target_type: 'WORKER',
        chat_enabled: false,
        email_enabled: false,
        push_enabled: true,
        chat_message: null,
        email_subject: null,
        email_body: null,
        push_title: '新着求人',
        push_body: '{{facility_name}}に新しい求人が追加されました',
    },

    // 施設向け
    {
        notification_key: 'FACILITY_NEW_APPLICATION',
        name: '新規応募',
        description: 'ワーカーから新しい応募があった時に送信',
        target_type: 'FACILITY',
        chat_enabled: true,
        email_enabled: true,
        push_enabled: true,
        chat_message: `新しい応募がありました！

求人: {{job_title}}
応募者: {{worker_name}}さん
勤務希望日: {{work_date}}

応募管理画面でご確認ください。`,
        email_subject: '【+TASTAS】新しい応募がありました',
        email_body: `{{facility_name}}様

新しい応募がありました。

━━━━━━━━━━━━━━━━━━━━━━
■ 応募詳細
━━━━━━━━━━━━━━━━━━━━━━
求人: {{job_title}}
応募者: {{worker_name}}さん
勤務希望日: {{work_date}}

応募管理画面でご確認ください。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
        push_title: '新規応募',
        push_body: '{{worker_name}}さんから応募がありました',
    },
    {
        notification_key: 'FACILITY_CANCELLED_BY_WORKER',
        name: 'ワーカーからのキャンセル',
        description: 'ワーカーが予約をキャンセルした時に送信',
        target_type: 'FACILITY',
        chat_enabled: true,
        email_enabled: true,
        push_enabled: true,
        chat_message: `{{worker_name}}さんから勤務キャンセルの連絡がありました。

求人: {{job_title}}
日時: {{work_date}}

代わりのワーカーをお探しください。`,
        email_subject: '【+TASTAS】勤務キャンセルのお知らせ',
        email_body: `{{facility_name}}様

ワーカーから勤務キャンセルの連絡がありました。

━━━━━━━━━━━━━━━━━━━━━━
■ キャンセル詳細
━━━━━━━━━━━━━━━━━━━━━━
求人: {{job_title}}
ワーカー: {{worker_name}}さん
日時: {{work_date}}

代わりのワーカーをお探しください。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
        push_title: 'キャンセル通知',
        push_body: '{{worker_name}}さんが勤務をキャンセルしました',
    },
    {
        notification_key: 'FACILITY_REMINDER_DAY_BEFORE',
        name: '勤務前日リマインド',
        description: '勤務前日に送信するリマインダー',
        target_type: 'FACILITY',
        chat_enabled: true,
        email_enabled: true,
        push_enabled: true,
        chat_message: `明日の勤務リマインドです。

求人: {{job_title}}
ワーカー: {{worker_name}}さん
日時: {{work_date}} {{start_time}}〜{{end_time}}

ワーカーの受け入れ準備をお願いいたします。`,
        email_subject: '【+TASTAS】明日の勤務リマインド',
        email_body: `{{facility_name}}様

明日の勤務についてお知らせいたします。

━━━━━━━━━━━━━━━━━━━━━━
■ 勤務詳細
━━━━━━━━━━━━━━━━━━━━━━
求人: {{job_title}}
ワーカー: {{worker_name}}さん
日時: {{work_date}} {{start_time}}〜{{end_time}}

ワーカーの受け入れ準備をお願いいたします。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
        push_title: '明日の勤務',
        push_body: '{{worker_name}}さんが出勤予定です',
    },
    {
        notification_key: 'FACILITY_REVIEW_REQUEST',
        name: 'レビュー依頼',
        description: '勤務終了後にレビュー投稿を依頼',
        target_type: 'FACILITY',
        chat_enabled: true,
        email_enabled: true,
        push_enabled: false,
        chat_message: `{{worker_name}}さんの勤務が完了しました。

ぜひワーカーのレビューを投稿してください。
今後のマッチングの参考になります。

{{review_url}}`,
        email_subject: '【+TASTAS】レビューのお願い',
        email_body: `{{facility_name}}様

{{worker_name}}さんの勤務が完了しました。

ワーカーのレビューをぜひお寄せください。
{{review_url}}

──────────────────────────
+TASTAS 運営
──────────────────────────`,
        push_title: null,
        push_body: null,
    },
    {
        notification_key: 'FACILITY_REVIEW_RECEIVED',
        name: 'ワーカーからレビューが届いた',
        description: 'ワーカーからレビューが投稿された時に送信',
        target_type: 'FACILITY',
        chat_enabled: true,
        email_enabled: true,
        push_enabled: false,
        chat_message: `{{worker_name}}さんからレビューが届きました！

管理画面でご確認ください。`,
        email_subject: '【+TASTAS】レビューが届きました',
        email_body: `{{facility_name}}様

{{worker_name}}さんからレビューが届きました。

管理画面よりご確認ください。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
        push_title: null,
        push_body: null,
    },
    {
        notification_key: 'FACILITY_DEADLINE_WARNING',
        name: '求人締切間近（応募少ない）',
        description: '締切が近く応募が少ない求人を通知',
        target_type: 'FACILITY',
        chat_enabled: false,
        email_enabled: true,
        push_enabled: false,
        chat_message: null,
        email_subject: '【+TASTAS】求人の締切が近づいています',
        email_body: `{{facility_name}}様

以下の求人の締切が近づいています。

━━━━━━━━━━━━━━━━━━━━━━
■ 求人情報
━━━━━━━━━━━━━━━━━━━━━━
求人: {{job_title}}
勤務日: {{work_date}}
締切: {{deadline}}
応募状況: {{applied_count}}/{{recruitment_count}}名

まだ募集枠に空きがあります。
必要に応じて求人内容の見直しをご検討ください。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
        push_title: null,
        push_body: null,
    },
    {
        notification_key: 'FACILITY_SLOTS_FILLED',
        name: '募集枠が埋まった',
        description: '求人の募集枠が全て埋まった時に送信',
        target_type: 'FACILITY',
        chat_enabled: false,
        email_enabled: false,
        push_enabled: true,
        chat_message: null,
        email_subject: null,
        email_body: null,
        push_title: '募集完了',
        push_body: '{{job_title}}の募集枠が埋まりました',
    },
    {
        notification_key: 'FACILITY_ANNOUNCEMENT',
        name: 'お知らせ（運営から）',
        description: '運営からのお知らせを送信',
        target_type: 'FACILITY',
        chat_enabled: false,
        email_enabled: false,
        push_enabled: true,
        chat_message: null,
        email_subject: null,
        email_body: null,
        push_title: '+TASTASからのお知らせ',
        push_body: '{{announcement_title}}',
    },

    // システム管理者向け
    {
        notification_key: 'ADMIN_NEW_FACILITY',
        name: '新規施設登録（要審査）',
        description: '新しい施設が登録された時に送信',
        target_type: 'SYSTEM_ADMIN',
        chat_enabled: false,
        email_enabled: true,
        push_enabled: false,
        chat_message: null,
        email_subject: '【+TASTAS管理】新規施設登録',
        email_body: `新しい施設が登録されました。

施設名: {{facility_name}}
法人名: {{corporation_name}}
登録日時: {{registered_at}}

審査をお願いします。`,
        push_title: null,
        push_body: null,
    },
    {
        notification_key: 'ADMIN_NEW_WORKER',
        name: '新規ワーカー登録',
        description: '新しいワーカーが登録された時に送信',
        target_type: 'SYSTEM_ADMIN',
        chat_enabled: false,
        email_enabled: false,
        push_enabled: false,
        chat_message: null,
        email_subject: null,
        email_body: null,
        push_title: null,
        push_body: null,
    },
    {
        notification_key: 'ADMIN_HIGH_CANCEL_RATE',
        name: 'キャンセル率異常',
        description: 'ユーザーのキャンセル率が閾値を超えた時に送信',
        target_type: 'SYSTEM_ADMIN',
        chat_enabled: false,
        email_enabled: true,
        push_enabled: false,
        chat_message: null,
        email_subject: '【+TASTAS管理】キャンセル率アラート',
        email_body: `キャンセル率が高いユーザーを検知しました。

ユーザー: {{user_name}}
キャンセル率: {{cancel_rate}}%
直近キャンセル数: {{recent_cancels}}件

対応をご検討ください。`,
        push_title: null,
        push_body: null,
    },
    {
        notification_key: 'ADMIN_LOW_RATING_STREAK',
        name: '低評価レビュー連続',
        description: 'ユーザーが連続で低評価を受けた時に送信',
        target_type: 'SYSTEM_ADMIN',
        chat_enabled: false,
        email_enabled: true,
        push_enabled: false,
        chat_message: null,
        email_subject: '【+TASTAS管理】低評価アラート',
        email_body: `連続で低評価を受けているユーザーを検知しました。

ユーザー: {{user_name}}
平均評価: {{average_rating}}
直近の低評価数: {{low_rating_count}}件

対応をご検討ください。`,
        push_title: null,
        push_body: null,
    },
    {
        notification_key: 'ADMIN_SUSPICIOUS_ACCESS',
        name: '不正アクセス検知',
        description: '不審なアクセスを検知した時に送信',
        target_type: 'SYSTEM_ADMIN',
        chat_enabled: false,
        email_enabled: true,
        push_enabled: false,
        chat_message: null,
        email_subject: '【+TASTAS管理】不正アクセスアラート',
        email_body: `不審なアクセスを検知しました。

ユーザー: {{user_name}}
IPアドレス: {{ip_address}}
検知日時: {{detected_at}}
詳細: {{details}}

確認をお願いします。`,
        push_title: null,
        push_body: null,
    },
    {
        notification_key: 'ADMIN_WORKER_LOW_RATING_STREAK',
        name: 'ワーカー低評価レビュー連続',
        description: 'ワーカーが連続で低評価を受けた、または平均評価が閾値以下になった時に送信',
        target_type: 'SYSTEM_ADMIN',
        chat_enabled: false,
        email_enabled: true,
        push_enabled: false,
        chat_message: null,
        email_subject: '【+TASTAS管理】ワーカー低評価アラート',
        email_body: `ワーカーの低評価アラートが発生しました。

■ 対象ワーカー
名前: {{user_name}}
ID: {{user_id}}

■ 評価状況
平均評価: {{average_rating}}点
直近の低評価数: {{low_rating_count}}件
発生条件: {{trigger_reason}}

対応をご検討ください。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
        push_title: null,
        push_body: null,
        alert_thresholds: {
            avg_rating_threshold: 2.5,
            consecutive_low_rating_count: 3,
            low_rating_threshold: 2
        },
    },
    {
        notification_key: 'ADMIN_FACILITY_LOW_RATING_STREAK',
        name: '施設低評価レビュー連続',
        description: '施設が連続で低評価を受けた、または平均評価が閾値以下になった時に送信',
        target_type: 'SYSTEM_ADMIN',
        chat_enabled: false,
        email_enabled: true,
        push_enabled: false,
        chat_message: null,
        email_subject: '【+TASTAS管理】施設低評価アラート',
        email_body: `施設の低評価アラートが発生しました。

■ 対象施設
施設名: {{facility_name}}
ID: {{facility_id}}

■ 評価状況
平均評価: {{average_rating}}点
直近の低評価数: {{low_rating_count}}件
発生条件: {{trigger_reason}}

対応をご検討ください。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
        push_title: null,
        push_body: null,
        alert_thresholds: {
            avg_rating_threshold: 2.5,
            consecutive_low_rating_count: 3,
            low_rating_threshold: 2
        },
    },
    {
        notification_key: 'ADMIN_WORKER_HIGH_CANCEL_RATE',
        name: 'ワーカーキャンセル率異常',
        description: 'ワーカーのキャンセル率が閾値を超えた、または連続キャンセルした時に送信',
        target_type: 'SYSTEM_ADMIN',
        chat_enabled: false,
        email_enabled: true,
        push_enabled: false,
        chat_message: null,
        email_subject: '【+TASTAS管理】ワーカーキャンセル率アラート',
        email_body: `ワーカーのキャンセル率アラートが発生しました。

■ 対象ワーカー
名前: {{user_name}}
ID: {{user_id}}

■ キャンセル状況
キャンセル率: {{cancel_rate}}%
連続キャンセル数: {{consecutive_cancels}}件
発生条件: {{trigger_reason}}

対応をご検討ください。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
        push_title: null,
        push_body: null,
        alert_thresholds: {
            cancel_rate_threshold: 30,
            consecutive_cancel_count: 3
        },
    },
    {
        notification_key: 'ADMIN_FACILITY_HIGH_CANCEL_RATE',
        name: '施設キャンセル率異常',
        description: '施設のキャンセル率が閾値を超えた、または連続キャンセルした時に送信',
        target_type: 'SYSTEM_ADMIN',
        chat_enabled: false,
        email_enabled: true,
        push_enabled: false,
        chat_message: null,
        email_subject: '【+TASTAS管理】施設キャンセル率アラート',
        email_body: `施設のキャンセル率アラートが発生しました。

■ 対象施設
施設名: {{facility_name}}
ID: {{facility_id}}

■ キャンセル状況
キャンセル率: {{cancel_rate}}%
連続キャンセル数: {{consecutive_cancels}}件
発生条件: {{trigger_reason}}

対応をご検討ください。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
        push_title: null,
        push_body: null,
        alert_thresholds: {
            cancel_rate_threshold: 30,
            consecutive_cancel_count: 3
        },
    },
];

async function seedNotificationSettings() {
    console.log('Seeding notification settings...');

    for (const setting of notificationSettings) {
        await prisma.notificationSetting.upsert({
            where: { notification_key: setting.notification_key },
            update: setting,
            create: setting,
        });
    }

    console.log(`Seeded ${notificationSettings.length} notification settings`);
}

seedNotificationSettings()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
