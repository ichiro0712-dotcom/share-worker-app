/**
 * 通知テンプレートの共通ユーティリティ
 *
 * - 変数置換ロジック(replaceVariables)はサーバー送信(notification-service.ts)と
 *   管理画面プレビューで共有し、「プレビュー=実送信」を保証する。
 * - 利用可能な変数(NOTIFICATION_VARIABLES)を単一の真実源として定義する。
 * - 誤った記法(角括弧 [..]、未知の {{..}}、内側スペース)を検出して
 *   サイレント送信ミスを防ぐ(findInvalidPlaceholders)。
 *
 * 注意: このファイルはクライアント/サーバー双方から import されるため、
 *       サーバー専用モジュール(prisma 等)を import してはならない。
 */

export interface NotificationVariable {
  /** 表示・コピー用のトークン。例: '{{worker_name}}' */
  key: string;
  /** 画面表示用の説明 */
  description: string;
  /** プレビュー用のサンプル値 */
  sample: string;
}

/**
 * 利用可能な変数の一覧（単一の真実源）。
 * 管理画面の変数チップ・プレビュー・バリデーションすべてがこれを参照する。
 */
export const NOTIFICATION_VARIABLES: NotificationVariable[] = [
  { key: '{{worker_name}}', description: 'ワーカー名', sample: '山田 太郎' },
  { key: '{{worker_last_name}}', description: 'ワーカー姓', sample: '山田' },
  { key: '{{facility_name}}', description: '施設名', sample: 'サンプル介護センター' },
  { key: '{{job_title}}', description: '求人タイトル', sample: '【日勤】介護スタッフ募集' },
  { key: '{{work_date}}', description: '勤務日', sample: '2026年6月20日' },
  { key: '{{applied_dates}}', description: '応募日程一覧（複数日対応）', sample: '6月20日, 6月21日' },
  { key: '{{start_time}}', description: '開始時間', sample: '09:00' },
  { key: '{{end_time}}', description: '終了時間', sample: '18:00' },
  { key: '{{wage}}', description: '日給', sample: '12,000円' },
  { key: '{{hourly_wage}}', description: '時給', sample: '1,500円' },
  { key: '{{deadline}}', description: '締切日時', sample: '6月18日 23:59' },
  { key: '{{review_url}}', description: 'レビュー投稿URL', sample: 'https://tastas.work/review/123' },
  { key: '{{job_url}}', description: '求人詳細URL', sample: 'https://tastas.work/jobs/123' },
  // 勤怠変更申請関連
  { key: '{{requested_start_time}}', description: '申請出勤時間', sample: '09:15' },
  { key: '{{requested_end_time}}', description: '申請退勤時間', sample: '18:30' },
  { key: '{{requested_break_time}}', description: '申請休憩時間', sample: '60分' },
  { key: '{{approved_start_time}}', description: '承認出勤時間', sample: '09:00' },
  { key: '{{approved_end_time}}', description: '承認退勤時間', sample: '18:00' },
  { key: '{{approved_break_time}}', description: '承認休憩時間', sample: '60分' },
  { key: '{{confirmed_wage}}', description: '確定報酬', sample: '12,500円' },
  { key: '{{admin_comment}}', description: '施設コメント', sample: '当日はよろしくお願いします' },
  { key: '{{worker_comment}}', description: 'ワーカーコメント', sample: '残業しました' },
  { key: '{{approval_url}}', description: '承認URL', sample: 'https://tastas.work/approve/123' },
  { key: '{{resubmit_url}}', description: '再申請URL', sample: 'https://tastas.work/resubmit/123' },
  // Alert keys
  { key: '{{user_name}}', description: 'ユーザー名', sample: '山田 太郎' },
  { key: '{{user_id}}', description: 'ユーザーID', sample: '123' },
  { key: '{{facility_id}}', description: '施設ID', sample: '45' },
  { key: '{{average_rating}}', description: '平均評価', sample: '4.8' },
  { key: '{{low_rating_count}}', description: '低評価件数', sample: '2' },
  { key: '{{trigger_reason}}', description: '発生条件', sample: '連続低評価' },
  { key: '{{cancel_rate}}', description: 'キャンセル率', sample: '15%' },
  { key: '{{consecutive_cancels}}', description: '連続キャンセル数', sample: '3' },
];

/** 許可された変数名(波括弧なし)のセット。例: 'worker_name' */
const VALID_VARIABLE_NAMES = new Set(
  NOTIFICATION_VARIABLES.map((v) => v.key.replace(/[{}]/g, ''))
);

/**
 * 旧画面(施設管理)で使われる角括弧プレースホルダなど、
 * 「角括弧で書かれていたら確実に記法ミス」と判断できる語の集合。
 * 任意の [お知らせ] 等を誤検知しないよう、既知の語に限定する。
 */
const SUSPICIOUS_BRACKET_TOKENS = new Set<string>([
  'ワーカー名字',
  '施設名',
  '施設責任者名字',
  'ワーカー名',
  ...Array.from(VALID_VARIABLE_NAMES),
]);

/**
 * テンプレート内の {{変数}} を実値へ置換する。
 *
 * 単一パスで置換するため、置換後の値に含まれる `{{...}}` が再度展開されることはなく、
 * 変数の処理順序にも依存しない（インジェクション・順序依存を回避）。
 * 関数置換のため値中の `$&` 等の特殊パターンも誤展開しない。
 * 未知の変数（variablesに無いキー）はそのまま残す。null/undefined は空文字。
 */
export function replaceVariables(
  template: string | null,
  variables: Record<string, string>
): string {
  if (!template) return '';
  return template.replace(/\{\{([^{}]+)\}\}/g, (match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(variables, name)) {
      return variables[name] ?? '';
    }
    return match;
  });
}

/** プレビュー用のサンプル値マップ(変数名 → サンプル値) */
export function getSampleVariableValues(): Record<string, string> {
  return Object.fromEntries(
    NOTIFICATION_VARIABLES.map((v) => [v.key.replace(/[{}]/g, ''), v.sample])
  );
}

export interface PlaceholderWarning {
  /** 問題のあるトークン。例: '[施設名]' '{{ facility_name }}' '{{facilty_name}}' */
  token: string;
  /** 警告理由 */
  reason: string;
}

/**
 * テンプレートから「置換されない誤記法」を検出する。
 * 検出対象:
 *   1. 角括弧プレースホルダ [既知の語] — 例 [施設名] [ワーカー名字]
 *   2. 内側に空白のある {{ xxx }} — 正規表現に一致せず置換されない
 *   3. 許可リストに無い {{xxx}} — タイポや日本語キー
 */
export function findInvalidPlaceholders(template: string | null): PlaceholderWarning[] {
  const warnings: PlaceholderWarning[] = [];
  if (!template) return warnings;

  // 1. 角括弧プレースホルダ(既知の語のみ警告し、誤検知を避ける)
  const bracketRe = /\[([^\][]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = bracketRe.exec(template)) !== null) {
    const inner = m[1].trim();
    if (SUSPICIOUS_BRACKET_TOKENS.has(inner)) {
      warnings.push({
        token: m[0],
        reason: '角括弧は置換されません。{{...}} 記法を使ってください',
      });
    }
  }

  // 2 & 3. 波括弧トークンの検査
  const braceRe = /\{\{([^{}]*)\}\}/g;
  while ((m = braceRe.exec(template)) !== null) {
    const raw = m[1];
    const name = raw.trim();
    if (raw !== name) {
      warnings.push({
        token: m[0],
        reason: '余分な空白があります。{{' + name + '}} のように詰めてください',
      });
    } else if (!VALID_VARIABLE_NAMES.has(name)) {
      warnings.push({
        token: m[0],
        reason: '未知の変数です（置換されません）',
      });
    }
  }

  // 同一トークンの重複を除去
  const seen = new Set<string>();
  return warnings.filter((w) => {
    const k = w.token + '|' + w.reason;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
