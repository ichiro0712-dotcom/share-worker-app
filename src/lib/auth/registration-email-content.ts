/**
 * 会員登録完了メールの本文構築（純粋ロジック）。
 *
 * DB / Resend に依存しないため単体テスト可能。
 * - 通知管理画面で編集する NotificationSetting('WORKER_REGISTRATION_COMPLETE') を
 *   使えるか判定し（isRegistrationTemplateUsable）、
 * - 使える場合は変数置換した本文を、使えない場合は呼び出し側が渡す
 *   フォールバック本文（従来のメールアドレス確認メール）を返す。
 *
 * 認証トークンURL(verification_url)はセキュリティ上コード側で生成して
 * 変数として注入する（このモジュールは受け取るだけ）。
 */
import { replaceVariables } from '@/lib/notification-template';

/** 会員登録完了メールのテンプレートキー（通知管理画面から編集可能） */
export const REGISTRATION_COMPLETE_KEY = 'WORKER_REGISTRATION_COMPLETE';

/**
 * 会員登録完了メールの初期テンプレート（単一の真実源）。
 * seed.ts / 本番・STG投入スクリプト / テストはすべてこれを参照する。
 * 末尾の「自動送信」フッターは共通HTML枠が自動付与するため本文には含めない。
 */
export const DEFAULT_REGISTRATION_EMAIL_SUBJECT = '【+タスタス】会員登録が完了しました';

export const DEFAULT_REGISTRATION_EMAIL_BODY = `{{worker_name}} 様

タスタスへのご登録ありがとうございます。
会員登録が完了しました。

下記のURLからログインし、求人をご確認ください。
{{verification_url}}

※上記リンクからアクセスすると、メールアドレスの確認も同時に完了します（有効期限：24時間）。
※有効期限が過ぎた場合は、こちらのログインページからいつでもログインいただけます。
{{login_url}}

今後ともタスタスをよろしくお願いいたします。

※本メールは送信専用です。
※ご不明点等ございましたら、タスタス運営事務局（sharework@careergift.co.jp）までご連絡ください。`;

/** NotificationSetting への投入用の完全な初期データ（seed / upsert 共用） */
export const DEFAULT_REGISTRATION_NOTIFICATION_SETTING = {
  notification_key: REGISTRATION_COMPLETE_KEY,
  name: '会員登録完了（メール認証）',
  description:
    '新規登録のSMS認証完了後に送る会員登録完了メール。認証リンク＋ログイン導線を含む（メールアドレス確認メールを兼ねる）',
  target_type: 'WORKER',
  chat_enabled: false,
  email_enabled: true,
  push_enabled: false,
  chat_message: null,
  email_subject: DEFAULT_REGISTRATION_EMAIL_SUBJECT,
  email_body: DEFAULT_REGISTRATION_EMAIL_BODY,
  push_title: null,
  push_body: null,
} as const;

/** テンプレート判定に必要な NotificationSetting の部分形 */
export interface RegistrationTemplateSetting {
  email_enabled: boolean;
  email_subject: string | null;
  email_body: string | null;
}

/** テンプレートへ注入する動的値 */
export interface RegistrationEmailVars {
  /** ワーカー名 */
  name: string;
  /** 認証＋自動ログインURL（トークン付き・コード側生成） */
  verificationUrl: string;
  /** 恒久ログインページURL（再訪導線） */
  loginUrl: string;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * テンプレートを送信に使えるか判定する。
 * email無効・件名空・本文空・null のいずれかなら使えない（=フォールバック）。
 * 空白のみの件名/本文も「未設定」とみなす。
 */
export function isRegistrationTemplateUsable(
  setting: RegistrationTemplateSetting | null | undefined
): boolean {
  if (!setting) return false;
  if (!setting.email_enabled) return false;
  if (!setting.email_subject || setting.email_subject.trim() === '') return false;
  if (!setting.email_body || setting.email_body.trim() === '') return false;
  return true;
}

/**
 * 会員登録完了メールの件名・本文を構築する。
 * テンプレートが使えない場合は fallback をそのまま返す（送信は止めない）。
 */
export function buildRegistrationEmailContent(
  setting: RegistrationTemplateSetting | null | undefined,
  vars: RegistrationEmailVars,
  fallback: EmailContent
): EmailContent {
  if (!isRegistrationTemplateUsable(setting)) {
    return fallback;
  }
  const variables: Record<string, string> = {
    worker_name: vars.name,
    verification_url: vars.verificationUrl,
    login_url: vars.loginUrl,
  };
  const subject = replaceVariables(setting!.email_subject, variables);
  const text = replaceVariables(setting!.email_body, variables);
  return {
    subject,
    html: formatTemplateEmailHtml(text),
    text,
  };
}

/**
 * プレーンテキスト本文を通知基盤と同じ共通枠のHTMLメールに整形する。
 * （notification-service.ts の formatEmailHtml と同等。改行を <br> に変換）
 */
export function formatTemplateEmailHtml(body: string): string {
  const htmlBody = body.replace(/\n/g, '<br>');
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
        ${htmlBody}
    </div>
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
        <p>このメールは +タスタス より自動送信されています。</p>
        <p>※このメールに心当たりがない場合は、お手数ですが削除してください。</p>
    </div>
</body>
</html>`;
}
