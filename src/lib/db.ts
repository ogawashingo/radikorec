import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'radikorec.db');

export const db = new Database(DB_PATH);

// データベーススキーマの初期化
export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id TEXT NOT NULL,
      start_time TEXT NOT NULL, -- ISO 8601 or HH:mm for weekly
      end_time TEXT,
      duration INTEGER,
      title TEXT,
      recurring_pattern TEXT,   -- "weekly" or null
      day_of_week INTEGER,      -- 0=Sun, 1=Mon... 6=Sat (Required if recurring_pattern='weekly')
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      station_id TEXT,
      title TEXT,               -- Program title
      start_time TEXT,
      duration INTEGER,
      file_path TEXT,
      size INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration for existing tables
  try {
    db.exec("ALTER TABLE schedules ADD COLUMN status TEXT DEFAULT 'pending'");
  } catch (e) { /* ignore */ }

  try {
    db.exec("ALTER TABLE schedules ADD COLUMN day_of_week INTEGER");
  } catch (e) { /* ignore */ }

  try {
    db.exec("ALTER TABLE records ADD COLUMN title TEXT");
  } catch (e) { /* ignore */ }
}

// インポート時に初期化を実行 (ホットリロード時は注意が必要だが、IF NOT EXISTS なら無害)
initDB();
