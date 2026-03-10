# radikoRec

radikoの番組を録音・管理するWebアプリです。
Linux(Ubuntu)やRaspberry Pi などの常時稼働マシンでの運用を想定しています。

## 特徴

- **WEBダッシュボード**: 予約状況・録音済みファイル・システムログに加え、ディスクのストレージ使用量も一画面で確認できます。
- **柔軟な予約**:
    - 通常予約（開始日時指定）
    - タイムフリー録音（番組終了から5分後に録音開始）
    - リアルタイム録音（放送中の番組をライブ録音）
    - 毎週予約（指定の曜日に自動録音）
- **キーワード自動予約**: キーワードを登録しておくと、radiko の番組表を定期スキャンして自動的に予約を作成します。
    - 重複予約防止オプション（同一番組の二重予約を回避）
    - 手動スキャン＆プレビュー機能（検索結果を確認してから予約可能）
- **番組検索**: radiko APIを使った番組キーワード検索。未来の番組と過去の番組をフィルタして表示します。
- **過去番組ダウンロード**: タイムフリー対象の過去番組を検索結果から直接ダウンロードできます。並列ダウンロードによる高速化と、リアルタイム進捗表示に対応。
- **内蔵Webプレイヤー**: ブラウザ上で録音ファイルを直接再生。波形プログレスはオミットし、再生速度変更（0.5x〜2.0x）、10秒戻し・30秒送り、レジューム再生、キーボードショートカット等の基本機能に特化。
- **文字起こし機能**: ワンクリックで `faster-whisper` を用いた高精度なAI文字起こしを実行可能。テキストのプレビューと全文コピーに対応しています。
- **PWA対応**: スマートフォンのホーム画面やPCにインストールし、ネイティブアプリのように利用可能（モバイルフレンドリー設計）。
- **番組グループ化**: 録音ファイルを番組タイトルごとにフォルダ分けして表示します。
- **視聴済み管理**: 録音ファイルの視聴済み／未視聴を管理できます。
- **構造化ログ**: pinoベースの構造化ログをダッシュボード上でリアルタイム確認（自動更新）。
- **録音リトライ**: 録音失敗時の自動リトライ機能に加え、Discordへの詳細情報通知（容量・エラーログ等）に対応。


## 技術スタック

- **Frontend/Backend**: [Next.js](https://nextjs.org/) (App Router)
- **Database**: SQLite ([better-sqlite3](https://github.com/WiseLibs/better-sqlite3)) + [Drizzle ORM](https://orm.drizzle.team/)
- **Scheduling**: [node-cron](https://github.com/node-cron/node-cron)
- **Logging**: [pino](https://github.com/pinojs/pino) (構造化ログ)
- **Core Logic**: Pure TypeScript Implementation (ffmpeg wrapper) + Python (`faster-whisper`)
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
