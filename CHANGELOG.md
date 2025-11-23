# 変更履歴

このファイルはS WORKSプロジェクトの重要な変更、アーキテクチャの修正、機能追加を記録します。

## [2025-11-24] - ドキュメント統合・用語統一・仕様明確化

### 変更内容
1. **ドキュメント統合**
   - 5つのドキュメントファイルを2つに統合
     - `PROJECT_SPEC.md`: 完全なプロジェクト仕様書（機能、データ構造、画面仕様など）
     - `DEVELOPMENT_LOG.md`: 実装状況、変更履歴、既知の課題
   - コンテキストウィンドウの効率化を実現

2. **用語統一**
   - "事業所" → "施設" にコードベース全体で統一
   - "案件" → "求人" にコードベース全体で統一
   - 対象ファイル: 全コードファイル（app/, components/, data/）

3. **評価フローの明確化（データ構造更新）**
   - 双方向評価システムの仕様を明確化
   - `types/worker.ts` に評価状態フィールドを追加:
     - `ReviewStatus` 型を追加: `'pending' | 'completed'`
     - `WorkerApplication` インターフェースに追加:
       - `workerReviewStatus?: ReviewStatus` (ワーカー→施設の評価状態)
       - `facilityReviewStatus?: ReviewStatus` (施設→ワーカーの評価状態)
   - 4つの評価状態の組み合わせをサポート:
     1. 両者とも未評価
     2. ワーカーのみ評価済み
     3. 施設のみ評価済み
     4. 両者とも評価済み → `status: 'completed_rated'` に変更

4. **ルーティング変更**
   - `/` をトップページ（求人一覧）に変更
   - テストインデックスを `/test/index` に移動
   - `/app/page.tsx` を `/app/test/index/page.tsx` に移動
   - `/app/job-list/page.tsx` の内容を `/app/page.tsx` にコピー

5. **お気に入り・ブックマーク機能の仕様明確化**
   - ワーカー側: ブックマーク廃止、お気に入りのみ
   - 施設側: お気に入りとあとで見る両方を保持
   - 求人詳細ページには「あとで見る」ボタンあり（一時保存）

### 変更理由
- **ドキュメント統合**: コンテキストウィンドウの効率化、情報の一元化
- **用語統一**: 用語の混乱を解消し、仕様の一貫性を保つ
- **評価フロー**: 実際の運用に合わせた双方向評価システムの明確化
- **ルーティング**: ワーカーが最初に見るべきページを `/` に配置
- **お気に入り機能**: ワーカーと施設で異なる要件に対応

### 修正されたファイル

#### ドキュメント
- **新規作成**:
  - `/PROJECT_SPEC.md` - 統合プロジェクト仕様書
  - `/DEVELOPMENT_LOG.md` - 開発ログ

#### 用語統一（事業所→施設、案件→求人）
- `/app/page.tsx` (旧: テストインデックス、現在: `/test/index/page.tsx`)
- `/app/admin/messages/page.tsx`
- `/app/admin/facility/page.tsx`
- `/app/admin/jobs/new/page.tsx`
- `/app/admin/jobs/page.tsx`
- `/app/admin/jobs/templates/new/page.tsx`
- `/app/admin/jobs/templates/[id]/edit/page.tsx`
- `/app/admin/applications/page.tsx`
- `/app/admin/page.tsx`
- `/app/test-index/page.tsx`
- `/components/admin/AdminLayout.tsx`
- `/components/job/FilterModal.tsx`
- `/data/jobTemplates.ts`
- `/data/jobs.ts.backup`

#### データ構造変更
- `/types/worker.ts`
  - `ReviewStatus` 型追加
  - `WorkerApplication` インターフェースに評価状態フィールド追加

#### ルーティング変更
- `/app/page.tsx` - 新しい内容（求人一覧）
- `/app/test/index/page.tsx` - 旧テストインデックス（移動）

### データベースへの影響（将来）
Phase 2以降でデータベースを実装する際:
- `applications` テーブルに評価状態カラムを追加:
  - `worker_review_status` (VARCHAR, DEFAULT 'pending')
  - `facility_review_status` (VARCHAR, DEFAULT 'pending')
- 両方の評価が完了したら `status` を `'completed_rated'` に更新

### 後方互換性
- 既存のダミーデータは互換性を維持
- 評価状態フィールドはオプショナル（`?`）なので既存コードに影響なし
- ルーティング変更により `/` が求人一覧ページになるが、既存の `/job-list` も動作

### 確認事項
- 全コードファイルで用語統一完了
- 評価フローのデータ構造定義完了
- ルーティング変更完了（`/` が求人一覧、`/test/index` がテストインデックス）
- ドキュメントに仕様を完全に反映

---

## [2025-11-18] - テンプレート編集ページの5件制限対応

### 変更内容
テンプレート編集ページで「スキル・経験」「服装・身だしなみ」「持ち物・その他」フィールドに5件制限を追加

### 変更理由
- テンプレート作成ページには既に5件制限が実装済みだったが、編集ページには未実装だった
- 作成と編集で仕様を統一し、データの一貫性を保つため
- ユーザーに対して明確な制限を示し、無制限に項目が追加されることを防ぐ

### 修正されたファイル

#### テンプレート編集ページ
- `/app/admin/jobs/templates/[id]/edit/page.tsx`
  - `addToArray`関数に5件制限のロジックを追加
  - スキル・経験フィールド:
    - ラベルに「（5つまで入力可能）」を追加
    - 入力フィールドとボタンに`disabled={formData.skills.length >= 5}`を追加
  - 服装・身だしなみフィールド:
    - ラベルに「（5つまで入力可能）」を追加
    - 入力フィールドとボタンに`disabled={formData.dresscode.length >= 5}`を追加
  - 持ち物・その他フィールド:
    - ラベルに「（5つまで入力可能）」を追加
    - 入力フィールドとボタンに`disabled={formData.belongings.length >= 5}`を追加

### 後方互換性
- 既存のダミーデータ（全10テンプレート）は全て5件または6件のデータを持っているが、表示には影響なし
- 編集時は5件制限が適用され、6件目以降は追加不可

### 確認事項
- 全10テンプレートのダミーデータに画像パス（`images`フィールド）が既に設定済みであることを確認

---

## [2025-11-18] - テンプレートアーキテクチャの修正

### 変更内容
**重要なアーキテクチャ変更**: テンプレートシステムを事業所ベースから企業全体ベースに変更

### 変更理由
- 初期設計では、テンプレートが各事業所に紐づいていた（`facilityId`フィールドを持っていた）
- 正しい仕様: テンプレートは企業全体で共有され、特定の事業所には紐づかない
- 案件作成時に、事業所とテンプレートを個別に選択する

### 修正されたファイル

#### データ構造
- `/data/jobTemplates.ts`
  - `JobTemplate`インターフェースから`facilityId`、`address`、`access`フィールドを削除
  - 全7テンプレートから事業所固有のデータを削除

#### UI コンポーネント
- `/app/admin/jobs/templates/page.tsx`
  - 事業所フィルター機能を削除
  - 全テンプレートを表示（フィルタリングなし）

- `/app/admin/jobs/templates/new/page.tsx`
  - 事業所選択ドロップダウンを削除
  - 住所・アクセス入力フィールドを削除

- `/app/admin/jobs/templates/[id]/edit/page.tsx`
  - 事業所選択ドロップダウンを削除
  - 住所・アクセス入力フィールドを削除

- `/app/admin/jobs/new/page.tsx`
  - テンプレート選択を事業所選択から独立
  - 全テンプレートを表示（`availableTemplates = jobTemplates`）

#### ドキュメント
- `/docs/requirements.md`
  - テンプレート機能セクションを追加
  - `JobTemplates`テーブル定義を追加
  - `Jobs`テーブルに`template_id`フィールドを追加

- `/docs/PHASE1_PLAN.md`
  - `JobTemplate`インターフェース定義を追加
  - `Job`インターフェースに`templateId`フィールドを追加
  - ダミーデータ作成ステップにテンプレートデータを追加

#### クリーンアップ
- `/requirements.md` (ルート) - 削除（重複ファイル、`/docs/requirements.md`と同一内容）

### データベースへの影響（将来）
Phase 2以降でデータベースを実装する際:
- `job_templates`テーブルを作成（`facility_id`カラムなし）
- `jobs`テーブルに`template_id`カラムを追加（NULL許容、外部キー制約）

### 後方互換性
- 既存のダミーデータは互換性があるよう更新済み
- UIは新しいアーキテクチャで正常に動作

---

## 今後の変更履歴

各重要な変更・機能追加・バグ修正は以下の形式で記録してください:

```markdown
## [YYYY-MM-DD] - 変更タイトル

### 変更内容
- 何が変更されたか

### 変更理由
- なぜ変更が必要だったか

### 修正されたファイル
- 変更されたファイルのリスト

### データベースへの影響
- DBスキーマの変更があれば記載

### 後方互換性
- 互換性に関する注意事項
```
