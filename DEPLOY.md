# Deployment Guide (Raspberry Pi)

このアプリケーションを Raspberry Pi にデプロイして実行するための手順です。

## 1. 前提条件 (Prerequisites)

Raspberry Pi 上で以下のソフトウェアが必要です。

- **Node.js**: v18以上推奨 (v20などLTS版推奨)
- **Git**
- **System Dependencies** (`rec_radiko_ts.sh`用)
  - `ffmpeg`
  - `curl`
  - `libxml2-utils` (xmllint)

### システムパッケージのインストール

```bash
sudo apt update
sudo apt install -y ffmpeg curl libxml2-utils git
```

### Node.jsのインストール (未インストールの場合)

NodeSource からインストールすることをお勧めします。

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 2. アプリケーションの配置

### 方法A: Git経由 (推奨)

Raspberry Pi 上でリポジトリをクローンします。

```bash
git clone <your-repository-url> radikorec
cd radikorec
```

※ まだリポジトリがない場合は、ローカルからファイルを転送してください（方法B）。

### 方法B: ファイル転送 (rsync/scp)

ローカルマシン (Mac) から Raspberry Pi へファイルをコピーします。
(`node_modules`, `.next`, `.git` は除外して転送し、Pi上でインストール・ビルドするのが安全です)

```bash
# ローカルマシンで実行
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' ./ pi@<IP_ADDRESS>:~/radikorec
```

## 3. インストール & ビルド

Raspberry Pi 上で以下を実行します。

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

ブラウザから `http://<RASPBERRY_PI_IP>:3000` にアクセスできれば成功です。
試しに録音を行い、正常に動作するか確認してください。

### 方法A: .envファイルを作成する (推奨)
プロジェクトルートに `.env` ファイルを作成して設定を保存します。この方法は再起動後も設定が維持されます。

```bash
# Raspberry Pi上で実行
cd ~/radikorec
nano .env
```

`.env` ファイルの内容:
```env
RADIKO_MAIL="your@email.com"
RADIKO_PASSWORD="your_password"
```

保存後 (`Ctrl+O`, `Enter`, `Ctrl+X`)、通常通り起動します:
```bash
npm start
```

### 方法B: コマンドライン引数 (一時的)
動作確認などで一時的に利用する場合:

```bash
RADIKO_MAIL="your@email.com" RADIKO_PASSWORD="pass" npm start
```

## 5. 常時実行設定 (PM2)

バックグラウンドで常時実行させ、OS再起動時も自動起動するように `pm2` の使用を推奨します。

```bash
# pm2のインストール
sudo npm install -g pm2

# アプリケーションの登録
# 環境変数を設定する場合は --env オプションまたは ecosystem.config.js を使用
RADIKO_MAIL="your@email.com" RADIKO_PASSWORD="pass" pm2 start npm --name "radikorec" -- start

# 設定の保存 (再起動後も有効にする)
pm2 save
pm2 startup
# 表示されたコマンドを実行してください
```

## 6. トラブルシューティング

- **録音が始まらない**: `pm2 logs radikorec` でログを確認してください。
- **SQLiteのエラー**: `npm install` を実行した環境と実行環境のアーキテクチャが異なると発生します。必ず Raspberry Pi 上で `npm install` (または `npm rebuild`) を行ってください。
- **ffmpegが見つからない**: `PATH` が通っているか確認してください (`which ffmpeg`)。
