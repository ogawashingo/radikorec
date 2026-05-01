import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * 現在のGitの情報を取得します
 */
export function getGitInfo() {
  // Docker環境などのビルド時に生成されたバージョン情報を優先
  try {
    const versionPath = path.join(process.cwd(), 'version.json');
    if (fs.existsSync(versionPath)) {
      return JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    }
  } catch (e) {
    console.error('version.jsonの読み込みに失敗しました:', e);
  }

  // 開発環境などでGitコマンドが使える場合のフォールバック
  try {
    const hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const date = execSync('git log -1 --format=%cd --date=format:"%Y/%m/%d %H:%M"', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const message = execSync('git log -1 --format=%s', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    
    return {
      hash,
      date,
      message,
    };
  } catch {
    // Gitコマンドが失敗してもエラーログを出さない（Docker環境では想定内）
    return null;
  }
}
