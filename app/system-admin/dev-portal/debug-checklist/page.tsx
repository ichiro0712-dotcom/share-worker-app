'use client';

import { useState, useEffect, ReactNode, useCallback, useTransition } from 'react';
import Link from 'next/link';
import {
    Users,
    Building2,
    Shield,
    Layers,
    ArrowLeft,
    Trash2,
    AlertTriangle,
    Zap,
    Info,
    User,
    Loader2,
    FileText,
    BarChart3
} from 'lucide-react';
import {
    type DebugUser,
    getDebugCheckProgress,
    getAllUsersProgress,
    toggleDebugCheck,
    resetUserProgress
} from '@/src/lib/debug-checklist-actions';

// 固定の担当者リスト
const DEBUG_USERS: DebugUser[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

interface DebugItem {
    text: string;
    isHeader?: boolean;
    isSubHeader?: boolean;
    isDescription?: boolean;
}

interface DebugSection {
    category: string;
    icon: ReactNode;
    items: DebugItem[];
}

// DEBUG_PLAN.md に基づいたデバッグ項目
const DEBUG_ITEMS: DebugSection[] = [
    {
        category: "0. 準備",
        icon: <Info className="w-5 h-5 text-emerald-600" />,
        items: [
            { text: "0-1. 推奨端末", isHeader: true },
            { text: "・ワーカー画面: スマートフォン（実機またはブラウザのデベロッパーツール）", isDescription: true },
            { text: "・施設管理者・システム管理者画面: PC（Chrome/Safari推奨）", isDescription: true },
            { text: "0-2. ログイン情報・URL", isHeader: true },
            { text: "・ワーカーログイン: https://s-work.netlify.app/login", isDescription: true },
            { text: "・施設管理者ログイン: https://s-work.netlify.app/admin/login", isDescription: true },
            { text: "・システム管理者ログイン: https://s-work.netlify.app/system-admin/login", isDescription: true },
            { text: "・開発ポータル: https://s-work.netlify.app/system-admin/dev-portal （PW：password123）", isDescription: true },
            { text: "0-3. デバッグ管理表（報告先）", isHeader: true },
            { text: "・デバッグ管理表 (Google Spreadsheets) へ報告", isDescription: true },
        ]
    },
    {
        category: "0-A. デバッグの心得",
        icon: <Info className="w-5 h-5 text-amber-600" />,
        items: [
            { text: "基本原則", isHeader: true },
            { text: "①「期待値」と「実際の結果」を明確にする: 何が起きて、本来どうなるべきだったかを正確に報告", isDescription: true },
            { text: "②再現手順を必ず添える: どのページ（URL）で、どのボタンを押したかを記述", isDescription: true },
            { text: "③証拠（エビデンス）を残す: スクリーンショットやエラーコンソールのログを保存", isDescription: true },
            { text: "④エッジケースを攻める: 「普通はしない操作」こそがバグの宝庫", isDescription: true },
            { text: "⑤端末情報を添える: ブラウザ（Chrome/Safari）やデバイス（PC/iPhone/Android）を明記", isDescription: true },
            { text: "エッジケース具体例 - 入力値テスト", isHeader: true },
            { text: "・超長文入力: 自己紹介やメッセージに1万文字以上入力して崩れないか", isDescription: true },
            { text: "・特殊文字・絵文字: 名前や住所に絵文字、特殊な記号（& < > \" '）を入れてもエラーにならないか", isDescription: true },
            { text: "・スクリプト注入: <script>alert('xss')</script> などの入力がそのまま実行されないか（サニタイズ）", isDescription: true },
            { text: "・数値の境界値: 時給を1円や9,999,999円に設定してみる", isDescription: true },
            { text: "エッジケース具体例 - ブラウザ・操作テスト", isHeader: true },
            { text: "・ブラウザの「戻る」ボタン: 応募完了後に戻るボタンを押した際の挙動", isDescription: true },
            { text: "・二重クリック: 送信ボタンを連打したときに、データが二重登録されないか", isDescription: true },
            { text: "・タブ同時操作: ワーカー画面と施設画面を別タブで開き、同時に操作してもセッションが混合しないか", isDescription: true },
            { text: "・強制終了: アップロード中にブラウザを閉じたあとの再開挙動", isDescription: true },
            { text: "エッジケース具体例 - 日時・通信関連", isHeader: true },
            { text: "・深夜0時の跨ぎ: 23:00〜翌02:00の勤務設定が正しくカレンダーに表示されるか", isDescription: true },
            { text: "・オフライン: 通信を切断した状態でボタンを押した際、適切なエラーメッセージが出るか", isDescription: true },
        ]
    },
    {
        category: "1. ワーカー: 認証・登録",
        icon: <Users className="w-5 h-5 text-blue-600" />,
        items: [
            { text: "1-1. 新規登録", isHeader: true },
            { text: "メールアドレス入力が機能する" },
            { text: "パスワード入力（確認含む）が機能する" },
            { text: "必須項目の入力検証が動作する" },
            { text: "登録完了後に自動ログインされる" },
            { text: "1-2. ログイン/ログアウト", isHeader: true },
            { text: "メール/パスワードでログインできる" },
            { text: "間違ったパスワードでエラー表示" },
            { text: "ログアウト後にログインページへリダイレクト" },
            { text: "1-3. パスワードリセット", isHeader: true },
            { text: "メールアドレス入力でリセットメール送信" },
            { text: "リセットリンクからパスワード再設定" },
            { text: "1-4. セッション維持", isHeader: true },
            { text: "ページ遷移後もログイン状態維持" },
            { text: "ブラウザ再起動後もログイン維持" },
        ]
    },
    {
        category: "2. ワーカー: 求人検索・閲覧",
        icon: <Users className="w-5 h-5 text-blue-600" />,
        items: [
            { text: "2-1. トップページ・求人一覧", isHeader: true },
            { text: "求人一覧が表示される" },
            { text: "求人タイトルが表示される" },
            { text: "時給・日給が表示される" },
            { text: "勤務日程（単発/複数）が表示される" },
            { text: "勤務時間が表示される" },
            { text: "必要資格が表示される" },
            { text: "施設名・所在地が表示される" },
            { text: "2-2. 求人種別ごとの表示", isHeader: true },
            { text: "単発求人が正しく表示される（日付が1日のみ）" },
            { text: "複数日程求人に「全N日」のラベルが表示" },
            { text: "面接あり求人に「面接あり」「審査あり」ラベル表示" },
            { text: "勤務日条件付き求人に条件が表示（週N回以上勤務等）" },
            { text: "2-3. 検索・フィルタ", isHeader: true },
            { text: "地域フィルタが機能する" },
            { text: "資格フィルタが機能する" },
            { text: "日付フィルタが機能する" },
            { text: "フリーワード検索が機能する" },
            { text: "2-4. 求人詳細ページ", isHeader: true },
            { text: "タイトル・施設名が表示される" },
            { text: "時給・日給・交通費が表示される" },
            { text: "勤務時間・休憩時間が表示される" },
            { text: "仕事内容が表示される" },
            { text: "必要資格・経験が表示される" },
            { text: "服装・持ち物が表示される" },
            { text: "施設担当者メッセージが表示される" },
            { text: "画像カルーセルが動作する" },
            { text: "勤務日カレンダーが正しく表示される" },
            { text: "こだわり条件タグが表示される" },
        ]
    },
    {
        category: "3. ワーカー: 応募機能",
        icon: <Users className="w-5 h-5 text-blue-600" />,
        items: [
            { text: "3-1. 基本応募", isHeader: true },
            { text: "求人詳細から応募ボタンが表示される" },
            { text: "ログインしていない場合はログインページへ誘導" },
            { text: "応募確認画面が表示される" },
            { text: "応募完了後に完了ページへ遷移" },
            { text: "3-2. 求人種別ごとの応募", isHeader: true },
            { text: "単発求人に応募できる" },
            { text: "複数日程求人で1日だけ選択して応募できる" },
            { text: "複数日程求人で複数日選択して応募できる" },
            { text: "複数日程で0日選択では応募できない（バリデーション）" },
            { text: "面接あり求人に応募できる（説明が表示される）" },
            { text: "勤務日条件付き求人で条件を満たす日数で応募できる" },
            { text: "勤務日条件付き求人で条件未満の日数では応募できない" },
            { text: "3-3. 応募制御", isHeader: true },
            { text: "応募済みの求人に再応募できない" },
            { text: "応募後に求人カード/詳細で「応募済み」表示になる" },
            { text: "募集枠が埋まった求人に応募できない" },
            { text: "エラー時にバナーが表示される" },
        ]
    },
    {
        category: "4. ワーカー: マイページ",
        icon: <Users className="w-5 h-5 text-blue-600" />,
        items: [
            { text: "4-1. プロフィール", isHeader: true },
            { text: "氏名（姓・名）が表示される" },
            { text: "プロフィール画像が表示される" },
            { text: "生年月日が表示される" },
            { text: "住所が表示される" },
            { text: "電話番号が表示される" },
            { text: "自己紹介が表示される" },
            { text: "各項目を変更して保存できる" },
            { text: "必須項目の検証が動作する" },
            { text: "プロフィール画像のアップロード/変更ができる" },
            { text: "4-2. 資格情報", isHeader: true },
            { text: "資格を選択して追加できる" },
            { text: "資格を削除できる" },
            { text: "資格証明書のアップロードができる" },
            { text: "4-3. 応募履歴", isHeader: true },
            { text: "応募した求人一覧が表示される" },
            { text: "審査中（APPLIED）がタブ表示される" },
            { text: "仕事の予定（SCHEDULED）がタブ表示される" },
            { text: "勤務中（WORKING）がタブ表示される" },
            { text: "完了（COMPLETED_RATED）がタブ表示される" },
            { text: "キャンセル（CANCELLED）がタブ表示される" },
        ]
    },
    {
        category: "5. ワーカー: レビュー・メッセージ・通知",
        icon: <Users className="w-5 h-5 text-blue-600" />,
        items: [
            { text: "5-1. レビュー投稿", isHeader: true },
            { text: "勤務完了後の求人がレビュー投稿待ち一覧に表示される" },
            { text: "評価（星1-5）を選択できる" },
            { text: "良かった点を入力できる" },
            { text: "改善点を入力できる" },
            { text: "投稿したレビューが保存される" },
            { text: "5-2. 受けた評価", isHeader: true },
            { text: "施設から受けた評価一覧が表示される" },
            { text: "施設名・求人タイトル・勤務日が表示される" },
            { text: "総合評価（星）が表示される" },
            { text: "5項目評価（勤怠・スキル等）が表示される" },
            { text: "5-3. メッセージ", isHeader: true },
            { text: "施設ごとのスレッド一覧が表示される" },
            { text: "最新メッセージのプレビューが表示される" },
            { text: "未読件数が表示される" },
            { text: "テキストメッセージを送信できる" },
            { text: "メッセージを受信・表示できる" },
            { text: "5-4. 通知", isHeader: true },
            { text: "通知一覧が表示される" },
            { text: "マッチング承認通知が届く" },
            { text: "応募却下通知が届く" },
            { text: "キャンセル通知が届く" },
            { text: "メッセージ通知が届く" },
        ]
    },
    {
        category: "6. ワーカー: 勤務管理",
        icon: <Users className="w-5 h-5 text-blue-600" />,
        items: [
            { text: "6-1. 勤務予定", isHeader: true },
            { text: "予定している勤務が表示される" },
            { text: "求人タイトルが表示される" },
            { text: "施設名が表示される" },
            { text: "勤務日時が表示される" },
            { text: "報酬が表示される" },
            { text: "6-2. 勤務詳細", isHeader: true },
            { text: "勤務詳細が表示される" },
            { text: "労働条件通知書が確認できる" },
            { text: "6-3. キャンセル", isHeader: true },
            { text: "マッチング後にキャンセルボタンが表示される" },
            { text: "キャンセル確認モーダルが表示される" },
            { text: "キャンセル実行後にステータスが「キャンセル」になる" },
            { text: "キャンセル後にキャンセル率が更新される" },
            { text: "6-4. 施設からのキャンセル", isHeader: true },
            { text: "施設からキャンセルされた場合に通知が届く" },
            { text: "ステータスが「キャンセル」になる" },
            { text: "ワーカーのキャンセル率には反映されない" },
        ]
    },
    {
        category: "7. 施設管理者: 認証・ダッシュボード",
        icon: <Building2 className="w-5 h-5 text-green-600" />,
        items: [
            { text: "7-1. 認証", isHeader: true },
            { text: "施設管理者ログインができる" },
            { text: "ログアウトが正常動作" },
            { text: "7-2. ダッシュボード", isHeader: true },
            { text: "ダッシュボードが表示される" },
            { text: "各種統計サマリーが表示される" },
        ]
    },
    {
        category: "8. 施設管理者: 求人管理",
        icon: <Building2 className="w-5 h-5 text-green-600" />,
        items: [
            { text: "8-1. 求人一覧", isHeader: true },
            { text: "求人一覧が表示される" },
            { text: "ステータスバッジ（公開中/停止中）が表示される" },
            { text: "審査ありバッジ（面接あり求人）が表示される" },
            { text: "求人タイトル・応募状況が表示される" },
            { text: "週N回以上勤務バッジ（条件付き求人）が表示される" },
            { text: "フィルタが機能する（ステータス・期間等）" },
            { text: "一括操作が機能する（選択・公開・停止・削除）" },
            { text: "8-2. 求人作成", isHeader: true },
            { text: "単発求人（1日のみ）を作成できる" },
            { text: "複数日程求人を作成できる" },
            { text: "面接あり求人を作成できる（審査ありチェック）" },
            { text: "勤務日条件付き求人を作成できる" },
            { text: "こだわり条件（7項目）を設定できる" },
            { text: "画像アップロードができる" },
            { text: "プレビュー表示が機能する" },
            { text: "確認モーダルが表示される" },
            { text: "8-3. 求人編集・公開停止", isHeader: true },
            { text: "既存求人の編集ができる" },
            { text: "勤務日の追加・削除ができる" },
            { text: "求人を公開できる" },
            { text: "求人を停止できる" },
            { text: "8-4. テンプレート", isHeader: true },
            { text: "テンプレート一覧が表示される" },
            { text: "新規テンプレート作成ができる" },
            { text: "テンプレートから求人作成ができる" },
        ]
    },
    {
        category: "9. 施設管理者: 応募・シフト管理",
        icon: <Building2 className="w-5 h-5 text-green-600" />,
        items: [
            { text: "9-1. 応募一覧", isHeader: true },
            { text: "応募一覧が表示される" },
            { text: "求人ベース/ワーカーベース表示の切り替え" },
            { text: "単発/複数日程/面接あり求人の応募が表示される" },
            { text: "未確認応募バッジが勤務日ごとに表示される" },
            { text: "9-2. マッチング・却下", isHeader: true },
            { text: "応募を承認（マッチング）できる" },
            { text: "複数日程求人の応募を日ごとに承認できる" },
            { text: "面接あり求人の応募を承認できる" },
            { text: "承認後にワーカーに通知が届く" },
            { text: "応募を却下できる" },
            { text: "却下後にワーカーに通知が届く" },
            { text: "9-3. シフト管理", isHeader: true },
            { text: "週表示/月表示の切り替えができる" },
            { text: "マッチング済みシフト一覧が表示される" },
            { text: "シフト詳細モーダルが表示される" },
            { text: "シフトをキャンセルできる" },
            { text: "キャンセル後ワーカーに通知が届く" },
            { text: "施設側キャンセルはワーカーのキャンセル率に反映されない" },
        ]
    },
    {
        category: "10. 施設管理者: ワーカー管理",
        icon: <Building2 className="w-5 h-5 text-green-600" />,
        items: [
            { text: "10-1. ワーカー一覧", isHeader: true },
            { text: "マッチしたワーカー一覧が表示される" },
            { text: "プロフィール画像・氏名・住所が表示される" },
            { text: "資格バッジ・経験分野が表示される" },
            { text: "評価（平均・件数）が表示される" },
            { text: "勤務回数（自社/他社）が表示される" },
            { text: "キャンセル率（通常/直前）が表示される" },
            { text: "お気に入り/ブロック状態が表示される" },
            { text: "フィルタ・並び替えが機能する" },
            { text: "10-2. ワーカー詳細", isHeader: true },
            { text: "基本情報（氏名・住所・電話等）が表示される" },
            { text: "資格情報が表示される" },
            { text: "統計情報（評価・キャンセル率・勤務回数）が表示される" },
            { text: "過去の勤務履歴が表示される" },
            { text: "今後の勤務予定が表示される" },
            { text: "資格証明書・緊急連絡先・労働条件通知書が確認できる" },
            { text: "10-3. ワーカーアクション", isHeader: true },
            { text: "ワーカーをお気に入り登録/解除できる" },
            { text: "ワーカーをブロック/解除できる" },
        ]
    },
    {
        category: "11. 施設管理者: レビュー・メッセージ・設定",
        icon: <Building2 className="w-5 h-5 text-green-600" />,
        items: [
            { text: "11-1. ワーカーへのレビュー投稿", isHeader: true },
            { text: "レビュー投稿画面が表示される" },
            { text: "評価（星1-5）を入力できる" },
            { text: "良かった点・改善点を入力できる" },
            { text: "投稿後にワーカー詳細に表示される" },
            { text: "11-2. 受けたレビュー", isHeader: true },
            { text: "ワーカーから受けたレビュー一覧が表示される" },
            { text: "評価サマリー（平均・分布）が表示される" },
            { text: "ソート（新着順/評価順）が機能する" },
            { text: "11-3. メッセージ", isHeader: true },
            { text: "ワーカー別のメッセージ一覧が表示される" },
            { text: "ワーカーにメッセージを送信できる" },
            { text: "未読件数が正しく表示される" },
            { text: "11-4. 施設設定", isHeader: true },
            { text: "施設情報が表示される" },
            { text: "施設情報を編集できる" },
            { text: "施設画像をアップロードできる" },
            { text: "担当者情報を編集できる" },
        ]
    },
    {
        category: "12. システム管理者: 認証・ダッシュボード",
        icon: <Shield className="w-5 h-5 text-red-600" />,
        items: [
            { text: "12-1. 認証", isHeader: true },
            { text: "ログイン成功" },
            { text: "ログアウト成功" },
            { text: "セッション維持（8時間）" },
            { text: "不正認証情報でエラー表示" },
            { text: "12-2. ダッシュボード", isHeader: true },
            { text: "統計サマリーが表示される" },
            { text: "アラートが表示される" },
            { text: "最近のアクティビティが表示される" },
        ]
    },
    {
        category: "13. システム管理者: 施設・ワーカー・求人管理",
        icon: <Shield className="w-5 h-5 text-red-600" />,
        items: [
            { text: "13-1. 施設管理", isHeader: true },
            { text: "施設一覧が表示される" },
            { text: "施設検索・フィルタが機能する" },
            { text: "施設詳細が確認できる" },
            { text: "施設承認ができる" },
            { text: "施設却下ができる" },
            { text: "新規施設登録ができる" },
            { text: "13-2. ワーカー管理", isHeader: true },
            { text: "ワーカー一覧が表示される" },
            { text: "ワーカー検索・フィルタが機能する" },
            { text: "ワーカー詳細が確認できる" },
            { text: "13-3. 求人管理", isHeader: true },
            { text: "全求人一覧が表示される" },
            { text: "求人検索・フィルタが機能する" },
        ]
    },
    {
        category: "14. システム管理者: コンテンツ・お知らせ",
        icon: <FileText className="w-5 h-5 text-red-600" />,
        items: [
            { text: "14-1. 通知テンプレート", isHeader: true },
            { text: "テンプレート一覧が表示される" },
            { text: "テンプレート編集ができる" },
            { text: "通知ON/OFF設定ができる" },
            { text: "14-2. FAQ・利用規約等", isHeader: true },
            { text: "FAQ一覧が表示される" },
            { text: "FAQ追加・編集・削除ができる" },
            { text: "利用規約の編集ができる" },
            { text: "プライバシーポリシーの編集ができる" },
            { text: "使い方ガイドの編集ができる" },
            { text: "労働条件通知書テンプレートの編集ができる" },
            { text: "14-3. お知らせ管理", isHeader: true },
            { text: "お知らせ一覧が表示される" },
            { text: "新規お知らせ作成ができる" },
            { text: "お知らせ編集・削除ができる" },
            { text: "14-4. 管理者設定", isHeader: true },
            { text: "管理者一覧が表示される" },
            { text: "管理者追加・編集ができる" },
        ]
    },
    {
        category: "15. システム管理者: アナリティクス",
        icon: <BarChart3 className="w-5 h-5 text-red-600" />,
        items: [
            { text: "15-1. 概要タブ", isHeader: true },
            { text: "KPIサマリーが表示される" },
            { text: "期間フィルタ（日/週/月/年）が機能する" },
            { text: "ユーザー推移グラフが表示される" },
            { text: "求人・応募推移グラフが表示される" },
            { text: "マッチング率推移グラフが表示される" },
            { text: "15-2. 地域別・エクスポート・AI分析", isHeader: true },
            { text: "地域別統計が表示される" },
            { text: "CSVエクスポートが機能する" },
            { text: "AI分析機能が動作する" },
            { text: "15-3. 数値検証（重要）", isHeader: true },
            { text: "総ワーカー数 = ワーカー一覧件数" },
            { text: "総施設数 = 施設一覧件数" },
            { text: "総求人数 = 求人一覧件数" },
            { text: "応募数・マッチング数が実データと整合" },
            { text: "マッチング率の計算が正しい" },
            { text: "前期比の計算が正しい" },
        ]
    },
    {
        category: "16. 連携テスト: 応募〜完了フロー",
        icon: <Layers className="w-5 h-5 text-orange-600" />,
        items: [
            { text: "シナリオ1: 基本フロー", isHeader: true },
            { text: "[ワーカー] 求人を検索して応募" },
            { text: "[施設] 応募を確認してマッチング承認" },
            { text: "[ワーカー] マッチング通知を確認" },
            { text: "[施設] ワーカーにメッセージ送信" },
            { text: "[ワーカー] メッセージを確認して返信" },
            { text: "[施設] 勤務完了処理" },
            { text: "[ワーカー] 施設にレビュー投稿" },
            { text: "[施設] ワーカーにレビュー投稿" },
            { text: "[ワーカー] 受けた評価を確認" },
        ]
    },
    {
        category: "17. 連携テスト: キャンセルフロー",
        icon: <Layers className="w-5 h-5 text-orange-600" />,
        items: [
            { text: "シナリオ2: ワーカー起点キャンセル", isHeader: true },
            { text: "[ワーカー] 求人に応募" },
            { text: "[施設] マッチング承認" },
            { text: "[ワーカー] マッチング後にキャンセル" },
            { text: "[施設] キャンセル通知を確認" },
            { text: "[システム] ワーカーのキャンセル率が更新される" },
            { text: "[施設] ワーカー詳細でキャンセル率を確認" },
            { text: "シナリオ2-2: 施設起点キャンセル", isHeader: true },
            { text: "[ワーカー] 求人に応募" },
            { text: "[施設] マッチング承認" },
            { text: "[施設] シフト管理画面からキャンセル" },
            { text: "[ワーカー] キャンセル通知を確認" },
            { text: "[システム] ワーカーのキャンセル率は更新されない" },
            { text: "[ワーカー] マイページでキャンセル率確認（変化なし）" },
        ]
    },
    {
        category: "18. 連携テスト: 特殊求人",
        icon: <Layers className="w-5 h-5 text-orange-600" />,
        items: [
            { text: "シナリオ5: 面接あり求人（承認）", isHeader: true },
            { text: "[施設] 面接あり求人を作成（審査ありON）" },
            { text: "[ワーカー] 求人一覧で「面接あり」ラベル確認" },
            { text: "[ワーカー] 詳細で面接説明を確認して応募" },
            { text: "[施設] 応募確認・マッチング承認" },
            { text: "[ワーカー] マッチング通知を確認" },
            { text: "シナリオ5-2: 面接あり求人（却下）", isHeader: true },
            { text: "[施設] 面接あり求人を作成" },
            { text: "[ワーカー] 応募" },
            { text: "[施設] 応募を却下" },
            { text: "[ワーカー] 却下通知を確認" },
            { text: "[ワーカー] 応募履歴で「却下」ステータス表示" },
            { text: "シナリオ6: 複数日程求人の部分マッチング", isHeader: true },
            { text: "[施設] 5日間の求人を作成" },
            { text: "[ワーカーA] 3日分を選択して応募" },
            { text: "[施設] ワーカーAの3日分をマッチング" },
            { text: "[ワーカーB] 残り2日に応募" },
            { text: "[施設] ワーカーBの2日分をマッチング" },
            { text: "シナリオ7: 勤務日条件付き求人", isHeader: true },
            { text: "[施設] 「週2回以上勤務」条件の求人を作成" },
            { text: "[ワーカー] 1日だけ選択して応募試行 → エラー" },
            { text: "[ワーカー] 2日以上選択して応募 → 成功" },
            { text: "[施設] 応募を確認してマッチング" },
        ]
    },
    {
        category: "19. エッジケース",
        icon: <AlertTriangle className="w-5 h-5 text-purple-600" />,
        items: [
            { text: "入力値テスト", isHeader: true },
            { text: "空文字での送信" },
            { text: "最大文字数での入力" },
            { text: "特殊文字（絵文字、HTML、SQLインジェクション風）" },
            { text: "日本語・英語混在" },
            { text: "日時関連", isHeader: true },
            { text: "過去の日付での求人作成" },
            { text: "深夜0時をまたぐ勤務時間" },
            { text: "権限関連", isHeader: true },
            { text: "ログアウト状態でのアクセス" },
            { text: "他人のデータへのアクセス試行" },
            { text: "URLの直接入力でのアクセス" },
            { text: "負荷テスト（複数人同時）", isHeader: true },
            { text: "同時ログイン（10人以上）" },
            { text: "同時検索（10人以上）" },
            { text: "同一求人への同時応募（5人以上）" },
            { text: "同時メッセージ送信" },
        ]
    },
];

export default function DebugChecklistPage() {
    const [selectedUser, setSelectedUser] = useState<DebugUser>('A');
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
    const [allUsersProgress, setAllUsersProgress] = useState<Record<DebugUser, number>>({} as Record<DebugUser, number>);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [progress, allProgress] = await Promise.all([
                getDebugCheckProgress(selectedUser),
                getAllUsersProgress()
            ]);
            setCheckedItems(progress);
            setAllUsersProgress(allProgress);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedUser]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const toggleItem = async (category: string, item: string) => {
        const key = `${category}:${item}`;
        const newChecked = !checkedItems[key];
        setCheckedItems(prev => ({ ...prev, [key]: newChecked }));

        startTransition(async () => {
            const result = await toggleDebugCheck(selectedUser, key, newChecked);
            if (!result.success) {
                setCheckedItems(prev => ({ ...prev, [key]: !newChecked }));
            } else {
                const allProgress = await getAllUsersProgress();
                setAllUsersProgress(allProgress);
            }
        });
    };

    const clearAll = async () => {
        if (confirm(`${selectedUser}さんのチェックをリセットしますか？`)) {
            startTransition(async () => {
                const result = await resetUserProgress(selectedUser);
                if (result.success) {
                    setCheckedItems({});
                    const allProgress = await getAllUsersProgress();
                    setAllUsersProgress(allProgress);
                }
            });
        }
    };

    const getProgress = (items: DebugItem[], category: string) => {
        const checkableItems = items.filter(i => !i.isHeader && !i.isSubHeader && !i.isDescription);
        const checkedCount = checkableItems.filter(item => checkedItems[`${category}:${item.text}`]).length;
        return { count: checkedCount, total: checkableItems.length, percentage: checkableItems.length > 0 ? Math.round((checkedCount / checkableItems.length) * 100) : 0 };
    };

    const totalProgress = () => {
        const allFlatItems = DEBUG_ITEMS.flatMap(c => c.items.filter(i => !i.isHeader && !i.isSubHeader && !i.isDescription).map(i => `${c.category}:${i.text}`));
        const checkedCount = allFlatItems.filter(key => checkedItems[key]).length;
        return { count: checkedCount, total: allFlatItems.length, percentage: allFlatItems.length > 0 ? Math.round((checkedCount / allFlatItems.length) * 100) : 0 };
    };

    const globalProgress = totalProgress();
    const totalItems = DEBUG_ITEMS.flatMap(c => c.items.filter(i => !i.isHeader && !i.isSubHeader && !i.isDescription)).length;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-[800px] mx-auto px-4 py-4">
                    <div className="flex items-center gap-4 mb-4">
                        <Link href="/system-admin/dev-portal" className="p-2 hover:bg-gray-100 rounded-full">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <Zap className="w-6 h-6 text-yellow-500" />
                                デバッグチェックリスト
                            </h1>
                        </div>
                        <button onClick={clearAll} disabled={isPending} className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />リセット
                        </button>
                    </div>

                    {/* 進捗バー（担当者選択を含む） */}
                    <div className="bg-gray-50 rounded-xl p-4 border">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium">担当者：</span>
                                <select
                                    value={selectedUser}
                                    onChange={(e) => setSelectedUser(e.target.value as DebugUser)}
                                    className="px-3 py-1.5 text-sm font-medium bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                                >
                                    {DEBUG_USERS.map(user => (
                                        <option key={user} value={user}>
                                            {user}さん ({allUsersProgress[user] || 0}/{totalItems})
                                        </option>
                                    ))}
                                </select>
                                {isPending && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                            </div>
                            <span className="text-sm font-mono text-blue-600">{globalProgress.percentage}% ({globalProgress.count}/{globalProgress.total})</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-blue-600 h-full rounded-full transition-all" style={{ width: `${globalProgress.percentage}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-[800px] mx-auto px-4 py-8 space-y-8">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                ) : (
                    DEBUG_ITEMS.map((section) => {
                        const progress = getProgress(section.items, section.category);
                        // 準備セクション（説明のみ）はチェック項目がない
                        const isInfoOnly = section.items.every(i => i.isHeader || i.isDescription);

                        return (
                            <section key={section.category} className="bg-white rounded-xl border overflow-hidden">
                                <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {section.icon}
                                        <h2 className="text-sm font-bold">{section.category}</h2>
                                    </div>
                                    {!isInfoOnly && (
                                        <span className="text-xs text-gray-500">{progress.count}/{progress.total}</span>
                                    )}
                                </div>
                                <div className="divide-y">
                                    {section.items.map((item, idx) => {
                                        const isCheckable = !item.isHeader && !item.isSubHeader && !item.isDescription;
                                        const isChecked = isCheckable && checkedItems[`${section.category}:${item.text}`];

                                        // ヘッダー
                                        if (item.isHeader) {
                                            return (
                                                <div key={idx} className="px-6 py-3 bg-gray-50/50">
                                                    <span className="text-xs font-bold text-gray-900 border-l-4 border-blue-500 pl-2">{item.text}</span>
                                                </div>
                                            );
                                        }

                                        // 説明テキスト（チェックなし）
                                        if (item.isDescription) {
                                            return (
                                                <div key={idx} className="px-6 py-2 bg-gray-50/30">
                                                    <span className="text-sm text-gray-600">{item.text}</span>
                                                </div>
                                            );
                                        }

                                        // チェック可能な項目
                                        return (
                                            <div key={idx} onClick={() => toggleItem(section.category, item.text)} className={`flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-gray-50 ${isChecked ? 'bg-blue-50/30' : ''}`}>
                                                <input type="checkbox" checked={!!isChecked} readOnly className="w-5 h-5 rounded border-gray-300 text-blue-600" />
                                                <span className={`text-sm ${isChecked ? 'text-gray-400 line-through' : ''}`}>{item.text}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })
                )}
            </main>
        </div>
    );
}
