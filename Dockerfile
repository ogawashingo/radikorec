# ベースイメージ: 互換性の高い Debian (slim) 版を使用
FROM node:20-slim AS base

# 依存関係のインストール（必要な場合のみ）
FROM base AS deps
# better-sqlite3 のビルドに必要なツール類をインストール
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 依存パッケージのインストール
COPY package.json package-lock.json* ./
RUN npm ci

# ソースコードのビルド
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# テレメトリの無効化
ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# 本番用イメージ
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
# タイムゾーン設定
ENV TZ=Asia/Tokyo

# 静的リンクされた ffmpeg バイナリをコピー (サイズ削減のため)
# Docker Hub の mwader/static-ffmpeg イメージからバイナリだけを取得
COPY --from=mwader/static-ffmpeg:6.1 /ffmpeg /usr/local/bin/
COPY --from=mwader/static-ffmpeg:6.1 /ffprobe /usr/local/bin/

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# プリレンダリングキャッシュ設定
RUN mkdir .next
RUN chown nextjs:nodejs .next

# スタンドアロン出力の使用
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 録音用ディレクトリとデータ用ディレクトリの作成
RUN mkdir -p records data && chown nextjs:nodejs records data

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
