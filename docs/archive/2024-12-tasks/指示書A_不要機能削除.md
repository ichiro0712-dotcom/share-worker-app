# 指示書A: システム管理画面の不要機能削除

## 作業の目的と背景

システム管理画面のサイドバーから「応募管理」と「メッセージ管理」のメニュー項目を削除します。
これらの機能はシステム管理者には不要と判断されました。

**注意**: 施設管理者（app/admin）側のメニューには影響を与えないでください。

## 具体的な変更内容

### 1. サイドバーからメニュー項目を削除

**ファイル**: `components/system-admin/SystemAdminLayout.tsx`

以下の2つのメニュー項目を`menuItems`配列から削除してください：

```tsx
// 削除対象1: 応募管理（80-85行目付近）
{
    title: '応募管理',
    icon: <FileText className="w-4 h-4" />,
    href: '/system-admin/applications',
    active: pathname?.startsWith('/system-admin/applications'),
},

// 削除対象2: メッセージ管理（86-91行目付近）
{
    title: 'メッセージ管理',
    icon: <MessageSquare className="w-4 h-4" />,
    href: '/system-admin/messages',
    active: pathname?.startsWith('/system-admin/messages'),
},
```

削除後、未使用になる以下のimportも削除してください（他で使われていなければ）：
- `FileText`（応募管理で使用）
- `MessageSquare`（メッセージ管理で使用）

**確認方法**: 他のメニュー項目で`FileText`や`MessageSquare`が使われていないか確認し、使われていなければimportから削除

### 2. 応募管理ページの削除

**削除対象ディレクトリ**: `app/system-admin/applications/`

このディレクトリ全体を削除してください。

```bash
rm -rf app/system-admin/applications
```

### 3. メッセージ管理ページの確認と削除（存在する場合）

**確認対象**: `app/system-admin/messages/`

このディレクトリが存在する場合は削除してください。
存在しない場合はスキップしてください。

```bash
# 存在確認
ls app/system-admin/messages

# 存在する場合のみ削除
rm -rf app/system-admin/messages
```

## 完了条件

1. サイドバーに「応募管理」「メッセージ管理」が表示されないこと
2. `/system-admin/applications` にアクセスすると404になること
3. TypeScriptエラーがないこと（`npm run build` が成功すること）

## 作業完了後チェックリスト（必須）

以下を順番に実行してください：

### 1. キャッシュクリアと再ビルド
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
- ハードリロード（Cmd+Shift+R または Ctrl+Shift+R）で確認
- システム管理画面（/system-admin）にアクセスし、サイドバーを確認
- 「応募管理」「メッセージ管理」が表示されていないことを確認

### 5. 変更ファイルの報告
変更したファイル一覧を報告すること。
