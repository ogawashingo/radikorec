import { execSync } from 'child_process';

/**
 * 現在のGitの情報を取得します
 */
export function getGitInfo() {
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim();
    const date = execSync('git log -1 --format=%cd --date=format:"%Y/%m/%d %H:%M"').toString().trim();
    const message = execSync('git log -1 --format=%s').toString().trim();
    
    return {
      hash,
      date,
      message,
    };
  } catch (error) {
    console.error('Git情報の取得に失敗しました:', error);
    return null;
  }
}
