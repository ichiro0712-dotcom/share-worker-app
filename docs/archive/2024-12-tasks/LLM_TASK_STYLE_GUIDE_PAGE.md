# 無料LLM向け指示書: スタイルガイドページ更新

## 作業概要

既存の `/style-guide` ページを更新し、新しいデザインシステム（ワーカー向け・管理者向け）を視覚的に確認できるようにする。

**目的**: `docs/style-guide-worker.md` と `docs/style-guide-admin.md` の内容を、実際のUIコンポーネントとして表示するページを作成する。

**参照ドキュメント**:
- `docs/style-guide-worker.md` - ワーカー向けスタイルガイド
- `docs/style-guide-admin.md` - 管理者向けスタイルガイド

---

## 変更対象ファイル

`app/style-guide/page.tsx`

---

## 変更内容

### 1. タブの追加

現在のタブ:
```typescript
const tabs = [
    { id: 'colors', label: 'カラーパレット' },
    { id: 'typography', label: 'タイポグラフィ' },
    { id: 'buttons', label: 'ボタン' },
    { id: 'components', label: 'UIコンポーネント' },
];
```

変更後:
```typescript
const tabs = [
    { id: 'worker', label: 'ワーカー向け' },
    { id: 'admin', label: '管理者向け' },
    { id: 'colors', label: 'カラーパレット' },
    { id: 'typography', label: 'タイポグラフィ' },
    { id: 'buttons', label: 'ボタン' },
    { id: 'components', label: 'UIコンポーネント' },
];
```

### 2. ワーカー向けセクションの追加

`{activeTab === 'worker' && (` の中に以下を追加:

```tsx
{activeTab === 'worker' && (
    <section className="space-y-8">
        <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">ワーカー向けデザイン（PayPay風）</h2>
            <p className="text-gray-500 mb-6">ワーカー向けページで使用するカラーとコンポーネント。</p>

            {/* カラーパレット */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">カラーパレット</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-2">
                        <div className="h-20 rounded-card bg-primary flex items-center justify-center">
                            <span className="text-white text-xs font-medium">#FF3333</span>
                        </div>
                        <p className="text-xs font-medium text-gray-900 text-center">primary</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="h-20 rounded-card bg-primary-dark flex items-center justify-center">
                            <span className="text-white text-xs font-medium">#E62E2E</span>
                        </div>
                        <p className="text-xs font-medium text-gray-900 text-center">primary-dark</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="h-20 rounded-card bg-primary-light flex items-center justify-center border border-gray-200">
                            <span className="text-gray-900 text-xs font-medium">#FFE5E5</span>
                        </div>
                        <p className="text-xs font-medium text-gray-900 text-center">primary-light</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="h-20 rounded-card bg-secondary flex items-center justify-center">
                            <span className="text-white text-xs font-medium">#3895FF</span>
                        </div>
                        <p className="text-xs font-medium text-gray-900 text-center">secondary</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="h-20 rounded-card bg-secondary-dark flex items-center justify-center">
                            <span className="text-white text-xs font-medium">#2D7AD9</span>
                        </div>
                        <p className="text-xs font-medium text-gray-900 text-center">secondary-dark</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="h-20 rounded-card bg-secondary-light flex items-center justify-center border border-gray-200">
                            <span className="text-gray-900 text-xs font-medium">#E5F2FF</span>
                        </div>
                        <p className="text-xs font-medium text-gray-900 text-center">secondary-light</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="h-20 rounded-card bg-background flex items-center justify-center border border-gray-200">
                            <span className="text-gray-900 text-xs font-medium">#F7F7F7</span>
                        </div>
                        <p className="text-xs font-medium text-gray-900 text-center">background</p>
                    </div>
                </div>
            </div>

            {/* ボタン */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">ボタン</h3>
                <div className="flex flex-wrap gap-4 items-center">
                    <button className="px-6 py-3 bg-primary text-white rounded-button font-medium shadow-primary hover:bg-primary-dark transition-all">
                        プライマリボタン
                    </button>
                    <button className="px-6 py-3 bg-secondary text-white rounded-button font-medium shadow-secondary hover:bg-secondary-dark transition-all">
                        セカンダリボタン
                    </button>
                    <button className="px-6 py-3 bg-white text-primary border-[1.5px] border-primary rounded-button font-medium hover:bg-primary-light transition-all">
                        アウトラインボタン
                    </button>
                    <button className="px-6 py-3 text-gray-600 rounded-button font-medium hover:bg-gray-100 transition-all">
                        ゴーストボタン
                    </button>
                </div>
            </div>

            {/* カード */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">カード</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-surface rounded-card p-4 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 cursor-pointer">
                        <h4 className="font-bold text-gray-900 mb-2">求人カード</h4>
                        <p className="text-sm text-gray-600 mb-2">角丸16px、シャドウ付き、ホバー時に浮き上がる効果</p>
                        <p className="text-lg font-bold text-primary">¥1,500/時</p>
                    </div>
                    <div className="bg-background rounded-card p-4">
                        <h4 className="font-bold text-gray-900 mb-2">情報カード</h4>
                        <p className="text-sm text-gray-600">背景 #F7F7F7、角丸12px</p>
                    </div>
                </div>
            </div>

            {/* バッジ */}
            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">ステータスバッジ</h3>
                <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-secondary-light text-secondary rounded-badge text-sm font-medium">募集中</span>
                    <span className="px-3 py-1 bg-primary-light text-primary rounded-badge text-sm font-medium">締切間近</span>
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-badge text-sm font-medium">完了</span>
                </div>
            </div>
        </div>
    </section>
)}
```

### 3. 管理者向けセクションの追加

`{activeTab === 'admin' && (` の中に以下を追加:

```tsx
{activeTab === 'admin' && (
    <section className="space-y-8">
        <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">管理者向けデザイン（プロフェッショナル）</h2>
            <p className="text-gray-500 mb-6">管理者向けページで使用するカラーとコンポーネント。</p>

            {/* カラーパレット */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">カラーパレット</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-2">
                        <div className="h-20 rounded-admin-card bg-admin-primary flex items-center justify-center">
                            <span className="text-white text-xs font-medium">#2563EB</span>
                        </div>
                        <p className="text-xs font-medium text-gray-900 text-center">admin-primary</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="h-20 rounded-admin-card bg-admin-primary-dark flex items-center justify-center">
                            <span className="text-white text-xs font-medium">#1D4ED8</span>
                        </div>
                        <p className="text-xs font-medium text-gray-900 text-center">admin-primary-dark</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="h-20 rounded-admin-card bg-admin-primary-light flex items-center justify-center border border-gray-200">
                            <span className="text-gray-900 text-xs font-medium">#DBEAFE</span>
                        </div>
                        <p className="text-xs font-medium text-gray-900 text-center">admin-primary-light</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="h-20 rounded-admin-card bg-admin-sidebar flex items-center justify-center">
                            <span className="text-white text-xs font-medium">#111827</span>
                        </div>
                        <p className="text-xs font-medium text-gray-900 text-center">admin-sidebar</p>
                    </div>
                </div>
            </div>

            {/* ボタン */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">ボタン</h3>
                <div className="flex flex-wrap gap-4 items-center">
                    <button className="px-4 py-2 text-sm bg-admin-primary text-white rounded-admin-button font-medium hover:bg-admin-primary-dark transition-colors">
                        求人作成
                    </button>
                    <button className="px-4 py-2 text-sm bg-green-600 text-white rounded-admin-button font-medium hover:bg-green-700 transition-colors">
                        公開する
                    </button>
                    <button className="px-4 py-2 text-sm bg-gray-600 text-white rounded-admin-button font-medium hover:bg-gray-700 transition-colors">
                        停止する
                    </button>
                    <button className="px-4 py-2 text-sm bg-red-600 text-white rounded-admin-button font-medium hover:bg-red-700 transition-colors">
                        削除する
                    </button>
                    <button className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-admin-button font-medium hover:bg-gray-50 transition-colors">
                        テンプレート管理
                    </button>
                </div>
            </div>

            {/* カード */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">カード</h3>
                <div className="bg-white rounded-admin-card border border-gray-200 hover:border-admin-primary hover:shadow-md transition-all p-4 cursor-pointer">
                    <div className="flex items-center gap-3">
                        <input type="checkbox" className="w-4 h-4 text-admin-primary border-gray-300 rounded" />
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">公開中</span>
                                <span className="font-medium text-gray-900">介護スタッフ募集</span>
                            </div>
                            <p className="text-sm text-gray-600">2025/12/04 10:00〜18:00 • 応募: 3名 • マッチング: 1/2名</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ステータスバッジ */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">ステータスバッジ</h3>
                <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">公開中</span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">停止中</span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">勤務中</span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-700">評価待ち</span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-500">完了</span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">不成立</span>
                </div>
            </div>

            {/* サイドバーサンプル */}
            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">サイドバーサンプル</h3>
                <div className="bg-admin-sidebar rounded-lg p-4 w-60">
                    <div className="space-y-1">
                        <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-admin-button text-blue-400 bg-blue-500/20 text-sm">
                            <span>📊</span>
                            <span>ダッシュボード</span>
                        </a>
                        <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-admin-button text-gray-400 hover:text-white hover:bg-white/5 text-sm transition-colors">
                            <span>📋</span>
                            <span>求人管理</span>
                        </a>
                        <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-admin-button text-gray-400 hover:text-white hover:bg-white/5 text-sm transition-colors">
                            <span>👥</span>
                            <span>応募管理</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </section>
)}
```

### 4. カラーパレットセクションの更新

既存の `{activeTab === 'colors' && (` セクション内の「プライマリーカラー」部分を更新:

```tsx
{/* Primary Colors */}
<div>
    <h3 className="text-lg font-medium text-gray-900 mb-3">プライマリーカラー（ワーカー向け）</h3>
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <ColorCard name="primary" class="bg-primary" hex="#FF3333" text="text-white" />
        <ColorCard name="primary-dark" class="bg-primary-dark" hex="#E62E2E" text="text-white" />
        <ColorCard name="primary-light" class="bg-primary-light" hex="#FFE5E5" border />
        <ColorCard name="secondary" class="bg-secondary" hex="#3895FF" text="text-white" />
        <ColorCard name="secondary-dark" class="bg-secondary-dark" hex="#2D7AD9" text="text-white" />
        <ColorCard name="secondary-light" class="bg-secondary-light" hex="#E5F2FF" border />
    </div>
</div>

{/* Admin Colors */}
<div>
    <h3 className="text-lg font-medium text-gray-900 mb-3">管理者向けカラー</h3>
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <ColorCard name="admin-primary" class="bg-admin-primary" hex="#2563EB" text="text-white" />
        <ColorCard name="admin-primary-dark" class="bg-admin-primary-dark" hex="#1D4ED8" text="text-white" />
        <ColorCard name="admin-primary-light" class="bg-admin-primary-light" hex="#DBEAFE" border />
        <ColorCard name="admin-sidebar" class="bg-admin-sidebar" hex="#111827" text="text-white" />
    </div>
</div>
```

---

## 作業完了後チェックリスト（必須）

以下を順番に実行してください：

### 1. キャッシュクリアと再ビルド
tailwind.config.ts、globals.css、その他スタイル関連ファイルを変更した場合：
```bash
rm -rf .next && npm run build
```

### 2. TypeScriptエラーチェック
```bash
npm run build
```
エラーがあれば修正してから次へ進む。

### 3. 開発サーバー再起動
```bash
# 既存のサーバーを停止してから
rm -rf .next && npm run dev
```

### 4. ブラウザ確認
- http://localhost:3000/style-guide にアクセス
- ハードリロード（Cmd+Shift+R または Ctrl+Shift+R）で確認
- DevToolsのNetworkタブで「Disable cache」をチェックして確認
- 以下を確認:
  - [ ] 「ワーカー向け」タブで赤・青のカラーが表示される
  - [ ] 「管理者向け」タブで青・グレーのカラーが表示される
  - [ ] ボタンの角丸が正しく適用されている
  - [ ] シャドウが正しく適用されている

### 5. 変更ファイルの報告
変更したファイル一覧を報告すること。

---

## 注意事項

1. **カスタムTailwindクラス**: 以下のクラスは`tailwind.config.ts`で定義済み:
   - `rounded-card` (16px)
   - `rounded-button` (12px)
   - `rounded-admin-card` (8px)
   - `rounded-admin-button` (6px)
   - `rounded-badge` (20px)
   - `shadow-card`, `shadow-card-hover`
   - `shadow-primary`, `shadow-secondary`
   - `bg-admin-primary`, `bg-admin-primary-dark`, `bg-admin-primary-light`, `bg-admin-sidebar`
   - `bg-background`, `bg-surface`

2. **既存コードの維持**: 既存のタブ（colors, typography, buttons, components）は削除せず、新しいタブを先頭に追加する

3. **型エラーに注意**: TypeScriptエラーが発生した場合は修正してから進む

---

## 完了条件

- [ ] `/style-guide` ページに「ワーカー向け」「管理者向け」タブが追加されている
- [ ] 各タブでそれぞれのデザインシステムが視覚的に確認できる
- [ ] `npm run build` がエラーなく完了する
- [ ] ブラウザで正しく表示される
