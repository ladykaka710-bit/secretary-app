# Cloudflare Pages へのデプロイ手順

このアプリは Cloudflare Pages（静的ファイル配信 + Pages Functions）に対応しています。
データの保存先はローカルの `data/*.json` ではなく **Cloudflare KV** を使います。

ローカルで `node server.js` を実行する使い方（`data/*.json` に保存）は今まで通り使えます。
Cloudflare Pages 版は完全に別のデータストア（KV）を使うため、**ローカルのメモ・タスクとは同期しません**。

## 事前準備

- GitHub にこのリポジトリ（`secretary-app`）がプッシュ済みであること
- Cloudflare アカウントを作成済みであること（未作成の場合は [dash.cloudflare.com](https://dash.cloudflare.com/sign-up) でご自身で作成してください）

## 手順

### 1. Pages プロジェクトを作成し、GitHubリポジトリと連携する

1. [Cloudflareダッシュボード](https://dash.cloudflare.com/) にログイン
2. 左メニューの **Workers & Pages** → **Create** → **Pages** タブ → **Connect to Git**
3. GitHubアカウントを連携し（初回は認可画面が出ます）、`secretary-app` リポジトリを選択
4. ビルド設定を以下のように入力
   - **Framework preset**: `None`
   - **Build command**: 空欄のまま
   - **Build output directory**: `public`
5. **Save and Deploy** をクリック

この時点で `https://secretary-app-xxx.pages.dev` のようなURLが発行され、画面（メモ・タスク・振り返りのUI）は表示されます。
ただし、まだKVを設定していないため、メモやタスクの追加はエラーになります。

### 2. KV namespace を作成する

1. ダッシュボード左メニューの **Storage & Databases** → **KV**
2. **Create a namespace** をクリックし、名前を入力（例: `secretary-app-data`）→ 作成

### 3. Pages プロジェクトにKVをバインドする

1. 作成した Pages プロジェクトを開く → **Settings** タブ → **Functions**
2. **KV namespace bindings** の **Add binding** をクリック
3. 以下を入力
   - **Variable name**: `SECRETARY_KV`（この名前で固定。コード側がこの名前を参照しています）
   - **KV namespace**: 手順2で作成した namespace を選択
4. **Production** と **Preview** の両方に追加してください
5. 保存

### 4. 再デプロイする

バインディングの設定はデプロイ済みのFunctionsには反映されないため、再デプロイが必要です。

- Pages プロジェクトの **Deployments** タブ → 最新のデプロイの「…」メニュー → **Retry deployment**
- もしくは、GitHubリポジトリに何か変更をプッシュすると自動で再デプロイされます

### 5. 動作確認

発行されたURL（`https://xxxxx.pages.dev`）を開き、メモの追加・タスクの追加・振り返りの記録ができることを確認してください。

## 以降の更新について

`main` ブランチに `git push` するたびに、Cloudflare Pages が自動的に再ビルド・再デプロイします。追加の作業は不要です。

## カスタムドメインを使いたい場合

Pages プロジェクトの **Settings** → **Custom domains** から、お持ちのドメインを追加できます（Cloudflareでドメインを管理している場合はワンクリックで設定できます）。
