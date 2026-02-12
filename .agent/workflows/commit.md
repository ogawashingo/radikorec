---
description: コミット前の確認手順（必ず遵守すること）
---

# コミット前の確認手順

**重要: テストをする前にコミットしない。テストし動作確認したらコミットする。**

## 1. コード変更後のテスト

変更内容に応じて、以下のいずれかまたは複数を実行する：

### Dockerfile / docker-compose.yml の変更時
// turbo
```bash
docker compose build
```
// turbo
```bash
docker compose up -d && sleep 5 && docker compose logs
```
- エラーなしで起動することを確認する
// turbo
```bash
docker compose down
```

### TypeScript / Next.js コードの変更時
// turbo
```bash
npm run build
```
- ビルドエラーがないことを確認する

### テストコードがある場合
// turbo
```bash
npm test
```

## 2. テスト成功を確認してからコミット

```bash
git add <変更ファイル>
git commit -m "日本語でコミットメッセージを記載"
git push
```

## 注意事項
- コミットメッセージは必ず**日本語**で書く
- プログラム中のコメントは必ず**日本語**で記載する
- ファイルを勝手に削除しない
- 破壊的な操作はユーザーに許可を取る
- `docker compose build` に `--no-cache` をつけるのは本当に必要な場合のみ
