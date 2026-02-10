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

# tzdata のインストール (slimイメージには含まれていないため)
RUN apt-get update && apt-get install -y --no-install-recommends tzdata && rm -rf /var/lib/apt/lists/*

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

# pino は内部で worker_threads を使用し、動的にモジュールを読み込むため、
# Next.js の standalone トレーサーでは依存関係が正しくコピーされない。
# pino / pino-pretty の全依存を builder ステージから明示的にコピーする。
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pino ./node_modules/pino
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pino-pretty ./node_modules/pino-pretty
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/thread-stream ./node_modules/thread-stream
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/sonic-boom ./node_modules/sonic-boom
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/atomic-sleep ./node_modules/atomic-sleep
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/on-exit-leak-free ./node_modules/on-exit-leak-free
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/quick-format-unescaped ./node_modules/quick-format-unescaped
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/real-require ./node_modules/real-require
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pino-std-serializers ./node_modules/pino-std-serializers
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/process-warning ./node_modules/process-warning
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/safe-stable-stringify ./node_modules/safe-stable-stringify
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@pinojs ./node_modules/@pinojs
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/split2 ./node_modules/split2
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/colorette ./node_modules/colorette
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/dateformat ./node_modules/dateformat
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/fast-copy ./node_modules/fast-copy
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/fast-safe-stringify ./node_modules/fast-safe-stringify
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/help-me ./node_modules/help-me
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/joycon ./node_modules/joycon
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/minimist ./node_modules/minimist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pump ./node_modules/pump
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/secure-json-parse ./node_modules/secure-json-parse
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/strip-json-comments ./node_modules/strip-json-comments

# 録音用ディレクトリとデータ用ディレクトリの作成
RUN mkdir -p records data && chown nextjs:nodejs records data

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
