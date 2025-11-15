# S WORKS

看護師・介護士のための求人マッチングWebサービス

## プロジェクト構成

```
share-worker-app/
├── docs/                  # ドキュメント
│   ├── requirements.md           # 要件定義書
│   ├── screen-specification.md   # 画面仕様書
│   └── PHASE1_PLAN.md           # Phase 1実装計画
├── mock/                  # HTMLモック
│   ├── top.html
│   ├── job-detail.html
│   └── ...
└── (Next.jsプロジェクト - これから作成)
```

## 開発状況

- [x] HTMLモック作成
- [x] 要件定義
- [x] 画面仕様書作成
- [ ] Phase 1実装中

## ドキュメント

- [要件定義書](docs/requirements.md)
- [画面仕様書](docs/screen-specification.md)
- [Phase 1実装計画](docs/PHASE1_PLAN.md)

## モック

HTMLモックは `mock/` ディレクトリにあります。
ブラウザで `mock/top.html` を開いて確認できます。

## セットアップ（Phase 1実装後）

```bash
npm install
npm run dev
```

## 技術スタック

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
