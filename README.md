# RadikoRec

Radiko の録音をブラウザから管理・再生するための Web インターフェースです。
Raspberry Pi などの常時稼働マシンでの運用を想定しています。

## 特徴

- **WEBダッシュボード**: 予約状況や録音済みファイルを一目で確認できます。
- **柔軟な予約**:
    - 通常予約（開始日時指定）
    - タイムフリー録音（過去の番組を即座に取得）
    - 毎週予約（特定の曜日に自動録音）
- **番組グループ化**: 録音ファイルを番組タイトルごとにフォルダ分けして表示します。
- **動的な放送局リスト**: `rec_radiko_ts.sh` を使用して、受信可能な放送局を自動取得します。
- **モバイルフレンドリー**: スマートフォンからも操作・再生が可能です。

## 技術スタック

- **Frontend/Backend**: [Next.js](https://nextjs.org/) (App Router)
- **Database**: SQLite ([better-sqlite3](https://github.com/WiseLibs/better-sqlite3))
- **Scheduling**: [node-cron](https://github.com/node-cron/node-cron)
- **Core Script**: [rec_radiko_ts.sh](https://github.com/uru2/rec_radiko_ts) (uru2様)
- **Styling**: Tailwind CSS / Lucide Icons

## クイックスタート

### 1. 依存関係のインストール

Raspberry Pi で以下のコマンドを実行します：

```bash
sudo apt update
sudo apt install -y ffmpeg curl libxml2-utils
```

### 2. アプリのセットアップ

```bash
npm install
npm run build
```

### 3. 起動

```bash
npm start
```

詳細なデプロイ方法については [DEPLOY.md](./DEPLOY.md) を参照してください。

## 開発

開発サーバーの起動：

```bash
npm run dev
```

## ライセンス

このプロジェクト自体は MIT ライセンスですが、録音の核となる `rec_radiko_ts.sh` のライセンスに従ってください。
