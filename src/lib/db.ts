import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Docker環境等のためのパス設定
// 環境変数 DB_FILE_PATH があればそれを、なければカレントディレクトリ(またはdataディレクトリ)を探す
const DB_PATH = process.env.DB_FILE_PATH || path.join(process.cwd(), 'data', 'radikorec.db');

// ※ ローカル開発で data/ がない場合のフォールバックロジックが必要なら追加するが、
// シンプルにするため、ローカルでも data/radikorec.db に置くか、
// あるいは process.cwd()/radikorec.db をデフォルトにするか。
// ここでは Docker化に伴い /app/data/radikorec.db を標準とするため、
// ローカルでも data ディレクトリを作ってもらう方が綺麗。
// ただし、既存互換性のため fs.existsSync で分岐する。

const defaultPath = path.join(process.cwd(), 'radikorec.db');
const dataPath = path.join(process.cwd(), 'data', 'radikorec.db');

const finalDbPath = process.env.DB_FILE_PATH
  ? process.env.DB_FILE_PATH
  : (fs.existsSync(dataPath) || fs.existsSync(path.join(process.cwd(), 'data')) ? dataPath : defaultPath);

export const db = new Database(finalDbPath);

// データベーススキーマの初期化
export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id TEXT NOT NULL,
      start_time TEXT NOT NULL, -- ISO 8601 または HH:mm (毎週の場合)
      end_time TEXT,
      duration INTEGER,
      title TEXT,
      recurring_pattern TEXT,   -- "weekly" または null
      day_of_week INTEGER,      -- 0=日...6=土 ("weekly"の場合必須)

      status TEXT DEFAULT 'pending',
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_realtime INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      station_id TEXT,
      title TEXT,               -- 番組タイトル
      start_time TEXT,
      duration INTEGER,
      file_path TEXT,
      size INTEGER,
      is_watched INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 既存テーブルのマイグレーション
  try {
    db.exec("ALTER TABLE schedules ADD COLUMN status TEXT DEFAULT 'pending'");
  } catch (e) { /* ignore */ }

  try {
    db.exec("ALTER TABLE schedules ADD COLUMN day_of_week INTEGER");
  } catch (e) { /* ignore */ }

  try {
    db.exec("ALTER TABLE records ADD COLUMN title TEXT");
  } catch (e) { /* ignore */ }

  try {
    db.exec("ALTER TABLE schedules ADD COLUMN error_message TEXT");
  } catch (e) { /* ignore */ }

  try {
    db.exec("ALTER TABLE schedules ADD COLUMN is_realtime INTEGER DEFAULT 0");
  } catch (e) { /* ignore */ }

  try {
    db.exec("ALTER TABLE records ADD COLUMN is_watched INTEGER DEFAULT 0");
  } catch (e) { /* ignore */ }
}

// インポート時に初期化を実行 (ホットリロード時は注意が必要だが、IF NOT EXISTS なら無害)
initDB();
