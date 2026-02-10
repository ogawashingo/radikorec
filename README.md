# radikoRec

radikoの番組を録音・管理するWebアプリです。
Linux(Ubuntu)やRaspberry Pi などの常時稼働マシンでの運用を想定しています。

## 特徴

- **WEBダッシュボード**: 予約状況や録音済みファイルを一覧で確認できます。
- **柔軟な予約**:
    - 通常予約（開始日時指定）
    - タイムフリー録音（番組終了から5分後に録音開始）
    - 毎週予約（指定の曜日に自動録音）
- **番組グループ化**: 録音ファイルを番組タイトルごとにフォルダ分けして表示します。
- **動的な放送局リスト**: radiko APIから受信可能な放送局を自動取得します。
- **モバイルフレンドリー**: スマートフォンからも操作・再生が可能です。
- **録音完了後の通知**: Discordに録音完了した番組情報の通知


## 技術スタック

- **Frontend/Backend**: [Next.js](https://nextjs.org/) (App Router)
- **Database**: SQLite ([better-sqlite3](https://github.com/WiseLibs/better-sqlite3))
- **Scheduling**: [node-cron](https://github.com/node-cron/node-cron)
- **Core Logic**: Pure TypeScript Implementation (ffmpeg wrapper)
- **Deployment**: Docker & Docker Compose
- **Styling**: Tailwind CSS / Lucide Icons

## クイックスタート (Docker) 🐳

最も簡単な導入方法です。

### 1. 起動

```bash
git clone https://github.com/ogawashingo/radikorec.git radikorec
cd radikorec

# ビルド & 起動
docker-compose up -d --build
```

これだけで完了です。ブラウザから `http://localhost:3000` にアクセスしてください。

### 2. 環境設定（推奨）
プロジェクトルートに `.env` ファイルを作成すると、設定を永続化できます。

```env
RADIKO_MAIL="user@example.com"
RADIKO_PASSWORD="your_password"
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

---

### 手動セットアップ (Node.js) 🛠️

Dockerを使用しない場合（Node.js + ffmpeg）のセットアップ手順は [DEPLOY.md](./DEPLOY.md) を参照してください。

## 開発

開発サーバーの起動：

```bash
npm run dev
```

## ライセンス

MIT ライセンス
