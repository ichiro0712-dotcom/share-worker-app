# ワーカー経験分野（経験施設）マスタ化・管理画面編集対応 実装計画

作成日: 2026-07-01
対象ブランチ: `feature/experience-field-master`（develop 経由）
関連メモリ: [[kaitec-competitive-analysis]] / [[notification-template-db-sync-gap]]

---

## 1. 背景・目的

ワーカープロフィールの「経験分野」選択肢が介護施設のみのハードコードになっており、看護師向けの病院・クリニック等が選べない。クライアント要望に基づき以下を実現する。

1. **項目追加**: 病院・クリニック・保育園等を含む独自リストにする（カイテクとは別内容）
2. **UI刷新**: カイテク方式（種別プルダウン＋経験年数プルダウン＋「＋」で行追加）
3. **管理画面編集**: 選択肢をシステム管理画面から追加・編集・並べ替え・表示ON/OFFできるようにする

## 2. 確定要件（クライアント回答済み・2026-06-30）

| # | 論点 | 決定 |
|---|---|---|
| ① | グループ分け | **する**（介護施設／病院／クリニック／その他） |
| ② | 既存の介護項目 | **残す**（現行7項目を初期データに含める） |
| ③ | 管理画面での削除 | **物理削除しない＝表示ON/OFFで非表示化**（過去登録データは保持） |
| ④ | 編集権限 | **システム管理画面にログインできる全管理者** |

### 開発側で確定した前提（クライアント確認不要）
- 保存データ形式は現状の `experience_fields`（`Json?` = 施設名→経験年数のマップ）を**そのまま流用** → プロフィールの保存ロジックとDBカラムは変更なし。
- 経験年数の選択肢は現状維持（1年未満／1〜2年／3〜5年／5〜10年／10年以上）。
- 同一種別の重複選択は不可（マップ形式のキー一意性を維持するため、既選択の種別は他行のプルダウンで選べないようにする）。
- 登録フロー（`/register/worker`）は経験分野を収集していないため対象外。プロフィール編集画面のみ改修。

## 3. 全体設計

```
[システム管理者]
  /system-admin/content/experience-fields（新設・FAQ編集をベースに複製）
    → カテゴリCRUD / 項目CRUD / 並べ替え / 表示ON-OFF
        ↓ 保存
   DB: experience_field_categories / experience_fields（新規テーブル）
        ↓ 公開分のみ取得
[ワーカー]
  /mypage/profile（サーバーで公開リストを取得しクライアントへ渡す）
    → カイテク式プルダウン＋行追加で選択
        ↓ 保存（形式は現状維持）
   DB: Profile.experience_fields（Json＝{施設名:経験年数}）※変更なし
```

## 4. DB設計（新規モデル2つ）

`prisma/schema.prisma` に追加。既存マスタ（`FaqCategory`/`Faq`）と同じ規約（`sort_order` / 表示フラグ / 更新者記録）に合わせる。

```prisma
// 経験分野カテゴリ（例: 介護施設 / 病院 / クリニック / その他）
model ExperienceFieldCategory {
  id           Int               @id @default(autoincrement())
  name         String
  sort_order   Int               @default(0) @map("sort_order")
  is_published Boolean           @default(true) @map("is_published")
  created_at   DateTime          @default(now()) @map("created_at")
  updated_at   DateTime          @updatedAt @map("updated_at")
  updated_by_type String?        @map("updated_by_type")
  updated_by_id   Int?           @map("updated_by_id")
  fields       ExperienceField[]

  @@index([sort_order])
  @@map("experience_field_categories")
}

// 経験分野の項目（例: 特別養護老人ホーム / 病院（急性期） / 保育園）
model ExperienceField {
  id           Int                     @id @default(autoincrement())
  category_id  Int                     @map("category_id")
  name         String                                        // ワーカー登録データと突き合わせるキー
  sort_order   Int                     @default(0) @map("sort_order")
  is_published Boolean                 @default(true) @map("is_published") // ③非表示制御
  created_at   DateTime                @default(now()) @map("created_at")
  updated_at   DateTime                @updatedAt @map("updated_at")
  updated_by_type String?             @map("updated_by_type")
  updated_by_id   Int?                @map("updated_by_id")
  category     ExperienceFieldCategory @relation(fields: [category_id], references: [id], onDelete: Cascade)

  @@index([category_id])
  @@index([sort_order])
  @@map("experience_fields")
}
```

**注意点:**
- `name` は既存ワーカーの保存データ（文字列）と突き合わせる表示キー。**リネームは既存表示に影響する**ため、管理画面で名称変更する際の運用に注意（初期値は下記の通り既存名を厳守）。
- 項目の「削除」は原則UIから提供せず、`is_published=false`（非表示）で運用（③）。カテゴリ削除は `onDelete: Cascade` だが管理画面では非表示運用を基本とする。

## 5. 初期データ（seed）

`prisma/seed.ts` にマスタ初期投入を追加（既存があれば冪等に upsert）。

| カテゴリ | 項目 |
|---|---|
| 介護施設 | 特別養護老人ホーム / 介護老人保健施設 / グループホーム / デイサービス / 訪問介護 / 有料老人ホーム / サービス付き高齢者向け住宅 |
| 病院 | 病院（急性期）/ 病院（回復期）/ 病院（地域包括ケア）/ 病院（療養）/ 病院（精神）/ 病院（外来）/ 病院（ICU・HCU）/ 病院（オペ室）/ 病院（その他） |
| クリニック | クリニック（無床）/ クリニック（有床） |
| その他 | 施設内健診 / 保育園 / その他 |

- **介護施設7項目は現行 `experienceFieldsList` と完全一致**させ、既存ワーカーの表示崩れを防ぐ（②）。
- 現行にある「その他」は「その他」カテゴリへ移動。

## 6. バックエンド実装

### 6-1. 管理画面用サーバーアクション（`src/lib/content-actions.ts` に追記）
既存FAQアクションと同じ構成。呼び出し元は system-admin 配下ページ（保護済み）。

- `getExperienceFieldsForAdmin()` — 全カテゴリ＋項目（非公開含む）を取得
- `createExperienceFieldCategory(name)` / `updateExperienceFieldCategory(id, ...)` / `updateExperienceFieldCategoryOrder(orders)`
- `createExperienceField(categoryId, name)` / `updateExperienceField(id, {name, is_published})` / `updateExperienceFieldOrder(orders)`
- 各更新で `updated_by_type='SYSTEM_ADMIN'` / `updated_by_id` を記録
- 保存後 `revalidatePath('/mypage/profile')` 等でキャッシュ更新

### 6-2. ワーカー公開用の取得関数（`src/lib/actions/user-profile.ts` 付近に追加）
- `getPublishedExperienceFields()` — `is_published=true` のカテゴリ・項目のみを、カテゴリ→項目の入れ子で `sort_order` 順に返す。

## 7. システム管理画面 UI

- 新規ページ: `app/system-admin/content/experience-fields/page.tsx`
  - **`app/system-admin/content/faq/page.tsx` を複製・改変**（カテゴリ＋項目＋並べ替え＋モーダル編集の作りが流用できる）
  - 機能: カテゴリ追加/編集/並べ替え、項目追加/編集/並べ替え、**表示ON/OFFトグル**（③）
  - FAQのCSV取込等は今回はスコープ外（将来拡張可）
- コンテンツ管理ハブにカード追加: `app/system-admin/content/page.tsx` の `contentCards` に1件追加（`enabled: true`、リンク先 `/system-admin/content/experience-fields`）

## 8. ワーカープロフィール編集 UI（カイテク式）

- サーバー側 `app/mypage/profile/page.tsx`
  - `getPublishedExperienceFields()` を呼び、`experienceFieldOptions` を `ProfileEditClient` に props で渡す（クライアントfetch不要・ローディング状態を回避）。
- クライアント側 `app/mypage/profile/ProfileEditClient.tsx`
  - **ハードコード `experienceFieldsList`（387〜396行）を削除**し、props のマスタを使用。
  - 「5. 経験・職歴」セクションのチェックボックス群を**カイテク式に置換**:
    - 1行 = 「種別プルダウン（カテゴリ見出し付き `<optgroup>`）」＋「経験年数プルダウン」
    - 「＋」ボタンで行追加、行削除も可能
    - 既に他行で選択済みの種別は選択不可（重複防止）
  - 保存: 各行を `{ 種別: 経験年数 }` に集約し、現行どおり `experienceFields` として送信（`ProfileEditClient` 773行の送信ロジック・保存アクションは形式維持）。
  - 既存データ読み込み: 現行の `initialExperienceFields` / `initialExperienceYears`（195〜200行）はそのまま行データへ展開。**マスタから外れた（非公開化された）旧データも、既存登録分は行として表示・保持**する（削除しない）。

## 9. 既存データ互換・表示側

- `Profile.experience_fields` のデータ形式・カラムは不変 → 表示系（`app/system-admin/workers/[id]`、`app/admin/applications`、`app/admin/workers` 等）は**変更不要**。
- `app/admin/workers/page.tsx`（96〜122行）と `app/admin/workers/[id]/page.tsx`（13〜36行）の略称・色マップは未登録項目でもフォールバック動作（フルネーム表示／グレー）。**必須ではないが**、新項目（病院系等）の略称・色を追記すると一覧の見栄えが向上（任意・後回し可）。

## 10. 実装フェーズと工数目安

| フェーズ | 内容 | DB変更 | 目安 |
|---|---|---|---|
| P1 | Prismaモデル追加＋seed初期データ | あり（テーブル追加） | 1.0h |
| P2 | 管理画面（ページ＋サーバーアクション＋ハブカード） | なし | 3.0h |
| P3 | ワーカープロフィール編集のカイテク式UI化＋マスタ参照 | なし | 3.0h |
| P4 | ビルド確認・手動テスト・微修正 | なし | 1.5h |
| （任意）| 一覧の略称・色マップ追記 | なし | 0.5h |

合計目安: **約8.5h**（略称・色対応込みで約9h）

> 依存関係: P1 → P2/P3（P2とP3は並行可）→ P4。P1のマイグレーションはローカルDockerで先行実施。

## 11. DB反映手順（本番・ステージング＝ユーザー実行）

CLAUDE.mdルールに従い、**Claude Codeは本番/ステージングDBを操作しない**。以下をユーザーが実行。

```
【DB変更が必要です】
- 変更内容: experience_field_categories / experience_fields テーブル新規追加、および初期データ投入
- 対象環境: ステージング → 本番（develop→main の各リリース時）
- 実行コマンド（各環境の接続情報で）:
    npx prisma migrate deploy      # または本番運用に合わせた反映手順
    tsx prisma/seed.ts             # 初期マスタ投入（冪等）
- ⚠️ ユーザーが直接実行。Claudeは実行結果の確認のみ。
```

- ローカル開発: `npx prisma migrate dev` でマイグレーション作成＋適用、`tsx prisma/seed.ts` で確認。

## 12. テスト計画（手動）

1. 管理画面: カテゴリ/項目の追加・編集・並べ替え・表示ON/OFFが反映される。
2. ワーカー: プロフィール編集でカイテク式プルダウンが表示され、カテゴリ見出しでグループ化されている。
3. 種別＋経験年数を複数行登録・削除できる。同一種別の重複が選べない。
4. 保存後に再表示すると選択内容が保持される（既存形式と互換）。
5. 既存ワーカー（旧8項目で登録済み）の情報が崩れず表示・編集できる。
6. 管理画面で項目を非表示にすると、新規プルダウンには出ないが、その項目で既に登録済みのワーカーの表示は保持される。
7. `npm run build` / `npm run lint` が通る。

## 13. リスク・留意点

- **名称キー依存**: ワーカーデータは施設名の文字列で保存されるため、管理画面での項目リネームは既存表示との突き合わせに影響。運用ルール（原則リネームせず非表示＋新規追加）を管理画面の注意書きに明記推奨。
- **本番DB反映漏れ**: テーブル追加を伴うため、リリース時にマイグレーション反映漏れがあると管理画面/プロフィールが500になる。[[deploy-schema-sync-gap]] の教訓どおり、develop→main リリース後の本番反映を必ず実施。
- **重複防止UI**: 行追加方式で同一種別を選べない制御を入れないと、保存時にマップで上書きされデータ不整合の誤解を生む。

## 14. ブランチ・PR運用

- 作業ブランチ: `feature/experience-field-master`
- PR: `--base develop` で作成しURLを報告（マージはユーザー）。
- ステージング（develop）で手動テスト → 問題なければ develop→main のリリースPR。
- コミットメッセージ例: `機能追加: 経験分野マスタ化と管理画面編集対応（カイテク式UI）`

---

## 付録: 変更対象ファイル一覧

**新規:**
- `app/system-admin/content/experience-fields/page.tsx`
- （必要に応じ）`app/api/system-admin/experience-fields/route.ts` 系 ※サーバーアクション方式なら不要

**変更:**
- `prisma/schema.prisma`（モデル2追加）
- `prisma/seed.ts`（初期データ）
- `src/lib/content-actions.ts`（管理用CRUDアクション追加）
- `src/lib/actions/user-profile.ts`（公開リスト取得関数追加）
- `app/system-admin/content/page.tsx`（ハブにカード追加）
- `app/mypage/profile/page.tsx`（マスタ取得＆props受け渡し）
- `app/mypage/profile/ProfileEditClient.tsx`（ハードコード削除＋カイテク式UI化）
- （任意）`app/admin/workers/page.tsx` / `app/admin/workers/[id]/page.tsx`（略称・色マップ追記）
</content>
</invoke>
