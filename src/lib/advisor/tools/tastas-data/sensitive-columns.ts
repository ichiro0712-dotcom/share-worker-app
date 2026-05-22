/**
 * execute_sql ツールでアクセスを禁止する個人情報・センシティブカラム定義
 *
 * 設計方針:
 * - ブラックリスト方式: 明示的に列挙したカラムのみブロック
 * - 「table.column」形式 (小文字) で照合
 * - SQL の SELECT 句やエイリアス、WHERE 句のいずれに登場しても検出
 *
 * 検出した場合は LLM に「個人情報保護の観点から出力が禁止されています」と
 * 理由付きで応答させる。
 *
 * 追加・削除は本ファイルだけで完結する (ホットスポット化を防ぐため)。
 */

/** ブロックするカラム一覧 (table_name.column_name 形式、小文字) */
export const SENSITIVE_COLUMNS: readonly string[] = [
  // User (ワーカー本人情報)
  'users.email',
  'users.phone',
  'users.password',
  'users.password_hash',
  'users.line_user_id',
  'users.name_kana',
  'users.address',
  'users.address1',
  'users.address2',
  'users.postal_code',
  'users.birthday',
  'users.birth_date',

  // Facility / FacilityAdmin の連絡先
  'facility_admins.email',
  'facility_admins.phone',
  'facility_admins.password',
  'facility_admins.password_hash',

  // SystemAdmin
  'system_admins.email',
  'system_admins.password',
  'system_admins.password_hash',

  // 応募メッセージ本文 (やりとりの中身は除外)
  'applications.message',
  'application_messages.body',
  'messages.body',
  'messages.content',
];

export interface SensitiveColumnHit {
  /** マッチしたカラム表記 (元の SQL での出現形) */
  matched: string;
  /** どの定義にマッチしたか */
  rule: string;
}

/**
 * SQL 文字列からセンシティブカラムを検出する。
 *
 * 戦略:
 * - 大文字小文字を無視
 * - "table.column" 形式の素直な参照を検出する
 * - `SELECT * FROM users` の `*` は別途検出 (列指定なしの全カラム取得は禁止)
 *
 * 注意:
 * - エイリアスを介した参照 (例: `u.email` ← `users u`) は **このパスでは検出できない**。
 *   そのため SQL 全体の正規化 (エイリアス展開) を簡易的に行う。
 */
export function detectSensitiveColumns(sql: string): SensitiveColumnHit[] {
  const hits: SensitiveColumnHit[] = [];
  const lower = sql.toLowerCase();

  // 1. table.column 直接参照を検出
  for (const sensitive of SENSITIVE_COLUMNS) {
    // \b でワード境界を取り、後ろにドットが続かない (= 次のカラム指定ではない) ことを確認
    const pattern = new RegExp(
      `\\b${escapeRegex(sensitive)}(?![\\w.])`,
      'gi'
    );
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(lower)) !== null) {
      hits.push({ matched: m[0], rule: sensitive });
    }
  }

  // 2. エイリアス展開: `FROM users u` / `FROM users AS u` / `JOIN users u`
  //    抽出した (alias -> table) を使って `u.email` のような参照を再チェック
  const aliasMap = extractAliases(lower);
  aliasMap.forEach((table, alias) => {
    for (const sensitive of SENSITIVE_COLUMNS) {
      const [t, c] = sensitive.split('.');
      if (t !== table) continue;
      const aliased = `${alias}.${c}`;
      const pattern = new RegExp(
        `\\b${escapeRegex(aliased)}(?![\\w.])`,
        'gi'
      );
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(lower)) !== null) {
        // 既に直接参照として検出済みの可能性は低いが、重複は許容
        hits.push({ matched: m[0], rule: sensitive });
      }
    }
  });

  // 3. SELECT * FROM <sensitive table> の検出
  //    センシティブカラムを含むテーブルは `SELECT *` を禁止する
  const sensitiveTables = Array.from(
    new Set(SENSITIVE_COLUMNS.map((c) => c.split('.')[0]))
  );
  // 簡易: `select * from <table>` or `select t.* from ... <table> t`
  for (const table of sensitiveTables) {
    // SELECT * FROM table
    const p1 = new RegExp(
      `select\\s+\\*\\s+from\\s+${escapeRegex(table)}\\b`,
      'gi'
    );
    if (p1.test(lower)) {
      hits.push({ matched: `SELECT * FROM ${table}`, rule: `${table}.*` });
    }
    // SELECT alias.* で sensitive table のエイリアス
    aliasMap.forEach((t, alias) => {
      if (t !== table) return;
      const p2 = new RegExp(
        `select\\s+[\\w,\\s.*]*\\b${escapeRegex(alias)}\\.\\*`,
        'gi'
      );
      if (p2.test(lower)) {
        hits.push({ matched: `${alias}.*`, rule: `${table}.*` });
      }
    });
  }

  return dedupeHits(hits);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractAliases(sql: string): Map<string, string> {
  // 例: `from users u`, `from users as u`, `join users u on ...`
  const aliasMap = new Map<string, string>();
  const re =
    /\b(?:from|join)\s+([a-z_][a-z0-9_]*)(?:\s+as)?\s+([a-z_][a-z0-9_]*)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const table = m[1].toLowerCase();
    const alias = m[2].toLowerCase();
    // SQL キーワードを誤認しないようにフィルタ
    if (
      [
        'on',
        'where',
        'left',
        'right',
        'inner',
        'outer',
        'cross',
        'lateral',
        'using',
      ].includes(alias)
    ) {
      continue;
    }
    aliasMap.set(alias, table);
  }
  return aliasMap;
}

function dedupeHits(hits: SensitiveColumnHit[]): SensitiveColumnHit[] {
  const seen = new Set<string>();
  const out: SensitiveColumnHit[] = [];
  for (const h of hits) {
    const key = `${h.matched}::${h.rule}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}
