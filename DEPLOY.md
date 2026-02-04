# Deployment Guide

このアプリケーションを実行するための手順です。

## 1. 前提条件 (Prerequisites)

デプロイ先（サーバー等）で以下のソフトウェアが必要です。

- **Node.js**: v18以上推奨 (v20などLTS版推奨)
- **Git**
- **System Dependencies**
  - `ffmpeg`
  - `curl`

### システムパッケージのインストール

```bash
sudo apt update
sudo apt install -y ffmpeg curl git
```

### Node.jsのインストール (未インストールの場合)

NodeSource からインストールすることをお勧めします。

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 2. アプリケーションの配置

### Git経由

デプロイ先でリポジトリをクローンします。

```bash
git clone https://github.com/ogawashingo/radikorec.git radikorec
cd radikorec
```

## 3. インストール & ビルド

デプロイ先で以下を実行します。

```bash
cd ~/radikorec
npm install
npm run build
```

## 4. 実行確認

まずは手動で起動して動作を確認します。

```bash
npm start
```

ブラウザから `http://<SERVER_IP>:3000` にアクセスできれば成功です。
試しに録音を行い、正常に動作するか確認してください。

### 方法A: .envファイルを作成する (推奨)
プロジェクトルートに `.env` ファイルを作成して設定を保存します。この方法は再起動後も設定が維持されます。

```bash
# デプロイ先で実行
cd ~/radikorec
nano .env
```

`.env` ファイルの内容:
```env
RADIKO_MAIL="user@example.com"
RADIKO_PASSWORD="your_password"
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

保存後 (`Ctrl+O`, `Enter`, `Ctrl+X`)、通常通り起動します:
```bash
npm start
```

### 方法B: コマンドライン引数 (一時的)
動作確認などで一時的に利用する場合:

```bash
RADIKO_MAIL="user@example.com" RADIKO_PASSWORD="pass" npm start
```

## 5. 常時実行設定 (PM2)

バックグラウンドで常時実行させ、OS再起動時も自動起動するように `pm2` の使用を推奨します。

```bash
# pm2のインストール
sudo npm install -g pm2

# アプリケーションの登録
# 環境変数を設定する場合は --env オプションまたは ecosystem.config.js を使用
RADIKO_MAIL="user@example.com" RADIKO_PASSWORD="pass" DISCORD_WEBHOOK_URL="..." pm2 start npm --name "radikorec" -- start

# 設定の保存 (再起動後も有効にする)
pm2 save
pm2 startup
# 表示されたコマンドを実行してください
```

## 6. トラブルシューティング

- **録音が始まらない**: `pm2 logs radikorec` でログを確認してください。
- **SQLiteのエラー**: `npm install` を実行した環境と実行環境のアーキテクチャが異なると発生します。必ずデプロイ先の環境で `npm install` (または `npm rebuild`) を行ってください。
- **ffmpegが見つからない**: `PATH` が通っているか確認してください (`which ffmpeg`)。
