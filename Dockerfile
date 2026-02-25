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
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ソースコードのビルド
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# テレメトリの無効化
ENV NEXT_TELEMETRY_DISABLED 1

RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# pino などの依存関係を standalone フォルダに集約してレイヤー数を削減
# standalone ビルドではコピー漏れが発生するため手動でコピーする
RUN mkdir -p .next/standalone/node_modules && \
    for pkg in pino pino-pretty thread-stream sonic-boom atomic-sleep on-exit-leak-free \
    quick-format-unescaped real-require pino-std-serializers process-warning \
    safe-stable-stringify @pinojs split2 colorette dateformat fast-copy \
    fast-safe-stringify help-me joycon minimist pump secure-json-parse strip-json-comments; do \
      cp -r node_modules/$pkg .next/standalone/node_modules/ || true; \
    done

# 本番用イメージ
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
# タイムゾーン設定
ENV TZ=Asia/Tokyo

# tzdata のインストール (slimイメージには含まれていないため)
RUN apt-get update && apt-get install -y --no-install-recommends tzdata && rm -rf /var/lib/apt/lists/*

# 静的リンクされた ffmpeg バイナリをコピー (サイズ削減のため)
# Docker Hub の mwader/static-ffmpeg イメージからバイナリだけを取得
COPY --from=mwader/static-ffmpeg:6.1 /ffmpeg /usr/local/bin/
COPY --from=mwader/static-ffmpeg:6.1 /ffprobe /usr/local/bin/

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY public ./public

# プリレンダリングキャッシュ設定
RUN mkdir .next
RUN chown nextjs:nodejs .next

# スタンドアロン出力の使用
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --chown=nextjs:nodejs start-server.js ./

COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

# 録音用ディレクトリとデータ用ディレクトリの作成
RUN mkdir -p records data && chown nextjs:nodejs records data

# キャッシュ作成時の権限エラー（EACCES）を回避するため、.next 配下に誰でも書き込めるよう権限設定
RUN mkdir -p .next/cache && chown nextjs:nodejs .next/cache && chmod -R 777 .next/cache && chmod 777 .next

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "start-server.js"]
