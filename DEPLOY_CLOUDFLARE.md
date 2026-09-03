# Cloudflare へのデプロイ手順

このアプリは Cloudflare Workers（静的アセット配信 + Workerスクリプトによる API）に対応しています。
データの保存先はローカルの `data/*.json` ではなく **Cloudflare KV** を使います。

ローカルで `node server.js` を実行する使い方（`data/*.json` に保存）は今まで通り使えます。
Cloudflare版は完全に別のデータストア（KV）を使うため、**ローカルのメモ・タスクとは同期しません**。

## 構成

- `public/` … 静的ファイル（HTML/CSS/JS）。`wrangler.jsonc` の `assets.directory` で指定
- `src/worker.js` … `/api/*` を処理するWorkerスクリプト
- `wrangler.jsonc` … デプロイ設定（KVのバインディングもここに書く）

Cloudflareダッシュボードで GitHubリポジトリと連携すると、pushのたびに自動で `npx wrangler deploy` が実行され、この `wrangler.jsonc` の内容がそのまま反映されます。**ダッシュボード上で手動でバインディングを追加する必要はありません。**

## 手順

### 1. KV namespace のIDを `wrangler.jsonc` に設定する

`wrangler.jsonc` の `kv_namespaces` にある `id` を、実際のKV namespaceのIDに書き換えます。

IDの確認方法: Cloudflareダッシュボード → 左メニュー **Storage & Databases → KV** → 対象のnamespace（例: `secretary-app-data`）を開く → **Overview** タブに表示される **Namespace ID** をコピー

```jsonc
"kv_namespaces": [
  {
    "binding": "SECRETARY_KV",
    "id": "ここに実際のNamespace IDを貼り付け"
  }
]
```

### 2. GitHubにプッシュする

```bash
git add -A
git commit -m "Cloudflare Workers用の設定を追加"
git push
```

### 3. Cloudflareダッシュボードで自動デプロイを確認する

すでにGitHub連携済みのWorkerプロジェクト（例: `secretary-app`）であれば、pushすると自動的にビルド・デプロイが走ります。

1. Cloudflareダッシュボード → **Workers & Pages** → 対象のプロジェクトを開く
2. **Deployments** タブで最新のデプロイが成功しているか確認
3. **Bindings** タブに `SECRETARY_KV` が表示されていればOK

まだGitHub連携をしていない場合は、以下の手順で作成してください。

1. **Workers & Pages** → **Create application** → **Import a repository**（Git連携）
2. このリポジトリを選択
3. Build command は空欄、Deploy command は `npx wrangler deploy` のままでOK（`wrangler.jsonc` の設定が自動で使われます）

### 4. 動作確認

発行されたURL（`https://secretary-app.＜サブドメイン＞.workers.dev` など）を開き、メモの追加・タスクの追加・振り返りの記録ができることを確認してください。

## 以降の更新について

`main` ブランチに `git push` するたびに、Cloudflareが自動的に再ビルド・再デプロイします。追加の作業は不要です。

## カスタムドメインを使いたい場合

Workerプロジェクトの **Domains** タブから、お持ちのドメインを追加できます。
