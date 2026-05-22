/**
 * Search Console 認証の切り分け用スクリプト。
 *
 * 実行: npx tsx scripts/test-search-console-auth.ts
 *
 * 3パターンで認証を試して、どこで詰まっているか観察する:
 *  (A) google.auth.JWT + keyFile  ← 現状の search-console-client.ts と同じ
 *  (B) google.auth.JWT + JSON 直読み (email/key)
 *  (C) google.auth.GoogleAuth + keyFile (推奨される現代的な書き方)
 */

import { config as loadEnv } from 'dotenv'
import path from 'path'
import fs from 'fs'

// .env.local を明示的に読み込む (next dev と同じ挙動にする)
loadEnv({ path: path.resolve(process.cwd(), '.env.local') })

import { google } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly']

async function testA_JwtKeyFile() {
  console.log('\n=== (A) google.auth.JWT + keyFile ===')
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credentialsPath) {
    console.log('  GOOGLE_APPLICATION_CREDENTIALS 未設定 → skip')
    return
  }
  const absPath = path.resolve(process.cwd(), credentialsPath)
  console.log('  keyFile:', absPath, 'exists:', fs.existsSync(absPath))

  try {
    const auth = new google.auth.JWT({
      keyFile: absPath,
      scopes: SCOPES,
    })
    const tokenInfo = await auth.authorize()
    console.log('  ✅ authorize OK, has access_token:', !!tokenInfo.access_token)
  } catch (e) {
    console.log('  ❌ authorize FAILED:', (e as Error).message)
  }
}

async function testB_JwtEmailKey() {
  console.log('\n=== (B) google.auth.JWT + email/key (JSON 直読み) ===')
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credentialsPath) {
    console.log('  GOOGLE_APPLICATION_CREDENTIALS 未設定 → skip')
    return
  }
  const absPath = path.resolve(process.cwd(), credentialsPath)
  const raw = fs.readFileSync(absPath, 'utf-8')
  const json = JSON.parse(raw) as { client_email: string; private_key: string }
  console.log('  client_email:', json.client_email)
  console.log('  private_key length:', json.private_key.length)
  console.log('  private_key starts with:', json.private_key.slice(0, 40).replace(/\n/g, '\\n'))

  try {
    const auth = new google.auth.JWT({
      email: json.client_email,
      key: json.private_key,
      scopes: SCOPES,
    })
    const tokenInfo = await auth.authorize()
    console.log('  ✅ authorize OK, has access_token:', !!tokenInfo.access_token)
  } catch (e) {
    console.log('  ❌ authorize FAILED:', (e as Error).message)
  }
}

async function testC_GoogleAuth() {
  console.log('\n=== (C) google.auth.GoogleAuth + keyFile (推奨) ===')
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credentialsPath) {
    console.log('  GOOGLE_APPLICATION_CREDENTIALS 未設定 → skip')
    return
  }
  const absPath = path.resolve(process.cwd(), credentialsPath)

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: absPath,
      scopes: SCOPES,
    })
    const client = await auth.getClient()
    const token = await client.getAccessToken()
    console.log('  ✅ access_token 取得 OK, has token:', !!token.token)
  } catch (e) {
    console.log('  ❌ getAccessToken FAILED:', (e as Error).message)
  }
}

async function testD_SearchConsoleQuery() {
  console.log('\n=== (D) 認証通った後、実際に Search Console API を叩く ===')
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL
  if (!credentialsPath || !siteUrl) {
    console.log('  env 不足 → skip')
    return
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.resolve(process.cwd(), credentialsPath),
      scopes: SCOPES,
    })
    const webmasters = google.webmasters({ version: 'v3', auth })

    // sites.list (権限のあるサイト一覧) で疎通確認
    console.log('  -- sites.list を試す --')
    const sitesRes = await webmasters.sites.list({})
    console.log('  ✅ sites.list OK')
    console.log('  権限のあるサイト:')
    for (const site of sitesRes.data.siteEntry ?? []) {
      console.log(`    - ${site.siteUrl} (${site.permissionLevel})`)
    }

    // searchanalytics.query を試す
    console.log(`  -- searchanalytics.query siteUrl="${siteUrl}" を試す --`)
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
    const res = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: weekAgo,
        endDate: today,
        dimensions: [],
        rowLimit: 1,
      },
    })
    console.log('  ✅ searchanalytics.query OK, rows:', res.data.rows?.length ?? 0)
  } catch (e) {
    console.log('  ❌ Search Console API FAILED:', (e as Error).message)
    if ((e as { errors?: unknown }).errors) {
      console.log('  詳細:', JSON.stringify((e as { errors?: unknown }).errors, null, 2))
    }
  }
}

async function main() {
  console.log('SEARCH_CONSOLE_SITE_URL:', process.env.SEARCH_CONSOLE_SITE_URL)
  console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS)

  await testA_JwtKeyFile()
  await testB_JwtEmailKey()
  await testC_GoogleAuth()
  await testD_SearchConsoleQuery()
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
