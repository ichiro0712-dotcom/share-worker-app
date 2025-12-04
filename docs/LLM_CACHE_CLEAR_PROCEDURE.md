# 必須: キャッシュクリア手順（全タスク共通）

## この手順について

**このファイルの手順は、どんなタスクでも作業完了後に必ず実行してください。**

Next.js + Tailwind CSS の環境では、コード変更後にキャッシュをクリアしないとCSSが反映されません。
この手順をスキップすると、変更が画面に反映されず「動いていない」ように見えます。

---

## 実行手順（この順番で必ず実行）

### 手順1: 開発サーバーを停止

ターミナルで `Ctrl+C` を押すか、以下を実行：

```bash
pkill -f "next"
```

**確認方法**:
```bash
lsof -i :3000
```
何も表示されなければOK。表示されたら再度 `pkill -f "next"` を実行。

---

### 手順2: キャッシュを完全に削除

```bash
rm -rf .next node_modules/.cache
```

**重要**:
- `.next` だけでなく `node_modules/.cache` も必ず削除
- この2つを両方削除しないとCSSが反映されない場合がある

**確認方法**:
```bash
ls -la .next 2>/dev/null || echo "OK: .next is deleted"
ls -la node_modules/.cache 2>/dev/null || echo "OK: cache is deleted"
```

---

### 手順3: ビルドを実行

```bash
npm run build
```

**このステップの目的**:
- TypeScriptエラーがないか確認
- 本番用ビルドでCSSが正しく生成されるか確認

**エラーが出た場合**:
- エラーメッセージを読んで修正
- 修正後、再度 `npm run build` を実行
- **ビルドが成功するまで次に進まない**

---

### 手順4: 開発サーバーを起動

```bash
npm run dev -- --hostname 0.0.0.0
```

**確認方法**:
```
✓ Ready in XXXms
```
と表示されればOK。

---

### 手順5: ブラウザでハードリロード

1. 対象ページをブラウザで開く
2. **Mac**: `Cmd + Shift + R`
3. **Windows**: `Ctrl + Shift + R`

**それでも反映されない場合**:
1. DevTools を開く（F12）
2. Application タブ > Storage > 「Clear site data」ボタンをクリック
3. Network タブ > 「Disable cache」にチェックを入れる
4. 再度ハードリロード

---

## トラブルシューティング

### 症状: CSSが反映されない

```bash
# 1. すべてのNext.jsプロセスを強制終了
pkill -f "next"

# 2. ポートが使用中でないか確認
lsof -i :3000

# 3. キャッシュを完全削除
rm -rf .next node_modules/.cache

# 4. 再ビルド
npm run build

# 5. サーバー起動
npm run dev -- --hostname 0.0.0.0
```

### 症状: ページが500エラーになる

上記と同じ手順を実行。webpackキャッシュの破損が原因。

### 症状: ポート3000が使用中

```bash
# ポートを使用しているプロセスを確認
lsof -i :3000

# プロセスを終了（PIDは上記コマンドで確認）
kill -9 <PID>
```

### 症状: node_modulesが壊れている

```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 動作確認の報告形式

作業完了後、以下の形式で報告してください：

```
## 作業完了報告

### 変更したファイル
- ファイル1: 変更内容の概要
- ファイル2: 変更内容の概要

### キャッシュクリア実行
- [x] pkill -f "next" 実行
- [x] rm -rf .next node_modules/.cache 実行
- [x] npm run build 成功
- [x] npm run dev 起動確認

### 動作確認
- [x] 変更箇所1: 期待通りの表示
- [x] 変更箇所2: 期待通りの表示

### 確認したURL
- http://localhost:3000/xxx - OK
- http://localhost:3000/yyy - OK
```
