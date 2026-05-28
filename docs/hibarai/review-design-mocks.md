# 日払い機能 デザインモックレビュー

**レビュー日**: 2026-05-27
**レビュアー**: Codex (Senior Visual Designer)
**対象**: docs/hibarai/mocks/*.html（9ファイル）
**評価**: **82 / 100**

---

## 総評

骨格はかなり良い。特に「残高 → 受け取る → レビューで増える → 履歴」の流れは成立している。ただし本番品質としては、**小さく薄い文字、赤のブランド整合性、タップ/フォーカス状態**が弱く、30〜60代の看護師・介護士向けには少し"若い決済アプリ風"に寄っている。

## 強み（このまま採用すべき点）

- `.amount{font-size:44px}` と `.primary-btn{height:56px}` で残高と主アクションの優先順位が明確
- コピーが「前払い申請」ではなく「受け取る」「今すぐ受け取れる金額」に寄せられており、心理的負担が少ない
- 07の「レビューすると ¥8,640 受け取れます」はUXレビューP0課題をかなり解消
- カードの `--shadow:0 1px 2px rgba(...),0 8px 22px rgba(...)` は過剰ではなく、白背景でも安っぽく見えにくい
- 08の管理画面は緊急停止/エラーキュー/プリセットが1画面にあり、業務密度が良い

## クリティカル改善点（P0）

### P0-1: 補助文字とタブが薄く小さい
30〜60代スマホ利用では最優先で直すべき。`.tab{color:#94A3B8;font-size:10px}` は白背景でコントラスト約2.56しかない。

```css
/* before */
.tab{color:#94A3B8;font-size:10px;}

/* after */
.tab{color:#64748B;font-size:11px;min-height:56px;}
.h-sub,.step-sub,.meta span,.chip,.badge{font-size:12px;}
.review p,.reason-row p,.notice,.note,.bank-sub{
  font-size:13px;line-height:1.75;color:#475569;
}
```

### P0-2: Primary赤の整合性とコントラスト
`#FF4757` 上の白文字はコントラスト約3.34で16pxボタン文字に弱い。既存 `#FF3333` ともズレ。

```css
/* after */
:root{
  --brand-primary:#FF3333;   /* ロゴ、ブランド面 */
  --primary:#D92D20;          /* CTA、重要テキスト */
  --primary-2:#C92A2A;        /* CTAグラデ終点 */
  --primary-soft:#FFE7E7;
  --primary-border:#FECACA;
}
.primary-btn{background:linear-gradient(135deg,#D92D20,#C92A2A);}
.brand-mark{background:linear-gradient(135deg,#FF3333,#D92D20);}
```

### P0-3: タップ領域・フォーカス・動きへの配慮
`.icon-btn{width:40px;height:40px}` は最低ライン未満。

```css
/* after */
button,a{touch-action:manipulation;-webkit-tap-highlight-color:rgba(217,45,32,.12);}
.icon-btn{width:44px;height:44px;border-radius:22px;}
.primary-btn,.secondary-btn,.chip,.filter{min-height:44px;}
button:focus-visible,a:focus-visible{
  outline:3px solid rgba(37,99,235,.35);outline-offset:3px;
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{
    animation-duration:.01ms!important;
    transition-duration:.01ms!important;
  }
}
```

## 推奨改善（P1）

- Noto Sans JP の全wt importは重い。システムフォント優先で `Hiragino Sans → Yu Gothic UI → Noto Sans JP` のフォールバック構成は維持。
- `font-weight:800` が多すぎる。金額・主CTA・見出し以外は `700` まで落とすと大人っぽくなる
- 金額は `font-variant-numeric:tabular-nums;` も追加して桁の安定感UP
- 戻る `.icon-btn` に `aria-label` がない画面あり
- 07の星評価は `<div>` で構築。本番では `<button>` + aria 状態
- 08の緊急停止はprimary赤と同色になっているので、`--error:#B42318` 系に寄せて危険操作と認識させる

## 微調整（P2）

- 「受取口座 変更」→「受取口座の変更」
- 「銀行で確認できしだい」→「銀行で確認でき次第」
- 日付は `5月26日（火）` の全角括弧で日本語UIらしさ
- border-radius が 18/20/28/56px と多種。カードは `14〜16px`、ボタンは pill で整理
- `#2EC4B6` 使いすぎると医療感よりポップ感が出る。レビュー解放/安心通知/完了系に限定

## 画面別の特記事項

| # | 画面 | コメント |
|---|---|---|
| index | 一覧 | `.open{height:42px}` は44px以上にしたい |
| 01 | お金タブ | **最も良い画面**。下部タブだけ要改善 |
| 02 | 受け取る | `.hint{font-size:12px}` は重要情報なので13〜14pxへ |
| 03 | 確認シート | `.dim{background:rgba(15,23,42,.36)}` は少し重い。`.28` 程度に |
| 04 | 完了 | reduced motion 対応が本番前に必須 |
| 05 | 口座変更 | `.step{font-size:11px}` `.notice{font-size:12px}` は本人確認の安心感が弱い |
| 06 | エラー詳細 | コピーはかなり良い。原因説明 `.reason-row p{font-size:12px}` を13px以上に |
| 07 | レビュー提出 | 軽さは出ている。星評価のセマンティクスとフォーカスが弱い |
| 08 | 管理者 | 業務密度OK。テーブル `th{font-size:12px}` は少し薄い |

## 既存primary #FF3333 との整合性

`#FF3333` をそのまま白文字ボタン背景に使うとコントラスト約3.64で弱い。**ブランド色と操作色を分ける**のが正解。

```css
:root{
  --brand-primary:#FF3333; /* ロゴ、ブランド面、軽いハイライト */
  --primary:#D92D20;       /* CTA、重要テキスト、active状態 */
  --primary-2:#C92A2A;     /* CTAグラデ終点 */
  --primary-soft:#FFE7E7;
  --admin:#2563EB;
}
```

これなら既存アプリとの赤の記憶を保ちつつ、医療・報酬受け取り系に必要な信頼感と可読性を両立できる。
