# Deployment Guide

このアプリケーションを実行するための手順です。
**Docker を使用する方法（推奨）** と、直接 Node.js 環境で動かす方法があります。

---

## 方法A: Docker での実行 (推奨) 🐳

最も簡単かつ安定して動作する方法です。

### 1. 前提条件
- **Docker**
- **Docker Compose** (または `docker compose` プラグイン)
- **Git**

### 2. セットアップ

```bash
# 1. リポジトリのクローン
git clone https://github.com/ogawashingo/radikorec.git radikorec
cd radikorec

# 2. 設定ファイルの作成 (.env)
# 以下の内容で .env ファイルを作成してください
nano .env
```

`.env` の内容例:
```env
RADIKO_MAIL="user@example.com"
RADIKO_PASSWORD="your_password"
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

### 3. 起動

```bash
# ビルド & バックグラウンド起動
docker-compose up -d --build
```
(※ `docker-compose` コマンドがない場合は `docker compose` を使用してください)

これだけで完了です。ブラウザから `http://<SERVER_IP>:3000` にアクセスしてください。

### 4. データの永続化
以下のファイル/ディレクトリがホスト側にマッピングされ、データが保持されます。
- `records/`: 録音ファイル
- `data/`: データベース (`radikorec.db`) およびログファイル
- `.env`: 環境変数設定

### 5. [Linux/Raspberry Pi] 権限の確認 (重要) ⚠️
LinuxやRaspberry Piで実行する場合、録音ファイルの保存先 (`public/records`) の書き込み権限がないとエラーになることがあります。
以下のコマンドで、ディレクトリの所有者を現在のユーザーに変更しておくことを推奨します。

```bash
# 録音用ディレクトリの権限修正
sudo chown -R 1000:1000 ./public/records
# または
sudo chown -R $(id -u):$(id -g) ./public/records
```

### 6. 管理コマンド
- **停止**: `docker-compose down`
- **ログ確認**: `docker-compose logs -f`

---

## 方法B: 手動インストール (Node.js + PM2) 🛠️

Dockerを使わず、直接サーバー上で動かす場合の手順です。

### 1. 前提条件
- **Node.js**: v20以上推奨 (v18+ 必須)
- **ffmpeg** (必須)
- **curl**

```bash
# Ubuntu/Debian の例
sudo apt update
sudo apt install -y ffmpeg curl git

# Node.js のインストール
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. インストール & ビルド

```bash
git clone https://github.com/ogawashingo/radikorec.git radikorec
cd radikorec

npm install
npm run build
```

### 3. 環境設定
プロジェクトルートに `.env` ファイルを作成します（内容はDocker版と同じ）。

### 4. ディレクトリ権限の設定
アプリケーションが `data/` ディレクトリ（DB・ログ用）と `public/records/` ディレクトリ（録音データ用）を自動作成・書き込みします。
実行ユーザーがこれらのディレクトリに書き込めるように権限を設定してください。

### 5. 起動 (PM2推奨)
OS再起動時も自動起動するように `pm2` の使用を推奨します。

```bash
# pm2のインストール
sudo npm install -g pm2

# アプリケーションの登録・起動
pm2 start npm --name "radikorec" -- start

# 設定の保存 (再起動後も有効にする)
pm2 save
pm2 startup
```

---

## トラブルシューティング

- **録音が始まらない / キーワード予約が動かない**: ログを確認してください。
    - Docker: `docker-compose logs -f`
    - PM2: `pm2 logs radikorec`
    - ログファイル: `data/app.log` (存在する場合)
- **時刻がずれる**: 
    - Docker版は自動的に `Asia/Tokyo` (JST) に設定されます。
    - 手動版の場合は、サーバーのタイムゾーンが JST に設定されているか確認してください (`timedatectl` 等)。
- **SQLiteのエラー (手動版)**: `npm install` を実行した環境と実行環境のアーキテクチャが異なると発生します。必ずデプロイ先の環境で `npm install` を行ってください。
- **ffmpegが見つからない (手動版)**: `PATH` が通っているか確認してください。Docker版ではコンテナ内に同梱されているため問題になりません。
- **Docker 権限エラー (Permission denied)**: `docker-compose up` 実行時に `permission denied while trying to connect to the Docker daemon socket` と表示される場合、現在のユーザーに Docker 実行権限がありません。以下のいずれかを行ってください。
    - `sudo docker-compose up -d --build` のように `sudo` を付与する
    - ユーザーを docker グループに追加する:
      ```bash
      # 設定反映（要再ログインまたは以下コマンド）
      newgrp docker
      ```
- **録音時の Permission denied エラー**: `public/records` ディレクトリへの書き込み権限がありません。
    - 解決策: `sudo chown -R 1000:1000 ./public/records` を実行して、保存先の所有者を現在のユーザー（コンテナの実行ユーザー）に合わせてください。
