/**
 * アプリケーションバージョン情報
 *
 * Vercelが自動で注入する環境変数からバージョン情報を取得
 * デバッグ・バグ調査時にどのコードで問題が発生したか特定するために使用
 *
 * @see https://vercel.com/docs/projects/environment-variables/system-environment-variables
 */

export interface AppVersionInfo {
  /** Git Commit SHA（短縮7桁） */
  commitSha: string | null
  /** Git Commit SHA（フル40桁） */
  commitShaFull: string | null
  /** Vercel Deployment ID */
  deploymentId: string | null
  /** 環境名（production / preview / development） */
  environment: string
  /** Git ブランチ名 */
  branch: string | null
  /** GitHub リポジトリURL */
  repoUrl: string | null
}

/**
 * Vercel環境変数からバージョン情報を取得
 *
 * 使用する環境変数:
 * - VERCEL_GIT_COMMIT_SHA: コミットハッシュ（フル）
 * - VERCEL_DEPLOYMENT_ID: デプロイID
 * - VERCEL_ENV: 環境名
 * - VERCEL_GIT_COMMIT_REF: ブランチ名
 * - VERCEL_GIT_REPO_OWNER: リポジトリオーナー
 * - VERCEL_GIT_REPO_SLUG: リポジトリ名
 */
function getVersionInfo(): AppVersionInfo {
  const commitShaFull = process.env.VERCEL_GIT_COMMIT_SHA || null
  const commitSha = commitShaFull ? commitShaFull.substring(0, 7) : null
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID || null
  const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'
  const branch = process.env.VERCEL_GIT_COMMIT_REF || null

  // GitHub リポジトリURL構築
  const repoOwner = process.env.VERCEL_GIT_REPO_OWNER
  const repoSlug = process.env.VERCEL_GIT_REPO_SLUG
  const repoUrl = repoOwner && repoSlug
    ? `https://github.com/${repoOwner}/${repoSlug}`
    : null

  return {
    commitSha,
    commitShaFull,
    deploymentId,
    environment,
    branch,
    repoUrl,
  }
}

// シングルトンでキャッシュ（ビルド時に固定されるため再計算不要）
let cachedVersionInfo: AppVersionInfo | null = null

/**
 * アプリケーションバージョン情報を取得
 *
 * @example
 * const version = getAppVersion()
 * console.log(version.commitSha)    // "cd6e4f1"
 * console.log(version.deploymentId) // "dpl_BxSfsP8Ky2KIUE"
 */
export function getAppVersion(): AppVersionInfo {
  if (!cachedVersionInfo) {
    cachedVersionInfo = getVersionInfo()
  }
  return cachedVersionInfo
}

/**
 * ログ記録用のバージョン情報を取得
 * UserActivityLog, NotificationLog のフィールドに対応
 */
export function getVersionForLog(): { app_version: string | null; deployment_id: string | null } {
  const version = getAppVersion()
  return {
    app_version: version.commitSha,
    deployment_id: version.deploymentId,
  }
}

/**
 * GitHub コミットURLを生成
 *
 * @example
 * getCommitUrl("cd6e4f1") // "https://github.com/owner/repo/commit/cd6e4f1"
 */
export function getCommitUrl(commitSha: string): string | null {
  const version = getAppVersion()
  if (!version.repoUrl) return null
  return `${version.repoUrl}/commit/${commitSha}`
}

/**
 * Vercel Deployment URLを生成
 *
 * @example
 * getDeploymentUrl("dpl_BxSfsP8Ky2KIUE") // "https://vercel.com/.../dpl_BxSfsP8Ky2KIUE"
 */
export function getDeploymentUrl(deploymentId: string): string {
  // Vercelのデプロイメント詳細ページへのリンク
  // プロジェクト名が必要なため、汎用的なリンクを返す
  return `https://vercel.com/_next/deployments/${deploymentId}`
}

/**
 * バージョン情報の表示用文字列を生成
 *
 * @example
 * getVersionString() // "cd6e4f1 (production)"
 */
export function getVersionString(): string {
  const version = getAppVersion()
  const sha = version.commitSha || 'unknown'
  const env = version.environment
  return `${sha} (${env})`
}
