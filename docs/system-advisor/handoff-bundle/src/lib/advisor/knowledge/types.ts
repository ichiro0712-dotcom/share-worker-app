/**
 * 知識キャッシュの種別と取得対象の定義
 */

export interface KnowledgeSourceDef {
  /** DB の advisor_knowledge_cache.source_key */
  key: string;
  /** 表示用ラベル */
  label: string;
  /** リポジトリ内パス (GitHub Contents API への引数) */
  path: string;
  /** 巨大ファイルの場合の上限 (bytes), 超過分は切り詰め */
  maxBytes?: number;
}

/**
 * 同期対象のファイル一覧。
 * 追加・削除はここで行う。
 */
/**
 * 同期対象ファイル一覧。
 *
 * 各ファイルは GitHub (main ブランチ) を優先し、404 の場合はローカルファイルにフォールバック。
 * ローカルにも無ければエラー扱い。
 *
 * 追加・削除はここで行う。
 */
export const KNOWLEDGE_SOURCES: KnowledgeSourceDef[] = [
  {
    key: 'claude_md',
    label: 'CLAUDE.md (開発ルール)',
    path: 'CLAUDE.md',
  },
  {
    key: 'schema_prisma',
    label: 'Prisma スキーマ',
    path: 'prisma/schema.prisma',
    maxBytes: 200_000,
  },
  {
    key: 'metric_definitions',
    label: 'メトリクス定義 (MetricDefinitions.tsx)',
    path: 'app/system-admin/analytics/tabs/MetricDefinitions.tsx',
  },
  {
    key: 'advisor_readme',
    label: 'System Advisor 設計 README',
    path: 'docs/system-advisor/README.md',
  },
  {
    key: 'advisor_architecture',
    label: 'System Advisor アーキテクチャ',
    path: 'docs/system-advisor/architecture.md',
  },
  {
    key: 'advisor_tools_spec',
    label: 'System Advisor ツール仕様',
    path: 'docs/system-advisor/tools-spec.md',
  },
  {
    key: 'advisor_data_model',
    label: 'System Advisor データモデル',
    path: 'docs/system-advisor/data-model.md',
  },
  {
    key: 'advisor_security',
    label: 'System Advisor セキュリティ・コスト',
    path: 'docs/system-advisor/security-cost.md',
  },
];

export interface KnowledgeRecord {
  key: string;
  label: string;
  path: string;
  contentHash: string;
  content: string;
  byteSize: number;
  lastSyncedAt: Date;
  sourceSha?: string;
}
